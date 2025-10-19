import { Router } from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { env } from "../env";
import { getAccessTokenForTenant, gmailFetchAttachment } from "../services/gmail";

const router = Router();

/**
 * GET /gmail/message/:messageId/attachments/:attachmentId
 * ?jwt=<token>
 * Serves a Gmail attachment (PDF) securely to ML or frontend users.
 */
router.get("/message/:messageId/attachments/:attachmentId", async (req, res) => {
  try {
    const { messageId, attachmentId } = req.params;
    const token = req.query.jwt as string | undefined;
    if (!token) return res.status(401).json({ error: "missing_jwt" });

    // Verify short-lived system token
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.APP_JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "invalid_jwt" });
    }

    const tenantId = decoded?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const accessToken = await getAccessTokenForTenant(tenantId);
    const { buffer, filename, mimeType } = await gmailFetchAttachment(accessToken, messageId, attachmentId);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (e: any) {
    console.error("[gmail/attachments] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error", detail: e?.message });
  }
});

export default router;