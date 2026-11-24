import { prisma } from "../src/db.js";
import { questions, testQuestions, topics } from "./seed-data.js";

// Runs on every API start, so it must be repeatable. It updates seeded rows in place
// and never deletes, so attempts are safe.
try {
  await prisma.$transaction(async (tx) => {
    // Move seeded topics out of the way first, as curriculum_order is unique
    // and the list may have been reordered.
    await tx.topic.updateMany({
      where: { id: { in: topics.map((t) => t.id) } },
      data: { curriculumOrder: { increment: 1000 } },
    });

    for (const [index, { id, name }] of topics.entries()) {
      const data = { name, curriculumOrder: index + 1 };
      await tx.topic.upsert({ where: { id }, create: { id, ...data }, update: data });
    }

    // isTest is written explicitly, so moving a question between the lists takes effect.
    const all = [
      ...questions.map((q) => ({ ...q, isTest: false })),
      ...testQuestions.map((q) => ({ ...q, isTest: true })),
    ];
    for (const { id, ...data } of all) {
      await tx.question.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
  }, { timeout: 30_000 });

  console.log(`Seeded ${topics.length} topics, ${questions.length} practice and ${testQuestions.length} test questions`);
} finally {
  await prisma.$disconnect();
}
