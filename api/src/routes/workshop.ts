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
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  res.json({ ok: true, items: users });
});

// GET /workshop/schedule?weeks=4
router.get("/schedule", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const weeks = Math.max(1, Math.min(Number(req.query.weeks ?? 4), 8));

  // Projects = WON opportunities
  const projects = await prisma.opportunity.findMany({
    where: { tenantId, stage: "WON" },
    select: { id: true, title: true, valueGBP: true, wonAt: true },
    orderBy: [{ wonAt: "desc" }, { title: "asc" }],
  });

  const projectIds = projects.map((p) => p.id);

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

  const out = projects.map((proj) => ({
    id: proj.id,
    name: proj.title,
    valueGBP: proj.valueGBP,
    wonAt: proj.wonAt,
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

// POST /workshop/time { projectId, process, userId, date, hours, notes? }
router.post("/time", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { projectId, process, userId, date, hours, notes } = req.body || {};
  if (!projectId || !process || !userId || !date || hours == null) return res.status(400).json({ error: "invalid_payload" });

  const entry = await (prisma as any).timeEntry.create({
    data: {
      tenantId,
      projectId: String(projectId),
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
