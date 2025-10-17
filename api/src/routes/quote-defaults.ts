import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

// GET /quote-defaults → returns the tenant's current defaults
router.get("/", async (req, res) => {
  const { tenantId } = (req as any).auth || {};
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const s = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { quoteDefaults: true },
  });
  res.json(s?.quoteDefaults || {});
});

// PUT /quote-defaults → overwrite/update defaults
router.put("/", async (req, res) => {
  const { tenantId } = (req as any).auth || {};
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const body = req.body || {};
  const updated = await prisma.tenantSettings.update({
    where: { tenantId },
    data: { quoteDefaults: body },
    select: { quoteDefaults: true },
  });
  res.json(updated.quoteDefaults);
});

export default router;