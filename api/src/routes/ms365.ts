// api/src/routes/ms365.ts
import { Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../prisma";
import { env } from "../env";
import { normalizeEmail } from "../lib/email";
import { getAccessTokenForTenant, getAttachment } from "../services/ms365";
import OpenAI from "openai";
import { logInsight } from "../services/training";

// Helper to generate unique tenant slug
async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let suffix = 0;
  let finalSlug = slug;
  
  while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
    suffix++;
    finalSlug = `${slug}-${suffix}`;
  }
  
  return finalSlug;
}
import { load } from "cheerio";
import { redactEmailBody } from "../lib/ml/redact";

const router = Router();

/**
 * Build the Microsoft authorization URL
 */
router.get("/ms365/login", (_req, res) => {
  const tenantSegment = process.env.MS365_TENANT || "common";

  // URLSearchParams expects a space-separated string for scope
  // Mail.ReadWrite includes both Read and Write (Send + Move)
  const scopes =
    process.env.MS365_SCOPES ||
    "offline_access Mail.ReadWrite User.Read";

  const params = new URLSearchParams({
    client_id: env.MS365_CLIENT_ID,
    response_type: "code",
    redirect_uri: env.MS365_REDIRECT_URI,
    response_mode: "query",
    scope: scopes,
    state: "crm-login",
    prompt: "select_account",
  });

  const url = `https://login.microsoftonline.com/${tenantSegment}/oauth2/v2.0/authorize?${params.toString()}`;
  res.redirect(url);
});

/**
 * OAuth callback: exchange code for tokens, upsert tenant+user, return JWT
 */
router.get("/ms365/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    if (!code) {
      return res.status(400).json({ error: "missing code" });
    }

    const tenantSegment = process.env.MS365_TENANT || "common";
    const tokenUrl = `https://login.microsoftonline.com/${tenantSegment}/oauth2/v2.0/token`;

    const form = new URLSearchParams({
      client_id: env.MS365_CLIENT_ID,
      client_secret: env.MS365_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: env.MS365_REDIRECT_URI,
    });

    const tokenResp = await axios.post(tokenUrl, form.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const { access_token, refresh_token, id_token } = tokenResp.data || {};
    if (!id_token) {
      return res.status(400).json({ error: "missing id_token from Microsoft" });
    }

    // Decode id_token (JWT) to extract the user identity
    const [, payloadB64] = String(id_token).split(".");
    const payloadJson = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));

    // Common places for email/name in MS id_token
    const rawEmail: string =
      payloadJson.email ||
      payloadJson.preferred_username ||
      payloadJson.upn ||
      "";
    const email = normalizeEmail(rawEmail);
    const name: string = payloadJson.name || (email ? email.split("@")[0] : "User");

    if (!email) {
      return res.status(400).json({ error: "could not determine email from id_token" });
    }

    // ---------- Find-or-create tenant (no unique constraint on name) ----------
    const TENANT_NAME = "MS365 Tenant";
    let msTenant = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
    if (!msTenant) {
      const slug = await generateUniqueSlug(TENANT_NAME);
      msTenant = await prisma.tenant.create({ data: { name: TENANT_NAME, slug } });
    }

    // ---------- Find-or-create user; ensure it belongs to msTenant ----------
    let user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) {
      const passwordHash = await bcrypt.hash("oauth-ms365", 10); // placeholder
      user = await prisma.user.create({
        data: {
          tenantId: msTenant.id,
          email,
          name,
          role: "owner",
          passwordHash,
          // Optionally persist tokens for later Graph calls
          // msAccessToken: access_token,
          // msRefreshToken: refresh_token,
        },
      });
    } else if (user.tenantId !== msTenant.id) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { tenantId: msTenant.id },
      });
    }

    // ---------- Issue your app JWT ----------
    const appJwt = jwt.sign(
      {
        userId: user.id,
        tenantId: msTenant.id,
        email: user.email,
        role: user.role,
      },
      env.APP_JWT_SECRET,
      { expiresIn: "12h" }
    );

    // Redirect back to web app with JWT (or set a cookie if you prefer)
    const webUrl = process.env.WEB_APP_URL || "http://localhost:3000";
    const redirectUrl = `${webUrl}/login?jwt=${encodeURIComponent(appJwt)}`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error("[ms365/callback] failed:", err?.response?.data || err?.message || err);
    return res.status(500).json({ error: "ms365 callback failed" });
  }
});

