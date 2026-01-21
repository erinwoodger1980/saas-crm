#!/usr/bin/env tsx
/**
 * Diagnostic script to check email ingest configuration and recent activity
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

async function diagnose() {
  console.log("🔍 Email Ingest Diagnostic\n");
  console.log("=" .repeat(60));

  try {
    // 1. Check all tenants with Gmail enabled
    const tenantsWithGmail = await prisma.tenantSettings.findMany({
      where: {
        inbox: { path: ["gmail"], equals: true },
      },
      select: {
        tenantId: true,
        slug: true,
        brandName: true,
        inbox: true,
        inboxLastRun: true,
        inboxWatchEnabled: true,
      },
    });

    console.log(`\n📧 Tenants with Gmail enabled: ${tenantsWithGmail.length}`);
    for (const t of tenantsWithGmail) {
      console.log(`\n  Tenant: ${t.brandName} (${t.slug})`);
      console.log(`  ID: ${t.tenantId}`);
      console.log(`  Inbox watch enabled: ${t.inboxWatchEnabled}`);
      console.log(`  Last run: ${t.inboxLastRun || "never"}`);
      const inbox = (t.inbox as any) || {};
      console.log(`  Settings:`, JSON.stringify(inbox, null, 2));
    }

    // 2. Check Gmail connections
    const gmailConnections = await prisma.gmailTenantConnection.findMany({
      select: {
        tenantId: true,
        gmailAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`\n\n🔐 Gmail Connections: ${gmailConnections.length}`);
    for (const conn of gmailConnections) {
      console.log(`\n  Address: ${conn.gmailAddress}`);
      console.log(`  Tenant ID: ${conn.tenantId}`);
      console.log(`  Connected: ${conn.createdAt}`);
      console.log(`  Updated: ${conn.updatedAt}`);
    }

    // 3. Check recent email ingests
    const recentIngests = await prisma.emailIngest.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        tenantId: true,
        provider: true,
        messageId: true,
        fromEmail: true,
        subject: true,
        processedAt: true,
        leadId: true,
        aiPredictedIsLead: true,
        userLabelIsLead: true,
        createdAt: true,
      },
    });

    console.log(`\n\n📬 Recent Email Ingests (last 20):`);
    if (recentIngests.length === 0) {
      console.log("  ⚠️  No email ingests found!");
    } else {
      for (const ing of recentIngests) {
        console.log(`\n  Message: ${ing.messageId.substring(0, 20)}...`);
        console.log(`  Provider: ${ing.provider}`);
        console.log(`  From: ${ing.fromEmail || "unknown"}`);
        console.log(`  Subject: ${ing.subject || "no subject"}`);
        console.log(`  Processed: ${ing.processedAt ? "yes" : "no"}`);
        console.log(`  AI predicted lead: ${ing.aiPredictedIsLead ?? "n/a"}`);
        console.log(`  User labeled lead: ${ing.userLabelIsLead ?? "n/a"}`);
        console.log(`  Lead ID: ${ing.leadId || "none"}`);
        console.log(`  Created: ${ing.createdAt}`);
      }
    }

    // 4. Check recent leads created
    const recentLeads = await prisma.lead.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        status: true,
        source: true,
        createdAt: true,
      },
    });

    console.log(`\n\n👤 Recent Leads (last 10):`);
    if (recentLeads.length === 0) {
      console.log("  ⚠️  No leads found!");
    } else {
      for (const lead of recentLeads) {
        console.log(`\n  Name: ${lead.name || "unnamed"}`);
        console.log(`  Email: ${lead.email || "no email"}`);
        console.log(`  Status: ${lead.status}`);
        console.log(`  Source: ${lead.source}`);
        console.log(`  Created: ${lead.createdAt}`);
      }
    }

    // 5. Check TrainingInsights for email decisions
    const recentDecisions = await prisma.trainingInsights.findMany({
      where: {
        inputSummary: { startsWith: "email:" },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        tenantId: true,
        decision: true,
        inputSummary: true,
        custom: true,
        createdAt: true,
      },
    });

    console.log(`\n\n🧠 Recent Email Classification Decisions (last 10):`);
    if (recentDecisions.length === 0) {
      console.log("  ℹ️  No classification decisions logged yet");
    } else {
      for (const dec of recentDecisions) {
        console.log(`\n  Input: ${dec.inputSummary}`);
        console.log(`  Decision: ${dec.decision}`);
        const custom = (dec.custom as any) || {};
        console.log(`  Subject: ${custom.subject || "n/a"}`);
        console.log(`  From: ${custom.from || "n/a"}`);
        console.log(`  Reason: ${custom.reason || "n/a"}`);
        console.log(`  Created: ${dec.createdAt}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Diagnostic complete\n");

    // Summary and recommendations
    console.log("📋 Summary:");
    if (tenantsWithGmail.length === 0) {
      console.log("  ❌ No tenants have Gmail enabled in settings");
      console.log("     → Go to Settings > Integrations and enable Gmail");
    }
    if (gmailConnections.length === 0) {
      console.log("  ❌ No Gmail accounts connected");
      console.log("     → Click 'Connect Gmail' in Settings");
    }
    if (recentIngests.length === 0) {
      console.log("  ❌ No emails have been ingested");
      console.log("     → Try clicking 'Run import now' or wait for background watcher");
    }
    const hasRecentIngest = recentIngests.some(
      (ing) => Date.now() - ing.createdAt.getTime() < 5 * 60 * 1000
    );
    if (!hasRecentIngest && recentIngests.length > 0) {
      console.log(
        "  ⚠️  No emails ingested in last 5 minutes - background watcher may not be running"
      );
    }

  } catch (error: any) {
    console.error("\n❌ Error during diagnostic:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

diagnose().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
