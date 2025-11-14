import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check for demo-tenant
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo-tenant' },
    include: {
      leadFieldDefs: {
        orderBy: { sortOrder: 'asc' }
      }
    }
  });

  if (demoTenant) {
    console.log('✅ Found demo-tenant');
    console.log(`Fields: ${demoTenant.leadFieldDefs.length}`);
    demoTenant.leadFieldDefs.forEach(f => {
      console.log(`  - ${f.key}: ${f.label} (${f.type})`);
    });
  } else {
    console.log('❌ demo-tenant not found');
    
    // Check for wealden
    const wealden = await prisma.tenant.findUnique({
      where: { slug: 'wealden' },
      include: {
        leadFieldDefs: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    
    if (wealden) {
      console.log('\n✅ Found wealden tenant');
      console.log(`Fields: ${wealden.leadFieldDefs.length}`);
      wealden.leadFieldDefs.forEach(f => {
        console.log(`  - ${f.key}: ${f.label} (${f.type})`);
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
