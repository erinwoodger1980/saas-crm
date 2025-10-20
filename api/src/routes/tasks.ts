// api/src/routes/tasks.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

const router = Router();

/* ---------------- Helpers ---------------- */
function resolveTenantId(req: any): string {
  return (
    req.auth?.tenantId ||
    req.user?.tenantId ||
    (req.headers["x-tenant-id"] as string) ||
    (req as any).tenantId ||
    ""
  );
}
function resolveUserId(req: any): string | undefined {
  return (
    req.auth?.userId ||
    req.user?.id ||
    (req.headers["x-user-id"] as string) ||
    undefined
  );
}
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const RelatedTypeEnum = z.enum([
  "LEAD",
  "PROJECT",
  "QUOTE",
  "EMAIL",
  "QUESTIONNAIRE",
  "WORKSHOP",
  "OTHER",
]);
const TaskStatusEnum = z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]);
const TaskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

/* ---------------- Schemas ---------------- */
const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  relatedType: RelatedTypeEnum,
  relatedId: z.string().optional(),
  status: TaskStatusEnum.optional().default("OPEN"),
  priority: TaskPriorityEnum.optional().default("MEDIUM"),
  dueAt: z.string().datetime().optional(),
  assignees: z
    .array(z.object({ userId: z.string(), role: z.enum(["OWNER", "FOLLOWER"]).optional() }))
    .optional(),
  meta: z.any().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  relatedType: RelatedTypeEnum.optional(),
  relatedId: z.string().optional(),
  meta: z.any().optional(),
});

const assigneesBodySchema = z.object({
  add: z.array(z.object({ userId: z.string(), role: z.enum(["OWNER", "FOLLOWER"]).default("OWNER") })).optional(),
  remove: z.array(z.string()).optional(), // array of userIds
});

/* ---------------- Routes ---------------- */

// POST /tasks – create manual task
router.post("/", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const body = createTaskSchema.parse(req.body);
    const createdById = resolveUserId(req);

    const task = await prisma.task.create({
      data: {
        tenantId,
        title: body.title,
        description: body.description,
        relatedType: body.relatedType as any,
        relatedId: body.relatedId,
        status: (body.status ?? "OPEN") as any,
        priority: (body.priority ?? "MEDIUM") as any,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        meta: body.meta as any,
        createdById,
        assignees: body.assignees?.length
          ? {
              create: body.assignees.map((a) => ({
                userId: a.userId,
                role: (a.role ?? "OWNER") as any,
              })),
            }
          : undefined,
      },
    });

    await prisma.activityLog.create({
      data: {
        tenantId,
        entity: "TASK",
        entityId: task.id,
        verb: "CREATED",
        actorId: createdById ?? undefined,
        data: { source: "manual" } as any,
      },
    });

    res.json(task);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// GET /tasks – list with filters
// ?status=OPEN&mine=true&unassigned=true&due=today|overdue|upcoming&relatedType=LEAD&relatedId=abc123&search=foo&includeDone=true
router.get("/", async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const userId = resolveUserId(req);
  const {
    status,
    mine,
    due,
    relatedType,
    relatedId,
    unassigned,
    search,
    includeDone = "false",
    take = "50",
    skip = "0",
  } = req.query as Record<string, string>;

  const where: any = { tenantId };

  // by default hide DONE and CANCELLED unless explicitly included
  if (includeDone !== "true") {
    where.status = { notIn: ["DONE", "CANCELLED"] as any };
  }

  // explicit status overrides the default filter above
  if (status) {
    where.status = status;
  }

  if (relatedType) where.relatedType = relatedType;
  if (relatedId) where.relatedId = relatedId;

  // Due filters
  const now = new Date();
  if (due === "today") {
    const { start, end } = todayRange();
    where.dueAt = { gte: start, lte: end };
  } else if (due === "overdue") {
    where.AND = [
      { dueAt: { lt: now } },
      { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] as any } },
    ];
  } else if (due === "upcoming") {
    where.dueAt = { gt: now };
  }

  // Mine filter = I'm an assignee
  if (mine === "true" && userId) {
    where.assignees = { some: { userId } };
  }

  // Unassigned filter
  if (unassigned === "true") {
    where.assignees = { none: {} };
  }

  // Simple title search
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { assignees: true },
      orderBy: [
        // overdue first, then by due date, then newest created
        { dueAt: "asc" },
        { createdAt: "desc" },
      ],
      take: Number(take),
      skip: Number(skip),
    }),
    prisma.task.count({ where }),
  ]);

  res.json({ items, total });
});

// PATCH /tasks/:id – update fields
router.patch("/:id", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;
    const patch = updateTaskSchema.parse(req.body);

    // Verify tenant ownership
    const exists = await prisma.task.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "task_not_found" });

    const task = await prisma.task.update({
      where: { id },
      data: {
        title: patch.title,
        description: patch.description,
        status: patch.status as any,
        priority: patch.priority as any,
        dueAt: patch.dueAt === null ? null : patch.dueAt ? new Date(patch.dueAt) : undefined,
        relatedType: patch.relatedType as any,
        relatedId: patch.relatedId,
        meta: patch.meta as any,
        updatedById: resolveUserId(req),
      },
    });

    res.json(task);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// POST /tasks/:id/assignees – add/remove
