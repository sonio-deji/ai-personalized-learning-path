// Study flow (week 8): pre-test -> practice -> post-test -> SUS survey -> finished.
// The pre- and post-test are the same 20 items (questions.is_test), never shown in practice,
// with no feedback. The post-test opens when the participant's practice set is finished.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import type { TestKind } from "../generated/prisma/enums.js";
import { currentQuestion, type Db, preTestDone } from "../practice.js";
import { type Stage, stageOf, SUS_ITEMS, susScore } from "./pure.js";

async function stageFor(db: Db, userId: string): Promise<Stage | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { tests: { select: { kind: true } }, susResponses: { select: { id: true } } },
  });
  if (!user) return null;
  const preDone = await preTestDone(db, userId);
  const practiceDone = preDone && (await currentQuestion(db, userId, user.condition)).question === null;
  return stageOf({
    preDone,
    practiceDone,
    postDone: user.tests.some((t) => t.kind === "post"),
    susDone: user.susResponses.length > 0,
  });
}

const STAGE_FOR_TEST: Record<TestKind, Stage> = { pre: "pre_test", post: "post_test" };

const userParams = {
  type: "object",
  required: ["userId"],
  properties: { userId: { type: "string", format: "uuid" } },
} as const;

const testParams = {
  type: "object",
  required: ["userId", "kind"],
  properties: { userId: { type: "string", format: "uuid" }, kind: { type: "string", enum: ["pre", "post"] } },
} as const;

/** Lock the participant's row for the rest of the transaction, so a double submit can't race. */
async function lockUser(tx: Db, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

export function registerStudyRoutes(app: FastifyInstance) {
  app.get<{ Params: { userId: string } }>(
    "/users/:userId/stage",
    { schema: { params: userParams } },
    async (req, reply) => {
      const stage = await stageFor(prisma, req.params.userId);
      if (!stage) return reply.code(404).send({ error: "user_not_found" });
      return { stage };
    },
  );

  // The test items, without answers, in a fixed order (curriculum order, then id).
  app.get<{ Params: { userId: string; kind: TestKind } }>(
    "/users/:userId/tests/:kind",
    { schema: { params: testParams } },
    async (req, reply) => {
      const { userId, kind } = req.params;
      const stage = await stageFor(prisma, userId);
      if (!stage) return reply.code(404).send({ error: "user_not_found" });
      if (stage !== STAGE_FOR_TEST[kind]) return reply.code(409).send({ error: "wrong_stage", stage });

      const items = await prisma.question.findMany({
        where: { isTest: true },
        orderBy: [{ topic: { curriculumOrder: "asc" } }, { id: "asc" }],
        select: { id: true, stem: true, options: true },
      });
      return { kind, items };
    },
  );

  app.post<{
    Params: { userId: string; kind: TestKind };
    Body: { answers: Record<string, string>; durationMs: number };
  }>(
    "/users/:userId/tests/:kind",
    {
      schema: {
        params: testParams,
        body: {
          type: "object",
          required: ["answers", "durationMs"],
          properties: {
            answers: { type: "object", additionalProperties: { type: "string" } },
            durationMs: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId, kind } = req.params;
      const { answers, durationMs } = req.body;

      // Respond only after the transaction commits: replying inside it would let the client's
      // next request run before the data is visible.
      const result = await prisma.$transaction(async (tx) => {
        if (!(await lockUser(tx, userId))) return { status: 404, body: { error: "user_not_found" } };
        const stage = await stageFor(tx, userId);
        if (stage !== STAGE_FOR_TEST[kind]) return { status: 409, body: { error: "wrong_stage", stage } };

        const items = await tx.question.findMany({
          where: { isTest: true },
          orderBy: [{ topic: { curriculumOrder: "asc" } }, { id: "asc" }],
          select: { id: true, answer: true },
        });
        // Every item is recorded; an unanswered one counts as wrong.
        const responses = items.map((q) => {
          const answer = answers[q.id] ?? null;
          return { questionId: q.id, answer, correct: answer === q.answer };
        });
        const score = responses.filter((r) => r.correct).length;
        await tx.test.create({ data: { userId, kind, score, items: { durationMs, responses } } });
        // No score is returned: students get no feedback on the tests.
        return { status: 201, body: { submitted: true } };
      });
      return reply.code(result.status).send(result.body);
    },
  );

  app.get("/sus/items", async () => ({ items: SUS_ITEMS }));

  app.post<{ Params: { userId: string }; Body: { responses: number[] } }>(
    "/users/:userId/sus",
    {
      schema: {
        params: userParams,
        body: {
          type: "object",
          required: ["responses"],
          properties: {
            responses: { type: "array", minItems: 10, maxItems: 10, items: { type: "integer", minimum: 1, maximum: 5 } },
          },
        },
      },
    },
    async (req, reply) => {
      const { userId } = req.params;
      susScore(req.body.responses); // validates; the score itself is computed at export
      // Respond only after the transaction commits: replying inside it would let the client's
      // next request run before the data is visible.
      const result = await prisma.$transaction(async (tx) => {
        if (!(await lockUser(tx, userId))) return { status: 404, body: { error: "user_not_found" } };
        const stage = await stageFor(tx, userId);
        if (stage !== "survey") return { status: 409, body: { error: "wrong_stage", stage } };
        await tx.susResponse.create({ data: { userId, responses: req.body.responses } });
        return { status: 201, body: { submitted: true } };
      });
      return reply.code(result.status).send(result.body);
    },
  );
}
