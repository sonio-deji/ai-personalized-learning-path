import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

export const prisma = new PrismaClient({
  // Without a timeout, /health hangs when Postgres is unreachable.
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 3000 }),
});
