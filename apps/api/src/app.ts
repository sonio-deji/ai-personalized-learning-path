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

/** The model service's /health body, or null if it is unreachable. */
async function modelHealth(): Promise<{ bkt?: string; dkt?: string | null } | null> {
  try {
    const res = await fetch(`${modelUrl}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok ? ((await res.json()) as { bkt?: string; dkt?: string | null }) : null;
  } catch {
    return null;
  }
}

export function buildApp() {
  const app = Fastify({ logger: true });

  // Used by the container health check, so it covers only what the API can't run without.
  app.get("/health", async (_req, reply) => {
    const database = await databaseOk();
    return reply.code(database ? 200 : 503).send({ status: database ? "ok" : "error" });
  });

  // For people, not health checks. bkt/dkt say which trained models are loaded:
  // check before each pilot session that dkt is not null, or p_dkt isn't being recorded.
  app.get("/status", async () => {
    const [database, health] = await Promise.all([databaseOk(), modelHealth()]);
    return { database, model: health !== null, bkt: health?.bkt ?? null, dkt: health?.dkt ?? null };
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
