// api/src/routes/ml.ts
import { Router } from "express";

const router = Router();
const ML_URL = (process.env.ML_URL || "http://localhost:8000").replace(/\/$/, "");

// POST /ml/predict -> forwards to ML service
router.post("/predict", async (req, res) => {
  try {
    const b = req.body ?? {};
    // Coerce + default so FastAPI never 422s on missing/typed fields
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
    console.error("[ml proxy] failed:", e?.message || e);
    return res.status(502).json({ error: "ml_unreachable" });
  }
});

// GET /ml/health -> optional health check
router.get("/health", async (_req, res) => {
  try {
    const r = await fetch(`${ML_URL}/`, { method: "GET" });
    res.json({ ok: r.ok, target: ML_URL });
  } catch {
    res.status(502).json({ ok: false, target: ML_URL });
  }
});

export default router;