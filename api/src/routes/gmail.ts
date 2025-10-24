// api/src/routes/gmail.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";
import OpenAI from "openai";
import { logInsight } from "../services/training";
import { load } from "cheerio";

const router = Router();

/* ============================================================
   Auth helper (req.auth is set by your JWT middleware)
   ============================================================ */
function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
    email: req.auth?.email as string | undefined,
  };
}

async function getAccessTokenForTenant(tenantId: string) {
  const conn = await prisma.gmailTenantConnection.findUnique({ where: { tenantId } });
  if (!conn) throw new Error("gmail not connected");
  return await refreshAccessToken(conn.refreshToken);
}

/* ============================================================
   Gmail helpers
   ============================================================ */
async function refreshAccessToken(refreshToken: string) {
  const url = "https://oauth2.googleapis.com/token";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GMAIL_CLIENT_ID,
        client_secret: env.GMAIL_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[gmail] token refresh NOT OK", res.status, text);
      throw new Error(`Token refresh failed: ${tryParseErr(text)}`);
    }
    const json = JSON.parse(text);
    return json.access_token as string;
  } catch (err: any) {
    console.error("[gmail] token refresh FETCH FAILED", { url, message: err?.message, cause: err?.cause });
    throw err;
  }
}

function tryParseErr(s: string) {
  try { return (JSON.parse(s)?.error_description || JSON.parse(s)?.error || s).toString(); }
  catch { return s; }
}

function decodeMimeStr(input: string) {
  try {
    const b = Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    return b.toString("utf8");
  } catch {
    return input;
  }
}

function normalizePlainText(input: string) {
  if (!input) return "";
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
}

function htmlToPlainText(html: string) {
  if (!html) return "";
  try {
    const $ = load(html);
    $("br").replaceWith("\n");
    $("p").each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      if (text && !/\n$/.test(text)) {
        $el.append("\n\n");
      }
    });
    $("li").each((_, el) => {
      const $el = $(el);
      $el.prepend("- ");
      $el.append("\n");
    });
    const text = $.root().text();
    return normalizePlainText(text);
  } catch {
    return normalizePlainText(html.replace(/<[^>]+>/g, " "));
  }
}

function pickHeader(headers: Array<{ name: string; value: string }>, name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function addressOnly(val: string | null | undefined) {
  if (!val) return null;
  const m = String(val).match(/<([^>]+)>/);
  if (m) return m[1].toLowerCase();
  return String(val).toLowerCase().trim();
}

function splitAddresses(val: string | null | undefined): string[] {
  if (!val) return [];
  // split by comma and semicolon, trim, extract addressOnly per entry
  return String(val)
    .split(/[,;]+/)
    .map((s) => s.trim())
    .map((s) => addressOnly(s) || s)
    .filter(Boolean);
}

async function fetchMessage(
  accessToken: string,
  id: string,
  format: "full" | "raw" | "metadata" | "minimal" = "full"
) {
  const r = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=${format}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "gmail message fetch failed");
  return j;
}

async function gmailSend(accessToken: string, rawRfc822: string, opts?: { threadId?: string }) {
  const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
  const raw = Buffer.from(rawRfc822).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const body: any = { raw };
  if (opts?.threadId) body.threadId = opts.threadId;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("[gmail] send NOT OK", res.status, text);
      throw new Error(`Gmail send failed: ${tryParseErr(text)}`);
    }
    return JSON.parse(text);
  } catch (err: any) {
    console.error("[gmail] send FETCH FAILED", { url, message: err?.message, cause: err?.cause });
    throw err;
  }
}

type GmailAttachment = { filename: string; size?: number; attachmentId: string };

