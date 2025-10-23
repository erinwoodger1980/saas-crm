// api/src/routes/dev-auth.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { setAuthCookie } from "../lib/auth-cookie";

const router = Router();

// POST /auth/dev-login
// Body: { email: "something@acme.test" }
router.post("/dev-login", (req, res) => {
  const email = String(req.body?.email || "").trim();
  if (!email) return res.status(400).json({ error: "email required" });

  const secret = process.env.APP_JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "APP_JWT_SECRET not set on server" });
  }

  // Minimal JWT payload your app can use. Adjust fields if your middleware expects more.
  const token = jwt.sign(
    {
      sub: email,
      email,
      name: email.split("@")[0] || "User",
      tenantId: "dev-tenant",
      roles: ["user"],
    },
    secret,
    { expiresIn: "7d" }
  );

  setAuthCookie(res, token);
  return res.json({ token });
});

export default router;