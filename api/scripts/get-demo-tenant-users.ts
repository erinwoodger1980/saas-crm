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
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo-tenant' },
    select: {
      id: true,
      name: true,
      slug: true,
      users: {
        select: {
          email: true,
          name: true,
          role: true,
        }
      }
    }
  });

  if (demoTenant) {
    console.log('\n=== Demo Tenant ===');
    console.log(`Name: ${demoTenant.name}`);
    console.log(`Slug: ${demoTenant.slug}`);
    console.log('\nUsers:');
    demoTenant.users.forEach(u => {
      console.log(`  - ${u.email} (${u.name || 'No name'}) [${u.role}]`);
    });
  } else {
    console.log('❌ Demo tenant not found');
  }
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
