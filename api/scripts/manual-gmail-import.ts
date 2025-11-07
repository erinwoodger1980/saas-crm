#!/usr/bin/env tsx
/**
 * Manual Gmail import script - bypasses background watcher
 * Use this to manually trigger an email import for a specific tenant
 */

import fetch from "node-fetch";

const API_BASE = process.env.API_BASE || "http://localhost:4000";
const TENANT_ID = process.argv[2];

if (!TENANT_ID) {
  console.error("❌ Usage: npx tsx scripts/manual-gmail-import.ts <tenantId>");
  console.log("\n Available tenant IDs:");
  console.log("  cmgt9bchl0001uj2h4po89fim  (Your Company)");
  console.log("  cmgt7eozw0000sh2htcmplljf  (Wealden Joinery - recall-first enabled)");
  console.log("  cmh378jwq0000it3zgr3uh7yj  (Wealden Joinery)");
  process.exit(1);
}

async function manualImport() {
  console.log(`🔄 Triggering manual Gmail import for tenant: ${TENANT_ID}\n`);

  // Sign a system token (simplified - in production this would use proper JWT)
  const token = Buffer.from(JSON.stringify({ tenantId: TENANT_ID, userId: "system" })).toString("base64");

  try {
    // Try broader search query to catch more emails
    const queries = [
      "newer_than:1d",  // Last 24 hours
      "newer_than:3d",  // Last 3 days
      "is:inbox newer_than:3d",  // Inbox only, last 3 days
    ];

    for (const q of queries) {
      console.log(`\n📬 Searching with query: "${q}"`);
      
      const response = await fetch(`${API_BASE}/gmail/import`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          max: 50,  // Increased from default 25
          q,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`  ❌ Failed: ${data.error || response.statusText}`);
        if (data.detail) console.error(`     ${JSON.stringify(data.detail)}`);
        continue;
      }

      console.log(`  ✅ Success! Processed ${data.results?.length || 0} emails`);
      
      if (data.results && data.results.length > 0) {
        console.log(`\n  📊 Results:`);
        for (const r of data.results) {
          console.log(`\n    Subject: ${r.subject || "no subject"}`);
          console.log(`    From: ${r.from || "unknown"}`);
          console.log(`    Classification: ${r.classification?.isLead ? "✅ LEAD" : "❌ Not a lead"}`);
          console.log(`    Reason: ${r.classification?.reason || "n/a"}`);
          console.log(`    Lead created: ${r.createdLead ? "Yes" : "No"}`);
          if (r.leadId) console.log(`    Lead ID: ${r.leadId}`);
        }
      } else {
        console.log(`  ℹ️  No new emails found`);
      }
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  }
}

manualImport().catch((error) => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
