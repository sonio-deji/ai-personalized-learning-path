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
  redirect("/practice");
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
  // model_unavailable: nothing was stored, so the same question is shown again.
  // not_current_question: e.g. the form was resubmitted with the back button. Show the current one.
  redirect(`/practice?error=${encodeURIComponent(res.error)}`);
}
