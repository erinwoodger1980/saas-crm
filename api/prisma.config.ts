// api/prisma.config.ts
// Ensure DATABASE_URL and other envs are loaded when running Prisma CLI with prisma.config.ts
// This allows `prisma generate` / `prisma migrate` to pick up .env in this package.
import 'dotenv/config';
import { defineConfig } from "prisma/config";

// Use a non-strict fallback so CI builds (type generation) succeed even if DATABASE_URL is absent.
// Prisma Client requires a URL at generate-time; providing a local placeholder prevents hard failure.
const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl,
  },
});
