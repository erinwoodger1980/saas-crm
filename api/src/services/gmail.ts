// api/src/services/gmail.ts
import { prisma } from "../prisma";
import { env } from "../env";

export async function getAccessTokenForTenant(tenantId: string) {
  const conn = await prisma.gmailTenantConnection.findUnique({ where: { tenantId } });
  if (!conn) throw new Error("gmail not connected");
  return refreshAccessToken(conn.refreshToken);
}

async function refreshAccessToken(refreshToken: string) {
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
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json.access_token as string;
}

export async function gmailSend(accessToken: string, rawRfc822: string) {
  const raw = Buffer.from(rawRfc822)
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
  if (!res.ok) throw new Error(json?.error?.message || res.statusText);
  return json; // { id, threadId, ... }
}
// Fetch a Gmail attachment as Buffer + filename + mimeType
export async function gmailFetchAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  // 1) attachment data (base64url)
  const rsp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const json = await rsp.json();
  if (!rsp.ok) throw new Error(json?.error?.message || "attachment fetch failed");
  const buffer = Buffer.from(String(json.data).replace(/-/g, "+").replace(/_/g, "/"), "base64");

  // 2) discover filename + mimeType from message parts
  const msgRsp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const msg = await msgRsp.json();
  if (!msgRsp.ok) throw new Error(msg?.error?.message || "message fetch failed");

  let filename = "attachment";
  let mimeType = "application/octet-stream";
  const walk = (p: any) => {
    if (!p) return;
    if (p.body?.attachmentId === attachmentId) {
      if (p.filename) filename = p.filename;
      if (p.mimeType) mimeType = p.mimeType;
    }
    if (p.parts) p.parts.forEach(walk);
  };
  walk(msg.payload);

  return { buffer, filename, mimeType };
}
// ------------------------------------------------------------
// Fetch full Gmail message (metadata, minimal, or full)
// ------------------------------------------------------------
export async function fetchMessage(
  accessToken: string,
  messageId: string,
  format: "minimal" | "full" | "metadata" = "full"
): Promise<any> {
  const rsp = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!rsp.ok) {
    const err = await rsp.text();
    throw new Error(`Gmail fetchMessage failed (${rsp.status}): ${err}`);
  }

  return rsp.json();
}