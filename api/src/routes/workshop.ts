import { Router } from "express";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { logOrderFlow } from "../lib/order-flow-log";
import { z } from "zod";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

function parseUtcDateRangeStart(value: unknown, fallback: Date): Date {
  const s = typeof value === "string" ? value : undefined;
  if (!s) return fallback;
  // If user supplies YYYY-MM-DD, treat it as the start of that day in UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function parseUtcDateRangeEnd(value: unknown, fallback: Date): Date {
  const s = typeof value === "string" ? value : undefined;
  if (!s) return fallback;
  // If user supplies YYYY-MM-DD, treat it as the end of that day in UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T23:59:59.999Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

// Calculate distance between two lat/lng points in meters using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

router.use(requireAuth);

// GET /workshop/users – simple list for assignment dropdown
router.get("/users", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, isInstaller: true, isWorkshopUser: true, workshopHoursPerDay: true, workshopColor: true, workshopProcessCodes: true, passwordHash: true, firstName: true, lastName: true, emailFooter: true, isEarlyAdopter: true },
    orderBy: { name: "asc" },
  });
  res.json({ ok: true, items: users });
});

// GET /workshop/team-activity?from=YYYY-MM-DD&to=YYYY-MM-DD – view all users and their daily logged work
router.get("/team-activity", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const fromFallback = new Date(new Date().setDate(new Date().getDate() - 7));
  const toFallback = new Date();
  const from = parseUtcDateRangeStart(req.query.from, fromFallback);
  const to = parseUtcDateRangeEnd(req.query.to, toFallback);
  let users = [];
  let entries = [];
  let errorWarning = null;
  try {
    // Get all users
    users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true, workshopColor: true, profilePictureUrl: true },
      orderBy: { name: "asc" },
    });
  } catch (userErr: any) {
    console.error('[team-activity] Failed to load users:', userErr?.message || userErr);
    return res.status(500).json({ error: 'internal_error', message: 'Failed to load users', details: userErr?.message });
  }

  try {
    // Get time entries for the period
    entries = await (prisma as any).timeEntry.findMany({
      where: {
        tenantId,
        date: { gte: from, lte: to },
      },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: [{ date: "desc" }, { userId: "asc" }],
    });
  } catch (entryErr: any) {
    console.error('[team-activity] Failed to load time entries:', entryErr?.message || entryErr);
    errorWarning = 'Failed to load time entries.';
    entries = [];
  }

  // Group by user and date
  const userActivity: Record<string, any> = {};
  for (const u of users) {
    userActivity[u.id] = {
      user: { id: u.id, name: u.name, email: u.email, workshopColor: u.workshopColor, profilePictureUrl: u.profilePictureUrl },
      days: {} as Record<string, any[]>,
    };
  }

  for (const e of entries) {
    const uid = e.userId;
    if (!userActivity[uid]) continue;
    const dateKey = new Date(e.date).toISOString().split('T')[0];
    if (!userActivity[uid].days[dateKey]) userActivity[uid].days[dateKey] = [];
    userActivity[uid].days[dateKey].push({
      id: e.id,
      process: e.process,
      hours: Number(e.hours || 0),
      notes: e.notes,
      startedAt: (e as any).startedAt || null,
      endedAt: (e as any).endedAt || null,
      project: e.project ? { id: e.project.id, title: e.project.title } : null,
    });
  }

  res.json({ ok: true, from, to, users: Object.values(userActivity), warning: errorWarning });
});

// GET /workshop/projects - List all active projects with time totals (JobSheet view)
router.get("/projects", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;

  // Get all WON opportunities
  const rawProjects = await (prisma as any).opportunity.findMany({
    where: { tenantId, stage: "WON" },
    select: {
      id: true,
      title: true,
      valueGBP: true,
      startDate: true,
      deliveryDate: true,
      wonAt: true,
      leadId: true,
      createdAt: true,
    },
    orderBy: [{ startDate: "desc" }, { title: "asc" }],
  });

  // Deduplicate by leadId (prefer records with dates set)
  const byLead: Record<string, any[]> = {};
  for (const p of rawProjects) {
    const key = String(p.leadId || p.id);
    (byLead[key] ||= []).push(p);
  }
  const projects = Object.values(byLead).map((group) => {
    return group.reduce((best, cur) => {
      const bestScore = (best.startDate ? 1 : 0) + (best.deliveryDate ? 1 : 0);
      const curScore = (cur.startDate ? 1 : 0) + (cur.deliveryDate ? 1 : 0);
      if (curScore !== bestScore) return curScore > bestScore ? cur : best;
      return new Date(cur.createdAt || 0).getTime() > new Date(best.createdAt || 0).getTime() ? cur : best;
    }, group[0]);
  });

  if (projects.length === 0) {
    return res.json({ ok: true, projects: [] });
  }

  const projectIds = projects.map((p: any) => p.id);

  // Get time entry totals per project
  const totals = await (prisma as any).timeEntry.groupBy({
    by: ["projectId"],
    where: { tenantId, projectId: { in: projectIds } },
    _sum: { hours: true },
  });

  const totalsByProject: Record<string, number> = {};
  for (const row of totals) {
    totalsByProject[row.projectId] = Number(row._sum.hours || 0);
  }

  // Return project list with totals
  const result = projects.map((p: any) => ({
    id: p.id,
    name: p.title,
    startDate: p.startDate,
    deliveryDate: p.deliveryDate,
    wonAt: p.wonAt,
    totalHours: totalsByProject[p.id] || 0,
    status: p.deliveryDate && new Date(p.deliveryDate) < new Date() ? "completed" : "active",
  }));

  res.json({ ok: true, projects: result });
});

