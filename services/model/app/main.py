"""Model service: predicts mastery per topic, and nothing else.

The Node API owns the next-question policy. BKT predicts and tracks mastery; DKT only
predicts P(correct), which the API stores for the AUC comparison.
"""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import bkt, dkt

PARAMS_PATH = Path(os.environ.get("BKT_PARAMS_PATH", "/ml/artifacts/bkt_params.json"))
TOPIC_MAP_PATH = Path(os.environ.get("TOPIC_SKILL_MAP_PATH", "/ml/topic_skill_map.csv"))
DKT_DIR = Path(os.environ.get("DKT_DIR", "/ml/artifacts/dkt"))

app = FastAPI(title="Knowledge tracing model service")
# Loaded once at start-up. Restart the service after replacing the files.
app.state.bkt = bkt.load_model(PARAMS_PATH, TOPIC_MAP_PATH)
# None if there is no export yet; a broken export raises here, so the service fails to start.
app.state.dkt = dkt.load_dkt(DKT_DIR, TOPIC_MAP_PATH)


@app.get("/health")
def health() -> dict[str, str | None]:
    model: dkt.DktModel | None = app.state.dkt
    return {
        "status": "ok",
        "bkt": app.state.bkt.trained_on,
        # null when no DKT export is loaded; the API then stores p_dkt as null.
        "dkt": f"{model.trained_on} ({model.version})" if model else None,
    }


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


class Answer(BaseModel):
    topic_id: str = Field(min_length=1)
    correct: bool


class DktRequest(BaseModel):
    # The student's answers so far, oldest first, NOT including the one being predicted.
    history: list[Answer] = Field(default_factory=list, max_length=5000)
    topic_id: str = Field(min_length=1)  # topic of the question about to be answered


class DktResponse(BaseModel):
    topic_id: str
    p_correct: float  # stored by the API as attempts.p_dkt
    source: str  # "skills" or "default"
    version: str
    history_used: int
    history_skipped: int


@app.post("/dkt/predict")
def dkt_predict(req: DktRequest) -> DktResponse:
    model: dkt.DktModel | None = app.state.dkt
    if model is None:
        raise HTTPException(status_code=503, detail="dkt_not_loaded")
    pred = model.predict_topic([(a.topic_id, int(a.correct)) for a in req.history], req.topic_id)
    return DktResponse(topic_id=req.topic_id, p_correct=pred.p_correct, source=pred.source,
                       version=model.version, history_used=pred.history_used,
                       history_skipped=pred.history_skipped)


@app.get("/dkt/topics")
def dkt_topics() -> dict:
    """How each topic is translated: its input skill and the skills averaged for output."""
    model: dkt.DktModel | None = app.state.dkt
    if model is None:
        raise HTTPException(status_code=503, detail="dkt_not_loaded")
    return {"version": model.version, "trained_on": model.trained_on, "topics": model.topics_json()}
