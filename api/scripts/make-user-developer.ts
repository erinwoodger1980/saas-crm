#!/usr/bin/env ts-node
/**
 * Make a user a developer by email
 * Usage: pnpm ts-node scripts/make-user-developer.ts <email>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: pnpm ts-node scripts/make-user-developer.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isDeveloper: true, role: true }
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log("Current user:", user);

  if (user.isDeveloper) {
    console.log("✓ User is already a developer");
    process.exit(0);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isDeveloper: true }
  });

  console.log(`✓ Marked ${email} as developer`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
