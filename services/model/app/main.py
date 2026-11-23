"""Model service: predicts mastery per topic, and nothing else.

The Node API owns the next-question policy. POST /dkt/predict arrives in weeks 6-7.
"""

import os
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel, Field

from . import bkt

PARAMS_PATH = Path(os.environ.get("BKT_PARAMS_PATH", "/ml/artifacts/bkt_params.json"))
TOPIC_MAP_PATH = Path(os.environ.get("TOPIC_SKILL_MAP_PATH", "/ml/topic_skill_map.csv"))

app = FastAPI(title="Knowledge tracing model service")
# Loaded once at start-up. Restart the service after replacing the files.
app.state.bkt = bkt.load_model(PARAMS_PATH, TOPIC_MAP_PATH)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "bkt": app.state.bkt.trained_on}


@app.get("/bkt/topics")
def bkt_topics() -> dict:
    """Parameters per topic, for showing prior mastery before a topic's first answer.

    Topics not listed use `default`.
    """
    model: bkt.BktModel = app.state.bkt
    return {
        "trained_on": model.trained_on,
        "mastery_threshold": bkt.MASTERY_THRESHOLD,
        "default": vars(model.default),
        "topics": {t: tp.to_json() for t, tp in model.topics.items()},
    }


class UpdateRequest(BaseModel):
    topic_id: str = Field(min_length=1)
    # Current belief. null means the student has not answered this topic yet: use the prior.
    p_known: float | None = Field(default=None, ge=0, le=1)
    correct: bool


class UpdateResponse(BaseModel):
    topic_id: str
    # P(correct) predicted *before* seeing this answer. The API stores it as attempts.p_bkt.
    p_correct: float
    p_known: float  # belief after this answer
    mastered: bool
    source: str  # "skills" or "default": where this topic's parameters came from


@app.post("/bkt/update")
def bkt_update(req: UpdateRequest) -> UpdateResponse:
    tp = app.state.bkt.for_topic(req.topic_id)
    p_known = tp.params.prior if req.p_known is None else req.p_known
    p_correct, p_next = bkt.update(p_known, req.correct, tp.params)
    return UpdateResponse(
        topic_id=req.topic_id,
        p_correct=p_correct,
        p_known=p_next,
        mastered=p_next >= bkt.MASTERY_THRESHOLD,
        source=tp.source,
    )
