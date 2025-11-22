// api/src/db.ts
// Re-export prisma client from prisma.ts (which uses adapter)
export { prisma, prisma as default } from "./prisma";