import type { FastifyInstance } from "fastify";
import { prisma } from "./db.js";
import { nextFixedQuestion } from "./policy/fixed.js";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;

const perTopic = Number(process.env.FIXED_QUESTIONS_PER_TOPIC ?? 5);
if (!Number.isInteger(perTopic) || perTopic < 1) {
  throw new Error("FIXED_QUESTIONS_PER_TOPIC must be a positive integer");
}

// Letters, digits and hyphens, e.g. P017. Stored upper-case so "p017" logs in too.
const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;

const userParams = {
  type: "object",
  required: ["userId"],
  properties: { userId: { type: "string", format: "uuid" } },
} as const;

/** The current question for a user, plus progress. Week 4: everyone gets fixed order. */
async function currentQuestion(db: Db, userId: string) {
  const [topics, questions, attempts] = await Promise.all([
    db.topic.findMany(),
    db.question.findMany({ include: { topic: true } }),
    db.attempt.findMany({ where: { userId }, select: { questionId: true } }),
  ]);
  const attempted = new Set(attempts.map((a) => a.questionId));

  // Total length of the fixed sequence, for the progress indicator.
  const total = topics.reduce(
    (sum, t) => sum + Math.min(perTopic, questions.filter((q) => q.topicId === t.id).length),
    0,
  );

  const question = nextFixedQuestion(topics, questions, attempted, perTopic);
  return { question, progress: { answered: attempts.length, total } };
}

export function registerPracticeRoutes(app: FastifyInstance) {
  app.post<{ Body: { code: string; consent?: boolean } }>(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["code"],
          properties: { code: { type: "string" }, consent: { type: "boolean" } },
        },
      },
    },
    async (req, reply) => {
      const code = req.body.code.trim().toUpperCase();
      if (!CODE_PATTERN.test(code)) {
        return reply.code(400).send({ error: "invalid_code" });
      }

      const existing = await prisma.user.findUnique({ where: { code } });
      if (existing) return { userId: existing.id, created: false };

      // New participants must consent before any data is stored about them.
      if (req.body.consent !== true) {
        return reply.code(400).send({ error: "consent_required" });
      }

      // upsert, not create, so two first logins with the same code can't both fail.
      const user = await prisma.user.upsert({
        where: { code },
        update: {},
        // Week 8 replaces this with random assignment between 'personalised' and 'fixed'.
        create: { code, condition: "fixed", consent: true },
      });
      return { userId: user.id, created: true };
    },
  );

  app.get<{ Params: { userId: string } }>(
    "/users/:userId/next-question",
    { schema: { params: userParams } },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
      if (!user) return reply.code(404).send({ error: "user_not_found" });

      const { question, progress } = await currentQuestion(prisma, user.id);
      if (!question) return { done: true, progress };

      // Never include `answer` here: this goes to the student's browser.
      const { id, stem, options, topic } = question;
      return {
        done: false,
        progress,
        question: { id, stem, options, topic: { id: topic.id, name: topic.name } },
      };
    },
  );

  app.post<{
    Params: { userId: string };
    Body: { questionId: string; answer: string; responseTimeMs: number };
  }>(
    "/users/:userId/attempts",
    {
      schema: {
        params: userParams,
        body: {
          type: "object",
          required: ["questionId", "answer", "responseTimeMs"],
          properties: {
            questionId: { type: "string" },
            answer: { type: "string" },
            responseTimeMs: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId } = req.params;
      const { questionId, answer, responseTimeMs } = req.body;

      return prisma.$transaction(async (tx) => {
        // Lock the user's row so a double-click or a resubmitted form can't record two
        // attempts for the same question.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        if (locked.length === 0) return reply.code(404).send({ error: "user_not_found" });

        // Only the question the policy is currently showing may be answered.
        const { question } = await currentQuestion(tx, userId);
        if (!question || question.id !== questionId) {
          return reply.code(409).send({ error: "not_current_question" });
        }

        const options = question.options as Record<string, string>;
        if (!(answer in options)) return reply.code(400).send({ error: "invalid_answer" });

        // Week 5+: fetch p_bkt / p_dkt from the model service and store them here,
        // before the result goes back to the student.
        const attempt = await tx.attempt.create({
          data: { userId, questionId, correct: answer === question.answer, responseTimeMs },
        });
        return reply.code(201).send({ attemptId: attempt.id, correct: attempt.correct });
      });
    },
  );

  // Feedback for an answered question. The correct answer is only revealed here,
  // after the attempt has been stored.
  app.get<{ Params: { userId: string; attemptId: number } }>(
    "/users/:userId/attempts/:attemptId",
    {
      schema: {
        params: {
          type: "object",
          required: ["userId", "attemptId"],
          properties: {
            userId: { type: "string", format: "uuid" },
            attemptId: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const attempt = await prisma.attempt.findFirst({
        where: { id: req.params.attemptId, userId: req.params.userId },
        include: { question: { include: { topic: true } } },
      });
      if (!attempt) return reply.code(404).send({ error: "attempt_not_found" });

      const { question } = attempt;
      const options = question.options as Record<string, string>;
      return {
        attemptId: attempt.id,
        correct: attempt.correct,
        question: {
          id: question.id,
          stem: question.stem,
          topic: { id: question.topic.id, name: question.topic.name },
          answer: question.answer,
          answerText: options[question.answer],
        },
      };
    },
  );
}