/** Optional: sanity endpoint */
router.get("/ms365/ping", (_req, res) => {
  res.json({ ok: true });
});

export default router;

/**
 * Connection status for UI
 */
router.get("/connection", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    const conn = await prisma.ms365TenantConnection.findUnique({
      where: { tenantId },
      select: { id: true, ms365Address: true, createdAt: true, updatedAt: true },
    });
    return res.json({ ok: true, connection: conn });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

/**
 * Stream attachment as inline/download with optional ?jwt=
 */
router.get(["/message/:id/attachments/:attachmentId", "/message/:id/attachments/:attachmentId/download"], async (req: any, res) => {
  // Optional JWT via query for signed URLs
  try {
    const qJwt = (req.query.jwt as string | undefined) || undefined;
    if (qJwt && !req.auth) {
      const decoded = jwt.verify(qJwt, env.APP_JWT_SECRET) as any;
      (req as any).auth = { tenantId: decoded.tenantId, userId: decoded.userId, email: decoded.email };
    }
  } catch {}

  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).send("unauthorized");
    const isDownload = String(req.path).endsWith("/download");
    const messageId = String(req.params.id);
    const attachmentId = String(req.params.attachmentId);

    const accessToken = await getAccessTokenForTenant(tenantId);
    const att = await getAttachment(accessToken, messageId, attachmentId);
    const name = att?.name || "attachment.pdf";
    const contentType = att?.contentType || "application/octet-stream";
    const b64 = att?.contentBytes as string | undefined;
    if (!b64) return res.status(404).send("attachment_content_missing");
    const buf = Buffer.from(b64, "base64");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Content-Disposition", `${isDownload ? "attachment" : "inline"}; filename="${name}"`);
    return res.send(buf);
  } catch (e: any) {
    console.error("[ms365] attachment stream failed:", e);
    return res.status(500).send(e?.message || "attachment stream failed");
  }
});

/**
 * Return full message details in a normalized JSON shape
 */