// GET /workshop/projects/:projectId - Project detail with person/process breakdown
router.get("/projects/:projectId", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const projectId = req.params.projectId;

  const project = await (prisma as any).opportunity.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      valueGBP: true,
      startDate: true,
      deliveryDate: true,
      wonAt: true,
      tenantId: true,
    },
  });

  if (!project || project.tenantId !== tenantId) {
    return res.status(404).json({ error: "project_not_found" });
  }

  // Get all time entries for this project grouped by user and process
  const entries = await (prisma as any).timeEntry.findMany({
    where: { tenantId, projectId },
    include: {
      user: { select: { id: true, name: true, email: true, workshopColor: true } },
    },
    orderBy: [{ userId: "asc" }, { process: "asc" }],
  });

  // Group by user, then by process
  const userMap = new Map<string, any>();
  for (const entry of entries) {
    if (!userMap.has(entry.userId)) {
      userMap.set(entry.userId, {
        user: {
          id: entry.user.id,
          name: entry.user.name || entry.user.email,
          email: entry.user.email,
          workshopColor: entry.user.workshopColor,
        },
        processes: new Map<string, number>(),
        total: 0,
      });
    }
    const userData = userMap.get(entry.userId)!;
    const hours = Number(entry.hours || 0);
    userData.processes.set(
      entry.process,
      (userData.processes.get(entry.process) || 0) + hours
    );
    userData.total += hours;
  }

  // Convert to array format
  const breakdown = Array.from(userMap.values()).map((ud) => {
    const processesArray: { process: string; hours: number }[] = [];
    ud.processes.forEach((hours: number, process: string) => {
      processesArray.push({ process, hours });
    });
    return {
      user: ud.user,
      processes: processesArray,
      total: ud.total,
    };
  });

  // Calculate project total
  const projectTotal = breakdown.reduce((sum, b) => sum + b.total, 0);

  res.json({
    ok: true,
    project: {
      id: project.id,
      name: project.title,
      startDate: project.startDate,
      deliveryDate: project.deliveryDate,
      totalHours: projectTotal,
    },
    breakdown,
  });
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

// PATCH /workshop/users/:userId/holiday-allowance { holidayAllowance: number }
router.patch("/users/:userId/holiday-allowance", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = String(req.params.userId);
  const { holidayAllowance } = req.body || {};
  
  if (holidayAllowance == null || isNaN(Number(holidayAllowance))) {
    return res.status(400).json({ error: "invalid_allowance" });
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
    data: { holidayAllowance: Number(holidayAllowance) },
    select: { id: true, name: true, email: true, holidayAllowance: true },
  });
  
  res.json({ ok: true, user: updated });
});

