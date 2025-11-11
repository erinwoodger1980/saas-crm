import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      _count: {
        select: { leadFieldDefs: true }
      }
    }
  });
  
  console.log('Tenants and their questionnaire field counts:');
  tenants.forEach(t => {
    console.log(`  ${t.slug} (${t.name}): ${t._count.leadFieldDefs} fields`);
  });
  
  // Show fields for each tenant with fields
  for (const tenant of tenants) {
    if (tenant._count.leadFieldDefs > 0) {
      console.log(`\nQuestionnaire fields for ${tenant.slug}:`);
      const fields = await prisma.leadFieldDef.findMany({
        where: { tenantId: tenant.id },
        orderBy: { sortOrder: 'asc' }
      });
      fields.forEach(f => {
        console.log(`  - ${f.key}: ${f.label} (${f.type}, required: ${f.required})`);
      });
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
