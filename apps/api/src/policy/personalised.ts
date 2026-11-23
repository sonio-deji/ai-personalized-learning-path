// Mastery-based path: work on the earliest topic (in curriculum order) that is not yet
// mastered, easiest unanswered question first. A mastered topic is skipped, which is
// where the time saving over the fixed order comes from.
//
// A topic only counts as mastered once the student has also answered at least
// `minAnswers` questions on it. With the ASSISTments parameters one correct answer can
// push p_known past 0.95, so without this a single lucky guess would skip a topic.
//
// If a topic runs out of questions before it is mastered, the student moves on to the
// next unmastered topic rather than getting stuck. Questions are never repeated.

import type { PolicyQuestion, PolicyTopic } from "./fixed.js";

export const MASTERY_THRESHOLD = 0.95;
export const DEFAULT_MIN_ANSWERS = 2;

export type PersonalisedOptions = { threshold?: number; minAnswers?: number };

export function nextPersonalisedQuestion<Q extends PolicyQuestion>(
  topics: readonly PolicyTopic[],
  questions: readonly Q[],
  attemptedIds: ReadonlySet<string>,
  /** p_known per topic id. Include every topic, using the prior where nothing is stored. */
  mastery: ReadonlyMap<string, number>,
  { threshold = MASTERY_THRESHOLD, minAnswers = DEFAULT_MIN_ANSWERS }: PersonalisedOptions = {},
): Q | null {
  const ordered = [...topics].sort((a, b) => a.curriculumOrder - b.curriculumOrder);

  for (const topic of ordered) {
    const inTopic = questions.filter((q) => q.topicId === topic.id);
    const answered = inTopic.filter((q) => attemptedIds.has(q.id)).length;
    const mastered = (mastery.get(topic.id) ?? 0) >= threshold && answered >= minAnswers;
    if (mastered) continue;

    const next = inTopic
      .filter((q) => !attemptedIds.has(q.id))
      .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))[0];
    if (next) return next;
  }
  return null; // every topic mastered or out of questions
}