// PATCH /workshop/users/:userId/profile-picture { profilePictureUrl: string }
router.patch("/users/:userId/profile-picture", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = String(req.params.userId);
  const { profilePictureUrl } = req.body || {};
  
  if (!profilePictureUrl || typeof profilePictureUrl !== 'string') {
    return res.status(400).json({ error: "invalid_profile_picture_url" });
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
    data: { profilePictureUrl },
    select: { id: true, name: true, email: true, profilePictureUrl: true },
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

// PATCH /workshop/users/:userId/early-adopter { isEarlyAdopter: boolean }
router.patch("/users/:userId/early-adopter", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { userId } = req.params;
  const { isEarlyAdopter } = req.body;
  
  if (typeof isEarlyAdopter !== "boolean") {
    return res.status(400).json({ error: "isEarlyAdopter must be a boolean" });
  }
  
  try {
    // Verify user belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isEarlyAdopter },
      select: { id: true, name: true, email: true, isEarlyAdopter: true },
    });
    
    res.json({ ok: true, user: updated });
  } catch (e: any) {
    console.error("[PATCH /users/:userId/early-adopter] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /workshop/users/:userId/workshop-user { isWorkshopUser: boolean }
router.patch("/users/:userId/workshop-user", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { userId } = req.params;
  const { isWorkshopUser } = req.body;

  if (typeof isWorkshopUser !== "boolean") {
    return res.status(400).json({ error: "isWorkshopUser must be a boolean" });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isWorkshopUser },
      select: { id: true, name: true, email: true, role: true, isInstaller: true, isWorkshopUser: true },
    });

    res.json({ ok: true, user: updated });
  } catch (e: any) {
    console.error("[PATCH /users/:userId/workshop-user] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
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

// PATCH /workshop/process-assignment/:id { assignedUserId?: string | null }
// Allows reassigning work between users (used by drag/drop scheduling UIs)
router.patch("/process-assignment/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = String(req.params.id);

  const assignment = await (prisma as any).projectProcessAssignment.findUnique({
    where: { id },
    include: { assignedUser: { select: { id: true, name: true, email: true } } },
  });
  if (!assignment || assignment.tenantId !== tenantId) {
    return res.status(404).json({ error: "not_found" });
  }

  const updates: any = {};
  if (Object.prototype.hasOwnProperty.call(req.body || {}, "assignedUserId")) {
    const assignedUserId = req.body?.assignedUserId ? String(req.body.assignedUserId) : null;
    if (assignedUserId) {
      const u = await prisma.user.findFirst({ where: { id: assignedUserId, tenantId }, select: { id: true } });
      if (!u) return res.status(400).json({ error: "invalid_user" });
    }
    updates.assignedUserId = assignedUserId;
  }

  const saved = await (prisma as any).projectProcessAssignment.update({
    where: { id },
    data: updates,
    include: { assignedUser: { select: { id: true, name: true, email: true } } },
  });
  res.json({ ok: true, assignment: saved });
});

// PATCH /workshop/process-assignments/assign { projectId, assignedUserId }
// Bulk-assign any unassigned, incomplete process assignments for a project.
router.patch("/process-assignments/assign", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const projectId = String(req.body?.projectId || "");
  const assignedUserId = String(req.body?.assignedUserId || "");
  if (!projectId || !assignedUserId) return res.status(400).json({ error: "invalid_payload" });

  const u = await prisma.user.findFirst({ where: { id: assignedUserId, tenantId }, select: { id: true } });
  if (!u) return res.status(400).json({ error: "invalid_user" });

  const result = await (prisma as any).projectProcessAssignment.updateMany({
    where: {
      tenantId,
      opportunityId: projectId,
      completedAt: null,
      assignedUserId: null,
    },
    data: { assignedUserId },
  });

  res.json({ ok: true, updated: Number((result as any)?.count || 0) });
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
  const tenantId = req.auth?.tenantId as string;
  const weeks = Math.max(1, Math.min(Number(req.query.weeks ?? 4), 8));

  // Projects = WON opportunities (may include historical duplicates for same lead)
  let rawProjects: any[] = [];
  try {
    rawProjects = await (prisma as any).opportunity.findMany({
      where: { tenantId, stage: "WON" },
      select: ({
        id: true,
        title: true,
        number: true,
        valueGBP: true,
        contractValue: true,
        wonAt: true,
        startDate: true,
        deliveryDate: true,
        installationStartDate: true,
        installationEndDate: true,
        groupId: true,
        parentOpportunityId: true,
        group: { select: { id: true, name: true } },
        leadId: true,
        createdAt: true,
        lead: { select: { id: true, status: true, custom: true } },
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
  } catch (e: any) {
    console.error("[workshop/schedule] Failed to load projects:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }

  // Order Desk uses Lead.custom.uiStatus ("COMPLETED") as the source of truth for completed orders.
  // Keep the schedule aligned by excluding leads marked as completed.
  const rawActiveProjects = (rawProjects as any[]).filter((p: any) => {
    const uiStatus = String(p?.lead?.custom?.uiStatus || "").toUpperCase();
    return uiStatus !== "COMPLETED";
  });

  // Deduplicate by leadId, keeping the best candidate:
  // - Prefer the record that has startDate/deliveryDate set
  // - Otherwise prefer the most recent by createdAt
  const byLead: Record<string, any[]> = {};
  for (const p of rawActiveProjects as any[]) {
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

  // Fetch new process assignments (with user assignments) — best effort
  let processAssignments: any[] = [];
  try {
    processAssignments = await (prisma as any).projectProcessAssignment.findMany({
      where: { tenantId, opportunityId: { in: projectIds } },
      include: {
        processDefinition: true,
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (e: any) {
    console.warn("[workshop/schedule] Failed to load process assignments:", e?.message || e);
    processAssignments = [];
  }

  let plans: any[] = [];
  try {
    plans = await (prisma as any).processPlan.findMany({
      where: { tenantId, projectId: { in: projectIds } },
      include: { assignee: { select: { id: true, name: true } } },
    });
  } catch (e: any) {
    console.warn("[workshop/schedule] Failed to load plans:", e?.message || e);
    plans = [];
  }

  let totals: any[] = [];
  try {
    totals = await (prisma as any).timeEntry.groupBy({
      by: ["projectId", "process"],
      where: { tenantId, projectId: { in: projectIds } },
      _sum: { hours: true },
    });
  } catch (e: any) {
    console.warn("[workshop/schedule] Failed to load time totals:", e?.message || e);
    totals = [];
  }

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
    number: proj.number,
    valueGBP: proj.valueGBP,
    contractValue: proj.contractValue,
    groupId: proj.groupId || null,
    groupName: proj.group?.name || null,
    parentOpportunityId: proj.parentOpportunityId || null,
    wonAt: proj.wonAt,
    startDate: proj.startDate,
    deliveryDate: proj.deliveryDate,
    installationStartDate: proj.installationStartDate,
    installationEndDate: proj.installationEndDate,
    leadUiStatus: (proj.lead as any)?.custom?.uiStatus || null,
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
  const { projectId, process, userId, date, hours, notes, markComplete, startedAt, endedAt } = req.body || {};
  if (!process || !userId || !date || hours == null) return res.status(400).json({ error: "invalid_payload" });

  const startedAtDate = startedAt ? new Date(String(startedAt)) : null;
  const endedAtDate = endedAt ? new Date(String(endedAt)) : null;
  if (startedAtDate && Number.isNaN(startedAtDate.getTime())) {
    return res.status(400).json({ error: "invalid_startedAt" });
  }
  if (endedAtDate && Number.isNaN(endedAtDate.getTime())) {
    return res.status(400).json({ error: "invalid_endedAt" });
  }

  const entry = await (prisma as any).timeEntry.create({
    data: {
      tenantId,
      projectId: projectId ? String(projectId) : null,
      process: String(process) as any,
      userId: String(userId),
      date: new Date(date),
      startedAt: startedAtDate,
      endedAt: endedAtDate,
      hours: new Prisma.Decimal(Number(hours)),
      notes: notes || null,
    },
  });

  logOrderFlow("workshop_time_logged", {
    tenantId,
    orderId: projectId ? String(projectId) : null,
    process: String(process),
    hours: Number(hours),
    userId: String(userId),
  });

  // If we have a projectId, mark process as in_progress (unless it's being marked complete)
  if (projectId && !markComplete) {
    const processDef = await prisma.workshopProcessDefinition.findFirst({
      where: { tenantId, code: String(process) },
    });

    if (processDef) {
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
          status: 'in_progress',
        },
        update: {
          status: 'in_progress',
        },
      });
    }
  }

  // If markComplete is true and we have a projectId, mark the process as complete
  if (markComplete && projectId) {
    // Find the process definition for this process type (code matches the process enum value)
    const processDef = await prisma.workshopProcessDefinition.findFirst({
      where: { tenantId, code: String(process) },
    });

    if (processDef) {
      // Find or create the assignment and mark it complete
      const assignment = await prisma.projectProcessAssignment.upsert({
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
          status: 'completed',
          completedAt: new Date() as any,
          completionComments: req.body.completionComments || null,
        },
        update: {
          status: 'completed',
          completedAt: new Date() as any,
          completionComments: req.body.completionComments || null,
        },
      });

      // Check if this is the last manufacturing or installation process
      if (processDef.isLastManufacturing || processDef.isLastInstallation) {
        const project = await prisma.opportunity.findUnique({
          where: { id: String(projectId) },
        });

        if (project) {
          let newStage = project.stage;
          
          if (processDef.isLastManufacturing && !processDef.isLastInstallation) {
            newStage = 'COMPLETE_NOT_INSTALLED' as any;
          } else if (processDef.isLastInstallation) {
            newStage = 'COMPLETE' as any;
          }

          if (newStage !== project.stage) {
            await prisma.opportunity.update({
              where: { id: String(projectId) },
              data: { stage: newStage },
            });
          }
        }
      }
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

// PATCH /workshop/time/:id { hours?, notes?, date?, projectId?, process? }
// Admin/owner only: used for manual corrections when timers were missed.
router.patch("/time/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const role = String(req.auth?.role || "").toLowerCase();
  if (role !== "owner" && role !== "admin") {
    return res.status(403).json({ error: "only_admins_can_edit_time" });
  }

  const id = String(req.params.id);
  const existing = await (prisma as any).timeEntry.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenantId) {
    return res.status(404).json({ error: "not_found" });
  }

  const body = req.body || {};
  const updates: Record<string, any> = {};

  if ("hours" in body) {
    const n = Number(body.hours);
    if (!Number.isFinite(n)) return res.status(400).json({ error: "invalid_hours" });
    updates.hours = new Prisma.Decimal(n);
  }
  if ("notes" in body) {
    updates.notes = body.notes ? String(body.notes) : null;
  }
  if ("date" in body) {
    if (!body.date) return res.status(400).json({ error: "invalid_date" });
    const d = new Date(String(body.date));
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "invalid_date" });
    updates.date = d;
  }
  if ("projectId" in body) {
    updates.projectId = body.projectId ? String(body.projectId) : null;
  }
  if ("process" in body) {
    if (!body.process) return res.status(400).json({ error: "invalid_process" });
    updates.process = String(body.process);
  }

  if ("startedAt" in body) {
    if (!body.startedAt) {
      updates.startedAt = null;
    } else {
      const d = new Date(String(body.startedAt));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "invalid_startedAt" });
      updates.startedAt = d;
    }
  }
  if ("endedAt" in body) {
    if (!body.endedAt) {
      updates.endedAt = null;
    } else {
      const d = new Date(String(body.endedAt));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "invalid_endedAt" });
      updates.endedAt = d;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "no_changes" });
  }

  const entry = await (prisma as any).timeEntry.update({ where: { id }, data: updates });
  res.json({ ok: true, entry });
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
    if (!req.body.startDate) {
      updates.startDate = null;
    } else {
      const d = new Date(String(req.body.startDate));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "invalid_startDate" });
      updates.startDate = d;
    }
  }
  if (req.body.deliveryDate !== undefined) {
    if (!req.body.deliveryDate) {
      updates.deliveryDate = null;
    } else {
      const d = new Date(String(req.body.deliveryDate));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "invalid_deliveryDate" });
      updates.deliveryDate = d;
    }
  }
  if (req.body.installationStartDate !== undefined) {
    if (!req.body.installationStartDate) {
      updates.installationStartDate = null;
    } else {
      const d = new Date(String(req.body.installationStartDate));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "invalid_installationStartDate" });
      updates.installationStartDate = d;
    }
  }
  if (req.body.installationEndDate !== undefined) {
    if (!req.body.installationEndDate) {
      updates.installationEndDate = null;
    } else {
      const d = new Date(String(req.body.installationEndDate));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "invalid_installationEndDate" });
      updates.installationEndDate = d;
    }
  }
  if (req.body.valueGBP !== undefined) {
    updates.valueGBP = req.body.valueGBP ? Number(req.body.valueGBP) : null;
  }
  if (req.body.contractValue !== undefined) {
    updates.contractValue = req.body.contractValue ? Number(req.body.contractValue) : null;
  }
  // Allow { netValue } as an alias for updating contractValue
  if (req.body.netValue !== undefined && req.body.contractValue === undefined) {
    updates.contractValue = req.body.netValue ? Number(req.body.netValue) : null;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "no_changes" });
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

