// api/src/routes/ml.ts
import { Router } from "express";

const router = Router();
const ML_URL = (process.env.ML_URL || "http://localhost:8000").replace(/\/$/, "");

// POST /ml/predict -> forwards to ML service
router.post("/predict", async (req, res) => {
  try {
    const r = await fetch(`${ML_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
    });

    const text = await r.text();
    const json = text ? JSON.parse(text) : {};
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
    const ok = r.ok;
    res.json({ ok, target: ML_URL });
  } catch {
    res.status(502).json({ ok: false, target: ML_URL });
  }
});

export default router;