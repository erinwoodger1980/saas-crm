import { PrismaClient } from '@prisma/client';

const prodDatabaseUrl = 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDatabaseUrl
    }
  }
});

async function main() {
  console.log('Connecting to production database...\n');

  // Get all tenants with questionnaire field counts
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

  console.log('Production Tenants and their questionnaire field counts:');
  tenants.forEach(t => {
    console.log(`  ${t.slug} (${t.name}): ${t._count.leadFieldDefs} fields`);
  });

  // Show fields for each tenant with fields
  for (const tenant of tenants) {
    if (tenant._count.leadFieldDefs > 0) {
      console.log(`\n=== Questionnaire fields for ${tenant.slug} (${tenant.name}) ===`);
      const fields = await prisma.leadFieldDef.findMany({
        where: { tenantId: tenant.id },
        orderBy: { sortOrder: 'asc' }
      });
      fields.forEach(f => {
        console.log(`  [${f.sortOrder}] ${f.key}: ${f.label} (${f.type}, required: ${f.required})`);
      });
    }
  }

  // Also check for users
  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      role: true,
      tenant: {
        select: {
          slug: true,
          name: true
        }
      }
    },
    take: 10
  });

  console.log('\n=== Sample Users ===');
  users.forEach(u => {
    console.log(`  ${u.email} (${u.role}) - Tenant: ${u.tenant.slug}`);
  });

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
