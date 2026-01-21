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
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'wealden' },
    include: { users: true }
  });
  
  if (!tenant) {
    console.log('❌ Wealden Joinery tenant not found');
    return;
  }
  
  console.log('Found tenant:', tenant.name, tenant.id);
  console.log('Users:', tenant.users.length);
  
  // Delete all users first (due to foreign key constraints)
  if (tenant.users.length > 0) {
    await prisma.user.deleteMany({
      where: { tenantId: tenant.id }
    });
    console.log('✅ Deleted', tenant.users.length, 'users');
  }
  
  // Delete the tenant
  await prisma.tenant.delete({
    where: { id: tenant.id }
  });
  
  console.log('✅ Deleted tenant:', tenant.name);
  console.log('✅ You can now sign up fresh at https://www.joineryai.app/early-access');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
