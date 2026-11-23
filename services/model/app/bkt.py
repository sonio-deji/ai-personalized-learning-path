"""Bayesian Knowledge Tracing: the update rule and topic-level parameters.

BKT treats each topic as a hidden yes/no state: the student either knows it or not.
`p_known` is our belief that they know it. Four parameters describe a topic:

    prior  P(known) before the first question
    learn  chance of moving from "not known" to "known" after a question
    guess  P(correct | not known)
    slip   P(wrong | known)

After each answer we (1) predict P(correct) from the current belief, (2) update the
belief with Bayes' rule given the actual answer, then (3) allow for learning.
"""

from __future__ import annotations

import csv
import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from statistics import mean

log = logging.getLogger(__name__)

MASTERY_THRESHOLD = 0.95


@dataclass(frozen=True)
class Params:
    prior: float
    learn: float
    guess: float
    slip: float


# Used when no trained parameters are available yet. Placeholder values, not fitted.
PLACEHOLDER = Params(prior=0.25, learn=0.15, guess=0.20, slip=0.10)


def predict_correct(p_known: float, p: Params) -> float:
    """P(next answer is correct) given the current belief."""
    return p_known * (1 - p.slip) + (1 - p_known) * p.guess


def update(p_known: float, correct: bool, p: Params) -> tuple[float, float]:
    """Returns (P(correct) predicted before the answer, p_known after the answer)."""
    p_correct = predict_correct(p_known, p)
    if correct:
        posterior = p_known * (1 - p.slip) / p_correct
    else:
        posterior = p_known * p.slip / (1 - p_correct)
    # Rounding can push an exact 0 or 1 just outside [0, 1], which the database rejects.
    posterior = min(max(posterior, 0.0), 1.0)
    p_next = posterior + (1 - posterior) * p.learn
    return p_correct, p_next


@dataclass(frozen=True)
class TopicParams:
    params: Params
    # "skills": averaged over mapped skills found in the trained file; "default": no usable skills.
    source: str
    skills_used: tuple[str, ...] = ()
    skills_missing: tuple[str, ...] = ()

    def to_json(self) -> dict:
        return {
            **asdict(self.params),
            "source": self.source,
            "skills_used": list(self.skills_used),
            "skills_missing": list(self.skills_missing),
        }


@dataclass
class BktModel:
    """Skill parameters from training, collapsed to one parameter set per WAEC/JAMB topic.

    A topic maps to several ASSISTments skills. Its parameters are the mean of those skills'
    parameters, and BKT then runs once per topic. That keeps one p_known per topic, which
    is what the `mastery` table stores.
    """

    default: Params
    trained_on: str
    topics: dict[str, TopicParams] = field(default_factory=dict)

    def for_topic(self, topic_id: str) -> TopicParams:
        return self.topics.get(topic_id) or TopicParams(self.default, "default")


def _params(d: dict) -> Params:
    return Params(**{k: float(d[k]) for k in ("prior", "learn", "guess", "slip")})


def load_model(params_path: Path, topic_map_path: Path) -> BktModel:
    if not params_path.exists():
        log.warning("No BKT parameters at %s: every topic uses placeholder parameters", params_path)
        return BktModel(default=PLACEHOLDER, trained_on="placeholder (no bkt_params.json)")

    raw = json.loads(params_path.read_text())
    skills = {name: _params(p) for name, p in raw.get("skills", {}).items()}
    model = BktModel(
        default=_params(raw["default"]) if "default" in raw else PLACEHOLDER,
        trained_on=str(raw.get("trained_on", "unknown")),
    )

    if not topic_map_path.exists():
        log.warning("No topic-skill map at %s: every topic uses the default parameters", topic_map_path)
        return model

    mapped: dict[str, list[str]] = {}
    with topic_map_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            mapped.setdefault(row["topic_id"].strip(), []).append(row["skill_name"].strip())

    for topic_id, names in mapped.items():
        used = tuple(n for n in names if n in skills)
        missing = tuple(n for n in names if n not in skills)
        if missing:
            log.warning("Topic %s: skills not in the trained parameters: %s", topic_id, ", ".join(missing))
        if not used:
            model.topics[topic_id] = TopicParams(model.default, "default", (), missing)
            continue
        avg = Params(**{k: mean(getattr(skills[n], k) for n in used) for k in ("prior", "learn", "guess", "slip")})
        model.topics[topic_id] = TopicParams(avg, "skills", used, missing)

    return model
