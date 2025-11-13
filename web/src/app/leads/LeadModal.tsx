// web/src/app/leads/LeadModal.tsx
"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiFetch } from "@/lib/api";
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
import { useTenantBrand } from "@/lib/use-tenant-brand";
import { Button } from "@/components/ui/button";
import LeadSourcePicker from "@/components/leads/LeadSourcePicker";
import DeclineEnquiryButton from "./DeclineEnquiryButton";

/* ----------------------------- Types ----------------------------- */

export type Lead = {
  id: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  quoteId?: string | null;
  quoteStatus?: string | null;
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
  estimatedValue?: number | null;
  quotedValue?: number | null;
  dateQuoteSent?: string | null;
  computed?: Record<string, any> | null;
  communicationLog?: Array<{
    id: string;
    type: 'call' | 'email' | 'note';
    content: string;
    timestamp: string;
  }> | null;
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
  internalOnly?: boolean;
  visibleAfterOrder?: boolean;
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
  internalOnly?: boolean;
  visibleAfterOrder?: boolean;
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
      const internalOnly = (raw as any).internalOnly === true ? true : undefined;
      const visibleAfterOrder = (raw as any).visibleAfterOrder === true ? true : undefined;
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
        internalOnly,
        visibleAfterOrder,
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
  initialStage = 'overview',
  showFollowUp = false,
}: {
  open: boolean;
  onOpenChange: (_v: boolean) => void;
  leadPreview: Lead | null;
  onUpdated?: () => void | Promise<void>;
  initialStage?: 'overview' | 'details' | 'questionnaire' | 'tasks' | 'follow-up' | 'workshop';
  showFollowUp?: boolean;
}) {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";
  const userId = ids?.userId || "";

  const authHeaders = useMemo(
    () => ({ "x-tenant-id": tenantId, "x-user-id": userId }),
    [tenantId, userId]
  );

  // Core state
  const [lead, setLead] = useState<Lead | null>(leadPreview);
  const [uiStatus, setUiStatus] = useState<Lead["status"]>(
    leadPreview?.status ? serverToUiStatus(String(leadPreview.status)) : "NEW_ENQUIRY"
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTask, setBusyTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskAssignToMe, setTaskAssignToMe] = useState(true);

  // Stage navigation
  const [currentStage, setCurrentStage] = useState<'overview' | 'details' | 'questionnaire' | 'tasks' | 'follow-up' | 'workshop'>(initialStage);

  // Form inputs
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});

  // Communication logging
  const [newNote, setNewNote] = useState("");
  const [communicationType, setCommunicationType] = useState<'call' | 'email' | 'note'>('note');

  // Task creation
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [taskComposer, setTaskComposer] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Task["priority"],
    dueAt: "",
  });
  const [taskSaving, setTaskSaving] = useState(false);

  // Follow-up state
  const { brandName: tenantBrandName, shortName: tenantShortName, ownerFirstName: tenantOwnerFirstName } = useTenantBrand();
  const [emailTaskDays, setEmailTaskDays] = useState("3");
  const [phoneTaskDays, setPhoneTaskDays] = useState("2");
  const [creatingEmailTask, setCreatingEmailTask] = useState(false);
  const [creatingPhoneTask, setCreatingPhoneTask] = useState(false);
  const [creatingSequence, setCreatingSequence] = useState(false);
  const [followUpTasks, setFollowUpTasks] = useState<any[]>([]);
  const [loadingFollowUpTasks, setLoadingFollowUpTasks] = useState(false);
  
  // Email composer state
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [composerSubject, setComposerSubject] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // ---- Workshop Processes (WON flow) ----
  type ProcDef = { id: string; code: string; name: string; sortOrder?: number|null; requiredByDefault?: boolean; estimatedHours?: number|null };
  type ProcUser = { id: string; name?: string|null; email: string };
  type ProcAssignment = {
    id: string;
    processDefinitionId?: string;
    processCode?: string;
    processName?: string;
    required?: boolean;
    estimatedHours?: number|null;
    assignedUser?: ProcUser | null;
  };
  const [wkLoading, setWkLoading] = useState(false);
  const [wkDefs, setWkDefs] = useState<ProcDef[]>([]);
  const [wkUsers, setWkUsers] = useState<ProcUser[]>([]);
  const [wkAssignments, setWkAssignments] = useState<ProcAssignment[]>([]);
  const [wkSavingId, setWkSavingId] = useState<string | null>(null);

  // Material tracking state
  type MaterialDates = {
    timberOrderedAt?: string | null;
    timberExpectedAt?: string | null;
    timberReceivedAt?: string | null;
    timberNotApplicable?: boolean;
    glassOrderedAt?: string | null;
    glassExpectedAt?: string | null;
    glassReceivedAt?: string | null;
    glassNotApplicable?: boolean;
    ironmongeryOrderedAt?: string | null;
    ironmongeryExpectedAt?: string | null;
    ironmongeryReceivedAt?: string | null;
    ironmongeryNotApplicable?: boolean;
    paintOrderedAt?: string | null;
    paintExpectedAt?: string | null;
    paintReceivedAt?: string | null;
    paintNotApplicable?: boolean;
  };
  const [materialDates, setMaterialDates] = useState<MaterialDates>({});
  const [materialSaving, setMaterialSaving] = useState(false);

  // Project details state
  const [projectStartDate, setProjectStartDate] = useState<string>("");
  const [projectDeliveryDate, setProjectDeliveryDate] = useState<string>("");
  const [projectValueGBP, setProjectValueGBP] = useState<string>("");
  const [opportunityId, setOpportunityId] = useState<string | null>(null);

  const lastSavedServerStatusRef = useRef<string | null>(null);

  const playbook = useMemo(
    () => normalizeTaskPlaybook(settings?.taskPlaybook ?? DEFAULT_TASK_PLAYBOOK),
    [settings?.taskPlaybook]
  );

  // Navigation stages configuration
  // Always show follow-up tab for consistent UX across all leads
  const _shouldShowFollowUp = true;
  
  const _stages = [
    {
      id: 'overview' as const,
      title: 'Overview',
      icon: '👀',
      description: 'Lead summary and actions'
    },
    {
      id: 'details' as const,
      title: 'Details',
      icon: '📝',
      description: 'Contact info and notes'
    },
    {
      id: 'questionnaire' as const,
      title: 'Questionnaire',
      icon: '📋',
      description: 'Client responses and data'
    },
    {
      id: 'tasks' as const,
      title: 'Tasks',
      icon: '✅',
      description: 'Next steps and progress'
    },
    {
      id: 'follow-up' as const,
      title: 'Follow-up',
      icon: '📧',
      description: 'Email follow-ups and quotes'
    }
  ];

  useEffect(() => {
    if (open) {
      // When opening, initialize uiStatus from leadPreview
      if (leadPreview?.status) {
        setUiStatus(serverToUiStatus(String(leadPreview.status)));
      }
      return;
    }
    // When closing, reset everything
    setLead(null);
    setNameInput("");
    setEmailInput("");
    setPhoneInput("");
    setDescInput("");
    setNewNote("");
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
  }, [open, leadPreview?.status]);

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
          quoteId: leadPreview.quoteId ?? prev.quoteId ?? null,
          quoteStatus: (leadPreview as any)?.quoteStatus ?? prev.quoteStatus ?? null,
          estimatedValue:
            leadPreview.estimatedValue != null ? Number(leadPreview.estimatedValue) : prev.estimatedValue ?? null,
          quotedValue:
            leadPreview.quotedValue != null ? Number(leadPreview.quotedValue) : prev.quotedValue ?? null,
          dateQuoteSent: leadPreview.dateQuoteSent ?? prev.dateQuoteSent ?? null,
          computed: leadPreview.computed ?? prev.computed ?? null,
          communicationLog: (leadPreview.custom?.communicationLog || prev.communicationLog || []) as Lead['communicationLog'],
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
        quoteId: leadPreview.quoteId ?? null,
        quoteStatus: (leadPreview as any)?.quoteStatus ?? null,
        estimatedValue: leadPreview.estimatedValue != null ? Number(leadPreview.estimatedValue) : null,
        quotedValue: leadPreview.quotedValue != null ? Number(leadPreview.quotedValue) : null,
        dateQuoteSent: leadPreview.dateQuoteSent ?? null,
        computed: leadPreview.computed ?? null,
        communicationLog: (leadPreview.custom?.communicationLog || []) as Lead['communicationLog'],
      };

      setNameInput(normalized.contactName ?? "");
      setEmailInput(normalized.email ?? "");
      setPhoneInput(normalized.phone ?? "");
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
        // First detect if leadPreview.id is an opportunityId by probing
        let actualLeadId = leadPreview.id;
        try {
          const probeOpp = await apiFetch<any>(`/opportunities/${encodeURIComponent(leadPreview.id)}`, { headers: authHeaders });
          if (probeOpp?.opportunity?.leadId) {
            console.log('[LeadModal] Detected opportunityId in leadPreview, using leadId:', probeOpp.opportunity.leadId);
            actualLeadId = probeOpp.opportunity.leadId;
          }
        } catch (probeErr) {
          // Not an opportunityId, use leadPreview.id as-is
          console.log('[LeadModal] leadPreview.id is a leadId');
        }

        const [one, tlist, s] = await Promise.all([
          apiFetch<{ lead?: any } | any>(`/leads/${actualLeadId}`, { headers: authHeaders }),
          apiFetch<{ items: Task[]; total: number }>(
            `/tasks?relatedType=LEAD&relatedId=${encodeURIComponent(actualLeadId)}&mine=false`,
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

        const toMaybeNumber = (val: any): number | null => {
          if (val === undefined || val === null || val === "") return null;
          const num = Number(val);
          return Number.isNaN(num) ? null : num;
        };

        const normalized: Lead = {
          id: row.id || leadPreview.id,
          contactName,
          email,
          phone: (row as any)?.phone ?? null,
          status: sUi,
          custom: row.custom ?? row.briefJson ?? null,
          description,
          quoteId: (row as any)?.quoteId ?? null,
          quoteStatus: (row as any)?.quoteStatus ?? null,
          estimatedValue: toMaybeNumber(row.estimatedValue),
          quotedValue: toMaybeNumber(row.quotedValue),
          dateQuoteSent: row.dateQuoteSent ?? null,
          computed: row.computed ?? null,
          communicationLog: (row.custom?.communicationLog || []) as Lead['communicationLog'],
        };
        setLead(normalized);
        setUiStatus(sUi);

        // seed inputs
        setNameInput(contactName || "");
        setEmailInput(email || "");
        setPhoneInput((row as any)?.phone || "");
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

  // Load workshop data when lead is WON and modal is open
  useEffect(() => {
    if (!open || !lead?.id || uiStatus !== "WON") return;
    let cancelled = false;
    (async () => {
      setWkLoading(true);
      try {
        // First probe: is lead.id actually an opportunityId?
        let actualOpportunityId: string | null = null;
        let projectData: any = null;
        
        try {
          const probeProject = await apiFetch<any>(`/workshop-processes/project/${encodeURIComponent(lead.id)}`);
          if (probeProject && (probeProject.ok === true || probeProject.assignments !== undefined)) {
            // lead.id is an opportunityId
            actualOpportunityId = lead.id;
            projectData = probeProject;
            console.log('[LeadModal] detected lead.id is opportunityId:', actualOpportunityId);
          }
        } catch (probeErr: any) {
          console.log('[LeadModal] lead.id is not an opportunityId, treating as leadId');
        }
        
        const [defs, users, oppDetails] = await Promise.all([
          apiFetch<ProcDef[]>(`/workshop-processes`).catch(() => [] as ProcDef[]),
          apiFetch<{ ok: boolean; items: ProcUser[] }>(`/workshop/users`).then((r) => (r as any)?.items || []).catch(() => [] as ProcUser[]),
          // If we have actualOpportunityId, fetch it directly; otherwise try by-lead
          actualOpportunityId 
            ? apiFetch<any>(`/opportunities/${encodeURIComponent(actualOpportunityId)}`, { headers: authHeaders }).catch((err) => { console.error('[LeadModal] /opportunities/:id fetch error:', err); return null; })
            : apiFetch<any>(`/opportunities/by-lead/${encodeURIComponent(lead.id)}`, { headers: authHeaders }).catch((err) => { console.error('[LeadModal] /opportunities/by-lead fetch error:', err); return null; }),
        ]);
        
        // If we don't have project data yet, fetch it now
        if (!projectData && actualOpportunityId) {
          projectData = await apiFetch<any>(`/workshop-processes/project/${encodeURIComponent(actualOpportunityId)}`).catch(() => null);
        } else if (!projectData && !actualOpportunityId) {
          projectData = await apiFetch<any>(`/workshop-processes/project/${encodeURIComponent(lead.id)}`).catch(() => null);
        }
        
        if (cancelled) return;
        setWkDefs((Array.isArray(defs) ? defs : []).sort((a, b) => (Number(a.sortOrder||0) - Number(b.sortOrder||0)) || a.name.localeCompare(b.name)));
        setWkUsers(Array.isArray(users) ? users : []);
        const arr = Array.isArray(projectData?.assignments || projectData) ? (projectData.assignments || projectData) : [];
        const norm: ProcAssignment[] = arr.map((it: any) => ({
          id: String(it.id || it.assignmentId || crypto.randomUUID()),
          processDefinitionId: it.processDefinitionId || it.processDefinition?.id,
          processCode: it.processCode || it.processDefinition?.code,
          processName: it.processName || it.processDefinition?.name,
          required: Boolean(it.required ?? true),
          estimatedHours: it.estimatedHours ?? it.processDefinition?.estimatedHours ?? null,
          assignedUser: it.assignedUser ? { id: it.assignedUser.id, name: it.assignedUser.name ?? null, email: it.assignedUser.email } : null,
        }));
        setWkAssignments(norm);
        
        // Set opportunityId if we detected it
        if (actualOpportunityId && !opportunityId) {
          console.log('[LeadModal] setting opportunityId from detection:', actualOpportunityId);
          setOpportunityId(actualOpportunityId);
        }
        
        // Load material dates and project details from the opportunity data
        console.log('[LeadModal] oppDetails response:', oppDetails);
        const opp = (oppDetails?.opportunity || oppDetails) || null;
        console.log('[LeadModal] resolved opp:', opp);
        if (opp) {
          if (opp.id && !actualOpportunityId) {
            console.log('[LeadModal] setting opportunityId from opp data:', opp.id);
            setOpportunityId(String(opp.id));
          }
          setMaterialDates({
            timberOrderedAt: opp.timberOrderedAt || null,
            timberExpectedAt: opp.timberExpectedAt || null,
            timberReceivedAt: opp.timberReceivedAt || null,
            timberNotApplicable: opp.timberNotApplicable || false,
            glassOrderedAt: opp.glassOrderedAt || null,
            glassExpectedAt: opp.glassExpectedAt || null,
            glassReceivedAt: opp.glassReceivedAt || null,
            glassNotApplicable: opp.glassNotApplicable || false,
            ironmongeryOrderedAt: opp.ironmongeryOrderedAt || null,
            ironmongeryExpectedAt: opp.ironmongeryExpectedAt || null,
            ironmongeryReceivedAt: opp.ironmongeryReceivedAt || null,
            ironmongeryNotApplicable: opp.ironmongeryNotApplicable || false,
            paintOrderedAt: opp.paintOrderedAt || null,
            paintExpectedAt: opp.paintExpectedAt || null,
            paintReceivedAt: opp.paintReceivedAt || null,
            paintNotApplicable: opp.paintNotApplicable || false,
          });
          // Format dates for date input (YYYY-MM-DD)
          const formatDateForInput = (dateStr: any) => {
            if (!dateStr) return "";
            try {
              const date = new Date(dateStr);
              return date.toISOString().split('T')[0];
            } catch {
              return "";
            }
          };
          setProjectStartDate(formatDateForInput(opp.startDate));
          setProjectDeliveryDate(formatDateForInput(opp.deliveryDate));
          setProjectValueGBP(opp.valueGBP ? String(opp.valueGBP) : "");
        }
      } catch (err) {
        console.error('[LeadModal] workshop loader error:', err);
      } finally {
        if (!cancelled) setWkLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, lead?.id, uiStatus, authHeaders]);

  function getAssignmentFor(defId: string): ProcAssignment | undefined {
    return wkAssignments.find((a) => (a.processDefinitionId === defId) || (a.processCode && wkDefs.find(d => d.id===defId)?.code === a.processCode));
  }

  async function saveProjectAssignment(def: ProcDef, patch: { required?: boolean; assignedUserId?: string|null; estimatedHours?: number|null }) {
    const projectId = opportunityId || lead?.id;
    if (!projectId) return;
    setWkSavingId(def.id);
    try {
      console.log('Assigning process to opportunity:', projectId);
      const response = await apiFetch(`/workshop-processes/project/${encodeURIComponent(projectId)}`, {
        method: "POST",
        json: {
          processDefinitionId: def.id,
          required: patch.required,
          assignedUserId: patch.assignedUserId ?? undefined,
          estimatedHours: patch.estimatedHours == null ? null : Number(patch.estimatedHours),
        },
      });
      
      console.log('Assignment response:', response);
      
      if (!response || !(response as any).ok) {
        throw new Error((response as any)?.error || "Assignment failed");
      }
      
      // reload assignments only
  const project = await apiFetch<any>(`/workshop-processes/project/${encodeURIComponent(projectId)}`).catch(() => ({ assignments: [] }));
      const arr = Array.isArray(project?.assignments || project) ? (project.assignments || project) : [];
      const norm: ProcAssignment[] = arr.map((it: any) => ({
        id: String(it.id || it.assignmentId || crypto.randomUUID()),
        processDefinitionId: it.processDefinitionId || it.processDefinition?.id,
        processCode: it.processCode || it.processDefinition?.code,
        processName: it.processName || it.processDefinition?.name,
        required: Boolean(it.required ?? true),
        estimatedHours: it.estimatedHours ?? it.processDefinition?.estimatedHours ?? null,
        assignedUser: it.assignedUser ? { id: it.assignedUser.id, name: it.assignedUser.name ?? null, email: it.assignedUser.email } : null,
      }));
      setWkAssignments(norm);
    } catch (e: any) {
      console.error("Workshop assignment error:", e);
      const message = e?.message || e?.detail || "Failed to save assignment";
      alert(`Could not assign user to process: ${message}\n\nOpportunity ID: ${lead.id}\nPlease check your connection and try again.`);
    } finally {
      setWkSavingId(null);
    }
  }

  // Ensure we have a concrete opportunityId for this lead (idempotent)
  async function ensureOpportunity(): Promise<string | null> {
    if (opportunityId) return opportunityId;
    if (!lead?.id) return null;
    try {
      // First, if the current id is already an opportunity id (modal opened from Opportunities), use it
      // Probe the project assignments endpoint to see if lead.id is actually an opportunityId
      try {
        const probe = await apiFetch<any>(`/workshop-processes/project/${encodeURIComponent(lead.id)}`);
        // If we get a valid response (even if assignments is empty), this is an opportunityId
        if (probe && (probe.ok === true || probe.assignments !== undefined)) {
          console.log('[ensureOpportunity] detected lead.id is already opportunityId:', lead.id);
          setOpportunityId(String(lead.id));
          return String(lead.id);
        }
      } catch (probeErr: any) {
        // If we get 404, lead.id is not an opportunityId, proceed to ensure-for-lead
        console.log('[ensureOpportunity] probe failed, will try ensure-for-lead:', probeErr?.status || probeErr?.message);
      }
      // Try resolve/create on the server using leadId
      console.log('[ensureOpportunity] calling ensure-for-lead with:', lead.id);
      const out = await apiFetch<any>(`/opportunities/ensure-for-lead/${encodeURIComponent(lead.id)}`, { method: 'POST', headers: authHeaders });
      const id = String(out?.opportunity?.id || '');
      if (id) {
        console.log('[ensureOpportunity] resolved opportunityId:', id);
        setOpportunityId(id);
        return id;
      }
    } catch (err) {
      console.error('[LeadModal] ensureOpportunity error:', err);
    }
    return null;
  }

  async function saveMaterialDates() {
    let projectId = opportunityId || null;
    if (!projectId) {
      projectId = await ensureOpportunity();
    }
    if (!projectId) return;
    setMaterialSaving(true);
    try {
      await apiFetch(`/workshop/project/${encodeURIComponent(projectId)}/materials`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(materialDates),
      });
    } catch (e: any) {
      console.error("Material dates save error:", e);
      alert("Could not save material dates. Please try again.");
    } finally {
      setMaterialSaving(false);
    }
  }

  async function saveOpportunityField(field: string, value: any) {
    let id = opportunityId || null;
    if (!id) {
      id = await ensureOpportunity();
    }
    console.log('[saveOpportunityField] called with:', { field, value, opportunityId, leadId: lead?.id, resolvedId: id, idType: typeof id });
    if (!id) {
      console.warn('[saveOpportunityField] no id resolved, aborting');
      return;
    }
    
    const url = `/opportunities/${encodeURIComponent(id)}`;
    console.log('[saveOpportunityField] will PATCH to:', url);
    
    try {
      const payload: any = {};
      payload[field] = value;
      
      const response = await apiFetch(url, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log('[saveOpportunityField] response:', response);
    } catch (e: any) {
      console.error(`[saveOpportunityField] Failed to save ${field}:`, e);
      alert(`Could not save ${field}. Please try again.`);
    }
  }

  // Reset to initial stage when modal opens or lead changes (but not during navigation)
  useEffect(() => {
    if (open && leadPreview?.id) {
      setCurrentStage(initialStage);
    }
  }, [open, leadPreview?.id, initialStage]);

  // Load follow-up tasks when follow-up tab is opened
  // Note: Inline the logic to avoid referencing a not-yet-initialized callback
  // which can trigger a Temporal Dead Zone error during render.
  useEffect(() => {
    if (!(open && currentStage === 'follow-up' && lead?.id)) return;
    let cancelled = false;
    (async () => {
      setLoadingFollowUpTasks(true);
      try {
        const data = await apiFetch<{ items: any[] }>(
          `/tasks?relatedType=LEAD&relatedId=${encodeURIComponent(lead.id)}&mine=false`
        );
        if (!cancelled) setFollowUpTasks(data.items || []);
      } catch (error) {
        console.error("Failed to load follow-up tasks:", error);
      } finally {
        if (!cancelled) setLoadingFollowUpTasks(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentStage, lead?.id]);

  /* ----------------------------- Save helpers ----------------------------- */

  async function triggerOnUpdated() {
    if (!onUpdated) return;
    try {
      await Promise.resolve(onUpdated());
    } catch (err) {
      console.error("onUpdated handler failed", err);
    }
  }

  function applyServerLead(row: any) {
    if (!row || typeof row !== "object") return;
    if (typeof row.status === "string") {
      lastSavedServerStatusRef.current = row.status;
    }
    setLead((current) => {
      const toMaybeNumber = (val: any): number | null => {
        if (val === undefined || val === null || val === "") return null;
        const num = Number(val);
        return Number.isNaN(num) ? null : num;
      };
      const base: Lead = current
        ? { ...current }
        : {
            id: row.id ?? "",
            contactName: row.contactName ?? null,
            email: row.email ?? null,
            phone: (row as any)?.phone ?? null,
            quoteId: (row as any)?.quoteId ?? null,
            quoteStatus: (row as any)?.quoteStatus ?? null,
            status: row.status ? serverToUiStatus(row.status) : "NEW_ENQUIRY",
            custom: row.custom ?? null,
            description: row.description ?? null,
            estimatedValue: row.estimatedValue ?? null,
            quotedValue: row.quotedValue ?? null,
            dateQuoteSent: row.dateQuoteSent ?? null,
            computed: row.computed ?? null,
            communicationLog: (row.custom?.communicationLog || []) as Lead["communicationLog"],
          };

      const next: Lead = {
        ...base,
        contactName: row.contactName ?? base.contactName ?? null,
        email: row.email ?? base.email ?? null,
        phone: (row as any)?.phone ?? base.phone ?? null,
        quoteId: (row as any)?.quoteId ?? base.quoteId ?? null,
        quoteStatus: (row as any)?.quoteStatus ?? base.quoteStatus ?? null,
        status: row.status ? serverToUiStatus(row.status) : base.status,
        custom: row.custom ?? base.custom ?? null,
        description: row.description ?? base.description ?? null,
        estimatedValue:
          toMaybeNumber(row.estimatedValue) ??
          toMaybeNumber(row.computed?.estimatedValue) ??
          (base.estimatedValue ?? null),
        quotedValue:
          toMaybeNumber(row.quotedValue) ??
          toMaybeNumber(row.computed?.quotedValue) ??
          (base.quotedValue ?? null),
        dateQuoteSent: (() => {
          const coerce = (val: any): string | null => {
            if (val === undefined || val === null || val === "") return null;
            if (val instanceof Date) return val.toISOString();
            if (typeof val === "string") return val;
            return String(val);
          };
          return coerce(row.dateQuoteSent) ?? coerce(row.computed?.dateQuoteSent) ?? base.dateQuoteSent ?? null;
        })(),
        computed:
          row.computed && typeof row.computed === "object"
            ? (row.computed as Record<string, any>)
            : base.computed ?? null,
      };

      if (next.custom && typeof next.custom === "object" && Array.isArray(next.custom.communicationLog)) {
        next.communicationLog = next.custom.communicationLog as Lead["communicationLog"];
      } else if (base.communicationLog) {
        next.communicationLog = base.communicationLog;
      }

      return next;
    });
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
      const response = await apiFetch<{ lead?: any }>(`/leads/${lead.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: patch,
      });
      const updatedRow = (response && typeof response === "object" ? response.lead ?? response : null) as any;
      if (updatedRow) {
        applyServerLead(updatedRow);
      } else {
        setLead((current) => {
          if (!current) return current;
          const next: Lead = { ...current };
          if (Object.prototype.hasOwnProperty.call(patch, "contactName")) {
            next.contactName = patch.contactName ?? null;
          }
          if (Object.prototype.hasOwnProperty.call(patch, "email")) {
            next.email = patch.email ?? null;
          }
          if (Object.prototype.hasOwnProperty.call(patch, "phone")) {
            next.phone = patch.phone ?? null;
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
          if (Object.prototype.hasOwnProperty.call(patch, "questionnaire")) {
            const questionnairePatch = patch.questionnaire;
            if (questionnairePatch && typeof questionnairePatch === "object" && !Array.isArray(questionnairePatch)) {
              const prev =
                next.custom && typeof next.custom === "object"
                  ? { ...(next.custom as Record<string, any>) }
                  : {};
              Object.entries(questionnairePatch).forEach(([k, v]) => {
                prev[k] = v ?? null;
              });
              next.custom = prev;
            }
          }
          return next;
        });
      }
      await triggerOnUpdated();
    } catch (e: any) {
      console.error("patch failed", e?.message || e);
      alert("Failed to save changes");
    }
  }

  async function addCommunicationNote() {
    if (!lead?.id || !newNote.trim()) return;
    
    const newEntry = {
      id: Date.now().toString(),
      type: communicationType,
      content: newNote.trim(),
      timestamp: new Date().toISOString()
    };
    
    const currentLog = lead.communicationLog || [];
    const updatedLog = [newEntry, ...currentLog]; // Add to top for latest first
    
    try {
      await savePatch({ 
        custom: { 
          ...lead.custom, 
          communicationLog: updatedLog 
        } 
      });
      setLead(prev => prev ? { 
        ...prev, 
        communicationLog: updatedLog,
        custom: { ...prev.custom, communicationLog: updatedLog }
      } : prev);
      setNewNote('');
    } catch (e) {
      console.error('Failed to add communication note:', e);
      alert('Failed to save communication note');
    }
  }

  async function saveCustomField(field: NormalizedQuestionnaireField, rawValue: string) {
    if (!field.key) return;
    let value: any = rawValue;
    if (field.type === "number") {
      const trimmed = rawValue.trim();
      const cleaned = trimmed.replace(/£/g, "").replace(/,/g, "");
      value = cleaned === "" ? null : Number(cleaned);
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

    const payload: any = {
      questionnaire: { [field.key]: value },
    };
    if (["estimatedValue", "quotedValue", "dateQuoteSent", "startDate", "deliveryDate"].includes(field.key)) {
      payload[field.key] = value;
    }

    await savePatch(payload);
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
    // The server may promote the lead (accept on review). Refresh lead status to reflect immediately.
    if (lead?.id) {
      try {
        const one = await apiFetch<{ lead?: any } | any>(`/leads/${lead.id}`, { headers: authHeaders });
        const row = (one && "lead" in one ? one.lead : one) ?? {};
        const sUi = serverToUiStatus(row.status);
        setUiStatus(sUi);
        setLead((prev) => (prev ? { ...prev, status: sUi } : prev));
        await triggerOnUpdated();
      } catch {}
    }
  }

  /* ----------------------------- Follow-up Functions ----------------------------- */

  // Follow-up brand and context setup
  const followupBrand = useMemo(() => {
    const brand = (tenantBrandName || "").trim();
    if (brand && brand.toLowerCase() !== "your company") return brand;
    const short = (tenantShortName || "").trim();
    if (short && short.toLowerCase() !== "your") return short;
    return "Sales team";
  }, [tenantBrandName, tenantShortName]);

  const followupOwnerFirst = useMemo(() => {
    const owner = (tenantOwnerFirstName || "").trim();
    if (owner) return owner;
    const firstWord = followupBrand.split(/\s+/)[0] || "";
    if (firstWord && firstWord.toLowerCase() !== "sales") return firstWord;
    return null;
  }, [tenantOwnerFirstName, followupBrand]);

  // Load follow-up tasks for this lead
  const loadFollowUpTasks = useCallback(async () => {
    if (!lead?.id) return;
    setLoadingFollowUpTasks(true);
    try {
      const data = await apiFetch<{ items: any[] }>(`/tasks?relatedType=LEAD&relatedId=${encodeURIComponent(lead.id)}&mine=false`);
      setFollowUpTasks(data.items || []);
    } catch (error) {
      console.error("Failed to load follow-up tasks:", error);
    } finally {
      setLoadingFollowUpTasks(false);
    }
  }, [lead?.id]);

  // Create email follow-up task
  async function createEmailTask() {
    if (!lead?.id) return;
    setCreatingEmailTask(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(emailTaskDays));
      
      await apiFetch("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        json: {
          title: `Email follow-up: ${lead.contactName}`,
          description: `Send follow-up email about the quote to ${lead.email}`,
          relatedType: "LEAD",
          relatedId: lead.id,
          priority: "MEDIUM",
          dueAt: dueDate.toISOString(),
          assignees: userId ? [{ userId, role: "OWNER" as const }] : undefined,
          meta: { type: "email_followup", leadEmail: lead.email }
        }
      });
      
      toast("Email follow-up task created");
      await loadFollowUpTasks();
      await reloadTasks(); // Also reload main tasks
    } catch (error) {
      console.error("Failed to create email task:", error);
      toast("Failed to create task");
    } finally {
      setCreatingEmailTask(false);
    }
  }

  // Create phone follow-up task
  async function createPhoneTask() {
    if (!lead?.id) return;
    setCreatingPhoneTask(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(phoneTaskDays));
      
      await apiFetch("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        json: {
          title: `Phone follow-up: ${lead.contactName}`,
          description: `Call ${lead.contactName} to discuss the quote`,
          relatedType: "LEAD", 
          relatedId: lead.id,
          priority: "MEDIUM",
          dueAt: dueDate.toISOString(),
          assignees: userId ? [{ userId, role: "OWNER" as const }] : undefined,
          meta: { type: "phone_followup", leadEmail: lead.email }
        }
      });
      
      toast("Phone follow-up task created");
      await loadFollowUpTasks();
      await reloadTasks(); // Also reload main tasks
    } catch (error) {
      console.error("Failed to create phone task:", error);
      toast("Failed to create task");
    } finally {
      setCreatingPhoneTask(false);
    }
  }

  // Create follow-up sequence
  async function createFollowupSequence() {
    if (!lead?.id) return;
    setCreatingSequence(true);
    try {
      // Create email task in 3 days
      const emailDueDate = new Date();
      emailDueDate.setDate(emailDueDate.getDate() + 3);
      
      // Create phone task in 7 days  
      const phoneDueDate = new Date();
      phoneDueDate.setDate(phoneDueDate.getDate() + 7);
      
      await Promise.all([
        apiFetch("/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          json: {
            title: `Email follow-up: ${lead.contactName}`,
            description: `Send follow-up email about the quote to ${lead.email}`,
            relatedType: "LEAD",
            relatedId: lead.id,
            priority: "MEDIUM",
            dueAt: emailDueDate.toISOString(),
            assignees: userId ? [{ userId, role: "OWNER" as const }] : undefined,
            meta: { type: "email_followup", leadEmail: lead.email, sequence: true }
          }
        }),
        apiFetch("/tasks", {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          json: {
            title: `Phone follow-up: ${lead.contactName}`,
            description: `Call ${lead.contactName} to discuss the quote if no email response`,
            relatedType: "LEAD",
            relatedId: lead.id,
            priority: "MEDIUM", 
            dueAt: phoneDueDate.toISOString(),
            assignees: userId ? [{ userId, role: "OWNER" as const }] : undefined,
            meta: { type: "phone_followup", leadEmail: lead.email, sequence: true }
          }
        })
      ]);
      
      toast("Follow-up sequence created: Email in 3 days, phone in 1 week");
      await loadFollowUpTasks();
      await reloadTasks(); // Also reload main tasks
    } catch (error) {
      console.error("Failed to create sequence:", error);
      toast("Failed to create sequence");
    } finally {
      setCreatingSequence(false);
    }
  }

  // Mark task as complete
  async function completeFollowUpTask(taskId: string) {
    try {
      await apiFetch(`/tasks/${taskId}/complete`, { method: "POST" });
      await loadFollowUpTasks();
      await reloadTasks(); // Also reload main tasks
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  }

  // Open email composer for a task
  function openEmailComposer(taskId: string) {
    setCurrentTaskId(taskId);
    setComposerSubject(`Follow-up: ${lead?.contactName}`);
    setComposerBody(`Hi ${lead?.contactName},\n\nI wanted to follow up on the quote we sent. Please let me know if you have any questions or if you'd like to move forward.\n\nBest regards,\n${followupOwnerFirst || "Sales Team"}`);
    setShowEmailComposer(true);
  }

  // Send email and complete task
  async function sendComposerEmail() {
    if (!composerSubject || !composerBody || !currentTaskId || !lead?.id) return;
    
    try {
      setSending(true);
      
      // Send the email using the existing endpoint
      await apiFetch(`/opportunities/${lead.id}/send-followup`, {
        method: "POST",
        json: {
          variant: "MANUAL",
          subject: composerSubject,
          body: composerBody,
          taskId: currentTaskId
        },
      });

      // Mark the task as complete
      await completeFollowUpTask(currentTaskId);
      
      // Close the composer
      setShowEmailComposer(false);
      setCurrentTaskId(null);
      setComposerSubject("");
      setComposerBody("");
      
      toast("Email sent and task completed!");
    } catch (error) {
      console.error("Failed to send email:", error);
      toast("Failed to send email");
    } finally {
      setSending(false);
    }
  }

  // Get pending and completed follow-up tasks
  const pendingFollowUpTasks = followUpTasks.filter(task => 
    task.status !== "DONE" && 
    task.meta?.type && 
    ["email_followup", "phone_followup"].includes(task.meta.type)
  );

  const completedFollowUpTasks = followUpTasks.filter(task =>
    task.status === "DONE" &&
    task.meta?.type &&
    ["email_followup", "phone_followup"].includes(task.meta.type)
  );

  /* ----------------------------- Actions ----------------------------- */

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

      const to = prompt("Supplier email (optional):")?.trim();
      
      // Ask for quote deadline
      const deadlineStr = prompt("When do you need the quote back? (e.g., 2025-11-10, or number of days like '7'):")?.trim();
      let quoteDeadline: Date | null = null;
      
      if (deadlineStr) {
        // Try to parse as a date or number of days
        if (/^\d+$/.test(deadlineStr)) {
          // It's a number of days
          const days = parseInt(deadlineStr);
          quoteDeadline = new Date();
          quoteDeadline.setDate(quoteDeadline.getDate() + days);
        } else {
          // Try to parse as a date
          const parsed = new Date(deadlineStr);
          if (!isNaN(parsed.getTime())) {
            quoteDeadline = parsed;
          }
        }
      }
      
      // Default to 7 days if no valid date provided
      if (!quoteDeadline) {
        quoteDeadline = new Date();
        quoteDeadline.setDate(quoteDeadline.getDate() + 7);
      }

      // Build a concise fields summary from questionnaire answers
      const fields: Record<string, any> = {};
      try {
        // top-level questionnaire answers from known fields
        for (const f of questionnaireFields) {
          if (!f.key) continue;
          const v = (lead.custom as any)?.[f.key];
          if (v === undefined || v === null) continue;
          fields[f.label || f.key] = formatAnswer(v);
        }
        // include a simple summary of first item if available
        const items = Array.isArray((lead.custom as any)?.items) ? (lead.custom as any).items : [];
        if (items.length) {
          const first = items[0] || {};
          const simple: Record<string, any> = {};
          Object.entries(first).forEach(([k, v]) => {
            if (k === "photos") return;
            const val = formatAnswer(v);
            if (val != null) simple[k] = val;
          });
          if (Object.keys(simple).length) fields["Item 1"] = simple;
        }
      } catch {}

      // Prepare attachments from any questionnaire uploads (limit a few)
      const uploads = Array.isArray((lead.custom as any)?.uploads) ? (lead.custom as any).uploads : [];
      const attachments = uploads.slice(0, 5).map((u: any) => ({
        source: "upload" as const,
        filename: (u?.filename && String(u.filename)) || "attachment",
        mimeType: (u?.mimeType && String(u.mimeType)) || "application/octet-stream",
        base64: String(u?.base64 || ""),
      })).filter((u: any) => u.base64);

      // Store the quote deadline in the lead custom data
      await savePatch({ 
        custom: { 
          ...lead.custom, 
          supplierQuoteDeadline: quoteDeadline.toISOString(),
          supplierQuoteRequested: new Date().toISOString()
        } 
      });

      // Create a follow-up task for the deadline
      await apiFetch("/tasks", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: {
          title: `Chase supplier quote: ${lead.contactName || lead.email || "Lead"}`,
          description: `Follow up on supplier quote request. Deadline: ${quoteDeadline.toLocaleDateString()}`,
          relatedType: "LEAD" as const,
          relatedId: lead.id,
          priority: "MEDIUM" as const,
          dueAt: quoteDeadline.toISOString(),
          assignees: userId ? [{ userId, role: "OWNER" as const }] : undefined,
          meta: { 
            type: "supplier_quote_followup", 
            deadline: quoteDeadline.toISOString(),
            supplierEmail: to || ""
          }
        },
      });

      // Attempt server-side send (via Gmail API). Fallback to mailto if it fails or no 'to'
      if (to) {
        try {
          await apiFetch(`/leads/${encodeURIComponent(lead.id)}/request-supplier-quote`, {
            method: "POST",
            headers: { ...authHeaders, "Content-Type": "application/json" },
            json: {
              to,
              subject: `Quote request for ${lead.contactName || "lead"} - Due ${quoteDeadline.toLocaleDateString()}`,
              text: `Please provide a price for the following enquiry by ${quoteDeadline.toLocaleDateString()}.`,
              fields,
              attachments,
              deadline: quoteDeadline.toISOString(),
            },
          });
        } catch (_err) {
          // Fallback to mailto
          openMailTo(
            to,
            `Price request: ${lead.contactName || "Project"} - Due ${quoteDeadline.toLocaleDateString()}`,
            `Hi,\n\nCould you price the attached items by ${quoteDeadline.toLocaleDateString()}?\n\nThanks!`
          );
        }
      } else {
        // If no email provided, open a mailto for manual send
        const subject = `Price request: ${lead.contactName || "Project"} - Due ${quoteDeadline.toLocaleDateString()}`;
        const body = `Hi,\n\nCould you price the attached items by ${quoteDeadline.toLocaleDateString()}?\n\nThanks!`;
        openMailTo("", subject, body);
      }

      await reloadTasks();
      toast(`Supplier request sent. Follow-up task created for ${quoteDeadline.toLocaleDateString()}.`);
    } finally {
      setBusyTask(false);
    }
  }

  async function uploadSupplierQuote() {
    if (!lead?.id) return;
    // Create a hidden file input for PDF/image selection
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      setSaving(true);
      try {
        // Ensure a draft quote exists
        const quote = await apiFetch<any>("/quotes", {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          json: {
            leadId: lead.id,
            title: `Estimate for ${lead.contactName || lead.email || "Lead"}`,
          },
        });

        // Upload files as multipart/form-data
        const fd = new FormData();
        for (const f of files) fd.append("files", f, f.name);
        await fetch(`${API_BASE}/quotes/${encodeURIComponent(quote.id)}/files`, {
          method: "POST",
          headers: authHeaders as any,
          body: fd,
          credentials: "include",
        });

        await ensureManualTask("quote_draft_complete", {
          relatedType: "QUOTE",
          relatedId: quote?.id,
        });
        await reloadTasks();
        toast("Supplier quote uploaded to draft.");
      } catch (e) {
        console.error(e);
        alert("Failed to upload supplier quote");
      } finally {
        setSaving(false);
      }
    };
    input.click();
  }

  // -------------------- Supplier PDF parse tester --------------------
  const [parseTesterOpen, setParseTesterOpen] = useState(false);
  const [_parseTesterBusy, setParseTesterBusy] = useState(false);
  const [parseTesterOut, setParseTesterOut] = useState<any>(null);
  const [parseApplyBusy, setParseApplyBusy] = useState(false);
  const [parseApplyResult, setParseApplyResult] = useState<{ url?: string; name?: string; error?: string } | null>(null);

  async function _testSupplierParse() {
    if (!lead?.id) return;
    setParseTesterBusy(true);
    setParseTesterOut(null);
    try {
      // Use existing quote if present; otherwise create (will likely have no files yet)
      let qid: string | null = lead.quoteId || null;
      if (!qid) {
        const q = await apiFetch<any>("/quotes", {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          json: {
            leadId: lead.id,
            title: `Estimate for ${lead.contactName || lead.email || "Lead"}`,
          },
        });
        qid = q?.id || null;
      }
      if (!qid) {
        setParseTesterOut({ error: "no_quote", message: "Couldn't create a draft quote." });
        setParseTesterOpen(true);
        return;
      }

      // Load current files; if none, prompt user to pick a PDF and upload it, then continue
      let q = await apiFetch<any>(`/quotes/${encodeURIComponent(qid)}`);
      let files: Array<{ id: string; name?: string; uploadedAt?: string; createdAt?: string }>= Array.isArray(q?.supplierFiles) ? q.supplierFiles : [];
      if (!files.length) {
        // Prompt selection
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf";
        input.multiple = false;
        const picked: File | null = await new Promise((resolve) => {
          input.onchange = () => {
            const sel = Array.from(input.files || []);
            resolve(sel.length ? sel[0] : null);
          };
          input.click();
        });
        if (!picked) {
          setParseTesterOut({ error: "no_files", message: "No supplier files on the quote. Upload a PDF, then try again." });
          setParseTesterOpen(true);
          return;
        }
        // Upload the selected PDF to this quote
        const fd = new FormData();
        fd.append("files", picked, picked.name);
        await fetch(`${API_BASE}/quotes/${encodeURIComponent(qid)}/files`, {
          method: "POST",
          headers: authHeaders as any,
          body: fd,
          credentials: "include",
        });
        // Re-fetch quote with files
        q = await apiFetch<any>(`/quotes/${encodeURIComponent(qid)}`);
        files = Array.isArray(q?.supplierFiles) ? q.supplierFiles : [];
      }

      // Pick the most recent supplier file
      const latest = [...files].sort((a, b) => new Date(b.uploadedAt || b.createdAt || 0).getTime() - new Date(a.uploadedAt || a.createdAt || 0).getTime())[0];
      const signed = await apiFetch<any>(`/quotes/${encodeURIComponent(qid)}/files/${encodeURIComponent(latest.id)}/signed`);
      const url: string | undefined = signed?.url;
      if (!url) {
        setParseTesterOut({ error: "no_signed_url", details: signed });
        setParseTesterOpen(true);
        return;
      }

      // Call ML parse through the API
      let out: any = null;
      try {
        out = await apiFetch<any>("/ml/parse-quote", {
          method: "POST",
          json: { url, filename: latest?.name || undefined },
        });
      } catch (e: any) {
        out = { error: e?.message || "request_failed", details: e?.details || null };
      }
      setParseTesterOut(out);
      setParseTesterOpen(true);
    } catch (e: any) {
      setParseTesterOut({ error: "tester_crashed", message: e?.message || String(e) });
      setParseTesterOpen(true);
    } finally {
      setParseTesterBusy(false);
    }
  }

  // Create quote lines from latest supplier PDF, price them, and render a proposal PDF
  async function applyParseToQuoteAndRender() {
    if (!lead?.id) return;
    setParseApplyBusy(true);
    setParseApplyResult(null);
    try {
      // Ensure a draft quote exists
      let qid: string | null = lead.quoteId || null;
      if (!qid) {
        const q = await apiFetch<any>("/quotes", {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          json: {
            leadId: lead.id,
            title: `Estimate for ${lead.contactName || lead.email || "Lead"}`,
          },
        });
        qid = q?.id || null;
      }
      if (!qid) {
        setParseApplyResult({ error: "no_quote" });
        return;
      }

      // Trigger server-side parse to create QuoteLine rows
      await apiFetch<any>(`/quotes/${encodeURIComponent(qid)}/parse`, { method: "POST", headers: authHeaders });

      // Price using margin (defaults to quote.markupDefault on server)
      await apiFetch<any>(`/quotes/${encodeURIComponent(qid)}/price`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        json: { method: "margin" },
      });

      // Render PDF and then get a signed URL
      await apiFetch<any>(`/quotes/${encodeURIComponent(qid)}/render-pdf`, { method: "POST", headers: authHeaders });
      const signed = await apiFetch<any>(`/quotes/${encodeURIComponent(qid)}/proposal/signed`, { headers: authHeaders });
      const url = signed?.url as string | undefined;
      const name = signed?.name as string | undefined;
      if (url) {
        setParseApplyResult({ url, name });
        window.open(url, "_blank");
        toast("Quote PDF ready");
      } else {
        setParseApplyResult({ error: "no_url" });
      }
    } catch (e: any) {
      setParseApplyResult({ error: e?.message || "failed" });
    } finally {
      setParseApplyBusy(false);
    }
  }

  async function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextUi = event.target.value as Lead["status"];
    setUiStatus(nextUi);
    await saveStatus(nextUi);
  }

  async function openQuoteBuilder() {
    if (!lead?.id) return;
    setSaving(true);
    try {
      let qid: string | null = lead.quoteId || null;
      if (!qid) {
        const q = await apiFetch<any>("/quotes", {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          json: {
            leadId: lead.id,
            title: `Estimate for ${lead.contactName || lead.email || "Lead"}`,
          },
        });
        qid = q?.id || null;
      }
      if (qid) {
        window.location.href = `/quotes/${encodeURIComponent(qid)}`;
      } else {
        alert("Couldn't open quote builder – no quote id");
      }
    } catch (_e) {
      alert("Failed to open quote builder");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead() {
    if (!lead?.id) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete this lead "${lead.contactName || lead.email || 'Unnamed Lead'}"?\n\nThis action cannot be undone and will also delete:\n• All associated tasks\n• Communication history\n• Questionnaire responses\n• Any linked quotes or opportunities`
    );
    
    if (!confirmed) return;
    
    setSaving(true);
    try {
      await apiFetch(`/leads/${lead.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      
      toast("Lead deleted successfully");
      onUpdated?.(); // Refresh the leads list
      onOpenChange(false); // Close the modal
    } catch (error: any) {
      console.error("Failed to delete lead:", error);
      alert("Failed to delete lead. Please try again.");
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
  const baseWorkspaceFields = useMemo(
    () =>
      questionnaireFields.filter((field) => {
        if (!field.showOnLead) return false;
        if (field.visibleAfterOrder) {
          return uiStatus === "WON";
        }
        return true;
      }),
    [questionnaireFields, uiStatus]
  );
  const workspaceFields = useMemo(() => {
    const existingKeys = new Set(baseWorkspaceFields.map((field) => field.key));
    const extras: NormalizedQuestionnaireField[] = [];
    if (!existingKeys.has("estimatedValue")) {
      extras.push({
        id: "__estimatedValue",
        key: "estimatedValue",
        label: "Estimated Value",
        required: false,
        type: "number",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        sortOrder: Number.MAX_SAFE_INTEGER - 2,
      });
    }
    if (!existingKeys.has("quotedValue")) {
      extras.push({
        id: "__quotedValue",
        key: "quotedValue",
        label: "Quoted Value",
        required: false,
        type: "number",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        sortOrder: Number.MAX_SAFE_INTEGER - 1,
      });
    }
    if (!existingKeys.has("dateQuoteSent")) {
      extras.push({
        id: "__dateQuoteSent",
        key: "dateQuoteSent",
        label: "Date Quote Sent",
        required: false,
        type: "date",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        sortOrder: Number.MAX_SAFE_INTEGER,
      });
    }
    if (!existingKeys.has("startDate")) {
      extras.push({
        id: "__startDate",
        key: "startDate",
        label: "Workshop Start Date",
        required: false,
        type: "date",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        visibleAfterOrder: true,
        sortOrder: Number.MAX_SAFE_INTEGER + 1,
      });
    }
    if (!existingKeys.has("deliveryDate")) {
      extras.push({
        id: "__deliveryDate",
        key: "deliveryDate",
        label: "Delivery Date",
        required: false,
        type: "date",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        visibleAfterOrder: true,
        sortOrder: Number.MAX_SAFE_INTEGER + 2,
      });
    }
    return [...baseWorkspaceFields, ...extras];
  }, [baseWorkspaceFields]);
  const customData = useMemo(() => {
    const computed = lead?.computed && typeof lead.computed === "object" ? (lead.computed as Record<string, any>) : {};
    if (lead?.custom && typeof lead.custom === "object") {
      return { ...(lead.custom as Record<string, any>), ...computed };
    }
    return { ...computed };
  }, [lead?.custom, lead?.computed]);
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

    const canonicalQuestionnaireFields: Array<{
      key: string;
      label: string;
      type: NormalizedQuestionnaireField["type"];
    }> = [
      { key: "estimatedValue", label: "Estimated Value", type: "number" },
      { key: "quotedValue", label: "Quoted Value", type: "number" },
      { key: "dateQuoteSent", label: "Date Quote Sent", type: "date" },
    ];

    canonicalQuestionnaireFields.forEach((meta) => {
      if (seen.has(meta.key)) return;
      responses.push({
        field: {
          id: `__canonical_${meta.key}`,
          key: meta.key,
          label: meta.label,
          required: false,
          type: meta.type,
          options: [],
          askInQuestionnaire: true,
          showOnLead: true,
          sortOrder: Number.MAX_SAFE_INTEGER,
        },
        value: formatAnswer(customData?.[meta.key]),
      });
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
      "items",
      "uploads",
      "aiFeedback",
      "tags",
      "threadId",
      "aiDecision",
    ]);

    const humanizeKey = (key: string): string => {
      return key
  .replace(/[-_]+/g, " ")
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

  // Inline edit state for questionnaire responses
  const [qEdit, setQEdit] = useState<Record<string, boolean>>({});
  function toggleQEdit(key: string, on: boolean) {
    setQEdit((prev) => ({ ...prev, [key]: on }));
  }
  const questionnaireUploads = useMemo<
    Array<{ filename: string; mimeType: string; base64: string; sizeKB: number | null; addedAt: string | null }>
  >(() => {
    const uploads = Array.isArray((customData as any)?.uploads) ? (customData as any).uploads : [];
    return uploads
      .map((item: any) => ({
        filename: typeof item?.filename === "string" && item.filename.trim() ? item.filename.trim() : "Attachment",
        mimeType: typeof item?.mimeType === "string" && item.mimeType.trim() ? item.mimeType : "application/octet-stream",
        base64: typeof item?.base64 === "string" ? item.base64 : "",
        sizeKB: typeof item?.sizeKB === "number" ? item.sizeKB : null,
        addedAt: typeof item?.addedAt === "string" ? item.addedAt : null,
      }))
    .filter((item: { base64: string }) => item.base64);
  }, [customData]);
  const questionnaireItems = useMemo(() => {
    const items = (customData as any)?.items;
    return Array.isArray(items) ? items : [];
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

  // (Removed unused StageNavigation component; navigation implemented inline below)

  // Utility components
  const _StatusBadge = ({ status }: { status: Lead["status"] }) => (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
      status === 'NEW_ENQUIRY' ? 'bg-blue-100 text-blue-800' :
      status === 'INFO_REQUESTED' ? 'bg-yellow-100 text-yellow-800' :
      status === 'READY_TO_QUOTE' ? 'bg-green-100 text-green-800' :
      status === 'QUOTE_SENT' ? 'bg-purple-100 text-purple-800' :
      status === 'WON' ? 'bg-emerald-100 text-emerald-800' :
      status === 'LOST' ? 'bg-red-100 text-red-800' :
      status === 'REJECTED' ? 'bg-gray-100 text-gray-800' :
      'bg-gray-100 text-gray-800'
    }`}>
      {STATUS_LABELS[status]}
    </span>
  );

  // (Removed unused StatusPipeline component)

  const _formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Unknown";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  // (Removed unused OverviewStage, DetailsStage, QuestionnaireStage, and TasksStage components)

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
            className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onChange={handleStatusChange}
            disabled={saving}
          >
            {(Object.keys(STATUS_LABELS) as Lead["status"][]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <Button
            variant="default"
            onClick={openQuoteBuilder}
            title="Open the quote builder for this lead"
            disabled={saving}
          >
            Open Quote Builder
          </Button>

          <Button
            variant="destructive"
            onClick={deleteLead}
            disabled={saving || loading}
            title="Delete this lead permanently"
          >
            🗑️ Delete
          </Button>

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving || loading}
          >
            Close
          </Button>
        </div>

        {/* Stage Navigation */}
        <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1 mx-6 mt-4">
          {[
            { key: "overview", label: "Overview", icon: "📊", description: "Lead summary and actions" },
            { key: "details", label: "Details", icon: "📝", description: "Contact info and notes" },
            { key: "questionnaire", label: "Questionnaire", icon: "📋", description: "Client responses" },
            { key: "tasks", label: "Tasks", icon: "✅", description: "Action items" },
            ...(uiStatus === 'WON' ? [{ key: "workshop" as const, label: "Workshop", icon: "🛠️", description: "Production management" }] : []),
          ].map((stage) => (
            <button
              key={stage.key}
              onClick={() => setCurrentStage(stage.key as typeof currentStage)}
              className={`
                flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                ${currentStage === stage.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{stage.icon}</span>
                <span className="hidden sm:inline">{stage.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-sky-100/60 bg-gradient-to-r from-sky-50 via-indigo-50 to-amber-50 text-slate-700">
          {uiStatus === "NEW_ENQUIRY" && (
            <DeclineEnquiryButton
              lead={{
                id: lead?.id || leadPreview?.id || "",
                contactName: lead?.contactName ?? leadPreview?.contactName,
                email: lead?.email ?? leadPreview?.email,
                description: lead?.description ?? leadPreview?.description,
                custom: (lead?.custom as any) ?? (leadPreview?.custom as any) ?? null,
              }}
              disabled={saving || loading}
              authHeaders={authHeaders}
              brandName={settings?.brandName ?? null}
              onMarkedRejected={() => {
                setUiStatus("REJECTED");
                return saveStatus("REJECTED");
              }}
            />
          )}

          <Button
            variant="outline"
            onClick={sendQuestionnaire}
            disabled={busyTask || saving}
            title="Invite your client to share their project details."
          >
            <span aria-hidden="true">📜</span>
            Send Client Questionnaire
          </Button>

          <Button
            variant="outline"
            onClick={requestSupplierPrice}
            disabled={busyTask}
            title="Ask your supplier for pricing — we’ll handle the magic behind the scenes"
          >
            <span aria-hidden="true">🧞</span>
            Request Supplier Quote
          </Button>

          <Button
            variant="outline"
            onClick={uploadSupplierQuote}
            title="Upload a supplier PDF or image to attach to a draft quote"
            disabled={saving}
          >
            <span aria-hidden="true">📎</span>
            Upload Supplier Quote
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Stage-based Content */}
          {currentStage === 'overview' && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-sky-50/70 to-rose-50/60 min-h-[60vh]">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Overview Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                      <span aria-hidden="true">👤</span>
                      Lead Details
                    </div>
                    <div className="space-y-4">
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
                            type="email"
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

                      <label className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Phone</span>
                        <input
                          type="tel"
                          className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          onBlur={() => {
                            setLead((l) => (l ? { ...l, phone: phoneInput || null } : l));
                            savePatch({ phone: phoneInput || null });
                          }}
                          placeholder="Phone number"
                        />
                      </label>

                      <label className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Project Description</span>
                        <textarea
                          className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-3 min-h-24 shadow-inner"
                          value={descInput}
                          onChange={(e) => setDescInput(e.target.value)}
                          onBlur={() => {
                            setLead((l) => (l ? { ...l, description: descInput || null } : l));
                            savePatch({ description: descInput || null });
                          }}
                          placeholder="Project background, requirements, constraints…"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                      <span aria-hidden="true">�</span>
                      Communication Log
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        <label className="text-sm">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Type</span>
                          <select
                            className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                            value={communicationType}
                            onChange={(e) => setCommunicationType(e.target.value as 'call' | 'email' | 'note')}
                          >
                            <option value="note">📝 Note</option>
                            <option value="call">📞 Phone Call</option>
                            <option value="email">📧 Email</option>
                          </select>
                        </label>

                        <label className="text-sm">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            {communicationType === 'call' ? 'Call Summary' : 
                             communicationType === 'email' ? 'Email Summary' : 'Note'}
                          </span>
                          <textarea
                            className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-3 min-h-20 shadow-inner"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder={
                              communicationType === 'call' ? 'What was discussed during the call?' :
                              communicationType === 'email' ? 'Email sent/received summary' :
                              'Add a note about this lead...'
                            }
                          />
                        </label>

                        <Button
                          className="w-full"
                          onClick={addCommunicationNote}
                          disabled={!newNote.trim()}
                        >
                          {communicationType === 'call' ? '📞 Log Call' : 
                           communicationType === 'email' ? '📧 Log Email' : '📝 Add Note'}
                        </Button>
                      </div>

                      {/* Communication Log Display */}
                      {lead?.communicationLog && lead.communicationLog.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent Communications</h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {lead.communicationLog.map((entry) => (
                              <div key={entry.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs">
                                    {entry.type === 'call' ? '📞' : entry.type === 'email' ? '📧' : '📝'}
                                  </span>
                                  <span className="text-xs font-medium capitalize">{entry.type}</span>
                                  <span className="text-xs text-slate-500 ml-auto">
                                    {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700">{entry.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {currentStage === 'details' && (
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
                      {questionnaireResponses.map(({ field, value }, idx) => {
                        const k = field.key || field.id || String(idx);
                        const isEditing = !!qEdit[k];
                        const draftVal = customDraft[k] ?? (value ?? "");
                        const inputClasses = "w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200";
                        return (
                          <div key={k} className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {field.label || field.key || field.id}
                                {field.required ? <span className="text-rose-500"> *</span> : null}
                              </dt>
                              <button
                                type="button"
                                className="text-xs font-semibold text-sky-600 hover:underline"
                                onClick={() => {
                                  if (isEditing) {
                                    toggleQEdit(k, false);
                                  } else {
                                    if (value !== undefined) {
                                      setCustomDraft((prev) => ({ ...prev, [k]: value ?? "" }));
                                    }
                                    toggleQEdit(k, true);
                                  }
                                }}
                              >
                                {isEditing ? "Cancel" : "Edit"}
                              </button>
                            </div>
                            <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                              {isEditing ? (
                                field.type === "textarea" ? (
                                  <textarea
                                    className={`${inputClasses} min-h-[100px]`}
                                    value={draftVal}
                                    onChange={(e) => setCustomDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                                    onBlur={async (e) => {
                                      await saveCustomField(field as any, e.target.value);
                                      toggleQEdit(k, false);
                                    }}
                                  />
                                ) : (
                                  <input
                                    className={inputClasses}
                                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                                    value={draftVal}
                                    onChange={(e) => setCustomDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                                    onBlur={async (e) => {
                                      await saveCustomField(field as any, e.target.value);
                                      toggleQEdit(k, false);
                                    }}
                                  />
                                )
                              ) : (
                                value ?? <span className="text-slate-400">Not provided</span>
                              )}
                            </dd>
                          </div>
                        );
                      })}
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
                  {questionnaireItems.length ? (
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</div>
                      <div className="mt-2 space-y-3">
                        {questionnaireItems.map((it: any, idx: number) => (
                          <div key={idx} className="rounded-xl border border-slate-200/70 bg-white/70 p-3">
                            <div className="text-sm font-semibold">Item {idx + 1}</div>
                            <div className="mt-2 text-sm text-slate-700 space-y-1">
                              {Object.keys(it || {}).length === 0 ? (
                                <div className="text-xs text-slate-400">No details</div>
                              ) : (
                                Object.entries(it).map(([k, v]) => {
                                  if (k === "photos") return null;
                                  return (
                                    <div key={k} className="flex items-start gap-2">
                                      <div className="text-xs text-slate-500 w-28">{String(k)}</div>
                                      <div className="text-sm text-slate-700 break-words">{formatAnswer(v) ?? ""}</div>
                                    </div>
                                  );
                                })
                              )}

                              {Array.isArray(it.photos) && it.photos.length ? (
                                <div className="mt-2">
                                  <div className="text-xs text-slate-500">Photos</div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    {it.photos.map((p: any, pidx: number) => {
                                      const dataUrl = p && p.base64 ? `data:${p.mimeType || "image/jpeg"};base64,${p.base64}` : null;
                                      return (
                                        <a key={pidx} href={dataUrl || "#"} download={p?.filename || `photo-${pidx + 1}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white">
                                          <span aria-hidden>📷</span>
                                          {p?.filename || `photo-${pidx + 1}`}
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
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
          )}

          {currentStage === 'questionnaire' && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-sky-50/70 to-rose-50/60 min-h-[60vh]">
              <div className="max-w-4xl mx-auto space-y-6">
                <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                    <span aria-hidden="true">📋</span>
                    Client Questionnaire
                  </div>
                  {questionnaireFields.length > 0 ? (
                    <div className="space-y-4">
                      {questionnaireFields.map((field: NormalizedQuestionnaireField) => {
                        const key = field.key;
                        const value = customData?.[key] ?? "";
                        const label = field.label || key;
                        
                        return (
                          <div key={key} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                            <div className="font-medium text-sm text-slate-700 mb-2">{label}</div>
                            <div className="text-sm text-slate-600">
                              {value || <span className="italic text-slate-400">No response provided</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 py-8 text-center">
                      No questionnaire configured for this workspace
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {currentStage === 'tasks' && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-sky-50/70 to-rose-50/60 min-h-[60vh]">
              <div className="max-w-6xl mx-auto">
                {/* Tasks Section - Full Width */}
                <div className="rounded-2xl border border-indigo-100 bg-white/80 p-6 shadow-sm backdrop-blur">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <span aria-hidden="true">⭐</span>
                      Task journey
                    </div>
                    <div className="text-xs text-slate-500">{openCount} open</div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                      <span>{completedCount} completed</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400 transition-all"
                        style={{ width: `${progress}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  {/* Task List */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tasks.map((t) => {
                      let bgColor = "bg-slate-50";
                      if (t.status === "DONE") bgColor = "bg-emerald-50";
                      else if (t.status === "IN_PROGRESS") bgColor = "bg-blue-50";
                      else if (t.status === "BLOCKED") bgColor = "bg-rose-50";
                      else if (t.priority === "URGENT") bgColor = "bg-orange-50";

                      return (
                        <div
                          key={t.id}
                          className={`rounded-xl border border-slate-200 ${bgColor} p-4 transition-colors hover:shadow-sm cursor-pointer`}
                          onClick={() => {
                            // Optional: Add task detail modal functionality here
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <label className="inline-flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={t.status === "DONE"}
                                    onChange={() => toggleTaskComplete(t)}
                                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                                    aria-label={`Complete ${t.title}`}
                                  />
                                </label>
                                <div className="text-sm font-semibold text-slate-900 leading-snug">
                                  {t.title}
                                </div>
                              </div>
                              {t.description && (
                                <div className="text-xs text-slate-600 mb-2 line-clamp-2">
                                  {t.description}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-1">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    t.status === "DONE"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : t.status === "IN_PROGRESS"
                                      ? "bg-blue-100 text-blue-700"
                                      : t.status === "BLOCKED"
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {(() => {
                                    if (t.status === "DONE") return "✓";
                                    if (t.status === "IN_PROGRESS") return "⏳";
                                    if (t.status === "BLOCKED") return "⚠";
                                    return "○";
                                  })()}
                                  <span className="ml-1">
                                    {t.status === "IN_PROGRESS" ? "In progress" : t.status.toLowerCase()}
                                  </span>
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    t.priority === "URGENT"
                                      ? "bg-rose-100 text-rose-700"
                                      : t.priority === "HIGH"
                                      ? "bg-orange-100 text-orange-700"
                                      : t.priority === "MEDIUM"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {t.priority.toLowerCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden="true">⏰</span>
                              {t.dueAt ? new Date(t.dueAt).toLocaleString() : "No due date"}
                            </span>
                            {t.relatedType && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-600">
                                <span aria-hidden="true">🔗</span>
                                {t.relatedType.toLowerCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {tasks.length === 0 && (
                      <div className="col-span-full text-sm text-slate-500 py-8 text-center">
                        No tasks created yet. Use the actions above or create a manual task to get started.
                      </div>
                    )}
                  </div>

                  {/* Add Task Section */}
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <span aria-hidden="true">➕</span>
                        New task
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white"
                        onClick={() => {
                          if (showTaskComposer) {
                            resetTaskComposer();
                          }
                          setShowTaskComposer((v) => !v);
                        }}
                      >
                        {showTaskComposer ? "Cancel" : "Add Task"}
                      </button>
                    </div>

                    {showTaskComposer && (
                      <form
                        className="bg-slate-50/50 rounded-lg p-4 space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          createManualTask();
                        }}
                      >
                        {taskError && (
                          <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-sm text-rose-600">
                            {taskError}
                          </div>
                        )}

                        <label className="block text-sm font-semibold text-slate-600">
                          Title *
                          <input
                            type="text"
                            value={taskComposer.title}
                            onChange={(e) => setTaskComposer((prev) => ({ ...prev, title: e.target.value }))}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                            placeholder="e.g. Call the client"
                            required
                          />
                        </label>

                        <label className="block text-sm font-semibold text-slate-600">
                          Description
                          <textarea
                            value={taskComposer.description}
                            onChange={(e) => setTaskComposer((prev) => ({ ...prev, description: e.target.value }))}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 min-h-[72px]"
                            placeholder="Add context for the team"
                          />
                        </label>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block text-sm font-semibold text-slate-600">
                            Priority
                            <select
                              value={taskComposer.priority}
                              onChange={(e) =>
                                setTaskComposer((prev) => ({ ...prev, priority: e.target.value as Task["priority"] }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                            >
                              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block text-sm font-semibold text-slate-600">
                            Due date & time
                            <input
                              type="datetime-local"
                              value={taskComposer.dueAt}
                              onChange={(e) => setTaskComposer((prev) => ({ ...prev, dueAt: e.target.value }))}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                            />
                          </label>
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="submit"
                            className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 text-white px-6 py-2 text-sm font-semibold shadow hover:from-indigo-600 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
                            disabled={busyTask || !taskComposer.title.trim()}
                          >
                            {busyTask ? "Creating..." : "Create Task"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowTaskComposer(false)}
                            className="rounded-full border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <div className="mt-4 text-xs text-slate-500 text-center">
                    Tip: Completing a lead action will sprinkle pixie dust on the matching task automatically.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Parse tester output (simple inline panel) */}
        {parseTesterOpen && (
          <div className="absolute bottom-4 left-4 right-4 z-[70]">
            <div className="rounded-2xl border border-indigo-200 bg-white/95 shadow-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-indigo-800">PDF Parse Test Output</div>
                <button
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  onClick={() => setParseTesterOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 text-white px-3 py-1.5 text-xs font-semibold shadow hover:from-indigo-600 hover:to-sky-600 disabled:opacity-60"
                  onClick={applyParseToQuoteAndRender}
                  disabled={parseApplyBusy}
                  title="Create quote lines, price them, and generate a proposal PDF"
                >
                  {parseApplyBusy ? "Building…" : "Add to Quote + Generate PDF"}
                </button>
                {parseApplyResult?.url ? (
                  <a
                    className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white"
                    href={parseApplyResult.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open PDF{parseApplyResult.name ? ` (${parseApplyResult.name})` : ""}
                  </a>
                ) : null}
                {parseApplyResult?.error ? (
                  <span className="text-xs text-rose-600">{parseApplyResult.error}</span>
                ) : null}
              </div>
              <div className="mt-2 max-h-64 overflow-auto">
                <pre className="text-[11px] leading-snug text-slate-700 whitespace-pre-wrap break-words">
                  {(() => {
                    try { return JSON.stringify(parseTesterOut, null, 2); } catch { return String(parseTesterOut); }
                  })()}
                </pre>
              </div>
            </div>
          </div>
        )}

          {/* Workshop Tab */}
          {currentStage === 'workshop' && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-emerald-50/70 to-teal-50/60 min-h-[60vh] max-h-[60vh] overflow-y-auto">
              <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Project Details */}
                <section className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-900">
                    <span aria-hidden>📅</span>
                    Project Details
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="block">
                      <span className="text-xs text-slate-600 font-medium mb-1 block">Start Date</span>
                      <input
                        type="date"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        value={projectStartDate}
                        onChange={(e) => setProjectStartDate(e.target.value)}
                        onBlur={() => {
                          if (projectStartDate) {
                            saveOpportunityField('startDate', projectStartDate);
                          }
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-600 font-medium mb-1 block">Delivery Date</span>
                      <input
                        type="date"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        value={projectDeliveryDate}
                        onChange={(e) => setProjectDeliveryDate(e.target.value)}
                        onBlur={() => {
                          if (projectDeliveryDate) {
                            saveOpportunityField('deliveryDate', projectDeliveryDate);
                          }
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-600 font-medium mb-1 block">Value (GBP)</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        value={projectValueGBP}
                        onChange={(e) => setProjectValueGBP(e.target.value)}
                        onBlur={() => {
                          if (projectValueGBP) {
                            saveOpportunityField('valueGBP', Number(projectValueGBP));
                          }
                        }}
                        placeholder="0.00"
                      />
                    </label>
                  </div>
                </section>

                {/* Workshop Processes */}
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                      <span aria-hidden>🛠️</span>
                      Workshop processes for this project
                    </div>
                    <button
                      type="button"
                      className="text-xs text-emerald-700 hover:text-emerald-900"
                      onClick={() => {
                        // trigger refetch
                        (async () => {
                          setWkLoading(true);
                          try {
                            const pid = opportunityId || lead.id;
                            const project = await apiFetch<any>(`/workshop-processes/project/${encodeURIComponent(pid)}`).catch(() => []);
                            const arr = Array.isArray(project?.assignments || project) ? (project.assignments || project) : [];
                            const norm: ProcAssignment[] = arr.map((it: any) => ({
                              id: String(it.id || it.assignmentId || crypto.randomUUID()),
                              processDefinitionId: it.processDefinitionId || it.processDefinition?.id,
                              processCode: it.processCode || it.processDefinition?.code,
                              processName: it.processName || it.processDefinition?.name,
                              required: Boolean(it.required ?? true),
                              estimatedHours: it.estimatedHours ?? it.processDefinition?.estimatedHours ?? null,
                              assignedUser: it.assignedUser ? { id: it.assignedUser.id, name: it.assignedUser.name ?? null, email: it.assignedUser.email } : null,
                            }));
                            setWkAssignments(norm);
                          } finally {
                            setWkLoading(false);
                          }
                        })();
                      }}
                    >
                      Refresh
                    </button>
                  </div>

                  {wkLoading ? (
                    <div className="text-sm text-emerald-800">Loading processes…</div>
                  ) : wkDefs.length === 0 ? (
                    <div className="text-sm text-emerald-800">No tenant processes defined. Configure them in Settings → Workshop Processes.</div>
                  ) : (
                    <div className="space-y-2">
                      {wkDefs.map((def) => {
                        const asn = getAssignmentFor(def.id);
                        const required = asn?.required ?? !!def.requiredByDefault;
                        const est = (asn?.estimatedHours ?? def.estimatedHours) ?? null;
                        const userIdSel = asn?.assignedUser?.id || "";
                        return (
                          <div key={def.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 rounded-xl border bg-white/80 px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-slate-900">{def.name}</div>
                              <div className="text-[11px] text-slate-500">{def.code}</div>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={required}
                                onChange={(e) => saveProjectAssignment(def, { required: e.target.checked, assignedUserId: userIdSel || null, estimatedHours: est })}
                                disabled={wkSavingId === def.id}
                              />
                              Required
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600 whitespace-nowrap">Assign</span>
                              <select
                                className="rounded-md border px-2 py-1 text-sm"
                                value={userIdSel}
                                onChange={(e) => saveProjectAssignment(def, { required, assignedUserId: e.target.value || null, estimatedHours: est })}
                                disabled={wkSavingId === def.id}
                              >
                                <option value="">Unassigned</option>
                                {wkUsers.map((u) => (
                                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600 whitespace-nowrap">Hours</span>
                              <input
                                type="number"
                                className="w-24 rounded-md border px-2 py-1 text-sm"
                                value={est ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? null : Number(e.target.value);
                                  saveProjectAssignment(def, { required, assignedUserId: userIdSel || null, estimatedHours: val });
                                }}
                                disabled={wkSavingId === def.id}
                              />
                            </div>
                            <div className="text-right">
                              {asn ? (
                                <span className="inline-block text-[11px] text-slate-500">Saved</span>
                              ) : (
                                <span className="inline-block text-[11px] text-slate-500">Not yet assigned</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Material Tracking */}
                <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm backdrop-blur">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                      <span aria-hidden>📦</span>
                      Material Tracking
                    </div>
                    <button
                      type="button"
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                      onClick={saveMaterialDates}
                      disabled={materialSaving}
                    >
                      {materialSaving ? "Saving..." : "Save Materials"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'timber', label: 'Timber', icon: '🪵' },
                      { key: 'glass', label: 'Glass', icon: '🪟' },
                      { key: 'ironmongery', label: 'Ironmongery', icon: '🔩' },
                      { key: 'paint', label: 'Paint', icon: '🎨' },
                    ].map((material) => {
                      const notApplicableKey = `${material.key}NotApplicable` as keyof MaterialDates;
                      const isNA = materialDates[notApplicableKey] || false;
                      
                      return (
                        <div key={material.key} className="rounded-xl border bg-white/80 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span>{material.icon}</span>
                              <span className="text-sm font-medium text-slate-900">{material.label}</span>
                            </div>
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!isNA}
                                onChange={(e) => setMaterialDates(prev => ({
                                  ...prev,
                                  [notApplicableKey]: e.target.checked,
                                  // Clear dates when marking as N/A
                                  ...(e.target.checked ? {
                                    [`${material.key}OrderedAt`]: null,
                                    [`${material.key}ExpectedAt`]: null,
                                    [`${material.key}ReceivedAt`]: null,
                                  } : {})
                                }))}
                                className="rounded"
                              />
                              N/A
                            </label>
                          </div>
                          {!isNA && (
                            <div className="space-y-2">
                              <label className="block">
                                <span className="text-xs text-slate-600">Ordered</span>
                                <input
                                  type="date"
                                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                                  value={String(materialDates[`${material.key}OrderedAt` as keyof MaterialDates] || "")}
                                  onChange={(e) => setMaterialDates(prev => ({
                                    ...prev,
                                    [`${material.key}OrderedAt`]: e.target.value || null
                                  }))}
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs text-slate-600">Expected</span>
                                <input
                                  type="date"
                                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                                  value={String(materialDates[`${material.key}ExpectedAt` as keyof MaterialDates] || "")}
                                  onChange={(e) => setMaterialDates(prev => ({
                                    ...prev,
                                    [`${material.key}ExpectedAt`]: e.target.value || null
                                  }))}
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs text-slate-600">Received</span>
                                <input
                                  type="date"
                                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                                  value={String(materialDates[`${material.key}ReceivedAt` as keyof MaterialDates] || "")}
                                  onChange={(e) => setMaterialDates(prev => ({
                                    ...prev,
                                    [`${material.key}ReceivedAt`]: e.target.value || null
                                  }))}
                                />
                              </label>
                            </div>
                          )}
                          {isNA && (
                            <div className="text-sm text-gray-500 italic text-center py-4">
                              Not applicable for this project
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

              </div>
            </div>
          )}

          {/* Follow-up Tab */}
          {currentStage === 'follow-up' && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-blue-50/70 to-indigo-50/60 min-h-[60vh]">
              <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Schedule Follow-up Tasks */}
                  <section className="rounded-xl border p-4 bg-white/90 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Schedule Follow-up Tasks</h3>
                    
                    {/* Email Follow-up Task */}
                    <div className="p-3 border rounded-lg bg-slate-50 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span>📧</span>
                        <span className="font-medium text-sm">Email Follow-up</span>
                      </div>
                      <div className="space-y-2">
                        <label className="block">
                          <div className="text-xs text-slate-600 mb-1">When to send</div>
                          <select 
                            className="w-full rounded border bg-white p-2 text-sm"
                            value={emailTaskDays}
                            onChange={(e) => setEmailTaskDays(e.target.value)}
                          >
                            <option value="1">Tomorrow</option>
                            <option value="3">In 3 days</option>
                            <option value="7">In 1 week</option>
                            <option value="14">In 2 weeks</option>
                          </select>
                        </label>
                        <button 
                          className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          disabled={creatingEmailTask}
                          onClick={createEmailTask}
                        >
                          {creatingEmailTask ? "Creating..." : "Create Email Task"}
                        </button>
                      </div>
                    </div>

                    {/* Phone Follow-up Task */}
                    <div className="p-3 border rounded-lg bg-slate-50 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span>📞</span>
                        <span className="font-medium text-sm">Phone Follow-up</span>
                      </div>
                      <div className="space-y-2">
                        <label className="block">
                          <div className="text-xs text-slate-600 mb-1">When to call</div>
                          <select 
                            className="w-full rounded border bg-white p-2 text-sm"
                            value={phoneTaskDays}
                            onChange={(e) => setPhoneTaskDays(e.target.value)}
                          >
                            <option value="1">Tomorrow</option>
                            <option value="2">In 2 days</option>
                            <option value="5">In 5 days</option>
                            <option value="7">In 1 week</option>
                          </select>
                        </label>
                        <button 
                          className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          disabled={creatingPhoneTask}
                          onClick={createPhoneTask}
                        >
                          {creatingPhoneTask ? "Creating..." : "Create Phone Task"}
                        </button>
                      </div>
                    </div>

                    {/* Auto-schedule All */}
                    <div className="pt-3 border-t">
                      <button 
                        className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        disabled={creatingSequence}
                        onClick={createFollowupSequence}
                      >
                        {creatingSequence ? "Creating..." : "Auto-schedule Follow-up Sequence"}
                      </button>
                      <div className="text-xs text-slate-500 mt-1 text-center">
                        Creates email task (3 days) + phone task (1 week)
                      </div>
                    </div>
                  </section>

                  {/* Scheduled Tasks Panel */}
                  <section className="rounded-xl border p-4 bg-white">
                    <div className="mb-2 text-sm font-semibold text-slate-900 flex items-center justify-between">
                      <span>Scheduled Tasks</span>
                      {loadingFollowUpTasks && <span className="text-xs text-slate-500">Loading...</span>}
                    </div>
                    
                    {/* Real tasks from API */}
                    <div className="space-y-3">
                      {pendingFollowUpTasks.length === 0 ? (
                        <div className="text-sm text-slate-500 text-center py-4">
                          No scheduled follow-up tasks. Create one above.
                        </div>
                      ) : (
                        pendingFollowUpTasks.map((task) => (
                          <div key={task.id} className="rounded-md border p-3 bg-blue-50">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span>{task.meta?.type === "email_followup" ? "📧" : "📞"}</span>
                                <span className="text-sm font-medium">{task.title}</span>
                              </div>
                              <span className="text-xs text-slate-500">
                                {task.dueAt ? `Due ${new Date(task.dueAt).toLocaleDateString()}` : "Due soon"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mb-2">
                              {task.description}
                            </div>
                            <div className="flex gap-2">
                              {task.meta?.type === "email_followup" ? (
                                <Button 
                                  variant="default"
                                  size="sm"
                                  onClick={() => openEmailComposer(task.id)}
                                >
                                  Compose & Send
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    toast("Call logging would open here");
                                  }}
                                >
                                  Log Call
                                </Button>
                              )}
                              <Button 
                                variant="secondary"
                                size="sm"
                                onClick={() => completeFollowUpTask(task.id)}
                              >
                                Mark Done
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Completed Tasks */}
                    {completedFollowUpTasks.length > 0 && (
                      <div className="mt-4 pt-3 border-t">
                        <div className="text-xs font-medium text-slate-600 mb-2">Completed</div>
                        <div className="space-y-2">
                          {completedFollowUpTasks.map((task) => (
                            <div key={task.id} className="rounded-md border p-2 bg-slate-50 opacity-75">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600">✓</span>
                                  <span className="text-xs">{task.title}</span>
                                </div>
                                <span className="text-xs text-slate-400">
                                  {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : "Done"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          )}

      </div>

      {/* Email Composer Modal */}
      {showEmailComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Compose Follow-up Email</h3>
            </div>
            
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-1">To:</label>
                <div className="text-sm text-slate-600">{lead?.email}</div>
              </div>
              
              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-1">Subject:</label>
                <input
                  id="subject"
                  type="text"
                  value={composerSubject}
                  onChange={(e) => setComposerSubject(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject..."
                />
              </div>
              
              <div>
                <label htmlFor="body" className="block text-sm font-medium mb-1">Message:</label>
                <textarea
                  id="body"
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  rows={8}
                  className="w-full p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email message..."
                />
              </div>
            </div>

            <div className="p-4 border-t flex gap-2 justify-end">
              <button 
                className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                onClick={() => setShowEmailComposer(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                onClick={sendComposerEmail}
                disabled={sending || !composerSubject || !composerBody}
              >
                {sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}