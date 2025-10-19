// api/src/routes/ml.ts
import { Router } from "express";

const router = Router();
const ML_URL = (process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000")
  .trim()
  .replace(/\/$/, "");

/**
 * POST /ml/predict
 * Forwards a normalized payload to the ML service.
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

    const r = await fetch(`${ML_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
 * GET /ml/health
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
 * POST /ml/parse-quote
 * Body: { url: "https://.../gmail/message/.../attachments/...?...jwt=<token>" }
 */
router.post("/parse-quote", async (req, res) => {
  try {
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const { url, filename, quotedAt } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "missing url" });
    }

    const f = await fetch(`${ML_URL}/parse-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename, quotedAt }),
    });

    const text = await f.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!f.ok) {
      return res.status(f.status).json({ error: "ml_parse_failed", detail: json });
    }
    return res.json(json);
  } catch (e: any) {
    console.error("[ml proxy] /parse-quote failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /ml/train
 * 1) Calls /internal/ml/ingest-gmail to collect signed PDF URLs
 * 2) Sends those items to the ML server /train
 */
router.post("/train", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 500), 500));

    const API_BASE =
      (process.env.APP_API_URL ||
        process.env.API_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        `http://localhost:${process.env.PORT || 4000}`)!
        .replace(/\/$/, "");

    // 1) Collect signed attachment URLs
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

    // Map to ML schema: { messageId, attachmentId, url, filename?, quotedAt? }
    const items = Array.isArray(ingestJson.items)
      ? ingestJson.items.map((it: any) => ({
          messageId: it.messageId,
          attachmentId: it.attachmentId,
          url: it.url ?? it.downloadUrl,            // <-- FIX: ML expects `url`
          filename: it.filename ?? null,
          quotedAt: it.sentAt ?? null,              // pass the Date header (if present)
        }))
      : [];

    // 2) Send to ML /train
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