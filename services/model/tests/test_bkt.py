import json

import pytest

from app import bkt

P = bkt.Params(prior=0.25, learn=0.15, guess=0.20, slip=0.10)


def test_predict_correct():
    # 0.25 * 0.9 + 0.75 * 0.2
    assert bkt.predict_correct(0.25, P) == pytest.approx(0.375)


def test_update_after_correct_answer():
    p_correct, p_next = bkt.update(0.25, True, P)
    assert p_correct == pytest.approx(0.375)
    # posterior = 0.225 / 0.375 = 0.6; then 0.6 + 0.4 * 0.15
    assert p_next == pytest.approx(0.66)


def test_update_after_wrong_answer():
    p_correct, p_next = bkt.update(0.25, False, P)
    assert p_correct == pytest.approx(0.375)
    # posterior = 0.025 / 0.625 = 0.04; then 0.04 + 0.96 * 0.15
    assert p_next == pytest.approx(0.184)


def test_p_correct_is_from_before_the_answer():
    # The prediction stored for AUC must not depend on the answer it predicts.
    assert bkt.update(0.5, True, P)[0] == bkt.update(0.5, False, P)[0]


@pytest.mark.parametrize("p_known", [0.0, 0.01, 0.5, 0.99, 1.0])
@pytest.mark.parametrize("correct", [True, False])
def test_outputs_stay_probabilities(p_known, correct):
    p_correct, p_next = bkt.update(p_known, correct, P)
    assert 0 <= p_correct <= 1
    assert 0 <= p_next <= 1


def test_three_correct_answers_reach_mastery_with_placeholder_params():
    p = P.prior
    for _ in range(3):
        _, p = bkt.update(p, True, P)
    assert p >= bkt.MASTERY_THRESHOLD


def test_missing_params_file_uses_placeholder(tmp_path):
    model = bkt.load_model(tmp_path / "none.json", tmp_path / "none.csv")
    assert model.for_topic("sets").params == bkt.PLACEHOLDER
    assert model.for_topic("sets").source == "default"


def test_topic_params_average_mapped_skills(tmp_path):
    params = tmp_path / "bkt_params.json"
    params.write_text(json.dumps({
        "trained_on": "test",
        "default": {"prior": 0.5, "learn": 0.1, "guess": 0.2, "slip": 0.1},
        "skills": {
            "A": {"prior": 0.2, "learn": 0.1, "guess": 0.1, "slip": 0.1},
            "B": {"prior": 0.4, "learn": 0.3, "guess": 0.3, "slip": 0.2},
        },
    }))
    topic_map = tmp_path / "map.csv"
    topic_map.write_text("topic_id,skill_name\nt1,A\nt1,B\nt1,Not A Skill\nt2,Not A Skill\n")

    model = bkt.load_model(params, topic_map)

    t1 = model.for_topic("t1")
    assert t1.source == "skills"
    assert vars(t1.params) == pytest.approx({"prior": 0.3, "learn": 0.2, "guess": 0.2, "slip": 0.15})
    assert t1.skills_used == ("A", "B")
    assert t1.skills_missing == ("Not A Skill",)

    # Mapped only to unknown skills, or not mapped at all: default parameters.
    assert model.for_topic("t2").source == "default"
    assert model.for_topic("t2").params == model.default
    assert model.for_topic("unmapped").params == model.default
