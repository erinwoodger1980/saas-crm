import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
