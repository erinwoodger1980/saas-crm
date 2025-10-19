// api/src/db.ts
import { PrismaClient } from "@prisma/client";

// Avoid creating multiple clients in dev (hot-reload) by caching on global
declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

const prismaClient =
  global.__PRISMA__ ??
  new PrismaClient({
    log: ["warn", "error"], // add "query" if you want to debug SQL
  });

if (process.env.NODE_ENV !== "production") {
  global.__PRISMA__ = prismaClient;
}

export const prisma = prismaClient;
export default prisma;