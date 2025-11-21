// api/src/db.ts
import { PrismaClient } from "@prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Avoid creating multiple clients in dev (hot-reload) by caching on global
declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL as string | undefined;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prismaClient =
  global.__PRISMA__ ??
  new PrismaClient({
    adapter,
    log: ["warn", "error"], // add "query" if you want to debug SQL
  });

if (process.env.NODE_ENV !== "production") {
  global.__PRISMA__ = prismaClient;
}

export const prisma = prismaClient;
export default prisma;