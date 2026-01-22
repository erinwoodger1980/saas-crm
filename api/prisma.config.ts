// api/prisma.config.ts
// Ensure DATABASE_URL and other envs are loaded when running Prisma CLI with prisma.config.ts
// This allows `prisma generate` / `prisma migrate` to pick up .env in this package.
import 'dotenv/config';
import { defineConfig } from "prisma/config";

// Use a non-strict fallback so CI builds (client generation) succeed even if DATABASE_URL is absent.
// IMPORTANT: This must never point at a real staging/live database.
const dbUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
