import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function setPassword(email: string, newPassword: string) {
  try {
    console.log(`Setting new password for ${email}...`);
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    const user = await prisma.user.update({
      where: { email },
      data: { 
        passwordHash,
        signupCompleted: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        signupCompleted: true
      }
    });
    
    console.log("\n✅ Password updated successfully!");
    console.log(`   User: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   New Password: ${newPassword}`);
  } catch (error: any) {
    console.error("❌ Failed to set password:");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: npx tsx scripts/set-password.ts <email> <password>");
  process.exit(1);
}

setPassword(email, password);
