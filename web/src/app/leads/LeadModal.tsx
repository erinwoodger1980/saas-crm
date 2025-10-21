// web/src/app/leads/LeadModal.tsx
"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import {
  DEFAULT_TASK_PLAYBOOK,
  ManualTaskKey,
  TaskRecipe,
  TaskPlaybook,
  normalizeTaskPlaybook,
} from "@/lib/task-playbook";
import {
  DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
  DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
} from "@/lib/constants";
import LeadSourcePicker from "@/components/leads/LeadSourcePicker";

/* ----------------------------- Types ----------------------------- */

export type Lead = {
  id: string;
  contactName?: string | null;
  email?: string | null;
  status:
    | "NEW_ENQUIRY"
    | "INFO_REQUESTED"
    | "DISQUALIFIED"
    | "REJECTED"
    | "READY_TO_QUOTE"
    | "QUOTE_SENT"
    | "WON"
    | "LOST";
  custom?: any;
  description?: string | null;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedType?: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  meta?: { key?: string } | null;
};

type QuestionnaireField = {
  id?: string;
  key?: string;
  label?: string;
  required?: boolean;
  type?: string;
  options?: string[];
  askInQuestionnaire?: boolean;
  showOnLead?: boolean;
  sortOrder?: number;
};

type NormalizedQuestionnaireField = {
  id: string;
  key: string;
  label: string;
  required: boolean;
  type: string;
  options: string[];
  askInQuestionnaire: boolean;
  showOnLead: boolean;
  sortOrder: number;
};

type TenantSettings = {
  slug: string;
  brandName?: string | null;
  questionnaire?: { title?: string; questions?: QuestionnaireField[] } | QuestionnaireField[] | null;
  taskPlaybook?: TaskPlaybook;
  questionnaireEmailSubject?: string | null;
  questionnaireEmailBody?: string | null;
};

const STATUS_LABELS: Record<Lead["status"], string> = {
  NEW_ENQUIRY: "New enquiry",
  INFO_REQUESTED: "Info requested",
  DISQUALIFIED: "Disqualified",
  REJECTED: "Rejected",
  READY_TO_QUOTE: "Ready to quote",
  QUOTE_SENT: "Quote sent",
  WON: "Won",
  LOST: "Lost",
};

/* ---------------- Status mapping ---------------- */

const uiToServerStatus: Record<Lead["status"], string> = {
  NEW_ENQUIRY: "NEW",
  INFO_REQUESTED: "INFO_REQUESTED",
  DISQUALIFIED: "DISQUALIFIED",
  REJECTED: "REJECTED",
  READY_TO_QUOTE: "READY_TO_QUOTE",
  QUOTE_SENT: "QUOTE_SENT",
  WON: "WON",
  LOST: "LOST",
};

function serverToUiStatus(s?: string | null): Lead["status"] {
  switch ((s || "").toUpperCase()) {
    case "NEW":
      return "NEW_ENQUIRY";
    case "CONTACTED":
    case "INFO_REQUESTED":
      return "INFO_REQUESTED";
    case "QUALIFIED":
    case "READY_TO_QUOTE":
      return "READY_TO_QUOTE";
    case "QUOTE_SENT":
      return "QUOTE_SENT";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    case "REJECTED":
      return "REJECTED";
    case "WON":
      return "WON";
    case "LOST":
      return "LOST";
    default:
      return "NEW_ENQUIRY";
  }
}

/* ----------------------------- Utils ----------------------------- */

function get(obj: any, path: string) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function pickFirst<T>(...vals: Array<T | null | undefined>): T | undefined {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      if (v.trim() !== "") return v as T;
    } else return v as T;
  }
  return undefined;
}
function avatarText(name?: string | null) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] || p[0][1] || "")).toUpperCase();
}

const FIELD_TYPES = new Set(["text", "textarea", "select", "number", "date", "source"]);

