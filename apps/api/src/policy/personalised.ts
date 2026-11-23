// Mastery-based path: work on the earliest topic (in curriculum order) that is not yet
// mastered, easiest unanswered question first. A mastered topic is skipped, which is
// where the time saving over the fixed order comes from.
//
// If a topic runs out of questions before it is mastered, the student moves on to the
// next unmastered topic rather than getting stuck. Questions are never repeated.

import type { PolicyQuestion, PolicyTopic } from "./fixed.js";

export const MASTERY_THRESHOLD = 0.95;

export function nextPersonalisedQuestion<Q extends PolicyQuestion>(
  topics: readonly PolicyTopic[],
  questions: readonly Q[],
  attemptedIds: ReadonlySet<string>,
  /** p_known per topic id. Include every topic, using the prior where nothing is stored. */
  mastery: ReadonlyMap<string, number>,
  threshold = MASTERY_THRESHOLD,
): Q | null {
  const ordered = [...topics].sort((a, b) => a.curriculumOrder - b.curriculumOrder);

  for (const topic of ordered) {
    if ((mastery.get(topic.id) ?? 0) >= threshold) continue;

    const next = questions
      .filter((q) => q.topicId === topic.id && !attemptedIds.has(q.id))
      .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))[0];
    if (next) return next;
  }
  return null; // every topic mastered or out of questions
}
