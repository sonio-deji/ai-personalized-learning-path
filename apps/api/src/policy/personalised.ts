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
//
// At most `maxPerTopic` questions are asked on a topic before moving on, mastered or not, and
// the student also moves on early when staying would leave fewer than `reserve` questions
// (max(1, minAnswers)) for each topic still ahead. So a student weak on many topics still
// reaches every topic within the practice length (the post-test covers them all), each with
// at least `reserve` questions. Without this, a struggling student could spend all their
// practice on the first few topics.
//
// Practice has a fixed length for both conditions (PRACTICE_LENGTH, enforced by the caller),
// so the comparison is about which questions are chosen, not how many. If every topic is
// mastered or used up before then, practice continues on the topic with the lowest p_known
// that still has questions (review).

import type { PolicyQuestion, PolicyTopic } from "./fixed.js";

export const MASTERY_THRESHOLD = 0.95;
export const DEFAULT_MIN_ANSWERS = 2;
export const DEFAULT_MAX_PER_TOPIC = 5;

export type PersonalisedOptions = {
  threshold?: number;
  minAnswers?: number;
  maxPerTopic?: number;
  /** Practice questions left (PRACTICE_LENGTH minus answers so far). Default: no limit. */
  remaining?: number;
};

export function nextPersonalisedQuestion<Q extends PolicyQuestion>(
  topics: readonly PolicyTopic[],
  questions: readonly Q[],
  attemptedIds: ReadonlySet<string>,
  /** p_known per topic id. Include every topic, using the prior where nothing is stored. */
  mastery: ReadonlyMap<string, number>,
  {
    threshold = MASTERY_THRESHOLD,
    minAnswers = DEFAULT_MIN_ANSWERS,
    maxPerTopic = DEFAULT_MAX_PER_TOPIC,
    remaining = Number.POSITIVE_INFINITY,
  }: PersonalisedOptions = {},
): Q | null {
  const ordered = [...topics].sort((a, b) => a.curriculumOrder - b.curriculumOrder);
  const easiestLeft = (topicId: string) =>
    questions
      .filter((q) => q.topicId === topicId && !attemptedIds.has(q.id))
      .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))[0];

  const answeredOn = (topicId: string) =>
    questions.filter((q) => q.topicId === topicId && attemptedIds.has(q.id)).length;
  const leftOn = (topicId: string) =>
    questions.filter((q) => q.topicId === topicId && !attemptedIds.has(q.id)).length;
  const reserve = Math.max(1, minAnswers);

  for (const [i, topic] of ordered.entries()) {
    const answered = answeredOn(topic.id);
    const mastered = (mastery.get(topic.id) ?? 0) >= threshold && answered >= minAnswers;
    if (mastered || answered >= maxPerTopic) continue; // done for this pass

    // Questions owed to the topics still ahead: up to `reserve` each, as far as they have questions.
    const owedAhead = ordered
      .slice(i + 1)
      .reduce((sum, t) => sum + Math.min(Math.max(0, reserve - answeredOn(t.id)), leftOn(t.id)), 0);
    if (answered > 0 && remaining <= owedAhead) continue; // move on to leave room for them

    const next = easiestLeft(topic.id);
    if (next) return next;
  }

  // Review: every topic is mastered, capped or used up. Lowest p_known first, then curriculum order
  // (the sort is stable, so ties keep curriculum order).
  const byMastery = [...ordered].sort((a, b) => (mastery.get(a.id) ?? 0) - (mastery.get(b.id) ?? 0));
  for (const topic of byMastery) {
    const next = easiestLeft(topic.id);
    if (next) return next;
  }
  return null; // no unanswered questions left at all
}
