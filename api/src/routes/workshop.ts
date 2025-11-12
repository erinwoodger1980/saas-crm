import { Router } from "express";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

router.use(requireAuth);

// GET /workshop/users – simple list for assignment dropdown
router.get("/users", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, workshopHoursPerDay: true },
    orderBy: { name: "asc" },
  });
  res.json({ ok: true, items: users });
});

// PATCH /workshop/users/:userId/hours { hoursPerDay: number }
router.patch("/users/:userId/hours", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = String(req.params.userId);
  const { hoursPerDay } = req.body || {};
  
  if (hoursPerDay == null || isNaN(Number(hoursPerDay))) {
    return res.status(400).json({ error: "invalid_hours" });
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true },
  });
  
  if (!user || user.tenantId !== tenantId) {
    return res.status(404).json({ error: "not_found" });
  }
  
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { workshopHoursPerDay: Number(hoursPerDay) },
    select: { id: true, name: true, email: true, role: true, workshopHoursPerDay: true },
  });
  
  res.json({ ok: true, user: updated });
});

// GET /workshop/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD – list tenant holidays
// GET /workshop/holidays - fetch holidays for calendar
router.get("/holidays", async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const where: any = { tenantId };
    if (from && to) {
      // Overlap filter: holiday where (endDate >= from && startDate <= to)
      where.AND = [
        { endDate: { gte: from } },
        { startDate: { lte: to } },
      ];
    }

    const items = await (prisma as any).holiday.findMany({
      where,
      orderBy: { startDate: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json({ ok: true, items });
  } catch (e: any) {
    console.error("[workshop/holidays] failed:", e?.message || e);
    // Graceful fallback to avoid breaking the schedule UI
    res.setHeader("X-Workshop-Holidays-Fallback", "1");
    res.json({ ok: true, items: [], warn: "holidays_unavailable" });
  }
});

// POST /workshop/holidays { userId, startDate, endDate, notes? }
router.post("/holidays", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { userId, startDate, endDate, notes } = req.body || {};
  if (!userId || !startDate || !endDate) return res.status(400).json({ error: "invalid_payload" });

  const start = new Date(String(startDate));
  const end = new Date(String(endDate));
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return res.status(400).json({ error: "invalid_dates" });
  }

  const saved = await (prisma as any).holiday.create({
    data: {
      tenantId,
      userId: String(userId),
      startDate: start,
      endDate: end,
      notes: notes || null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  res.json({ ok: true, holiday: saved });
});

// DELETE /workshop/holidays/:id
router.delete("/holidays/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = String(req.params.id);
  const existing = await (prisma as any).holiday.findUnique({ where: { id }, select: { id: true, tenantId: true } });
  if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ error: "not_found" });
  await (prisma as any).holiday.delete({ where: { id } });
  res.json({ ok: true });
});

