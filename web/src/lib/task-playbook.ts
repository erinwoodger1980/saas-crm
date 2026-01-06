// web/src/lib/task-playbook.ts
export type UiStatus =
  | "NEW_ENQUIRY"
  | "INFO_REQUESTED"
  | "DISQUALIFIED"
  | "REJECTED"
  | "READY_TO_QUOTE"
  | "ESTIMATE"
  | "QUOTE_SENT"
  | "WON"
  | "LOST"
  | "COMPLETED";

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

const STATUS_KEYS: UiStatus[] = [
  "NEW_ENQUIRY",
  "INFO_REQUESTED",
  "DISQUALIFIED",
  "REJECTED",
  "READY_TO_QUOTE",
  "ESTIMATE",
  "QUOTE_SENT",
  "WON",
  "LOST",
  "COMPLETED",
];

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
  ESTIMATE: [
    {
      id: "status:review-estimate",
      title: "Review estimate with customer",
      dueInDays: 2,
      priority: "MEDIUM",
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
  COMPLETED: [],
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

function cloneStatusDefaults() {
  const result: Record<UiStatus, TaskRecipe[]> = {} as any;
  for (const key of STATUS_KEYS) {
    result[key] = DEFAULT_STATUS_RECIPES[key].map((recipe) => ({ ...recipe }));
  }
  return result;
}

function cloneManualDefaults() {
  const result: Record<string, TaskRecipe> = {};
  for (const key of MANUAL_TASK_KEYS) {
    result[key] = { ...DEFAULT_MANUAL_RECIPES[key] };
  }
  return result;
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
  const status = cloneStatusDefaults();
  if (raw && typeof raw.status === "object") {
    for (const key of STATUS_KEYS) {
      const arr = Array.isArray(raw.status?.[key]) ? raw.status[key] : [];
      const cleaned: TaskRecipe[] = [];
      arr.forEach((item: any, index: number) => {
        const recipe = sanitizeRecipe(item, `${key.toLowerCase()}-${index}`);
        if (recipe) cleaned.push(recipe);
      });
      if (cleaned.length > 0) status[key] = cleaned;
    }
  }

  const manual = cloneManualDefaults();
  if (raw && typeof raw.manual === "object") {
    for (const key of Object.keys(raw.manual)) {
      const recipe = sanitizeRecipe(raw.manual[key], String(key));
      if (recipe) manual[key] = recipe;
    }
  }

  return { status, manual };
}
