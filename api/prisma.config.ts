// api/prisma.config.ts
// Ensure DATABASE_URL and other envs are loaded when running Prisma CLI with prisma.config.ts
// This allows `prisma generate` / `prisma migrate` to pick up .env in this package.
import 'dotenv/config';
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
