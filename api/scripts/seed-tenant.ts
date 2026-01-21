import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const tenantSlug = process.argv[2] || 'wealden';
  
  console.log(`Seeding tenant: ${tenantSlug}`);
  
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug }
  });
  
  if (!tenant) {
    console.error(`Tenant not found: ${tenantSlug}`);
    process.exit(1);
  }
  
  const { initializeTenantWithSeedData } = await import('../src/services/seed-template');
  const result = await initializeTenantWithSeedData(tenant.id);
  
  console.log('Seed result:', result);
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
