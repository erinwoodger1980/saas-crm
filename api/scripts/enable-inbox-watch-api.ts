#!/usr/bin/env tsx
/**
 * Enable inbox watch via API endpoint (for production)
 */

import fetch from "node-fetch";

const API_BASE = process.env.API_BASE || "https://api.joineryai.app";

async function enableViaAPI() {
  console.log("🔧 Enabling inbox watch via API...\n");
  console.log("⚠️  You need to provide a valid bearer token (JWT) for this tenant.");
  console.log("   Get this from your browser's localStorage or network tab when logged in.\n");

  const token = process.argv[2];
  if (!token) {
    console.error("❌ Usage: npx tsx scripts/enable-inbox-watch-api.ts <bearer-token>");
    console.log("\nTo get your token:");
    console.log("1. Log into https://www.joineryai.app");
    console.log("2. Open browser DevTools (F12)");
    console.log("3. Go to Console tab");
    console.log("4. Type: localStorage.getItem('token')");
    console.log("5. Copy the token (without quotes)");
    console.log("\nThen run:");
    console.log("  npx tsx scripts/enable-inbox-watch-api.ts YOUR_TOKEN_HERE");
    process.exit(1);
  }

  try {
    const response = await fetch(`${API_BASE}/tenants/settings`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inboxWatchEnabled: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Failed: ${data.error || response.statusText}`);
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("✅ Success! Inbox watch is now enabled.\n");
    console.log("Settings updated:", JSON.stringify(data, null, 2));
    console.log("\nThe background watcher will now check for emails every 10 minutes.");
    console.log("You can also click 'Run import now' in Settings for immediate import.");

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    throw error;
  }
}

enableViaAPI();
