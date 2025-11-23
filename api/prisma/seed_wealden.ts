import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = 'wealden';
  const name = 'Wealden Joinery';
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (!existing) {
    await prisma.tenant.create({
      data: { slug, name, seatsOffice: 5, seatsWorkshop: 10, seatsDisplay: 2 },
    });
    console.log('Seeded tenant:', slug);
  } else {
    console.log('Tenant already exists:', slug);
  }
  await prisma.$disconnect();
}

main();