// POST /workshop/backfill-assignments
// Create default process assignments for WON opportunities that have none yet.
router.post("/backfill-assignments", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;

  // Find WON projects without any assignments
  const projects = await prisma.opportunity.findMany({
    where: {
      tenantId,
      stage: 'WON' as any,
    },
    select: { id: true },
  });

  if (!projects.length) return res.json({ ok: true, updated: 0 });

  const projectIds = projects.map(p => p.id);

  const existingAssignments = await prisma.projectProcessAssignment.findMany({
    where: { tenantId, opportunityId: { in: projectIds } },
    select: { opportunityId: true },
  });

  const projectsWithAssignments = new Set(existingAssignments.map(a => a.opportunityId));
  const targets = projectIds.filter(id => !projectsWithAssignments.has(id));

  if (!targets.length) return res.json({ ok: true, updated: 0 });

  // Load tenant process definitions
  const defs = await prisma.workshopProcessDefinition.findMany({
    where: { tenantId },
    orderBy: { sortOrder: 'asc' },
  });

  if (!defs.length) return res.json({ ok: true, updated: 0 });

  // Create assignments for requiredByDefault processes
  const requiredDefs = defs.filter(d => d.requiredByDefault !== false);

  let createdCount = 0;
  for (const pid of targets) {
    for (const d of requiredDefs) {
      try {
        await prisma.projectProcessAssignment.create({
          data: {
            tenantId,
            opportunityId: pid,
            processDefinitionId: d.id,
            status: 'pending' as any,
            estimatedHours: d.estimatedHours ?? null,
            required: true,
          },
        });
        createdCount++;
      } catch (e: any) {
        // Ignore duplicates
        if (e?.code !== 'P2002') throw e;
      }
    }
  }

  res.json({ ok: true, updated: createdCount, projectsUpdated: targets.length });
});
// POST /workshop/repair-won-stages
// For tenants where imported WON leads created opportunities with a non-WON stage,
// update opportunities to stage WON so they appear in the schedule.
router.post("/repair-won-stages", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  // Find opportunities not marked WON but whose lead is WON
  const affected = await prisma.opportunity.findMany({
    where: {
      tenantId,
      NOT: { stage: 'WON' as any },
      lead: { status: 'WON' as any },
    },
    select: { id: true },
  });

  if (!affected.length) return res.json({ ok: true, updated: 0 });

  const ids = affected.map(a => a.id);
  await prisma.opportunity.updateMany({
    where: { id: { in: ids }, tenantId },
    data: { stage: 'WON' as any, wonAt: new Date() },
  });

  res.json({ ok: true, updated: ids.length });
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

// GET /workshop/timers/active - Get all active timers for tenant (for showing who's working)
router.get("/timers/active", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;

  const timers = await (prisma as any).workshopTimer.findMany({
    where: { tenantId },
    select: { userId: true },
  });

  res.json({ ok: true, timers });
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
      task: { select: { id: true, title: true, taskType: true, relatedType: true, relatedId: true, dueAt: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  res.json({ ok: true, timer });
});

// POST /workshop/timer/start - Start a new timer
// Body: { projectId?, process, notes?, latitude?, longitude?, accuracy?, taskId? }
// projectId is optional for generic processes like HOLIDAY, ADMIN, CLEANING
// taskId is optional to link the timer to a specific task
router.post("/timer/start", async (req: any, res) => {
  let assignmentWarning = null;
  try {
    const tenantId = req.auth.tenantId as string;
    const authUserId = req.auth.userId as string;
    const role = String(req.auth?.role || "").toLowerCase();
    const { projectId, process, notes, latitude, longitude, accuracy, userId: requestedUserId, taskId } = req.body || {};
    const userId = (requestedUserId && (role === "owner" || role === "admin")) ? String(requestedUserId) : authUserId;

    console.log(`[timer/start] tenant=${tenantId} user=${userId} projectId=${projectId} process=${process} location=${latitude},${longitude}`);

    if (!process) {
      return res.status(400).json({ error: "process_required" });
    }

    // Get user to check if they're an installer (bypasses geofence)
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isInstaller: true },
    });
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    // Get tenant geofence settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { 
        geofenceEnabled: true,
        geofenceLatitude: true,
        geofenceLongitude: true,
        geofenceRadiusMeters: true
      }
    });

    let outsideGeofence = false;
    let geofenceWarning = null;

    // Check geofence if enabled and user is not an installer
    if (tenant?.geofenceEnabled && !user?.isInstaller && latitude && longitude && tenant.geofenceLatitude && tenant.geofenceLongitude) {
      const distance = calculateDistance(
        latitude,
        longitude,
        tenant.geofenceLatitude,
        tenant.geofenceLongitude
      );
      const radiusMeters = tenant.geofenceRadiusMeters || 100;
      
      if (distance > radiusMeters) {
        outsideGeofence = true;
        geofenceWarning = `Clocked in ${Math.round(distance)}m from workshop (allowed: ${Math.round(radiusMeters)}m)`;
        console.warn(`[timer/start] User ${userId} outside geofence: ${distance}m vs ${radiusMeters}m`);
      }
    }

    // If projectId is provided, verify project exists and belongs to this tenant
    if (projectId) {
      const project = await prisma.opportunity.findUnique({
        where: { id: String(projectId) },
        select: { id: true, tenantId: true },
      });
      if (!project || project.tenantId !== tenantId) {
        return res.status(404).json({ error: "project_not_found" });
      }
    }

    // Atomically stop any existing timer for this user by creating a time entry first
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await (tx as any).workshopTimer.findFirst({
          where: { tenantId, userId },
          orderBy: { startedAt: 'desc' },
        });
        if (existing) {
          const startedAt = new Date(existing.startedAt);
          const now = new Date();
          const hoursWorked = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
          const finalHours = Math.max(0.01, hoursWorked); // Minimum 0.01 hours (exact minutes, no rounding)
          await (tx as any).timeEntry.create({
            data: {
              tenantId,
              userId,
              projectId: existing.projectId, // Can be null for generic processes
              process: existing.process,
              hours: finalHours,
              notes: existing.notes || null,
              date: startedAt, // Use original start time, not now
              startedAt,
              endedAt: now,
              taskId: existing.taskId, // Link time entry to task if timer was started from task
            },
          });
          await (tx as any).workshopTimer.delete({ where: { id: existing.id } });
        }
      });
    } catch (txErr: any) {
      console.error('[timer/start] transaction failed:', txErr?.message || txErr);
      console.error('[timer/start] transaction error details:', txErr);
      assignmentWarning = 'Failed to stop previous timer or create time entry.';
    }

    // Create new timer
    const includeClause: any = {
      user: { select: { id: true, name: true, email: true } },
    };
    if (projectId) {
      includeClause.project = { select: { id: true, title: true, number: true, description: true } };
    }

    let timer = null;
    try {
      timer = await (prisma as any).workshopTimer.create({
        data: {
          tenantId,
          userId,
          projectId: projectId ? String(projectId) : null,
          process: String(process),
          notes: notes ? String(notes) : null,
          latitude: latitude || null,
          longitude: longitude || null,
          locationAccuracy: accuracy || null,
          locationCaptured: (latitude && longitude) ? new Date() : null,
          outsideGeofence,
          taskId: taskId ? String(taskId) : null,
        },
        include: includeClause,
      });
    } catch (timerErr: any) {
      console.error('[timer/start] failed to create new timer:', timerErr?.message || timerErr);
      return res.status(500).json({ error: "internal_error", message: timerErr?.message || "Failed to create timer" });
    }

    // Mark process as in_progress if projectId is provided
    if (projectId) {
      try {
        // Resolve process by code or name fallback
        let processDef = await prisma.workshopProcessDefinition.findFirst({
          where: { tenantId, code: String(process) },
        });
        if (!processDef) {
          processDef = await prisma.workshopProcessDefinition.findFirst({
            where: {
              tenantId,
              name: { equals: String(process), mode: 'insensitive' } as any,
            },
          });
          if (processDef) {
            console.warn(`[timer/start] Process code not found; matched by name ${processDef.name} (${processDef.code})`);
          }
        }

        if (!processDef) {
          console.error(`[timer/start] process_not_found for tenant=${tenantId} codeOrName=${process}`);
          assignmentWarning = `Process ${String(process)} not defined.`;
        } else {
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
              status: 'in_progress',
            },
            update: {
              status: 'in_progress',
            },
          });
        }
      } catch (upErr: any) {
        console.error('[timer/start] upsert assignment failed:', upErr?.message || upErr);
        assignmentWarning = 'Failed to update process assignment.';
      }
    }

    // Combine warnings
    const warnings = [assignmentWarning, geofenceWarning].filter(Boolean);
    const warning = warnings.length > 0 ? warnings.join('; ') : null;

    res.json({ ok: true, timer, warning, outsideGeofence });
  } catch (error: any) {
    console.error('Error starting timer:', error);
    console.error('Error name:', error?.name);
    console.error('Error code:', error?.code);
    console.error('Prisma error meta:', error?.meta);
    res.status(500).json({ 
      error: "internal_error", 
      message: error?.message || "Failed to start timer",
      code: error?.code,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /workshop/timer/stop - Stop active timer and create time entry
router.post("/timer/stop", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const authUserId = req.auth.userId as string;
  const role = String(req.auth?.role || "").toLowerCase();
  const requestedUserId = (req.body || {})?.userId;
  const userId = (requestedUserId && (role === "owner" || role === "admin")) ? String(requestedUserId) : authUserId;

  console.log(`[timer/stop] Request from user ${userId}, tenant ${tenantId}`);

  // Find active timer
  const timer = await (prisma as any).workshopTimer.findFirst({
    where: { tenantId, userId },
    orderBy: { startedAt: 'desc' },
  });

  if (!timer) {
    console.error(`[timer/stop] No active timer found for user ${userId}`);
    return res.status(404).json({ error: "no_active_timer", details: "No active timer found" });
  }

  console.log(`[timer/stop] Found timer ${timer.id}, projectId=${timer.projectId}, process=${timer.process}`);

  // Calculate hours worked (exact minutes, no rounding)
  const now = new Date();
  const startedAt = new Date(timer.startedAt);
  const hoursWorked = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
  const finalHours = Math.max(0.01, hoursWorked); // Minimum 0.01 hours (0.6 minutes)

  // Create time entry
  const timeEntry = await (prisma as any).timeEntry.create({
    data: {
      tenantId,
      projectId: timer.projectId, // Can be null for generic processes
      process: timer.process,
      userId,
      date: startedAt,
      startedAt,
      endedAt: now,
      hours: finalHours,
      notes: timer.notes,
      taskId: timer.taskId, // Link time entry to task if timer was started from task
    },
  });

  // Delete timer
  await (prisma as any).workshopTimer.delete({
    where: { id: timer.id },
  });

  console.log(`[timer/stop] Timer ${timer.id} deleted successfully, logged ${timeEntry.hours} hours`);
  res.json({ ok: true, timeEntry, hours: timeEntry.hours });
});

// DELETE /workshop/timer - Cancel active timer without creating time entry
router.delete("/timer", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const authUserId = req.auth.userId as string;
  const role = String(req.auth?.role || "").toLowerCase();
  const requestedUserId = req.query?.userId;
  const userId = (requestedUserId && (role === "owner" || role === "admin")) ? String(requestedUserId) : authUserId;

  const result = await (prisma as any).workshopTimer.deleteMany({
    where: { tenantId, userId },
  });

  res.json({ ok: true, deleted: result.count });
});

// PATCH /workshop/process-status - Update process status and optionally mark complete
// Body: { projectId, processCode, status: 'in_progress' | 'completed', completionComments? }
router.patch("/process-status", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const { projectId, processCode, status, completionComments } = req.body || {};
  
  if (!projectId || !processCode || !status) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    console.log(`[process-status] Request: projectId=${projectId}, processCode=${processCode}, status=${status}`);
    
    // Find the process definition
    const processDef = await prisma.workshopProcessDefinition.findFirst({
      where: { tenantId, code: processCode },
    });

    if (!processDef) {
      console.error(`[process-status] Process definition not found: ${processCode} for tenant ${tenantId}`);
      return res.status(404).json({ error: "process_not_found", details: `Process ${processCode} not found` });
    }

    console.log(`[process-status] Found process definition: ${processDef.id} (${processDef.name})`);

    // Verify the project exists
    const project = await prisma.opportunity.findUnique({
      where: { id: projectId },
      select: { id: true, tenantId: true },
    });

    if (!project) {
      console.error(`[process-status] Project not found: ${projectId}`);
      return res.status(404).json({ error: "project_not_found", details: `Project ${projectId} not found` });
    }

    if (project.tenantId !== tenantId) {
      console.error(`[process-status] Project tenant mismatch: ${project.tenantId} vs ${tenantId}`);
      return res.status(403).json({ error: "forbidden", details: "Project belongs to different tenant" });
    }

    console.log(`[process-status] Upserting assignment for project ${projectId} and process ${processDef.id}`);

    // Update or create the assignment
    const assignment = await prisma.projectProcessAssignment.upsert({
      where: {
        opportunityId_processDefinitionId: {
          opportunityId: projectId,
          processDefinitionId: processDef.id,
        },
      },
      create: {
        tenantId,
        opportunityId: projectId,
        processDefinitionId: processDef.id,
        status,
        completedAt: status === 'completed' ? new Date() : null,
        completionComments: completionComments || null,
      },
      update: {
        status,
        completedAt: status === 'completed' ? new Date() : undefined,
        completionComments: status === 'completed' ? (completionComments || null) : undefined,
      },
      include: {
        processDefinition: true,
      },
    });

    console.log(`[process-status] Assignment ${assignment.id} updated successfully`);

    // If marking as completed and this is the last manufacturing or installation process, update project status
    if (status === 'completed' && (processDef.isLastManufacturing || processDef.isLastInstallation)) {
      const projectFull = await prisma.opportunity.findUnique({
        where: { id: projectId },
      });

      if (projectFull) {
        let newStage = projectFull.stage;
        
        if (processDef.isLastManufacturing && !processDef.isLastInstallation) {
          // Last manufacturing process - mark as complete not installed
          newStage = 'COMPLETE_NOT_INSTALLED' as any;
        } else if (processDef.isLastInstallation) {
          // Last installation process - mark as complete
          newStage = 'COMPLETE' as any;
        }

        if (newStage !== projectFull.stage) {
          console.log(`[process-status] Updating project stage from ${projectFull.stage} to ${newStage}`);
          await prisma.opportunity.update({
            where: { id: projectId },
            data: { stage: newStage },
          });
        }
      }
    }

    console.log(`[process-status] Success, returning assignment`);
    res.json({ ok: true, assignment });
  } catch (e: any) {
    console.error("[process-status] Error:", e);
    console.error("[process-status] Stack:", e.stack);
    return res.status(500).json({ error: "internal_error", message: e.message, details: e.stack });
  }
});

