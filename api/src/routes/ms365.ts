// api/src/routes/ms365.ts
import { Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../prisma";
import { env } from "../env";
import { normalizeEmail } from "../lib/email";
import { getAccessTokenForTenant, getAttachment } from "../services/ms365";

const router = Router();

/**
 * Build the Microsoft authorization URL
 */
router.get("/ms365/login", (_req, res) => {
  const tenantSegment = process.env.MS365_TENANT || "common";

  // URLSearchParams expects a space-separated string for scope
  const scopes =
    process.env.MS365_SCOPES ||
    "offline_access Mail.Read User.Read";

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
      msTenant = await prisma.tenant.create({ data: { name: TENANT_NAME } });
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
          signupCompleted: true,
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