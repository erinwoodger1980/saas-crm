// api/src/routes/tasks.ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { markLinkedProjectFieldFromTaskCompletion } from "../services/fire-door-link";
import { applyFieldLinkOnTaskComplete } from "../services/field-link";
import { logEvent, logInsight } from "../services/training";
import { sendAdminEmail } from "../services/email-notification";
import { env } from "../env";
import {
  ensureCommunicationTaskLoggedToLeadNotes,
  formatCommunicationEntry,
  prependLeadCommunicationNotes,
} from "../services/communication-notes";
import { send } from "../services/ai/openai";

const router = Router();

/* ---------------- Helpers ---------------- */
function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
    email: req.auth?.email as string | undefined,
  };
}

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

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br/>");
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildManualTaskAssignedEmail(params: {
  assigneeName: string;
  assignerName: string;
  tenantName: string;
  taskTitle: string;
  description?: string | null;
  dueAt?: Date | null;
  priority?: string | null;
  taskLink: string;
}): string {
  const dueLabel = params.dueAt ? formatDateShort(params.dueAt) : "No due date";
  const priorityLabel = params.priority ? params.priority.toLowerCase() : "medium";
  const description = params.description ? escapeHtml(params.description) : "(No description)";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #111827; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0ea5e9; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
        .content { background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; }
        .field { margin-bottom: 14px; }
        .label { font-weight: 700; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
        .value { margin-top: 4px; font-size: 14px; color: #111827; }
        .button { display: inline-block; margin-top: 16px; padding: 10px 16px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { margin-top: 16px; font-size: 12px; color: #6b7280; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">New task assigned</h2>
          <p style="margin: 4px 0 0; font-size: 14px;">${escapeHtml(params.tenantName)} • Assigned by ${escapeHtml(params.assignerName)}</p>
        </div>
        <div class="content">
          <div class="field">
            <div class="value">Hi ${escapeHtml(params.assigneeName)},</div>
          </div>
          <div class="field">
            <div class="label">Task</div>
            <div class="value">${escapeHtml(params.taskTitle)}</div>
          </div>
          <div class="field">
            <div class="label">Description</div>
            <div class="value">${description}</div>
          </div>
          <div class="field">
            <div class="label">Due</div>
            <div class="value">${escapeHtml(dueLabel)}</div>
          </div>
          <div class="field">
            <div class="label">Priority</div>
            <div class="value">${escapeHtml(priorityLabel)}</div>
          </div>
          <a href="${params.taskLink}" class="button">Open Tasks</a>
        </div>
        <div class="footer">JoineryAI • Task Notifications</div>
      </div>
    </body>
    </html>
  `;
}

function computeFollowUpSuggestion(text: string): { dueAt: string; title: string; description: string } | null {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (/\b(no\s+follow\s*up|do\s+not\s+follow\s*up|dont\s+follow\s*up|no\s+callback)\b/.test(lower)) {
    return null;
  }

  const unitToDays = (unit: string): { unit: "days" | "weeks" | "months"; value: number } | null => {
    const u = unit.toLowerCase();
    if (u.startsWith("day")) return { unit: "days", value: 1 };
    if (u.startsWith("week")) return { unit: "weeks", value: 7 };
    if (u.startsWith("month")) return { unit: "months", value: 30 };
    return null;
  };

  const patterns: RegExp[] = [
    /\b(call|ring|phone|text|sms|email|message|whatsapp|follow\s*up|chase)\b[^\n]{0,80}?\b(in|after)\s+(\d{1,3})\s*(day|days|week|weeks|month|months)\b/i,
    /\b(in|after)\s+(\d{1,3})\s*(day|days|week|weeks|month|months)\b[^\n]{0,80}?\b(call|ring|phone|text|sms|email|message|whatsapp|follow\s*up|chase)\b/i,
    /\b(call\s+back|follow\s*up)\s+(\d{1,3})\s*(day|days|week|weeks|month|months)\b/i,
  ];

  let action: string | null = null;
  let amount: number | null = null;
  let unit: string | null = null;

  for (const re of patterns) {
    const m = raw.match(re);
    if (!m) continue;
    // Find numeric + unit positions in the match array.
    const numberToken = m.find((x) => /^\d{1,3}$/.test(String(x)));
    const unitToken = m.find((x) => /^(day|days|week|weeks|month|months)$/i.test(String(x)));
    const actionToken = m.find((x) => /^(call|ring|phone|text|sms|email|message|whatsapp|follow\s*up|chase|call\s+back)$/i.test(String(x)));
    if (numberToken && unitToken) {
      amount = Number(numberToken);
      unit = String(unitToken);
      action = actionToken ? String(actionToken) : null;
      break;
    }
  }

  if (!amount || !unit) return null;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 365) return null;

  const now = new Date();
  const due = new Date(now);
  // Default to start-of-day-ish so tasks don't land at odd times.
  due.setHours(9, 0, 0, 0);

  const unitNorm = unitToDays(unit);
  if (!unitNorm) return null;
  if (unitNorm.unit === "months") {
    due.setMonth(due.getMonth() + amount);
  } else if (unitNorm.unit === "weeks") {
    due.setDate(due.getDate() + amount * 7);
  } else {
    due.setDate(due.getDate() + amount);
  }

  const actionLower = (action || "").toLowerCase();
  const title =
    /call|ring|phone/.test(actionLower)
      ? "Call customer"
      : /email/.test(actionLower)
        ? "Email customer"
        : /text|sms|whatsapp|message/.test(actionLower)
          ? "Message customer"
          : "Follow up";

  return {
    dueAt: due.toISOString(),
    title,
    description: raw,
  };
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
const TaskTypeEnum = z.enum(["MANUAL", "COMMUNICATION", "FOLLOW_UP", "SCHEDULED", "FORM", "CHECKLIST"]);
const CommunicationTypeEnum = z.enum(["EMAIL", "PHONE", "MEETING", "SMS", "OTHER"]);
const CommunicationDirectionEnum = z.enum(["INBOUND", "OUTBOUND"]);
const RecurrencePatternEnum = z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]);

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
  
  // New task type fields
  taskType: TaskTypeEnum.optional().default("MANUAL"),
  communicationType: CommunicationTypeEnum.optional(),
  communicationChannel: z.string().optional(),
  communicationDirection: CommunicationDirectionEnum.optional(),
  communicationNotes: z.string().optional(),
  formSchema: z.any().optional(),
  requiresSignature: z.boolean().optional(),
  checklistItems: z.any().optional(),
});

// Allow upgrading a task to scheduled / changing type, recurrence and advanced schemas
const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  dueAt: z.string().datetime().nullable().optional(),
  relatedType: RelatedTypeEnum.optional(),
  relatedId: z.string().optional(),
  meta: z.any().optional(),
  taskType: TaskTypeEnum.optional(),
  recurrencePattern: RecurrencePatternEnum.optional(),
  recurrenceInterval: z.number().optional(),
  formSchema: z.any().optional(),
  checklistItems: z.any().optional(),
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
        
        // New task type fields
        taskType: body.taskType,
        communicationType: body.communicationType,
        communicationChannel: body.communicationChannel,
        communicationDirection: body.communicationDirection,
        communicationNotes: body.communicationNotes,
        formSchema: body.formSchema as any,
        requiresSignature: body.requiresSignature,
        checklistItems: body.checklistItems as any,
        
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

    // Notify assignees for manually created tasks
    if (Array.isArray(body.assignees) && body.assignees.length > 0) {
      const assigneeIds = Array.from(
        new Set(
          body.assignees
            .map((a) => a.userId)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      );

      if (assigneeIds.length > 0) {
        try {
          const [assignees, creator, tenant] = await Promise.all([
            prisma.user.findMany({
              where: { id: { in: assigneeIds } },
              select: { id: true, email: true, name: true, firstName: true, lastName: true },
            }),
            createdById
              ? prisma.user.findUnique({
                  where: { id: createdById },
                  select: { name: true, firstName: true, lastName: true },
                })
              : null,
            prisma.tenant.findUnique({
              where: { id: tenantId },
              select: { name: true },
            }),
          ]);

          const assignerName =
            creator?.name ||
            [creator?.firstName, creator?.lastName].filter(Boolean).join(" ") ||
            "A teammate";
          const tenantName = tenant?.name || "Your workspace";
          const baseUrl = env.WEB_URL || "https://app.joineryai.app";
          const taskLink = `${baseUrl}/tasks/center`;

          const emailSends = assignees
            .filter((assignee) => !!assignee.email)
            .filter((assignee) => !createdById || assignee.id !== createdById)
            .map((assignee) =>
              sendAdminEmail({
                to: assignee.email as string,
                subject: `New task assigned: ${task.title}`,
                html: buildManualTaskAssignedEmail({
                  assigneeName:
                    assignee.name ||
                    [assignee.firstName, assignee.lastName].filter(Boolean).join(" ") ||
                    "there",
                  assignerName,
                  tenantName,
                  taskTitle: task.title,
                  description: task.description,
                  dueAt: task.dueAt,
                  priority: task.priority,
                  taskLink,
                }),
              }).catch((err) => {
                console.error(
                  `[tasks] Failed to send task assignment email to ${assignee.email}:`,
                  err?.message || err
                );
              })
            );

          await Promise.all(emailSends);
        } catch (notifyError: any) {
          console.error("[tasks] Failed to send manual task notifications:", notifyError?.message || notifyError);
        }
      }
    }

    // Auto-generate AI draft for FOLLOW_UP tasks
    if (body.taskType === "FOLLOW_UP" && body.meta) {
      try {
        const meta = body.meta as any;
        const recipientEmail = meta.recipientEmail;
        const recipientName = meta.recipientName;
        
        if (recipientEmail) {
          const { generateEmailDraft } = await import("../services/aiEmailDrafter");
          const draft = await generateEmailDraft({
            recipientEmail,
            recipientName,
            purpose: meta.trigger || "custom",
            customContext: body.description || "Follow-up required",
            tone: "professional",
          });

          // Update task with AI draft
          await prisma.task.update({
            where: { id: task.id },
            data: {
              meta: {
                ...meta,
                aiDraft: {
                  subject: draft.subject,
                  body: draft.body,
                  confidence: draft.confidence,
                  generatedAt: new Date().toISOString(),
                },
              },
            },
          });

          console.log(`[tasks] Auto-generated AI draft for task ${task.id}`);
        }
      } catch (draftError) {
        console.error(`[tasks] Failed to auto-generate draft for task ${task.id}:`, draftError);
        // Don't fail the task creation if draft generation fails
      }
    }

    res.json(task);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// GET /tasks – list with filters
// ?status=OPEN&mine=true&unassigned=true&due=today|overdue|upcoming&relatedType=LEAD&relatedId=abc123&search=foo&includeDone=true
// GET /tasks/latest – get next open task per relatedId (batch)
// ?relatedType=LEAD&relatedIds=abc,def,ghi&includeDone=false
router.get("/latest", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const { relatedType, relatedIds, includeDone = "false" } = req.query as Record<string, string>;
    if (!relatedType) return res.status(400).json({ error: "relatedType required" });
    if (!relatedIds) return res.status(400).json({ error: "relatedIds required" });

    const ids = String(relatedIds)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 250);
    if (ids.length === 0) return res.json({ byRelatedId: {} });

    const where: any = {
      tenantId,
      relatedType,
      relatedId: { in: ids },
    };
    if (includeDone !== "true") {
      where.status = { notIn: ["DONE", "CANCELLED"] as any };
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueAt: true,
        relatedType: true,
        relatedId: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
        assignees: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
      take: Math.min(ids.length * 15, 2000),
      orderBy: [{ updatedAt: "desc" }],
    });

    const assigneeUserIds = Array.from(
      new Set(
        tasks
          .flatMap((t: any) => (Array.isArray(t.assignees) ? t.assignees : []))
          .map((a: any) => a?.userId)
          .filter((v: any) => typeof v === "string" && v)
      )
    ) as string[];

    const usersById: Record<string, { id: string; name: string | null }> = {};
    if (assigneeUserIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: assigneeUserIds } },
        select: { id: true, name: true, firstName: true, lastName: true, email: true },
      });
      for (const u of users) {
        const fallbackName =
          [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email || null;
        usersById[u.id] = { id: u.id, name: fallbackName };
      }
    }

    const byRelatedId: Record<string, any | null> = {};
    for (const id of ids) byRelatedId[id] = null;

    const score = (t: any) => {
      const dueAt = t?.dueAt ? new Date(t.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const dueBucket = Number.isFinite(dueAt) ? 0 : 1;
      const createdAt = t?.createdAt ? new Date(t.createdAt).getTime() : 0;
      return { dueBucket, dueAt, createdAt };
    };
    const better = (a: any, b: any) => {
      const sa = score(a);
      const sb = score(b);
      if (sa.dueBucket !== sb.dueBucket) return sa.dueBucket < sb.dueBucket;
      if (sa.dueAt !== sb.dueAt) return sa.dueAt < sb.dueAt;
      return sa.createdAt > sb.createdAt;
    };

    const withAssignee = (t: any) => {
      const list = Array.isArray(t.assignees) ? t.assignees : [];
      const owner = list.find((a: any) => a?.role === "OWNER") || list[0] || null;
      const assigneeUserId = owner?.userId && typeof owner.userId === "string" ? owner.userId : null;
      const assigneeName = assigneeUserId ? usersById[assigneeUserId]?.name ?? null : null;
      return {
        ...t,
        assigneeUserId,
        assigneeName,
      };
    };

    for (const t0 of tasks) {
      const t = withAssignee(t0);
      const rid = t.relatedId;
      if (!rid) continue;
      const current = byRelatedId[rid];
      if (!current || better(t, current)) {
        byRelatedId[rid] = t;
      }
    }

    return res.json({ byRelatedId });
  } catch (e: any) {
    console.error("[tasks] GET /latest failed:", e);
    return res.status(500).json({ error: "internal_error", detail: e?.message || String(e) });
  }
});

router.get("/", async (req, res) => {
  try {
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
      taskType,
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
  if (taskType) where.taskType = taskType;

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
      // Explicitly select core columns known to exist to avoid P2022 when
      // prisma client expects columns that older DBs may not yet have.
      select: {
        id: true,
        tenantId: true,
        title: true,
        description: true,
        relatedType: true,
        relatedId: true,
        status: true,
        priority: true,
        dueAt: true,
        startedAt: true,
        completedAt: true,
        autocreated: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
        taskType: true,
        communicationType: true,
        communicationChannel: true,
        communicationDirection: true,
        communicationNotes: true,
        formSchema: true,
        requiresSignature: true,
        signedAt: true,
        checklistItems: true,
        // Assignees via relation
        assignees: {
          select: { userId: true, role: true },
        },
      },
      orderBy: [
        { dueAt: "asc" },
        { createdAt: "desc" },
      ],
      take: Number(take),
      skip: Number(skip),
    }),
    prisma.task.count({ where }),
  ]);

  res.json({ items, total });
  } catch (e: any) {
    console.error("[tasks.get] Error:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
});

// GET /tasks/stats – Get task statistics
// Optional query: scope=mine|all (default all). When scope=mine, counts only tasks
// where the authenticated user is an assignee.
router.get("/stats", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });
    const scope = String((req.query as any)?.scope || "all").toLowerCase();
    const userId = resolveUserId(req);
    const newSinceHoursRaw = Number((req.query as any)?.newSinceHours ?? 24);
    const newSinceHours = Number.isFinite(newSinceHoursRaw) && newSinceHoursRaw > 0
      ? Math.min(newSinceHoursRaw, 168)
      : 24;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const newSince = new Date(now.getTime() - newSinceHours * 60 * 60 * 1000);

    // Common scope filter
    const assigneeFilter =
      scope === "mine" && userId
        ? { assignees: { some: { userId } } }
        : {};

    const baseActiveFilter: any = {
      tenantId,
      status: { notIn: ["DONE", "CANCELLED"] as any },
      ...assigneeFilter,
    };

    const [late, dueToday, completedToday, total, newTasks] = await Promise.all([
      prisma.task.count({
        where: {
          ...baseActiveFilter,
          dueAt: { lt: startOfDay },
        },
      }),
      prisma.task.count({
        where: {
          ...baseActiveFilter,
          dueAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.task.count({
        where: {
          tenantId,
          status: "DONE" as any,
          completedAt: { gte: startOfDay },
          ...(scope === "mine" && userId ? { assignees: { some: { userId } } } : {}),
        },
      }),
      prisma.task.count({
        where: baseActiveFilter,
      }),
      prisma.task.count({
        where: {
          ...baseActiveFilter,
          createdAt: { gte: newSince },
        },
      }),
    ]);

    res.json({
      late,
      dueToday,
      completedToday,
      total,
      newTasks,
      newSinceHours,
    });
  } catch (e: any) {
    console.error("[tasks.stats] Error:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
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
        taskType: patch.taskType as any,
        recurrencePattern: patch.recurrencePattern,
        recurrenceInterval: patch.recurrenceInterval,
        formSchema: patch.formSchema as any,
        checklistItems: patch.checklistItems as any,
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
  const auth = getAuth(req);
  const tenantId = auth.tenantId || resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const id = req.params.id;
  const actorId = auth.userId || resolveUserId(req);

  // Fetch the task so we know what it relates to
  const taskRow = await prisma.task.findFirst({
    where: { id, tenantId },
    select: { id: true, title: true, relatedType: true, relatedId: true, meta: true },
  });
  if (!taskRow) return res.status(404).json({ error: "task_not_found" });

  const task = await prisma.task.update({
    where: { id },
    data: { status: "DONE" as any, completedAt: new Date(), updatedById: actorId },
  });

  try {
    await ensureCommunicationTaskLoggedToLeadNotes({ tenantId, taskId: id });
  } catch (e: any) {
    console.warn("[tasks:complete] comm note logging failed:", e?.message || e);
  }

  // Sync: if task links to a fire door schedule field, update the project
  try {
    await markLinkedProjectFieldFromTaskCompletion({ tenantId, taskId: id });
  } catch (e) {
    console.warn("[tasks:complete] fire-door sync failed:", (e as any)?.message || e);
  }
  try {
    await applyFieldLinkOnTaskComplete({ tenantId, taskId: id });
  } catch (e) {
    console.warn("[tasks:complete] generic field-link sync failed:", (e as any)?.message || e);
  }

  // If this is a workshop process task, mark the process as complete
  if ((taskRow.relatedType as any) === "WORKSHOP" && taskRow.relatedId) {
    try {
      const processCode = (taskRow.meta as any)?.processCode;
      if (processCode) {
        const processDef = await prisma.workshopProcessDefinition.findFirst({
          where: { tenantId, code: processCode },
        });
        if (processDef) {
          await prisma.projectProcessAssignment.updateMany({
            where: {
              tenantId,
              opportunityId: taskRow.relatedId,
              processDefinitionId: processDef.id,
            },
            data: { completedAt: new Date() },
          });
        }
      }
    } catch (e) {
      console.warn("[tasks:complete] workshop process completion failed:", (e as any)?.message || e);
    }
  }

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

  // Special behavior: Completing the review task = accept the lead
  try {
    const isLeadReview =
      (taskRow.relatedType as any) === "LEAD" &&
      (
        (typeof taskRow.meta === "object" && taskRow.meta && (taskRow.meta as any).key === `status:new-review:${taskRow.relatedId}`) ||
        (typeof taskRow.title === "string" && taskRow.title.trim().toLowerCase() === "review enquiry")
      );

    if (isLeadReview && taskRow.relatedId) {
      // Load current lead to check status
      const lead = await prisma.lead.findFirst({ where: { id: taskRow.relatedId, tenantId } });
      if (lead) {
        const prevCustom = ((lead.custom as any) || {}) as Record<string, any>;
        const prevUi = (prevCustom.uiStatus as string) || lead.status;
        const prevUiNorm = String(prevUi).toUpperCase() === "NEW" ? "NEW_ENQUIRY" : (String(prevUi).toUpperCase() as any);

        // If still in NEW_ENQUIRY, move to READY_TO_QUOTE to mark acceptance
        const shouldPromote = prevUiNorm === "NEW_ENQUIRY";
        let nextUi: "READY_TO_QUOTE" | null = null;
        if (shouldPromote) nextUi = "READY_TO_QUOTE";

        if (nextUi) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "READY_TO_QUOTE" as any, custom: { ...prevCustom, uiStatus: nextUi } },
          });

          // Label originating ingests positively and log insights for transparency
          try {
            await prisma.emailIngest.updateMany({
              where: { tenantId, leadId: lead.id },
              data: { userLabelIsLead: true, userLabeledAt: new Date() },
            });

          } catch (e: any) {
            console.warn("[tasks:complete] email ingest label failed:", e?.message || e);
          }
        }
      }
    }
  } catch (e: any) {
    console.warn("[tasks:complete] lead review auto-accept failed:", e?.message || e);
  }

  res.json(task);
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

/* ============================================================================
   UNIFIED TASK SYSTEM - NEW ENDPOINTS
   ========================================================================= */

// POST /tasks/communication - Quick log a communication (phone, meeting, etc.)
router.post("/communication", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const schema = z.object({
      communicationType: CommunicationTypeEnum,
      communicationChannel: z.string().optional(),
      communicationDirection: CommunicationDirectionEnum,
      communicationNotes: z.string(),
      relatedType: RelatedTypeEnum,
      relatedId: z.string(),
      dueAt: z.string().datetime().optional(),
    });

    const body = schema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        tenantId,
        title: `${body.communicationType} - ${body.communicationDirection}`,
        description: body.communicationNotes,
        taskType: "COMMUNICATION",
        communicationType: body.communicationType,
        communicationChannel: body.communicationChannel,
        communicationDirection: body.communicationDirection,
        communicationNotes: body.communicationNotes,
        relatedType: body.relatedType as any,
        relatedId: body.relatedId,
        status: "DONE",
        completedAt: new Date(),
        autoCompleted: false,
        completedBy: userId,
        createdById: userId,
      },
    });

    // This route creates a completed communication task; ensure it's also written into lead notes.
    try {
      await ensureCommunicationTaskLoggedToLeadNotes({ tenantId, taskId: task.id });
    } catch (e: any) {
      console.warn("[tasks/communication] failed to log to lead notes:", e?.message || e);
    }

    res.json(task);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// POST /tasks/communication/ai-log - Add a short note; use OpenAI to decide if it's a comms log.
router.post("/communication/ai-log", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    let actorName: string | null = null;
    if (userId) {
      try {
        const u = await prisma.user.findFirst({ where: { id: String(userId) }, select: { name: true } });
        actorName = u?.name ? String(u.name).trim() : null;
      } catch {
        actorName = null;
      }
    }

    const schema = z.object({
      relatedType: RelatedTypeEnum,
      relatedId: z.string(),
      text: z.string().min(1),
    });
    const body = schema.parse(req.body);
    const inputText = String(body.text).trim();

    const heuristic = (() => {
      const t = inputText.toLowerCase();
      const isCommunication =
        /\b(call|called|phone|phoned|voicemail|rang|spoke|emailed|email|texted|sms|messaged|whatsapp|met|meeting)\b/.test(
          t
        ) || /@/.test(t);
      const communicationType = /@|\bemail(ed)?\b/.test(t)
        ? "EMAIL"
        : /\b(texted|sms|whatsapp|message(d)?)\b/.test(t)
          ? "SMS"
          : /\b(meet(ing)?|met)\b/.test(t)
            ? "MEETING"
            : /\b(call|called|phone|phoned|rang|voicemail|spoke)\b/.test(t)
              ? "PHONE"
              : "OTHER";
      const communicationDirection = /\b(they|client)\s+(called|emailed|texted|messaged)\b/.test(t)
        ? "INBOUND"
        : "OUTBOUND";
      return {
        isCommunication,
        communicationType,
        communicationDirection,
        communicationChannel: undefined as string | undefined,
        cleanedNotes: inputText,
      };
    })();

    let classification = heuristic;

    if (process.env.OPENAI_API_KEY) {
      try {
        const messages = [
          {
            role: "system" as const,
            content:
              "Classify a short CRM note. Return ONLY valid JSON with keys: isCommunication(boolean), communicationType(one of EMAIL|PHONE|MEETING|SMS|OTHER), communicationDirection(INBOUND|OUTBOUND), communicationChannel(optional string), cleanedNotes(string).",
          },
          { role: "user" as const, content: `Note: ${inputText}` },
        ];
        const r = await send(process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || "gpt-4o-mini", messages, {
          temperature: 0.1,
          max_tokens: 250,
        });
        const raw = r.text || "";
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        const jsonStr = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
        const parsed = JSON.parse(jsonStr);
        const parsedSchema = z.object({
          isCommunication: z.boolean(),
          communicationType: CommunicationTypeEnum,
          communicationDirection: CommunicationDirectionEnum,
          communicationChannel: z.string().optional().nullable(),
          cleanedNotes: z.string(),
        });
        const safe = parsedSchema.parse(parsed);
        classification = {
          ...classification,
          ...safe,
          communicationChannel: safe.communicationChannel ?? undefined,
        };
      } catch (e: any) {
        console.warn("[tasks/communication/ai-log] OpenAI classify failed, using heuristic:", e?.message || e);
      }
    }

    if (classification.isCommunication) {
      const followUpSuggestion = computeFollowUpSuggestion(classification.cleanedNotes || inputText);

      const task = await prisma.task.create({
        data: {
          tenantId,
          title: `${classification.communicationType} - ${classification.communicationDirection}`,
          description: classification.cleanedNotes,
          taskType: "COMMUNICATION",
          communicationType: classification.communicationType as any,
          communicationChannel: classification.communicationChannel || null,
          communicationDirection: classification.communicationDirection as any,
          communicationNotes: classification.cleanedNotes,
          relatedType: body.relatedType as any,
          relatedId: body.relatedId,
          status: "DONE",
          completedAt: new Date(),
          autoCompleted: false,
          completedBy: userId,
          createdById: userId,
          meta: { source: "leadmodal_add_note" } as any,
        },
      });

      const logged = await ensureCommunicationTaskLoggedToLeadNotes({ tenantId, taskId: task.id });
      return res.json({ ok: true, classification, task, notes: logged.updatedNotes || null, followUpSuggestion });
    }

    const followUpSuggestion = computeFollowUpSuggestion(classification.cleanedNotes || inputText);

    // Not a communication: prepend a plain note entry.
    const entry = formatCommunicationEntry({
      completedAt: new Date(),
      actorName,
      communicationType: "OTHER",
      communicationDirection: "OUTBOUND",
      communicationChannel: "NOTE",
      freeTextFallback: classification.cleanedNotes,
    });

    let leadId: string | null = null;
    if (body.relatedType === "LEAD") leadId = body.relatedId;
    if (body.relatedType === "PROJECT") {
      const opp = await prisma.opportunity.findFirst({
        where: { tenantId, id: body.relatedId },
        select: { leadId: true },
      });
      leadId = opp?.leadId ? String(opp.leadId) : null;
    }

    const updated = leadId
      ? await prependLeadCommunicationNotes({ tenantId, leadId, entry })
      : null;

    return res.json({ ok: true, classification, task: null, notes: updated?.updatedNotes || null, followUpSuggestion });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// POST /tasks/:id/signature - Submit signature for a form task
router.post("/:id/signature", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;
    const schema = z.object({
      signatureData: z.string(), // Base64 image
    });

    const body = schema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: { id, tenantId },
    });

    if (!task) return res.status(404).json({ error: "task_not_found" });
    if (task.taskType !== "FORM") return res.status(400).json({ error: "not_a_form_task" });

    const updated = await prisma.task.update({
      where: { id },
      data: {
        signatureData: body.signatureData,
        signedBy: userId,
        signedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// POST /tasks/:id/form-submission - Submit form data
router.post("/:id/form-submission", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;
    const formData = req.body;

    const task = await prisma.task.findFirst({
      where: { id, tenantId },
    });

    if (!task) return res.status(404).json({ error: "task_not_found" });
    if (task.taskType !== "FORM") return res.status(400).json({ error: "not_a_form_task" });

    const submissions = (task.formSubmissions as any[]) || [];
    submissions.push({
      submittedAt: new Date(),
      submittedBy: userId,
      data: formData,
    });

    const updated = await prisma.task.update({
      where: { id },
      data: {
        formSubmissions: submissions as any,
        status: "DONE",
        completedAt: new Date(),
        completedBy: userId,
      },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// PATCH /tasks/:id/checklist - Update checklist item completion
router.patch("/:id/checklist", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = req.params.id;
    const schema = z.object({
      itemId: z.string(),
      completed: z.boolean(),
    });

    const body = schema.parse(req.body);

    const task = await prisma.task.findFirst({
      where: { id, tenantId },
    });

    if (!task) return res.status(404).json({ error: "task_not_found" });
    if (task.taskType !== "CHECKLIST") return res.status(400).json({ error: "not_a_checklist_task" });

    const items = (task.checklistItems as any[]) || [];
    const item = items.find((i: any) => i.id === body.itemId);
    
    if (!item) return res.status(404).json({ error: "item_not_found" });

    item.completed = body.completed;
    if (body.completed) {
      item.completedBy = userId;
      item.completedAt = new Date();
    } else {
      delete item.completedBy;
      delete item.completedAt;
    }

    // Check if all items are completed
    const allCompleted = items.every((i: any) => i.completed);

    const updated = await prisma.task.update({
      where: { id },
      data: {
        checklistItems: items as any,
        status: allCompleted ? "DONE" : task.status,
        completedAt: allCompleted ? new Date() : task.completedAt,
        completedBy: allCompleted ? userId : task.completedBy,
      },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// GET /tasks/templates - List task templates
router.get("/templates", async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const { isActive, taskType } = req.query as Record<string, string>;

  const where: any = { tenantId };
  if (isActive !== undefined) where.isActive = isActive === "true";
  if (taskType) where.taskType = taskType;

  const templates = await prisma.taskTemplate.findMany({
    where,
    orderBy: { name: "asc" },
  });

  res.json(templates);
});

// POST /tasks/templates - Create task template
router.post("/templates", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const schema = z.object({
      name: z.string(),
      description: z.string().optional(),
      taskType: TaskTypeEnum,
      defaultTitle: z.string(),
      defaultDescription: z.string().optional(),
      defaultPriority: TaskPriorityEnum.optional().default("MEDIUM"),
      relatedType: RelatedTypeEnum.optional(),
      recurrencePattern: RecurrencePatternEnum.optional(),
      recurrenceInterval: z.number().optional(),
      formSchema: z.any().optional(),
      requiresSignature: z.boolean().optional(),
      checklistItems: z.any().optional(),
      defaultAssigneeIds: z.array(z.string()).optional(),
    });

    const body = schema.parse(req.body);

    const template = await prisma.taskTemplate.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description,
        taskType: body.taskType,
        defaultTitle: body.defaultTitle,
        defaultDescription: body.defaultDescription,
        defaultPriority: body.defaultPriority,
        relatedType: body.relatedType as any,
        recurrencePattern: body.recurrencePattern,
        recurrenceInterval: body.recurrenceInterval,
        formSchema: body.formSchema as any,
        requiresSignature: body.requiresSignature,
        checklistItems: body.checklistItems as any,
        defaultAssigneeIds: body.defaultAssigneeIds,
        createdById: userId,
      },
    });

    res.json(template);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// POST /tasks/templates/:id/schedule - Create a task immediately from a template
router.post("/templates/:id/schedule", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const id = String(req.params.id);

    // Optional override fields
    const schema = z.object({
      dueAt: z.string().datetime().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: TaskPriorityEnum.optional(),
      relatedType: RelatedTypeEnum.optional(),
      relatedId: z.string().optional(),
      assigneeIds: z.array(z.string()).optional(),
    });
    const overrides = schema.parse(req.body || {});

    const template = await prisma.taskTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) return res.status(404).json({ error: "template_not_found" });

    const now = new Date();
    const dueAt = overrides.dueAt ? new Date(overrides.dueAt) : now;

    const task = await prisma.task.create({
      data: {
        tenantId,
        templateId: template.id,
        taskType: template.taskType,
        title: overrides.title || template.defaultTitle,
        description: overrides.description || template.defaultDescription,
        priority: (overrides.priority || template.defaultPriority) as any,
        relatedType: (overrides.relatedType || template.relatedType || "OTHER") as any,
        relatedId: overrides.relatedId,
        status: "OPEN" as any,
        dueAt,
        // If template has recurrence, set nextDueAt based on its pattern
        nextDueAt:
          template.recurrencePattern
            ? new Date(
                (function calcNext(start: Date) {
                  const next = new Date(start);
                  const interval = template.recurrenceInterval || 1;
                  switch (template.recurrencePattern) {
                    case "DAILY":
                      next.setDate(next.getDate() + interval);
                      break;
                    case "WEEKLY":
                      next.setDate(next.getDate() + 7 * interval);
                      break;
                    case "MONTHLY":
                      next.setMonth(next.getMonth() + interval);
                      break;
                    case "QUARTERLY":
                      next.setMonth(next.getMonth() + 3 * interval);
                      break;
                    case "YEARLY":
                      next.setFullYear(next.getFullYear() + interval);
                      break;
                    default:
                      return start;
                  }
                  return next;
                })(dueAt)
              )
            : undefined,
        formSchema: template.formSchema as any,
        requiresSignature: template.requiresSignature,
        checklistItems: template.checklistItems as any,
        createdById: userId,
        assignees:
          (overrides.assigneeIds && overrides.assigneeIds.length
            ? overrides.assigneeIds
            : template.defaultAssigneeIds) &&
          ((overrides.assigneeIds || template.defaultAssigneeIds)!.length
            ? {
                create: (overrides.assigneeIds || template.defaultAssigneeIds)!.map((uid) => ({
                  userId: uid,
                  role: "OWNER" as any,
                })),
              }
            : undefined),
      },
    });

    await prisma.activityLog.create({
      data: {
        tenantId,
        entity: "TASK",
        entityId: task.id,
        verb: "CREATED",
        actorId: userId ?? undefined,
        data: { source: "template_schedule", templateId: template.id } as any,
      },
    });

    res.json(task);
  } catch (e: any) {
    console.error("[tasks.templates.schedule] failed:", e);
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

// GET /tasks/forms - List form templates
router.get("/forms", async (req, res) => {
  const tenantId = resolveTenantId(req);
  if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

  const { isActive, category } = req.query as Record<string, string>;

  const where: any = { tenantId };
  if (isActive !== undefined) where.isActive = isActive === "true";
  if (category) where.category = category;

  const forms = await prisma.formTemplate.findMany({
    where,
    orderBy: { name: "asc" },
  });

  res.json(forms);
});

// POST /tasks/forms - Create form template
router.post("/forms", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    const schema = z.object({
      name: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      formSchema: z.any(),
      requiresSignature: z.boolean().optional(),
    });

    const body = schema.parse(req.body);

    const form = await prisma.formTemplate.create({
      data: {
        tenantId,
        name: body.name,
        description: body.description,
        category: body.category,
        formSchema: body.formSchema as any,
        requiresSignature: body.requiresSignature,
        createdById: userId,
      },
    });

    res.json(form);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Invalid request" });
  }
});

/**
 * GET /tasks/stats/:userId
 * Get user statistics for gamification
 */
router.get("/stats/:userId", async (req: any, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const userId = req.params.userId;

  try {
    // Get all completed tasks for user
    const completedTasks = await prisma.task.findMany({
      where: {
        tenantId,
        status: "DONE",
        assignees: {
          some: { userId },
        },
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        completedAt: true,
        priority: true,
      },
    });

    // Calculate streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completionDates = new Set<string>();
    completedTasks.forEach((task) => {
      if (task.completedAt) {
        const dateStr = task.completedAt.toISOString().split("T")[0];
        completionDates.add(dateStr);
      }
    });

    // Sort dates
    const sortedDates = Array.from(completionDates).sort().reverse();

    // Calculate current streak (weekdays only: Mon-Fri)
    let checkDate = new Date(today);
    for (let i = 0; i < 365; i++) {
      const dayOfWeek = checkDate.getDay();
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      
      const dateStr = checkDate.toISOString().split("T")[0];
      if (completionDates.has(dateStr)) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate longest streak (weekdays only: Mon-Fri)
    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i]);
      const prevDate = i > 0 ? new Date(sortedDates[i - 1]) : null;
      const currentDayOfWeek = currentDate.getDay();
      
      // Check if current date is a weekday
      const isWeekday = currentDayOfWeek !== 0 && currentDayOfWeek !== 6;
      
      if (!isWeekday) {
        // Skip weekends
        continue;
      }
      
      if (i === 0) {
        tempStreak = 1;
      } else if (prevDate) {
        // Calculate days between dates, accounting for skipped weekends
        let daysBetween = 0;
        let tempCheckDate = new Date(prevDate);
        while (tempCheckDate > currentDate) {
          tempCheckDate.setDate(tempCheckDate.getDate() - 1);
          const dayOfWeek = tempCheckDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysBetween++;
          }
        }
        
        // If consecutive weekdays (1 business day apart)
        if (daysBetween === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    // Tasks completed today
    const todayStr = today.toISOString().split("T")[0];
    const tasksCompletedToday = completedTasks.filter((task) => {
      if (!task.completedAt) return false;
      const taskDateStr = task.completedAt.toISOString().split("T")[0];
      return taskDateStr === todayStr;
    }).length;

    // Calculate total points
    const totalPoints = completedTasks.reduce((sum, task) => {
      const points =
        task.priority === "URGENT" ? 25 :
        task.priority === "HIGH" ? 15 :
        task.priority === "MEDIUM" ? 10 : 5;
      return sum + points;
    }, 0);

    const level = Math.floor(totalPoints / 100) + 1;

    // Define achievements
    const achievements = [
      {
        id: "first_task",
        name: "Getting Started",
        description: "Complete your first task",
        icon: "🎯",
        unlockedAt: completedTasks.length >= 1 ? completedTasks[0]?.completedAt : null,
        progress: Math.min(completedTasks.length, 1),
        target: 1,
      },
      {
        id: "week_streak",
        name: "Week Warrior",
        description: "7-day completion streak",
        icon: "🔥",
        unlockedAt: currentStreak >= 7 ? new Date() : null,
        progress: Math.min(currentStreak, 7),
        target: 7,
      },
      {
        id: "ten_tasks",
        name: "Productive",
        description: "Complete 10 tasks",
        icon: "⚡",
        unlockedAt: completedTasks.length >= 10 ? completedTasks[9]?.completedAt : null,
        progress: Math.min(completedTasks.length, 10),
        target: 10,
      },
      {
        id: "fifty_tasks",
        name: "Task Master",
        description: "Complete 50 tasks",
        icon: "🏆",
        unlockedAt: completedTasks.length >= 50 ? completedTasks[49]?.completedAt : null,
        progress: Math.min(completedTasks.length, 50),
        target: 50,
      },
      {
        id: "hundred_tasks",
        name: "Centurion",
        description: "Complete 100 tasks",
        icon: "👑",
        unlockedAt: completedTasks.length >= 100 ? completedTasks[99]?.completedAt : null,
        progress: Math.min(completedTasks.length, 100),
        target: 100,
      },
      {
        id: "month_streak",
        name: "Unstoppable",
        description: "30-day completion streak",
        icon: "🚀",
        unlockedAt: currentStreak >= 30 ? new Date() : null,
        progress: Math.min(currentStreak, 30),
        target: 30,
      },
    ];

    res.json({
      currentStreak,
      longestStreak,
      totalTasksCompleted: completedTasks.length,
      totalPoints,
      tasksCompletedToday,
      achievements,
      level,
      nextLevelPoints: level * 100,
    });
  } catch (e: any) {
    console.error("Failed to get stats:", e);
    res.status(500).json({ error: e.message || "Failed to get stats" });
  }
});

/**
 * GET /tasks/calendar-export/ical
 * Export tasks as iCal file with deep links back to the app
 */
router.get("/calendar-export/ical", async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = resolveUserId(req);
    
    if (!tenantId) return res.status(400).json({ error: "Missing tenantId" });

    // Get all tasks with due dates
    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        dueAt: { not: null },
      },
      orderBy: { dueAt: "asc" },
    });

    // Get tenant for app URL
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true }
    });

    // Build iCal content
    const appUrl = process.env.APP_URL || "https://app.example.com";
    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    
    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Task System//EN
CALSCALE:GREGORIAN
X-WR-CALNAME:${tenant?.name || "Tasks"}
X-WR-TIMEZONE:UTC
METHOD:PUBLISH
`;

    for (const task of tasks) {
      const uid = `task-${task.id}@${appUrl.replace(/https?:\/\//, "")}`;
      const created = task.createdAt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const dueDate = task.dueAt ? new Date(task.dueAt).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z" : now;
      
      // Build deep link based on related type
      let deepLink = `${appUrl}/tasks`;
      let location = "";
      
      if (task.relatedType === "LEAD" && task.relatedId) {
        deepLink = `${appUrl}/leads?task=${task.id}`;
        location = "Leads";
      } else if (task.relatedType === "PROJECT" && task.relatedId) {
        deepLink = `${appUrl}/workshop?task=${task.id}`;
        location = "Workshop";
      } else if (task.relatedType === "QUOTE" && task.relatedId) {
        deepLink = `${appUrl}/quotes/${task.relatedId}?task=${task.id}`;
        location = "Quote Builder";
      } else if (task.relatedType === "WORKSHOP" && task.relatedId) {
        deepLink = `${appUrl}/workshop?opportunity=${task.relatedId}&task=${task.id}`;
        location = "Workshop Process";
      } else {
        deepLink = `${appUrl}/tasks?id=${task.id}`;
        location = "Task Center";
      }

      const description = [
        task.description || "",
        "",
        `Priority: ${task.priority}`,
        `Status: ${task.status}`,
        "",
        `Open in app: ${deepLink}`,
      ].filter(Boolean).join("\\n");

      ical += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${created}
DTSTART:${dueDate}
SUMMARY:${task.title.replace(/\n/g, " ")}
DESCRIPTION:${description}
LOCATION:${location}
URL:${deepLink}
STATUS:${task.status === "DONE" ? "COMPLETED" : "CONFIRMED"}
PRIORITY:${task.priority === "URGENT" ? "1" : task.priority === "HIGH" ? "3" : task.priority === "MEDIUM" ? "5" : "7"}
END:VEVENT
`;
    }

    ical += `END:VCALENDAR`;

    res.setHeader("Content-Type", "text/calendar");
    res.setHeader("Content-Disposition", `attachment; filename="tasks-${new Date().toISOString().split("T")[0]}.ics"`);
    res.send(ical);
  } catch (e: any) {
    console.error("Failed to export calendar:", e);
    res.status(500).json({ error: e.message || "Failed to export calendar" });
  }
});

/* ---------------- AI Follow-up Email System ---------------- */

// Generate AI draft for a follow-up task
router.post("/:id/generate-draft", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: { select: { id: true } },
      },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    const meta = (task.meta as any) || {};
    let recipientEmail = meta.recipientEmail || req.body.recipientEmail;
    let recipientName = meta.recipientName || req.body.recipientName;

    // If no recipient email and task is related to a lead, fetch from lead
    if (!recipientEmail && task.relatedType === "LEAD" && task.relatedId) {
      const lead = await prisma.lead.findUnique({
        where: { id: task.relatedId },
        select: { email: true, contactName: true },
      });
      if (lead) {
        recipientEmail = lead.email;
        recipientName = recipientName || lead.contactName;
      }
    }

    if (!recipientEmail) {
      return res.status(400).json({ error: "recipient_email_required" });
    }

    // Generate draft
    const { generateEmailDraft } = await import("../services/aiEmailDrafter");
    const draft = await generateEmailDraft({
      recipientEmail,
      recipientName,
      purpose: req.body.purpose || "custom",
      customContext: task.description || req.body.context,
      tone: req.body.tone || "professional",
    });

    // Update task meta with draft
    await prisma.task.update({
      where: { id: task.id },
      data: {
        meta: {
          ...meta,
          aiDraft: {
            subject: draft.subject,
            body: draft.body,
            confidence: draft.confidence,
            generatedAt: new Date().toISOString(),
          },
        },
      },
    });

    return res.json({ ok: true, draft });
  } catch (e: any) {
    console.error("[tasks/:id/generate-draft]", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// Send email from a follow-up task
router.post("/:id/send-email", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    const { subject, body, to } = req.body;
    if (!subject || !body || !to) {
      return res.status(400).json({ error: "subject, body, and to are required" });
    }

    // Get tenant settings for brand name
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { brandName: true },
    });
    const brandName = settings?.brandName || "Sales Team";

    // Get email provider for user
    const { getEmailProviderForUser } = await import("../services/emailProvider");
    const provider = await getEmailProviderForUser(userId);

    if (!provider) {
      return res.status(400).json({ error: "no_email_provider_connected" });
    }

    // Send email with brand name
    const result = await provider.send({
      subject,
      body,
      to,
      cc: req.body.cc,
      bcc: req.body.bcc,
      fromName: brandName,
    });

    // Record in follow-up history
    const meta = (task.meta as any) || {};
    const aiDraft = meta.aiDraft;

    await (prisma as any).followUpHistory.create({
      data: {
        taskId: task.id,
        tenantId,
        userId,
        recipientEmail: to,
        aiDraftSubject: aiDraft?.subject,
        aiDraftBody: aiDraft?.body,
        finalSubject: subject,
        finalBody: body,
        sentAt: new Date(),
        messageId: result.messageId,
        threadId: result.threadId,
        userEdited: aiDraft ? aiDraft.subject !== subject || aiDraft.body !== body : false,
      },
    });

    // Store in email conversation
    await (prisma as any).emailConversation.create({
      data: {
        taskId: task.id,
        tenantId,
        messageId: result.messageId,
        threadId: result.threadId,
        fromAddress: userId, // Will need to get actual email
        toAddress: to,
        subject,
        body,
        direction: "SENT",
        timestamp: new Date(),
      },
    });

    // Update task status
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "IN_PROGRESS",
        emailMessageId: result.messageId,
        meta: {
          ...meta,
          emailSent: true,
          sentAt: new Date().toISOString(),
        },
      },
    });

    return res.json({ ok: true, messageId: result.messageId });
  } catch (e: any) {
    console.error("[tasks/:id/send-email]", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// Get email conversation for a task
router.get("/:id/conversation", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    const conversation = await (prisma as any).emailConversation.findMany({
      where: { taskId: task.id },
      orderBy: { timestamp: "asc" },
    });

    return res.json({ ok: true, conversation });
  } catch (e: any) {
    console.error("[tasks/:id/conversation]", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// Get AI-powered suggested actions for a task
router.get("/:id/suggestions", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    // TEMP: Commented out until schema fields are fixed
    // const { getSuggestedActions } = await import("../services/conversationalFollowUp");
    // const result = await getSuggestedActions(task.id);

    return res.json({ ok: true, suggestions: [] });
  } catch (e: any) {
    console.error("[tasks/:id/suggestions]", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// POST /tasks/:id/actions/accept-enquiry/preview - Preview accept email
router.post("/:id/actions/accept-enquiry/preview", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    const meta = (task.meta as any) || {};
    let recipientEmail = meta.recipientEmail;
    let recipientName = meta.recipientName;

    console.log("[accept-enquiry/preview] Task:", task.id, "meta:", meta, "relatedType:", task.relatedType, "relatedId:", task.relatedId);

    if (!recipientEmail && task.relatedType === "LEAD" && task.relatedId) {
      const lead = await prisma.lead.findUnique({
        where: { id: task.relatedId },
        select: { email: true, contactName: true, clientId: true },
      });
      console.log("[accept-enquiry/preview] Lead lookup:", lead);
      if (lead) {
        recipientEmail = lead.email;
        recipientName = recipientName || lead.contactName;

        if (!recipientEmail && lead.clientId) {
          const contact = await prisma.clientContact.findFirst({
            where: { clientId: lead.clientId, email: { not: null } },
            select: { email: true, name: true },
          });
          if (contact?.email) recipientEmail = contact.email;
          if (!recipientName && contact?.name) recipientName = contact.name;
        }
      }
    }

    if (!recipientEmail) {
      console.error("[accept-enquiry/preview] No recipient email found. Task meta:", meta, "Lead:", task.relatedType, task.relatedId);
      return res.status(400).json({ error: "recipient_email_required", details: "No email found in task metadata or related lead" });
    }

    // Get user details for email signature
    const user = userId ? await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, name: true, emailFooter: true },
    }) : null;

    const { generateEmailDraft } = await import("../services/aiEmailDrafter");
    const draft = await generateEmailDraft({
      recipientEmail,
      recipientName: recipientName || "there",
      senderFirstName: user?.firstName || user?.name?.split(' ')[0],
      senderLastName: user?.lastName || user?.name?.split(' ')[1],
      senderFullName: user?.name || undefined,
      emailFooter: user?.emailFooter || undefined,
      purpose: "custom",
      customContext: "Thank the customer for their enquiry and confirm we'll be in touch soon with a quote.",
      tone: "friendly",
    });

    return res.json({ 
      subject: draft.subject, 
      body: draft.body, 
      to: recipientEmail,
      recipientName 
    });
  } catch (e: any) {
    console.error("[tasks/:id/actions/accept-enquiry/preview]", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// POST /tasks/:id/actions/decline-enquiry/preview - Preview decline email
router.post("/:id/actions/decline-enquiry/preview", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    const meta = (task.meta as any) || {};
    let recipientEmail = meta.recipientEmail;
    let recipientName = meta.recipientName;

    console.log("[decline-enquiry/preview] Task:", task.id, "meta:", meta, "relatedType:", task.relatedType, "relatedId:", task.relatedId);

    if (!recipientEmail && task.relatedType === "LEAD" && task.relatedId) {
      const lead = await prisma.lead.findUnique({
        where: { id: task.relatedId },
        select: { email: true, contactName: true, clientId: true },
      });
      console.log("[decline-enquiry/preview] Lead lookup:", lead);
      if (lead) {
        recipientEmail = lead.email;
        recipientName = recipientName || lead.contactName;

        if (!recipientEmail && lead.clientId) {
          const contact = await prisma.clientContact.findFirst({
            where: { clientId: lead.clientId, email: { not: null } },
            select: { email: true, name: true },
          });
          if (contact?.email) recipientEmail = contact.email;
          if (!recipientName && contact?.name) recipientName = contact.name;
        }
      }
    }

    if (!recipientEmail) {
      console.error("[decline-enquiry/preview] No recipient email found. Task meta:", meta, "Lead:", task.relatedType, task.relatedId);
      return res.status(400).json({ error: "recipient_email_required", details: "No email found in task metadata or related lead" });
    }

    // Get user details for email signature
    const user = userId ? await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, name: true, emailFooter: true },
    }) : null;

    const { generateEmailDraft } = await import("../services/aiEmailDrafter");
    const draft = await generateEmailDraft({
      recipientEmail,
      recipientName: recipientName || "there",
      senderFirstName: user?.firstName || user?.name?.split(' ')[0],
      senderLastName: user?.lastName || user?.name?.split(' ')[1],
      senderFullName: user?.name || undefined,
      emailFooter: user?.emailFooter || undefined,
      purpose: "custom",
      customContext: "Politely decline the enquiry while keeping the door open for future opportunities. Explain that we're unable to take on this project at this time.",
      tone: "professional",
    });

    return res.json({ 
      subject: draft.subject, 
      body: draft.body, 
      to: recipientEmail,
      recipientName 
    });
  } catch (e: any) {
    console.error("[tasks/:id/actions/decline-enquiry/preview]", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// POST /tasks/:id/actions/accept-enquiry - Accept a review enquiry task
router.post("/:id/actions/accept-enquiry", async (req, res) => {
  try {
    console.log("[tasks/:id/actions/accept-enquiry] Starting...");
    const { tenantId, userId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { assignees: true },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    const meta = (task.meta as any) || {};
    let recipientEmail = meta.recipientEmail;
    let recipientName = meta.recipientName;

    // Fetch user details for personalization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        name: true,
        emailFooter: true,
      },
    });

    // If no recipient email and task is related to a lead, fetch from lead
    let emailMessageId: string | undefined;
    let emailThreadId: string | undefined;
    if (!recipientEmail && task.relatedType === "LEAD" && task.relatedId) {
      const lead = await prisma.lead.findUnique({
        where: { id: task.relatedId },
        select: { email: true, contactName: true, custom: true, clientId: true },
      });
      if (lead) {
        recipientEmail = lead.email;
        recipientName = recipientName || lead.contactName;

        if (!recipientEmail && lead.clientId) {
          const contact = await prisma.clientContact.findFirst({
            where: { clientId: lead.clientId, email: { not: null } },
            select: { email: true, name: true },
          });
          if (contact?.email) recipientEmail = contact.email;
          if (!recipientName && contact?.name) recipientName = contact.name;
        }
        
        // Extract email threading information
        const custom = lead.custom as any;
        if (custom) {
          emailMessageId = custom.messageId;
          emailThreadId = custom.threadId;
        }
      }
    }
    
    // Get tenant settings for brand name
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    const brandName = (settings?.brandName as string) || "Sales Team";

    const wrapEmailHtml = (body: string) => {
      const content = String(body || '').trim();
      const looksHtml = /<\/?[a-z][\s\S]*>/i.test(content);
      const inner = looksHtml ? content : content.replace(/\n/g, "<br/>");
      return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;"><div style="max-width:640px;margin:0 auto;background:#ffffff;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;">${inner}</div></body></html>`;
    };

    const { customSubject, customBody, skipEmail } = req.body || {};
    const shouldSendEmail = !skipEmail;

    // Send thank you email
    if (shouldSendEmail && recipientEmail && userId) {
      let finalSubject = customSubject;
      let finalBody = customBody;
      let userEdited = !!(customSubject || customBody);

      // Generate draft if no custom content provided
      if (!finalSubject || !finalBody) {
        const { generateEmailDraft } = await import("../services/aiEmailDrafter");
        const draft = await generateEmailDraft({
          recipientEmail: recipientEmail,
          recipientName: recipientName || "there",
          senderFirstName: user?.firstName || user?.name?.split(' ')[0],
          senderLastName: user?.lastName || user?.name?.split(' ')[1],
          senderFullName: user?.name || undefined,
          emailFooter: user?.emailFooter || undefined,
          purpose: "custom",
          customContext: "Thank the customer for their enquiry and confirm we'll be in touch soon with a quote.",
          tone: "friendly",
        });
        finalSubject = finalSubject || draft.subject;
        finalBody = finalBody || draft.body;
      }

      const { getEmailProviderForUser } = await import("../services/emailProvider");
      const provider = await getEmailProviderForUser(userId);
      if (provider) {
        await provider.send({
          to: recipientEmail,
          subject: finalSubject,
          body: finalBody,
          htmlBody: wrapEmailHtml(finalBody),
          fromName: brandName,
          inReplyTo: emailMessageId || undefined,
          references: emailThreadId ? [emailThreadId] : undefined,
        });
      }

      // Record in follow-up history
      await (prisma as any).followUpHistory.create({
        data: {
          taskId: task.id,
          tenantId,
          userId,
          recipientEmail: recipientEmail,
          aiDraftSubject: finalSubject,
          aiDraftBody: finalBody,
          finalSubject: finalSubject,
          finalBody: finalBody,
          sentAt: new Date(),
          userEdited: userEdited,
        },
      });
    }

    // Update task to completed
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "DONE",
        meta: {
          ...meta,
          action: "accepted",
          completedAt: new Date().toISOString(),
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        tenantId,
        entity: "TASK",
        entityId: task.id,
        verb: "COMPLETED",
        actorId: userId,
        data: { action: "accept_enquiry", emailSent: !!(shouldSendEmail && recipientEmail) } as any,
      },
    });

    // Log training event
    if (userId) {
      await logEvent({
        tenantId,
        module: "tasks",
        kind: "task_action_accept_enquiry",
        payload: { taskId: task.id, emailSent: !!(shouldSendEmail && recipientEmail) },
        actorId: userId,
      });
    }

    console.log("[tasks/:id/actions/accept-enquiry] Success");
    return res.json({ ok: true, emailSent: !!(shouldSendEmail && recipientEmail) });
  } catch (e: any) {
    console.error("[tasks/:id/actions/accept-enquiry] Error:", e?.message || e);
    console.error("[tasks/:id/actions/accept-enquiry] Stack:", e?.stack);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// POST /tasks/:id/actions/decline-enquiry - Decline an enquiry and set lead to DISQUALIFIED
router.post("/:id/actions/decline-enquiry", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    const meta = (task.meta as any) || {};
    let recipientEmail = meta.recipientEmail;
    let recipientName = meta.recipientName;

    // Fetch user details for personalization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        name: true,
        emailFooter: true,
      },
    });

    // If no recipient email and task is related to a lead, fetch from lead
    let emailMessageId: string | undefined;
    let emailThreadId: string | undefined;
    if (!recipientEmail && task.relatedType === "LEAD" && task.relatedId) {
      const lead = await prisma.lead.findUnique({
        where: { id: task.relatedId },
        select: { email: true, contactName: true, custom: true, clientId: true },
      });
      if (lead) {
        recipientEmail = lead.email;
        recipientName = recipientName || lead.contactName;

        if (!recipientEmail && lead.clientId) {
          const contact = await prisma.clientContact.findFirst({
            where: { clientId: lead.clientId, email: { not: null } },
            select: { email: true, name: true },
          });
          if (contact?.email) recipientEmail = contact.email;
          if (!recipientName && contact?.name) recipientName = contact.name;
        }
        
        // Extract email threading information
        const custom = lead.custom as any;
        if (custom) {
          emailMessageId = custom.messageId;
          emailThreadId = custom.threadId;
        }
      }
    }
    
    // Get tenant settings for brand name
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    const brandName = (settings?.brandName as string) || "Sales Team";

    // Send decline email
    if (recipientEmail && userId) {
      const { customSubject, customBody } = req.body || {};
      let finalSubject = customSubject;
      let finalBody = customBody;
      let userEdited = !!(customSubject || customBody);

      // Generate draft if no custom content provided
      if (!finalSubject || !finalBody) {
        const { generateEmailDraft } = await import("../services/aiEmailDrafter");
        const draft = await generateEmailDraft({
          recipientEmail: recipientEmail,
          recipientName: recipientName || "there",
          senderFirstName: user?.firstName || user?.name?.split(' ')[0],
          senderLastName: user?.lastName || user?.name?.split(' ')[1],
          senderFullName: user?.name || undefined,
          emailFooter: user?.emailFooter || undefined,
          purpose: "custom",
          customContext: "Politely decline to quote for this project, thank them for their interest and wish them well.",
          tone: "professional",
        });
        finalSubject = finalSubject || draft.subject;
        finalBody = finalBody || draft.body;
      }

      const { getEmailProviderForUser } = await import("../services/emailProvider");
      const provider = await getEmailProviderForUser(userId);
      if (provider) {
        await provider.send({
          to: recipientEmail,
          subject: finalSubject,
          body: finalBody,
          htmlBody: finalBody,
          fromName: brandName,
          inReplyTo: emailMessageId || undefined,
          references: emailThreadId ? [emailThreadId] : undefined,
        });
      }

      // Record in follow-up history
      await (prisma as any).followUpHistory.create({
        data: {
          taskId: task.id,
          tenantId,
          userId,
          recipientEmail: recipientEmail,
          aiDraftSubject: finalSubject,
          aiDraftBody: finalBody,
          finalSubject: finalSubject,
          finalBody: finalBody,
          sentAt: new Date(),
          userEdited: userEdited,
        },
      });
    }

    // Update lead status to DISQUALIFIED if task is related to a lead
    if (task.relatedType === "LEAD" && task.relatedId) {
      await prisma.lead.update({
        where: { id: task.relatedId },
        data: { status: "DISQUALIFIED" },
      });

      await prisma.activityLog.create({
        data: {
          tenantId,
          entity: "TASK" as any,
          entityId: task.relatedId,
          verb: "UPDATED" as any,
          actorId: userId,
          data: { reason: "decline_enquiry", taskId: task.id, leadStatus: "DISQUALIFIED" } as any,
        },
      });
    }

    // Update task to completed
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "DONE",
        meta: {
          ...meta,
          action: "declined",
          completedAt: new Date().toISOString(),
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        tenantId,
        entity: "TASK",
        entityId: task.id,
        verb: "COMPLETED",
        actorId: userId,
        data: { action: "decline_enquiry", emailSent: !!meta.recipientEmail } as any,
      },
    });

    // Log training event
    if (userId) {
      await logEvent({
        tenantId,
        module: "tasks",
        kind: "task_action_decline_enquiry",
        payload: { taskId: task.id, leadDisqualified: true },
        actorId: userId,
      });
    }

    return res.json({ ok: true, emailSent: !!recipientEmail, leadDisqualified: true });
  } catch (e: any) {
    console.error("[tasks/:id/actions/decline-enquiry]", e);
    console.error("[tasks/:id/actions/decline-enquiry] Stack:", e?.stack);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// POST /tasks/:id/actions/reject-enquiry - Reject as not a real enquiry and provide ML feedback
router.post("/:id/actions/reject-enquiry", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!task || task.tenantId !== tenantId) {
      return res.status(404).json({ error: "task_not_found" });
    }

    // Update lead status to REJECTED if task is related to a lead
    if (task.relatedType === "LEAD" && task.relatedId) {
      await prisma.lead.update({
        where: { id: task.relatedId },
        data: { status: "REJECTED" },
      });

      await prisma.activityLog.create({
        data: {
          tenantId,
          entity: "TASK" as any,
          entityId: task.relatedId,
          verb: "UPDATED" as any,
          actorId: userId,
          data: { reason: "not_an_enquiry", taskId: task.id, leadStatus: "REJECTED" } as any,
        },
      });

      // Log ML feedback
      await logInsight({
        tenantId,
        module: "tasks",
        inputSummary: "lead_rejected_not_enquiry",
        decision: "reject",
        confidence: 1.0,
        userFeedback: {
          leadId: task.relatedId,
          taskId: task.id,
          feedback: "not_an_enquiry",
        },
      });
    }

    const meta = (task.meta as any) || {};

    // Update task to completed
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "DONE",
        meta: {
          ...meta,
          action: "rejected",
          completedAt: new Date().toISOString(),
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        tenantId,
        entity: "TASK",
        entityId: task.id,
        verb: "COMPLETED",
        actorId: userId,
        data: { action: "reject_enquiry", mlFeedback: true } as any,
      },
    });

    // Log training event
    if (userId) {
      await logEvent({
        tenantId,
        module: "tasks",
        kind: "task_action_reject_enquiry",
        payload: { taskId: task.id, leadRejected: true },
        actorId: userId,
      });
    }

    return res.json({ ok: true, leadRejected: true, mlFeedback: true });
  } catch (e: any) {
    console.error("[tasks/:id/actions/reject-enquiry]", e);
    return res.status(500).json({ error: e.message || "failed" });
  }
});

