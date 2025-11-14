import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  .finally(() => prisma.$disconnect());
