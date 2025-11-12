import { PrismaClient } from '@prisma/client';
import { initializeTenantWithSeedData } from '../src/services/seed-template';

const prisma = new PrismaClient();

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
  });
