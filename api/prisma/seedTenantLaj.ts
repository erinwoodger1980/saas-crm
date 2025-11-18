import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting LAJ Joinery tenant seed script...');
  
  // Upsert LAJ Joinery tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'laj-joinery' },
    update: {},
    create: {
      name: 'LAJ Joinery',
      slug: 'laj-joinery',
    },
  });

  console.log(`✅ LAJ Joinery tenant ready`);
  console.log(`   Tenant ID: ${tenant.id}`);
  console.log(`   Name: ${tenant.name}`);
  console.log(`   Slug: ${tenant.slug}`);
  
  return tenant;
}

main()
  .then(() => {
    console.log('✅ Seed script completed successfully!');
  })
  .catch((e) => {
    console.error('❌ Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
