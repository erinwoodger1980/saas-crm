// Quick script to check user password hash
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = "postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

async function main() {
  const email = 'erin@erinwoodger.com';
  
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tenantId: true,
      passwordHash: true,
    },
  });

  if (!user) {
    console.log(`❌ User ${email} not found`);
    process.exit(1);
  }

  console.log('✅ User found:');
  console.log('  Email:', user.email);
  console.log('  Name:', user.name);
  console.log('  Role:', user.role);
  console.log('  Tenant ID:', user.tenantId);
  console.log('  Password Hash:', user.passwordHash);
  console.log('\n📝 Note: The password was originally set during account creation.');
  console.log('   If you need to reset it, you can use the password reset flow or update the hash directly.');

  await prisma.$disconnect();
}

main().catch(console.error);