function normalizeQuestionnaireFields(
  config: TenantSettings["questionnaire"]
): NormalizedQuestionnaireField[] {
  if (!config) return [];
  const list = Array.isArray(config) ? config : config?.questions ?? [];
  return list
    .map((raw, idx) => {
      if (!raw || typeof raw !== "object") return null;
      const key = typeof raw.key === "string" && raw.key.trim() ? raw.key.trim() : undefined;
      if (!key) return null;
      const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : key;
      const label =
        (typeof raw.label === "string" && raw.label.trim()) ||
        key ||
        id ||
        "Field";
      const typeRaw = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim() : "text";
      const type = FIELD_TYPES.has(typeRaw) ? typeRaw : "text";
      const required = Boolean((raw as any).required);
      const askInQuestionnaire =
        (raw as any).askInQuestionnaire !== undefined
          ? Boolean((raw as any).askInQuestionnaire)
          : true;
      const showOnLead =
        (raw as any).showOnLead !== undefined
          ? Boolean((raw as any).showOnLead)
          : Boolean((raw as any).showInternally || (raw as any).workspace);
      const options =
        type === "select" && Array.isArray(raw.options)
          ? raw.options
              .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
              .filter(Boolean)
          : [];
      const sortOrder =
        typeof (raw as any).sortOrder === "number" && Number.isFinite((raw as any).sortOrder)
          ? (raw as any).sortOrder
          : idx;
      return {
        id,
        key,
        label,
        required,
        type,
        options,
        askInQuestionnaire,
        showOnLead,
        sortOrder,
      } as NormalizedQuestionnaireField;
    })
    .filter((item): item is NormalizedQuestionnaireField => Boolean(item?.key))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function formatAnswer(value: any): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
      .filter(Boolean)
      .join(", ");
    return joined || null;
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const str = String(value);
  return str.trim() ? str : null;
}
function toast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className =
    "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-[1000]";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function toIsoOrUndefined(localValue: string): string | undefined {
  if (!localValue) return undefined;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/* ----------------------------- Component ----------------------------- */

export default function LeadModal({
  open,
  onOpenChange,
  leadPreview,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadPreview: Lead | null;
  onUpdated?: () => void | Promise<void>;
}) {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";
  const userId = ids?.userId || "";

  const authHeaders = useMemo(
    () => ({ "x-tenant-id": tenantId, "x-user-id": userId }),
    [tenantId, userId]
  );

  const [lead, setLead] = useState<Lead | null>(leadPreview);
  const [uiStatus, setUiStatus] = useState<Lead["status"]>("NEW_ENQUIRY");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);

  const playbook = useMemo(
    () => normalizeTaskPlaybook(settings?.taskPlaybook ?? DEFAULT_TASK_PLAYBOOK),
    [settings?.taskPlaybook]
  );

  // editable fields
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [descInput, setDescInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTask, setBusyTask] = useState(false);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [taskComposer, setTaskComposer] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Task["priority"],
    dueAt: "",
  });
  const [taskAssignToMe, setTaskAssignToMe] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSaving, setTaskSaving] = useState(false);
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});

  const lastSavedServerStatusRef = useRef<string | null>(null);

  const showEstimateCta = useMemo(
    () => uiStatus === "READY_TO_QUOTE" || uiStatus === "QUOTE_SENT" || uiStatus === "WON",
    [uiStatus]
  );

  useEffect(() => {
    if (open) return;
    setLead(null);
    setNameInput("");
    setEmailInput("");
    setDescInput("");
    setTasks([]);
    setUiStatus("NEW_ENQUIRY");
    lastSavedServerStatusRef.current = null;
    setLoading(false);
    setSaving(false);
    setBusyTask(false);
    setShowTaskComposer(false);
    setTaskComposer({ title: "", description: "", priority: "MEDIUM", dueAt: "" });
    setTaskAssignToMe(true);
    setTaskError(null);
    setTaskSaving(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  // keep preview visible immediately
  useEffect(() => {
    if (!leadPreview?.id) return;

    const previewDescription = (() => {
      const raw =
        (typeof leadPreview.description === "string" ? leadPreview.description : undefined) ??
        (typeof leadPreview.custom?.description === "string" ? leadPreview.custom.description : undefined) ??
        (typeof leadPreview.custom?.bodyText === "string" ? leadPreview.custom.bodyText : undefined);
      return raw?.trim() ?? "";
    })();
    const hasPreviewDescription =
      typeof leadPreview.description === "string" ||
      typeof leadPreview.custom?.description === "string" ||
      typeof leadPreview.custom?.bodyText === "string";

    setLead((prev) => {
      if (prev && prev.id === leadPreview.id) {
        const next: Lead = {
          ...prev,
          contactName: leadPreview.contactName ?? prev.contactName ?? null,
          email: leadPreview.email ?? prev.email ?? null,
          custom: leadPreview.custom ?? prev.custom,
          description: hasPreviewDescription
            ? previewDescription || null
            : prev.description ?? null,
        };
        return next;
      }

      const normalized: Lead = {
        id: leadPreview.id,
        contactName: leadPreview.contactName ?? null,
        email: leadPreview.email ?? null,
        status: leadPreview.status ?? "NEW_ENQUIRY",
        custom: leadPreview.custom ?? null,
        description: hasPreviewDescription ? previewDescription || null : null,
      };

      setNameInput(normalized.contactName ?? "");
      setEmailInput(normalized.email ?? "");
      setDescInput(previewDescription);

      return normalized;
    });
  }, [leadPreview]);

  // load full lead + tasks + settings
  useEffect(() => {
    if (!open || !leadPreview?.id) return;
    let stop = false;

    (async () => {
      setLoading(true);
      try {
        const [one, tlist, s] = await Promise.all([
          apiFetch<{ lead?: any } | any>(`/leads/${leadPreview.id}`, { headers: authHeaders }),
          apiFetch<{ items: Task[]; total: number }>(
            `/tasks?relatedType=LEAD&relatedId=${encodeURIComponent(leadPreview.id)}&mine=false`,
            { headers: authHeaders }
          ),
          apiFetch<TenantSettings>("/tenant/settings", { headers: authHeaders }).catch(() => null as any),
        ]);
        if (stop) return;

        // tolerate either shape: {lead} or the row directly
        const row = (one && "lead" in one ? one.lead : one) ?? {};
        const sUi = serverToUiStatus(row.status);
        lastSavedServerStatusRef.current = row.status ?? null;

        const contactName =
          pickFirst<string>(row.contactName, get(row, "contact.name"), leadPreview.contactName) ?? null;
        const email =
          pickFirst<string>(row.email, get(row, "contact.email"), get(row, "custom.fromEmail"), leadPreview.email) ??
          null;
        const description =
          pickFirst<string>(
            row.description,
            get(row, "custom.description"),
            get(row, "custom.bodyText"),
            leadPreview.description,
            get(leadPreview, "custom.description"),
            get(leadPreview, "custom.bodyText")
          ) ?? null;

        const normalized: Lead = {
          id: row.id || leadPreview.id,
          contactName,
          email,
          status: sUi,
          custom: row.custom ?? row.briefJson ?? null,
          description,
        };
        setLead(normalized);
        setUiStatus(sUi);

        // seed inputs
        setNameInput(contactName || "");
        setEmailInput(email || "");
        setDescInput(description || "");

        // After fetching full lead + tasks list:
        setTasks(tlist?.items ?? []);
        if (s) {
          setSettings({
            ...s,
            taskPlaybook: normalizeTaskPlaybook((s as any).taskPlaybook),
          });
        }

        const seeded = await ensureStatusTasks(sUi, tlist?.items ?? []);
        if (seeded) await reloadTasks();
      } finally {
        if (!stop) setLoading(false);
      }
    })();

    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadPreview?.id]);

  /* ----------------------------- Save helpers ----------------------------- */

  async function triggerOnUpdated() {
    if (!onUpdated) return;
    try {
      await Promise.resolve(onUpdated());
    } catch (err) {
      console.error("onUpdated handler failed", err);
    }
  }

  async function saveStatus(nextUi: Lead["status"]): Promise<boolean> {
    if (!lead?.id) return false;

    const prevServerStatus = lastSavedServerStatusRef.current;
    const prevUiStatus =
      prevServerStatus != null ? serverToUiStatus(prevServerStatus) : lead.status;

    if (prevUiStatus === nextUi) {
      return true;
    }

    const nextServer = uiToServerStatus[nextUi];

    setSaving(true);
    try {
      const response = await apiFetch<{ lead?: any }>(`/leads/${lead.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: { status: nextServer },
      });

      const updatedRow = response?.lead ?? null;
      const serverStatus = (updatedRow?.status as string | undefined) ?? nextServer;
      lastSavedServerStatusRef.current = serverStatus;

      const resolvedUi = serverToUiStatus(serverStatus);
      setLead((current) => (current ? { ...current, status: resolvedUi } : current));
      setUiStatus(resolvedUi);

      if (prevUiStatus !== resolvedUi) {
        await triggerOnUpdated();
      }

      if (prevUiStatus !== resolvedUi) {
        const seeded = await ensureStatusTasks(resolvedUi);
        if (seeded) await reloadTasks();
      }

      toast("Saved. One step closer.");
      return true;
    } catch (e: any) {
      console.error("status save failed", e?.message || e);
      const fallbackUi =
        prevServerStatus != null
          ? serverToUiStatus(prevServerStatus)
          : lead?.status || "NEW_ENQUIRY";
      setUiStatus(fallbackUi);
      setLead((current) => (current ? { ...current, status: fallbackUi } : current));
      alert(`Failed to save status: ${e?.message || "unknown error"}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function savePatch(patch: any) {
    if (!lead?.id) return;
    try {
      await apiFetch(`/leads/${lead.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: patch,
      });
      setLead((current) => {
        if (!current) return current;
        const next: Lead = { ...current };
        if (Object.prototype.hasOwnProperty.call(patch, "contactName")) {
          next.contactName = patch.contactName ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(patch, "email")) {
          next.email = patch.email ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(patch, "description")) {
          next.description = patch.description ?? null;
        }
        if (Object.prototype.hasOwnProperty.call(patch, "custom")) {
          const customPatch = patch.custom;
          if (customPatch && typeof customPatch === "object" && !Array.isArray(customPatch)) {
            const prev =
              current.custom && typeof current.custom === "object"
                ? { ...(current.custom as Record<string, any>) }
                : {};
            const merged = { ...prev };
            Object.entries(customPatch).forEach(([k, v]) => {
              merged[k] = v ?? null;
            });
            next.custom = merged;
          } else {
            next.custom = customPatch ?? null;
          }
        }
        return next;
      });
      await triggerOnUpdated();
    } catch (e: any) {
      console.error("patch failed", e?.message || e);
      alert("Failed to save changes");
    }
  }

  async function saveCustomField(field: NormalizedQuestionnaireField, rawValue: string) {
    if (!field.key) return;
    let value: any = rawValue;
    if (field.type === "number") {
      const trimmed = rawValue.trim();
      value = trimmed === "" ? null : Number(trimmed);
      if (value != null && Number.isNaN(value)) {
        value = null;
      }
    } else if (field.type === "date") {
      value = rawValue ? rawValue : null;
    } else {
      const trimmed = rawValue.trim();
      value = trimmed ? trimmed : null;
    }

    const normalizeForCompare = (val: any) => {
      if (val === undefined || val === null || val === "") return null;
      if (field.type === "number") {
        const num = Number(val);
        return Number.isNaN(num) ? null : num;
      }
      if (field.type === "date") {
        return String(val).slice(0, 10);
      }
      return String(val);
    };

    const currentNormalized = normalizeForCompare(customData?.[field.key]);
    const nextNormalized = normalizeForCompare(value);
    if (currentNormalized === nextNormalized) return;

    await savePatch({ custom: { [field.key]: value } });
  }

  async function reloadTasks() {
    if (!lead?.id) return;
    const data = await apiFetch<{ items: Task[]; total: number }>(
      `/tasks?relatedType=LEAD&relatedId=${encodeURIComponent(lead.id)}&mine=false`,
      { headers: authHeaders }
    );
    setTasks(data.items || []);
  }

  function resetTaskComposer() {
    setTaskComposer({ title: "", description: "", priority: "MEDIUM", dueAt: "" });
    setTaskAssignToMe(true);
    setTaskError(null);
  }

  async function createManualTask() {
    if (!lead?.id) return;
    if (!taskComposer.title.trim()) {
      setTaskError("Title required");
      return;
    }

    setTaskSaving(true);
    setTaskError(null);
    try {
      await apiFetch("/tasks", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: {
          title: taskComposer.title.trim(),
          description: taskComposer.description.trim() || undefined,
          relatedType: "LEAD" as const,
          relatedId: lead.id,
          priority: taskComposer.priority,
          dueAt: toIsoOrUndefined(taskComposer.dueAt),
          assignees:
            taskAssignToMe && userId
              ? [{ userId, role: "OWNER" as const }]
              : undefined,
        },
      });

      toast("Task created");
      resetTaskComposer();
      setShowTaskComposer(false);
      await reloadTasks();
    } catch (e: any) {
      setTaskError(e?.message || "Failed to create task");
    } finally {
      setTaskSaving(false);
    }
  }

function taskExists(list: Task[] | undefined, uniqueKey: string | undefined, title: string) {
  if (!list || list.length === 0) return false;
  const normalizedTitle = title.trim().toLowerCase();
  return list.some((task) => {
    const metaKey = typeof task.meta === "object" ? (task.meta as any)?.key : undefined;
    if (uniqueKey && metaKey) return metaKey === uniqueKey;
    if (uniqueKey) return false;
    return task.title.trim().toLowerCase() === normalizedTitle;
  });
}

async function ensureRecipeTask(
  recipe: TaskRecipe | undefined,
  overrides?: { existing?: Task[]; relatedType?: Task["relatedType"]; relatedId?: string | null; uniqueSuffix?: string }
) {
  if (!lead?.id || !recipe || recipe.active === false) return false;

  const relatedType = overrides?.relatedType ?? recipe.relatedType ?? "LEAD";
  const relatedId =
    overrides?.relatedId ?? (relatedType === "LEAD" ? lead.id : overrides?.relatedId ?? lead.id);
  const suffix = overrides?.uniqueSuffix ?? relatedId ?? lead.id;
  const uniqueKey = `${recipe.id}:${relatedType}:${suffix}`;
  if (taskExists(overrides?.existing ?? tasks, uniqueKey, recipe.title)) return false;

  const dueAt =
    typeof recipe.dueInDays === "number" && recipe.dueInDays > 0
      ? new Date(Date.now() + recipe.dueInDays * 86_400_000).toISOString()
      : undefined;

  const assignees =
    recipe.autoAssign === "ACTOR" && userId
      ? [{ userId, role: "OWNER" as const }]
      : undefined;

  await apiFetch("/tasks", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    json: {
      title: recipe.title,
      description: recipe.description || undefined,
      priority: recipe.priority ?? "MEDIUM",
      relatedType,
      relatedId: relatedId ?? undefined,
      dueAt,
      meta: { key: uniqueKey, source: "playbook" },
      assignees,
    },
  });

  return true;
}

async function ensureManualTask(
  key: ManualTaskKey,
  overrides?: { existing?: Task[]; relatedType?: Task["relatedType"]; relatedId?: string | null }
) {
  await ensureRecipeTask(playbook.manual[key], overrides);
}

async function ensureStatusTasks(status: Lead["status"], existing?: Task[]) {
  const recipes = playbook.status[status] || [];
  let created = false;
  for (const recipe of recipes) {
    const made = await ensureRecipeTask(recipe, { existing, uniqueSuffix: lead?.id });
    created = created || !!made;
  }
  return created;
}

  async function toggleTaskComplete(t: Task) {
    const url = t.status === "DONE" ? `/tasks/${t.id}/reopen` : `/tasks/${t.id}/complete`;
    await apiFetch(url, { method: "POST", headers: authHeaders });
    await reloadTasks();
  }

  /* ----------------------------- Actions ----------------------------- */

  async function rejectEnquiry() {
    setUiStatus("REJECTED");
    await saveStatus("REJECTED");
  }

  async function sendQuestionnaire() {
    if (!lead?.id) return;
    setBusyTask(true);
    try {
      // move to Info requested
      setUiStatus("INFO_REQUESTED");
      const saved = await saveStatus("INFO_REQUESTED");
      if (!saved) return;

      // ensure follow-up from playbook
      await ensureManualTask("questionnaire_followup");

      // open mailto with public link if we have a slug
      if (lead.email && settings?.slug) {
        const link = `${window.location.origin}/q/${settings.slug}/${encodeURIComponent(lead.id)}`;
        const contactName = (lead.contactName || "").trim();
        const firstName = contactName.split(/\s+/)[0] || "";
        const brandName = (settings?.brandName || "Our team").trim() || "Our team";
        const subjectTemplate =
          (settings?.questionnaireEmailSubject && settings.questionnaireEmailSubject.trim()) ||
          DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT;
        const bodyTemplate =
          (settings?.questionnaireEmailBody && settings.questionnaireEmailBody.trim()) ||
          DEFAULT_QUESTIONNAIRE_EMAIL_BODY;

        const replacements = {
          contactName: contactName || firstName || "there",
          firstName: firstName || "there",
          brandName,
          company: brandName,
          link,
        } as Record<string, string>;

        const subject = (renderTemplate(subjectTemplate, replacements).trim() || DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT).
          replace(/\s+/g, " ");
        let body = renderTemplate(bodyTemplate, replacements).trim();
        if (!body.includes(link)) {
          body = body ? `${body}\n\n${link}` : link;
        }
        openMailTo(lead.email, subject, body);
      }
      await reloadTasks();
      toast("Questionnaire sent. Follow-up added.");
    } finally {
      setBusyTask(false);
    }
  }

  async function requestSupplierPrice() {
    if (!lead?.id) return;
    setBusyTask(true);
    try {
      await ensureManualTask("supplier_followup");

      const supplier = prompt("Supplier email (optional):");
      if (supplier) {
        openMailTo(
          supplier,
          `Price request: ${lead.contactName || "Project"}`,
          "Hi,\n\nCould you price the attached items?\n\nThanks!"
        );
      }
      await reloadTasks();
      toast("Supplier request sent. Follow-up added.");
    } finally {
      setBusyTask(false);
    }
  }

  async function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextUi = event.target.value as Lead["status"];
    setUiStatus(nextUi);
    await saveStatus(nextUi);
  }

  async function createDraftEstimate() {
    if (!lead?.id) return;
    setSaving(true);
    try {
      const quote = await apiFetch<any>("/quotes", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: {
          leadId: lead.id,
          title: `Estimate for ${lead.contactName || lead.email || "Lead"}`,
          notes: "Draft created from Lead.",
        },
      });

      await ensureManualTask("quote_draft_complete", {
        relatedType: "QUOTE",
        relatedId: quote?.id,
      });

      await reloadTasks();
      toast("Draft estimate created.");
    } catch (e) {
      console.error(e);
      alert("Failed to create draft estimate");
    } finally {
      setSaving(false);
    }
  }

  function openMailTo(to: string, subject: string, body?: string) {
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}${
      body ? `&body=${encodeURIComponent(body)}` : ""
    }`;
    window.open(url, "_blank");
  }

  function renderTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => values[key] ?? "");
  }

  /* ----------------------------- Email context ----------------------------- */

  const emailSubject = pickFirst<string>(get(lead?.custom, "subject"));
  const emailSnippet = pickFirst<string>(get(lead?.custom, "snippet"), get(lead?.custom, "summary"));
  const fromEmail = pickFirst<string>(get(lead?.custom, "fromEmail"), lead?.email);
  const questionnaireFields = useMemo(
    () => normalizeQuestionnaireFields(settings?.questionnaire ?? null),
    [settings?.questionnaire]
  );
  const workspaceFields = useMemo(
    () => questionnaireFields.filter((field) => field.showOnLead),
    [questionnaireFields]
  );
  const customData = useMemo(
    () => (lead?.custom && typeof lead.custom === "object" ? (lead.custom as Record<string, any>) : {}),
    [lead?.custom]
  );
  useEffect(() => {
    if (!lead?.id) {
      setCustomDraft({});
      return;
    }
    const next: Record<string, string> = {};
    workspaceFields.forEach((field) => {
      const key = field.key;
      if (!key) return;
      const raw = customData?.[key];
      if (raw === undefined || raw === null) {
        next[key] = "";
        return;
      }
      if (field.type === "date") {
        const iso =
          typeof raw === "string"
            ? raw
            : raw instanceof Date
            ? raw.toISOString()
            : String(raw ?? "");
        next[key] = iso.slice(0, 10);
        return;
      }
      next[key] =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
          ? raw.map((item) => String(item ?? "")).join(", ")
          : String(raw ?? "");
    });
    setCustomDraft(next);
  }, [lead?.id, customData, workspaceFields]);
  const questionnaireResponses = useMemo(() => {
    const responses: Array<{ field: NormalizedQuestionnaireField; value: string | null }> = [];
    const seen = new Set<string>();

    questionnaireFields.forEach((field) => {
      const key = field.key;
      if (!key) return;
      seen.add(key);
      if (!field.askInQuestionnaire) return;
      responses.push({ field, value: formatAnswer(customData?.[key]) });
    });

    const IGNORED_CUSTOM_KEYS = new Set([
      "provider",
      "messageId",
      "subject",
      "summary",
      "snippet",
      "body",
      "full",
      "from",
      "fromEmail",
      "uiStatus",
      "questionnaireSubmittedAt",
      "uploads",
      "aiFeedback",
    ]);

    const humanizeKey = (key: string): string => {
      return key
        .replace(/[_\-]+/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\w|\s\w/g, (c) => c.toUpperCase());
    };

    Object.keys(customData || {})
      .filter((key) =>
        typeof key === "string" &&
        key &&
        !seen.has(key) &&
        !IGNORED_CUSTOM_KEYS.has(key)
      )
      .forEach((key) => {
        const value = formatAnswer(customData?.[key]);
        if (value == null) return;
        responses.push({
          field: {
            id: key,
            key,
            label: humanizeKey(key),
            required: false,
            type: "text",
            options: [],
            askInQuestionnaire: true,
            showOnLead: false,
            sortOrder: Number.MAX_SAFE_INTEGER,
          },
          value,
        });
      });

    return responses;
  }, [customData, questionnaireFields]);
  const questionnaireUploads = useMemo(() => {
    const uploads = Array.isArray((customData as any)?.uploads) ? (customData as any).uploads : [];
    return uploads
      .map((item: any) => ({
        filename: typeof item?.filename === "string" && item.filename.trim() ? item.filename.trim() : "Attachment",
        mimeType: typeof item?.mimeType === "string" && item.mimeType.trim() ? item.mimeType : "application/octet-stream",
        base64: typeof item?.base64 === "string" ? item.base64 : "",
        sizeKB: typeof item?.sizeKB === "number" ? item.sizeKB : null,
        addedAt: typeof item?.addedAt === "string" ? item.addedAt : null,
      }))
      .filter((item) => item.base64);
  }, [customData]);
  const questionnaireSubmittedAt = useMemo(() => {
    const raw = (customData as any)?.questionnaireSubmittedAt;
    if (typeof raw === "string" && raw) return raw;
    return null;
  }, [customData]);
  const openTasks = tasks.filter(t => t.status !== "DONE");
/* ----------------------------- Render ----------------------------- */

  if (!open || !lead) return null;

  const openCount = openTasks.length;
  const completedCount = tasks.length - openCount;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[60] bg-gradient-to-br from-sky-500/30 via-indigo-700/20 to-rose-500/30 backdrop-blur flex items-center justify-center px-3 py-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
        <div className="relative flex h-[min(88vh,calc(100vh-3rem))] w-[min(1000px,92vw)] max-h-[88vh] flex-col overflow-hidden rounded-3xl border border-white/30 bg-white/85 shadow-[0_32px_70px_-35px_rgba(30,64,175,0.45)] backdrop-blur-xl">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -left-10 h-52 w-52 rounded-full bg-sky-200/60 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-rose-200/60 blur-3xl" />
        {/* Header */}
        <div className="relative flex flex-wrap items-center gap-3 border-b border-sky-100/60 bg-gradient-to-r from-sky-100 via-white to-rose-100 px-4 sm:px-6 py-4">
          <div className="inline-grid place-items-center h-11 w-11 rounded-2xl bg-white/80 text-[12px] font-semibold text-slate-700 border border-sky-200 shadow-sm">
            {avatarText(lead.contactName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-slate-800">
              {lead.contactName || lead.email || "Lead"}
            </div>
            <div className="text-xs text-slate-500 truncate">{lead.email || ""}</div>
          </div>

          <label className="text-xs font-medium text-slate-600 mr-2">Status</label>
          <select
            value={uiStatus}
            className="rounded-xl border border-sky-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            onChange={handleStatusChange}
            disabled={saving}
          >
            {(Object.keys(STATUS_LABELS) as Lead["status"][]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          {showEstimateCta && (
            <button
              className="ml-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 text-white px-4 py-2 text-sm font-semibold shadow hover:from-emerald-500 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              onClick={createDraftEstimate}
              disabled={saving}
            >
              Create Draft Estimate
            </button>
          )}

          <button
            className="ml-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            onClick={() => onOpenChange(false)}
            disabled={saving || loading}
          >
            Close
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-sky-100/60 bg-gradient-to-r from-sky-50 via-indigo-50 to-amber-50 text-slate-700">
          <button
            className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-white"
            onClick={rejectEnquiry}
            disabled={saving}
          >
            <span aria-hidden="true">🛑</span>
            Gently decline enquiry
          </button>

          <button
            className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-white"
            onClick={sendQuestionnaire}
            disabled={busyTask || saving}
            title="Invite your client to share their project details."
          >
            <span aria-hidden="true">📜</span>
            Send client questionnaire
          </button>

          <button
            className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-white"
            onClick={requestSupplierPrice}
            disabled={busyTask}
            title="Ask your supplier for pricing — we’ll handle the magic behind the scenes"
          >
            <span aria-hidden="true">🧞</span>
            Request supplier quote
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {/* Left – Details */}
          <div className="md:col-span-2 border-r border-sky-100/60 min-h-[60vh] bg-gradient-to-br from-white via-sky-50/70 to-rose-50/60 p-4 sm:p-6 space-y-4">
            <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span aria-hidden="true">✨</span>
                Lead details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Name</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={() => {
                      setLead((l) => (l ? { ...l, contactName: nameInput || null } : l));
                      savePatch({ contactName: nameInput || null });
                    }}
                    placeholder="Client name"
                  />
                </label>

                <label className="text-sm">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Email</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onBlur={() => {
                      setLead((l) => (l ? { ...l, email: emailInput || null } : l));
                      savePatch({ email: emailInput || null });
                    }}
                    placeholder="client@email.com"
                  />
                </label>
              </div>

              <label className="text-sm block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Client notes</span>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-3 min-h-28 shadow-inner"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  onBlur={() => {
                    setLead((l) => (l ? { ...l, description: descInput || null } : l));
                    savePatch({ description: descInput || null });
                  }}
                  placeholder="Project background, requirements, constraints…"
                />
              </label>
            </section>

            {workspaceFields.length > 0 && (
              <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span aria-hidden="true">🗂️</span>
                  Lead workspace fields
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {workspaceFields.map((field) => {
                    const key = field.key;
                    if (!key) return null;
                    const value = customDraft[key] ?? "";
                    const label = field.label || key;
                    const baseClasses =
                      "w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-200";

                    if (field.type === "source") {
                      return (
                        <div key={key} className="space-y-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                          <LeadSourcePicker
                            leadId={lead.id}
                            value={typeof customData?.[key] === "string" ? customData[key] : null}
                            onSaved={(next) => {
                              const nextStr = next ?? "";
                              setCustomDraft((prev) => ({ ...prev, [key]: nextStr }));
                              setLead((current) => {
                                if (!current) return current;
                                const prevCustom =
                                  current.custom && typeof current.custom === "object"
                                    ? { ...(current.custom as Record<string, any>) }
                                    : {};
                                prevCustom[key] = next ?? null;
                                return { ...current, custom: prevCustom };
                              });
                            }}
                          />
                        </div>
                      );
                    }

                    if (field.type === "textarea") {
                      return (
                        <label key={key} className="text-sm">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            {label}
                            {field.required ? <span className="text-rose-500"> *</span> : null}
                          </span>
                          <textarea
                            className={`${baseClasses} min-h-28`}
                            value={value}
                            onChange={(e) => setCustomDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                            onBlur={(e) => saveCustomField(field, e.target.value)}
                          />
                        </label>
                      );
                    }

                    if (field.type === "select") {
                      return (
                        <label key={key} className="text-sm">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            {label}
                            {field.required ? <span className="text-rose-500"> *</span> : null}
                          </span>
                          <select
                            className={baseClasses}
                            value={value}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setCustomDraft((prev) => ({ ...prev, [key]: nextVal }));
                              saveCustomField(field, nextVal);
                            }}
                          >
                            <option value="">Select…</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    }

                    if (field.type === "date") {
                      return (
                        <label key={key} className="text-sm">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            {label}
                            {field.required ? <span className="text-rose-500"> *</span> : null}
                          </span>
                          <input
                            type="date"
                            className={baseClasses}
                            value={value}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setCustomDraft((prev) => ({ ...prev, [key]: nextVal }));
                              saveCustomField(field, nextVal);
                            }}
                          />
                        </label>
                      );
                    }

                    const inputType = field.type === "number" ? "number" : "text";
                    return (
                      <label key={key} className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          {label}
                          {field.required ? <span className="text-rose-500"> *</span> : null}
                        </span>
                        <input
                          type={inputType}
                          className={baseClasses}
                          value={value}
                          onChange={(e) => setCustomDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                          onBlur={(e) => saveCustomField(field, e.target.value)}
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {(emailSubject || emailSnippet || fromEmail) && (
              <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span aria-hidden="true">💌</span>
                  Latest email
                </div>
                <div className="mt-3 text-sm text-slate-700 space-y-1">
                  {fromEmail && (
                    <div>
                      <span className="text-slate-400">From:</span> {String(fromEmail)}
                    </div>
                  )}
                  {emailSubject && (
                    <div>
                      <span className="text-slate-400">Subject:</span> {emailSubject}
                    </div>
                  )}
                  {emailSnippet && <div className="text-slate-600">{emailSnippet}</div>}
                </div>
              </section>
            )}

            {(settings?.slug || questionnaireFields.length > 0) && (
              <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span aria-hidden="true">🧾</span>
                  {(Array.isArray(settings?.questionnaire) ? null : settings?.questionnaire?.title) || "Questionnaire"}
                </div>

                {questionnaireSubmittedAt ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Submitted {new Date(questionnaireSubmittedAt).toLocaleString()}
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {questionnaireResponses.length ? (
                    <dl className="space-y-3">
                      {questionnaireResponses.map(({ field, value }, idx) => (
                        <div key={field.key ?? field.id ?? idx} className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {field.label || field.key || field.id}
                            {field.required ? <span className="text-rose-500"> *</span> : null}
                          </dt>
                          <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                            {value ?? <span className="text-slate-400">Not provided</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-3 text-sm text-slate-500">
                      Waiting for the client to complete the form.
                    </div>
                  )}

                  {questionnaireUploads.length ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Attachments
                      </div>
                      <ul className="space-y-2 text-sm">
                        {questionnaireUploads.map((file, idx) => {
                          const dataUrl = `data:${file.mimeType};base64,${file.base64}`;
                          return (
                            <li key={`${file.filename}-${idx}`} className="flex flex-wrap items-center gap-2">
                              <a
                                href={dataUrl}
                                download={file.filename}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
                              >
                                <span aria-hidden="true">📎</span>
                                {file.filename}
                              </a>
                              {typeof file.sizeKB === "number" && (
                                <span className="text-xs text-slate-500">{file.sizeKB.toLocaleString()} KB</span>
                              )}
                              {file.addedAt && (
                                <span className="text-xs text-slate-400">
                                  added {new Date(file.addedAt).toLocaleDateString()}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>

                {settings?.slug ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`/q/${settings.slug}/${encodeURIComponent(lead.id)}`}
                      className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white/80 px-3 py-1.5 text-sm font-semibold text-sky-600 shadow-sm hover:bg-white"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span aria-hidden="true">🔗</span>
                      Open public questionnaire
                    </a>
                  </div>
                ) : null}
              </section>
            )}
          </div>

          {/* Right – Tasks */}
          <aside className="md:col-span-1 min-h-[60vh] overflow-auto bg-gradient-to-br from-indigo-900/10 via-white to-rose-50 p-4 sm:p-6 space-y-4">
            <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <span aria-hidden="true">⭐</span>
                  Task journey
                </div>
                <div className="text-xs text-slate-500">{openCount} open</div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>{completedCount} completed</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400 transition-all"
                    style={{ width: `${progress}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <span aria-hidden="true">➕</span>
                  New task
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
                  onClick={() => {
                    if (showTaskComposer) {
                      resetTaskComposer();
                    }
                    setShowTaskComposer((v) => !v);
                  }}
                >
                  {showTaskComposer ? "Close" : "Add"}
                </button>
              </div>

              {showTaskComposer && (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createManualTask();
                  }}
                >
                  {taskError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-600">
                      {taskError}
                    </div>
                  )}

                  <label className="block text-xs font-semibold text-slate-600">
                    Title
                    <input
                      type="text"
                      value={taskComposer.title}
                      onChange={(e) => setTaskComposer((prev) => ({ ...prev, title: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      placeholder="e.g. Call the client"
                      required
                    />
                  </label>

                  <label className="block text-xs font-semibold text-slate-600">
                    Description
                    <textarea
                      value={taskComposer.description}
                      onChange={(e) => setTaskComposer((prev) => ({ ...prev, description: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 min-h-[72px]"
                      placeholder="Add context for the team"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-slate-600">
                      Priority
                      <select
                        value={taskComposer.priority}
                        onChange={(e) =>
                          setTaskComposer((prev) => ({ ...prev, priority: e.target.value as Task["priority"] }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      >
                        {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-semibold text-slate-600">
                      Due date & time
                      <input
                        type="datetime-local"
                        value={taskComposer.dueAt}
                        onChange={(e) => setTaskComposer((prev) => ({ ...prev, dueAt: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-inner">
                    <input
                      type="checkbox"
                      checked={taskAssignToMe}
                      onChange={(e) => setTaskAssignToMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                    />
                    Assign to me (leave unchecked to keep unassigned)
                  </label>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
                      onClick={() => {
                        resetTaskComposer();
                        setShowTaskComposer(false);
                      }}
                      disabled={taskSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400 px-4 py-2 text-xs font-semibold text-white shadow-lg disabled:opacity-50"
                      disabled={taskSaving}
                    >
                      {taskSaving ? "Saving…" : "Create"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="space-y-3">
              {loading && <div className="text-sm text-slate-500">Loading…</div>}
              {!loading && tasks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-sky-200 bg-white/80 p-4 text-sm text-slate-500">
                  No tasks yet—tap an action above to conjure the first step.
                </div>
              )}
              {tasks.map((t) => {
                const done = t.status === "DONE";
                const doneToday =
                  done && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString();
                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border border-slate-200/70 bg-white/85 p-4 shadow-sm backdrop-blur flex items-start gap-3 transition hover:border-sky-200 ${done ? "opacity-80" : ""} ${doneToday ? "ring-1 ring-emerald-200" : ""}`}
                  >
                    <label className="mt-1 inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleTaskComplete(t)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                        aria-label={`Complete ${t.title}`}
                      />
                    </label>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`font-semibold text-sm text-slate-800 ${done ? "line-through" : ""}`}>
                          {t.title}
                        </div>
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-600">
                          {t.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <span aria-hidden="true">⏰</span>
                          {t.dueAt ? new Date(t.dueAt).toLocaleString() : "No due date"}
                        </span>
                        {t.priority && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-600">
                            <span aria-hidden="true">🎯</span>
                            {t.priority.toLowerCase()}
                          </span>
                        )}
                        {t.relatedType && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-600">
                            <span aria-hidden="true">🔗</span>
                            {t.relatedType.toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-slate-500">
              Tip: Completing a lead action will sprinkle pixie dust on the matching task automatically.
            </div>
          </aside>
        </div>
        </div>
      </div>
    </div>
  );
}