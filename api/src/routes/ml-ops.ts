import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../db";

const router = Router();

const ML_URL = (process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000")
  .trim()
  .replace(/\/$/, "");

const API_BASE =
  (process.env.APP_API_URL ||
    process.env.API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 4000}`)!
    .replace(/\/$/, "");

/**
 * POST /internal/ml/collect-train-save
 * Body: { limit?: number }
 *
 * 1) Collect signed Gmail attachment URLs from /internal/ml/ingest-gmail
 * 2) Upsert into MLTrainingSample
 * 3) Trigger ML /train with { tenantId, items }
 * 4) Return summary
 */
router.post("/collect-train-save", async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 50), 500));
    const authHeader = req.headers.authorization ? { Authorization: req.headers.authorization } : {};

    // 1) Collect signed URLs from our own API
    const ingestResp = await fetch(`${API_BASE}/internal/ml/ingest-gmail`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ limit }),
    });

    const ingestText = await ingestResp.text();
    let ingestJson: any = {};
    try { ingestJson = ingestText ? JSON.parse(ingestText) : {}; } catch { ingestJson = { raw: ingestText }; }

    if (!ingestResp.ok) {
      return res.status(ingestResp.status).json({ error: "ingest_failed", detail: ingestJson });
    }

    // Normalize to our DB schema + ML schema
    type Item = {
      messageId: string;
      attachmentId: string;
      url: string;
      filename?: string | null;
      quotedAt?: string | null;
    };

    const items: Item[] = Array.isArray(ingestJson.items)
      ? ingestJson.items
          .filter((it: any) => it?.messageId && it?.attachmentId && (it?.url || it?.downloadUrl))
          .map((it: any) => ({
            messageId: String(it.messageId),
            attachmentId: String(it.attachmentId),
            url: String(it.url ?? it.downloadUrl),
            filename: it.filename ?? null,
            quotedAt: it.sentAt ?? null,
          }))
      : [];

    // 2) Save to DB (upsert each; keeps filename/quotedAt fresh)
    let upserts = 0;
    for (const data of items) {
      await prisma.mLTrainingSample.upsert({
        where: {
          // unique composite created in migration:
          tenantId_messageId_attachmentId_url: {
            tenantId,
            messageId: data.messageId,
            attachmentId: data.attachmentId,
            url: data.url,
          },
        },
        create: {
          tenantId,
          messageId: data.messageId,
          attachmentId: data.attachmentId,
          url: data.url,
          filename: data.filename ?? null,
          quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
        },
        update: {
          filename: data.filename ?? null,
          quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
        },
      });
      upserts += 1;
    }

    // 3) Trigger ML /train with same items
    const trainResp = await fetch(`${ML_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        items: items.map((it) => ({
          messageId: it.messageId,
          attachmentId: it.attachmentId,
          url: it.url,
          filename: it.filename ?? null,
          quotedAt: it.quotedAt ?? null,
        })),
      }),
    });

    const trainText = await trainResp.text();
    let trainJson: any = {};
    try { trainJson = trainText ? JSON.parse(trainText) : {}; } catch { trainJson = { raw: trainText }; }

    if (!trainResp.ok) {
      return res.status(trainResp.status).json({ error: "ml_train_failed", detail: trainJson, saved: upserts });
    }

    return res.json({
      ok: true,
      tenantId,
      requested: limit,
      collected: items.length,
      saved: upserts,
      ml: trainJson,
    });
  } catch (e: any) {
    console.error("[internal/ml/collect-train-save] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;