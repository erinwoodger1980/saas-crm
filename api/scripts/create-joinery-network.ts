import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

const DEFAULT_NAME = 'The Joinery Network';
const DEFAULT_SLUG = process.env.TJN_NETWORK_SLUG || 'the-joinery-network';

async function main() {
  const name = process.argv[2] || DEFAULT_NAME;
  const slug = process.argv[3] || DEFAULT_SLUG;

  const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
  const tenant = existingTenant
    ? await prisma.tenant.update({ where: { id: existingTenant.id }, data: { name } })
    : await prisma.tenant.create({ data: { name, slug } });

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      slug,
      brandName: name,
    },
    update: {
      slug,
      brandName: name,
    },
  });

  const existingNetwork = await prisma.network.findUnique({ where: { slug } });
  if (existingNetwork && existingNetwork.tenantId !== tenant.id) {
    throw new Error(`Network slug ${slug} already exists for a different tenant (${existingNetwork.tenantId}).`);
  }

  const network = existingNetwork
    ? await prisma.network.update({ where: { id: existingNetwork.id }, data: { tenantId: tenant.id, name } })
    : await prisma.network.create({ data: { tenantId: tenant.id, name, slug } });

  console.log('Joinery Network tenant ready:', {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    networkId: network.id,
    networkSlug: network.slug,
  });
}

main()
  .catch((err) => {
    console.error('Failed to create Joinery Network tenant:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
