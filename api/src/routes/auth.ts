import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { env } from "../env";
import { normalizeEmail } from "../lib/email";

const router = Router();

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
if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY env for auth routes");
}
const stripe = new Stripe(STRIPE_SECRET_KEY);

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
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["customer"] });

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
    tenant = await prisma.tenant.create({
      data: {
        name: company || customerEmail || `Tenant ${session.id}`,
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

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(passwordString, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

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
    if (!tenant) tenant = await prisma.tenant.create({ data: { name: company } });

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
  const auth = (req as any).auth;
  if (!auth?.userId) return res.status(401).json({ error: "unauthorized" });

  try {
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
    if (!user) return res.status(404).json({ error: "not_found" });

    const { firstName, lastName } = splitName(user.name);
    return res.json({ ...user, firstName, lastName });
  } catch (e: any) {
    console.error("[auth/me] failed:", e);
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

export default router;