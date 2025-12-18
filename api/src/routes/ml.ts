// api/src/routes/ml.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { env } from "../env";
import { recordTrainingOutcome } from "../services/training";
import { buildMLPayload, normalizeMLPayload, compareMLPayloads } from "../services/ml-payload-builder";

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

// Simple in-memory cache for recent material costs
const materialCostsCache: { data: any; ts: number } = { data: null, ts: 0 };
const MATERIAL_COSTS_TTL_MS = 60_000;

/**
 * GET /ml/material-costs/recent
 * Proxy to ML service for recent material cost changes (with 60s cache)
 */
router.get("/material-costs/recent", async (req, res) => {
  try {
    const tenantId = (req.query.tenantId || (req as any).auth?.tenantId || "").toString();
    if (!tenantId) return res.status(400).json({ error: "tenant_required" });

    const now = Date.now();
    if (materialCostsCache.data && now - materialCostsCache.ts < MATERIAL_COSTS_TTL_MS) {
      return res.json({ ok: true, cached: true, ...materialCostsCache.data });
    }

    const url = `${ML_URL}/material-costs/recent?tenantId=${encodeURIComponent(tenantId)}&limit=100`;
    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS);
    const r = await fetch(url, { method: "GET", signal });
    cleanup();
    const text = await r.text();
    let payload: any = {};
    try { payload = JSON.parse(text); } catch { /* ignore */ }
    if (!r.ok) {
      console.error(`[material-costs/recent] upstream ${r.status} response:`, text.slice(0, 500));
      // Graceful fallback for 404/501: return empty dataset instead of hard error so UI renders
      if (r.status === 404 || r.status === 501) {
        return res.json({ ok: true, cached: false, items: [], message: "ml_upstream_missing" });
      }
      return res.status(r.status).json({ error: "upstream_error", status: r.status, detail: payload || text });
    }
    materialCostsCache.data = payload;
    materialCostsCache.ts = now;
    return res.json({ ok: true, cached: false, ...payload });
  } catch (e: any) {
    console.error("[material-costs/recent] failed:", e?.message || e);
    return res.status(500).json({ error: "material_costs_failed", message: e?.message || String(e) });
  }
});

// Cache for trends
const materialTrendsCache: { data: any; ts: number } = { data: null, ts: 0 };
const MATERIAL_TRENDS_TTL_MS = 60_000;

router.get("/material-costs/trends", async (req, res) => {
  try {
    const tenantId = (req.query.tenantId || (req as any).auth?.tenantId || "").toString();
    if (!tenantId) return res.status(400).json({ error: "tenant_required" });
    const now = Date.now();
    if (materialTrendsCache.data && now - materialTrendsCache.ts < MATERIAL_TRENDS_TTL_MS) {
      return res.json({ ok: true, cached: true, ...materialTrendsCache.data });
    }
    const url = `${ML_URL}/material-costs/trends?tenantId=${encodeURIComponent(tenantId)}&window=12`;
    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS);
    const r = await fetch(url, { method: "GET", signal });
    cleanup();
    const txt = await r.text();
    let payload: any = {};
    try { payload = JSON.parse(txt); } catch { /* ignore */ }
    if (!r.ok) {
      console.error(`[material-costs/trends] upstream ${r.status} response:`, txt.slice(0, 500));
      if (r.status === 404 || r.status === 501) {
        return res.json({ ok: true, cached: false, points: [], message: "ml_upstream_missing" });
      }
      return res.status(r.status).json({ error: "upstream_error", status: r.status, detail: payload || txt });
    }
    materialTrendsCache.data = payload;
    materialTrendsCache.ts = now;
    return res.json({ ok: true, cached: false, ...payload });
  } catch (e: any) {
    console.error("[material-costs/trends] failed:", e?.message || e);
    return res.status(500).json({ error: "material_trends_failed", message: e?.message || String(e) });
  }
});

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
 * POST /ml/build-payload
 * Phase 4: Build ML payload from canonical ConfiguredProduct selections
 * Prefers configuredProduct.selections, falls back to legacy questionnaire
 * Body: { quoteId, includeLineItems?, preferCanonical? }
 */
