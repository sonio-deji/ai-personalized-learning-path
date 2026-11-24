// Server-side only (server components and actions): the browser never talks to the API.

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:4000";

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, status: res.status, data: json as T };
    return { ok: false, status: res.status, error: String(json.error ?? "unknown_error") };
  } catch {
    return { ok: false, status: 0, error: "api_unreachable" };
  }
}

// total is null on a personalised path, whose length isn't known in advance.
export type Progress = { answered: number; total: number | null };

export type TopicMastery = { topicId: string; name: string; pKnown: number; mastered: boolean };

export type NextQuestion =
  | { done: true; progress: Progress }
  | {
      done: false;
      progress: Progress;
      question: { id: string; stem: string; options: Record<string, string>; topic: { id: string; name: string } };
    };

export type Feedback = {
  attemptId: number;
  correct: boolean;
  question: { id: string; stem: string; topic: { name: string }; answer: string; answerText: string };
};

export type Stage = "pre_test" | "practice" | "post_test" | "survey" | "finished";

export type TestItems = { kind: "pre" | "post"; items: { id: string; stem: string; options: Record<string, string> }[] };
