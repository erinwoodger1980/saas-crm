// api/src/routes/ml.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { env } from "../env";
import { recordTrainingOutcome } from "../services/training";

// Small helper to enforce an upper-bound on ML requests
function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new Error(`timeout_${ms}ms`)), ms);
  const onAbort = () => ctl.abort(new Error("aborted"));
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
  const cleanup = () => {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  };
  return { signal: ctl.signal, cleanup } as const;
}

const router = Router();
const ML_URL = (process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000")
  .trim()
  .replace(/\/$/, "");
const SAMPLE_LOOKBACK_DAYS = Math.max(
  1,
  Number(process.env.ML_TRAIN_SAMPLE_LOOKBACK_DAYS || process.env.ML_TRAIN_LOOKBACK_DAYS || 14),
);
// Default tighter timeout in production to avoid upstream gateway 502s (Cloudflare/Render)
const ML_TIMEOUT_MS = Math.max(1000, Number(process.env.ML_TIMEOUT_MS || (process.env.NODE_ENV === "production" ? 6000 : 10000)));

// Build your API base once (same logic you used earlier)
const API_BASE = (
  process.env.APP_API_URL ??
  process.env.API_URL ??
  process.env.RENDER_EXTERNAL_URL ??
  `http://localhost:${process.env.PORT || 4000}`
).replace(/\/$/, "");

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
  let versionId: any =
    obj.versionId ||
    obj.modelVersionId ||
    obj.model_version_id ||
    meta.versionId ||
    meta.modelVersionId ||
    meta.model_version_id ||
    undefined;
  if (!versionId && obj.modelVersion && typeof obj.modelVersion === "object") {
    versionId = (obj.modelVersion as any).id || (obj.modelVersion as any).versionId || undefined;
  }
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
    versionId: versionId ? String(versionId) : undefined,
    metrics,
    datasetSize: typeof datasetSize === "number" ? datasetSize : undefined,
  } as const;
}

function normalizeAttachmentUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    // If it's already absolute, adjust host if needed
    const parsed = new URL(u);
    if (parsed.hostname === "joineryai.app") {
      parsed.hostname = "api.joineryai.app";
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    // Not a full URL (likely a path) – prefix with API base
    if (u.startsWith("/")) return `${API_BASE}${u}`;
    return `${API_BASE}/${u}`;
  }
}

function buildSignedFileUrl(fileId: string, tenantId: string, quoteId?: string | null) {
  const payload: Record<string, string> = { t: tenantId };
  if (quoteId) payload.q = quoteId;
  const token = jwt.sign(payload, env.APP_JWT_SECRET, { expiresIn: "30m" });
  return `${API_BASE}/files/${encodeURIComponent(fileId)}?jwt=${encodeURIComponent(token)}`;
}

/**
 * POST /ml/predict (unchanged)
 */
router.post("/predict", async (req, res) => {
  try {
    const b = req.body ?? {};
    const payload = {
      area_m2: typeof b.area_m2 === "string" ? Number(b.area_m2) : Number(b.area_m2 ?? 0),
      materials_grade: (b.materials_grade ?? "Standard").toString(),
      project_type: b.project_type ? String(b.project_type) : null,
      lead_source: b.lead_source ? String(b.lead_source) : null,
      region: (b.region ?? "uk").toString(),
    };

    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS);
    const r = await fetch(`${ML_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    cleanup();

    const text = await r.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!r.ok) return res.status(r.status).json(json);
    return res.json(json);
  } catch (e: any) {
    console.error("[ml proxy] /predict failed:", e?.message || e);
    return res.status(502).json({ error: "ml_unreachable" });
  }
});

/**
 * GET /ml/health (unchanged)
 */
router.get("/health", async (_req, res) => {
  try {
    const r = await fetch(`${ML_URL}/`, { method: "GET" });
    res.json({ ok: r.ok, target: ML_URL });
  } catch {
    res.status(502).json({ ok: false, target: ML_URL });
  }
});

/**
 * POST /ml/parse-quote (unchanged except normalization)
 * Body: { url, filename?, quotedAt? }
 */
router.post("/parse-quote", async (req, res) => {
  try {
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const { url, filename, quotedAt } = req.body || {};
    const safeUrl = normalizeAttachmentUrl(url);
    if (!safeUrl) return res.status(400).json({ error: "missing url" });

    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS);
    const f = await fetch(`${ML_URL}/parse-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: safeUrl, filename, quotedAt }),
      signal,
    });
    cleanup();

    const text = await f.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!f.ok) {
      return res.status(f.status).json({ error: "ml_parse_failed", detail: json });
    }
    return res.json(json);
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isTimeout = /timeout_/i.test(msg) || /The operation was aborted/i.test(msg);
    if (isTimeout) {
      console.warn(`[ml proxy] /parse-quote timed out after ${ML_TIMEOUT_MS}ms`);
      return res.status(504).json({ error: "ml_timeout", timeoutMs: ML_TIMEOUT_MS });
    }
    console.error("[ml proxy] /parse-quote failed:", msg);
    return res.status(502).json({ error: "ml_unreachable", detail: msg });
  }
});

