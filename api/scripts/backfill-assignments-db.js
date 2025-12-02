#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { tenantId: null, wonOnly: true, apply: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--tenant-id') out.tenantId = args[++i] || null;
    else if (a === '--all-stages') out.wonOnly = false;
    else if (a === '--dry-run') out.apply = false;
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  if (!opts.tenantId) {
    console.error('Usage: node backfill-assignments-db.js --tenant-id <id> [--all-stages] [--dry-run]');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ['error'] });

  try {
    const whereOpp = { tenantId: opts.tenantId };
    if (opts.wonOnly) whereOpp.stage = 'WON';

    // Candidate opportunities
    const opps = await prisma.opportunity.findMany({
      where: whereOpp,
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    if (!opps.length) {
      console.log(JSON.stringify({ ok: true, updated: 0, projectsUpdated: 0 }, null, 2));
      return;
    }

    const oppIds = opps.map(o => o.id);

    // Existing assignments
    const existing = await prisma.projectProcessAssignment.findMany({
      where: { tenantId: opts.tenantId, opportunityId: { in: oppIds } },
      select: { opportunityId: true },
    });
    const withAssignments = new Set(existing.map(e => e.opportunityId));
    const targets = oppIds.filter(id => !withAssignments.has(id));

    if (!targets.length) {
      console.log(JSON.stringify({ ok: true, updated: 0, projectsUpdated: 0 }, null, 2));
      return;
    }

    // Tenant process definitions
    const defs = await prisma.workshopProcessDefinition.findMany({
      where: { tenantId: opts.tenantId },
      orderBy: { sortOrder: 'asc' },
    });
    const requiredDefs = defs.filter(d => d.requiredByDefault !== false);

    const preview = targets.slice(0, 10);
    console.log(JSON.stringify({ ok: true, projectsToUpdate: targets.length, defs: requiredDefs.length, preview }, null, 2));

    if (!opts.apply || !requiredDefs.length) return;

    let created = 0;
    for (const pid of targets) {
      for (const d of requiredDefs) {
        try {
          await prisma.projectProcessAssignment.upsert({
            where: {
              opportunityId_processDefinitionId: {
                opportunityId: pid,
                processDefinitionId: d.id,
              },
            },
            create: {
              tenantId: opts.tenantId,
              opportunityId: pid,
              processDefinitionId: d.id,
              status: 'pending',
              estimatedHours: d.estimatedHours ?? null,
              required: d.requiredByDefault !== false,
            },
            update: {},
          });
          created += 1;
        } catch (e) {
          // ignore unique violations
          if (!(e && e.code === 'P2002')) {
            console.error('upsert failed for', pid, d.id, e?.message || e);
          }
        }
      }
    }

    console.log(`Created/ensured ${created} assignments across ${targets.length} projects.`);
  } catch (e) {
    console.error('Backfill assignments failed:', e?.message || e);
    process.exitCode = 1;
  }
}

main();
