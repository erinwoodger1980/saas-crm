#!/usr/bin/env tsx
/**
 * Enable inbox watch for a tenant
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });
const TENANT_ID = process.argv[2];

if (!TENANT_ID) {
  console.error("❌ Usage: npx tsx scripts/enable-inbox-watch.ts <tenantId>");
  console.log("\nAvailable tenant IDs:");
  console.log("  cmgt9bchl0001uj2h4po89fim  (Your Company)");
  console.log("  cmgt7eozw0000sh2htcmplljf  (Wealden Joinery - recall-first enabled)");
  console.log("  cmh378jwq0000it3zgr3uh7yj  (Wealden Joinery)");
  process.exit(1);
}

async function enableInboxWatch() {
  try {
    console.log(`\n🔧 Enabling inbox watch for tenant: ${TENANT_ID}\n`);

    const updated = await prisma.tenantSettings.update({
      where: { tenantId: TENANT_ID },
      data: { inboxWatchEnabled: true },
      select: {
        tenantId: true,
        brandName: true,
        inboxWatchEnabled: true,
        inbox: true,
      },
    });

    console.log("✅ Success!");
    console.log(`\n  Brand: ${updated.brandName}`);
    console.log(`  Inbox watch: ${updated.inboxWatchEnabled ? "ENABLED ✅" : "disabled"}`);
    console.log(`  Inbox settings:`, JSON.stringify(updated.inbox, null, 2));
    console.log(
      `\n  The background watcher will now check for emails every ${
        ((updated.inbox as any)?.intervalMinutes || 10)
      } minutes.`
    );
    console.log("  You can also click 'Run import now' in Settings for immediate import.\n");
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

enableInboxWatch();