router.get("/message/:id", async (req: any, res) => {
  // Optional JWT via query for signed URLs (parity with gmail route)
  try {
    const qJwt = (req.query.jwt as string | undefined) || undefined;
    if (qJwt && !req.auth) {
      const decoded = jwt.verify(qJwt, env.APP_JWT_SECRET) as any;
      (req as any).auth = { tenantId: decoded.tenantId, userId: decoded.userId, email: decoded.email };
    }
  } catch {}

  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const messageId = String(req.params.id);
    const accessToken = await getAccessTokenForTenant(tenantId);
    const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,hasAttachments`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const j: any = await r.json();
    if (!r.ok) return res.status(r.status).json(j);

    const subject: string = j.subject || "";
    const from: string | null = (j.from?.emailAddress?.name || j.from?.emailAddress?.address || "") || null;
    const date: string | null = j.receivedDateTime || null;
    const isHtml = String(j.body?.contentType || "").toLowerCase() === "html";
    const bodyHtml: string | undefined = isHtml ? String(j.body?.content || "") : undefined;
    const bodyText: string = isHtml ? htmlToPlainText(bodyHtml || "") : normalizePlainText(String(j.body?.content || j.bodyPreview || ""));

    let attachments: Array<{ id: string; name: string; contentType?: string; size?: number }> = [];
    if (j.hasAttachments) {
      try {
        const attUrl = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments?$top=50`;
        const ar = await fetch(attUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        const aj: any = await ar.json();
        if (ar.ok && Array.isArray(aj.value)) {
          attachments = aj.value.map((a: any) => ({ id: a.id, name: a.name, contentType: a.contentType, size: a.size }));
        }
      } catch {}
    }

    return res.json({
      id: j.id,
      subject,
      from,
      date,
      snippet: (j.bodyPreview || "").slice(0, 160),
      bodyText,
      bodyHtml: bodyHtml || undefined,
      attachments,
      threadId: j.conversationId || null,
    });
  } catch (e: any) {
    console.error("[ms365] /message failed", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

/**
 * ==============================
 * Import inbound mail from MS365
 * ==============================
 */

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
    email: req.auth?.email as string | undefined,
  };
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

function basicHeuristics(body: string) {
  const email = (body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])[0] || null;
  const phone = (body.match(/\+?\d[\d\s().-]{7,}\d/g) || [])[0] || null;
  const nameMatch =
    body.match(/\b(?:thanks|regards|cheers)[,\s\-]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i) ||
    body.match(/(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\n*$/m);
  const contactName = nameMatch ? nameMatch[1] : null;
  return { email, phone, contactName } as { email: string | null; phone: string | null; contactName: string | null };
}

function heuristicsSuggestLead(subject: string, body: string, heur: ReturnType<typeof basicHeuristics>) {
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
  const hasBody = body.trim().length > 10;
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

async function extractLeadWithOpenAI(subject: string, body: string, opts: { snippet?: string; from?: string | null } = {}) {
  if (!env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const truncatedBody = (body || "").slice(0, 6000);
  const snippet = opts.snippet || "";
  const from = opts.from || "";

  const safeSubject = redactEmailBody(subject || "");
  const safeSnippet = redactEmailBody(snippet);
  const safeFrom = redactEmailBody(from);
  const safeBody = redactEmailBody(truncatedBody);

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
        content: `Subject: ${safeSubject || "(no subject)"}\nFrom: ${safeFrom || "unknown"}\nSnippet: ${safeSnippet || "(no snippet)"}\nBody:\n${safeBody || "(empty)"}`,
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
            isLead: { type: "boolean" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string" },
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

  const text = (resp.choices[0]?.message?.content as string) || "{}";
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function addressOnly(val: string | null | undefined) {
  if (!val) return null;
  const m = String(val).match(/<([^>]+)>/);
  if (m) return m[1].toLowerCase();
  return String(val).toLowerCase().trim();
}

router.post("/import", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const max = Math.max(1, Math.min(Number(req.body?.max || 5), 20)); // 1..20

  try {
    // Fetch tenant inbox settings once per import (recall-first flag)
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { inbox: true } });
    const inbox = (settings?.inbox as any) || {};
    const recallFirst = !!(inbox.recallFirst || inbox.neverMiss);

    const accessToken = await getAccessTokenForTenant(tenantId);

    // List recent Inbox messages (most recent first)
    const listUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$top=${encodeURIComponent(String(max))}&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,from,hasAttachments,bodyPreview`;
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const listJson: any = await listRes.json();
    if (!listRes.ok) throw new Error(listJson?.error?.message || "ms365 list failed");

    const messages: Array<{ id: string }> = (listJson.value || []).map((m: any) => ({ id: m.id }));
    const results: any[] = [];

    for (const m of messages) {
      // idempotent ingest row
      let createdIngest = false;
      try {
        const createRes = await prisma.emailIngest.createMany({
          data: [
            { tenantId, provider: "ms365", messageId: m.id },
          ],
          skipDuplicates: true,
        });
        createdIngest = createRes.count === 1;
      } catch (e) {
        console.warn("[ms365] emailIngest createMany failed:", (e as any)?.message || e);
      }

      // Fetch full message for headers/body
      const msgUrl = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(m.id)}?$select=id,subject,receivedDateTime,from,toRecipients,ccRecipients,conversationId,body,bodyPreview`;
      const msgRes = await fetch(msgUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const msg: any = await msgRes.json();
      if (!msgRes.ok) throw new Error(msg?.error?.message || "ms365 message fetch failed");

      const subject: string = msg.subject || "";
      const fromAddr: string | null = (msg.from?.emailAddress?.address as string | undefined)?.toLowerCase() || null;
      const toAddrs: string[] = Array.isArray(msg.toRecipients)
        ? msg.toRecipients.map((r: any) => (r?.emailAddress?.address || "").toLowerCase()).filter(Boolean)
        : [];
      const ccAddrs: string[] = Array.isArray(msg.ccRecipients)
        ? msg.ccRecipients.map((r: any) => (r?.emailAddress?.address || "").toLowerCase()).filter(Boolean)
        : [];
      const allRcpts = [...toAddrs, ...ccAddrs];
      const received = msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date();
      const conversationId: string | null = msg.conversationId || null;

      const bodyContent: string = msg.body?.content || msg.bodyPreview || "";
      const bodyIsHtml = String(msg.body?.contentType || "").toLowerCase() === "html";
      const bodyText = normalizePlainText(bodyIsHtml ? htmlToPlainText(bodyContent) : bodyContent);
      const snippet = (msg.bodyPreview || "").slice(0, 160);

      // Upsert EmailThread for ms365
      const thread = await prisma.emailThread.upsert({
        where: {
          tenantId_provider_threadId: {
            tenantId,
            provider: "ms365",
            threadId: conversationId || `single:${m.id}`,
          },
        },
        update: { subject: subject || undefined, updatedAt: new Date() },
        create: {
          tenantId,
          provider: "ms365",
          threadId: conversationId || `single:${m.id}`,
          subject: subject || null,
        },
      });

      // Simple lead association: by thread or sender email
      let leadId: string | null = null;
      if (conversationId) {
        const t = await prisma.emailThread.findUnique({
          where: {
            tenantId_provider_threadId: { tenantId, provider: "ms365", threadId: conversationId },
          },
          select: { leadId: true },
        });
        if (t?.leadId) leadId = t.leadId;
      }
      if (!leadId && fromAddr) {
        const lead = await prisma.lead.findFirst({
          where: { tenantId, email: fromAddr },
          select: { id: true },
        });
        if (lead) leadId = lead.id;
      }

      // Classify if no lead exists yet
      let createdLead = false;
      if (!leadId) {
        const bodyForAnalysis = bodyText || snippet || "";
        const heur = basicHeuristics(bodyForAnalysis);
        let ai: any = null;
        try {
          ai = await extractLeadWithOpenAI(subject, bodyForAnalysis, { snippet, from: String(msg.from?.emailAddress?.name || fromAddr || "") });
        } catch (e: any) {
          console.error("[ms365] openai classification failed:", e?.message || e);
        }

        const aiIsLead =
          typeof ai?.isLead === "string" ? ai.isLead.toLowerCase() === "true" : typeof ai?.isLead === "boolean" ? ai.isLead : null;
        const aiConfidence = typeof ai?.confidence === "number" ? Math.max(0, Math.min(1, Number(ai.confidence))) : null;
        const aiReason = typeof ai?.reason === "string" ? ai.reason : "";
        const noise = looksLikeNoise(subject || "", bodyForAnalysis);
        const subjectLeadSignal = /\b(quote|estimate|enquiry|inquiry|request)\b/i.test(subject || "");

        let decidedBy: "openai" | "heuristics" = ai ? "openai" : "heuristics";
        let isLeadCandidate = false;
        let reason = aiReason;

        if (aiIsLead === true && !noise) {
          if ((aiConfidence ?? 0) >= 0.45 || heuristicsSuggestLead(subject || "", bodyForAnalysis, heur) || subjectLeadSignal) {
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

        if (aiIsLead === null || (aiConfidence ?? 0) < 0.45) {
          if ((heuristicsSuggestLead(subject || "", bodyForAnalysis, heur) || subjectLeadSignal) && !noise) {
            isLeadCandidate = true;
            const heurReason = "Heuristics detected enquiry keywords and contact details";
            reason = reason ? `${reason}; ${heurReason}` : heurReason;
            decidedBy = ai ? "openai" : "heuristics";
          } else if (!reason) {
            reason = "No strong indicators of a customer enquiry";
          }
        }

        // Recall-first mode: if enabled, prefer creating a lead unless clearly noise
        // BUT: Respect confident AI "not a lead" decisions
        if (!isLeadCandidate && recallFirst && !noise) {
          // Don't override AI if it confidently said "not a lead"
          if (aiIsLead === false && (aiConfidence ?? 0) >= 0.7) {
            // AI is confident this is not a lead - respect that decision
            reason = reason ? `${reason}; AI confident not a lead` : "AI confident not a lead";
          } else if (subjectLeadSignal || heuristicsSuggestLead(subject || "", bodyForAnalysis, heur) || (fromAddr && (subject || bodyForAnalysis))) {
            isLeadCandidate = true;
            decidedBy = ai ? "openai" : "heuristics";
            reason = reason ? `${reason}; recall-first enabled` : "recall-first enabled";
          }
        }

        if (noise) {
          isLeadCandidate = false;
          reason = reason ? `${reason} (filtered as newsletter/spam)` : "Filtered as newsletter/spam";
        }

        // Auto-reject confident "not a lead" decisions
        let autoRejected = false;
        if (!isLeadCandidate && aiIsLead === false && (aiConfidence ?? 0) >= 0.8) {
          autoRejected = true;
          
          const contactName =
            (typeof ai?.contactName === "string" && ai.contactName) ||
            heur.contactName ||
            (String(msg.from?.emailAddress?.name || "").trim() || (fromAddr ? fromAddr.split("@")[0] : null));

          const emailCandidate = (typeof ai?.email === "string" && ai.email) || heur.email || fromAddr || null;
          const email = emailCandidate ? String(emailCandidate).toLowerCase() : null;

          const aiDecision: Record<string, any> = {
            decidedBy,
            reason,
            confidence: aiConfidence ?? null,
            model: "openai",
            autoRejected: true,
          };

          const custom: Record<string, any> = {
            provider: "ms365",
            messageId: m.id,
            threadId: thread.threadId,
            subject: subject || null,
            from: fromAddr || null,
            summary: snippet || null,
            uiStatus: "REJECTED",
            aiDecision,
          };

          if (Array.isArray(ai?.tags) && ai.tags.length) custom.tags = ai.tags;

          await prisma.lead.create({
            data: {
              tenantId,
              createdById: userId,
              contactName: contactName || (email ? email.split("@")?.[0] : "Auto-rejected"),
              email,
              description: `Auto-rejected: ${reason}`,
              status: "REJECTED",
              custom,
            },
          });

          await logInsight({
            tenantId,
            module: "email_classifier",
            inputSummary: `ms365:${m.id}`,
            decision: "auto_rejected",
            confidence: aiConfidence,
          });
        }

        if (isLeadCandidate) {
          const contactName =
            (typeof ai?.contactName === "string" && ai.contactName) ||
            heur.contactName ||
            (String(msg.from?.emailAddress?.name || "").trim() || (fromAddr ? fromAddr.split("@")[0] : null));

          const emailCandidate = (typeof ai?.email === "string" && ai.email) || heur.email || fromAddr || null;
          const email = emailCandidate ? String(emailCandidate).toLowerCase() : null;

          const aiDecision: Record<string, any> = {
            decidedBy,
            reason,
            confidence: aiConfidence ?? null,
            model: ai ? "openai" : "heuristics",
          };
          if (noise) (aiDecision as any).noiseFiltered = true;

          const custom: Record<string, any> = {
            provider: "ms365",
            messageId: m.id,
            threadId: thread.threadId,
            subject: subject || null,
            from: fromAddr || null,
            summary: (typeof ai?.summary === "string" && ai.summary) || snippet || null,
            uiStatus: "NEW_ENQUIRY",
            aiDecision,
          };

          const created = await prisma.lead.create({
            data: {
              tenantId,
              createdById: userId,
              contactName: (contactName as string) || (email ? email.split("@")?.[0] : "New Lead"),
              email,
              status: "NEW",
              nextAction: (typeof ai?.nextAction === "string" && ai.nextAction) || "Review enquiry",
              custom,
            },
          });
          leadId = created.id;
          createdLead = true;

          // Persist training example (accepted)
          try {
            await prisma.leadTrainingExample.upsert({
              where: { tenantId_provider_messageId: { tenantId, provider: "ms365", messageId: m.id } as any },
              update: {
                label: "accepted",
                extracted: {
                  subject: subject || undefined,
                  snippet,
                  from: fromAddr || undefined,
                  body: (bodyForAnalysis || "").slice(0, 4000),
                  decidedBy,
                  reason,
                  confidence: aiConfidence ?? null,
                },
              },
              create: {
                tenantId,
                provider: "ms365",
                messageId: m.id,
                label: "accepted",
                extracted: {
                  subject: subject || undefined,
                  snippet,
                  from: fromAddr || undefined,
                  body: (bodyForAnalysis || "").slice(0, 4000),
                  decidedBy,
                  reason,
                  confidence: aiConfidence ?? null,
                },
              },
            } as any);
          } catch (e) {
            console.warn("[ms365] training example upsert failed:", (e as any)?.message || e);
          }

          // Log training insight (accepted)
          try {
            await logInsight({ tenantId, module: "lead_classifier", inputSummary: `email:ms365:${m.id}`, decision: "accepted", confidence: aiConfidence ?? null });
          } catch (e) {
            console.warn("[ms365] logInsight accepted failed:", (e as any)?.message || e);
          }

          // Post-classification side-effects: move to Enquiries folder
          try {
            const { postClassifySideEffects } = await import("../services/inboxFiling");
            await postClassifySideEffects({ tenantId, provider: "ms365", messageId: m.id, decision: "accepted", score: aiConfidence ?? null });
          } catch (e) {
            console.warn("[ms365] postClassifySideEffects failed:", (e as any)?.message || e);
          }
        } else {
          // Persist training example (rejected)
          try {
            await prisma.leadTrainingExample.upsert({
              where: { tenantId_provider_messageId: { tenantId, provider: "ms365", messageId: m.id } as any },
              update: {
                label: "rejected",
                extracted: {
                  subject: subject || undefined,
                  snippet,
                  from: fromAddr || undefined,
                  body: (bodyForAnalysis || "").slice(0, 4000),
                  reason: aiReason || undefined,
                  confidence: aiConfidence ?? null,
                },
              },
              create: {
                tenantId,
                provider: "ms365",
                messageId: m.id,
                label: "rejected",
                extracted: {
                  subject: subject || undefined,
                  snippet,
                  from: fromAddr || undefined,
                  body: (bodyForAnalysis || "").slice(0, 4000),
                  reason: aiReason || undefined,
                  confidence: aiConfidence ?? null,
                },
              },
            } as any);
          } catch (e) {
            console.warn("[ms365] training example upsert failed:", (e as any)?.message || e);
          }

          // Log training insight (rejected)
          try {
            await logInsight({ tenantId, module: "lead_classifier", inputSummary: `email:ms365:${m.id}`, decision: "rejected", confidence: aiConfidence ?? null });
          } catch (e) {
            console.warn("[ms365] logInsight rejected failed:", (e as any)?.message || e);
          }
        }
      }

      // Link thread to lead if now available
      if (leadId && !thread.leadId) {
        await prisma.emailThread.update({ where: { id: thread.id }, data: { leadId } });
      }

      // Upsert EmailMessage (inbound)
      try {
        await prisma.emailMessage.upsert({
          where: {
            tenantId_provider_messageId: { tenantId, provider: "ms365", messageId: m.id },
          },
          update: {
            threadId: thread.id,
            fromEmail: fromAddr,
            toEmail: allRcpts.length ? allRcpts.join(", ") : null,
            subject: subject || null,
            snippet: snippet || null,
            bodyText: bodyText || null,
            sentAt: received,
            leadId: leadId || null,
          },
          create: {
            tenantId,
            provider: "ms365",
            messageId: m.id,
            threadId: thread.id,
            direction: "inbound",
            fromEmail: fromAddr,
            toEmail: allRcpts.length ? allRcpts.join(", ") : null,
            subject: subject || null,
            snippet: snippet || null,
            bodyText: bodyText || null,
            sentAt: received,
            leadId: leadId || null,
          },
        });
      } catch {}

      // Touch thread timestamps
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { lastInboundAt: new Date(), updatedAt: new Date(), ...(subject ? { subject } : {}) },
      });

      // Update EmailIngest legacy row
      try {
        await prisma.emailIngest.update({
          where: { tenantId_provider_messageId: { tenantId, provider: "ms365", messageId: m.id } },
          data: {
            processedAt: new Date(),
            leadId: leadId || null,
            subject,
            fromEmail: fromAddr || undefined,
            snippet,
          } as any,
        });
      } catch {}

      results.push({ id: m.id, threadId: thread.threadId, linkedLeadId: leadId || null, createdLead, indexed: createdIngest });
    }

    return res.json({ ok: true, imported: results });
  } catch (e: any) {
    console.error("[ms365] import failed:", e);
    return res.status(500).json({ error: e?.message || "import failed" });
  }
});