router.post("/build-payload", async (req: any, res) => {
  try {
    const { quoteId, includeLineItems = true, preferCanonical = true } = req.body || {};
    
    if (!quoteId) {
      return res.status(400).json({ error: "quoteId_required" });
    }

    const auth = (req as any).auth || {};
    const tenantId: string | undefined = auth.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    // Verify quote belongs to tenant
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId }
    });

    if (!quote || quote.tenantId !== tenantId) {
      return res.status(404).json({ error: "quote_not_found" });
    }

    // Build payload
    const payload = await buildMLPayload(quoteId, {
      includeLineItems,
      preferCanonical
    });

    // Normalize for consistency
    const normalized = normalizeMLPayload(payload);

    return res.json({
      ok: true,
      payload: normalized,
      canonical: preferCanonical,
      lineItemsIncluded: includeLineItems
    });
  } catch (e: any) {
    console.error("[ml] /build-payload failed:", e?.message || e);
    return res.status(500).json({
      error: "build_payload_failed",
      message: e?.message || String(e)
    });
  }
});

/**
 * POST /ml/compare-payloads
 * Phase 4: Compare two ML payloads to detect changes
 * Body: { oldPayload, newPayload, significanceThreshold? }
 */
router.post("/compare-payloads", async (req: any, res) => {
  try {
    const { oldPayload, newPayload, significanceThreshold = 0.01 } = req.body || {};
    
    if (!oldPayload || !newPayload) {
      return res.status(400).json({ error: "both_payloads_required" });
    }

    const comparison = compareMLPayloads(
      oldPayload,
      newPayload,
      significanceThreshold
    );

    return res.json({
      ok: true,
      ...comparison
    });
  } catch (e: any) {
    console.error("[ml] /compare-payloads failed:", e?.message || e);
    return res.status(500).json({
      error: "compare_failed",
      message: e?.message || String(e)
    });
  }
});

/**
 * POST /ml/predict-lines
 * Forward per-line pricing requests to the ML service
 * Body: { lines: [...], currency?, markupPercent?, vatPercent?, markupDelivery?, amalgamateDelivery?, clientDeliveryGBP?, clientDeliveryDescription?, roundTo? }
 */
