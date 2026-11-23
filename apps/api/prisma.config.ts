import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Not using Prisma's env() helper: it throws during `prisma generate` in the
  // Docker build, where there is no database.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
