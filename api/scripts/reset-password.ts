import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hash } from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2] || 'owner@example.com';
  const newPassword = process.argv[3] || 'Password123!';

  console.log(`Resetting password for: ${email}`);

  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const hashedPassword = await hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashedPassword },
  });

  console.log(`✅ Password reset successfully!`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${newPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
