import { Router } from "express";
import { getInsights, listParams, logEvent, resetModel, retrainModel, setParam } from "../services/training";

const router = Router();

// GET /ml/insights?module=lead_classifier&limit=100
router.get("/insights", async (req: any, res) => {
  const auth = req.auth;
  if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

  const module = (req.query.module as string | undefined) || undefined;
  const limit = Math.max(1, Math.min(Number(req.query.limit ?? 100), 200));
  try {
    const items = await getInsights(auth.tenantId, module, limit);
    const params = await listParams(auth.tenantId, module);
    res.json({ ok: true, items, params });
  } catch (e: any) {
    console.error("[GET /ml/insights] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

// POST /ml/params/set { module, key, value, reason }
router.post("/params/set", async (req: any, res) => {
  const auth = req.auth;
  if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });

  const body = req.body || {};
  const module = typeof body.module === "string" && body.module ? body.module : null;
  const key = typeof body.key === "string" && body.key ? body.key : null;
  if (!module || !key) return res.status(400).json({ error: "invalid_payload" });
  try {
    await setParam({ tenantId: auth.tenantId, module, key, value: body.value, reason: body.reason ?? null, actorId: auth.userId });
    await logEvent({ tenantId: auth.tenantId, module, kind: "PARAM_CHANGE", payload: { key }, actorId: auth.userId });
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[POST /ml/params/set] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

// POST /ml/model/reset { module }
router.post("/model/reset", async (req: any, res) => {
  const auth = req.auth;
  if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  const module = (req.body?.module as string | undefined) || undefined;
  if (!module) return res.status(400).json({ error: "invalid_payload" });
  try {
    const out = await resetModel({ tenantId: auth.tenantId, module, actorId: auth.userId });
    res.json(out);
  } catch (e: any) {
    console.error("[POST /ml/model/reset] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

// POST /ml/model/retrain { module }
router.post("/model/retrain", async (req: any, res) => {
  const auth = req.auth;
  if (!auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  const module = (req.body?.module as string | undefined) || undefined;
  if (!module) return res.status(400).json({ error: "invalid_payload" });
  try {
    const out = await retrainModel({ tenantId: auth.tenantId, module, actorId: auth.userId });
    res.json(out);
  } catch (e: any) {
    console.error("[POST /ml/model/retrain] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