// GET /workshop/calendar - Calendar view showing projects spread across months
router.get("/calendar", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  
  // Get all WON opportunities with start and delivery dates
  const projects = await (prisma as any).opportunity.findMany({
    where: ({ tenantId, stage: "WON", startDate: { not: null }, deliveryDate: { not: null } } as any),
    select: ({ id: true, title: true, valueGBP: true, wonAt: true, startDate: true, deliveryDate: true } as any),
    orderBy: ([{ startDate: "asc" }, { title: "asc" }] as any),
  });

  // Calculate months to show (6 months from earliest start to latest delivery)
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const sixMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 6, 1);

  let earliestStart = sixMonthsAgo;
  let latestDelivery = sixMonthsAhead;

  (projects as any[]).forEach((p: any) => {
    if (p.startDate && p.startDate < earliestStart) earliestStart = p.startDate;
    if (p.deliveryDate && p.deliveryDate > latestDelivery) latestDelivery = p.deliveryDate;
  });

  // Generate month list
  const months: Array<{ year: number; month: number; label: string }> = [];
  const current = new Date(earliestStart.getFullYear(), earliestStart.getMonth(), 1);
  const end = new Date(latestDelivery.getFullYear(), latestDelivery.getMonth(), 1);

  while (current <= end) {
    months.push({
      year: current.getFullYear(),
      month: current.getMonth() + 1, // 1-indexed
      label: current.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    });
    current.setMonth(current.getMonth() + 1);
  }

  // Calculate value distribution per month for each project
  const projectsWithMonthlyValues = (projects as any[]).map((proj: any) => {
    const value = Number(proj.valueGBP || 0);
    const start = proj.startDate!;
    const delivery = proj.deliveryDate!;
    
    // Calculate total days in project
    const totalDays = Math.max(1, Math.ceil((delivery.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate value distribution per month
    const monthlyValues: Record<string, number> = {};
    
    months.forEach(m => {
      const monthStart = new Date(m.year, m.month - 1, 1);
      const monthEnd = new Date(m.year, m.month, 0, 23, 59, 59); // Last day of month
      
      // Check if this month overlaps with the project period
      if (monthEnd >= start && monthStart <= delivery) {
        // Calculate overlap days
        const overlapStart = monthStart < start ? start : monthStart;
        const overlapEnd = monthEnd > delivery ? delivery : monthEnd;
        const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Calculate percentage of total project in this month
        const percentage = overlapDays / totalDays;
        const monthValue = value * percentage;
        
        const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
        monthlyValues[key] = monthValue;
      }
    });

    return {
      id: proj.id,
      title: proj.title,
      valueGBP: value,
      wonAt: proj.wonAt,
      startDate: proj.startDate,
      deliveryDate: proj.deliveryDate,
      totalDays,
      monthlyValues
    };
  });

  // Calculate totals per month
  const monthlyTotals: Record<string, number> = {};
  projectsWithMonthlyValues.forEach(proj => {
    Object.entries(proj.monthlyValues).forEach(([key, value]) => {
      monthlyTotals[key] = (monthlyTotals[key] || 0) + value;
    });
  });

  res.json({ 
    ok: true, 
    months,
    projects: projectsWithMonthlyValues,
    monthlyTotals
  });
});

// GET /workshop/schedule?weeks=4 - Legacy week-based view
router.get("/schedule", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const weeks = Math.max(1, Math.min(Number(req.query.weeks ?? 4), 8));

  // Projects = WON opportunities
  const projects = await (prisma as any).opportunity.findMany({
    where: { tenantId, stage: "WON" },
    select: ({ id: true, title: true, valueGBP: true, wonAt: true, startDate: true, deliveryDate: true } as any),
    orderBy: [{ wonAt: "desc" }, { title: "asc" }],
  });

  const projectIds = (projects as any[]).map((p: any) => p.id);

  // Nothing to aggregate – return early to avoid empty `in: []` filters which cause errors on some drivers
  if (projectIds.length === 0) {
    return res.json({ ok: true, weeks, projects: [] });
  }

  const plans = await (prisma as any).processPlan.findMany({
    where: { tenantId, projectId: { in: projectIds } },
    include: { assignee: { select: { id: true, name: true } } },
  });

  const totals = await (prisma as any).timeEntry.groupBy({
    by: ["projectId", "process"],
    where: { tenantId, projectId: { in: projectIds } },
    _sum: { hours: true },
  });

  const totalsByProject: Record<string, { byProcess: Record<string, number>; total: number }> = {};
  for (const row of totals) {
    const pid = row.projectId as string;
    const proc = row.process as string;
    const hrs = Number(row._sum.hours || 0);
    if (!totalsByProject[pid]) totalsByProject[pid] = { byProcess: {}, total: 0 };
    totalsByProject[pid].byProcess[proc] = (totalsByProject[pid].byProcess[proc] || 0) + hrs;
    totalsByProject[pid].total += hrs;
  }

  const plansByProject: Record<string, any[]> = {};
  for (const p of plans) {
    const list = (plansByProject[p.projectId] ||= []);
    list.push({
      id: p.id,
      process: p.process,
      plannedWeek: p.plannedWeek,
      assignedUser: p.assignee ? { id: p.assignee.id, name: p.assignee.name } : null,
      notes: p.notes || null,
    });
  }

  const out = (projects as any[]).map((proj: any) => ({
    id: proj.id,
    name: proj.title,
    valueGBP: proj.valueGBP,
    wonAt: proj.wonAt,
    startDate: proj.startDate,
    deliveryDate: proj.deliveryDate,
    weeks,
    processPlans: plansByProject[proj.id] || [],
    totalHoursByProcess: totalsByProject[proj.id]?.byProcess || {},
    totalProjectHours: totalsByProject[proj.id]?.total || 0,
  }));

  res.json({ ok: true, weeks, projects: out });
});

// POST /workshop/plan { projectId, process, plannedWeek, assignedUserId? }
router.post("/plan", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { projectId, process, plannedWeek, assignedUserId, notes } = req.body || {};
  if (!projectId || !process || !plannedWeek) return res.status(400).json({ error: "invalid_payload" });

  // Upsert by composite key (tenantId, projectId, process)
  const existing = await (prisma as any).processPlan.findFirst({ where: { tenantId, projectId, process } });
  const data: any = {
    tenantId,
    projectId,
    process,
    plannedWeek: Math.max(1, Math.min(Number(plannedWeek), 8)),
    assignedUserId: assignedUserId || null,
    notes: notes || null,
  };

  const saved = existing
    ? await (prisma as any).processPlan.update({ where: { id: existing.id }, data })
    : await (prisma as any).processPlan.create({ data });

  return res.json({ ok: true, plan: saved });
});

