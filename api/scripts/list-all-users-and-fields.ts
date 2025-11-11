import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      tenant: {
        include: {
          _count: {
            select: { leadFieldDefs: true }
          }
        }
      }
    }
  });

  console.log('All users:');
  users.forEach(u => {
    console.log(`  ${u.email} (${u.role}) - Tenant: ${u.tenant.slug} (${u.tenant._count.leadFieldDefs} fields)`);
  });

  // Find tenant with most fields
  const tenantsWithFields = await prisma.tenant.findMany({
    include: {
      leadFieldDefs: {
        orderBy: { sortOrder: 'asc' }
      }
    }
  });

  const tenantWithMostFields = tenantsWithFields.reduce((max, t) => 
    t.leadFieldDefs.length > (max?.leadFieldDefs.length || 0) ? t : max
  , tenantsWithFields[0]);

  if (tenantWithMostFields && tenantWithMostFields.leadFieldDefs.length > 0) {
    console.log(`\nTenant with most fields: ${tenantWithMostFields.slug} (${tenantWithMostFields.leadFieldDefs.length} fields)`);
    console.log('Fields:');
    tenantWithMostFields.leadFieldDefs.forEach(f => {
      console.log(`  - ${f.key}: ${f.label} (${f.type}, required: ${f.required})`);
    });
  } else {
    console.log('\nNo tenants have questionnaire fields yet!');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
