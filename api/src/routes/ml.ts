// api/src/routes/ml.ts
import { Router } from "express";

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
const ML_TIMEOUT_MS = Math.max(1000, Number(process.env.ML_TIMEOUT_MS || 10000));

// Build your API base once (same logic you used earlier)
const API_BASE = (
  process.env.APP_API_URL ??
  process.env.API_URL ??
  process.env.RENDER_EXTERNAL_URL ??
  `http://localhost:${process.env.PORT || 4000}`
).replace(/\/$/, "");

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

    if (!trainResp.ok) {
      return res.status(trainResp.status).json({ error: "ml_train_failed", detail: trainJson });
    }

    return res.json({ ok: true, tenantId, received: items.length, ml: trainJson });
  } catch (e: any) {
    console.error("[ml/train] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;