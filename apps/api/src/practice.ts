import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "./db.js";
import type { Condition } from "./generated/prisma/enums.js";
import { bktTopics, bktUpdate, dktPredict, ModelUnavailableError, priorFor } from "./model.js";
import { nextFixedQuestion } from "./policy/fixed.js";
import { DEFAULT_MIN_ANSWERS, MASTERY_THRESHOLD, nextPersonalisedQuestion } from "./policy/personalised.js";
import { BLOCK_SIZE, nextInBlock } from "./study/pure.js";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type Db = typeof prisma | Tx;

// Practice questions per participant, the same in both conditions, so the comparison is about
// which questions are chosen, not how many. The post-test opens after the last one.
// Fixed order gives PRACTICE_LENGTH / (number of topics) per topic, rounded up; use a multiple
// of the number of topics (10) so every topic gets the same share.
export const practiceLength = Number(process.env.PRACTICE_LENGTH ?? 30);
if (!Number.isInteger(practiceLength) || practiceLength < 1) {
  throw new Error("PRACTICE_LENGTH must be a positive integer");
}

// Answers needed on a topic before the personalised path may skip it as mastered.
const minAnswers = Number(process.env.PERSONALISED_MIN_ANSWERS ?? DEFAULT_MIN_ANSWERS);
if (!Number.isInteger(minAnswers) || minAnswers < 0) {
  throw new Error("PERSONALISED_MIN_ANSWERS must be a non-negative integer");
}

// random (the pilot): balanced blocks of 4. fixed / personalised force a condition (development).
const newUserCondition = process.env.NEW_USER_CONDITION ?? "random";
if (!["random", "fixed", "personalised"].includes(newUserCondition)) {
  throw new Error("NEW_USER_CONDITION must be 'random', 'fixed' or 'personalised'");
}

// Any fixed number: it only names the lock that serialises sign-ups.
const SIGNUP_LOCK = 81_726_354;

/** Condition for the next new participant. Call inside the sign-up lock. */
async function assignCondition(tx: Tx): Promise<Condition> {
  if (newUserCondition !== "random") return newUserCondition as Condition;
  const n = await tx.user.count();
  const inBlock = await tx.user.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    skip: n - (n % BLOCK_SIZE),
    select: { condition: true },
  });
  return nextInBlock(inBlock.map((u) => u.condition), randomInt);
}

/** True once the pre-test is submitted; practice is only open after it. */
export async function preTestDone(db: Db, userId: string) {
  return (await db.test.count({ where: { userId, kind: "pre" } })) > 0;
}

// Letters, digits and hyphens, e.g. P017. Stored upper-case so "p017" logs in too.
const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;

const userParams = {
  type: "object",
  required: ["userId"],
  properties: { userId: { type: "string", format: "uuid" } },
} as const;

/** p_known for every topic: the stored value, or the topic's BKT prior if never answered. */
async function masteryMap(db: Db, userId: string, topicIds: string[]) {
  const [rows, params] = await Promise.all([db.mastery.findMany({ where: { userId } }), bktTopics()]);
  const stored = new Map(rows.map((r) => [r.topicId, r.pKnown]));
  return new Map(topicIds.map((id) => [id, stored.get(id) ?? priorFor(params, id)]));
}

/** The current practice question for a user under their condition, plus progress. */
export async function currentQuestion(db: Db, userId: string, condition: Condition) {
  const [topics, questions, attempts] = await Promise.all([
    db.topic.findMany(),
    db.question.findMany({ where: { isTest: false }, include: { topic: true } }),
    db.attempt.findMany({ where: { userId }, select: { questionId: true } }),
  ]);
  const attempted = new Set(attempts.map((a) => a.questionId));
  const progress = { answered: attempts.length, total: practiceLength };
  if (attempts.length >= practiceLength) return { question: null, progress }; // practice finished

  if (condition === "personalised") {
    const mastery = await masteryMap(db, userId, topics.map((t) => t.id));
    return { question: nextPersonalisedQuestion(topics, questions, attempted, mastery, { minAnswers }), progress };
  }

  const perTopic = Math.ceil(practiceLength / Math.max(topics.length, 1));
  return { question: nextFixedQuestion(topics, questions, attempted, perTopic), progress };
}

export function registerPracticeRoutes(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ModelUnavailableError) {
      req.log.error(err);
      return reply.code(503).send({ error: "model_unavailable" });
    }
    return reply.send(err);
  });

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

      // The lock serialises sign-ups, so two at once can't take the same slot in a block.
      const user = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SIGNUP_LOCK})`;
        const again = await tx.user.findUnique({ where: { code } });
        if (again) return again;
        return tx.user.create({ data: { code, condition: await assignCondition(tx), consent: true } });
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
      if (!(await preTestDone(prisma, user.id))) return reply.code(409).send({ error: "pre_test_required" });

      const { question, progress } = await currentQuestion(prisma, user.id, user.condition);
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

  app.get<{ Params: { userId: string } }>(
    "/users/:userId/mastery",
    { schema: { params: userParams } },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
      if (!user) return reply.code(404).send({ error: "user_not_found" });

      const topics = await prisma.topic.findMany({ orderBy: { curriculumOrder: "asc" } });
      const mastery = await masteryMap(prisma, user.id, topics.map((t) => t.id));
      return topics.map((t) => {
        const pKnown = mastery.get(t.id)!;
        return { topicId: t.id, name: t.name, pKnown, mastered: pKnown >= MASTERY_THRESHOLD };
      });
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
        const locked = await tx.$queryRaw<{ condition: Condition }[]>`
          SELECT condition FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        if (locked.length === 0) return reply.code(404).send({ error: "user_not_found" });
        if (!(await preTestDone(tx, userId))) return reply.code(409).send({ error: "pre_test_required" });

        // Only the question the policy is currently showing may be answered.
        const { question } = await currentQuestion(tx, userId, locked[0].condition);
        if (!question || question.id !== questionId) {
          return reply.code(409).send({ error: "not_current_question" });
        }

        const options = question.options as Record<string, string>;
        if (!(answer in options)) return reply.code(400).send({ error: "invalid_answer" });
        const correct = answer === question.answer;

        // BKT and DKT run for both conditions, so every attempt has p_bkt and p_dkt for the AUC
        // evaluation. Both are predicted from earlier answers only and stored with the attempt,
        // inside this transaction, before the result goes back to the student. If the model
        // service is down this throws, the transaction rolls back and the student retries.
        const key = { userId_topicId: { userId, topicId: question.topicId } };
        const [current, history] = await Promise.all([
          tx.mastery.findUnique({ where: key }),
          // DKT reads the whole history. This attempt isn't stored yet, so it isn't included.
          tx.attempt.findMany({
            where: { userId },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { correct: true, question: { select: { topicId: true } } },
          }),
        ]);
        const [bkt, pDkt] = await Promise.all([
          bktUpdate(question.topicId, current?.pKnown ?? null, correct),
          // Prediction only: DKT doesn't choose questions. null if no DKT export is loaded.
          dktPredict(history.map((h) => ({ topicId: h.question.topicId, correct: h.correct })), question.topicId),
        ]);

        const attempt = await tx.attempt.create({
          data: { userId, questionId, correct, responseTimeMs, pBkt: bkt.p_correct, pDkt },
        });
        await tx.mastery.upsert({
          where: key,
          create: { userId, topicId: question.topicId, pKnown: bkt.p_known },
          update: { pKnown: bkt.p_known },
        });

        return reply.code(201).send({ attemptId: attempt.id, correct });
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