// GET /tasks/workshop - Get workshop tasks for current user
router.get("/workshop", async (req: any, res) => {
  const tenantId = resolveTenantId(req);
  const userId = resolveUserId(req);
  const status = req.query.status as string | undefined;
  const includeCounts = req.query.includeCounts === "true";

  if (!tenantId || !userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    // Build status filter
    const statusFilter = status
      ? status.split(",").map((s: string) => s.toUpperCase()).filter((s: string) => ["OPEN", "IN_PROGRESS", "DONE", "BLOCKED", "CANCELLED"].includes(s))
      : ["OPEN", "IN_PROGRESS"];

    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        status: { in: statusFilter as any },
        assignees: {
          some: {
            userId,
          },
        },
      },
      include: {
        assignees: true,
      },
      orderBy: [
        { dueAt: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    // If includeCounts requested, calculate task statistics
    let counts;
    if (includeCounts) {
      const now = new Date();
      const { start: todayStart, end: todayEnd } = todayRange();
      
      const dueTodayTasks = tasks.filter(t => 
        t.dueAt && 
        t.dueAt >= todayStart && 
        t.dueAt <= todayEnd &&
        (t.status === "OPEN" || t.status === "IN_PROGRESS")
      );
      
      const overdueTasks = tasks.filter(t => 
        t.dueAt && 
        t.dueAt < todayStart &&
        (t.status === "OPEN" || t.status === "IN_PROGRESS")
      );

      counts = {
        total: tasks.length,
        dueToday: dueTodayTasks.length,
        overdue: overdueTasks.length,
        dueTodayIds: dueTodayTasks.map(t => t.id),
        overdueIds: overdueTasks.map(t => t.id),
      };
    }

    return res.json({ ok: true, tasks, counts });
  } catch (e: any) {
    console.error("[tasks/workshop]", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /tasks/:id/link-material - Link task to material order
router.patch("/:id/link-material", async (req: any, res) => {
  const tenantId = resolveTenantId(req);
  const userId = resolveUserId(req);
  const taskId = req.params.id;
  const { materialType, opportunityId, processCode } = req.body;

  if (!tenantId || !userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!materialType || !["timber", "glass", "ironmongery", "paint"].includes(materialType)) {
    return res.status(400).json({ error: "invalid_material_type" });
  }

  if (!opportunityId) {
    return res.status(400).json({ error: "opportunity_id_required" });
  }

  try {
    // Verify task exists and belongs to tenant
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      return res.status(404).json({ error: "task_not_found" });
    }

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId },
    });

    if (!opportunity) {
      return res.status(404).json({ error: "opportunity_not_found" });
    }

    // Update task metadata with material link
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        meta: {
          ...(task.meta as any || {}),
          linkedMaterial: materialType,
          linkedMaterialType: materialType,
          linkedOpportunityId: opportunityId,
          ...(processCode ? { processCode } : {}),
        },
      },
    });

    return res.json({ ok: true, task: updatedTask });
  } catch (e: any) {
    console.error("[tasks/:id/link-material]", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// PATCH /materials/:opportunityId/received - Mark material as received
router.patch("/materials/:opportunityId/received", async (req: any, res) => {
  const tenantId = resolveTenantId(req);
  const userId = resolveUserId(req);
  const opportunityId = req.params.opportunityId;
  const { materialType, receivedDate, notes } = req.body;

  if (!tenantId || !userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!materialType || !["timber", "glass", "ironmongery", "paint"].includes(materialType)) {
    return res.status(400).json({ error: "invalid_material_type" });
  }

  try {
    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId },
    });

    if (!opportunity) {
      return res.status(404).json({ error: "opportunity_not_found" });
    }

    // Update the appropriate received date field
    const updateData: any = {};
    const fieldMap: Record<string, string> = {
      timber: "timberReceivedAt",
      glass: "glassReceivedAt",
      ironmongery: "ironmongeryReceivedAt",
      paint: "paintReceivedAt",
    };

    const receivedField = fieldMap[materialType];
    if (receivedField) {
      updateData[receivedField] = receivedDate ? new Date(receivedDate) : new Date();
    }

    const updated = await prisma.opportunity.update({
      where: { id: opportunityId },
      data: updateData,
    });

    return res.json({ ok: true, opportunity: updated });
  } catch (e: any) {
    console.error("[materials/:opportunityId/received]", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;