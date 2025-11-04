// api/src/routes/ml-ops.ts
import { Router } from "express";
import { prisma } from "../db";
import { recordTrainingOutcome } from "../services/training";

const router = Router();

function summariseTrainingPayload(raw: any) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const meta = obj.meta && typeof obj.meta === "object" ? obj.meta : {};
  const metrics =
    (obj.metrics && typeof obj.metrics === "object"
      ? obj.metrics
      : meta.metrics && typeof meta.metrics === "object"
      ? meta.metrics
      : {}) || {};
  const datasetHash =
    obj.datasetHash ||
    obj.dataset_hash ||
    meta.datasetHash ||
    meta.dataset_hash ||
    "unknown";
  const model = obj.model || obj.modelName || meta.model || "lead_classifier";
  const modelLabel =
    obj.modelLabel ||
    obj.model_label ||
    obj.version ||
    meta.modelLabel ||
    meta.model_label ||
    meta.label ||
    undefined;
  const datasetSize =
    typeof obj.datasetSize === "number"
      ? obj.datasetSize
      : typeof metrics.dataset_size === "number"
      ? metrics.dataset_size
      : typeof metrics.samples === "number"
      ? metrics.samples
      : undefined;

  return {
    model: String(model || "lead_classifier"),
    datasetHash: String(datasetHash || "unknown"),
    modelLabel: modelLabel ? String(modelLabel) : undefined,
    metrics,
    datasetSize: typeof datasetSize === "number" ? datasetSize : undefined,
  } as const;
}

/**
 * POST /internal/ml/ops/collect-train-save
 * Body: { limit?: number }
 *
 * 1) Calls /internal/ml/ingest-gmail to collect signed attachment URLs
 * 2) Calls /ml/train to send those items to the ML service
 * 3) Upserts items into MLTrainingSample
 */
router.post("/ops/collect-train-save", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 100), 500));

    const API_BASE =
      (process.env.APP_API_URL ||
        process.env.API_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        `http://localhost:${process.env.PORT || 4000}`)!
        .replace(/\/$/, "");

    // Build headers safely for fetch (avoid TS union issue)
    const authHeaderValue = typeof req.headers.authorization === "string" ? req.headers.authorization : undefined;

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    if (authHeaderValue) headers.set("Authorization", authHeaderValue);

    // 1) Collect items from Gmail
    const ingestResp = await fetch(`${API_BASE}/internal/ml/ingest-gmail`, {
      method: "POST",
      headers,
      body: JSON.stringify({ limit }),
    });
    const ingestText = await ingestResp.text();
    let ingestJson: any = {};
    try { ingestJson = ingestText ? JSON.parse(ingestText) : {}; } catch { ingestJson = { raw: ingestText }; }

    if (!ingestResp.ok) {
      return res.status(ingestResp.status).json({ error: "ingest_failed", detail: ingestJson });
    }

    const items: Array<{
      messageId: string;
      attachmentId: string;
      url: string;
      sentAt?: string | null;
    }> = Array.isArray(ingestJson.items)
      ? ingestJson.items.map((it: any) => ({
          messageId: String(it.messageId || it.id),
          attachmentId: String(it.attachmentId),
          url: String(it.url || it.downloadUrl),
          sentAt: it.sentAt ?? it.quotedAt ?? null,
        }))
      : [];

    // 2) Trigger ML training via our /ml/train route (which itself calls the ML server)
    const trainResp = await fetch(`${API_BASE}/ml/train`, {
      method: "POST",
      headers,
      body: JSON.stringify({ limit: Math.min(limit, items.length || limit) }),
    });
    const trainText = await trainResp.text();
    let trainJson: any = {};
    try { trainJson = trainText ? JSON.parse(trainText) : {}; } catch { trainJson = { raw: trainText }; }
    const summary = summariseTrainingPayload(trainJson);
    const recorded = await recordTrainingOutcome({
      tenantId,
      model: summary.model,
      status: trainResp.ok ? "succeeded" : "failed",
      datasetHash: summary.datasetHash,
      metrics: summary.metrics,
      modelLabel: summary.modelLabel,
      datasetSize: summary.datasetSize,
    });

    // 3) Save samples to DB (upsert on unique compound key)
    let saved = 0;
    for (const it of items) {
      await prisma.mLTrainingSample.upsert({
        where: {
          // ✅ correct unique input name
          tenantId_messageId_attachmentId: {
            tenantId,
            messageId: it.messageId,
            attachmentId: it.attachmentId,
          },
        },
        create: {
          tenantId,
          messageId: it.messageId,
          attachmentId: it.attachmentId,
          url: it.url,
          quotedAt: it.sentAt ? new Date(it.sentAt) : null,
        },
        update: {
          url: it.url,
          quotedAt: it.sentAt ? new Date(it.sentAt) : null,
        },
      });
      saved += 1;
    }

    if (!trainResp.ok) {
      return res.status(trainResp.status).json({
        error: "ml_train_failed",
        detail: trainJson,
        saved,
        modelVersionId: recorded?.modelVersionId ?? null,
        awaitingApproval: recorded?.awaitingApproval ?? false,
      });
    }

    return res.json({
      ok: true,
      tenantId,
      requested: limit,
      collected: items.length,
      saved,
      ml: trainJson,
      modelVersionId: recorded?.modelVersionId ?? null,
      promoted: recorded?.promoted ?? false,
      awaitingApproval: recorded?.awaitingApproval ?? false,
    });
  } catch (e: any) {
    console.error("[internal/ml/ops/collect-train-save] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;