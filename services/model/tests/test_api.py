import pytest
from fastapi.testclient import TestClient

from app import bkt
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def placeholder_model():
    # Independent of whatever files exist on this machine.
    app.state.bkt = bkt.BktModel(default=bkt.PLACEHOLDER, trained_on="test")


def test_update_uses_prior_when_p_known_is_null():
    res = client.post("/bkt/update", json={"topic_id": "sets", "p_known": None, "correct": True})
    assert res.status_code == 200
    body = res.json()
    assert body["p_correct"] == pytest.approx(0.375)
    assert body["p_known"] == pytest.approx(0.66)
    assert body["mastered"] is False
    assert body["source"] == "default"


def test_update_rejects_out_of_range_p_known():
    res = client.post("/bkt/update", json={"topic_id": "sets", "p_known": 1.5, "correct": True})
    assert res.status_code == 422


def test_topics_lists_default_and_threshold():
    body = client.get("/bkt/topics").json()
    assert body["mastery_threshold"] == bkt.MASTERY_THRESHOLD
    assert body["default"]["prior"] == bkt.PLACEHOLDER.prior
