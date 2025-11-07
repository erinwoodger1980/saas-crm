#!/usr/bin/env tsx
/**
 * Search for specific email and force import
 */

import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";

const prisma = new PrismaClient();
const TENANT_ID = "cmgt7eozw0000sh2htcmplljf"; // Wealden Joinery

async function getAccessToken() {
  const conn = await prisma.gmailTenantConnection.findUnique({
    where: { tenantId: TENANT_ID },
    select: { refreshToken: true, gmailAddress: true },
  });

  if (!conn?.refreshToken) {
    throw new Error("No Gmail connection found");
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }

  return { accessToken: data.access_token, gmailAddress: conn.gmailAddress };
}

async function searchGmail(accessToken: string, query: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({
    q: query,
    maxResults: "10",
  }).toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(`Gmail search failed: ${JSON.stringify(data)}`);
  }

  return data.messages || [];
}

async function getMessage(accessToken: string, messageId: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(`Get message failed: ${JSON.stringify(data)}`);
  }

  return data;
}

function getHeader(headers: any[], name: string): string | null {
  const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || null;
}

async function main() {
  try {
    console.log("🔍 Searching Gmail for emails from erin@wealdenjoinery.com\n");

    const { accessToken, gmailAddress } = await getAccessToken();
    console.log(`📧 Connected to: ${gmailAddress}\n`);

    // Search for emails from erin@wealdenjoinery.com
    const queries = [
      "from:erin@wealdenjoinery.com newer_than:7d",
      "from:erin@wealdenjoinery.com newer_than:30d",
      "from:erin@wealdenjoinery.com",
    ];

    let messages: any[] = [];
    for (const q of queries) {
      console.log(`Trying query: "${q}"`);
      messages = await searchGmail(accessToken, q);
      if (messages.length > 0) {
        console.log(`✅ Found ${messages.length} message(s)\n`);
        break;
      } else {
        console.log(`  No results`);
      }
    }

    if (messages.length === 0) {
      console.log("\n❌ No emails found from erin@wealdenjoinery.com");
      console.log("\nPossible reasons:");
      console.log("  1. Email hasn't arrived in Gmail yet");
      console.log("  2. Email is in spam/trash");
      console.log("  3. Email address is slightly different");
      console.log("\nCheck your Gmail inbox/sent items manually.");
      await prisma.$disconnect();
      return;
    }

    console.log("📬 Email details:\n");

    for (const msg of messages) {
      const fullMsg = await getMessage(accessToken, msg.id);
      const headers = fullMsg.payload?.headers || [];
      
      const subject = getHeader(headers, "Subject");
      const from = getHeader(headers, "From");
      const date = getHeader(headers, "Date");
      
      console.log(`Message ID: ${msg.id}`);
      console.log(`Subject: ${subject}`);
      console.log(`From: ${from}`);
      console.log(`Date: ${date}`);

      // Check if already in database
      const existing = await prisma.emailIngest.findUnique({
        where: {
          tenantId_provider_messageId: {
            tenantId: TENANT_ID,
            provider: "gmail",
            messageId: msg.id,
          },
        },
      });

      if (existing) {
        console.log(`✅ Already in database (Lead ID: ${existing.leadId || "none"})`);
      } else {
        console.log(`⚠️  NOT in database yet`);
      }
      console.log("---\n");
    }

    console.log("\n💡 To import this email:");
    console.log("  Go to Settings > Integrations");
    console.log("  Click 'Run import now' next to Gmail");
    console.log("\n  Or wait up to 10 minutes for automatic import (now enabled).");

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
