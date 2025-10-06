import { Router } from "express";

const router = Router();

/**
 * Temporary stub: confirms the gmail router is mounted and auth is flowing.
 * Replace with real OAuth handlers once confirmed.
 */
router.get("/connection", (req, res) => {
  const authed = !!(req as any).auth;
  if (!authed) return res.status(401).json({ error: "unauthorized" });
  return res.json({ ok: true, connection: null });
});

export default router;
