// Client for the FastAPI model service. It only predicts; the API decides what to do with it.

const modelUrl = process.env.MODEL_URL ?? "http://127.0.0.1:8000";

export class ModelUnavailableError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${modelUrl}${path}`, { ...init, signal: AbortSignal.timeout(3000) });
  } catch (err) {
    throw new ModelUnavailableError(`model service unreachable: ${String(err)}`);
  }
  if (!res.ok) throw new ModelUnavailableError(`model service ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export type BktUpdate = { p_correct: number; p_known: number; mastered: boolean; source: string };

/** pKnown null = no answers on this topic yet, so the model starts from the topic's prior. */
export function bktUpdate(topicId: string, pKnown: number | null, correct: boolean) {
  return call<BktUpdate>("/bkt/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic_id: topicId, p_known: pKnown, correct }),
  });
}

/**
 * P(correct) from DKT for the next question on `topicId`, given the student's earlier answers
 * (oldest first, not including the one being predicted). null when the model service has no
 * DKT export loaded; any other failure throws, like BKT.
 */
export async function dktPredict(history: { topicId: string; correct: boolean }[], topicId: string) {
  let res: Response;
  try {
    res = await fetch(`${modelUrl}/dkt/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic_id: topicId,
        history: history.map((h) => ({ topic_id: h.topicId, correct: h.correct })),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    throw new ModelUnavailableError(`model service unreachable: ${String(err)}`);
  }
  if (res.status === 503) return null; // no DKT export loaded
  if (!res.ok) throw new ModelUnavailableError(`model service /dkt/predict returned ${res.status}`);
  return ((await res.json()) as { p_correct: number }).p_correct;
}

type Prior = { prior: number };
export type BktTopics = { default: Prior; topics: Record<string, Prior>; mastery_threshold: number };

export function bktTopics() {
  return call<BktTopics>("/bkt/topics");
}

export function priorFor(params: BktTopics, topicId: string): number {
  return (params.topics[topicId] ?? params.default).prior;
}
