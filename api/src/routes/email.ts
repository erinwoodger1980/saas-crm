import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

/**
 * POST /internal/send-email
 * Sends an email using tenant's configured provider (Gmail/MS365 or SMTP fallback).
 * Body: { tenantId: string, to: string, subject: string, body: string, html?: string, fromName?: string, attachments?: Array }
 */
router.post("/internal/send-email", async (req: any, res: any) => {
  try {
    const { tenantId, to, subject, body, html, fromName, attachments } = req.body || {};

    if (!tenantId || !to || !subject || (!body && !html)) {
      return res.status(400).json({ error: "invalid_request", details: "tenantId, to, subject and body/html required" });
    }

    const { sendEmailViaTenant } = await import("../services/email-sender");
    await sendEmailViaTenant(tenantId, { to, subject, body: body || "", html, fromName, attachments });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[/internal/send-email] failed:", e?.message || e);
    return res.status(500).json({ error: e?.message || "send failed" });
  }
});

export default router;