router.post("/predict-lines", async (req, res) => {
  try {
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const payload = req.body ?? {};
    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS);
    const r = await fetch(`${ML_URL}/predict-lines`, {
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
      console.warn(`[ml proxy] /predict-lines timed out after ${ML_TIMEOUT_MS}ms`);
      return res.status(504).json({ error: "ml_timeout", timeoutMs: ML_TIMEOUT_MS });
    }
    console.error("[ml proxy] /predict-lines failed:", msg);
    return res.status(502).json({ error: "ml_unreachable", detail: msg });
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
 * POST /ml/process-quote
 * Classify supplier vs client, parse accordingly, and apply markup/VAT for suppliers.
 * Body: { url, filename?, quotedAt?, markupPercent?, vatPercent?, markupDelivery?, amalgamateDelivery?, clientDeliveryGBP?, clientDeliveryDescription? }
 */
router.post("/process-quote", async (req: any, res) => {
  try {
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const auth = (req as any).auth || {};
    const tenantId: string | undefined = auth.tenantId;

    const { url, filename, quotedAt } = req.body || {};
    const safeUrl = normalizeAttachmentUrl(url);
    if (!safeUrl) return res.status(400).json({ error: "missing url" });

    // Defaults from env
    let defaultMarkup = Number(process.env.DEFAULT_MARKUP_PERCENT || 20);
    let defaultVat = Number(process.env.DEFAULT_VAT_PERCENT || 20);
    let defaultMarkupDelivery = String(process.env.DEFAULT_MARKUP_DELIVERY || "false").toLowerCase() === "true";

    // Try tenant settings if available
    if (tenantId) {
      try {
        const settings = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { quoteDefaults: true } });
        const qd: any = (settings?.quoteDefaults as any) || {};
        const pricing: any = qd.pricing || qd.PRICING || {};
        if (typeof pricing.markupPercent === "number") defaultMarkup = pricing.markupPercent;
        if (typeof pricing.vatPercent === "number") defaultVat = pricing.vatPercent;
        if (typeof pricing.markupDelivery === "boolean") defaultMarkupDelivery = pricing.markupDelivery;
      } catch (e) {
        console.warn("[ml proxy] failed to read tenant pricing defaults:", (e as any)?.message || e);
      }
    }

    // Allow request overrides
    const markupPercent = typeof req.body?.markupPercent === "number" ? req.body.markupPercent : defaultMarkup;
    const vatPercent = typeof req.body?.vatPercent === "number" ? req.body.vatPercent : defaultVat;
    const markupDelivery = typeof req.body?.markupDelivery === "boolean" ? req.body.markupDelivery : defaultMarkupDelivery;

    const payload = {
      url: safeUrl,
      filename,
      quotedAt,
      markupPercent,
      vatPercent,
      markupDelivery,
      amalgamateDelivery: typeof req.body?.amalgamateDelivery === "boolean" ? req.body.amalgamateDelivery : true,
      clientDeliveryGBP: typeof req.body?.clientDeliveryGBP === "number" ? req.body.clientDeliveryGBP : undefined,
      clientDeliveryDescription:
        typeof req.body?.clientDeliveryDescription === "string" ? req.body.clientDeliveryDescription : undefined,
    };

    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS);
    const f = await fetch(`${ML_URL}/process-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    cleanup();

    const text = await f.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!f.ok) {
      const msg = json?.detail || json?.error || "ml_process_failed";
      return res.status(f.status).json({ error: msg, detail: json });
    }
    return res.json(json);
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isTimeout = /timeout_/i.test(msg) || /The operation was aborted/i.test(msg);
    if (isTimeout) {
      console.warn(`[ml proxy] /process-quote timed out after ${ML_TIMEOUT_MS}ms`);
      return res.status(504).json({ error: "ml_timeout", timeoutMs: ML_TIMEOUT_MS });
    }
    console.error("[ml proxy] /process-quote failed:", msg);
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
      // Existing email-based samples require messageId + attachmentId
      let messageId = item.messageId;
      let attachmentId = item.attachmentId;

      // If missing (e.g. direct file upload with fileId / quoteId only), synthesise stable surrogate IDs
      if (!messageId || !attachmentId) {
        if (item.fileId) {
          messageId = messageId || `file_${item.fileId}`;
          attachmentId = attachmentId || `file_${item.fileId}`;
        } else if (item.quoteId) {
          messageId = messageId || `quote_${item.quoteId}`;
          attachmentId = attachmentId || `quote_${item.quoteId}`;
        } else {
          // Cannot persist sample without any anchor identifiers
          continue;
        }
      }

      try {
        await prisma.mLTrainingSample.upsert({
          where: {
            tenantId_messageId_attachmentId: {
              tenantId,
              messageId: messageId,
              attachmentId: attachmentId,
            },
          },
          create: {
            tenantId,
            messageId: messageId,
            attachmentId: attachmentId,
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
        status: "APPROVED", // Only use approved samples for training
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

    // Attempt to persist training samples locally if ML service returned them
    // Expected flexible shape: json.items OR json.training_items OR json.samples
    const rawItems: any[] = Array.isArray(json.items)
      ? json.items
      : Array.isArray(json.training_items)
      ? json.training_items
      : Array.isArray(json.samples)
      ? json.samples
      : [];

    let saved = 0;
    for (const it of rawItems) {
      try {
        const fileId = it.fileId || it.file_id || null;
        const quoteId = it.quoteId || it.quote_id || null;
        const url = String(it.url || it.downloadUrl || it.signedUrl || it.signed_url || "");
        if (!url) continue;

        // Surrogate IDs if email metadata missing
        let messageId = it.messageId || it.message_id || null;
        let attachmentId = it.attachmentId || it.attachment_id || null;
        if (!messageId || !attachmentId) {
          if (fileId) {
            messageId = messageId || `file_${fileId}`;
            attachmentId = attachmentId || `file_${fileId}`;
          } else if (quoteId) {
            messageId = messageId || `quote_${quoteId}`;
            attachmentId = attachmentId || `quote_${quoteId}`;
          } else {
            // Fallback using index to ensure persistence for anonymous item
            messageId = messageId || `clientq_${saved}`;
            attachmentId = attachmentId || `clientq_${saved}`;
          }
        }

        await prisma.mLTrainingSample.upsert({
          where: {
            tenantId_messageId_attachmentId: {
              tenantId,
              messageId: String(messageId),
              attachmentId: String(attachmentId),
            },
          },
          create: {
            tenantId,
            messageId: String(messageId),
            attachmentId: String(attachmentId),
            url,
            quotedAt: it.quotedAt ? new Date(it.quotedAt) : it.sentAt ? new Date(it.sentAt) : null,
            sourceType: (it.sourceType || it.source_type || "client_quote") as string,
            quoteId: quoteId ? String(quoteId) : undefined,
            fileId: fileId ? String(fileId) : undefined,
          },
          update: {
            url,
            quotedAt: it.quotedAt ? new Date(it.quotedAt) : it.sentAt ? new Date(it.sentAt) : null,
            sourceType: (it.sourceType || it.source_type || undefined) as string | undefined,
            quoteId: quoteId ? String(quoteId) : undefined,
            fileId: fileId ? String(fileId) : undefined,
          },
        });
        saved += 1;
      } catch (err) {
        console.warn("[train-client-quotes] upsert failed", (err as any)?.message || err);
      }
    }

    json.saved_local = saved;
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

/**
 * POST /ml/train-supplier-quotes
 * Train on supplier quotes from uploaded files in Quote Builder
 */
router.post("/train-supplier-quotes", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    // Get all uploaded supplier files from quotes
    const supplierFiles = await prisma.uploadedFile.findMany({
      where: {
        tenantId,
        kind: "SUPPLIER_QUOTE",
        // Only include files from last 90 days to keep training set fresh
        uploadedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        name: true,
        quoteId: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: "desc" },
      take: 100, // Limit to 100 most recent files
    });

    if (supplierFiles.length === 0) {
      return res.json({
        ok: true,
        message: "No supplier files found to train on",
        received_items: 0,
        parsed_ok: 0,
        failed: 0,
        training_records_saved: 0,
      });
    }

    // Build training items with signed URLs
    const items = supplierFiles.map((file) => {
      const signedUrl = buildSignedFileUrl(file.id, tenantId, file.quoteId);
      return {
        url: signedUrl,
        filename: file.name || `file_${file.id}.pdf`,
        quotedAt: file.uploadedAt ? new Date(file.uploadedAt as any).toISOString() : null,
        sourceType: "supplier_quote",
        fileId: file.id,
        quoteId: file.quoteId,
      };
    });

    // Call ML training endpoint
    const payload = {
      tenantId,
      model: "supplier_parser",
      items,
    };

    const { signal, cleanup } = withTimeout(undefined, ML_TIMEOUT_MS * 5); // Longer timeout for batch processing
    const r = await fetch(`${ML_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    cleanup();

    const text = await r.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!r.ok) {
      const msg = json?.detail || json?.error || "ml_train_failed";
      return res.status(r.status).json({ error: msg, detail: json });
    }

    // Persist training samples locally so they appear in approval UI
    let saved = 0;
    for (const it of items) {
      // synthesise stable surrogate IDs for non-email uploads
      const messageId = `file_${it.fileId || it.quoteId || saved}`; // use quoteId fallback then ordinal
      const attachmentId = `file_${it.fileId || it.quoteId || saved}`;
      try {
        await prisma.mLTrainingSample.upsert({
          where: {
            tenantId_messageId_attachmentId: {
              tenantId,
              messageId,
              attachmentId,
            },
          },
          create: {
            tenantId,
            messageId,
            attachmentId,
            url: it.url,
            quotedAt: it.quotedAt ? new Date(it.quotedAt) : null,
            sourceType: it.sourceType ?? "supplier_quote",
            quoteId: it.quoteId ?? undefined,
            fileId: it.fileId ?? undefined,
          },
          update: {
            url: it.url,
            quotedAt: it.quotedAt ? new Date(it.quotedAt) : null,
            sourceType: it.sourceType ?? undefined,
            quoteId: it.quoteId ?? undefined,
            fileId: it.fileId ?? undefined,
          },
        });
        saved += 1;
      } catch (e) {
        console.warn("[train-supplier-quotes] upsert failed", (e as any)?.message || e);
      }
    }

    // Augment response with local persistence stats
    json.training_records_saved = typeof json.training_records_saved === 'number'
      ? json.training_records_saved
      : saved;
    json.saved_local = saved;
    json.ok = json.ok !== false; // normalise ok flag
    return res.json(json);
  } catch (e: any) {
    const msg = e?.message || String(e);
    const isTimeout = /timeout_/i.test(msg) || /The operation was aborted/i.test(msg);
    if (isTimeout) {
      console.warn(`[ml proxy] /train-supplier-quotes timed out after ${ML_TIMEOUT_MS * 5}ms`);
      return res.status(504).json({ error: "ml_timeout", timeoutMs: ML_TIMEOUT_MS * 5 });
    }
    console.error("[ml proxy] /train-supplier-quotes failed:", msg);
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

/**
 * POST /ml/train-product-types
 * Train ML model with product type configurations
 */
router.post("/train-product-types", async (req, res) => {
  try {
    const { productTypes } = req.body;
    const tenantId = (req as any).auth?.tenantId;

    if (!productTypes || !Array.isArray(productTypes)) {
      return res.status(400).json({ error: "productTypes array required" });
    }

    // Extract training data from product types
    const trainingData = productTypes.flatMap((category: any) =>
      category.types.flatMap((type: any) =>
        type.options.map((option: any) => ({
          category: category.id,
          type: type.type,
          option: option.id,
          label: option.label,
          hasImage: !!(option.imagePath || option.imageDataUrl || option.svg),
        }))
      )
    );

    console.log(`[ML] Product types registered for tenant ${tenantId}:`, trainingData.length, "samples");

    res.json({ 
      success: true, 
      samplesCount: trainingData.length,
      message: "Product types registered for ML training"
    });
  } catch (error: any) {
    console.error("[ml/train-product-types] error:", error);
    res.status(500).json({ error: error.message || "internal_error" });
  }
});

/**
 * POST /ml/generate-product-svg
 * Generate SVG diagram for a product option using AI
 * Now supports both simple templates and AI-generated detailed diagrams
 */
router.post("/generate-product-svg", async (req, res) => {
  try {
    const { category, type, option, description } = req.body;

    // If description is provided, generate detailed AI diagram
    if (description) {
      return await generateDetailedDiagram(req, res);
    }

    if (!category || !type || !option) {
      return res.status(400).json({ error: "category, type, and option required" });
    }

    // Simple SVG templates based on product type
    const svgTemplates: Record<string, string> = {
      "doors-entrance": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="20" y="10" width="60" height="80" rx="2"/>
  <circle cx="75" cy="50" r="3"/>
  <line x1="30" y1="20" x2="30" y2="80"/>
</svg>`,
      "doors-bifold": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="15" y="10" width="30" height="80" rx="2"/>
  <rect x="55" y="10" width="30" height="80" rx="2"/>
  <line x1="45" y1="20" x2="55" y2="30"/>
  <line x1="45" y1="80" x2="55" y2="70"/>
</svg>`,
      "doors-sliding": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="10" y="10" width="40" height="80" rx="2" opacity="0.5"/>
  <rect x="50" y="10" width="40" height="80" rx="2"/>
  <path d="M 55 50 L 60 45 M 55 50 L 60 55" stroke-width="2"/>
</svg>`,
      "doors-french": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="15" y="10" width="30" height="80" rx="2"/>
  <rect x="55" y="10" width="30" height="80" rx="2"/>
  <circle cx="40" cy="50" r="2"/>
  <circle cx="60" cy="50" r="2"/>
</svg>`,
      "windows-sash-cord": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="20" y="15" width="60" height="70" rx="2"/>
  <line x1="20" y1="50" x2="80" y2="50"/>
  <rect x="25" y="20" width="50" height="25" rx="1" stroke-width="2"/>
  <rect x="25" y="55" width="50" height="25" rx="1" stroke-width="2"/>
</svg>`,
      "windows-sash-spring": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="20" y="15" width="60" height="70" rx="2"/>
  <line x1="20" y1="50" x2="80" y2="50"/>
  <rect x="25" y="20" width="50" height="25" rx="1" stroke-width="2"/>
  <rect x="25" y="55" width="50" height="25" rx="1" stroke-width="2"/>
  <circle cx="75" cy="30" r="2"/>
</svg>`,
      "windows-casement": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="20" y="15" width="60" height="70" rx="2"/>
  <line x1="50" y1="15" x2="50" y2="85"/>
  <rect x="25" y="20" width="20" height="60" rx="1" stroke-width="2"/>
  <rect x="55" y="20" width="20" height="60" rx="1" stroke-width="2"/>
</svg>`,
      "windows-stormproof": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="18" y="13" width="64" height="74" rx="2"/>
  <rect x="22" y="17" width="56" height="66" rx="2" stroke-width="2"/>
  <rect x="26" y="21" width="48" height="58" rx="1"/>
</svg>`,
      "windows-alu-clad": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="16" y="16" width="68" height="68" rx="2"/>
  <rect x="20" y="20" width="60" height="60" rx="2" stroke-width="2"/>
  <rect x="24" y="24" width="52" height="52" rx="1"/>
</svg>`,
    };

    // Find matching template
    const key = `${category}-${type}`;
    let svg = svgTemplates[key] || svgTemplates["windows-casement"]; // fallback

    res.json({ svg });
  } catch (error: any) {
    console.error("[ml/generate-product-svg] error:", error);
    res.status(500).json({ error: error.message || "internal_error" });
  }
});

/**
 * Generate detailed AI diagram from text description
 * (Helper function called from /generate-product-svg when description is provided)
 */
async function generateDetailedDiagram(req: any, res: any) {
  try {
    const { description, fileName } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: "description required" });
    }

    // Call OpenAI to generate SVG
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    const systemPrompt = `You are an expert technical illustrator that creates colored elevation-style joinery diagrams as SVG code.

MANDATORY RULES:
1. Output ONLY the SVG code, no markdown, no explanations, no \`\`\`svg blocks
2. Use viewBox="0 0 140 170" (width 140, height 170)
3. White background (#FFFFFF)
4. Colors:
   - Timber: #B45A4D
   - Dark timber accent: #9E4B40
   - Glass: #56DDE5
   - Lines/text: #1F1F1F
5. Stroke widths:
   - Outer frame: 2
   - Internal joinery: 1.5
   - Muntins: 1.2
   - Dimensions: 1.6
6. Font: Arial, Helvetica, sans-serif, size 12
7. Include dimension lines with:
   - Top horizontal line with width label (e.g., "800mm")
   - Left vertical line (rotated -90°) with height label (e.g., "2025mm")
   - Small tick marks at dimension line ends
8. NO gradients, shadows, scripts, or external references
9. Draw as a front elevation view with proper proportions
10. Show panels, glazing, rails, stiles, muntins as specified
11. Use <rect> for solid panels (timber color) and fill them (do not leave white)
12. Use <rect> for glass (glass color) and fill them (do not leave transparent)
13. Use fills for joinery elements; do NOT return stroke-only monochrome drawings
14. Draw dimension lines outside the main frame`;

    const userPrompt = `Create a colored joinery elevation diagram for: ${description}

Remember:
- Start with white background rectangle
- Draw outer frame in timber color
- Add glazing zones in glass color
- Add panels in timber/dark timber
- Include dimension lines and labels
- Output ONLY the SVG code`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[ml/generate-diagram] OpenAI error:", error);
      return res.status(500).json({ error: "OpenAI API error: " + (error.error?.message || "unknown") });
    }

    const data = await response.json();
    let svg = data.choices?.[0]?.message?.content?.trim() || "";

    // Clean up any markdown artifacts
    svg = svg.replace(/```svg\n?/g, "").replace(/```\n?/g, "").trim();

    // Validate SVG
    if (!svg.startsWith("<svg")) {
      return res.status(400).json({ error: "Invalid SVG generated (missing <svg tag)" });
    }

    if (svg.includes("<script")) {
      return res.status(400).json({ error: "Invalid SVG generated (contains script tags)" });
    }

    if (svg.length > 50000) {
      return res.status(400).json({ error: "SVG too large (exceeds 50KB)" });
    }

    res.json({ svg });
  } catch (error: any) {
    console.error("[ml/generate-diagram] error:", error);
    res.status(500).json({ error: error.message || "internal_error" });
  }
}

/**
 * POST /ml/save-diagram-svg
 * Save generated SVG to project files
 */
router.post("/save-diagram-svg", async (req, res) => {
  try {
    const { fileName, svg } = req.body;

    if (!fileName?.trim() || !svg?.trim()) {
      return res.status(400).json({ error: "fileName and svg required" });
    }

    // Validate SVG
    if (!svg.startsWith("<svg")) {
      return res.status(400).json({ error: "Invalid SVG" });
    }

    // Security: restrict to development or admin users
    const isAdmin = (req as any).auth?.role === "admin" || (req as any).auth?.role === "owner";
    const isDev = process.env.NODE_ENV === "development";
    
    if (!isDev && !isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Ensure .svg extension
    const safeFileName = fileName.endsWith(".svg") ? fileName : `${fileName}.svg`;
    
    // Write to diagrams directory
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const diagramsDir = path.join(process.cwd(), "../web/public/diagrams/product-types");
    await fs.mkdir(diagramsDir, { recursive: true });
    
    const filePath = path.join(diagramsDir, safeFileName);
    await fs.writeFile(filePath, svg, "utf-8");

    const publicPath = `/diagrams/product-types/${safeFileName}`;
    
    res.json({ 
      path: filePath,
      publicPath,
      message: "SVG saved successfully"
    });
  } catch (error: any) {
    console.error("[ml/save-diagram-svg] error:", error);
    res.status(500).json({ error: error.message || "internal_error" });
  }
});

export default router;
/**
 * POST /ml/search-product-type
 * Search for a product type using AI natural language understanding
 */
router.post("/search-product-type", async (req, res) => {
  try {
    const { description } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: "description required" });
    }

    // If the description mentions bi-fold doors but lacks panel/door counts, ask for clarification.
    const bifoldClarification = getBifoldClarification(description);
    if (bifoldClarification) {
      return res.json(bifoldClarification);
    }

    // Call OpenAI to match description to product type
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      // Fallback to simple keyword matching if no OpenAI key
      return fallbackProductTypeSearch(description, res);
    }

    const systemPrompt = `You are a product classifier for a joinery company. Given a description, identify the best matching product from our catalog.

Product Catalog:
Doors:
- entrance: Single Door, Double Door
- bifold: 2 Panel, 3 Panel, 4 Panel
- sliding: Single Slider, Double Slider
- french: Standard French, Extended French

Windows:
- sash-cord: Single Hung, Double Hung
- sash-spring: Single Hung, Double Hung
- casement: Single Casement, Double Casement
- stormproof: Single Stormproof, Double Stormproof
- alu-clad: Single Alu-clad, Double Alu-clad

Respond ONLY with a JSON object in this exact format:
{
  "category": "doors" or "windows",
  "type": "entrance|bifold|sliding|french|sash-cord|sash-spring|casement|stormproof|alu-clad",
  "option": "the exact option name from the list above",
  "confidence": 0.0 to 1.0
}`;

    const userPrompt = `Product description: ${description}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[ml/search-product-type] OpenAI error:", error);
      return fallbackProductTypeSearch(description, res);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "{}";

    // Clean up markdown artifacts
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const result = JSON.parse(content);

    if (result.category && result.type && result.option) {
      res.json(result);
    } else {
      return fallbackProductTypeSearch(description, res);
    }
  } catch (error: any) {
    console.error("[ml/search-product-type] error:", error);
    return fallbackProductTypeSearch(req.body.description, res);
  }
});

/**
 * Fallback product type search using simple keyword matching
 */
function fallbackProductTypeSearch(description: string, res: any) {
  const desc = description.toLowerCase();

  const bifoldClarification = getBifoldClarification(description);
  if (bifoldClarification) {
    return res.json(bifoldClarification);
  }

  // Door types
  if (desc.includes("door")) {
    if (desc.includes("bifold") || desc.includes("bi-fold") || desc.includes("bi fold")) {
      const panels = desc.match(/(\d+)\s*panel/);
      const panelCount = panels ? panels[1] : "2";
      return res.json({ category: "doors", type: "bifold", option: `${panelCount} Panel`, confidence: 0.7 });
    }
    if (desc.includes("sliding") || desc.includes("slide")) {
      const isDouble = desc.includes("double");
      return res.json({ category: "doors", type: "sliding", option: isDouble ? "Double Slider" : "Single Slider", confidence: 0.7 });
    }
    if (desc.includes("french")) {
      return res.json({ category: "doors", type: "french", option: "Standard French", confidence: 0.7 });
    }
    // Default to entrance door
    const isDouble = desc.includes("double") || desc.includes("pair");
    return res.json({ category: "doors", type: "entrance", option: isDouble ? "Double Door" : "Single Door", confidence: 0.6 });
  }

  // Window types
  if (desc.includes("window")) {
    if (desc.includes("sash")) {
      const isCord = desc.includes("cord") || desc.includes("weight");
      const isSpring = desc.includes("spring");
      const isDouble = desc.includes("double hung") || desc.includes("double-hung");
      
      if (isCord) {
        return res.json({ category: "windows", type: "sash-cord", option: isDouble ? "Double Hung" : "Single Hung", confidence: 0.8 });
      }
      if (isSpring) {
        return res.json({ category: "windows", type: "sash-spring", option: isDouble ? "Double Hung" : "Single Hung", confidence: 0.8 });
      }
      return res.json({ category: "windows", type: "sash-cord", option: isDouble ? "Double Hung" : "Single Hung", confidence: 0.6 });
    }
    if (desc.includes("casement")) {
      const isDouble = desc.includes("double") || desc.includes("pair");
      return res.json({ category: "windows", type: "casement", option: isDouble ? "Double Casement" : "Single Casement", confidence: 0.8 });
    }
    if (desc.includes("stormproof") || desc.includes("storm proof")) {
      const isDouble = desc.includes("double");
      return res.json({ category: "windows", type: "stormproof", option: isDouble ? "Double Stormproof" : "Single Stormproof", confidence: 0.8 });
    }
    if (desc.includes("alu-clad") || desc.includes("alu clad") || desc.includes("aluminium clad") || desc.includes("aluminum clad")) {
      const isDouble = desc.includes("double");
      return res.json({ category: "windows", type: "alu-clad", option: isDouble ? "Double Alu-clad" : "Single Alu-clad", confidence: 0.8 });
    }
    // Default to casement
    const isDouble = desc.includes("double");
    return res.json({ category: "windows", type: "casement", option: isDouble ? "Double Casement" : "Single Casement", confidence: 0.5 });
  }

  // No match
  res.status(404).json({ error: "No matching product type found", confidence: 0.0 });
}

function getBifoldClarification(description: string) {
  const desc = description.toLowerCase();
  const mentionsBifold = desc.includes("bifold") || desc.includes("bi-fold") || desc.includes("bi fold");
  if (!mentionsBifold) return null;

  const panelMatch = desc.match(/(\d+)\s*(panel|panels|leaf|leaves)/);
  const panelCount = panelMatch ? parseInt(panelMatch[1], 10) : null;

  // If we have a clean panel count that maps to a known option, return it directly.
  if (panelCount && [2, 3, 4].includes(panelCount)) {
    return {
      category: "doors",
      type: "bifold",
      option: `${panelCount} Panel`,
      confidence: 0.8,
    };
  }

  // Otherwise, ask the user to pick a panel count (and implicitly how many door leaves).
  return {
    clarifications: [
      {
        question: "How many panels does the bi-fold door have? (This also tells us how many door leaves)",
        options: [
          { label: "2 panels (single set)", category: "doors", type: "bifold", option: "2 Panel", hint: "One opening with two folding leaves" },
          { label: "3 panels", category: "doors", type: "bifold", option: "3 Panel", hint: "Asymmetric set with three leaves" },
          { label: "4 panels (pair of doors)", category: "doors", type: "bifold", option: "4 Panel", hint: "Wider opening or two-door pair" },
        ],
      },
    ],
    message: "Select panels so we can choose the correct bi-fold door type",
  };
}

