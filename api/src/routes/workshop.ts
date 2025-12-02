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
    select: { id: true, name: true, email: true, role: true, workshopHoursPerDay: true, workshopColor: true, workshopProcessCodes: true, passwordHash: true, firstName: true, lastName: true, emailFooter: true },
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
    select: { id: true, name: true, email: true, workshopHoursPerDay: true, workshopColor: true },
  });
  
  res.json({ ok: true, user: updated });
});

// PATCH /workshop/users/:userId/processes { processCodes: string[] }
router.patch("/users/:userId/processes", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = String(req.params.userId);
  const { processCodes } = req.body || {};
  
  if (!Array.isArray(processCodes)) {
    return res.status(400).json({ error: "invalid_process_codes" });
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
    data: { workshopProcessCodes: processCodes },
    select: { id: true, name: true, email: true, workshopProcessCodes: true },
  });
  
  res.json({ ok: true, user: updated });
});

// PATCH /workshop/users/:userId/color { color: string }
router.patch("/users/:userId/color", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = String(req.params.userId);
  const { color } = req.body || {};
  
  // Validate hex color format (optional field)
  if (color !== null && color !== undefined && color !== "") {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    if (!hexPattern.test(color)) {
      return res.status(400).json({ error: "invalid_color_format", detail: "Color must be a hex code like #3b82f6" });
    }
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
    data: { workshopColor: color || null },
    select: { id: true, name: true, email: true, workshopHoursPerDay: true, workshopColor: true },
  });
  
  res.json({ ok: true, user: updated });
});

