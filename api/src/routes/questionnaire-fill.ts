import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

/**
 * GET /questionnaire/fill?product=Door
 * → returns merged defaults for that product type
 */
router.get("/", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const product = (req.query.product || "").toString();
    if (!product) return res.status(400).json({ error: "missing_product" });

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { quoteDefaults: true },
    });

    const defaults = (settings?.quoteDefaults as any)?.quoteDefaults || {};
    const match = defaults[product] || {};

    return res.json({ ok: true, product, defaults: match });
  } catch (e: any) {
    console.error("[questionnaire-fill] failed:", e);
    res.status(500).json({ error: e?.message || "internal_error" });
  }
});

export default router;
