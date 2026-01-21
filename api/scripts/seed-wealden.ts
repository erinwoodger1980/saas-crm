import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { initializeTenantWithSeedData } from '../src/services/seed-template';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const wealden = await prisma.tenant.findFirst({
    where: { name: 'Wealden Joinery' }
  });
  
  if (!wealden) {
    console.log('❌ Wealden Joinery not found');
    process.exit(1);
  }
  
  console.log('✅ Found Wealden Joinery:', wealden.id);
  
  const result = await initializeTenantWithSeedData(wealden.id);
  console.log('✅ Seed result:', JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
