import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";
import { normalizeEmail } from "../lib/email";
import { sendEmail, hasSmtp } from "../lib/mailer";

const router = Router();

/**
 * POST /auth/setup/complete
 * body: { setup_jwt: string, password: string }
 * - setup_jwt was issued on /public/signup (30m expiry)
 * - sets user's passwordHash and returns a regular login JWT
 */
router.post("/complete", async (req, res) => {
  try {
    const { setup_jwt, password } = req.body || {};
    if (!setup_jwt || !password) {
      return res.status(400).json({ error: "missing_fields" });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(setup_jwt, env.APP_JWT_SECRET);
    } catch (e: any) {
      return res.status(401).json({ error: "invalid_or_expired_setup_token" });
    }

    const { userId, tenantId } = decoded || {};
    if (!userId || !tenantId) return res.status(400).json({ error: "invalid_setup_token" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "user_not_found" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    const loginPayload = {
      userId: user.id,
      tenantId,
      email: user.email,
      role: user.role,
    };
    const loginJwt = jwt.sign(loginPayload, env.APP_JWT_SECRET, {
      expiresIn: "12h",
    });

    // cookie is optional — the web app stores it in localStorage too
    res.cookie("jwt", loginJwt, {
      httpOnly: false,
      sameSite: "lax",
      secure: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ token: loginJwt, jwt: loginJwt });
  } catch (e: any) {
    console.error("[auth/setup/complete]", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /auth/setup/request-reset
 * body: { email: string }
 * - issues a short-lived reset token (email-sending is a stub here)
 */
router.post("/request-reset", async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: "missing_email" });

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    // reply 200 even if not found (don’t leak)
    if (!user) return res.json({ ok: true });

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, email: user.email, kind: "reset" },
      env.APP_JWT_SECRET,
      { expiresIn: "30m" }
    );

    const appUrl = (process.env.APP_URL || "https://joineryai.app").replace(/\/+$/,'');
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    // Send password reset email
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
      const companyName = tenant?.name || 'your organization';
      
      await sendEmail({
        to: normalizedEmail,
        subject: 'Reset your JoineryAI password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p>Hi${user.name ? ` ${user.name}` : ''},</p>
            <p>We received a request to reset your password for your JoineryAI account at ${companyName}.</p>
            <p>Click the button below to set a new password:</p>
            <p style="margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 30 minutes.
            </p>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="word-break: break-all;">${resetUrl}</span>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
            </p>
          </div>
        `,
      });
      console.log(`[password-reset] Email sent to ${normalizedEmail}`);
    } catch (emailError: any) {
      console.error('[password-reset] Failed to send email:', emailError?.message);
      // Still return success to avoid leaking user existence
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[auth/setup/request-reset]", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /auth/setup/reset
 * body: { token: string, password: string }
 */
router.post("/reset", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "missing_fields" });

    let decoded: any;
    try {
      decoded = jwt.verify(token, env.APP_JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "invalid_or_expired_token" });
    }
    if (decoded.kind !== "reset") return res.status(400).json({ error: "wrong_token_kind" });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: "user_not_found" });

    const passwordHash = await bcrypt.hash(String(password), 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[auth/setup/reset]", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;