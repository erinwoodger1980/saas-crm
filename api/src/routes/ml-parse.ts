// api/src/routes/ml-parse.ts
import { Router } from "express";
import { getTenantFlags } from "../lib/flags";

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

    // 🚦 Feature flag check (toggle in TenantSettings.beta.quoteParserV2)
    const flags = await getTenantFlags(auth.tenantId);
    if (!flags.quoteParserV2) {
      return res
        .status(403)
        .json({ error: "feature_disabled", feature: "quoteParserV2" });
    }

    // 1) Kick an import with a quote-like filter so we have fresh message IDs
    const limit = Math.max(1, Math.min(Number(req.body?.limit || 200), 500));
    const q =
      req.body?.q ||
      'has:attachment filename:pdf subject:(quote OR estimate OR proposal) from:me newer_than:2y';

    const APP_BASE =
      process.env.APP_URL?.replace(/\/+$/, "") ||
      `http://localhost:${process.env.PORT || 4000}`;

    // Hit our own Gmail import endpoint (internal HTTP)
    const imResp = await fetch(`${APP_BASE}/gmail/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // forward the same Authorization header so /gmail/import can see the tenant
        Authorization: (req.headers.authorization as string) || "",
      },
      body: JSON.stringify({ max: limit, q }),
    });

    const imported = await imResp.json();
    if (!imResp.ok) {
      return res.status(imResp.status).json(imported);
    }

    const ids: string[] = Array.isArray(imported?.imported)
      ? (imported.imported as any[]).map((r) => r.id).filter(Boolean)
      : [];

    const results: Array<{
      id: string;
      subject: string | null;
      attachments: Array<{ filename: string; attachmentId: string }>;
    }> = [];

    // 2) For each message id, fetch its attachments via our own Gmail endpoint
    for (const id of ids) {
      const mResp = await fetch(`${APP_BASE}/gmail/message/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { Authorization: (req.headers.authorization as string) || "" },
      });

      if (!mResp.ok) {
        // Skip this message but keep going
        // (Optionally collect failures if you want to surface them)
        try {
          // drain body to avoid open handles
          await mResp.text();
        } catch {}
        continue;
      }

      const msg = await mResp.json();
      const pdfs = Array.isArray(msg?.attachments)
        ? msg.attachments.filter(
            (a: any) => String(a?.filename || "").toLowerCase().endsWith(".pdf") && a?.attachmentId
          )
        : [];

      if (pdfs.length) {
        results.push({
          id: String(msg.id || id),
          subject: (msg.subject as string) || null,
          attachments: pdfs.map((a: any) => ({
            filename: String(a.filename || ""),
            attachmentId: String(a.attachmentId),
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
    console.error("[/ml/parse-gmail-quotes] failed:", e?.message || e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

export default router;