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
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
