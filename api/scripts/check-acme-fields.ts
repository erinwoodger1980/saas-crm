import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  await prisma.$disconnect();
}

main().catch(console.error);
