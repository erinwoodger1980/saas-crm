// api/src/routes/gmail.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";
import OpenAI from "openai";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
    email: req.auth?.email as string | undefined,
  };
}

/* ---------------------------- Helpers ---------------------------- */
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
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${json.error || res.statusText}`);
  }
  return json.access_token as string;
}

function decodeMimeStr(input: string) {
  try {
    const b = Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    return b.toString("utf8");
  } catch {
    return input;
  }
}

function pickHeader(headers: Array<{ name: string; value: string }>, name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

async function fetchMessage(accessToken: string, id: string, format: "full" | "raw" | "metadata" | "minimal" = "full") {
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=${format}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "gmail message fetch failed");
  return j;
}

type GmailAttachment = { filename: string; size?: number; attachmentId: string };

function extractBodyAndAttachments(msg: any): { bodyText: string; bodyHtml?: string; attachments: GmailAttachment[] } {
  let bodyText = "";
  let bodyHtml: string | undefined;
  const attachments: GmailAttachment[] = [];

  const walk = (p: any) => {
    if (!p) return;
    if (p.filename && p.body?.attachmentId) {
      attachments.push({ filename: p.filename, size: p.body?.size, attachmentId: p.body.attachmentId });
    }
    if (p.mimeType === "text/plain" && p.body?.data) {
      bodyText += decodeMimeStr(p.body.data) + "\n";
    }
    if (p.mimeType === "text/html" && p.body?.data && !bodyHtml) {
      bodyHtml = decodeMimeStr(p.body.data);
    }
    if (p.parts) p.parts.forEach(walk);
  };
  walk(msg.payload);
  if (!bodyText && msg.payload?.body?.data) bodyText = decodeMimeStr(msg.payload.body.data);
  return { bodyText: bodyText.trim(), bodyHtml, attachments };
}

async function getMessagePlainText(accessToken: string, id: string) {
  const msg = await fetchMessage(accessToken, id, "full");

  const headers = msg.payload?.headers || [];
  const subject = pickHeader(headers, "Subject");
  const from = pickHeader(headers, "From");

  const { bodyText } = extractBodyAndAttachments(msg);

  return { id, subject, from, snippet: msg.snippet || "", body: bodyText };
}

function basicHeuristics(body: string) {
  const email = (body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])[0] || null;
  const phone = (body.match(/\+?\d[\d\s().-]{7,}\d/g) || [])[0] || null;
  const nameMatch =
    body.match(/\b(?:thanks|regards|cheers)[,\s\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i) ||
    body.match(/(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\n*$/m);
  const contactName = nameMatch ? nameMatch[1] : null;
  return { email, phone, contactName };
}

async function extractLeadWithOpenAI(subject: string, body: string) {
  if (!env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const prompt = `You're a CRM intake assistant. Decide if this email is a sales enquiry/lead for a joinery/carpentry business. 
Extract fields in JSON. If not a lead, return {"isLead": false}.

Fields:
- isLead: boolean
- contactName: string|null
- email: string|null
- phone: string|null
- projectType: string|null (short description, e.g. "fitted wardrobes")
- nextAction: string|null (short verb phrase, e.g. "call back")
- summary: string (1–2 sentence summary)

Email subject: ${subject}
Email body:
${body}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const text = resp.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ---------------- Current connection ---------------- */
router.get("/connection", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    const conn = await prisma.gmailTenantConnection.findUnique({
      where: { tenantId },
      select: { id: true, gmailAddress: true, createdAt: true, updatedAt: true },
    });
    return res.json({ ok: true, connection: conn });
  } catch (e: any) {
    console.error("[gmail] /connection failed:", e);
    return res.status(500).json({ error: e?.message ?? "internal error" });
  }
});

