import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isDeveloper: true
      }
    });
    
    console.log(`\n📋 Found ${users.length} users:\n`);
    users.forEach(user => {
      console.log(`  ${user.isDeveloper ? '🔧' : '  '} ${user.email}`);
      console.log(`     Name: ${user.name || 'N/A'}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Developer: ${user.isDeveloper ? 'YES' : 'NO'}`);
      console.log('');
    });
  } catch (error: any) {
    console.error("❌ Failed to list users:");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
