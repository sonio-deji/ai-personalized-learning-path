"""Model service: predicts mastery per topic, and nothing else.

The Node API owns the next-question policy. This service will gain POST /bkt/update
in week 5 and POST /dkt/predict in weeks 6-7.
"""

from fastapi import FastAPI

app = FastAPI(title="Knowledge tracing model service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
