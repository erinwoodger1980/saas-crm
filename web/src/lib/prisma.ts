import { PrismaClient } from "@prisma/client";

type GlobalWithPrisma = typeof globalThis & { __prisma?: PrismaClient };
const globalForPrisma = globalThis as GlobalWithPrisma;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
