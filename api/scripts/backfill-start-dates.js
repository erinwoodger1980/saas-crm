#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { tenantId: null, weeks: 4, wonOnly: true, apply: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--tenant-id') out.tenantId = args[++i] || null;
    else if (a === '--weeks') out.weeks = Number(args[++i] || 4);
    else if (a === '--apply') out.apply = true;
    else if (a === '--all-stages') out.wonOnly = false;
  }
  return out;
}

function subtractWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() - weeks * 7);
  return d;
}

async function main() {
  const opts = parseArgs();
  if (!opts.tenantId) {
    console.error('Usage: node backfill-start-dates.js --tenant-id <id> [--weeks 4] [--apply] [--all-stages]');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  try {
    const where = {
      tenantId: opts.tenantId,
      startDate: null,
      deliveryDate: { not: null },
    };
    if (opts.wonOnly) where.stage = 'WON';

    // Limit to likely imported projects: those with a leadId present
    where.leadId = { not: undefined };

    const candidates = await prisma.opportunity.findMany({
      where,
      select: { id: true, title: true, deliveryDate: true, stage: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const preview = candidates.map(o => ({
      id: o.id,
      title: o.title,
      stage: o.stage,
      deliveryDate: o.deliveryDate,
      startDatePreview: subtractWeeks(o.deliveryDate, opts.weeks),
    }));

    console.log(JSON.stringify({ ok: true, tenantId: opts.tenantId, count: candidates.length, weeks: opts.weeks, apply: opts.apply, sample: preview.slice(0, 20) }, null, 2));

    if (!opts.apply || candidates.length === 0) return;

    // Update in small batches to avoid transaction timeouts
    const batchSize = 25;
    let updated = 0;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      await prisma.$transaction(batch.map(o =>
        prisma.opportunity.update({
          where: { id: o.id },
          data: { startDate: subtractWeeks(o.deliveryDate, opts.weeks) },
        })
      ));
      updated += batch.length;
    }

    console.log(`Updated ${updated} opportunities with startDate = deliveryDate - ${opts.weeks} weeks.`);
  } catch (e) {
    console.error('Backfill failed:', e?.message || e);
    process.exitCode = 1;
  }
}

main();
