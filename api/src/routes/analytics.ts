// api/src/routes/analytics.ts
import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
  };
}

/**
 * GET /analytics/source-trends?months=6
 * Returns per-source monthly: leads, wins, spend, CPL, CPS
 *
 * Assumptions:
 * - Lead.custom.source -> string (e.g. "Google Ads", "Facebook", "Referrals")
 * - TenantSettings.links may include budgets, but we’ll keep spend in a new table (LeadSourceSpend)
 */
router.get("/source-trends", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);

  // Aggregate leads and wins per source per month
  const leads = await prisma.lead.findMany({
    where: { tenantId },
    select: {
      id: true,
      status: true,
      capturedAt: true,
      custom: true,
    },
  });

  // Optional: monthly spend per source (new table)
  const spends = await prisma.leadSourceSpend.findMany({
    where: {
      tenantId,
      month: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1) },
    },
  });

  // Build a YYYY-MM key
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // Seed months array
  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(ym(d));
  }

  type Row = { leads: number; wins: number; spend: number };
  const bySource: Record<string, Record<string, Row>> = {};

  // init grid
  const ensure = (src: string, key: string) => {
    bySource[src] ??= {};
    bySource[src][key] ??= { leads: 0, wins: 0, spend: 0 };
    return bySource[src][key];
  };

  // count leads/wins
  for (const l of leads) {
    const d = l.capturedAt ? new Date(l.capturedAt) : now;
    const key = ym(new Date(d.getFullYear(), d.getMonth(), 1));
    if (!monthKeys.includes(key)) continue;

    const src = (l.custom as any)?.source || "Unknown";
    const row = ensure(src, key);
    row.leads += 1;
    if (String(l.status).toUpperCase() === "WON") row.wins += 1;
  }

  // add spend
  for (const s of spends) {
    const key = ym(s.month);
    if (!monthKeys.includes(key)) continue;
    const row = ensure(s.source, key);
    row.spend += Number(s.amountGBP || 0);
  }

  // shape response
  const series = Object.keys(bySource).map((source) => {
    const points = monthKeys.map((k) => {
      const r = bySource[source][k] || { leads: 0, wins: 0, spend: 0 };
      const cpl = r.leads ? r.spend / r.leads : null;
      const cps = r.wins ? r.spend / r.wins : null;
      return { month: k, leads: r.leads, wins: r.wins, spend: r.spend, cpl, cps };
    });
    return { source, points };
  });

  res.json({ months: monthKeys, series });
});

/**
 * POST /analytics/budget-suggest
 * Body: { totalBudgetGBP: number, months?: number }
 * Heuristic: allocate more to sources with lower CPS (or CPL fallback) and marked scalable.
 * Requires LeadSourceConfig.scalable boolean to exist per source (optional—defaults scalable=true).
 */
router.post("/budget-suggest", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { totalBudgetGBP, months = 3 } = req.body || {};
  if (!totalBudgetGBP || totalBudgetGBP <= 0) {
    return res.status(400).json({ error: "totalBudgetGBP required > 0" });
  }

  const from = new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1);
  const leads = await prisma.lead.findMany({
    where: { tenantId, capturedAt: { gte: from } },
    select: { status: true, custom: true },
  });
  const spends = await prisma.leadSourceSpend.findMany({
    where: { tenantId, month: { gte: from } },
  });
  const configs = await prisma.leadSourceConfig.findMany({ where: { tenantId } });

  // aggregate per source
  const agg: Record<
    string,
    { leads: number; wins: number; spend: number; scalable: boolean }
  > = {};
  const use = (src: string) => (agg[src] ??= { leads: 0, wins: 0, spend: 0, scalable: true });
  for (const l of leads) {
    const src = (l.custom as any)?.source || "Unknown";
    const a = use(src);
    a.leads++;
    if (String(l.status).toUpperCase() === "WON") a.wins++;
  }
  for (const s of spends) {
    const a = use(s.source);
    a.spend += Number(s.amountGBP || 0);
  }
  for (const c of configs) {
    const a = use(c.source);
    a.scalable = c.scalable ?? true;
  }

  // score by CPS (fallback CPL); filter scalable
  const entries = Object.entries(agg)
    .filter(([, v]) => v.scalable)
    .map(([source, v]) => {
      const cps = v.wins ? v.spend / v.wins : null;
      const cpl = v.leads ? v.spend / v.leads : null;
      // lower is better; fallback to CPL*3 when no wins yet
      const score = cps ?? (cpl != null ? cpl * 3 : Infinity);
      return { source, cps, cpl, score };
    })
    .filter((e) => isFinite(e.score));

  if (!entries.length) {
    return res.json({ recommendations: [], note: "No scalable sources with data." });
  }

  // weights = inverse of score
  const inv = entries.map((e) => ({ ...e, w: 1 / Math.max(e.score, 1e-6) }));
  const sumW = inv.reduce((a, b) => a + b.w, 0);
  const recs = inv.map((e) => ({
    source: e.source,
    recommendedGBP: (e.w / sumW) * totalBudgetGBP,
    basis: { cps: e.cps, cpl: e.cpl },
  }));

  res.json({ recommendations: recs, months });
});

export default router;