// PATCH /workshop/plan/:id { plannedWeek?, assignedUserId?, notes? }
router.patch("/plan/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = String(req.params.id);
  const plan = await (prisma as any).processPlan.findUnique({ where: { id } });
  if (!plan || plan.tenantId !== tenantId) return res.status(404).json({ error: "not_found" });

  const updates: Record<string, any> = {};
  if (req.body?.plannedWeek != null) {
    (updates as any).plannedWeek = Math.max(1, Math.min(Number(req.body.plannedWeek), 8));
  }
  if ("assignedUserId" in (req.body || {})) (updates as any).assignedUserId = req.body.assignedUserId || null;
  if ("notes" in (req.body || {})) (updates as any).notes = req.body.notes || null;

  const saved = await (prisma as any).processPlan.update({ where: { id }, data: updates });
  res.json({ ok: true, plan: saved });
});

// GET /workshop/time?projectId=...&process=...
router.get("/time", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const projectId = String(req.query.projectId || "");
  const process = String(req.query.process || "");
  if (!projectId || !process) return res.status(400).json({ error: "invalid_query" });

  const items = await (prisma as any).timeEntry.findMany({
    where: { tenantId, projectId, process },
    select: { id: true, date: true, hours: true, notes: true, user: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });
  const total = (items as Array<{ hours?: number | string | null }>).reduce((s: number, x) => s + Number(x.hours || 0), 0);
  res.json({ ok: true, items, total });
});

// POST /workshop/time { projectId?, process, userId, date, hours, notes? }
// projectId is optional for generic hours (CLEANING, ADMIN, HOLIDAY)
router.post("/time", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { projectId, process, userId, date, hours, notes } = req.body || {};
  if (!process || !userId || !date || hours == null) return res.status(400).json({ error: "invalid_payload" });

  const entry = await (prisma as any).timeEntry.create({
    data: {
      tenantId,
      projectId: projectId ? String(projectId) : null,
      process: String(process) as any,
      userId: String(userId),
      date: new Date(date),
      hours: new Prisma.Decimal(Number(hours)),
      notes: notes || null,
    },
  });
  res.json({ ok: true, entry });
});

router.delete("/time/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = String(req.params.id);
  const existing = await (prisma as any).timeEntry.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ error: "not_found" });
  await (prisma as any).timeEntry.delete({ where: { id } });
  res.json({ ok: true });
});

// PATCH /workshop/project/:id - Update project start and delivery dates
router.patch("/project/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = String(req.params.id);
  
  const opportunity = await prisma.opportunity.findUnique({ where: { id } });
  if (!opportunity || opportunity.tenantId !== tenantId) {
    return res.status(404).json({ error: "not_found" });
  }

  const updates: any = {};
  if (req.body.startDate !== undefined) {
    updates.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
  }
  if (req.body.deliveryDate !== undefined) {
    updates.deliveryDate = req.body.deliveryDate ? new Date(req.body.deliveryDate) : null;
  }
  if (req.body.valueGBP !== undefined) {
    updates.valueGBP = req.body.valueGBP ? Number(req.body.valueGBP) : null;
  }

  const updated = await prisma.opportunity.update({
    where: { id },
    data: updates
  });

  res.json({ ok: true, opportunity: updated });
});

// POST /workshop/backfill
// Creates WON opportunities for any WON leads that don't yet have an associated opportunity.
router.post("/backfill", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;

  // Find WON leads without an opportunity
  const wonLeads = await prisma.lead.findMany({
    where: {
      tenantId,
      status: "WON" as any,
      opportunity: { is: null },
    },
    select: { id: true, contactName: true, capturedAt: true },
    orderBy: { capturedAt: "desc" },
  });

  if (!wonLeads.length) return res.json({ ok: true, created: 0, details: [] });

  const created: Array<{ leadId: string; opportunityId: string; title: string }> = [];

  for (const lead of wonLeads) {
    // Try to pull a title/value from the most recent quote for this lead
    const latestQuote = await prisma.quote.findFirst({
      where: { tenantId, leadId: lead.id },
      orderBy: { updatedAt: "desc" },
      select: { title: true, totalGBP: true, updatedAt: true },
    });

    const title = latestQuote?.title || lead.contactName || "Project";
    const wonAt = latestQuote?.updatedAt || new Date();

    const opp = await prisma.opportunity.create({
      data: {
        tenantId,
        leadId: lead.id,
        title,
        stage: "WON" as any,
        wonAt,
        valueGBP: (latestQuote as any)?.totalGBP ?? undefined,
      },
      select: { id: true, title: true },
    });

    created.push({ leadId: lead.id, opportunityId: opp.id, title: opp.title });
  }

  res.json({ ok: true, created: created.length, details: created });
});

export default router;
