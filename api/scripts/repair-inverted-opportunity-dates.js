#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { apply: false, wonOnly: false, tenantId: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--won-only') out.wonOnly = true;
    else if (a === '--tenant-id') out.tenantId = args[++i] || null;
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  try {
    const where = { 
      startDate: { not: null },
      deliveryDate: { not: null },
    };
    if (opts.tenantId) where.tenantId = opts.tenantId;
    if (opts.wonOnly) where.stage = 'WON';

    // Fetch candidates and filter in JS for startDate > deliveryDate
    const candidates = await prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        title: true,
        stage: true,
        tenantId: true,
        startDate: true,
        deliveryDate: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const inverted = candidates.filter(o => o.startDate && o.deliveryDate && (new Date(o.startDate) > new Date(o.deliveryDate)));

    console.log(JSON.stringify({
      ok: true,
      tenantId: opts.tenantId || 'ALL',
      wonOnly: opts.wonOnly,
      apply: opts.apply,
      count: inverted.length,
      sample: inverted.slice(0, 20).map(o => ({ id: o.id, title: o.title, stage: o.stage, startDate: o.startDate, deliveryDate: o.deliveryDate })),
    }, null, 2));

    if (!opts.apply || inverted.length === 0) return;

    // Apply swap updates in a transaction
    await prisma.$transaction(async (tx) => {
      for (const o of inverted) {
        await tx.opportunity.update({
          where: { id: o.id },
          data: { startDate: o.deliveryDate, deliveryDate: o.startDate },
        });
      }
    });

    console.log(`Repaired ${inverted.length} opportunities by swapping dates.`);
  } catch (e) {
    console.error('Repair failed:', e?.message || e);
    process.exitCode = 1;
  }
}

main();
