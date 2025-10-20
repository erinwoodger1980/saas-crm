// api/src/routes/notifications.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function resolveTenantId(req: any): string {
  return req.user?.tenantId || req.headers["x-tenant-id"] || req.tenantId;
}
function resolveUserId(req: any): string | undefined {
  return req.user?.id || req.headers["x-user-id"];
}

// GET /notifications
router.get("/", async (req, res) => {
  const tenantId = resolveTenantId(req);
  const userId = resolveUserId(req);
  if (!tenantId || !userId) return res.status(400).json({ error: "Missing tenantId or userId" });

  const items = await prisma.notification.findMany({
    where: { tenantId, userId },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  res.json({ items });
});

// POST /notifications/:id/read
router.post("/:id/read", async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const id = req.params.id;
  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  res.json({ ok: true, item: updated });
});

export default router;
