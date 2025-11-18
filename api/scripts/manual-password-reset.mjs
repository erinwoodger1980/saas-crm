#!/usr/bin/env node
// Manual password reset script - bypasses email requirement
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL },
  },
});

const EMAIL = process.argv[2];
const NEW_PASSWORD = process.argv[3];

if (!EMAIL || !NEW_PASSWORD) {
  console.error('Usage: node manual-password-reset.mjs <email> <new-password>');
  console.error('Example: node manual-password-reset.mjs erin@erinwoodger.com MyNewPassword123!');
  process.exit(1);
}

async function main() {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: EMAIL.toLowerCase().trim() },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      console.error(`❌ User not found: ${EMAIL}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.email})`);

    // Hash new password
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log(`✅ Password updated successfully!`);
    console.log(`\nYou can now login with:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Password: ${NEW_PASSWORD}`);

    // Clean up any existing reset tokens
    try {
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });
      console.log(`✅ Cleared old reset tokens`);
    } catch (e) {
      // Token might not exist, that's fine
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