// PATCH /workshop/users/:userId/profile { firstName?: string, lastName?: string, emailFooter?: string }
router.patch("/users/:userId/profile", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = String(req.params.userId);
  const { firstName, lastName, emailFooter } = req.body || {};
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true },
  });
  
  if (!user || user.tenantId !== tenantId) {
    return res.status(404).json({ error: "not_found" });
  }
  
  const data: any = {};
  if (firstName !== undefined) data.firstName = firstName || null;
  if (lastName !== undefined) data.lastName = lastName || null;
  if (emailFooter !== undefined) data.emailFooter = emailFooter || null;
  
  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, firstName: true, lastName: true, emailFooter: true },
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
// PATCH /workshop/process-assignment/:id/complete - Mark process assignment as complete
router.patch("/process-assignment/:id/complete", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = String(req.params.id);
  // Find the process assignment
  const assignment = await (prisma as any).projectProcessAssignment.findUnique({ where: { id } });
  if (!assignment || assignment.tenantId !== tenantId) {
    return res.status(404).json({ error: "not_found" });
  }
  // Mark as complete (set completedAt to now)
  const updated = await (prisma as any).projectProcessAssignment.update({
    where: { id },
    data: { completedAt: new Date() },
  });
  res.json({ ok: true, assignment: updated });
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

  // Projects = WON opportunities (may include historical duplicates for same lead)
  const rawProjects = await (prisma as any).opportunity.findMany({
    where: { tenantId, stage: "WON" },
    select: ({ 
      id: true, 
      title: true, 
      valueGBP: true, 
      wonAt: true, 
      startDate: true, 
      deliveryDate: true,
      installationStartDate: true,
      installationEndDate: true,
      leadId: true,
      createdAt: true,
      // Material tracking
      timberOrderedAt: true,
      timberExpectedAt: true,
      timberReceivedAt: true,
      timberNotApplicable: true,
      glassOrderedAt: true,
      glassExpectedAt: true,
      glassReceivedAt: true,
      glassNotApplicable: true,
      ironmongeryOrderedAt: true,
      ironmongeryExpectedAt: true,
      ironmongeryReceivedAt: true,
      ironmongeryNotApplicable: true,
      paintOrderedAt: true,
      paintExpectedAt: true,
      paintReceivedAt: true,
      paintNotApplicable: true,
    } as any),
    orderBy: [{ wonAt: "desc" }, { title: "asc" }],
  });

  // Deduplicate by leadId, keeping the best candidate:
  // - Prefer the record that has startDate/deliveryDate set
  // - Otherwise prefer the most recent by createdAt
  const byLead: Record<string, any[]> = {};
  for (const p of rawProjects as any[]) {
    const key = String(p.leadId || p.id);
    (byLead[key] ||= []).push(p);
  }
  const projects: any[] = Object.values(byLead).map((group: any[]) => {
    return group.reduce((best: any, cur: any) => {
      const bestScore = (best.startDate ? 1 : 0) + (best.deliveryDate ? 1 : 0);
      const curScore = (cur.startDate ? 1 : 0) + (cur.deliveryDate ? 1 : 0);
      if (curScore !== bestScore) return curScore > bestScore ? cur : best;
      // Tie-breaker: newer createdAt wins
      const bestAt = new Date(best.createdAt || 0).getTime();
      const curAt = new Date(cur.createdAt || 0).getTime();
      return curAt > bestAt ? cur : best;
    }, group[0]);
  });

  const projectIds = projects.map((p: any) => p.id);

  // Nothing to aggregate – return early to avoid empty `in: []` filters which cause errors on some drivers
  if (projectIds.length === 0) {
    return res.json({ ok: true, weeks, projects: [] });
  }

  // Fetch new process assignments (with user assignments)
  const processAssignments = await (prisma as any).projectProcessAssignment.findMany({
    where: { tenantId, opportunityId: { in: projectIds } },
    include: {
      processDefinition: true,
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

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

  const processAssignmentsByProject: Record<string, any[]> = {};
  for (const pa of processAssignments) {
    const list = (processAssignmentsByProject[pa.opportunityId] ||= []);
    list.push({
      id: pa.id,
      processCode: pa.processDefinition.code,
      processName: pa.processDefinition.name,
      sortOrder: pa.processDefinition.sortOrder || 0,
      required: pa.required,
      estimatedHours: pa.estimatedHours || pa.processDefinition.estimatedHours,
      isColorKey: pa.processDefinition.isColorKey || false,
      assignmentGroup: pa.processDefinition.assignmentGroup || null,
      assignedUser: pa.assignedUser ? {
        id: pa.assignedUser.id,
        name: pa.assignedUser.name,
        email: pa.assignedUser.email,
      } : null,
      completedAt: pa.completedAt || null,
    });
  }

  const out = (projects as any[]).map((proj: any) => ({
    id: proj.id,
    name: proj.title,
    valueGBP: proj.valueGBP,
    wonAt: proj.wonAt,
    startDate: proj.startDate,
    deliveryDate: proj.deliveryDate,
    installationStartDate: proj.installationStartDate,
    installationEndDate: proj.installationEndDate,
    // Expose material tracking to the client (including N/A flags)
    timberOrderedAt: proj.timberOrderedAt,
    timberExpectedAt: proj.timberExpectedAt,
    timberReceivedAt: proj.timberReceivedAt,
    timberNotApplicable: proj.timberNotApplicable,
    glassOrderedAt: proj.glassOrderedAt,
    glassExpectedAt: proj.glassExpectedAt,
    glassReceivedAt: proj.glassReceivedAt,
    glassNotApplicable: proj.glassNotApplicable,
    ironmongeryOrderedAt: proj.ironmongeryOrderedAt,
    ironmongeryExpectedAt: proj.ironmongeryExpectedAt,
    ironmongeryReceivedAt: proj.ironmongeryReceivedAt,
    ironmongeryNotApplicable: proj.ironmongeryNotApplicable,
    paintOrderedAt: proj.paintOrderedAt,
    paintExpectedAt: proj.paintExpectedAt,
    paintReceivedAt: proj.paintReceivedAt,
    paintNotApplicable: proj.paintNotApplicable,
    weeks,
    processPlans: plansByProject[proj.id] || [],
    processAssignments: processAssignmentsByProject[proj.id] || [], // New process assignments
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

// POST /workshop/time { projectId?, process, userId, date, hours, notes?, markComplete? }
// projectId is optional for generic hours (CLEANING, ADMIN, HOLIDAY)
// markComplete: if true and projectId + process are specified, marks that process as complete
router.post("/time", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { projectId, process, userId, date, hours, notes, markComplete } = req.body || {};
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

  // If markComplete is true and we have a projectId, mark the process as complete
  if (markComplete && projectId) {
    // Find the process definition for this process type (code matches the process enum value)
    const processDef = await prisma.workshopProcessDefinition.findFirst({
      where: { tenantId, code: String(process) },
    });

    if (processDef) {
      // Find or create the assignment and mark it complete
      await prisma.projectProcessAssignment.upsert({
        where: {
          opportunityId_processDefinitionId: {
            opportunityId: String(projectId),
            processDefinitionId: processDef.id,
          },
        },
        create: {
          tenantId,
          opportunityId: String(projectId),
          processDefinitionId: processDef.id,
          completedAt: new Date() as any,
        },
        update: {
          completedAt: new Date() as any,
        },
      });
    }
  }

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

// PATCH /workshop/process-complete - Mark a process as complete/incomplete
// Body: { projectId, processDefinitionId, completed: boolean }
router.patch("/process-complete", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { projectId, processDefinitionId, completed } = req.body || {};
  
  if (!projectId || !processDefinitionId || completed === undefined) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  // Verify the project exists and belongs to this tenant
  const project = await prisma.opportunity.findUnique({
    where: { id: String(projectId) },
  });
  if (!project || project.tenantId !== tenantId) {
    return res.status(404).json({ error: "project_not_found" });
  }

  // Update or create the assignment
  const assignment = await prisma.projectProcessAssignment.upsert({
    where: {
      opportunityId_processDefinitionId: {
        opportunityId: String(projectId),
        processDefinitionId: String(processDefinitionId),
      },
    },
    create: {
      tenantId,
      opportunityId: String(projectId),
      processDefinitionId: String(processDefinitionId),
      completedAt: (completed ? new Date() : null) as any,
    },
    update: {
      completedAt: (completed ? new Date() : null) as any,
    },
  });

  res.json({ ok: true, assignment });
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

// PATCH /workshop/project/:projectId/materials - Update material tracking
router.patch("/project/:projectId/materials", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const projectId = req.params.projectId;
  const {
    timberOrderedAt,
    timberExpectedAt,
    timberReceivedAt,
    timberNotApplicable,
    glassOrderedAt,
    glassExpectedAt,
    glassReceivedAt,
    glassNotApplicable,
    ironmongeryOrderedAt,
    ironmongeryExpectedAt,
    ironmongeryReceivedAt,
    ironmongeryNotApplicable,
    paintOrderedAt,
    paintExpectedAt,
    paintReceivedAt,
    paintNotApplicable,
  } = req.body;

  // Verify opportunity belongs to tenant
  const opp = await prisma.opportunity.findFirst({
    where: { id: projectId, tenantId },
  });

  if (!opp) {
    return res.status(404).json({ error: "project_not_found" });
  }

  // Build update object with only provided fields
  const updates: any = {};
  if (timberOrderedAt !== undefined) updates.timberOrderedAt = timberOrderedAt ? new Date(timberOrderedAt) : null;
  if (timberExpectedAt !== undefined) updates.timberExpectedAt = timberExpectedAt ? new Date(timberExpectedAt) : null;
  if (timberReceivedAt !== undefined) updates.timberReceivedAt = timberReceivedAt ? new Date(timberReceivedAt) : null;
  if (timberNotApplicable !== undefined) updates.timberNotApplicable = Boolean(timberNotApplicable);
  if (glassOrderedAt !== undefined) updates.glassOrderedAt = glassOrderedAt ? new Date(glassOrderedAt) : null;
  if (glassExpectedAt !== undefined) updates.glassExpectedAt = glassExpectedAt ? new Date(glassExpectedAt) : null;
  if (glassReceivedAt !== undefined) updates.glassReceivedAt = glassReceivedAt ? new Date(glassReceivedAt) : null;
  if (glassNotApplicable !== undefined) updates.glassNotApplicable = Boolean(glassNotApplicable);
  if (ironmongeryOrderedAt !== undefined) updates.ironmongeryOrderedAt = ironmongeryOrderedAt ? new Date(ironmongeryOrderedAt) : null;
  if (ironmongeryExpectedAt !== undefined) updates.ironmongeryExpectedAt = ironmongeryExpectedAt ? new Date(ironmongeryExpectedAt) : null;
  if (ironmongeryReceivedAt !== undefined) updates.ironmongeryReceivedAt = ironmongeryReceivedAt ? new Date(ironmongeryReceivedAt) : null;
  if (ironmongeryNotApplicable !== undefined) updates.ironmongeryNotApplicable = Boolean(ironmongeryNotApplicable);
  if (paintOrderedAt !== undefined) updates.paintOrderedAt = paintOrderedAt ? new Date(paintOrderedAt) : null;
  if (paintExpectedAt !== undefined) updates.paintExpectedAt = paintExpectedAt ? new Date(paintExpectedAt) : null;
  if (paintReceivedAt !== undefined) updates.paintReceivedAt = paintReceivedAt ? new Date(paintReceivedAt) : null;
  if (paintNotApplicable !== undefined) updates.paintNotApplicable = Boolean(paintNotApplicable);

  const updated = await prisma.opportunity.update({
    where: { id: projectId },
    data: updates,
  });

  res.json({ ok: true, project: updated });
});

// GET /workshop/timer - Get active timer for current user
router.get("/timer", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = req.auth.userId as string;

  const timer = await (prisma as any).workshopTimer.findFirst({
    where: { tenantId, userId },
    include: {
      project: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  res.json({ ok: true, timer });
});

// POST /workshop/timer/start - Start a new timer
// Body: { projectId?, process, notes? }
// projectId is optional for generic processes like HOLIDAY, ADMIN, CLEANING
router.post("/timer/start", async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const userId = req.auth.userId as string;
    const { projectId, process, notes } = req.body || {};

    if (!process) {
      return res.status(400).json({ error: "process_required" });
    }

    // If projectId is provided, verify project exists and belongs to this tenant
    if (projectId) {
      const project = await prisma.opportunity.findUnique({
        where: { id: String(projectId) },
      });
      if (!project || project.tenantId !== tenantId) {
        return res.status(404).json({ error: "project_not_found" });
      }
    }

    // Stop any existing timer for this user
    await (prisma as any).workshopTimer.deleteMany({
      where: { tenantId, userId },
    });

    // Create new timer
    const includeClause: any = {
      user: { select: { id: true, name: true, email: true } },
    };
    
    // Only include project relation if projectId is provided
    if (projectId) {
      includeClause.project = { select: { id: true, number: true, description: true } };
    }

    const timer = await (prisma as any).workshopTimer.create({
      data: {
        tenantId,
        userId,
        projectId: projectId ? String(projectId) : null,
        process: String(process),
        notes: notes ? String(notes) : null,
      },
      include: includeClause,
    });

    res.json({ ok: true, timer });
  } catch (error: any) {
    console.error('Error starting timer:', error);
    res.status(500).json({ 
      error: "internal_error", 
      message: error?.message || "Failed to start timer",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /workshop/timer/stop - Stop active timer and create time entry
router.post("/timer/stop", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = req.auth.userId as string;

  // Find active timer
  const timer = await (prisma as any).workshopTimer.findFirst({
    where: { tenantId, userId },
    orderBy: { startedAt: 'desc' },
  });

  if (!timer) {
    return res.status(404).json({ error: "no_active_timer" });
  }

  // Calculate hours worked
  const now = new Date();
  const startedAt = new Date(timer.startedAt);
  const hoursWorked = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
  const roundedHours = Math.round(hoursWorked * 4) / 4; // Round to nearest 0.25

  // Create time entry
  const timeEntry = await (prisma as any).timeEntry.create({
    data: {
      tenantId,
      projectId: timer.projectId,
      process: timer.process,
      userId,
      date: startedAt,
      hours: Math.max(0.25, roundedHours), // Minimum 0.25 hours
      notes: timer.notes,
    },
  });

  // Delete timer
  await (prisma as any).workshopTimer.delete({
    where: { id: timer.id },
  });

  res.json({ ok: true, timeEntry, hours: timeEntry.hours });
});

// DELETE /workshop/timer - Cancel active timer without creating time entry
router.delete("/timer", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = req.auth.userId as string;

  const result = await (prisma as any).workshopTimer.deleteMany({
    where: { tenantId, userId },
  });

  res.json({ ok: true, deleted: result.count });
});

export default router;
