// api/src/routes/auth.ts
import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { env } from "../env"; // ← use the same env wrapper as server.ts
import { normalizeEmail } from "../lib/email";
import { generateSignupToken, signupTokenExpiresAt, hashPassword } from "../lib/crypto";

const router = Router();

// JWT secret must match server.ts middleware
const JWT_SECRET = env.APP_JWT_SECRET;

// Cookie constants
const COOKIE_NAME = "jauth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d
const COOKIE_OPTS = {
  httpOnly: true as const,
  secure: true as const,           // required with SameSite=None
  sameSite: "none" as const,       // allow cross-site (web <-> api subdomains)
  domain: ".joineryai.app",        // works for root + subdomains
  path: "/" as const,
  maxAge: COOKIE_MAX_AGE,
};

const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();
if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY env for auth routes");
}
const stripe = new Stripe(STRIPE_SECRET_KEY);

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 5;
const issueSignupRate = new Map<string, { count: number; resetAt: number }>();

function enforceRateLimit(key: string) {
  const now = Date.now();
  const entry = issueSignupRate.get(key);
  if (!entry || entry.resetAt <= now) {
    issueSignupRate.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    throw new Error("rate_limited");
  }
  entry.count += 1;
}

async function resolveTenantAndUserFromSession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["customer"] });

  if (session.status !== "complete") {
    throw new Error("session_incomplete");
  }

  const metadata = (session.metadata || {}) as Record<string, unknown>;
  const metadataTenantId = typeof metadata.tenantId === "string" ? metadata.tenantId : undefined;
  const metadataUserId = typeof metadata.userId === "string" ? metadata.userId : undefined;
  const metadataCompany = typeof metadata.company === "string" ? metadata.company : undefined;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer && typeof session.customer === "object"
      ? (session.customer as Stripe.Customer).id
      : null;

  const emailCandidate =
    metadata.email ||
    session.customer_details?.email ||
    session.customer_email ||
    (session.customer && typeof session.customer === "object"
      ? (session.customer as Stripe.Customer).email
      : undefined);

  const customerEmail = normalizeEmail(emailCandidate);

  let tenant = metadataTenantId
    ? await prisma.tenant.findUnique({ where: { id: metadataTenantId } })
    : null;

  if (!tenant && metadataCompany) {
    tenant = await prisma.tenant.findFirst({ where: { name: metadataCompany } });
  }

  if (!tenant && customerId) {
    tenant = await prisma.tenant.findFirst({ where: { stripeCustomerId: customerId } });
  }

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: metadataCompany || customerEmail || `Tenant ${session.id}`,
        stripeCustomerId: customerId || undefined,
      },
    });
  } else if (customerId && tenant.stripeCustomerId !== customerId) {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: customerId },
    });
  }

  let user = metadataUserId
    ? await prisma.user.findUnique({ where: { id: metadataUserId } })
    : null;

  if (!user && customerEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: customerEmail, mode: "insensitive" } },
    });
  }

  if (!user) {
    if (!customerEmail) {
      throw new Error("missing_email");
    }
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: customerEmail,
        role: "owner",
        passwordHash: null,
        signupCompleted: false,
        name: metadataCompany ? `${metadataCompany} Admin` : null,
      },
    });
  }

  if (user.tenantId !== tenant.id) {
    user = await prisma.user.update({ where: { id: user.id }, data: { tenantId: tenant.id } });
  }

  if (user.signupCompleted && user.passwordHash) {
    return { tenant, user, alreadyCompleted: true } as const;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { signupCompleted: false, passwordHash: user.passwordHash ?? null },
  });

  return { tenant, user, alreadyCompleted: false, session, customerEmail } as const;
}

function splitName(fullName?: string | null) {
  if (!fullName) return { firstName: null as string | null, lastName: null as string | null };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null as string | null, lastName: null as string | null };
  const [first, ...rest] = parts;
  return {
    firstName: first || null,
    lastName: rest.length ? rest.join(" ") : null,
  };
}

/**
 * POST /auth/login
 * body: { email, password }
 * returns: { ok, token, user } and sets HttpOnly cookie
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = (req.body || {}) as {
      email?: unknown;
      password?: unknown;
    };

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

    // ✅ Set HttpOnly cookie for browser session
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    const { firstName, lastName } = splitName(user.name);
    const responseUser = {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      isEarlyAdopter: user.isEarlyAdopter,
      firstName,
      lastName,
    };

    return res.json({
      ok: true,
      token,       // legacy
      jwt: token,  // legacy alias
      user: responseUser,
    });
  } catch (e: any) {
    console.error("[auth/login] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /auth/logout
 * Clears the auth cookie
 */
