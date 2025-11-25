import prisma from '../src/prisma';

prisma.tenant.findFirst({ 
  where: { 
    OR: [
      { name: { contains: 'LAJ', mode: 'insensitive' } },
      { name: { contains: 'Joinery', mode: 'insensitive' } }
    ]
  },
  select: { id: true, name: true } 
})
  .then(tenant => {
    if (tenant) {
      console.log(`\nTenant ID: ${tenant.id}`);
      console.log(`Name: ${tenant.name}\n`);
    } else {
      console.log('\nNo LAJ Joinery tenant found. Available tenants:');
      return prisma.tenant.findMany({ select: { id: true, name: true }, take: 5 })
        .then(tenants => tenants.forEach(t => console.log(`  ${t.id} - ${t.name}`)));
    }
  })
  .finally(() => prisma.$disconnect());