// GET /workshop/my-timesheet - Get time entries for a specific user in a date range
router.get("/my-timesheet", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = req.query.userId as string;
  const fromFallback = new Date(new Date().setDate(new Date().getDate() - 7));
  const toFallback = new Date();
  const from = parseUtcDateRangeStart(req.query.from, fromFallback);
  const to = parseUtcDateRangeEnd(req.query.to, toFallback);

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  try {
    const entries = await (prisma as any).timeEntry.findMany({
      where: {
        tenantId,
        userId,
        date: {
          gte: from,
          lte: to,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            number: true,
            title: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    res.json({
      entries: (entries || []).map((e: any) => ({
        id: e.id,
        hours: Number(e.hours || 0),
        date: new Date(e.date).toISOString().split("T")[0],
        notes: e.notes || null,
        process: e.process,
        startedAt: e.startedAt || null,
        endedAt: e.endedAt || null,
        project: e.project
          ? {
              id: e.project.id,
              name: e.project.title,
              number: e.project.number || null,
            }
          : null,
      })),
    });
  } catch (e: any) {
    console.error("[my-timesheet] Error:", e);
    return res.status(500).json({ error: "Failed to load timesheet", message: e.message });
  }
});

// GET /workshop/holiday-requests - Get all holiday requests (admins see all, users see their own)
router.get("/holiday-requests", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = req.auth.userId as string;
  const role = req.auth.role as string;

  try {
    const where: any = { tenantId };
    
    // Non-admins can only see their own requests
    if (!['owner', 'admin'].includes(role?.toLowerCase() || '')) {
      where.userId = userId;
    }

    const requests = await (prisma as any).holidayRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            holidayAllowance: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests });
  } catch (e: any) {
    console.error("[holiday-requests] Error:", e);
    return res.status(500).json({ error: "Failed to load holiday requests", message: e.message });
  }
});

