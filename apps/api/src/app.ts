import Fastify from "fastify";
import { prisma } from "./db.js";
import { registerPracticeRoutes } from "./practice.js";

const modelUrl = process.env.MODEL_URL ?? "http://127.0.0.1:8000";

async function databaseOk() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function modelOk() {
  try {
    const res = await fetch(`${modelUrl}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function buildApp() {
  const app = Fastify({ logger: true });

  // Used by the container health check, so it covers only what the API can't run without.
  app.get("/health", async (_req, reply) => {
    const database = await databaseOk();
    return reply.code(database ? 200 : 503).send({ status: database ? "ok" : "error" });
  });

  app.get("/status", async () => {
    const [database, model] = await Promise.all([databaseOk(), modelOk()]);
    return { database, model };
  });

  app.get("/topics", async () => {
    const topics = await prisma.topic.findMany({
      orderBy: { curriculumOrder: "asc" },
      include: { _count: { select: { questions: true } } },
    });
    return topics.map(({ _count, ...topic }) => ({ ...topic, questionCount: _count.questions }));
  });

  registerPracticeRoutes(app);

  app.addHook("onClose", () => prisma.$disconnect());
  return app;
}