/**
 * POST /ml/train
 * 1) calls /internal/ml/ingest-gmail to collect signed PDF URLs
 * 2) normalizes URLs and forwards to ML /train
 */
router.post("/train", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 500), 500));
    const requestedModelRaw = typeof req.body?.model === "string" ? req.body.model.trim() : "";
    const requestedModel = requestedModelRaw || "supplier_estimator";
    const lookbackSince = new Date(Date.now() - SAMPLE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const ingestResp = await fetch(`${API_BASE}/internal/ml/ingest-gmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: JSON.stringify({ limit }),
    });

    const ingestText = await ingestResp.text();
    let ingestJson: any = {};
    try { ingestJson = ingestText ? JSON.parse(ingestText) : {}; } catch { ingestJson = { raw: ingestText }; }

    if (!ingestResp.ok) {
      return res.status(ingestResp.status).json({ error: "ingest_failed", detail: ingestJson });
    }

    type TrainingItem = {
      messageId: string | null;
      attachmentId: string | null;
      quoteId: string | null;
      fileId: string | null;
      url: string;
      filename?: string | null;
      quotedAt?: string | null;
      sourceType?: string | null;
    };

    const normalizedIngest: TrainingItem[] = Array.isArray(ingestJson.items)
      ? ingestJson.items
          .map((it: any) => {
            const normalizedUrl = normalizeAttachmentUrl(it.url ?? it.downloadUrl);
            if (!normalizedUrl) return null;
            const quotedAtValue = it.sentAt ? new Date(it.sentAt) : null;
            return {
              messageId: it.messageId ? String(it.messageId) : null,
              attachmentId: it.attachmentId ? String(it.attachmentId) : null,
              quoteId: it.quoteId ? String(it.quoteId) : null,
              fileId: it.fileId ? String(it.fileId) : null,
              url: normalizedUrl,
              filename: it.filename ? String(it.filename) : null,
              quotedAt: quotedAtValue && !Number.isNaN(quotedAtValue.getTime()) ? quotedAtValue.toISOString() : null,
              sourceType: it.sourceType ? String(it.sourceType) : "supplier_quote",
            } as TrainingItem;
          })
          .filter((x: TrainingItem | null): x is TrainingItem => !!x && !!x.url)
      : [];

    let ingestSaved = 0;
    for (const item of normalizedIngest) {
      if (!item.messageId || !item.attachmentId) continue;
      try {
        await prisma.mLTrainingSample.upsert({
          where: {
            tenantId_messageId_attachmentId: {
              tenantId,
              messageId: item.messageId,
              attachmentId: item.attachmentId,
            },
          },
          create: {
            tenantId,
            messageId: item.messageId,
            attachmentId: item.attachmentId,
            url: item.url,
            quotedAt: item.quotedAt ? new Date(item.quotedAt) : null,
            sourceType: item.sourceType ?? "supplier_quote",
            quoteId: item.quoteId ?? undefined,
            fileId: item.fileId ?? undefined,
          },
          update: {
            url: item.url,
            quotedAt: item.quotedAt ? new Date(item.quotedAt) : null,
            sourceType: item.sourceType ?? undefined,
            quoteId: item.quoteId ?? undefined,
            fileId: item.fileId ?? undefined,
          },
        });
        ingestSaved += 1;
      } catch (err) {
        console.warn("[ml/train] failed to upsert ingest sample", err);
      }
    }

    const recentSamples = await prisma.mLTrainingSample.findMany({
      where: {
        tenantId,
        OR: [
          { createdAt: { gte: lookbackSince } },
          { quotedAt: { gte: lookbackSince } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const datasetKey = (sample: TrainingItem) => {
      if (sample.quoteId) return `quote:${sample.quoteId}`;
      const mid = sample.messageId ?? "unknown";
      const aid = sample.attachmentId ?? sample.fileId ?? "unknown";
      return `${mid}::${aid}`;
    };

    const datasetMap = new Map<string, TrainingItem>();

    const fileIds = new Set<string>();
    for (const sample of recentSamples) {
      if (sample.fileId) fileIds.add(sample.fileId);
    }
    for (const sample of normalizedIngest) {
      if (sample.fileId) fileIds.add(sample.fileId);
    }

    const uploadedFiles = fileIds.size
      ? await prisma.uploadedFile.findMany({
          where: { tenantId, id: { in: Array.from(fileIds) } },
          select: { id: true, name: true, uploadedAt: true, quoteId: true },
        })
      : [];
    const uploadedMap = new Map(uploadedFiles.map((row) => [row.id, row]));

    const normaliseForDataset = (sample: TrainingItem): TrainingItem | null => {
      let url = sample.url ? normalizeAttachmentUrl(sample.url) : null;
      let quotedAt = sample.quotedAt ?? null;
      let filename = sample.filename ?? null;
      if (sample.fileId && uploadedMap.has(sample.fileId)) {
        const file = uploadedMap.get(sample.fileId)!;
        try {
          url = buildSignedFileUrl(sample.fileId, tenantId, sample.quoteId ?? file.quoteId ?? null);
        } catch (err) {
          console.warn("[ml/train] failed to sign file", err);
        }
        filename = filename ?? file.name ?? null;
        if (!quotedAt && file.uploadedAt) {
          const uploadedDate = new Date(file.uploadedAt as any);
          if (!Number.isNaN(uploadedDate.getTime())) quotedAt = uploadedDate.toISOString();
        }
        if (!sample.quoteId && file.quoteId) {
          sample.quoteId = file.quoteId;
        }
      }
      if (!url) return null;
      return {
        messageId: sample.messageId ?? null,
        attachmentId: sample.attachmentId ?? null,
        quoteId: sample.quoteId ?? null,
        fileId: sample.fileId ?? null,
        url,
        filename,
        quotedAt,
        sourceType: sample.sourceType ?? null,
      };
    };

    for (const sample of normalizedIngest) {
      const normalised = normaliseForDataset({ ...sample });
      if (!normalised) continue;
      datasetMap.set(datasetKey(normalised), normalised);
    }

    for (const sample of recentSamples) {
      const normalised = normaliseForDataset({
        messageId: sample.messageId ?? null,
        attachmentId: sample.attachmentId ?? null,
        quoteId: sample.quoteId ?? null,
        fileId: sample.fileId ?? null,
        url: sample.url,
        filename: null,
        quotedAt: sample.quotedAt ? new Date(sample.quotedAt as any).toISOString() : null,
        sourceType: sample.sourceType ?? null,
      });
      if (!normalised) continue;
      datasetMap.set(datasetKey(normalised), normalised);
    }

    const dataset = Array.from(datasetMap.values()).sort((a, b) => {
      const aTime = a.quotedAt ? new Date(a.quotedAt).getTime() : 0;
      const bTime = b.quotedAt ? new Date(b.quotedAt).getTime() : 0;
      return bTime - aTime;
    });

    const datasetCount = dataset.length;
    const startedAt = new Date();

    const mlPayload = {
      tenantId,
      model: requestedModel,
      items: dataset,
      requestedLimit: limit,
      recentSampleCount: datasetCount,
    };

    const trainResp = await fetch(`${ML_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mlPayload),
    });

    const trainText = await trainResp.text();
    let trainJson: any = {};
    try { trainJson = trainText ? JSON.parse(trainText) : {}; } catch { trainJson = { raw: trainText }; }

    const finishedAt = new Date();
    const summary = summariseTrainingPayload(trainJson);
    const modelName =
      summary.model && summary.model !== "lead_classifier" ? summary.model : "supplier_estimator";
    const recorded = await recordTrainingOutcome({
      tenantId,
      model: modelName,
      status: trainResp.ok ? "succeeded" : "failed",
      datasetHash: summary.datasetHash,
      metrics: summary.metrics,
      modelLabel: summary.modelLabel,
      datasetSize: summary.datasetSize,
      datasetCount,
      versionId: summary.versionId,
      startedAt,
      finishedAt,
    });

    if (!trainResp.ok) {
      return res.status(trainResp.status).json({
        error: "ml_train_failed",
        detail: trainJson,
        datasetCount,
        recentSamples14d: datasetCount,
        ingestSaved,
        modelVersionId: recorded?.modelVersionId ?? null,
        awaitingApproval: recorded?.awaitingApproval ?? false,
      });
    }

    return res.json({
      ok: true,
      tenantId,
      received: datasetCount,
      datasetCount,
      recentSamples14d: datasetCount,
      ingestSaved,
      requestedModel,
      payloadSamples: dataset,
      ml: trainJson,
      metrics: summary.metrics,
      modelVersionId: recorded?.modelVersionId ?? null,
      promoted: recorded?.promoted ?? false,
      awaitingApproval: recorded?.awaitingApproval ?? false,
    });
  } catch (e: any) {
    console.error("[ml/train] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /ml/preview-email-quotes
 * Forward email quote preview requests to ML service
 */
router.post("/preview-email-quotes", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const { emailProvider, daysBack } = req.body || {};
    
    const payload = {
      tenantId,
      emailProvider: emailProvider || "gmail",
      credentials: {
        api_base_url: API_BASE,
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json'
        }
      },
      daysBack: daysBack || 30
    };

    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS);
    const r = await fetch(`${ML_URL}/preview-email-quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    cleanup();

    const text = await r.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!r.ok) return res.status(r.status).json(json);
    
    // Map ML service response to frontend expected format for preview-email-quotes
    if (json.total_quotes_found !== undefined) {
      json.quotesFound = json.total_quotes_found;
    }
    
    return res.json(json);
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isTimeout = /timeout_/i.test(msg) || /The operation was aborted/i.test(msg);
    if (isTimeout) {
      console.warn(`[ml proxy] /preview-email-quotes timed out after ${ML_TIMEOUT_MS}ms`);
      return res.status(504).json({ error: "ml_timeout", timeoutMs: ML_TIMEOUT_MS });
    }
    console.error("[ml proxy] /preview-email-quotes failed:", msg);
    return res.status(502).json({ error: "ml_unreachable", detail: msg });
  }
});

/**
 * POST /ml/start-email-training
 * Forward email training workflow requests to ML service
 */
router.post("/start-email-training", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const { emailProvider, daysBack, credentials } = req.body || {};
    
    const payload = {
      tenantId,
      emailProvider: emailProvider || "gmail",
      daysBack: daysBack || 30,
      credentials: credentials || {
        api_base_url: API_BASE,
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json'
        }
      }
    };

    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS * 3); // Longer timeout for training
    const r = await fetch(`${ML_URL}/start-email-training`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    cleanup();

    const text = await r.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!r.ok) return res.status(r.status).json(json);
    
    // Map ML service response to frontend expected format for start-email-training
    if (json.quotes_found !== undefined) {
      json.quotesFound = json.quotes_found;
    }
    if (json.training_records_saved !== undefined) {
      json.trainingRecords = json.training_records_saved;
    }
    
    return res.json(json);
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isTimeout = /timeout_/i.test(msg) || /The operation was aborted/i.test(msg);
    if (isTimeout) {
      console.warn(`[ml proxy] /start-email-training timed out after ${ML_TIMEOUT_MS * 3}ms`);
      return res.status(504).json({ error: "ml_timeout", timeoutMs: ML_TIMEOUT_MS * 3 });
    }
    console.error("[ml proxy] /start-email-training failed:", msg);
    return res.status(502).json({ error: "ml_unreachable", detail: msg });
  }
});

/**
 * POST /ml/train-client-quotes
 * Forward client quote training requests to ML service
 */
router.post("/train-client-quotes", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const payload = {
      tenantId
    };

    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS * 2); // Longer timeout for training
    const r = await fetch(`${ML_URL}/train-client-quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    cleanup();

    const text = await r.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!r.ok) return res.status(r.status).json(json);
    return res.json(json);
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isTimeout = /timeout_/i.test(msg) || /The operation was aborted/i.test(msg);
    if (isTimeout) {
      console.warn(`[ml proxy] /train-client-quotes timed out after ${ML_TIMEOUT_MS * 2}ms`);
      return res.status(504).json({ error: "ml_timeout", timeoutMs: ML_TIMEOUT_MS * 2 });
    }
    console.error("[ml proxy] /train-client-quotes failed:", msg);
    return res.status(502).json({ error: "ml_unreachable", detail: msg });
  }
});

router.post("/approve-version/:id", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    const userId = req.auth?.userId as string | undefined;
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

    const versionId = String(req.params?.id ?? "").trim();
    if (!versionId) return res.status(400).json({ error: "invalid_version" });

    const version = await prisma.modelVersion.findUnique({ where: { id: versionId } });
    if (!version) return res.status(404).json({ error: "not_found" });

    const promoted = await prisma.$transaction(async (tx) => {
      await tx.modelVersion.updateMany({
        where: { model: version.model, isProduction: true, NOT: { id: version.id } },
        data: { isProduction: false },
      });
      return tx.modelVersion.update({
        where: { id: version.id },
        data: {
          isProduction: true,
          awaitingApproval: false,
          approvedAt: new Date(),
          approvedById: userId,
        },
      });
    });

    return res.json({
      ok: true,
      modelVersionId: promoted.id,
      model: promoted.model,
      label: promoted.label,
      approvedAt: promoted.approvedAt,
      awaitingApproval: promoted.awaitingApproval,
      promoted: true,
    });
  } catch (e: any) {
    console.error("[ml/approve-version] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;