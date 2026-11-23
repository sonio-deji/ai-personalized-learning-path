import { prisma } from "../src/db.js";
import { questions, topics } from "./seed-data.js";

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

    for (const { id, ...data } of questions) {
      await tx.question.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
  }, { timeout: 30_000 });

  console.log(`Seeded ${topics.length} topics and ${questions.length} questions`);
} finally {
  await prisma.$disconnect();
}
