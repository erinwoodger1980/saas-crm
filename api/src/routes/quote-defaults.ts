import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

/** GET /quote-defaults  (auth required; uses req.auth.tenantId) */
router.get("/", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const row = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { quoteDefaults: true },
    });

    res.json(row?.quoteDefaults || {});
  } catch (e: any) {
    console.error("[quote-defaults:get]", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

/** POST /quote-defaults  (replace defaults) */
router.post("/", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const payload = (req.body ?? {}) as Record<string, any>;
    const updated = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { quoteDefaults: payload },
      create: {
        tenantId,
        slug: "tenant-" + tenantId.slice(0, 6),
        brandName: "Brand",
        quoteDefaults: payload,
      },
      select: { quoteDefaults: true },
    });

    res.json(updated.quoteDefaults || {});
  } catch (e: any) {
    console.error("[quote-defaults:post]", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
