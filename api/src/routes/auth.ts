import { Router } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) return res.status(401).json({ error: "invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  const token = jwt.sign(
    { userId: user.id, tenantId: user.tenantId, email: user.email },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({ user: { id: user.id, email: user.email }, jwt: token });
});

// Dev helper to seed a user locally
router.post("/dev-seed", async (_req, res) => {
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) tenant = await prisma.tenant.create({ data: { name: "Acme" } });

  const email = "erin@acme.test";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash("secret12", 10);
    user = await prisma.user.create({ data: { email, passwordHash, tenantId: tenant.id } });
  }

  res.json({ ok: true, tenantId: tenant.id, userId: user.id, email });
});

export default router;
