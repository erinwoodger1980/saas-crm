import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env"; // ← use the same env wrapper as server.ts
import { normalizeEmail } from "../lib/email";
import { clearAuthCookie, setAuthCookie } from "../lib/auth-cookie";

const router = Router();

// use the SAME secret as the JWT middleware in server.ts
const JWT_SECRET = env.APP_JWT_SECRET;

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
 * returns: { token, user } (also returns legacy `jwt` alias)
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

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "12h" });
    setAuthCookie(res, token);

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
      token,
      jwt: token, // keep legacy key for existing clients
      user: responseUser,
    });
  } catch (e: any) {
    console.error("[auth/login] failed:", e);
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
    setAuthCookie(res, token);

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

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
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