function extractBodyAndAttachments(msg: any): {
  bodyText: string;
  bodyHtml?: string;
  attachments: GmailAttachment[];
} {
  let bodyText = "";
  let bodyHtml: string | undefined;
  const attachments: GmailAttachment[] = [];

  const walk = (p: any) => {
    if (!p) return;
    if (p.filename && p.body?.attachmentId) {
      attachments.push({
        filename: p.filename,
        size: p.body?.size,
        attachmentId: p.body.attachmentId,
      });
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
  if (!bodyText && bodyHtml) bodyText = htmlToPlainText(bodyHtml);
  bodyText = normalizePlainText(bodyText);
  if (!bodyText && bodyHtml) bodyText = htmlToPlainText(bodyHtml);

  return { bodyText, bodyHtml, attachments };
}

async function getMessagePlainText(accessToken: string, id: string) {
  const msg = await fetchMessage(accessToken, id, "full");
  const headers = msg.payload?.headers || [];
  const subject = pickHeader(headers, "Subject");
  const from = pickHeader(headers, "From");
  const { bodyText } = extractBodyAndAttachments(msg);
  return { id, subject, from, snippet: msg.snippet || "", body: bodyText };
}

/* ============================================================
   Lead extraction helpers
   ============================================================ */
function basicHeuristics(body: string) {
  const email = (body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])[0] || null;
  const phone = (body.match(/\+?\d[\d\s().-]{7,}\d/g) || [])[0] || null;
  const nameMatch =
    body.match(/\b(?:thanks|regards|cheers)[,\s\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i) ||
    body.match(/(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\n*$/m);
  const contactName = nameMatch ? nameMatch[1] : null;
  return { email, phone, contactName };
}

type BasicHeuristics = ReturnType<typeof basicHeuristics>;

function heuristicsSuggestLead(subject: string, body: string, heur: BasicHeuristics) {
  const haystack = `${subject}\n${body}`.toLowerCase();
  const keywords = [
    "quote",
    "enquiry",
    "inquiry",
    "estimate",
    "wardrobe",
    "kitchen",
    "alcove",
    "cabinet",
    "bespoke",
    "joinery",
    "carpentry",
    "fitted",
    "timber",
    "stair",
    "door",
    "window",
    "refurb",
  ];
  const hasKeyword = keywords.some((kw) => haystack.includes(kw));
  const hasContact = Boolean(heur.email || heur.contactName || heur.phone);
  const hasBody = body.trim().length > 40;
  return hasKeyword && hasContact && hasBody;
}

function looksLikeNoise(subject: string, body: string) {
  const haystack = `${subject}\n${body}`.toLowerCase();
  const noiseIndicators = [
    "unsubscribe",
    "newsletter",
    "privacy policy",
    "terms and conditions",
    "job application",
    "curriculum vitae",
    "resume",
    "apply for",
    "shipping",
    "delivery",
    "tracking number",
    "invoice",
    "payment received",
    "receipt",
    "password reset",
    "two-factor",
    "security alert",
    "marketing",
    "sale",
    "discount",
  ];
  return noiseIndicators.some((word) => haystack.includes(word));
}

async function recordTrainingExample(params: {
  tenantId: string;
  provider: string;
  messageId: string;
  label: "accepted" | "rejected";
  subject: string;
  snippet: string;
  from: string | null;
  body: string;
  ai: any;
  heuristics: BasicHeuristics | null;
  decidedBy: string;
  reason: string;
  confidence: number | null;
  leadId?: string | null;
}) {
  try {
    const { tenantId, provider, messageId } = params;
    const existing = await prisma.leadTrainingExample.findFirst({
      where: { tenantId, provider, messageId },
      select: { id: true },
    });

    const truncatedBody = params.body.length > 4000 ? `${params.body.slice(0, 4000)}…` : params.body;
    const payload = {
      subject: params.subject,
      snippet: params.snippet,
      from: params.from,
      body: truncatedBody,
      ai: params.ai,
      heuristics: params.heuristics,
      decidedBy: params.decidedBy,
      reason: params.reason,
      confidence: params.confidence,
      leadId: params.leadId || null,
    };

    if (existing) {
      await prisma.leadTrainingExample.update({
        where: { id: existing.id },
        data: { label: params.label, extracted: payload },
      });
    } else {
      await prisma.leadTrainingExample.create({
        data: {
          tenantId,
          provider,
          messageId,
          label: params.label,
          extracted: payload,
        },
      });
    }
  } catch (e: any) {
    console.error("[gmail] failed to record training example", e?.message || e);
  }
}

async function ensureLeadReviewTask(tenantId: string, leadId: string) {
  const metaKey = `lead:${leadId}:review-enquiry`;
  const existing = await prisma.task.findFirst({
    where: {
      tenantId,
      relatedType: "LEAD" as any,
      relatedId: leadId,
      meta: { path: ["key"], equals: metaKey },
    },
    select: { id: true },
  });
  if (existing) return existing;

  const dueAt = new Date(Date.now() + 24 * 3600 * 1000);
  return prisma.task.create({
    data: {
      tenantId,
      title: "Review enquiry",
      relatedType: "LEAD" as any,
      relatedId: leadId,
      status: "OPEN" as any,
      priority: "MEDIUM" as any,
      dueAt,
      autocreated: true,
      meta: { key: metaKey, source: "gmail-import" } as any,
    },
  });
}

async function extractLeadWithOpenAI(
  subject: string,
  body: string,
  opts: { snippet?: string; from?: string | null } = {},
) {
  if (!env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const truncatedBody = (body || "").slice(0, 6000);
  const snippet = opts.snippet || "";
  const from = opts.from || "";

  const systemPrompt = `You triage inbound emails for a bespoke joinery and carpentry business. Decide if an email is a genuine new sales enquiry from a potential customer.

Treat as NOT a lead if it is any of the following: marketing/newsletters, spam, job applications, vendor sales pitches, order confirmations, shipping or payment notifications, account/security alerts, internal staff messages, or anything unrelated to bespoke joinery/carpentry projects.

Strong indicators of a lead include questions about quotes, measurements, site visits, bespoke furniture (e.g. wardrobes, alcove units, kitchens, staircases), fitting/installation, timber work, renovation, or requests for someone to get in touch.

When unsure, err on the side of NOT a lead unless there is explicit interest in the company's services.`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Subject: ${subject || "(no subject)"}\nFrom: ${from || "unknown"}\nSnippet: ${snippet || "(no snippet)"}\nBody:\n${truncatedBody || "(empty)"}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "lead_classification",
        schema: {
          type: "object",
          additionalProperties: true,
          properties: {
            isLead: {
              type: "boolean",
              description: "Whether this message is a genuine sales enquiry for bespoke joinery/carpentry services.",
            },
            confidence: {
              type: "number",
              description: "Confidence score between 0 and 1 for the lead decision.",
              minimum: 0,
              maximum: 1,
            },
            reason: {
              type: "string",
              description: "Short explanation supporting the decision.",
            },
            contactName: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            projectType: { type: ["string", "null"] },
            nextAction: { type: ["string", "null"] },
            summary: { type: ["string", "null"] },
            tags: { type: "array", items: { type: "string" } },
          },
          required: ["isLead", "reason", "summary"],
        },
      },
    },
  });

  const text = resp.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ============================================================
   Connection
   ============================================================ */
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

/* ============================================================
   OAuth start JSON -> /gmail/connect/start
   ============================================================ */
function buildAuthUrl(tenantId: string, userId?: string) {
  const clientId = env.GMAIL_CLIENT_ID;
  const redirectUri = env.GMAIL_REDIRECT_URI || "http://localhost:4000/gmail/oauth/callback";
  if (!clientId) throw new Error("GMAIL_CLIENT_ID missing.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" "),
    state: JSON.stringify({ tenantId, userId }),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

router.get("/connect/start", (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    const authUrl = buildAuthUrl(tenantId, userId);
    return res.json({ authUrl });
  } catch (e: any) {
    console.error("[gmail] /connect/start failed:", e?.message || e);
    return res.status(500).json({ error: "oauth_start_failed" });
  }
});

/* ============================================================
   OAuth start (redirect) -> /gmail/connect
   ============================================================ */
router.get("/connect", (req, res) => {
  // Optional dev helper: accept ?jwt=
  const qJwt = (req.query.jwt as string | undefined) || undefined;
  if (qJwt && !req.auth) {
    try {
      const decoded = jwt.verify(qJwt, env.APP_JWT_SECRET) as any;
      (req as any).auth = {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        email: decoded.email,
      };
    } catch {
      return res.status(401).send("invalid jwt");
    }
  }

  const { tenantId, userId } = getAuth(req);
  if (!tenantId) return res.status(401).send("unauthorized");

  const authUrl = buildAuthUrl(tenantId, userId);
  res.redirect(302, authUrl);
});

/* ============================================================
   OAuth callback  (robust state parsing + JWT fallback)
   ============================================================ */
router.get("/oauth/callback", async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  if (q.error) return res.status(400).send(`OAuth error: ${q.error}`);
  if (!q.code) return res.status(400).send("Missing ?code");

  // 1) Parse state robustly (raw → decodeURIComponent → JSON.parse)
  let parsed: { tenantId?: string; userId?: string } = {};
  const raw = q.state ?? "";
  const candidates: string[] = [];
  if (raw) candidates.push(raw);
  try { if (raw) candidates.push(decodeURIComponent(raw)); } catch {}

  for (const s of candidates) {
    try {
      const j = JSON.parse(s);
      if (j && typeof j === "object") { parsed = j; break; }
    } catch {}
  }

  // 2) Fallback: derive tenant from JWT (Authorization header or jwt cookie)
  if (!parsed.tenantId) {
    try {
      const authHeader = req.headers.authorization || "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const cookieToken = (req.headers.cookie || "").match(/(?:^|;\s*)jwt=([^;]+)/)?.[1];
      const token = bearer || (cookieToken ? decodeURIComponent(cookieToken) : null);
      if (token) {
        const decoded = jwt.verify(token, env.APP_JWT_SECRET) as any;
        parsed.tenantId = decoded?.tenantId;
        parsed.userId = decoded?.userId ?? parsed.userId;
      }
    } catch {}
  }

  if (!parsed.tenantId) return res.status(400).send("Missing tenantId in state");

  // 3) Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: q.code!,
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
    try {
      const payloadB64 = String(id_token).split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
      gmailAddress = payload?.email || null;
    } catch {}
  }
  if (!refresh_token) {
    return res
      .status(400)
      .send("No refresh_token. Revoke old access in Google Account and reconnect.");
  }

  await prisma.gmailTenantConnection.upsert({
    where: { tenantId: parsed.tenantId! },
    update: { refreshToken: refresh_token, gmailAddress, connectedById: parsed.userId ?? null },
    create: {
      tenantId: parsed.tenantId!,
      connectedById: parsed.userId ?? null,
      gmailAddress,
      refreshToken: refresh_token,
    },
  });

  const appUrl = (process.env.APP_URL || "").trim();
  if (appUrl && /^https?:\/\//i.test(appUrl)) {
    const next = `${appUrl.replace(/\/+$/, "")}/settings?gmail=connected`;
    return res.redirect(302, next);
  }

  return res.send(`<h2>✅ Gmail Connected!</h2><p>Account: ${gmailAddress || "unknown"}</p>`);
});

