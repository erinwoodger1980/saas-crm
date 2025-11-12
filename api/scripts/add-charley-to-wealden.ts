import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const wealden = await prisma.tenant.findFirst({
    where: { slug: 'wealden-joinery' }
  });
  
  if (!wealden) {
    console.log('❌ Wealden Joinery not found');
    process.exit(1);
  }
  
  console.log('✅ Found Wealden Joinery:', wealden.id);
  
  // Create Charley with a temporary password
  const passwordHash = await bcrypt.hash('TempPassword123!', 10);
  const user = await prisma.user.create({
    data: {
      tenantId: wealden.id,
      email: 'charley@wealdenjoinery.com',
      name: 'Charley',
      passwordHash,
      role: 'admin',
      isEarlyAdopter: true,
    }
  });
  
  console.log('✅ Created user:', user.email);
  console.log('✅ Role:', user.role);
  console.log('✅ Temporary password: TempPassword123!');
  console.log('⚠️  Charley should login at https://www.joineryai.app/login');
  console.log('⚠️  He should change his password after first login');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
