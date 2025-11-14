import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function migrateFeedbackStatus() {
  try {
    console.log("Migrating RESOLVED feedback to OPEN (will update to COMPLETED after schema push)...");
    
    // Use raw SQL to update the status before enum change
    const result = await prisma.$executeRaw`
      UPDATE "Feedback" 
      SET status = 'OPEN'::"FeedbackStatus" 
      WHERE status = 'RESOLVED'::"FeedbackStatus"
    `;
    
    console.log(`✅ Updated ${result} feedback records from RESOLVED to OPEN`);
  } catch (error: any) {
    console.error("❌ Failed to migrate feedback:");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

migrateFeedbackStatus();
