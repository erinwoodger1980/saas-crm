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
  // Find acme.test user
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'acme.test', mode: 'insensitive' } },
    include: {
      tenant: {
        include: {
          leadFieldDefs: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      }
    }
  });

  if (!user) {
    console.log('No acme.test user found');
    return;
  }

  console.log(`Found user: ${user.email}`);
  console.log(`Tenant: ${user.tenant.slug} (${user.tenant.name})`);
  console.log(`Questionnaire fields: ${user.tenant.leadFieldDefs.length}\n`);

  if (user.tenant.leadFieldDefs.length > 0) {
    console.log('Fields:');
    user.tenant.leadFieldDefs.forEach(f => {
      console.log(`  - ${f.key}: ${f.label} (${f.type}, required: ${f.required}, sortOrder: ${f.sortOrder})`);
    });
  }

  // disconnected in finally
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
