import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  // Find Wealden Joinery tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'wealden' }
  });
  
  if (!tenant) {
    console.error('❌ Wealden Joinery tenant not found');
    process.exit(1);
  }
  
  console.log('✅ Found tenant:', tenant.name, tenant.id);
  
  // Check if user already exists
  const existing = await prisma.user.findFirst({
    where: { email: { equals: 'martin@wealdenjoinery.com', mode: 'insensitive' } }
  });
  
  if (existing) {
    console.log('⚠️  User already exists:', existing.email);
    process.exit(0);
  }
  
  // Create Martin as owner with 30-day trial
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);
  
  // Update tenant with trial
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      trialEndsAt,
      subscriptionStatus: 'trialing'
    }
  });
  
  // Create user - use a temporary password that Martin will set later
  const passwordHash = await bcrypt.hash('TempPassword123!', 10);
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'martin@wealdenjoinery.com',
      name: 'Martin',
      passwordHash,
      role: 'owner',
      isEarlyAdopter: true,
    }
  });
  
  console.log('✅ Created user:', user.email, user.id);
  console.log('✅ Trial ends:', trialEndsAt.toISOString());
  console.log('✅ Temporary password: TempPassword123!');
  console.log('⚠️  Martin should change this password after first login at https://www.joineryai.app/login');
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
