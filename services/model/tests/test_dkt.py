import json
import os
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import dkt
from app.main import app

SKILLS = ["A", "B", "C", "D"]
TOPIC_MAP = {
    "t1": ["A", "B"],  # input skill A, output mean of A and B
    "t2": ["Unknown", "C"],  # first known skill is C
    "t3": ["Unknown"],  # no known skill: left out of input, default output
}


class FakePredict:
    """P(correct) per skill = 0.5 + 0.1 per correct answer on it - 0.1 per wrong one."""

    def __init__(self):
        self.calls = []

    def __call__(self, history):
        self.calls.append(list(history))
        p = {s: 0.5 for s in SKILLS}
        for skill, correct in history:
            p[skill] += 0.1 if correct else -0.1
        return p


def model(predict=None):
    return dkt.DktModel(predict or FakePredict(), SKILLS, TOPIC_MAP, version="test", trained_on="test")


def test_representative_is_first_known_skill():
    m = model()
    assert m.representative("t1") == "A"
    assert m.representative("t2") == "C"
    assert m.representative("t3") is None
    assert m.representative("not-mapped") is None


def test_each_answer_becomes_one_event_for_the_input_skill():
    fake = FakePredict()
    model(fake).predict_topic([("t1", 1), ("t2", 0), ("t1", 1)], "t1")
    assert fake.calls == [[("A", 1), ("C", 0), ("A", 1)]]


def test_answers_on_topics_without_a_known_skill_are_skipped():
    fake = FakePredict()
    pred = model(fake).predict_topic([("t3", 1), ("t1", 0), ("not-mapped", 1)], "t1")
    assert fake.calls == [[("A", 0)]]
    assert (pred.history_used, pred.history_skipped) == (1, 2)


def test_output_is_mean_over_known_mapped_skills():
    pred = model().predict_topic([("t1", 1), ("t1", 1)], "t1")
    # A = 0.7 after two correct answers, B = 0.5
    assert pred.p_correct == pytest.approx(0.6)
    assert pred.source == "skills"
    assert pred.skills_used == ("A", "B")


def test_topic_without_known_skill_uses_mean_over_all_skills():
    pred = model().predict_topic([("t1", 1)], "t3")
    # A = 0.6, B = C = D = 0.5
    assert pred.p_correct == pytest.approx((0.6 + 0.5 * 3) / 4)
    assert pred.source == "default"


def test_new_student_has_empty_history():
    fake = FakePredict()
    pred = model(fake).predict_topic([], "t2")
    assert fake.calls == [[]]
    assert pred.p_correct == pytest.approx(0.5)


def test_missing_export_loads_as_none(tmp_path):
    assert dkt.load_dkt(tmp_path / "none", tmp_path / "map.csv") is None


# ---- API ------------------------------------------------------------------

client = TestClient(app)


@pytest.fixture
def fake_model():
    old = app.state.dkt
    app.state.dkt = model()
    yield
    app.state.dkt = old


def test_predict_endpoint(fake_model):
    res = client.post("/dkt/predict", json={
        "topic_id": "t1",
        "history": [{"topic_id": "t1", "correct": True}, {"topic_id": "t3", "correct": False}],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["p_correct"] == pytest.approx(0.55)  # A = 0.6, B = 0.5
    assert (body["history_used"], body["history_skipped"]) == (1, 1)
    assert body["version"] == "test"


def test_predict_returns_503_when_not_loaded():
    old = app.state.dkt
    app.state.dkt = None
    try:
        assert client.post("/dkt/predict", json={"topic_id": "t1", "history": []}).status_code == 503
        assert client.get("/health").json()["dkt"] is None
    finally:
        app.state.dkt = old


# ---- the real export, when available -------------------------------------
# Run with DKT_TEST_DIR pointing at ml/artifacts/dkt (see README).

EXPORT = Path(os.environ.get("DKT_TEST_DIR", "/nonexistent"))
needs_export = pytest.mark.skipif(not (EXPORT / "dkt_meta.json").exists(), reason="no DKT export")


@needs_export
def test_real_export_loads_and_reproduces_test_vectors():
    predict, meta = dkt.load_onnx(EXPORT)  # raises if a test vector fails
    p = predict([])
    assert set(p) == set(meta["skills"])
    assert all(0 < v < 1 for v in p.values())


@needs_export
def test_real_export_rejects_a_tampered_model(tmp_path):
    shutil.copytree(EXPORT, tmp_path / "dkt")
    meta_path = tmp_path / "dkt" / "dkt_meta.json"
    meta = json.loads(meta_path.read_text())
    meta["model_sha256"] = "0" * 64
    meta_path.write_text(json.dumps(meta))
    with pytest.raises(ValueError, match="do not match"):
        dkt.load_onnx(tmp_path / "dkt")


@needs_export
def test_real_export_responds_to_history():
    predict, meta = dkt.load_onnx(EXPORT)
    skill = meta["skills"][0]
    right = predict([(skill, 1)] * 5)[skill]
    wrong = predict([(skill, 0)] * 5)[skill]
    assert right > wrong
