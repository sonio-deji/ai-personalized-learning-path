import { buildApp } from "./app.js";

const app = buildApp();

// Node is PID 1 in the container and ignores these signals unless they are handled.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 4000) });
