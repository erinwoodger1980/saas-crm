// api/src/routes/ml-parse.ts
import { Router } from "express";

const router = Router();

/**
 * POST /ml/parse-gmail-quotes
 *
 * Step 1: ensure the Gmail inbox is indexed (imports message IDs that match query)
 * Step 2: fetch each message's attachments and return only PDFs that look like quotes
 *
 * NOTE: This does NOT yet parse the PDFs. It prepares a clean list we'll parse in Step 2.
 */
router.post("/parse-gmail-quotes", async (req: any, res) => {
  try {
    // Require auth (we need tenant context)
    const auth = (req as any).auth;
    if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

    // 1) Kick an import with a quote-like filter so we have fresh message IDs
    const limit = Math.max(1, Math.min(Number(req.body?.limit || 200), 500));
    const q =
      req.body?.q ||
      'has:attachment filename:pdf subject:(quote OR estimate OR proposal) from:me newer_than:2y';

    // Hit our own Gmail import endpoint (internal HTTP)
    const imResp = await fetch(`${process.env.APP_URL?.replace(/\/+$/,"") || `http://localhost:${process.env.PORT || 4000}`}/gmail/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // forward the same Authorization header so /gmail/import can see the tenant
        Authorization: req.headers.authorization || "",
      },
      body: JSON.stringify({ max: limit, q }),
    });

    const imported = await imResp.json();
    if (!imResp.ok) {
      return res.status(imResp.status).json(imported);
    }

    const ids: string[] = (imported?.imported || []).map((r: any) => r.id);
    const results: Array<{
      id: string;
      subject: string | null;
      attachments: Array<{ filename: string; attachmentId: string }>;
    }> = [];

    // 2) For each message id, fetch its attachments via our own Gmail endpoint
    for (const id of ids) {
      const mResp = await fetch(`${process.env.APP_URL?.replace(/\/+$/,"") || `http://localhost:${process.env.PORT || 4000}`}/gmail/message/${id}`, {
        method: "GET",
        headers: { Authorization: req.headers.authorization || "" },
      });
      const msg = await mResp.json();
      if (!mResp.ok) continue;

      const pdfs = (msg.attachments || []).filter((a: any) =>
        String(a?.filename || "").toLowerCase().endsWith(".pdf")
      );

      if (pdfs.length) {
        results.push({
          id: msg.id,
          subject: msg.subject || null,
          attachments: pdfs.map((a: any) => ({
            filename: a.filename,
            attachmentId: a.attachmentId,
          })),
        });
      }
    }

    return res.json({
      ok: true,
      imported: ids.length,
      withPdfQuotes: results.length,
      items: results,
    });
  } catch (e: any) {
    console.error("[/ml/parse-gmail-quotes] failed:", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

export default router;