// POST /workshop/holiday-requests - Create a new holiday request
router.post("/holiday-requests", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = req.auth.userId as string;
  const { startDate, endDate, reason } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required" });
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    // Calculate number of days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days

    const request = await (prisma as any).holidayRequest.create({
      data: {
        tenantId,
        userId,
        startDate: start,
        endDate: end,
        days: diffDays,
        reason: reason || null,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create a task for admin approval (non-blocking)
    (async () => {
      try {
        // Find owner/admin users for assignment
        const admins = await prisma.user.findMany({
          where: {
            tenantId,
            role: { in: ['owner', 'admin'] },
          },
          select: { id: true, email: true, name: true },
        });

        if (admins.length > 0) {
          const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          
          const task = await prisma.task.create({
            data: {
              tenantId,
              title: `Review Holiday Request: ${request.user.name || 'User'}`,
              description: `${request.user.name || 'A user'} has requested ${diffDays} day${diffDays !== 1 ? 's' : ''} of holiday from ${formatDate(start)} to ${formatDate(end)}.\n\nReason: ${reason || 'No reason provided'}\n\nPlease review and approve or deny this request in Settings > Holidays.`,
              status: 'OPEN',
              priority: 'MEDIUM',
              taskType: 'MANUAL',
              relatedType: 'OTHER',
              relatedId: request.id,
              assignees: {
                create: admins.map(admin => ({
                  tenantId,
                  userId: admin.id,
                })),
              },
            },
          });

          // Send email notification to admins
          const { sendAdminEmail } = await import('../services/email-notification');
          const { env } = await import('../env');
          
          const baseUrl = env.WEB_URL || 'https://app.joineryai.app';
          const taskLink = `${baseUrl}/tasks?id=${task.id}`;
          const holidaysLink = `${baseUrl}/settings/holidays`;

          for (const admin of admins) {
            if (admin.email) {
              await sendAdminEmail({
                to: admin.email,
                subject: `Holiday Request: ${request.user.name || 'User'} - ${diffDays} days`,
                html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .value { margin-top: 4px; font-size: 14px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; }
    .footer { padding: 15px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">🏖️ Holiday Request Awaiting Approval</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Employee</div>
        <div class="value">${request.user.name || 'Unknown'} (${request.user.email})</div>
      </div>
      
      <div class="field">
        <div class="label">Dates</div>
        <div class="value">${formatDate(start)} - ${formatDate(end)}</div>
      </div>
      
      <div class="field">
        <div class="label">Duration</div>
        <div class="value">${diffDays} day${diffDays !== 1 ? 's' : ''}</div>
      </div>
      
      ${reason ? `
      <div class="field">
        <div class="label">Reason</div>
        <div class="value">${reason}</div>
      </div>
      ` : ''}
      
      <div style="margin-top: 20px;">
        <a href="${holidaysLink}" class="button">Review Request</a>
        <a href="${taskLink}" style="margin-left: 10px; color: #3b82f6; text-decoration: none;">View Task →</a>
      </div>
    </div>
    <div class="footer">
      JoineryAI - Holiday Management System
    </div>
  </div>
</body>
</html>
                `,
              }).catch(err => {
                console.error(`[holiday-requests] Failed to send email to ${admin.email}:`, err);
              });
            }
          }

          console.log(`[holiday-requests] Created task ${task.id} and notified ${admins.length} admin(s)`);
        }
      } catch (taskError) {
        console.error("[holiday-requests] Failed to create task/send notification:", taskError);
        // Don't fail the request if task creation fails
      }
    })();

    res.json({ ok: true, request });
  } catch (e: any) {
    console.error("[holiday-requests] Error:", e);
    return res.status(500).json({ error: "Failed to create holiday request", message: e.message });
  }
});

// PATCH /workshop/holiday-requests/:id - Approve or deny a holiday request (admin only)
router.patch("/holiday-requests/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const role = req.auth.role as string;
  const requestId = req.params.id;
  const { status, adminNotes } = req.body;

  // Only admins can approve/deny
  if (!['owner', 'admin'].includes(role?.toLowerCase() || '')) {
    return res.status(403).json({ error: "Only administrators can approve/deny holiday requests" });
  }

  if (!['approved', 'denied'].includes(status)) {
    return res.status(400).json({ error: "Status must be 'approved' or 'denied'" });
  }

  try {
    const request = await (prisma as any).holidayRequest.update({
      where: {
        id: requestId,
        tenantId,
      },
      data: {
        status,
        adminNotes: adminNotes || null,
        approvedAt: status === 'approved' ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({ ok: true, request });
  } catch (e: any) {
    console.error("[holiday-requests] Error:", e);
    return res.status(500).json({ error: "Failed to update holiday request", message: e.message });
  }
});

// DELETE /workshop/holiday-requests/:id - Delete a holiday request
router.delete("/holiday-requests/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = req.auth.userId as string;
  const role = req.auth.role as string;
  const requestId = req.params.id;

  try {
    const request = await (prisma as any).holidayRequest.findUnique({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      return res.status(404).json({ error: "Holiday request not found" });
    }

    // Users can only delete their own pending requests, admins can delete any
    const isAdmin = ['owner', 'admin'].includes(role?.toLowerCase() || '');
    if (!isAdmin && (request.userId !== userId || request.status !== 'pending')) {
      return res.status(403).json({ error: "You can only delete your own pending requests" });
    }

    await (prisma as any).holidayRequest.delete({
      where: { id: requestId },
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[holiday-requests] Error:", e);
    return res.status(500).json({ error: "Failed to delete holiday request", message: e.message });
  }
});

// GET /workshop/holiday-balance - Get holiday balance for current user
router.get("/holiday-balance", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = req.auth.userId as string;

  try {
    // Get user's annual allowance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { holidayAllowance: true },
    });

    const allowance = user?.holidayAllowance || 0;

    // Get current year
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    // Get approved holiday requests for current year
    const approvedRequests = await (prisma as any).holidayRequest.findMany({
      where: {
        tenantId,
        userId,
        status: 'approved',
        startDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      select: {
        days: true,
      },
    });

    const used = approvedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
    const remaining = allowance - used;

    res.json({ 
      allowance, 
      used, 
      remaining,
      year: currentYear,
    });
  } catch (e: any) {
    console.error("[holiday-balance] Error:", e);
    return res.status(500).json({ error: "Failed to calculate holiday balance", message: e.message });
  }
});

// ============================================================================
// Timber tracking (running metres, deliveries, usage logs)
// ============================================================================

const timberCategoryEnumValues = ["TIMBER_HARDWOOD", "TIMBER_SOFTWOOD"] as const;

router.get("/timber/materials", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;

  const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "true";

  const items = await prisma.material.findMany({
    where: {
      tenantId,
      category: { in: timberCategoryEnumValues as any },
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      unitCost: true,
      currency: true,
      unit: true,
      thickness: true,
      width: true,
      length: true,
      species: true,
      grade: true,
      finish: true,
      isActive: true,
      notes: true,
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  res.json({ ok: true, items });
});

router.get("/timber/usage", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const opportunityId = String(req.query.opportunityId || "");
  if (!opportunityId) return res.status(400).json({ error: "missing_opportunityId" });

  const project = await (prisma as any).opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, tenantId: true, title: true },
  });
  if (!project || project.tenantId !== tenantId) return res.status(404).json({ error: "project_not_found" });

  const logs = await (prisma as any).timberUsageLog.findMany({
    where: { tenantId, opportunityId },
    include: {
      material: { select: { id: true, name: true, code: true, unitCost: true, currency: true, unit: true, thickness: true, width: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ usedAt: "desc" }, { createdAt: "desc" }],
  });

  // Determine cost per metre per material: latest delivery line wins, fallback to material.unitCost
  const materialIds = Array.from(new Set(logs.map((l: any) => l.materialId)));
  const latestDeliveryLines = await (prisma as any).timberDeliveryLine.findMany({
    where: { tenantId, materialId: { in: materialIds } },
    orderBy: [{ createdAt: "desc" }],
  });
  const latestByMaterial = new Map<string, any>();
  for (const line of latestDeliveryLines) {
    if (!latestByMaterial.has(line.materialId)) latestByMaterial.set(line.materialId, line);
  }

  let totalMm = 0;
  let totalCost = 0;
  for (const l of logs) {
    const qty = Number(l.quantity || 0);
    const mm = Number(l.lengthMm || 0) * qty;
    totalMm += mm;

    const deliveryLine = latestByMaterial.get(l.materialId);
    const unitCostPerMeter = Number(deliveryLine?.unitCostPerMeter ?? l.material?.unitCost ?? 0);
    totalCost += (mm / 1000) * unitCostPerMeter;
  }

  res.json({
    ok: true,
    project: { id: project.id, title: project.title },
    logs,
    totals: {
      totalMillimeters: totalMm,
      totalMeters: totalMm / 1000,
      totalCost,
      currency: "GBP",
    },
  });
});

router.post("/timber/usage", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const userId = (req.auth.userId as string) || null;

  const bodySchema = z.object({
    opportunityId: z.string().min(1),
    materialId: z.string().min(1),
    lengthMm: z.number().int().positive(),
    quantity: z.number().int().positive().default(1),
    usedAt: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });

  const { opportunityId, materialId, lengthMm, quantity, usedAt, notes } = parsed.data;

  const project = await (prisma as any).opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, tenantId: true },
  });
  if (!project || project.tenantId !== tenantId) return res.status(404).json({ error: "project_not_found" });

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true, tenantId: true, category: true },
  });
  if (!material || material.tenantId !== tenantId) return res.status(404).json({ error: "material_not_found" });
  if (!timberCategoryEnumValues.includes(String(material.category) as any)) {
    return res.status(400).json({ error: "material_not_timber" });
  }

  const created = await (prisma as any).timberUsageLog.create({
    data: {
      tenantId,
      opportunityId,
      materialId,
      userId,
      lengthMm,
      quantity,
      usedAt: usedAt ? new Date(usedAt) : new Date(),
      notes: notes ?? null,
    },
  });

  res.json({ ok: true, item: created });
});

router.delete("/timber/usage/:id", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = req.params.id;

  const existing = await (prisma as any).timberUsageLog.findUnique({
    where: { id },
    select: { id: true, tenantId: true },
  });
  if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ error: "not_found" });

  await (prisma as any).timberUsageLog.delete({ where: { id } });
  res.json({ ok: true });
});

router.get("/timber/deliveries", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const take = Math.min(Math.max(Number(req.query.take || 50), 1), 200);

  const deliveries = await (prisma as any).timberDelivery.findMany({
    where: { tenantId },
    include: {
      supplier: { select: { id: true, name: true } },
      lines: {
        include: { material: { select: { id: true, name: true, code: true, thickness: true, width: true } } },
        orderBy: [{ createdAt: "desc" }],
      },
    },
    orderBy: [{ deliveredAt: "desc" }, { createdAt: "desc" }],
    take,
  });

  res.json({ ok: true, items: deliveries });
});

router.post("/timber/deliveries", async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;

  const lineSchema = z.object({
    materialId: z.string().min(1),
    lengthMmTotal: z.number().int().positive(),
    totalCost: z.number().nonnegative().default(0),
    currency: z.string().min(1).default("GBP"),
    unitCostPerMeter: z.number().nonnegative().optional(),
    notes: z.string().max(1000).optional(),
  });
  const bodySchema = z.object({
    supplierId: z.string().optional(),
    reference: z.string().max(200).optional(),
    deliveredAt: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
    lines: z.array(lineSchema).min(1),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body", issues: parsed.error.issues });
  const { supplierId, reference, deliveredAt, notes, lines } = parsed.data;

  // Verify materials belong to tenant and are timber
  const materialIds = Array.from(new Set(lines.map((l) => l.materialId)));
  const materials = await prisma.material.findMany({
    where: { tenantId, id: { in: materialIds } },
    select: { id: true, category: true },
  });
  const materialById = new Map(materials.map((m) => [m.id, m]));
  for (const l of lines) {
    const m = materialById.get(l.materialId);
    if (!m) return res.status(400).json({ error: "material_not_found", materialId: l.materialId });
    if (!timberCategoryEnumValues.includes(String(m.category) as any)) {
      return res.status(400).json({ error: "material_not_timber", materialId: l.materialId });
    }
  }

  const created = await (prisma as any).timberDelivery.create({
    data: {
      tenantId,
      supplierId: supplierId ?? null,
      reference: reference ?? null,
      deliveredAt: deliveredAt ? new Date(deliveredAt) : new Date(),
      notes: notes ?? null,
      lines: {
        create: lines.map((l) => {
          const meters = l.lengthMmTotal / 1000;
          const unitCost = l.unitCostPerMeter ?? (meters > 0 ? l.totalCost / meters : 0);
          return {
            tenantId,
            materialId: l.materialId,
            lengthMmTotal: l.lengthMmTotal,
            totalCost: new Prisma.Decimal(l.totalCost),
            currency: l.currency,
            unitCostPerMeter: new Prisma.Decimal(unitCost),
            notes: l.notes ?? null,
          };
        }),
      },
    },
    include: { lines: true },
  });

  // Update material.unitCost (best-effort) using latest delivery line unit cost per meter
  try {
    await Promise.all(
      created.lines.map((line: any) =>
        prisma.material.update({
          where: { id: line.materialId },
          data: { unitCost: line.unitCostPerMeter },
        })
      )
    );
  } catch (e) {
    // ignore; delivery still recorded
  }

  res.json({ ok: true, item: created });
});

export default router;

