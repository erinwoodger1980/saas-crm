// api/src/services/inboxFiling.ts
import { prisma } from "../prisma";
import { getAccessTokenForTenant as getGmailToken } from "./gmail";
import { getAccessTokenForTenant as getMsToken, graphGet } from "./ms365";

export type Provider = "gmail" | "ms365";

export function shouldMoveToEnquiries(decision: string, score: number | null | undefined, threshold = 0.65) {
  return String(decision).toLowerCase() === "accepted" && (Number(score ?? 0) >= threshold);
}

async function readInboxSettings(tenantId: string): Promise<{ autoFileAcceptedLeads: boolean; enquiriesName: string; cache: any; }>
{
  const ts = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { inbox: true } });
  const inbox = (ts?.inbox as any) || {};
  const autoFileAcceptedLeads = inbox.autoFileAcceptedLeads !== false; // default true
  const enquiriesName = String(inbox.enquiriesName || inbox.enquiriesLabel || "Enquiries");
  const cache = inbox.cache || {};
  return { autoFileAcceptedLeads, enquiriesName, cache };
}

async function writeInboxCache(tenantId: string, cache: any) {
  const ts = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { inbox: true } });
  const prev = (ts?.inbox as any) || {};
  await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: { inbox: { ...prev, cache } as any },
    create: { tenantId, slug: `tenant-${tenantId.slice(0,6)}`, brandName: "Your Company", inbox: { ...prev, cache } as any },
  });
}

async function delay(ms: number) { return new Promise(res => setTimeout(res, ms)); }

/* ---------------- Gmail implementation ---------------- */
async function ensureGmailEnquiriesLabel(accessToken: string, name: string): Promise<string> {
  const listRsp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const list = await listRsp.json();
  if (!listRsp.ok) throw new Error(list?.error?.message || "gmail labels failed");
  const existing = (list.labels || []).find((l: any) => l.name === name);
  if (existing) return existing.id;

  const createRsp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  const created = await createRsp.json();
  if (!createRsp.ok) throw new Error(created?.error?.message || "gmail create label failed");
  return created.id;
}

async function gmailModifyLabels(accessToken: string, messageId: string, addLabelId: string): Promise<void> {
  // Remove INBOX and add label; tolerate already-applied
  const rsp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["INBOX"], addLabelIds: [addLabelId] }),
  });
  if (!rsp.ok) {
    const txt = await rsp.text();
    // Let 400/409 pass for idempotency
    if (rsp.status >= 500) throw new Error(`gmail modify failed (${rsp.status}): ${txt}`);
  }
}

/* ---------------- Microsoft 365 implementation ---------------- */
export function decodeJwt(token: string): any {
  try { const [,p] = token.split("."); return JSON.parse(Buffer.from(p, "base64").toString("utf8")); } catch { return null; }
}

export function assertGraphMailScope(token: string): { ok: boolean; needReconsent?: boolean; message?: string } {
  const payload = decodeJwt(token) || {};
  const scp: string = (payload.scp || payload.roles || "").toString();
  const hasReadWrite = /Mail\.ReadWrite/i.test(scp);
  if (!hasReadWrite) {
    return { ok: false, needReconsent: true, message: "Missing Mail.ReadWrite scope; re-consent required." };
  }
  return { ok: true };
}

async function ensureGraphEnquiriesFolder(accessToken: string, name: string): Promise<string> {
  // Look up folder by displayName
  const list = await graphGet(accessToken, `/me/mailFolders?$filter=displayName eq '${name.replace(/'/g, "''")}'&$select=id,displayName`);
  const existing = Array.isArray(list.value) ? list.value[0] : null;
  if (existing?.id) return existing.id;
  // Create
  const url = "https://graph.microsoft.com/v1.0/me/mailFolders";
  const rsp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name }) });
  const j = await rsp.json();
  if (!rsp.ok) throw new Error(j?.error?.message || `graph create folder failed (${rsp.status})`);
  return j.id as string;
}

async function graphMoveMessage(accessToken: string, messageId: string, destinationId: string) {
  const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/move`;
  const body = JSON.stringify({ destinationId });
  for (let attempt = 0; attempt < 3; attempt++) {
    const rsp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body });
    if (rsp.ok) return;
    if (rsp.status === 429) {
      const retryAfter = Number(rsp.headers.get("retry-after") || 1);
      await delay(Math.min(5000, (retryAfter || 1) * 1000 * (attempt + 1)));
      continue;
    }
    const text = await rsp.text();
    // Idempotency: if message already in the destination folder, Graph may return conflict or similar; swallow 4xx except 401/403
    if (rsp.status === 401 || rsp.status === 403) throw new Error(`graph move unauthorized (${rsp.status}): ${text}`);
    if (rsp.status >= 500) throw new Error(`graph move failed (${rsp.status}): ${text}`);
    break;
  }
}

export async function postClassifySideEffects(opts: {
  tenantId: string;
  provider: Provider;
  messageId: string;
  decision: string; // "accepted" | "rejected" | ...
  score?: number | null;
}): Promise<{ skipped: boolean; reason?: string }> {
  const { tenantId, provider, messageId, decision, score } = opts;
  const { autoFileAcceptedLeads, enquiriesName, cache } = await readInboxSettings(tenantId);
  if (!autoFileAcceptedLeads) return { skipped: true, reason: "feature_disabled" };
  if (!shouldMoveToEnquiries(decision, score, 0.65)) return { skipped: true, reason: "below_threshold" };

  try {
    if (provider === "gmail") {
      const token = await getGmailToken(tenantId);
      let labelId = cache?.gmail?.enquiriesLabelId as string | undefined;
      if (!labelId) {
        labelId = await ensureGmailEnquiriesLabel(token, enquiriesName);
        await writeInboxCache(tenantId, { ...cache, gmail: { ...(cache?.gmail || {}), enquiriesLabelId: labelId } });
      }
      await gmailModifyLabels(token, messageId, labelId);
      await prisma.activityLog.create({ data: { tenantId, entity: "PROJECT" as any, entityId: messageId, verb: "CREATED" as any, data: { provider, action: "gmail.label", labelId, name: enquiriesName } } });
      return { skipped: false };
    } else {
      const token = await getMsToken(tenantId);
      const scopeOk = assertGraphMailScope(token);
      if (!scopeOk.ok) {
        await prisma.activityLog.create({ data: { tenantId, entity: "PROJECT" as any, entityId: messageId, verb: "REOPENED" as any, data: { provider, error: scopeOk.message, hint: "Reconnect Microsoft 365 with Mail.ReadWrite and offline_access" } } });
        return { skipped: true, reason: "ms_scope_missing" };
      }
      let folderId = cache?.ms365?.enquiriesFolderId as string | undefined;
      if (!folderId) {
        folderId = await ensureGraphEnquiriesFolder(token, enquiriesName);
        await writeInboxCache(tenantId, { ...cache, ms365: { ...(cache?.ms365 || {}), enquiriesFolderId: folderId } });
      }
      await graphMoveMessage(token, messageId, folderId);
      await prisma.activityLog.create({ data: { tenantId, entity: "PROJECT" as any, entityId: messageId, verb: "CREATED" as any, data: { provider, action: "ms365.move", folderId, name: enquiriesName } } });
      return { skipped: false };
    }
  } catch (e: any) {
    const msg = e?.message || String(e);
    await prisma.activityLog.create({ data: { tenantId, entity: "PROJECT" as any, entityId: messageId, verb: "REOPENED" as any, data: { provider, error: msg, during: "postClassifySideEffects" } } });
    return { skipped: true, reason: msg };
  }
}