/* ---------------- OAuth start ---------------- */
router.get("/connect", (req, res) => {
  const qJwt = (req.query.jwt as string | undefined) || undefined;
  if (qJwt && !req.auth) {
    try {
      const decoded = jwt.verify(qJwt, env.APP_JWT_SECRET) as any;
      (req as any).auth = { userId: decoded.userId, tenantId: decoded.tenantId, email: decoded.email };
    } catch {
      return res.status(401).send("invalid jwt");
    }
  }

  const { tenantId, userId } = getAuth(req);
  if (!tenantId) return res.status(401).send("unauthorized");

  const clientId = env.GMAIL_CLIENT_ID;
  const redirectUri = env.GMAIL_REDIRECT_URI || "http://localhost:4000/gmail/oauth/callback";
  if (!clientId) return res.status(500).send("GMAIL_CLIENT_ID missing.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"].join(" "),
    state: JSON.stringify({ tenantId, userId }),
  });

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

/* ---------------- OAuth callback ---------------- */
router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error) return res.status(400).send(`OAuth error: ${error}`);
  if (!code) return res.status(400).send("Missing ?code");

  let parsed: { tenantId?: string; userId?: string } = {};
  try {
    parsed = state ? JSON.parse(state) : {};
  } catch {}
  if (!parsed.tenantId) return res.status(400).send("Missing tenantId in state");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      redirect_uri: env.GMAIL_REDIRECT_URI || "http://localhost:4000/gmail/oauth/callback",
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("[gmail] token exchange failed:", tokens);
    return res.status(500).json(tokens);
  }

  const { id_token, refresh_token } = tokens as { id_token?: string; refresh_token?: string };
  let gmailAddress: string | null = null;
  if (id_token) {
    const payloadB64 = String(id_token).split(".")[1];
    if (payloadB64) {
      const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
      gmailAddress = payload?.email || null;
    }
  }
  if (!refresh_token) {
    return res.status(400).send("No refresh_token. Revoke old access in Google Account and reconnect.");
  }

  await prisma.gmailTenantConnection.upsert({
    where: { tenantId: parsed.tenantId! },
    update: { refreshToken: refresh_token, gmailAddress, connectedById: parsed.userId ?? null },
    create: { tenantId: parsed.tenantId!, connectedById: parsed.userId ?? null, gmailAddress, refreshToken: refresh_token },
  });

  return res.send(`<h2>✅ Gmail Connected!</h2><p>Account: ${gmailAddress || "unknown"}</p>`);
});

/* ---------------- FULL MESSAGE + ATTACHMENTS ---------------- */

/** GET /gmail/message/:id  -> subject, from, date, bodyText/bodyHtml, attachments[] */
router.get("/message/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    const conn = await prisma.gmailTenantConnection.findUnique({ where: { tenantId } });
    if (!conn) return res.status(400).json({ error: "gmail not connected" });
    const accessToken = await refreshAccessToken(conn.refreshToken);
    const msg = await fetchMessage(accessToken, req.params.id, "full");

    const headers = msg.payload?.headers || [];
    const subject = pickHeader(headers, "Subject");
    const from = pickHeader(headers, "From");
    const date = pickHeader(headers, "Date");

    const { bodyText, bodyHtml, attachments } = extractBodyAndAttachments(msg);

    return res.json({
      id: msg.id,
      subject,
      from,
      date,
      snippet: msg.snippet || "",
      bodyText,
      bodyHtml,
      attachments, // [{filename, size, attachmentId}]
    });
  } catch (e: any) {
    console.error("[gmail] message fetch failed:", e);
    return res.status(500).json({ error: e?.message || "message fetch failed" });
  }
});

/** GET /gmail/message/:id/attachments/:attachmentId/download -> binary */
router.get("/message/:id/attachments/:attachmentId/download", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).send("unauthorized");

  try {
    const conn = await prisma.gmailTenantConnection.findUnique({ where: { tenantId } });
    if (!conn) return res.status(400).send("gmail not connected");
    const accessToken = await refreshAccessToken(conn.refreshToken);

    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${req.params.id}/attachments/${req.params.attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const j = await r.json();
    if (!r.ok) return res.status(500).send(j?.error?.message || "attachment fetch failed");

    const dataB64 = j.data as string; // web-safe base64
    const buf = Buffer.from(dataB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.attachmentId}"`);
    return res.send(buf);
  } catch (e: any) {
    console.error("[gmail] attachment download failed:", e);
    return res.status(500).send(e?.message || "attachment download failed");
  }
});

