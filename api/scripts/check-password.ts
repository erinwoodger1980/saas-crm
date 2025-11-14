import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function checkPassword(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        signupCompleted: true
      }
    });
    
    if (!user) {
      console.log(`❌ User ${email} not found`);
      return;
    }
    
    console.log(`\n👤 User: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Signup Completed: ${user.signupCompleted}`);
    console.log(`   Has Password: ${user.passwordHash ? 'YES' : 'NO (needs to complete signup)'}`);
    
    if (!user.passwordHash) {
      console.log('\n⚠️  This user has not completed signup yet.');
      console.log('   They need to use a signup/invite token to set their password.');
    }
  } catch (error: any) {
    console.error("❌ Failed to check password:");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2] || "erin@erinwoodger.com";
checkPassword(email);
