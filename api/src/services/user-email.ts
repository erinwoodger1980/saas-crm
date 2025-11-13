// api/src/services/user-email.ts
import { prisma } from "../prisma";
import { env } from "../env";

/**
 * Get Gmail access token for a specific user
 */
export async function getGmailTokenForUser(userId: string): Promise<{ accessToken: string; email: string }> {
  const conn = await (prisma as any).gmailUserConnection.findUnique({
    where: { userId },
    select: { refreshToken: true, gmailAddress: true },
  });
  
  if (!conn) throw new Error("gmail_not_connected");
  
  const accessToken = await refreshGmailToken(conn.refreshToken);
  return { accessToken, email: conn.gmailAddress };
}

/**
 * Get MS365 access token for a specific user
 */
export async function getMs365TokenForUser(userId: string): Promise<{ accessToken: string; email: string }> {
  const conn = await (prisma as any).ms365UserConnection.findUnique({
    where: { userId },
    select: { refreshToken: true, ms365Address: true },
  });
  
  if (!conn) throw new Error("ms365_not_connected");
  
  const accessToken = await refreshMs365Token(conn.refreshToken);
  return { accessToken, email: conn.ms365Address };
}

/**
 * Get all admin users with Gmail connections for a tenant
 */
export async function getAdminGmailConnections(tenantId: string): Promise<Array<{ userId: string; connectionId: string; email: string; accessToken: string; userName: string }>> {
  // Fetch admin/owner users for tenant (id, name, email)
  const users = await prisma.user.findMany({
    where: { tenantId, role: { in: ['admin', 'owner'] } },
    select: { id: true, name: true, email: true },
  });
  const userIds = users.map(u => u.id);
  if (userIds.length === 0) return [];

  // Fetch user Gmail connections for those users
  const conns: Array<{ id: string; userId: string; gmailAddress: string; refreshToken: string }> = await (prisma as any).gmailUserConnection.findMany({
    where: { tenantId, userId: { in: userIds } },
    select: { id: true, userId: true, gmailAddress: true, refreshToken: true },
  });

  const userMap = new Map(users.map(u => [u.id, u]));
  const results: Array<{ userId: string; connectionId: string; email: string; accessToken: string; userName: string }> = [];
  for (const c of conns) {
    try {
      const token = await refreshGmailToken(c.refreshToken);
      const u = userMap.get(c.userId)!;
      results.push({
        userId: c.userId,
        connectionId: c.id,
        email: c.gmailAddress,
        accessToken: token,
        userName: u?.name || u?.email || c.gmailAddress,
      });
    } catch (e) {
      console.error(`[user-email] Failed to refresh Gmail token for user ${c.userId}:`, e);
    }
  }
  return results;
}

/**
 * Get all admin users with MS365 connections for a tenant
 */
export async function getAdminMs365Connections(tenantId: string): Promise<Array<{ userId: string; connectionId: string; email: string; accessToken: string; userName: string }>> {
  const users = await prisma.user.findMany({
    where: { tenantId, role: { in: ['admin', 'owner'] } },
    select: { id: true, name: true, email: true },
  });
  const userIds = users.map(u => u.id);
  if (userIds.length === 0) return [];

  const conns: Array<{ id: string; userId: string; ms365Address: string; refreshToken: string }> = await (prisma as any).ms365UserConnection.findMany({
    where: { tenantId, userId: { in: userIds } },
    select: { id: true, userId: true, ms365Address: true, refreshToken: true },
  });

  const userMap = new Map(users.map(u => [u.id, u]));
  const results: Array<{ userId: string; connectionId: string; email: string; accessToken: string; userName: string }> = [];
  for (const c of conns) {
    try {
      const token = await refreshMs365Token(c.refreshToken);
      const u = userMap.get(c.userId)!;
      results.push({
        userId: c.userId,
        connectionId: c.id,
        email: c.ms365Address,
        accessToken: token,
        userName: u?.name || u?.email || c.ms365Address,
      });
    } catch (e) {
      console.error(`[user-email] Failed to refresh MS365 token for user ${c.userId}:`, e);
    }
  }
  return results;
}

/**
 * Refresh Gmail access token
 */
async function refreshGmailToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || res.statusText);
  }

  return json.access_token as string;
}

/**
 * Refresh MS365 access token
 */
async function refreshMs365Token(refreshToken: string): Promise<string> {
  const tenantSegment = process.env.MS365_TENANT || "common";
  const tokenUrl = `https://login.microsoftonline.com/${tenantSegment}/oauth2/v2.0/token`;

  const form = new URLSearchParams({
    client_id: env.MS365_CLIENT_ID,
    client_secret: env.MS365_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    redirect_uri: env.MS365_REDIRECT_URI,
    scope: process.env.MS365_SCOPES || "offline_access Mail.ReadWrite User.Read",
  });

  const rsp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const j = await rsp.json();
  if (!rsp.ok) {
    throw new Error(j?.error_description || j?.error || "ms365_token_refresh_failed");
  }

  return j.access_token as string;
}

/**
 * Send email using Gmail for a specific user
 */
export async function sendViaUserGmail(userId: string, rfc822: string): Promise<void> {
  const { accessToken } = await getGmailTokenForUser(userId);
  
  const raw = Buffer.from(rfc822)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || res.statusText);
  }
}

/**
 * Send email using MS365 for a specific user
 */
export async function sendViaUserMs365(userId: string, message: any): Promise<void> {
  const { accessToken } = await getMs365TokenForUser(userId);

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MS365 send failed: ${error}`);
  }
}