router.post("/:id/assignees", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const actorId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;
    const body = assigneesBodySchema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!task) return res.status(404).json({ error: "task_not_found" });

    // Perform adds/removes
    // Remove first to avoid unique constraint clashes
    if (body.remove?.length) {
      await prisma.taskAssignee.deleteMany({
        where: { taskId: id, userId: { in: body.remove } },
      });
    }
    if (body.add?.length) {
      await prisma.taskAssignee.createMany({
        data: body.add.map((a) => ({
          taskId: id,
          userId: a.userId,
          role: a.role as any,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.activityLog.create({
      data: {
        tenantId,
        entity: "TASK",
        entityId: id,
        verb: "ASSIGNED",
        actorId: actorId,
        data: { add: body.add ?? [], remove: body.remove ?? [] } as any,
      },
    });

    const updated = await prisma.task.findUnique({
      where: { id },
      include: { assignees: true },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// POST /tasks/:id/start – mark started
router.post("/:id/start", async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const id = req.params.id;
  const actorId = resolveUserId(req);

  const found = await prisma.task.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!found) return res.status(404).json({ error: "task_not_found" });

  const task = await prisma.task.update({
    where: { id },
    data: { status: "IN_PROGRESS" as any, startedAt: new Date(), updatedById: actorId },
  });

  await prisma.activityLog.create({
    data: { tenantId, entity: "TASK", entityId: id, verb: "STARTED", actorId, data: {} as any },
  });

  res.json(task);
});

// POST /tasks/:id/complete – mark done + streak update
router.post("/:id/complete", async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const id = req.params.id;
  const actorId = resolveUserId(req);

  const found = await prisma.task.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!found) return res.status(404).json({ error: "task_not_found" });

  const task = await prisma.task.update({
    where: { id },
    data: { status: "DONE" as any, completedAt: new Date(), updatedById: actorId },
  });

  await prisma.activityLog.create({
    data: { tenantId, entity: "TASK", entityId: id, verb: "COMPLETED", actorId, data: {} as any },
  });

  // Streak: increment first completion of the day for this user
  if (actorId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.streak.findUnique({
      where: { tenantId_userId: { tenantId, userId: actorId } },
    });

    const shouldIncrement = !existing?.lastActivityDate || existing.lastActivityDate < today;

    await prisma.streak.upsert({
      where: { tenantId_userId: { tenantId, userId: actorId } },
      update: {
        dayCount: shouldIncrement ? (existing?.dayCount ?? 0) + 1 : existing!.dayCount,
        lastActivityDate: new Date(),
      },
      create: { tenantId, userId: actorId, dayCount: 1, lastActivityDate: new Date() },
    });

    await prisma.notification.create({
      data: {
        tenantId,
        userId: actorId,
        type: "STREAK" as any,
        payload: { message: "On a roll—keep it going." } as any,
      },
    });
  }

  res.json(task);
});

// POST /tasks/:id/nudge – friendly ping to assignees + activity log
router.post("/:id/nudge", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const actorId = resolveUserId(req);
    if (!tenantId || !actorId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const task = await prisma.task.findFirst({
      where: { id, tenantId },
      include: { assignees: true },
    });
    if (!task) return res.status(404).json({ error: "task_not_found" });

    await prisma.activityLog.create({
      data: {
        tenantId,
        entity: "TASK",
        entityId: task.id,
        verb: "NUDGED",
        actorId,
        data: { title: task.title } as any,
      },
    });

    const targetUserIds = (task.assignees || []).map((a) => a.userId);
    if (targetUserIds.length) {
      await prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
          tenantId,
          userId,
          type: "MENTION" as any,
          payload: {
            kind: "NUDGE",
            taskId: task.id,
            title: task.title,
            copy: "Let’s get this one across the line.",
          } as any,
        })),
      });
    }

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[tasks:nudge] failed", e);
    res.status(500).json({ error: e?.message || "nudge_failed" });
  }
});

// GET /tasks/summary/owner – KPI tiles
router.get("/summary/owner", async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const now = new Date();
  const { start, end } = todayRange();

  const [overdue, dueToday, unassigned, blocked] = await Promise.all([
    prisma.task.count({
      where: {
        tenantId,
        dueAt: { lt: now },
        status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] as any },
      },
    }),
    prisma.task.count({
      where: {
        tenantId,
        dueAt: { gte: start, lte: end },
        status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] as any },
      },
    }),
    prisma.task.count({
      where: { tenantId, assignees: { none: {} } },
    }),
    prisma.task.count({
      where: { tenantId, status: "BLOCKED" as any },
    }),
  ]);

  res.json({ overdue, dueToday, unassigned, blocked });
});
// POST /tasks/ensure — create once (case-insensitive title) for a given lead
router.post("/ensure", async (req, res) => {
  try {
    const tenantId = (req as any).auth?.tenantId as string | undefined;
    const userId = (req as any).auth?.userId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const {
      title,
      priority = "MEDIUM",
      relatedType = "LEAD",
      relatedId,
      dueAt,
      meta = {},
    } = req.body || {};

    if (!title || !relatedId) {
      return res.status(400).json({ error: "title and relatedId are required" });
    }

    // Look for an existing non-cancelled task with same (tenant, related, title)
    const existing = await prisma.task.findFirst({
      where: {
        tenantId,
        relatedType,
        relatedId,
        status: { not: "CANCELLED" as any },
        title: { equals: String(title), mode: "insensitive" },
      },
    });

    if (existing) return res.json({ created: false, task: existing });

    const created = await prisma.task.create({
      data: {
        tenantId,
        title: String(title),
        priority: priority as any,
        relatedType: relatedType as any,
        relatedId: String(relatedId),
        dueAt: dueAt ? new Date(dueAt) : null,
        meta: meta as any,
        assignees: userId
          ? { create: [{ userId, role: "OWNER" as any }] }
          : undefined,
      },
    });

    return res.json({ created: true, task: created });
  } catch (e: any) {
    console.error("[tasks/ensure] failed:", e);
    return res.status(500).json({ error: e?.message || "ensure failed" });
  }
});

export default router;