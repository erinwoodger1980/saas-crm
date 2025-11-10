import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = 'wealden';
  const name = 'Wealden Joinery';
  const logoUrl = '';
  const primary = '#0E7490';
  const secondary = '#0EA5E9';
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (!existing) {
    await prisma.tenant.create({
      data: { slug, name, logoUrl, primary, secondary },
    });
    console.log('Seeded tenant:', slug);
  } else {
    console.log('Tenant already exists:', slug);
  }
  await prisma.$disconnect();
}

main();
