import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

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
    await pool.end();
  }
}

listUsers();
