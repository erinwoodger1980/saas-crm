import { PrismaClient } from "@prisma/client";

// Allow custom database URL via environment variable
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function enableDeveloper(email: string) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { isDeveloper: true },
      select: {
        id: true,
        email: true,
        name: true,
        isDeveloper: true,
        role: true
      }
    });
    
    console.log("✅ Developer access enabled!");
    console.log(JSON.stringify(user, null, 2));
  } catch (error: any) {
    console.error("❌ Failed to enable developer access:");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2] || "erin@erinwoodger.com";
enableDeveloper(email);
