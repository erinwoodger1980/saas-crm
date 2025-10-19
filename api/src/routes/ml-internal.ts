// api/src/routes/ml-internal.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { fetchMessage, getAccessTokenForTenant } from "../services/gmail";

const router = Router();

// POST /internal/ml/gmail-quotes  { tenantId, limit }
router.post("/gmail-quotes", async (req, res) => {
  try {
    const { tenantId, limit = 500 } = req.body;
    if (!tenantId) return res.status(400).json({ error: "tenantId required" });

    const token = await getAccessTokenForTenant(tenantId);
    if (!token) return res.status(404).json({ error: "no gmail connection" });

    // Search: last 500 sent emails with PDFs that look like quotes
    const q = "in:sent filename:pdf subject:(quote OR quotation)";
    const rsp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { messages = [] } = await rsp.json();

    const results: any[] = [];
    for (const m of messages) {
      const msg = await fetchMessage(token, m.id, "full");
      // Collect only attachments that are PDFs
      const pdfParts: any[] = [];
      const walk = (p: any) => {
        if (p.filename?.endsWith(".pdf") && p.body?.attachmentId) {
          pdfParts.push({
            id: p.body.attachmentId,
            filename: p.filename,
            messageId: m.id,
            downloadUrl: `https://api.joineryai.app/gmail/message/${m.id}/attachments/${p.body.attachmentId}/download?jwt=${req.query.jwt || ""}`,
          });
        }
        if (p.parts) p.parts.forEach(walk);
      };
      walk(msg.payload);
      results.push({ id: m.id, attachments: pdfParts });
    }

    res.json({ ok: true, results });
  } catch (e: any) {
    console.error("[ml-internal] gmail-quotes failed:", e);
    res.status(500).json({ error: e.message || "internal_error" });
  }
});

export default router;