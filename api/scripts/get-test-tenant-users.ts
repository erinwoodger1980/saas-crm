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
  // Find all tenants
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('\n=== Recent Tenants ===');
  for (const tenant of tenants) {
    console.log(`\nTenant: ${tenant.name} (${tenant.slug})`);
    console.log(`ID: ${tenant.id}`);
    console.log(`Created: ${tenant.createdAt}`);

    // Get users for this tenant
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (users.length > 0) {
      console.log('Users:');
      users.forEach(u => {
        console.log(`  - ${u.email} (${u.name}) [${u.role}]`);
      });
    } else {
      console.log('No users found');
    }
  }
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
