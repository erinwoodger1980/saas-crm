// api/src/routes/ml.ts
import { Router } from "express";
import { prisma } from "../db";
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

    const items = Array.isArray(ingestJson.items)
      ? ingestJson.items.map((it: any) => ({
          messageId: it.messageId,
          attachmentId: it.attachmentId,
          url: normalizeAttachmentUrl(it.url ?? it.downloadUrl),
          filename: it.filename ?? null,
          quotedAt: it.sentAt ?? null,
        })).filter((x: any) => !!x.url)
      : [];

    const trainResp = await fetch(`${ML_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, items }),
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

    if (!trainResp.ok) {
      return res.status(trainResp.status).json({
        error: "ml_train_failed",
        detail: trainJson,
        modelVersionId: recorded?.modelVersionId ?? null,
        awaitingApproval: recorded?.awaitingApproval ?? false,
      });
    }

    return res.json({
      ok: true,
      tenantId,
      received: items.length,
      ml: trainJson,
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