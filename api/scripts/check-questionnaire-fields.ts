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
  
  // disconnected in finally
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
