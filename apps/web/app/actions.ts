"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getUserId, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function login(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const consent = formData.get("consent") === "on";

  const res = await api<{ userId: string }>("/login", { method: "POST", body: { code, consent } });
  if (!res.ok) redirect(`/?error=${encodeURIComponent(res.error)}`);

  (await cookies()).set(SESSION_COOKIE, res.data.userId, sessionCookieOptions);
  redirect("/"); // the home page sends each participant to their current stage
}

// Longest response time we store. Longer gaps (student left the tab) are capped, not dropped.
const MAX_RESPONSE_MS = 60 * 60 * 1000;

export async function submitAnswer(formData: FormData) {
  const userId = await getUserId();
  if (!userId) redirect("/");

  const questionId = String(formData.get("questionId") ?? "");
  const answer = String(formData.get("answer") ?? "");
  // servedAt is the server time when the question page was rendered.
  const servedAt = Number(formData.get("servedAt"));
  const elapsed = Number.isFinite(servedAt) ? Date.now() - servedAt : 0;
  const responseTimeMs = Math.round(Math.min(Math.max(elapsed, 0), MAX_RESPONSE_MS));

  const res = await api<{ attemptId: number }>(`/users/${userId}/attempts`, {
    method: "POST",
    body: { questionId, answer, responseTimeMs },
  });

  if (res.ok) redirect(`/practice?attempt=${res.data.attemptId}`);
  if (res.error === "user_not_found") redirect("/logout");
  if (res.error === "pre_test_required") redirect("/test");
  // model_unavailable: nothing was stored, so the same question is shown again.
  // not_current_question: e.g. the form was resubmitted with the back button. Show the current one.
  redirect(`/practice?error=${encodeURIComponent(res.error)}`);
}

export async function submitTest(formData: FormData) {
  const userId = await getUserId();
  if (!userId) redirect("/");

  const kind = String(formData.get("kind"));
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("q:")) answers[key.slice(2)] = String(value);
  }
  const servedAt = Number(formData.get("servedAt"));
  const durationMs = Math.round(Math.max(Number.isFinite(servedAt) ? Date.now() - servedAt : 0, 0));

  const res = await api(`/users/${userId}/tests/${kind === "post" ? "post" : "pre"}`, {
    method: "POST",
    body: { answers, durationMs },
  });
  if (!res.ok && res.error === "api_unreachable") redirect("/test?error=unavailable");
  // Submitted, or already submitted (wrong_stage): the home page routes to the next stage.
  redirect("/");
}

export async function submitSurvey(formData: FormData) {
  const userId = await getUserId();
  if (!userId) redirect("/");

  const responses = Array.from({ length: 10 }, (_, i) => Number(formData.get(`sus${i}`)));
  const res = await api(`/users/${userId}/sus`, { method: "POST", body: { responses } });
  if (!res.ok && res.error !== "wrong_stage") redirect("/survey?error=" + encodeURIComponent(res.error));
  redirect("/");
}
