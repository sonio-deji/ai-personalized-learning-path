"""Deep Knowledge Tracing: serve the LSTM exported by ml/03_dkt.ipynb.

DKT reads a student's whole answer history and outputs, for every ASSISTments skill,
P(correct on the next question). Unlike BKT it is *not* P(known), and notebook 03 shows it
is unreliable as a mastery signal, so the app only stores it (attempts.p_dkt) for the AUC
comparison; BKT drives the personalised path.

The network speaks ASSISTments skills; this module translates WAEC/JAMB topics:

- Input: each answer on a topic becomes ONE event for the topic's representative skill, the
  first skill listed for that topic in topic_skill_map.csv that the model knows. DKT was
  trained with one skill per answer, so one event per answer keeps the input like its
  training data. Answers on topics with no known skill are left out of the history.
- Output: a topic's P(correct) is the mean over its mapped skills that the model knows.
  A topic with none uses the mean over all skills (the DKT counterpart of BKT's default).
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from statistics import mean

from .topic_map import read_topic_map

log = logging.getLogger(__name__)

# history of (skill_name, correct 0/1), oldest first -> {skill_name: P(correct next)}
SkillPredict = Callable[[Sequence[tuple[str, int]]], dict[str, float]]


def load_onnx(directory: Path) -> tuple[SkillPredict, dict]:
    """Load dkt.onnx + dkt_meta.json, with the same checks as the exported dkt_loader.py."""
    import numpy as np
    import onnxruntime as ort

    meta = json.loads((directory / "dkt_meta.json").read_text(encoding="utf-8"))
    if meta.get("format_version") != 1:
        raise ValueError(f"Unsupported DKT export format {meta.get('format_version')!r}")
    blob = (directory / meta["model_file"]).read_bytes()
    if hashlib.sha256(blob).hexdigest() != meta["model_sha256"]:
        raise ValueError("DKT model and metadata do not match: export them again")

    options = ort.SessionOptions()
    options.intra_op_num_threads = 1  # one student per call: more threads don't help
    session = ort.InferenceSession(blob, options, providers=["CPUExecutionProvider"])
    skills: list[str] = meta["skills"]
    index = {s: i for i, s in enumerate(skills)}

    def predict(history: Sequence[tuple[str, int]]) -> dict[str, float]:
        ids = [0]  # START token, then 1 + 2*skill_index + correct per answer
        for skill, correct in history:
            ids.append(1 + 2 * index[skill] + int(correct))
        probs = session.run(["p_correct"], {"interactions": np.array([ids], dtype=np.int64)})[0][0]
        return {s: float(p) for s, p in zip(skills, probs)}

    # Replay the export's test vectors: a runtime that gives different numbers fails at start-up.
    for case in meta["test_vectors"]:
        got = predict([(s, c) for s, c in case["history"]])
        if not np.allclose([got[s] for s in skills], case["p_correct"], atol=1e-4, rtol=0):
            raise ValueError("DKT test vector failed: the runtime gives different predictions")

    return predict, meta


@dataclass(frozen=True)
class TopicPrediction:
    p_correct: float
    source: str  # "skills" or "default"
    skills_used: tuple[str, ...]
    history_used: int  # answers fed to the network
    history_skipped: int  # answers on topics with no known skill


class DktModel:
    def __init__(self, predict: SkillPredict, skills: Sequence[str], topic_map: dict[str, list[str]],
                 version: str, trained_on: str):
        self._predict = predict
        self.skills = list(skills)
        self.version = version
        self.trained_on = trained_on
        known = set(self.skills)
        # Mapped skills the network knows, in map order; the first is the topic's input skill.
        self.topic_skills = {t: [s for s in names if s in known] for t, names in topic_map.items()}
        for t, names in topic_map.items():
            missing = [s for s in names if s not in known]
            if missing:
                log.warning("DKT topic %s: skills not in the model: %s", t, ", ".join(missing))

    def representative(self, topic_id: str) -> str | None:
        found = self.topic_skills.get(topic_id) or []
        return found[0] if found else None

    def predict_topic(self, history: Sequence[tuple[str, int]], topic_id: str) -> TopicPrediction:
        """history: [(topic_id, correct)], oldest first, NOT including the answer being predicted."""
        events = []
        for t, correct in history:
            skill = self.representative(t)
            if skill is not None:
                events.append((skill, int(correct)))
        probs = self._predict(events)

        used = tuple(self.topic_skills.get(topic_id) or ())
        if used:
            p, source = mean(probs[s] for s in used), "skills"
        else:
            p, source = mean(probs.values()), "default"
        return TopicPrediction(p, source, used, len(events), len(history) - len(events))

    def topics_json(self) -> dict:
        return {t: {"input_skill": self.representative(t), "output_skills": s}
                for t, s in self.topic_skills.items()}


def load_dkt(directory: Path, topic_map_path: Path) -> DktModel | None:
    """None when there is no export yet. A broken export raises, so the service fails at boot."""
    if not (directory / "dkt_meta.json").exists():
        log.warning("No DKT export at %s: /dkt/predict is unavailable", directory)
        return None
    predict, meta = load_onnx(directory)
    return DktModel(predict, meta["skills"], read_topic_map(topic_map_path),
                    version=meta["version"], trained_on=meta.get("trained_on", "unknown"))
