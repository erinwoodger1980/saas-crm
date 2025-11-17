import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const DATABASE_URL = "postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function main() {
  const email = process.argv[2] || "erin@erinwoodger.com";
  const password = process.argv[3] || "DevPassword123!";
  
  console.log(`🔑 Resetting password for: ${email}`);
  
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.log(`❌ User ${email} not found`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  
  await prisma.user.update({
    where: { email },
    data: {
      passwordHash,
      signupCompleted: true
    }
  });

  console.log(`✅ Password reset successfully!`);
  console.log(`   Email: ${email}`);
  console.log(`   New Password: ${password}`);
  console.log(`\n🚀 You can now log in with these credentials.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
