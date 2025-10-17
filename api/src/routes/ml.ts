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
    // Normalize types & provide defaults to avoid 422s downstream
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
 * Simple health probe to the ML service root.
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
 * Body: { url: "https://api.joineryai.app/gmail/message/.../attachments/...?...jwt=<token>" }
 * Forwards a single attachment URL to the ML service to extract structured quote data.
 */
router.post("/parse-quote", async (req, res) => {
  try {
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "missing url" });
    }

    const f = await fetch(`${ML_URL}/parse-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
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

export default router;