/* ---------------- Import (idempotent) ---------------- */
/**
 * POST /gmail/import  { max?: number, q?: string }
 *
 * Idempotency strategy:
 *  - Before processing each message, we try to create an EmailIngest row (unique key tenantId+provider+messageId).
 *  - If it already exists, we skip (no duplicate leads).
 */
router.post("/import", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const max = Math.max(1, Math.min(Number(req.body?.max || 5), 20)); // 1..20
  const q = (req.body?.q as string | undefined) || "newer_than:30d";

  try {
    const conn = await prisma.gmailTenantConnection.findUnique({ where: { tenantId } });
    if (!conn) return res.status(400).json({ error: "gmail not connected" });

    const accessToken = await refreshAccessToken(conn.refreshToken);

    // List messages
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({
        q,
        maxResults: String(max),
      }).toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listJson = await listRes.json();
    if (!listRes.ok) throw new Error(listJson?.error?.message || "gmail list failed");

    const messages: Array<{ id: string }> = listJson.messages || [];
    const results: any[] = [];

    for (const m of messages) {
      // ---- IDENTITY CLAIM: create placeholder EmailIngest; if exists, skip
      try {
        await prisma.emailIngest.create({
          data: {
            tenantId,
            provider: "gmail",
            messageId: m.id,
            createdAt: new Date(),
          },
        });
      } catch (err: any) {
        // Unique violation means we already processed (or are processing) this message
        results.push({ id: m.id, skipped: true, reason: "already indexed" });
        continue;
      }

      // Fetch content
      const full = await getMessagePlainText(accessToken, m.id);
      const ai = await extractLeadWithOpenAI(full.subject || "", full.body || "");
      const heur = basicHeuristics(full.body || "");

      const isLead =
        ai?.isLead ??
        !!(heur.email || heur.contactName || /quote|estimate|enquiry|inquiry/i.test(full.subject || ""));

      if (!isLead) {
        await prisma.emailIngest.update({
          where: { tenantId_provider_messageId: { tenantId, provider: "gmail", messageId: m.id } },
          data: {
            snippet: full.snippet,
            subject: full.subject,
            fromEmail: full.from,
            processedAt: new Date(),
          },
        });
        results.push({ id: m.id, isLead: false });
        continue;
      }

      // Prefer body email over header (web forms)
      const contactName =
        ai?.contactName ||
        heur.contactName ||
        (full.from?.match(/"?([^"<@]+)"?\s*<.*>/)?.[1] || null);

      const email =
        ai?.email ||
        heur.email ||
        (full.from?.match(/<([^>]+)>/)?.[1] || null) ||
        null;

      const custom: Record<string, any> = {
        provider: "gmail",
        messageId: m.id,
        subject: full.subject || null,
        from: full.from || null,
        summary: ai?.summary || full.snippet || null,
      };
      if (ai?.projectType) custom.projectType = ai.projectType;
      if (heur.phone) custom.phone = heur.phone;

      const lead = await prisma.lead.create({
        data: {
          tenantId,
          createdById: userId,
          contactName: contactName || (email ? email.split("@")[0] : "New Lead"),
          email,
          status: "NEW",
          nextAction: ai?.nextAction || "Review enquiry",
          custom,
        },
      });

      await prisma.emailIngest.update({
        where: { tenantId_provider_messageId: { tenantId, provider: "gmail", messageId: m.id } },
        data: {
          processedAt: new Date(),
          leadId: lead.id,
          subject: full.subject,
          fromEmail: full.from,
          snippet: full.snippet,
        },
      });

      results.push({ id: m.id, isLead: true, leadId: lead.id });
    }

    return res.json({ ok: true, imported: results });
  } catch (e: any) {
    console.error("[gmail] import failed:", e);
    return res.status(500).json({ error: e?.message || "import failed" });
  }
});

export default router;