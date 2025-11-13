// api/src/services/ms365.ts
import { prisma } from "../prisma";
import { env } from "../env";

export async function getAccessTokenForTenant(tenantId: string): Promise<string> {
  const row = await prisma.ms365TenantConnection.findUnique({
    where: { tenantId },
    select: { refreshToken: true },
  });
  if (!row?.refreshToken) throw new Error("ms365_not_connected");

  const tenantSegment = process.env.MS365_TENANT || "common";
  const tokenUrl = `https://login.microsoftonline.com/${tenantSegment}/oauth2/v2.0/token`;

  const form = new URLSearchParams({
    client_id: env.MS365_CLIENT_ID,
    client_secret: env.MS365_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: row.refreshToken,
    redirect_uri: env.MS365_REDIRECT_URI,
    scope: (process.env.MS365_SCOPES || "offline_access Mail.ReadWrite User.Read"),
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

  const accessToken = String(j.access_token || "");
  const newRefresh = j.refresh_token as string | undefined;
  if (newRefresh && newRefresh !== row.refreshToken) {
    try {
      await prisma.ms365TenantConnection.update({
        where: { tenantId },
        data: { refreshToken: newRefresh },
      });
    } catch {}
  }
  return accessToken;
}

export async function graphGet(accessToken: string, path: string) {
  const url = path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const j = await r.json();
  if (!r.ok) {
    throw new Error(j?.error?.message || `graph_get_failed: ${r.status}`);
  }
  return j;
}

export async function listSentWithAttachments(accessToken: string, top: number, nextLink?: string) {
  // hasAttachments eq true narrows results; $select trims payload
  const url =
    nextLink ||
    `/me/mailFolders/SentItems/messages?$top=${encodeURIComponent(String(Math.min(50, Math.max(1, top))))}&$select=id,subject,sentDateTime,hasAttachments`;
  return graphGet(accessToken, url);
}

export async function listAttachments(accessToken: string, messageId: string) {
  return graphGet(accessToken, `/me/messages/${encodeURIComponent(messageId)}/attachments?$top=50`);
}

export async function getAttachment(accessToken: string, messageId: string, attachmentId: string) {
  return graphGet(
    accessToken,
    `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
  );
}
