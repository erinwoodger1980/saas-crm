import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  .finally(() => prisma.$disconnect());
