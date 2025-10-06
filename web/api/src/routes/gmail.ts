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

/* --------------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------------*/
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

async function getMessagePlainText(accessToken: string, id: string) {
  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const msg = await msgRes.json();
  if (!msgRes.ok) throw new Error(msg?.error?.message || "gmail message fetch failed");

  const headers = msg.payload?.headers || [];
  const subject = pickHeader(headers, "Subject");
  const from = pickHeader(headers, "From");

  let body = "";
  const walk = (p: any) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) {
      body += decodeMimeStr(p.body.data) + "\n";
    }
    if (p.parts) p.parts.forEach(walk);
  };
  walk(msg.payload);
  if (!body && msg.payload?.body?.data) body = decodeMimeStr(msg.payload.body.data);

  return { id, subject, from, snippet: msg.snippet || "", body: body.trim() };
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

/* --------------------------------------------------------------------------------
 * GET /gmail/connection — current Gmail connection
 * ------------------------------------------------------------------------------*/
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

/* --------------------------------------------------------------------------------
 * GET /gmail/connect — start OAuth (supports ?jwt= for dev)
 * ------------------------------------------------------------------------------*/
router.get("/connect", (req, res) => {
  // Optional dev helper: allow ?jwt= to synthesize req.auth for a direct browser hit
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

  const clientId = env.GMAIL_CLIENT_ID;
  const redirectUri = env.GMAIL_REDIRECT_URI || "http://localhost:4000/gmail/oauth/callback";

  if (!clientId) {
    return res
      .status(500)
      .send("GMAIL_CLIENT_ID missing in api/.env (restart server after setting it).");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"].join(" "),
    state: JSON.stringify({ tenantId, userId }),
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(302, url);
});

/* --------------------------------------------------------------------------------
 * GET /gmail/oauth/callback — exchange code for tokens & store refresh_token
 * ------------------------------------------------------------------------------*/
router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error) return res.status(400).send(`OAuth error: ${error}`);
  if (!code) return res.status(400).send("Missing ?code from Google");

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
    const payload = JSON.parse(Buffer.from(id_token.split(".")[1], "base64").toString("utf8"));
    gmailAddress = payload.email;
  }
  if (!refresh_token) {
    return res
      .status(400)
      .send("No refresh_token returned. Revoke old access in your Google Account and reconnect.");
  }

  await prisma.gmailTenantConnection.upsert({
    where: { tenantId: parsed.tenantId! },
    update: {
      refreshToken: refresh_token,
      gmailAddress,
      connectedById: parsed.userId ?? null,
    },
    create: {
      tenantId: parsed.tenantId!,
      connectedById: parsed.userId ?? null,
      gmailAddress,
      refreshToken: refresh_token,
    },
  });

  return res.send(`
    <h2>✅ Gmail Connected!</h2>
    <p>Account: ${gmailAddress || "unknown"}</p>
    <p>You can now close this window.</p>
  `);
});

/* --------------------------------------------------------------------------------
 * POST /gmail/import — fetch recent messages, extract leads, create Lead + EmailIngest
 * Body: { max?: number, q?: string }
 * ------------------------------------------------------------------------------*/
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
      // Idempotency: skip if already processed
      const existing = await prisma.emailIngest.findUnique({
        where: { tenantId_provider_messageId: { tenantId, provider: "gmail", messageId: m.id } },
      });
      if (existing?.leadId) {
        results.push({ id: m.id, skipped: true, reason: "already processed" });
        continue;
      }

      const full = await getMessagePlainText(accessToken, m.id);
      const ai = await extractLeadWithOpenAI(full.subject || "", full.body || "");
      const heur = basicHeuristics(full.body || "");

      const isLead =
        ai?.isLead ??
        !!(heur.email || heur.contactName || /quote|estimate|enquiry|inquiry/i.test(full.subject || ""));

      if (!isLead) {
        await prisma.emailIngest.upsert({
          where: { tenantId_provider_messageId: { tenantId, provider: "gmail", messageId: m.id } },
          update: { snippet: full.snippet, subject: full.subject, fromEmail: full.from },
          create: {
            tenantId,
            provider: "gmail",
            messageId: m.id,
            fromEmail: full.from,
            subject: full.subject,
            snippet: full.snippet,
          },
        });
        results.push({ id: m.id, isLead: false });
        continue;
      }

// Prefer body-parsed email (forms) over the From header
const contactName =
  ai?.contactName ||
  heur.contactName ||
  (full.from?.match(/"?([^"<@]+)"?\s*<.*>/)?.[1] || null);

const email =
  ai?.email ||
  heur.email || // ← body first (common for web forms)
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

      await prisma.emailIngest.upsert({
        where: { tenantId_provider_messageId: { tenantId, provider: "gmail", messageId: m.id } },
        update: {
          processedAt: new Date(),
          leadId: lead.id,
          subject: full.subject,
          fromEmail: full.from,
          snippet: full.snippet,
        },
        create: {
          tenantId,
          provider: "gmail",
          messageId: m.id,
          fromEmail: full.from,
          subject: full.subject,
          snippet: full.snippet,
          processedAt: new Date(),
          leadId: lead.id,
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