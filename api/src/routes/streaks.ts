// api/src/routes/streaks.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

// Resolve from auth middleware or explicit headers (dev-friendly)
function getAuth(req: any) {
  const tenantId = req.auth?.tenantId || req.headers["x-tenant-id"];
  const userId = req.auth?.userId || req.headers["x-user-id"];
  return { tenantId: String(tenantId || ""), userId: String(userId || "") };
}

router.get("/me", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const s = await prisma.streak.findFirst({
    where: { tenantId, userId },
  });

  // If none yet, present gentle default
  res.json({
    dayCount: s?.dayCount ?? 0,
    lastActivityDate: s?.lastActivityDate ?? null,
    tip: s?.dayCount ? "On a roll—keep it going." : "A quick start keeps momentum.",
  });
});

export default router;