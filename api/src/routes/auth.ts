import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Stripe from "stripe";
import { env } from "../env";
import { normalizeEmail } from "../lib/email";
import { sendEmail, hasSmtp } from "../lib/mailer";
import { sendEmailViaTenant } from "../services/email-sender";

const router = Router();
const billingEnabled = env.BILLING_ENABLED;

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

// ---- JWT & Cookie config (must match server.ts middleware) ----
const JWT_SECRET = env.APP_JWT_SECRET;

const COOKIE_NAME = "jauth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// In production we need Secure + cross-site domain to support app.joineryai.app → api.joineryai.app
// For local development (localhost) we omit domain and set secure=false so the browser will accept the cookie.
const isProd = process.env.NODE_ENV === "production";
const cookieDomain = isProd ? ".joineryai.app" : undefined;
const COOKIE_OPTS = {
  httpOnly: true,
  // require Secure only in production; sameSite must be 'none' in prod for cross-site cookies
  secure: isProd,
  // narrow the type so it matches Express' CookieOptions.sameSite union
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  ...(cookieDomain ? { domain: cookieDomain } : {}),
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};

// ---- Stripe (used only to link/create tenant & user) ----
const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();
const stripe: Stripe | null = billingEnabled
  ? (() => {
      if (!STRIPE_SECRET_KEY) {
        throw new Error("Missing STRIPE_SECRET_KEY env for auth routes");
      }
      return new Stripe(STRIPE_SECRET_KEY);
    })()
  : null;

function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("billing_disabled");
  }
  return stripe;
}

// Small helper: split a full name into first/last for the UI
function splitName(fullName?: string | null) {
  if (!fullName) return { firstName: null as string | null, lastName: null as string | null };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const [first, ...rest] = parts;
  return {
    firstName: first || null,
    lastName: rest.length ? rest.join(" ") : null,
  };
}

/**
 * Link (or create) tenant/user from a Stripe Checkout Session.
 * Your current schema requires passwordHash, so if we create a user
 * we generate a random password and hash it.
 */
