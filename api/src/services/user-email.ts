// api/src/services/user-email.ts
import { prisma } from "../prisma";
import { env } from "../env";

/**
 * Get Gmail access token for a specific user
 */
export async function getGmailTokenForUser(userId: string): Promise<{ accessToken: string; email: string }> {
  const conn = await prisma.gmailUserConnection.findUnique({
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
  const conn = await prisma.ms365UserConnection.findUnique({
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
export async function getAdminGmailConnections(tenantId: string): Promise<Array<{ userId: string; email: string; accessToken: string; userName: string }>> {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ['admin', 'owner'] },
      gmailUserConnection: { isNot: null },
    },
    include: {
      gmailUserConnection: true,
    },
  });

  const connections = await Promise.all(
    users.map(async (user) => {
      if (!user.gmailUserConnection) return null;
      try {
        const accessToken = await refreshGmailToken(user.gmailUserConnection.refreshToken);
        return {
          userId: user.id,
          userName: user.name || user.email,
          email: user.gmailUserConnection.gmailAddress,
          accessToken,
        };
      } catch (e) {
        console.error(`[user-email] Failed to refresh Gmail token for user ${user.id}:`, e);
        return null;
      }
    })
  );

  return connections.filter((c): c is NonNullable<typeof c> => c !== null);
}

/**
 * Get all admin users with MS365 connections for a tenant
 */
export async function getAdminMs365Connections(tenantId: string): Promise<Array<{ userId: string; email: string; accessToken: string; userName: string }>> {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ['admin', 'owner'] },
      ms365UserConnection: { isNot: null },
    },
    include: {
      ms365UserConnection: true,
    },
  });

  const connections = await Promise.all(
    users.map(async (user) => {
      if (!user.ms365UserConnection) return null;
      try {
        const accessToken = await refreshMs365Token(user.ms365UserConnection.refreshToken);
        return {
          userId: user.id,
          userName: user.name || user.email,
          email: user.ms365UserConnection.ms365Address,
          accessToken,
        };
      } catch (e) {
        console.error(`[user-email] Failed to refresh MS365 token for user ${user.id}:`, e);
        return null;
      }
    })
  );

  return connections.filter((c): c is NonNullable<typeof c> => c !== null);
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
