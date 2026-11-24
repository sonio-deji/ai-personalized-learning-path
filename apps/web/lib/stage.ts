import { redirect } from "next/navigation";
import { api, type Stage } from "@/lib/api";

// The page for each study stage: pre-test -> practice -> post-test -> survey -> finished.
export const STAGE_PATH: Record<Stage, string> = {
  pre_test: "/test",
  practice: "/practice",
  post_test: "/test",
  survey: "/survey",
  finished: "/done",
};

/** The participant's stage, or a redirect: to /logout for an unknown user. null if the API is down. */
export async function getStage(userId: string): Promise<Stage | null> {
  const res = await api<{ stage: Stage }>(`/users/${userId}/stage`);
  if (res.ok) return res.data.stage;
  if (res.error === "user_not_found" || res.status === 400) redirect("/logout");
  return null;
}

/** Redirect to the right page unless the participant is at one of `allowed`. */
export async function requireStage(userId: string, allowed: Stage[]): Promise<Stage | null> {
  const stage = await getStage(userId);
  if (stage && !allowed.includes(stage)) redirect(STAGE_PATH[stage]);
  return stage;
}
