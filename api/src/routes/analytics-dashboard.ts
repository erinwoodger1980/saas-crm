import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Lead stats
    const totalLeads = await prisma.lead.count({ where: { tenantId } });
    const monthLeads = await prisma.lead.count({
      where: { tenantId, capturedAt: { gte: monthStart } },
    });
    const disqualified = await prisma.lead.count({
      where: { tenantId, status: "DISQUALIFIED" },
    });
    const won = await prisma.lead.count({
      where: { tenantId, status: "WON" },
    });

    // Disqualification reasons
    const reasons = await prisma.lead.findMany({
      where: { tenantId, status: "DISQUALIFIED" },
      select: { custom: true },
    });
    const reasonCounts: Record<string, number> = {};
    for (const l of reasons) {
      const reason = (l.custom as any)?.disqualifyReason || "Unspecified";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }

    res.json({
      totalLeads,
      monthLeads,
      disqualified,
      won,
      reasonCounts,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;