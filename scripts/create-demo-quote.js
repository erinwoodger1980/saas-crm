#!/usr/bin/env node
// create-demo-quote.js
// Usage: node create-demo-quote.js

const { PrismaClient } = require('../api/node_modules/@prisma/client');
const { PrismaPg } = require('../api/node_modules/@prisma/adapter-pg');
const { Pool } = require('../api/node_modules/pg');

// Prisma 7 requires an adapter for database connections
const connectionString = process.env.DATABASE_URL || 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenantId = process.env.DEMO_TENANT_ID || 'demo-tenant-id';
  const quoteId = 'demo-quote-id';

  // Create tenant if not exists
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'Demo Tenant',
      slug: 'demo',
    },
  });

  // Create quote if not exists
  await prisma.quote.upsert({
    where: { id: quoteId },
    update: {},
    create: {
      id: quoteId,
      tenantId,
      title: 'Demo Quote',
      status: 'DRAFT',
      currency: 'GBP',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('Demo quote created with ID:', quoteId);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
