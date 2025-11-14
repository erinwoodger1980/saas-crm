import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'wealden-joinery' },
    include: {
      leadFieldDefs: {
        orderBy: { sortOrder: 'asc' }
      }
    }
  });

  if (!tenant) {
    console.log('❌ Tenant not found');
    return;
  }

  console.log(`\n=== ${tenant.name} ===`);
  console.log(`Tenant ID: ${tenant.id}`);
  console.log(`Field count: ${tenant.leadFieldDefs.length}`);
  
  if (tenant.leadFieldDefs.length > 0) {
    console.log('\nFields:');
    tenant.leadFieldDefs.forEach((f, i) => {
      console.log(`${i + 1}. ${f.key}: ${f.label} (${f.type}) - Required: ${f.required}`);
    });
  } else {
    console.log('\n❌ No fields found!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
