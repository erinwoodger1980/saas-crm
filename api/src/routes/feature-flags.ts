// api/src/routes/feature-flags.ts
import { Router } from "express";
import { prisma } from "../db";
const router = Router();

router.post("/toggle", async (req: any, res) => {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  const { key, enabled } = req.body || {};
  if (!key) return res.status(400).json({ error: "missing_key" });

  const s = await prisma.tenantSettings.upsert({
    where: { tenantId: req.auth.tenantId },
    create: { tenantId: req.auth.tenantId, beta: { [key]: !!enabled } as any },
    update: { beta: { ...(await prisma.tenantSettings.findUnique({ where:{tenantId:req.auth.tenantId} }))?.beta, [key]: !!enabled } as any },
  });
  res.json({ ok: true, beta: s.beta });
});

export default router;