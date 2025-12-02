#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn']
  });
  try {
    const q = process.argv.slice(2).join(' ') || 'susie test';
    const items = await prisma.opportunity.findMany({
      where: {
        title: { contains: q, mode: 'insensitive' }
      },
      select: {
        id: true,
        title: true,
        stage: true,
        startDate: true,
        deliveryDate: true,
        installationStartDate: true,
        installationEndDate: true,
        tenantId: true,
        leadId: true,
        createdAt: true,
        lead: { select: { id: true, status: true, contactName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    console.log(JSON.stringify({ count: items.length, items }, null, 2));
  } catch (e) {
    console.error('Query failed:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
