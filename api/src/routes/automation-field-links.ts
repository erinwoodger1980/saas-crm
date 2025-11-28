import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function resolveTenantId(req: any): string {
  return (
    req.auth?.tenantId ||
    req.user?.tenantId ||
    (req.headers["x-tenant-id"] as string) ||
    (req as any).tenantId ||
    ""
  );
}

// GET /automation/field-links
router.get("/field-links", async (req: any, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });
  try {
    const items = await (prisma as any).taskFieldLink.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "failed" });
  }
});

// POST /automation/field-links
router.post("/field-links", async (req: any, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { model, fieldPath, label, completionCondition, onTaskComplete } = req.body || {};
  if (!model || !fieldPath) return res.status(400).json({ error: "model_and_fieldPath_required" });

  try {
    const created = await (prisma as any).taskFieldLink.create({
      data: { tenantId, model, fieldPath, label, completionCondition, onTaskComplete },
    });
    res.json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "failed" });
  }
});

// PUT /automation/field-links/:id
router.put("/field-links/:id", async (req: any, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const { model, fieldPath, label, completionCondition, onTaskComplete } = req.body || {};

  try {
    const updated = await (prisma as any).taskFieldLink.update({
      where: { id },
      data: { model, fieldPath, label, completionCondition, onTaskComplete },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "failed" });
  }
});

// DELETE /automation/field-links/:id
router.delete("/field-links/:id", async (req: any, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  try {
    await (prisma as any).taskFieldLink.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "failed" });
  }
});

export default router;
