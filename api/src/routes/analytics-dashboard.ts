// api/src/routes/analytics-dashboard.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { tenantId } = (req as any).auth || {};
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // -------- Lead stats --------
    const totalLeads = await prisma.lead.count({ where: { tenantId } });

    const monthLeads = await prisma.lead.count({
      where: { tenantId, capturedAt: { gte: monthStart } },
    });

    const disqualified = await prisma.lead.count({
      where: { tenantId, status: "DISQUALIFIED" },
    });

    // Try to count WON from Opportunity (if schema has status there).
    // Use raw SQL to avoid TS complaining when model types differ.
    let won = 0;
    try {
      const rows = await prisma.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c
        FROM "Opportunity"
        WHERE "tenantId" = ${tenantId} AND "status" = 'WON'
      `;
      const wonFromOpp = rows?.[0]?.c ?? 0;

      // Fallback to Lead if Opportunity table doesn’t have/track status yet
      const wonFromLead = await prisma.lead.count({
        where: { tenantId, status: "WON" as any },
      });

      won = Math.max(wonFromOpp, wonFromLead);
    } catch {
      // If the Opportunity table/column isn’t present, fall back silently
      won = await prisma.lead.count({
        where: { tenantId, status: "WON" as any },
      });
    }

    // -------- Disqualification reasons --------
    const reasons = await prisma.lead.findMany({
      where: { tenantId, status: "DISQUALIFIED" },
      select: { custom: true },
    });

    const reasonCounts: Record<string, number> = {};
    for (const l of reasons) {
      const c = (l.custom as any) || {};
      // Handle both spellings/keys just in case
      const reason =
        c.disqualifiedReason || c.disqualifyReason || "Unspecified";
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
    console.error("[analytics-dashboard] failed:", err);
    res.status(500).json({ error: err?.message || "dashboard failed" });
  }
});

export default router;