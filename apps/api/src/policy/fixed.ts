// Fixed-order baseline (no ML): topics in curriculum order, up to `perTopic`
// questions from each, easiest first. Each question is asked at most once.

export type PolicyTopic = { id: string; curriculumOrder: number };
export type PolicyQuestion = { id: string; topicId: string; difficulty: number };

export function nextFixedQuestion<Q extends PolicyQuestion>(
  topics: readonly PolicyTopic[],
  questions: readonly Q[],
  attemptedIds: ReadonlySet<string>,
  perTopic: number,
): Q | null {
  const ordered = [...topics].sort((a, b) => a.curriculumOrder - b.curriculumOrder);

  for (const topic of ordered) {
    // A topic with fewer than `perTopic` questions is finished once all of them are asked.
    const pool = questions
      .filter((q) => q.topicId === topic.id)
      .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))
      .slice(0, perTopic);

    const next = pool.find((q) => !attemptedIds.has(q.id));
    if (next) return next;
  }
  return null; // every topic finished
}
