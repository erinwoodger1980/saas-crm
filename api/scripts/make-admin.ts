#!/usr/bin/env ts-node

/**
 * Script to grant admin role to a user by email
 * Usage: pnpm tsx scripts/make-admin.ts <email>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function makeAdmin() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Usage: pnpm tsx scripts/make-admin.ts <email>");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log("Current user:", user);

    const updated = await prisma.user.update({
      where: { email },
      data: { role: "admin" },
      select: { id: true, email: true, name: true, role: true }
    });

    console.log("✅ User updated to admin:", updated);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
