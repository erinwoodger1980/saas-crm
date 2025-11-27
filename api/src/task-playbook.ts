// api/src/task-playbook.ts
import { prisma } from "./prisma";

export type UiStatus =
  | "NEW_ENQUIRY"
  | "INFO_REQUESTED"
  | "DISQUALIFIED"
  | "REJECTED"
  | "READY_TO_QUOTE"
  | "QUOTE_SENT"
  | "WON"
  | "LOST";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type RelatedType =
  | "LEAD"
  | "PROJECT"
  | "QUOTE"
  | "EMAIL"
  | "QUESTIONNAIRE"
  | "WORKSHOP"
  | "OTHER";

export type TaskRecipe = {
  id: string;
  title: string;
  description?: string | null;
  dueInDays?: number | null;
  priority?: TaskPriority;
  relatedType?: RelatedType;
  active?: boolean;
  autoAssign?: "ACTOR" | "NONE";
};

export type TaskPlaybook = {
  status: Record<UiStatus, TaskRecipe[]>;
  manual: Record<string, TaskRecipe>;
};

export const MANUAL_TASK_KEYS = [
  "questionnaire_followup",
  "supplier_followup",
  "quote_draft_complete",
] as const;
export type ManualTaskKey = (typeof MANUAL_TASK_KEYS)[number];

const DEFAULT_STATUS_RECIPES: Record<UiStatus, TaskRecipe[]> = {
  NEW_ENQUIRY: [
    {
      id: "status:new-review",
      title: "Review enquiry",
      dueInDays: 1,
      priority: "MEDIUM",
      relatedType: "LEAD",
      active: true,
    },
  ],
  INFO_REQUESTED: [],
  DISQUALIFIED: [],
  REJECTED: [],
  READY_TO_QUOTE: [
    {
      id: "status:create-quote",
      title: "Create quote",
      dueInDays: 1,
      priority: "HIGH",
      relatedType: "LEAD",
      active: true,
    },
  ],
  QUOTE_SENT: [
    {
      id: "status:followup-quote",
      title: "Follow up on quote",
      dueInDays: 3,
      priority: "MEDIUM",
      relatedType: "LEAD",
      active: true,
    },
  ],
  WON: [],
  LOST: [],
};

const DEFAULT_MANUAL_RECIPES: Record<ManualTaskKey, TaskRecipe> = {
  questionnaire_followup: {
    id: "manual:review-questionnaire",
    title: "Review questionnaire",
    dueInDays: 2,
    priority: "MEDIUM",
    relatedType: "LEAD",
    active: true,
  },
  supplier_followup: {
    id: "manual:chase-supplier",
    title: "Chase supplier price",
    dueInDays: 3,
    priority: "MEDIUM",
    relatedType: "LEAD",
    active: true,
  },
  quote_draft_complete: {
    id: "manual:complete-draft-estimate",
    title: "Complete draft estimate",
    dueInDays: 1,
    priority: "HIGH",
    relatedType: "QUOTE",
    active: true,
  },
};

export const DEFAULT_TASK_PLAYBOOK: TaskPlaybook = {
  status: DEFAULT_STATUS_RECIPES,
  manual: DEFAULT_MANUAL_RECIPES,
};

function cloneDefaultStatus(): Record<UiStatus, TaskRecipe[]> {
  return Object.fromEntries(
    (Object.keys(DEFAULT_STATUS_RECIPES) as UiStatus[]).map((key) => [
      key,
      DEFAULT_STATUS_RECIPES[key].map((r) => ({ ...r })),
    ])
  ) as Record<UiStatus, TaskRecipe[]>;
}

function cloneDefaultManual(): Record<string, TaskRecipe> {
  const out: Record<string, TaskRecipe> = {};
  for (const key of MANUAL_TASK_KEYS) {
    out[key] = { ...DEFAULT_MANUAL_RECIPES[key] };
  }
  return out;
}

function sanitizeRecipe(raw: any, fallbackId: string): TaskRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : fallbackId;
  const due =
    typeof raw.dueInDays === "number"
      ? raw.dueInDays
      : typeof raw.dueInDays === "string" && raw.dueInDays.trim()
      ? Number(raw.dueInDays)
      : undefined;
  const priority =
    raw.priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(String(raw.priority).toUpperCase())
      ? (String(raw.priority).toUpperCase() as TaskPriority)
      : undefined;
  const relatedType =
    raw.relatedType &&
    ["LEAD", "PROJECT", "QUOTE", "EMAIL", "QUESTIONNAIRE", "WORKSHOP", "OTHER"].includes(String(raw.relatedType).toUpperCase())
      ? (String(raw.relatedType).toUpperCase() as RelatedType)
      : undefined;
  const autoAssign = raw.autoAssign === "ACTOR" ? "ACTOR" : undefined;
  return {
    id,
    title,
    description: typeof raw.description === "string" ? raw.description : undefined,
    dueInDays: Number.isFinite(due) ? Number(due) : undefined,
    priority,
    relatedType,
    active: raw.active === undefined ? true : !!raw.active,
    autoAssign,
  };
}