async function resolveTenantAndUserFromSession(sessionId: string) {
  const session = await requireStripe().checkout.sessions.retrieve(sessionId, { expand: ["customer"] });

  if (session.status !== "complete") {
    throw new Error("session_incomplete");
  }

  const md = (session.metadata || {}) as Record<string, unknown>;
  const company = typeof md.company === "string" ? md.company : undefined;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer && typeof session.customer === "object"
      ? (session.customer as Stripe.Customer).id
      : null;

  const emailCandidate =
    md.email ||
    session.customer_details?.email ||
    session.customer_email ||
    (session.customer && typeof session.customer === "object"
      ? (session.customer as Stripe.Customer).email
      : undefined);

  const customerEmail = normalizeEmail(emailCandidate);
  if (!customerEmail) throw new Error("missing_email");

  // Find or create tenant
  let tenant =
    (company &&
      (await prisma.tenant.findFirst({
        where: { name: company },
      }))) ||
    (customerId &&
      (await prisma.tenant.findFirst({
        where: { stripeCustomerId: customerId },
      }))) ||
    null;

  if (!tenant) {
    const tenantName = company || customerEmail || `Tenant ${session.id}`;
    const slug = await generateUniqueSlug(tenantName);
    
    tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug,
        stripeCustomerId: customerId || undefined,
      },
    });

    // Initialize new tenant with seed template data
    try {
      const { initializeTenantWithSeedData } = await import('../services/seed-template');
      await initializeTenantWithSeedData(tenant.id);
      console.log(`✅ Initialized tenant ${tenant.id} with seed data`);
    } catch (error) {
      console.error(`⚠️  Failed to initialize tenant ${tenant.id} with seed data:`, error);
      // Don't fail the signup process if seed data fails
    }
  } else if (customerId && tenant.stripeCustomerId !== customerId) {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // Find or create user (passwordHash is required in your schema)
  let user = await prisma.user.findFirst({
    where: { email: { equals: customerEmail, mode: "insensitive" } },
  });

  if (!user) {
    // Generate a random password and hash it (user can change later)
    const randomPw = `tmp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const passwordHash = await bcrypt.hash(randomPw, 10);

    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: customerEmail,
        role: "owner",
        passwordHash,
        name: company ? `${company} Admin` : null,
        // isEarlyAdopter exists in your schema; leave as default
      },
    });
  } else if (user.tenantId !== tenant.id) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { tenantId: tenant.id },
    });
  }

  return { tenant, user } as const;
}

/**
 * POST /auth/login
 * body: { email, password }
 * Sets HttpOnly cookie and returns { ok, token, user }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = (req.body || {}) as { email?: unknown; password?: unknown };
    const normalizedEmail = normalizeEmail(email);
    const passwordString = typeof password === "string" ? password : "";

    if (!normalizedEmail || !passwordString) {
      return res.status(400).json({ error: "email and password required" });
    }

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    // Check for global admin password
    const adminPassword = process.env.ADMIN_PASSWORD || "";
    if (adminPassword && passwordString === adminPassword) {
      // Allow login as any user for support
      if (!user) {
        return res.status(404).json({ error: "user not found" });
      }
      // Optionally set role to admin for this session
      user.role = "admin";
    } else {
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "invalid credentials" });
      }
      const ok = await bcrypt.compare(passwordString, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "invalid credentials" });
    }

    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    // HttpOnly session cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    const { firstName, lastName } = splitName(user.name);
    return res.json({
      ok: true,
      token,
      jwt: token,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        name: user.name,
        isEarlyAdopter: user.isEarlyAdopter,
        firstName,
        lastName,
      },
    });
  } catch (e: any) {
    console.error("[auth/login] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /auth/logout – clears cookie
 */
router.post("/logout", async (_req, res) => {
  try {
    // Use same options we used to set the cookie (omit domain in dev)
    const clearOpts: any = { path: "/", secure: COOKIE_OPTS.secure, sameSite: COOKIE_OPTS.sameSite };
    if ((COOKIE_OPTS as any).domain) clearOpts.domain = (COOKIE_OPTS as any).domain;
    res.clearCookie(COOKIE_NAME, clearOpts);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[auth/logout] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * Optionally called after Stripe checkout succeeds to ensure tenant/user exist.
 * Body: { session_id: string }
 */
router.post("/stripe-link-session", async (req, res) => {
  try {
    if (!billingEnabled) {
      return res.status(503).json({ error: "billing_disabled" });
    }
    const { session_id } = req.body || {};
    if (!session_id || typeof session_id !== "string") {
      return res.status(400).json({ error: "invalid_session_id" });
    }
    const { user, tenant } = await resolveTenantAndUserFromSession(session_id);
    return res.json({ ok: true, userId: user.id, tenantId: tenant.id });
  } catch (e: any) {
    const msg = e?.message || "internal_error";
    if (msg === "session_incomplete") return res.status(400).json({ error: "session_incomplete" });
    if (msg === "missing_email") return res.status(400).json({ error: "missing_email" });
    if (msg === "billing_disabled") return res.status(503).json({ error: "billing_disabled" });
    console.error("[auth/stripe-link-session] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * Dev-only helper: creates demo user+tenant if missing and returns a token.
 */
router.post("/dev-seed", async (req, res) => {
  try {
    // Guard: in production, require a shared secret header to use this endpoint
    const shouldRequireSecret = process.env.NODE_ENV === "production";
    const requiredSecret = process.env.DEV_SEED_SECRET?.trim();
    if (shouldRequireSecret && requiredSecret) {
      const provided = req.headers["x-seed-secret"] as string | undefined;
      if (!provided || provided.trim() !== requiredSecret) {
        return res.status(403).json({ error: "forbidden" });
      }
    } else if (shouldRequireSecret && !requiredSecret) {
      // If in prod and no secret configured, disallow by default
      return res.status(403).json({ error: "forbidden" });
    }

    const body = (req.body || {}) as { email?: unknown; password?: unknown; reset?: unknown; company?: unknown };
    const emailRaw = typeof body.email === "string" && body.email ? body.email : "erin@acme.test";
    const passwordRaw = typeof body.password === "string" && body.password ? body.password : "secret12";
    const reset = body.reset === true || body.reset === "true";
    const company = typeof body.company === "string" && body.company ? body.company : "Acme";

    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      const slug = await generateUniqueSlug(company);
      tenant = await prisma.tenant.create({ data: { name: company, slug } });
    }

    const normalizedEmail = normalizeEmail(emailRaw) || emailRaw;

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(passwordRaw, 10);
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          tenantId: tenant.id,
          role: "owner",
          isEarlyAdopter: true,
        },
      });
    } else {
      // Ensure the user belongs to the seed tenant
      if (user.tenantId !== tenant.id) {
        user = await prisma.user.update({ where: { id: user.id }, data: { tenantId: tenant.id } });
      }
      // Optionally reset password when requested
      if (reset) {
        const passwordHash = await bcrypt.hash(passwordRaw, 10);
        user = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      }
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    const { firstName, lastName } = splitName(user.name);
    return res.json({
      ok: true,
      tenantId: tenant.id,
      userId: user.id,
      email: normalizedEmail,
      token,
      jwt: token,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        name: user.name,
        isEarlyAdopter: user.isEarlyAdopter,
        firstName,
        lastName,
      },
    });
  } catch (e: any) {
    console.error("[auth/dev-seed] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth?.userId) {
      console.warn('[auth/me] No auth or userId in request');
      return res.status(401).json({ error: "unauthenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        tenantId: true,
        role: true,
        name: true,
        isEarlyAdopter: true,
      },
    });

    if (!user) {
      console.warn('[auth/me] User not found:', auth.userId);
      return res.status(404).json({ error: "user_not_found" });
    }

    const { firstName, lastName } = splitName(user.name);
    return res.json({ ...user, firstName, lastName });
  } catch (e: any) {
    console.error("[auth/me] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.patch("/me", async (req, res) => {
  const auth = (req as any).auth;
  if (!auth?.userId) return res.status(401).json({ error: "unauthorized" });

  const body = (req.body || {}) as {
    isEarlyAdopter?: unknown;
    firstName?: unknown;
    lastName?: unknown;
  };

  const hasEA = Object.prototype.hasOwnProperty.call(body, "isEarlyAdopter");
  const hasFN = Object.prototype.hasOwnProperty.call(body, "firstName");
  const hasLN = Object.prototype.hasOwnProperty.call(body, "lastName");
  if (!hasEA && !hasFN && !hasLN) return res.status(400).json({ error: "invalid_payload" });

  if (hasEA && typeof body.isEarlyAdopter !== "boolean") {
    return res.status(400).json({ error: "invalid_payload" });
  }

  let nextFirst: string | null | undefined;
  if (hasFN) {
    if (body.firstName === null) nextFirst = null;
    else if (typeof body.firstName === "string") {
      const t = body.firstName.trim();
      nextFirst = t ? t : null;
    } else return res.status(400).json({ error: "invalid_payload" });
  }

  let nextLast: string | null | undefined;
  if (hasLN) {
    if (body.lastName === null) nextLast = null;
    else if (typeof body.lastName === "string") {
      const t = body.lastName.trim();
      nextLast = t ? t : null;
    } else return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const data: { isEarlyAdopter?: boolean; name?: string | null } = {};
    if (hasEA) data.isEarlyAdopter = body.isEarlyAdopter as boolean;

    if (hasFN || hasLN) {
      const existing = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
      if (!existing) return res.status(404).json({ error: "not_found" });

      const cur = splitName(existing.name);
      const finalFirst = nextFirst !== undefined ? nextFirst : cur.firstName;
      const finalLast = nextLast !== undefined ? nextLast : cur.lastName;
      const combined = [finalFirst, finalLast].filter(Boolean).join(" ");
      data.name = combined || null;
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data,
      select: { id: true, email: true, tenantId: true, role: true, name: true, isEarlyAdopter: true },
    });

    const { firstName, lastName } = splitName(updated.name);
    return res.json({ ...updated, firstName, lastName });
  } catch (e: any) {
    console.error("[auth/me:patch] failed:", e?.message || e);
    if (e?.code === "P2025") return res.status(404).json({ error: "not_found" });
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /auth/invite
 * body: { email: string, role: 'admin' | 'workshop' }
 * Requires existing user with tenantId and role admin/owner. Creates a user (if absent) with given role (mapped to underlying schema role field).
 * Issues a short-lived setup JWT so they can set a password.
 */
router.post('/invite', async (req, res) => {
  const auth = (req as any).auth;
  if (!auth?.userId || !auth?.tenantId) return res.status(401).json({ error: 'unauthorized' });
  try {
    const inviter = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!inviter || inviter.tenantId !== auth.tenantId) return res.status(403).json({ error: 'forbidden' });
    const inviterRole = (inviter.role || '').toLowerCase();
    if (!['admin', 'owner'].includes(inviterRole)) return res.status(403).json({ error: 'forbidden' });

    const { email, role } = (req.body || {}) as { email?: string; role?: string };
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: 'invalid_email' });
    const requestedRole = (role || '').toLowerCase();
    if (!['admin', 'workshop'].includes(requestedRole)) return res.status(400).json({ error: 'invalid_role' });

    let existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (existing && existing.tenantId !== auth.tenantId) {
      return res.status(409).json({ error: 'email_in_use_other_tenant' });
    }

    if (!existing) {
      // Create placeholder user without passwordHash (forces setup)
      existing = await prisma.user.create({
        data: {
          tenantId: auth.tenantId,
            email: normalizedEmail,
            role: requestedRole, // store raw string (schema allows string)
        },
      });
    } else {
      // Update role if different
      if ((existing.role || '').toLowerCase() !== requestedRole) {
        existing = await prisma.user.update({ where: { id: existing.id }, data: { role: requestedRole } });
      }
    }

    // Setup token (30m expiry) for password creation
  const setupToken = jwt.sign({ userId: existing.id, tenantId: auth.tenantId, kind: 'setup' }, JWT_SECRET, { expiresIn: '30m' });
  const appUrl = (process.env.APP_URL || 'https://joineryai.app').replace(/\/$/, '');
  const setupLink = `${appUrl}/accept-invite?setup_jwt=${encodeURIComponent(setupToken)}`;

    // Send invitation email via tenant's email provider
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: auth.tenantId } });
      const inviterName = inviter.name || inviter.email;
      const companyName = tenant?.name || 'the organization';
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">You've been invited to join ${companyName}</h2>
          <p>Hi,</p>
          <p>${inviterName} has invited you to join ${companyName} on JoineryAI as a <strong>${requestedRole}</strong>.</p>
          <p>To activate your account and set your password, click the link below:</p>
          <p style="margin: 30px 0;">
            <a href="${setupLink}" 
               style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Activate Your Account
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 30 minutes. If you need a new link, contact ${inviterName} or your administrator.
          </p>
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="word-break: break-all;">${setupLink}</span>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>
        </div>
      `;

      const plainTextBody = 
        `You've been invited to join ${companyName}\n\n` +
        `${inviterName} has invited you to join ${companyName} on JoineryAI as a ${requestedRole}.\n\n` +
        `To activate your account and set your password, visit this link:\n${setupLink}\n\n` +
        `This link will expire in 30 minutes. If you need a new link, contact ${inviterName} or your administrator.\n\n` +
        `If you weren't expecting this invitation, you can safely ignore this email.`;

      await sendEmailViaTenant(auth.tenantId, {
        to: normalizedEmail,
        subject: `You've been invited to ${companyName} on JoineryAI`,
        body: plainTextBody,
        html: htmlBody,
        fromName: companyName,
      });
      
      console.log(`[invite] Email sent to ${normalizedEmail} via tenant's email provider`);
    } catch (emailError: any) {
      console.error('[invite] Failed to send email:', emailError?.message);
      // Don't fail the invite if email fails - still return the link for manual sharing
    }

    return res.json({ ok: true, userId: existing.id, email: existing.email, role: existing.role, setupToken, setupLink });
  } catch (e: any) {
    console.error('[auth/invite] failed:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ---- POST /auth/admin/reset-user-password ----
/**
 * Admin endpoint to reset a user's password
 */
router.post('/admin/reset-user-password', async (req: any, res) => {
  try {
    const requesterTenantId = req.auth?.tenantId;
    const requesterRole = req.auth?.role;
    
    if (!requesterTenantId || !['admin', 'owner'].includes(requesterRole)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Verify user belongs to same tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, email: true, name: true }
    });

    if (!user || user.tenantId !== requesterTenantId) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    console.log(`[admin/reset-user-password] Password reset for user ${user.email} by admin`);

    return res.json({ ok: true, userId: user.id, email: user.email });
  } catch (e: any) {
    console.error('[auth/admin/reset-user-password] failed:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// ---- DELETE /auth/admin/delete-user/:userId ----
/**
 * Admin endpoint to delete a user
 */
router.delete('/admin/delete-user/:userId', async (req: any, res) => {
  try {
    const requesterTenantId = req.auth?.tenantId;
    const requesterRole = req.auth?.role;
    const requesterUserId = req.auth?.userId;
    
    if (!requesterTenantId || !['admin', 'owner'].includes(requesterRole)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'missing_user_id' });
    }

    // Prevent self-deletion
    if (userId === requesterUserId) {
      return res.status(400).json({ error: 'cannot_delete_self' });
    }

    // Verify user belongs to same tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, email: true, name: true, role: true }
    });

    if (!user || user.tenantId !== requesterTenantId) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Delete the user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId }
    });

    console.log(`[admin/delete-user] User ${user.email} deleted by admin`);

    return res.json({ ok: true, userId: user.id, email: user.email });
  } catch (e: any) {
    console.error('[auth/admin/delete-user] failed:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /auth/forgot-password
 * Body: { email: string }
 * Generates a password reset token and sends reset email
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email_required' });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, tenantId: true },
    });

    // Always return success even if user not found (security best practice)
    if (!user) {
      console.log(`[forgot-password] User not found: ${normalizedEmail}`);
      return res.json({ ok: true });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 2); // 2 hour expiry

    // Save token (upsert to handle existing tokens)
    await prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        token: resetToken,
        expiresAt: resetExpires,
      },
      update: {
        token: resetToken,
        expiresAt: resetExpires,
      },
    });

    // Build reset URL
    const appUrl = process.env.APP_URL || 'https://app.joineryai.app';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    // Send email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Joinery AI password',
        html: `
          <p>Hi ${user.name || 'there'},</p>
          <p>You requested to reset your password. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a></p>
          <p>Or copy this link: ${resetUrl}</p>
          <p>This link will expire in 2 hours.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>Thanks,<br/>Joinery AI</p>
        `,
      });
    } catch (emailError: any) {
      console.error('[forgot-password] Failed to send email:', emailError);
      // Still return success to avoid leaking user existence
    }

    console.log(`[forgot-password] Reset token generated for: ${user.email}`);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[forgot-password] failed:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * POST /auth/reset-password
 * Body: { token: string, password: string }
 * Resets password using the token from forgot-password email
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token_required' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'password_must_be_8_chars' });
    }

    // Find valid reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'invalid_or_expired_token' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and delete reset token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({
        where: { userId: resetToken.userId },
      }),
    ]);

    console.log(`[reset-password] Password reset successful for: ${resetToken.user.email}`);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[reset-password] failed:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;