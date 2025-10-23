// api/src/routes/ms365.ts
import { Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../prisma";
import { env } from "../env";
import { normalizeEmail } from "../lib/email";

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