// CSV export for analysis. Writes one table to stdout:
//
//   docker compose exec -T api node dist/src/scripts/export.js attempts > attempts.csv
//
// Tables: participants, attempts, tests, sus. Participant codes are left out on purpose:
// rows are linked by user_id only, so the files can be analysed without identifying anyone.

import { prisma } from "../db.js";
import { susScore, toCsv } from "../study/pure.js";

type TestItems = { durationMs: number; responses: { questionId: string; answer: string | null; correct: boolean }[] };

const tables: Record<string, () => Promise<string>> = {
  async participants() {
    const users = await prisma.user.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return toCsv(
      ["user_id", "condition", "consent", "created_at"],
      users.map((u) => [u.id, u.condition, u.consent, u.createdAt]),
    );
  },

  // One row per practice answer, in order. p_bkt and p_dkt were predicted before the answer.
  async attempts() {
    const rows = await prisma.attempt.findMany({
      orderBy: [{ userId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      include: { user: { select: { condition: true } }, question: { select: { topicId: true, difficulty: true } } },
    });
    const seen = new Map<string, number>();
    return toCsv(
      ["attempt_id", "user_id", "condition", "attempt_index", "question_id", "topic_id", "difficulty",
        "correct", "response_time_ms", "p_bkt", "p_dkt", "created_at"],
      rows.map((a) => {
        const index = (seen.get(a.userId) ?? 0) + 1;
        seen.set(a.userId, index);
        return [a.id, a.userId, a.user.condition, index, a.questionId, a.question.topicId, a.question.difficulty,
          a.correct ? 1 : 0, a.responseTimeMs, a.pBkt, a.pDkt, a.createdAt];
      }),
    );
  },

  // One row per test item answered (long format), with the test's total score repeated.
  async tests() {
    const tests = await prisma.test.findMany({
      orderBy: [{ userId: "asc" }, { kind: "asc" }],
      include: { user: { select: { condition: true } } },
    });
    const topicOf = new Map(
      (await prisma.question.findMany({ where: { isTest: true }, select: { id: true, topicId: true } }))
        .map((q) => [q.id, q.topicId]),
    );
    return toCsv(
      ["user_id", "condition", "kind", "score", "n_items", "duration_ms", "submitted_at",
        "question_id", "topic_id", "answer", "correct"],
      tests.flatMap((t) => {
        const items = t.items as TestItems;
        return items.responses.map((r) => [t.userId, t.user.condition, t.kind, t.score, items.responses.length,
          items.durationMs, t.createdAt, r.questionId, topicOf.get(r.questionId), r.answer, r.correct ? 1 : 0]);
      }),
    );
  },

  async sus() {
    const rows = await prisma.susResponse.findMany({
      orderBy: { createdAt: "asc" },
      include: { user: { select: { condition: true } } },
    });
    return toCsv(
      ["user_id", "condition", ...Array.from({ length: 10 }, (_, i) => `q${i + 1}`), "sus_score", "submitted_at"],
      rows.map((s) => [s.userId, s.user.condition, ...s.responses, susScore(s.responses), s.createdAt]),
    );
  },
};

const name = process.argv[2] ?? "";
try {
  const table = tables[name];
  if (!table) {
    console.error(`usage: export.js <${Object.keys(tables).join("|")}>`);
    process.exitCode = 2;
  } else {
    process.stdout.write(await table());
  }
} finally {
  await prisma.$disconnect();
}