/* ============================================================
   Full message + attachments
   ============================================================ */
router.get("/message/:id", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const accessToken = await getAccessTokenForTenant(tenantId);
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
      attachments,
      threadId: msg.threadId,
    });
  } catch (e: any) {
    console.error("[gmail] /message failed", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

/* ============================================================
   Attachments (INLINE view by default + /download fallback)
   ============================================================ */
function sniffMime(buf: Buffer, fallback = "application/octet-stream") {
  if (buf.slice(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.slice(0, 6).toString() === "GIF87a" || buf.slice(0, 6).toString() === "GIF89a")
    return "image/gif";
  return fallback;
}
const EXT_FROM_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "text/plain": ".txt",
  "text/html": ".html",
};

router.get(
  ["/message/:id/attachments/:attachmentId", "/message/:id/attachments/:attachmentId/download"],
  async (req, res) => {
    // Allow ?jwt= to auth this request (so server->server fetch can work)
try {
  const qJwt = (req.query.jwt as string | undefined) || undefined;
  if (qJwt && !req.auth) {
    const decoded = jwt.verify(qJwt, env.APP_JWT_SECRET) as any;
    (req as any).auth = {
      tenantId: decoded.tenantId,
      userId: decoded.userId,
      email: decoded.email,
    };
  }
} catch {
  // ignore — if jwt invalid we’ll fall back to normal auth check below
}
    try {
      const { tenantId } = getAuth(req);
      if (!tenantId) return res.status(401).send("unauthorized");
      const isDownload = req.path.endsWith("/download");

      const accessToken = await getAccessTokenForTenant(tenantId);
      const messageId = String(req.params.id);
      const attachmentId = String(req.params.attachmentId);

      const attRsp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const attJson = await attRsp.json();
      if (!attRsp.ok) {
        return res
          .status(attRsp.status)
          .send(attJson?.error?.message || "attachment fetch failed");
      }
      const buf = Buffer.from(String(attJson.data).replace(/-/g, "+").replace(/_/g, "/"), "base64");

      const msg = await fetchMessage(accessToken, messageId, "full");
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

      if (!mimeType || mimeType === "application/octet-stream") {
        mimeType = sniffMime(buf, mimeType);
      }

      const hasExt = /\.[a-z0-9]{2,}$/i.test(filename);
      if (!hasExt && EXT_FROM_MIME[mimeType]) {
        filename = `${filename}${EXT_FROM_MIME[mimeType]}`;
      }

      res.setHeader("Content-Type", mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("Content-Length", String(buf.length));

      return res.send(buf);
    } catch (e: any) {
      console.error("[gmail] attachment stream failed:", e);
      return res.status(500).send(e?.message || "attachment stream failed");
    }
  }
);

/* ============================================================
   Thread (history of a conversation)
   ============================================================ */
router.get("/thread/:threadId", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const accessToken = await getAccessTokenForTenant(tenantId);
    const threadId = String(req.params.threadId);

    const rsp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const thread = await rsp.json();
    if (!rsp.ok) return res.status(rsp.status).json(thread);

    const out = (thread.messages || []).map((m: any) => {
      const headers = m.payload?.headers || [];
      const subject = pickHeader(headers, "Subject");
      const from = pickHeader(headers, "From");
      const date = pickHeader(headers, "Date");
      let bodyText = "";
      const walk = (p: any) => {
        if (!p) return;
        if (p.mimeType === "text/plain" && p.body?.data) {
          bodyText += decodeMimeStr(p.body.data) + "\n";
        }
        if (p.parts) p.parts.forEach(walk);
      };
      walk(m.payload);
      if (!bodyText && m.payload?.body?.data) bodyText = decodeMimeStr(m.payload.body.data);
      return {
        id: m.id,
        subject,
        from,
        date,
        snippet: m.snippet,
        bodyText: bodyText.trim(),
      };
    });

    return res.json({ threadId, messages: out });
  } catch (e: any) {
    console.error("[gmail] /thread failed", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

/* ============================================================
   Import (idempotent)
   ============================================================ */

async function findLeadForInbound(tenantId: string, fromAddr: string | null, threadId: string | null) {
  // 1) If we already have a thread linked to a lead, use it.
  if (threadId) {
    const t = await prisma.emailThread.findUnique({
      where: { tenantId_provider_threadId: { tenantId, provider: "gmail", threadId } },
      select: { leadId: true },
    });
    if (t?.leadId) return t.leadId;
  }
  // 2) Fallback: exact email match to existing lead
  if (fromAddr) {
    const lead = await prisma.lead.findFirst({
      where: { tenantId, email: fromAddr.toLowerCase() },
      select: { id: true },
    });
    if (lead) return lead.id;
  }
  return null;
}

router.post("/import", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const max = Math.max(1, Math.min(Number(req.body?.max || 5), 20)); // 1..20
  const q = (req.body?.q as string | undefined) || "newer_than:30d";

  try {
    const accessToken = await getAccessTokenForTenant(tenantId);

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
      // Create EmailIngest row first (idempotent). If present, skip FULL processing but do minimal thread sync.
      let createdIngest = false;
      try {
        await prisma.emailIngest.create({
          data: {
            tenantId,
            provider: "gmail",
            messageId: m.id,
          },
        });
        createdIngest = true;
      } catch {
        // already indexed previously — still try to ensure thread+message exist (defensive)
      }

      // Pull message
      const msg = await fetchMessage(accessToken, m.id, "full");
      const headers = msg.payload?.headers || [];
      const subject = pickHeader(headers, "Subject") || "";
      const fromHdr = pickHeader(headers, "From") || "";
      const toHdr = pickHeader(headers, "To") || "";
      const ccHdr = pickHeader(headers, "Cc") || "";

      const fromAddr = addressOnly(fromHdr);
      const toAddrs = splitAddresses(toHdr);
      const ccAddrs = splitAddresses(ccHdr);
      const allRcpts = [...toAddrs, ...ccAddrs];

      const { bodyText } = extractBodyAndAttachments(msg);
      const snippet = msg.snippet || "";
      const bodyForAnalysis = bodyText || snippet || "";
      const threadId = msg.threadId || null;

      // Upsert EmailThread
      const thread = await prisma.emailThread.upsert({
        where: { tenantId_provider_threadId: { tenantId, provider: "gmail", threadId: threadId || `single:${m.id}` } },
        update: { subject: subject || undefined, updatedAt: new Date() },
        create: {
          tenantId,
          provider: "gmail",
          threadId: threadId || `single:${m.id}`,
          subject: subject || null,
        },
      });

      // Find or create lead
      let leadId = await findLeadForInbound(tenantId, fromAddr, threadId);

      // If new conversation and no lead yet → attempt AI/heuristics then create
      let createdLead = false;
      let classification: {
        isLead: boolean;
        decidedBy: "openai" | "heuristics";
        reason: string;
        confidence: number | null;
        ai: any;
        heuristics: BasicHeuristics | null;
        noiseFiltered: boolean;
        leadId?: string | null;
      } | null = null;

      if (!leadId) {
        const heur = basicHeuristics(bodyForAnalysis);
        let ai: any = null;
        try {
          ai = await extractLeadWithOpenAI(subject, bodyForAnalysis, { snippet, from: fromHdr });
        } catch (e: any) {
          console.error("[gmail] openai classification failed:", e?.message || e);
        }

        const aiIsLead =
          typeof ai?.isLead === "string"
            ? ai.isLead.toLowerCase() === "true"
            : typeof ai?.isLead === "boolean"
            ? ai.isLead
            : null;
        const aiConfidence =
          typeof ai?.confidence === "number"
            ? Math.max(0, Math.min(1, Number(ai.confidence)))
            : null;
        const aiReason = typeof ai?.reason === "string" ? ai.reason : "";
        const noise = looksLikeNoise(subject || "", bodyForAnalysis);

        let decidedBy: "openai" | "heuristics" = ai ? "openai" : "heuristics";
        let isLeadCandidate = false;
        let reason = aiReason;

        if (aiIsLead === true && !noise) {
          if ((aiConfidence ?? 0) >= 0.6 || heuristicsSuggestLead(subject || "", bodyForAnalysis, heur)) {
            isLeadCandidate = true;
            reason = aiReason || "OpenAI classified this as a lead";
          } else if (!reason) {
            reason = "OpenAI suggested a lead but with low confidence";
          }
        } else if (aiIsLead === true && noise) {
          reason = (aiReason || "OpenAI classified as lead") + " (flagged as noise)";
        } else if (aiIsLead === false) {
          isLeadCandidate = false;
          reason = aiReason || "OpenAI classified this as not a lead";
        }

        if (aiIsLead === null || (aiConfidence ?? 0) < 0.6) {
          if (heuristicsSuggestLead(subject || "", bodyForAnalysis, heur) && !noise) {
            isLeadCandidate = true;
            const heurReason = "Heuristics detected enquiry keywords and contact details";
            reason = reason ? `${reason}; ${heurReason}` : heurReason;
            decidedBy = ai ? "openai" : "heuristics";
          } else if (!reason) {
            reason = "No strong indicators of a customer enquiry";
          }
        }

        if (noise) {
          isLeadCandidate = false;
          reason = reason ? `${reason} (filtered as newsletter/spam)` : "Filtered as newsletter/spam";
        }

        classification = {
          isLead: isLeadCandidate,
          decidedBy,
          reason,
          confidence: aiConfidence,
          ai,
          heuristics: heur,
          noiseFiltered: noise,
        };

  if (isLeadCandidate) {
          const contactName =
            (typeof ai?.contactName === "string" && ai.contactName) ||
            heur.contactName ||
            (fromHdr?.match(/"?([^"<@]+)"?\s*<.*>/)?.[1] || null);

          const emailCandidate =
            (typeof ai?.email === "string" && ai.email) || heur.email || fromAddr || null;
          const email = emailCandidate ? String(emailCandidate).toLowerCase() : null;

          const aiDecision: Record<string, any> = {
            decidedBy,
            reason,
            confidence: aiConfidence ?? null,
            model: ai ? "openai" : "heuristics",
          };
          if (noise) aiDecision.noiseFiltered = true;

          const custom: Record<string, any> = {
            provider: "gmail",
            messageId: m.id,
            threadId: thread.threadId,
            subject: subject || null,
            from: fromHdr || null,
            summary: (typeof ai?.summary === "string" && ai.summary) || snippet || null,
            uiStatus: "NEW_ENQUIRY",
            aiDecision,
          };
          const phone = (typeof ai?.phone === "string" && ai.phone) || heur.phone;
          if (phone) custom.phone = phone;
          if (typeof ai?.projectType === "string" && ai.projectType) custom.projectType = ai.projectType;
          if (Array.isArray(ai?.tags) && ai.tags.length) custom.tags = ai.tags;
          if (typeof ai?.nextAction === "string" && ai.nextAction) custom.suggestedNextAction = ai.nextAction;

          const created = await prisma.lead.create({
            data: {
              tenantId,
              createdById: userId,
              contactName: contactName || (email ? email.split("@")?.[0] : "New Lead"),
              email,
              status: "NEW",
              nextAction: (typeof ai?.nextAction === "string" && ai.nextAction) || "Review enquiry",
              custom,
            },
          });
          leadId = created.id;
          createdLead = true;
          classification.leadId = leadId;

          await ensureLeadReviewTask(tenantId, leadId);

          await recordTrainingExample({
            tenantId,
            provider: "gmail",
            messageId: m.id,
            label: "accepted",
            subject,
            snippet,
            from: fromHdr,
            body: bodyForAnalysis,
            ai,
            heuristics: heur,
            decidedBy,
            reason,
            confidence: aiConfidence,
            leadId,
          });

          // Log transparent training insight (accepted)
          try {
            await logInsight({
              tenantId,
              module: "lead_classifier",
              inputSummary: `email:gmail:${m.id}`,
              decision: "accepted",
              confidence: aiConfidence ?? null,
            });
          } catch (e) {
            console.warn("[gmail] logInsight accepted failed:", (e as any)?.message || e);
          }
        } else {
          await recordTrainingExample({
            tenantId,
            provider: "gmail",
            messageId: m.id,
            label: "rejected",
            subject,
            snippet,
            from: fromHdr,
            body: bodyForAnalysis,
            ai,
            heuristics: heur,
            decidedBy,
            reason,
            confidence: aiConfidence,
            leadId: null,
          });

          // Log transparent training insight (rejected)
          try {
            await logInsight({
              tenantId,
              module: "lead_classifier",
              inputSummary: `email:gmail:${m.id}`,
              decision: "rejected",
              confidence: aiConfidence ?? null,
            });
          } catch (e) {
            console.warn("[gmail] logInsight rejected failed:", (e as any)?.message || e);
          }
        }
      }

      // Link thread to lead if we have one now
      if (leadId && !thread.leadId) {
        await prisma.emailThread.update({ where: { id: thread.id }, data: { leadId } });
      }

      // Upsert EmailMessage (idempotent on (tenantId, provider, messageId))
      try {
        await prisma.emailMessage.upsert({
  where: {
    tenantId_provider_messageId: {
      tenantId,
      provider: "gmail",
      messageId: m.id,
    },
  },
  update: {
    threadId: thread.id,
    fromEmail: fromAddr,
    toEmail: allRcpts.length ? allRcpts.join(", ") : null,
    subject: subject || null,
    snippet: snippet || null,
    bodyText: bodyText || null,
    sentAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
    leadId: leadId || null,
  },
  create: {
    tenantId,
    provider: "gmail",
    messageId: m.id,
    threadId: thread.id,
    direction: "inbound",
    fromEmail: fromAddr,
    toEmail: allRcpts.length ? allRcpts.join(", ") : null,
    subject: subject || null,
    snippet: snippet || null,
    bodyText: bodyText || null,
    sentAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
    leadId: leadId || null,
  },
});
      } catch {
        // already present
      }

      // Touch thread timestamps
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { lastInboundAt: new Date(), updatedAt: new Date(), ...(subject ? { subject } : {}) },
      });

      // Update EmailIngest row (legacy)
      try {
        await prisma.emailIngest.update({
          where: { tenantId_provider_messageId: { tenantId, provider: "gmail", messageId: m.id } },
          data: (() => {
            const base: Record<string, any> = {
              processedAt: new Date(),
              leadId: leadId || null,
              subject,
              fromEmail: fromHdr,
              snippet,
            };
            if (classification) {
              const aiIsLead =
                typeof classification.ai?.isLead === "string"
                  ? classification.ai.isLead.toLowerCase() === "true"
                  : typeof classification.ai?.isLead === "boolean"
                  ? classification.ai.isLead
                  : null;
              if (aiIsLead !== null) {
                base.aiPredictedIsLead = aiIsLead;
              } else {
                base.aiPredictedIsLead = classification.isLead;
              }
              // Do not set userLabelIsLead here; leave that to explicit user actions or status changes
            }
            return base;
          })(),
        });
      } catch {}

      results.push({
        id: m.id,
        threadId: thread.threadId,
        linkedLeadId: leadId || null,
        createdLead,
        indexed: createdIngest,
      });
    }

    return res.json({ ok: true, imported: results });
  } catch (e: any) {
    console.error("[gmail] import failed:", e);
    return res.status(500).json({ error: e?.message || "import failed" });
  }
});

/* ============================================================
   Debug helpers
   ============================================================ */
router.get("/debug/scopes", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    
    const accessToken = await getAccessTokenForTenant(tenantId);
    const r = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    const j = await r.json();
    return res.json({ ok: r.ok, scope: j.scope, raw: j });
  } catch (e: any) {
    console.error("[gmail/debug/scopes]", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

router.post("/disconnect", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    await prisma.gmailTenantConnection.deleteMany({ where: { tenantId } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed to disconnect" });
  }
});
/* ============================================================
   Debug: server-side list (proxies Gmail with a fresh access token)
   ============================================================ */
router.get("/debug/list", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const accessToken = await getAccessTokenForTenant(tenantId);
    const max = String(Math.max(1, Math.min(Number(req.query.max || 5), 50)));
    const q = String(req.query.q || "newer_than:30d");

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({
      maxResults: max,
      q,
    }).toString()}`;

    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json(j);
    return res.json(j);
  } catch (e: any) {
    console.error("[gmail/debug/list]", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});


/* ============================================================
   Back-compat start aliases
   ============================================================ */
router.get("/oauth/start", (_req, res) => res.redirect(302, "/gmail/connect"));
router.get("/oauth2/start", (_req, res) => res.redirect(302, "/gmail/connect"));

export default router;