router.post("/logout", async (_req, res) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      domain: ".joineryai.app",
      path: "/",
      secure: true,
      sameSite: "none",
    });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[auth/logout] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/issue-signup-token", async (req, res) => {
  try {
    const ip = (req.ip || req.headers["x-forwarded-for"] || "unknown").toString();
    try {
      enforceRateLimit(ip);
    } catch {
      return res.status(429).json({ error: "rate_limited" });
    }

    const { session_id } = req.body || {};
    if (!session_id || typeof session_id !== "string") {
      return res.status(400).json({ error: "invalid_session_id" });
    }

    const { user, alreadyCompleted } = await resolveTenantAndUserFromSession(session_id);

    if (alreadyCompleted) {
      return res.status(400).json({ error: "signup_already_completed" });
    }

    await prisma.signupToken.deleteMany({ where: { userId: user.id } });
    const token = generateSignupToken();
    const expiresAt = signupTokenExpiresAt();
    await prisma.signupToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    return res.json({ token });
  } catch (e: any) {
    const message = e?.message || "internal_error";
    if (message === "session_incomplete") {
      return res.status(400).json({ error: "session_incomplete" });
    }
    if (message === "missing_email") {
      return res.status(400).json({ error: "missing_email" });
    }
    if (e?.raw?.code === "resource_missing" || e?.statusCode === 404) {
      return res.status(400).json({ error: "invalid_session_id" });
    }
    console.error("[auth/issue-signup-token] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/set-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "invalid_token" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "password_too_short" });
    }

    const signupToken = await prisma.signupToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!signupToken || !signupToken.user) {
      return res.status(400).json({ error: "token_invalid" });
    }

    if (signupToken.consumedAt) {
      return res.status(400).json({ error: "token_consumed" });
    }

    if (signupToken.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "token_expired" });
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: signupToken.userId },
        data: { passwordHash, signupCompleted: true },
      }),
      prisma.signupToken.update({
        where: { token },
        data: { consumedAt: new Date() },
      }),
      prisma.signupToken.deleteMany({
        where: { userId: signupToken.userId, token: { not: token } },
      }),
    ]);

    const loginJwt = jwt.sign(
      {
        userId: signupToken.user.id,
        tenantId: signupToken.user.tenantId,
        email: signupToken.user.email,
        role: signupToken.user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Set the same HttpOnly cookie after completing signup
    res.cookie(COOKIE_NAME, loginJwt, COOKIE_OPTS);

    return res.json({ ok: true, jwt: loginJwt });
  } catch (e: any) {
    console.error("[auth/set-password] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /auth/dev-seed  (local helper)
 */
router.post("/dev-seed", async (_req, res) => {
  try {
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) tenant = await prisma.tenant.create({ data: { name: "Acme" } });

    const email = "erin@acme.test";
    const normalizedEmail = normalizeEmail(email) || email;
    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (!user) {
      const passwordHash = await bcrypt.hash("secret12", 10);
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          tenantId: tenant.id,
          role: "owner",
          isEarlyAdopter: true,
          signupCompleted: true,
        },
      });
    }

    const tokenPayload = {
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "12h" });

    const { firstName, lastName } = splitName(user.name);

    return res.json({
      ok: true,
      tenantId: tenant.id,
      userId: user.id,
      email,
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
  if (!auth?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

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

    if (!user) {
      return res.status(404).json({ error: "not_found" });
    }

    const { firstName, lastName } = splitName(user.name);

    return res.json({
      ...user,
      firstName,
      lastName,
    });
  } catch (e: any) {
    console.error("[auth/me] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.patch("/me", async (req, res) => {
  const auth = (req as any).auth;
  if (!auth?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const body = (req.body || {}) as {
    isEarlyAdopter?: unknown;
    firstName?: unknown;
    lastName?: unknown;
  };

  const hasEarlyAccessUpdate = Object.prototype.hasOwnProperty.call(body, "isEarlyAdopter");
  const hasFirstNameUpdate = Object.prototype.hasOwnProperty.call(body, "firstName");
  const hasLastNameUpdate = Object.prototype.hasOwnProperty.call(body, "lastName");

  if (!hasEarlyAccessUpdate && !hasFirstNameUpdate && !hasLastNameUpdate) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  if (hasEarlyAccessUpdate && typeof body.isEarlyAdopter !== "boolean") {
    return res.status(400).json({ error: "invalid_payload" });
  }

  let nextFirstName: string | null | undefined;
  if (hasFirstNameUpdate) {
    if (body.firstName === null) {
      nextFirstName = null;
    } else if (typeof body.firstName === "string") {
      const trimmed = body.firstName.trim();
      nextFirstName = trimmed ? trimmed : null;
    } else {
      return res.status(400).json({ error: "invalid_payload" });
    }
  }

  let nextLastName: string | null | undefined;
  if (hasLastNameUpdate) {
    if (body.lastName === null) {
      nextLastName = null;
    } else if (typeof body.lastName === "string") {
      const trimmed = body.lastName.trim();
      nextLastName = trimmed ? trimmed : null;
    } else {
      return res.status(400).json({ error: "invalid_payload" });
    }
  }

  try {
    const data: { isEarlyAdopter?: boolean; name?: string | null } = {};

    if (hasEarlyAccessUpdate) {
      data.isEarlyAdopter = body.isEarlyAdopter as boolean;
    }

    if (hasFirstNameUpdate || hasLastNameUpdate) {
      const existing = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true },
      });

      if (!existing) {
        return res.status(404).json({ error: "not_found" });
      }

      const currentParts = splitName(existing.name);
      const finalFirst = nextFirstName !== undefined ? nextFirstName : currentParts.firstName;
      const finalLast = nextLastName !== undefined ? nextLastName : currentParts.lastName;
      const combined = [finalFirst, finalLast].filter(Boolean).join(" ");
      data.name = combined ? combined : null;
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data,
      select: {
        id: true,
        email: true,
        tenantId: true,
        role: true,
        name: true,
        isEarlyAdopter: true,
      },
    });

    const { firstName, lastName } = splitName(updated.name);

    return res.json({
      ...updated,
      firstName,
      lastName,
    });
  } catch (e: any) {
    console.error("[auth/me:patch] failed:", e?.message || e);
    if (e?.code === "P2025") return res.status(404).json({ error: "not_found" });
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;