export function normalizeTaskPlaybook(raw?: any): TaskPlaybook {
  const status = cloneDefaultStatus();
  if (raw && typeof raw.status === "object") {
    for (const key of Object.keys(status) as UiStatus[]) {
      const arr = Array.isArray(raw.status?.[key]) ? raw.status[key] : [];
      const cleaned: TaskRecipe[] = [];
      arr.forEach((item: any, index: number) => {
        const recipe = sanitizeRecipe(item, `${key.toLowerCase()}-${index}`);
        if (recipe) cleaned.push(recipe);
      });
      if (cleaned.length > 0) status[key] = cleaned;
    }
  }

  const manual = cloneDefaultManual();
  if (raw && typeof raw.manual === "object") {
    for (const key of Object.keys(raw.manual)) {
      const recipe = sanitizeRecipe(raw.manual[key], String(key));
      if (recipe) manual[key] = recipe;
    }
  }

  return { status, manual };
}

export async function loadTaskPlaybook(tenantId: string): Promise<TaskPlaybook> {
  if (!tenantId) return normalizeTaskPlaybook();
  const row = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { taskPlaybook: true },
  });
  return normalizeTaskPlaybook(row?.taskPlaybook as any);
}

function isTaskTableMissing(err: any) {
  if (!err) return false;
  if (err.code === "P2021") return true;
  const msg = typeof err.message === "string" ? err.message : "";
  return msg.includes("Task") && msg.includes("does not exist");
}

export async function ensureTaskFromRecipe(opts: {
  tenantId: string;
  recipe: TaskRecipe | null | undefined;
  relatedId: string;
  relatedType?: RelatedType;
  uniqueKey?: string;
  actorId?: string | null;
}) {
  const { tenantId, recipe, relatedId } = opts;
  if (!recipe || recipe.active === false) return null;

  const relatedType = opts.relatedType ?? recipe.relatedType ?? "LEAD";
  const key = opts.uniqueKey ?? `${recipe.id}:${relatedType}:${relatedId}`;

  try {
    const where: any = {
      tenantId,
      relatedType: relatedType as any,
      relatedId,
    };
    if (key) {
      where.meta = { path: ["key"], equals: key } as any;
    } else {
      where.title = recipe.title;
    }

    const existing = await prisma.task.findFirst({ where });
    if (existing) return existing;

    let dueAt: Date | undefined;
    const dueInDays = typeof recipe.dueInDays === "number" ? recipe.dueInDays : undefined;
    if (typeof dueInDays === "number" && dueInDays > 0) {
      dueAt = new Date(Date.now() + dueInDays * 86_400_000);
    }

    // Build metadata - include lead email info for review enquiry tasks
    const meta: any = key ? { key } : {};
    
    // If this is a lead task, fetch email info to support action buttons
    if (relatedType === "LEAD") {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: relatedId },
          select: { email: true, contactName: true },
        });
        if (lead?.email) {
          meta.recipientEmail = lead.email;
          meta.recipientName = lead.contactName;
        }
      } catch (err) {
        console.warn(`[task-playbook] Could not fetch lead email for task metadata:`, err);
      }
    }

    const task = await prisma.task.create({
      data: {
        tenantId,
        title: recipe.title,
        description: recipe.description ?? null,
        relatedType: relatedType as any,
        relatedId,
        status: "OPEN" as any,
        priority: (recipe.priority ?? "MEDIUM") as any,
        dueAt,
        meta,
      },
    });

    if (recipe.autoAssign === "ACTOR" && opts.actorId) {
      await prisma.taskAssignee.upsert({
        where: { taskId_userId: { taskId: task.id, userId: opts.actorId } },
        update: {},
        create: { taskId: task.id, userId: opts.actorId, role: "OWNER" as any },
      });
    }

    return task;
  } catch (err: any) {
    if (isTaskTableMissing(err)) {
      console.warn(`[task-playbook] Task table missing – skipping ensureTaskFromRecipe for "${recipe.title}"`);
      return null;
    }
    throw err;
  }
}
