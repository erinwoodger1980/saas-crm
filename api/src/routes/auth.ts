import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env"; // ← use the same env wrapper as server.ts

const router = Router();

// use the SAME secret as the JWT middleware in server.ts
const JWT_SECRET = env.APP_JWT_SECRET;

/**
 * POST /auth/login
 * body: { email, password }
 * returns: { user, jwt }
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = (req.body || {}) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    // you can also drop it in a cookie if you want
    // res.cookie("jwt", token, { httpOnly: false, sameSite: "lax", secure: true });

    return res.json({
      user: { id: user.id, email: user.email, tenantId: user.tenantId, role: user.role },
      jwt: token,
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
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash("secret12", 10);
      user = await prisma.user.create({
        data: { email, passwordHash, tenantId: tenant.id, role: "owner" },
      });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({ ok: true, tenantId: tenant.id, userId: user.id, email, jwt: token });
  } catch (e: any) {
    console.error("[auth/dev-seed] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;