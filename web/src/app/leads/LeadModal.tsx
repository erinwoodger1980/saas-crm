// web/src/app/leads/LeadModal.tsx
"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, apiFetch } from "@/lib/api";
import { createQuoteLine, updateQuoteLine } from "@/lib/api/quotes";
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
import { UnifiedActivityTimeline } from "@/components/leads/UnifiedActivityTimeline";
import { useLeadActivity } from "@/lib/use-lead-activity";
// Unified task modal (replaces legacy FollowUpTaskPanel usage in this file)
import { TaskModal } from "@/components/tasks/TaskModal";
import { TaskCenter } from "@/components/tasks/TaskCenter";
import { EmailPreviewModal } from "@/components/EmailPreviewModal";
import { UnifiedFieldRenderer } from "@/components/fields/UnifiedFieldRenderer";
import { fetchQuestionnaireFields } from "@/lib/questionnaireFields";
import { UnifiedQuoteLineItems } from "@/components/quotes/UnifiedQuoteLineItems";
import { ClientSelector } from "@/components/ClientSelector";
import { CustomFieldsPanel } from "@/components/fields/CustomFieldsPanel";

/* ----------------------------- Types ----------------------------- */

export type Lead = {
  id: string;
  number?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  deliveryAddress?: string | null;
  clientId?: string | null;
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
  capturedAt?: string | null;
  computed?: Record<string, any> | null;
  communicationLog?: Array<{
    id: string;
    type: 'call' | 'email' | 'note';
    content: string;
    timestamp: string;
  }> | null;
  visionInferences?: VisionInference[] | null;
  taskCount?: number;
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

type VisionInference = {
  id: string;
  itemNumber: number | null;
  source: "MEASUREMENT" | "INSPIRATION" | (string & {});
  widthMm?: number | null;
  heightMm?: number | null;
  confidence?: number | null;
  attributes?: Record<string, any> | null;
  description?: string | null;
  notes?: string | null;
  photoLabel?: string | null;
  createdAt?: string | null;
};

type VisionInferenceGroup = {
  key: string;
  itemNumber: number | null;
  measurement?: VisionInference;
  inspiration?: VisionInference;
  extras: VisionInference[];
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
  productTypes?: string[];
};

type TenantSettings = {
  slug: string;
  brandName?: string | null;
  questionnaire?: { title?: string; questions?: QuestionnaireField[] } | QuestionnaireField[] | null;
  taskPlaybook?: TaskPlaybook;
  questionnaireEmailSubject?: string | null;
  questionnaireEmailBody?: string | null;
  isFireDoorManufacturer?: boolean;
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

function formatDimensionLabel(width?: number | null, height?: number | null): string {
  if (width && height) return `${width} × ${height} mm`;
  if (width) return `${width} mm width`;
  if (height) return `${height} mm height`;
  return "No rough measurement";
}

function formatConfidenceLabel(value?: number | null): string | null {
  if (value == null) return null;
  return `${Math.round(value * 100)}% confidence`;
}

function ensureStringArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry == null ? "" : String(entry)))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function joinList(values: string[]): string | null {
  if (!values.length) return null;
  return values.join(", ");
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
      const productTypes = Array.isArray((raw as any).productTypes)
        ? (raw as any).productTypes.filter((pt: any) => typeof pt === "string" && pt.trim()).map((pt: any) => pt.trim())
        : undefined;
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
        productTypes,
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

type Stage = 'client' | 'quote' | 'tasks' | 'order';

export default function LeadModal({
  open,
  onOpenChange,
  leadPreview,
  onUpdated,
  initialStage = 'client',
  showFollowUp = false,
}: {
  open: boolean;
  onOpenChange: (_v: boolean) => void;
  leadPreview: Lead | null;
  onUpdated?: () => void | Promise<void>;
  initialStage?: Stage;
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
  const [currentStage, setCurrentStage] = useState<Stage>(initialStage);

  useEffect(() => {
    if (showFollowUp) {
      setCurrentStage("tasks");
    }
  }, [showFollowUp]);

  // Listen for external stage change requests (e.g., from task count badge)
  useEffect(() => {
    const handleStageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ stage: Stage }>;
      if (customEvent.detail?.stage && open) {
        setCurrentStage(customEvent.detail.stage);
      }
    };
    window.addEventListener('lead-modal-set-stage', handleStageChange);
    return () => window.removeEventListener('lead-modal-set-stage', handleStageChange);
  }, [open]);

  // Form inputs
  const [numberInput, setNumberInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [deliveryAddressInput, setDeliveryAddressInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});
  const [clientType, setClientType] = useState<string>("public");
  const [currentClientData, setCurrentClientData] = useState<any>(null);

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
  
  // Product types for dropdown (e.g., Door, Window, Arch Opening)
  const [productTypes, setProductTypes] = useState<any[]>([]);

  // Unified questionnaire fields by scope
  const [clientFields, setClientFields] = useState<NormalizedQuestionnaireField[]>([]);
  const [quoteDetailsFields, setQuoteDetailsFields] = useState<NormalizedQuestionnaireField[]>([]);
  const [manufacturingFields, setManufacturingFields] = useState<NormalizedQuestionnaireField[]>([]);
  const [fireDoorScheduleFields, setFireDoorScheduleFields] = useState<NormalizedQuestionnaireField[]>([]);
  const [fireDoorLineItemsFields, setFireDoorLineItemsFields] = useState<NormalizedQuestionnaireField[]>([]);
  const [publicFields, setPublicFields] = useState<NormalizedQuestionnaireField[]>([]);
  const [internalFields, setInternalFields] = useState<NormalizedQuestionnaireField[]>([]);
  
  // ML Estimate state
  const [activeDetailsTab, setActiveDetailsTab] = useState<"client" | "quote" | "questionnaire">("client");
  const [mlEstimate, setMlEstimate] = useState<any | null>(null);
  const [isAmendingEstimate, setIsAmendingEstimate] = useState(false);
  
  // Unified activity hook - replaces old followUpTasks state
  const {
    activities,
    isLoading: loadingActivity,
    isError: activityError,
    refresh: refreshActivity,
    addActivityOptimistic,
  } = useLeadActivity(lead?.id || null);
  
  // Email composer state
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [composerSubject, setComposerSubject] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedFollowUpTask, setSelectedFollowUpTask] = useState<Task | null>(null);

  // Supplier quote request state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [quoteDeadlineDays, setQuoteDeadlineDays] = useState("7");
  const [quoteNotes, setQuoteNotes] = useState("");

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

  // Quote lines state
  const [quoteLines, setQuoteLines] = useState<any[]>([]);

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
  const [projectInstallationStartDate, setProjectInstallationStartDate] = useState<string>("");
  const [projectInstallationEndDate, setProjectInstallationEndDate] = useState<string>("");
  const [projectValueGBP, setProjectValueGBP] = useState<string>("");
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [opportunityStage, setOpportunityStage] = useState<string | null>(null);

  const lastSavedServerStatusRef = useRef<string | null>(null);

  // Email preview state
  const [emailPreview, setEmailPreview] = useState<{
    isOpen: boolean;
    subject: string;
    body: string;
    to: string;
    recipientName?: string;
    action: 'accept' | 'decline' | null;
    taskId: string | null;
  }>({
    isOpen: false,
    subject: '',
    body: '',
    to: '',
    action: null,
    taskId: null,
  });

  // Handler for sending email after preview
  const handleEmailPreviewSend = async (editedSubject: string, editedBody: string) => {
    if (!emailPreview.taskId || !emailPreview.action) {
      toast("Unable to send email: missing task information");
      return;
    }

    try {
      const endpoint = emailPreview.action === 'accept' 
        ? `/tasks/${emailPreview.taskId}/actions/accept-enquiry`
        : `/tasks/${emailPreview.taskId}/actions/decline-enquiry`;

      await apiFetch(endpoint, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          customSubject: editedSubject,
          customBody: editedBody,
        }),
      });

      toast("Email sent successfully");
      setEmailPreview(prev => ({ ...prev, isOpen: false }));
      await refreshActivity();
    } catch (error) {
      console.error("Error sending email:", error);
      toast("Failed to send email");
    }
  };

  // Load ML estimate for this lead
  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch(`${API_BASE}/estimates/${encodeURIComponent(lead?.id || '')}`, {
          headers: authHeaders,
        });
        setMlEstimate(data);
      } catch {}
    };
    if (lead?.id) load();
  }, [lead?.id, authHeaders]);

  const amendItemTotal = (index: number, newTotal: number) => {
    setMlEstimate((prev: any) => {
      if (!prev) return prev;
      const items = (prev.items || []).slice();
      const item = { ...(items[index] || {}) };
      const net = Number(newTotal) / 1.2;
      const vat = Number(newTotal) - net;
      item.totalGBP = Number(newTotal);
      item.netGBP = net;
      item.vatGBP = vat;
      items[index] = item;
      const totals = items.reduce((acc: any, it: any) => {
        acc.net += Number(it.netGBP || 0);
        acc.vat += Number(it.vatGBP || 0);
        acc.gross += Number(it.totalGBP || 0);
        return acc;
      }, { net: 0, vat: 0, gross: 0 });
      return { ...prev, items, totalNet: totals.net, totalVat: totals.vat, totalGross: totals.gross };
    });
  };

  const saveAmendedEstimate = async () => {
    try {
      await apiFetch(`${API_BASE}/estimates/${encodeURIComponent(lead?.id || '')}/update`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ estimate: mlEstimate, tenant: settings?.slug }),
      });
      setIsAmendingEstimate(false);
      // Optionally refresh
    } catch {}
  };

  const confirmMlEstimate = async () => {
    try {
      await apiFetch(`${API_BASE}/estimates/${encodeURIComponent(lead?.id || '')}/confirm`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ estimate: mlEstimate, tenant: settings?.slug }),
      });
      // Notify success, could show toast
      alert('Estimate confirmed and sent to client!');
    } catch (err) {
      console.error('Failed to confirm estimate:', err);
      alert('Failed to confirm estimate. Please try again.');
    }
  };

  const reloadMlEstimate = async () => {
    try {
      const data = await apiFetch(`${API_BASE}/estimates/${encodeURIComponent(lead?.id || '')}`, {
        headers: authHeaders,
      });
      setMlEstimate(data);
    } catch {}
  };

  const playbook = useMemo(
    () => normalizeTaskPlaybook(settings?.taskPlaybook ?? DEFAULT_TASK_PLAYBOOK),
    [settings?.taskPlaybook]
  );

  // Navigation stages configuration
  const stages = [
    {
      id: 'client' as const,
      title: 'Client details',
      icon: '�',
      description: 'Contact info and project details'
    },
    {
      id: 'quote' as const,
      title: 'Quote Details',
      icon: '�',
      description: 'Questionnaire and quote information'
    },
    {
      id: 'tasks' as const,
      title: 'Tasks & Follow-ups',
      icon: '✨',
      description: 'AI-powered follow-ups, communication & activity timeline'
    },
    {
      id: 'order' as const,
      title: 'Order',
      icon: '🛠️',
      description: 'Workshop processes and materials'
    }
  ];


  // Load suppliers when modal opens
  useEffect(() => {
    if (!open) return;
    async function loadSuppliers() {
      try {
        const data = await apiFetch<any[]>("/suppliers", { headers: authHeaders });
        setSuppliers(data || []);
      } catch (err) {
        console.error("Failed to load suppliers:", err);
      }
    }
    loadSuppliers();
  }, [open, authHeaders]);

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
        capturedAt: (leadPreview as any).capturedAt ?? null,
        computed: leadPreview.computed ?? null,
        communicationLog: (leadPreview.custom?.communicationLog || []) as Lead['communicationLog'],
      };

      setNumberInput(normalized.number ?? "");
      setNameInput(normalized.contactName ?? "");
      setEmailInput(normalized.email ?? "");
      setPhoneInput(normalized.phone ?? "");
      setAddressInput(normalized.address ?? "");
      setDeliveryAddressInput(normalized.deliveryAddress ?? "");
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
          console.debug('[LeadModal] treating leadPreview.id as a leadId', probeErr);
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
          capturedAt: row.capturedAt ?? null,
          computed: row.computed ?? null,
          communicationLog: (row.custom?.communicationLog || []) as Lead['communicationLog'],
          clientId: (row as any)?.clientId ?? null,
        };
        setLead(normalized);
        setUiStatus(sUi);

        // If lead has a client, fetch client data including type
        if ((row as any)?.clientId) {
          try {
            const clientData = await apiFetch<any>(`/clients/${(row as any).clientId}`, { headers: authHeaders });
            if (clientData) {
              setCurrentClientData(clientData);
              setClientType(clientData.type || "public");
            }
          } catch (err) {
            console.error("Failed to fetch client data:", err);
          }
        }

        // seed inputs
        setNumberInput((row as any)?.number || "");
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
          // Load unified questionnaire fields by scope when tenant slug is available
          try {
            const slug = (s as any)?.slug || null;
            const isFireDoor = Boolean((s as any)?.isFireDoorManufacturer);
            if (slug) {
              // Conditionally fetch fire door fields only if tenant is fire door manufacturer
              const fetchPromises = [
                fetchQuestionnaireFields({ tenantSlug: slug, scope: "project_details" }).catch(() => []),
                // Back-compat: some tenants still store item fields under legacy scope "item"
                fetchQuestionnaireFields({ tenantSlug: slug, scope: "item" }).catch(() => []),
                fetchQuestionnaireFields({ tenantSlug: slug, scope: "manufacturing" }).catch(() => []),
                fetchQuestionnaireFields({ tenantSlug: slug, scope: "public" }).catch(() => []),
              ];
              
              if (isFireDoor) {
                fetchPromises.push(
                  fetchQuestionnaireFields({ tenantSlug: slug, scope: "fire_door_schedule" }).catch(() => []),
                  fetchQuestionnaireFields({ tenantSlug: slug, scope: "fire_door_line_items" }).catch(() => [])
                );
              }
              
              const results = await Promise.all(fetchPromises);
              const [projectDetails, itemFields, manuf, pub, fireDoorSched, fireDoorItems] = isFireDoor 
                ? results 
                : [...results, [], []];
              const projectDetailsMerged = [...(projectDetails || []), ...(itemFields || [])]
                .filter(Boolean)
                .reduce((acc: any[], field: any) => {
                  const exists = acc.find((f) => f.id === field.id || f.key === field.key);
                  if (!exists) acc.push(field);
                  return acc;
                }, []);

              // Client fields are now managed separately via Client table
              setClientFields([]);
              // Project details contains all lead/quote-specific fields (was internal + quote_details)
              setQuoteDetailsFields((projectDetailsMerged || []).map(f => ({ ...f, type: String(f.type), options: f.options || [], askInQuestionnaire: false, showOnLead: true, internalOnly: true, sortOrder: f.sortOrder || 0, productTypes: Array.isArray(f.productTypes) ? f.productTypes : undefined })) as NormalizedQuestionnaireField[]);
              console.log('[LeadModal] Loaded fields:', {
                projectDetails: projectDetailsMerged?.length || 0,
                hasProductTypes: (projectDetailsMerged || []).some((f: any) => f.productTypes?.length > 0)
              });
              setManufacturingFields((manuf || []).map(f => ({ ...f, type: String(f.type), options: f.options || [], askInQuestionnaire: false, showOnLead: true, visibleAfterOrder: true, sortOrder: f.sortOrder || 0 })) as NormalizedQuestionnaireField[]);
              setFireDoorScheduleFields((fireDoorSched || []).map(f => ({ ...f, type: String(f.type), options: f.options || [], askInQuestionnaire: false, showOnLead: true, sortOrder: f.sortOrder || 0 })) as NormalizedQuestionnaireField[]);
              setFireDoorLineItemsFields((fireDoorItems || []).map(f => ({ ...f, type: String(f.type), options: f.options || [], askInQuestionnaire: false, showOnLead: true, sortOrder: f.sortOrder || 0 })) as NormalizedQuestionnaireField[]);
              setPublicFields((pub || []).map(f => ({ ...f, type: String(f.type), options: f.options || [], askInQuestionnaire: true, showOnLead: true, sortOrder: f.sortOrder || 0 })) as NormalizedQuestionnaireField[]);
              // Internal fields set now references project_details (same data, different name)
              setInternalFields((projectDetailsMerged || []).map(f => ({ ...f, type: String(f.type), options: f.options || [], askInQuestionnaire: false, showOnLead: true, internalOnly: true, sortOrder: f.sortOrder || 0 })) as NormalizedQuestionnaireField[]);
              
              // Fetch product types for dropdown
              try {
                const types = await apiFetch<any[]>(`/product-types`, { headers: authHeaders }).catch(() => []);
                if (Array.isArray(types)) {
                  setProductTypes(types);
                }
              } catch (e) {
                console.debug("[LeadModal] failed loading product types", e);
              }
            }
          } catch (e) {
            console.debug("[LeadModal] failed loading scoped fields", e);
          }
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
          console.debug('[LeadModal] lead.id is not an opportunityId, treating as leadId', probeErr);
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
          // Store opportunity stage for conditional labeling
          if (opp.stage) {
            setOpportunityStage(opp.stage);
          }
          // Format dates for date input (YYYY-MM-DD)
          const formatDateForInput = (dateStr: any) => {
            if (!dateStr) return null;
            try {
              const date = new Date(dateStr);
              return date.toISOString().split('T')[0];
            } catch {
              return null;
            }
          };
          setMaterialDates({
            timberOrderedAt: formatDateForInput(opp.timberOrderedAt),
            timberExpectedAt: formatDateForInput(opp.timberExpectedAt),
            timberReceivedAt: formatDateForInput(opp.timberReceivedAt),
            timberNotApplicable: opp.timberNotApplicable || false,
            glassOrderedAt: formatDateForInput(opp.glassOrderedAt),
            glassExpectedAt: formatDateForInput(opp.glassExpectedAt),
            glassReceivedAt: formatDateForInput(opp.glassReceivedAt),
            glassNotApplicable: opp.glassNotApplicable || false,
            ironmongeryOrderedAt: formatDateForInput(opp.ironmongeryOrderedAt),
            ironmongeryExpectedAt: formatDateForInput(opp.ironmongeryExpectedAt),
            ironmongeryReceivedAt: formatDateForInput(opp.ironmongeryReceivedAt),
            ironmongeryNotApplicable: opp.ironmongeryNotApplicable || false,
            paintOrderedAt: formatDateForInput(opp.paintOrderedAt),
            paintExpectedAt: formatDateForInput(opp.paintExpectedAt),
            paintReceivedAt: formatDateForInput(opp.paintReceivedAt),
            paintNotApplicable: opp.paintNotApplicable || false,
          });
          setProjectStartDate(formatDateForInput(opp.startDate) || "");
          setProjectDeliveryDate(formatDateForInput(opp.deliveryDate) || "");
          setProjectInstallationStartDate(formatDateForInput(opp.installationStartDate) || "");
          setProjectInstallationEndDate(formatDateForInput(opp.installationEndDate) || "");
          setProjectValueGBP(opp.valueGBP ? String(opp.valueGBP) : "");
        }
      } catch (err) {
        console.error('[LeadModal] workshop loader error:', err);
      } finally {
        if (!cancelled) setWkLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, lead?.id, uiStatus, authHeaders, opportunityId]);

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
  alert(`Could not assign user to process: ${message}\n\nOpportunity ID: ${lead?.id ?? 'unknown'}\nPlease check your connection and try again.`);
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
    if (!projectId) {
      console.warn('[saveMaterialDates] No projectId, aborting');
      return;
    }
    setMaterialSaving(true);
    console.log('[saveMaterialDates] Saving to project:', projectId, 'data:', materialDates);
    try {
      const response = await apiFetch(`/workshop/project/${encodeURIComponent(projectId)}/materials`, {
        method: "PATCH",
        json: materialDates,
      });
      console.log('[saveMaterialDates] Save successful:', response);
    } catch (e: any) {
      console.error("[saveMaterialDates] Error:", e);
      alert("Could not save material dates. Please try again.");
    } finally {
      setMaterialSaving(false);
    }
  }

  const saveOpportunityField = async (field: string, value: any) => {
    let id = opportunityId || null;
    if (!id) {
      id = await ensureOpportunity();
    }
    console.log('[saveOpportunityField] called with:', { field, value, opportunityId, leadId: lead?.id, resolvedId: id, idType: typeof id });
    if (!id) {
      console.warn('[saveOpportunityField] no id resolved, aborting');
      alert(`Could not save ${field}: No opportunity ID found.`);
      return;
    }
    
    const url = `/opportunities/${encodeURIComponent(id)}`;
    console.log('[saveOpportunityField] will PATCH to:', url, 'with payload:', { [field]: value });
    
    try {
      const payload: any = {};
      payload[field] = value;
      
      const result = await apiFetch(url, {
        method: "PATCH",
        headers: authHeaders,
        json: payload,
      });
      
      console.log('[saveOpportunityField] success:', result);
      console.log('[saveOpportunityField] returned opportunity:', (result as any)?.opportunity);
      console.log('[saveOpportunityField] ALL opportunity dates from server:', {
        startDate: (result as any)?.opportunity?.startDate,
        deliveryDate: (result as any)?.opportunity?.deliveryDate,
        installationStartDate: (result as any)?.opportunity?.installationStartDate,
        installationEndDate: (result as any)?.opportunity?.installationEndDate,
      });
      
      // Update local state if successful
      if ((result as any)?.opportunity) {
        const opp = (result as any).opportunity;
        setOpportunityId(opp.id);
        
        // Sync returned date values back to state
        const formatDateForInput = (dateStr: any) => {
          if (!dateStr) return "";
          try {
            return new Date(dateStr).toISOString().split('T')[0];
          } catch {
            return "";
          }
        };
        
        // Always sync back ALL date fields from server response (even if saving a different field)
        // This ensures UI stays in sync with database
        if ('startDate' in opp) {
          const formatted = formatDateForInput(opp.startDate);
          console.log('[saveOpportunityField] syncing startDate:', opp.startDate, '->', formatted);
          setProjectStartDate(formatted);
        }
        if ('deliveryDate' in opp) {
          const formatted = formatDateForInput(opp.deliveryDate);
          console.log('[saveOpportunityField] syncing deliveryDate:', opp.deliveryDate, '->', formatted);
          setProjectDeliveryDate(formatted);
        }
        if ('installationStartDate' in opp) {
          const formatted = formatDateForInput(opp.installationStartDate);
          console.log('[saveOpportunityField] syncing installationStartDate:', opp.installationStartDate, '->', formatted);
          setProjectInstallationStartDate(formatted);
        }
        if ('installationEndDate' in opp) {
          const formatted = formatDateForInput(opp.installationEndDate);
          console.log('[saveOpportunityField] syncing installationEndDate:', opp.installationEndDate, '->', formatted);
          setProjectInstallationEndDate(formatted);
        }
      }
    } catch (e: any) {
      console.error(`[saveOpportunityField] Failed to save ${field}:`, e);
      alert(`Could not save ${field}. Error: ${e.message || 'Please try again.'}`);
    }
  };

  // Reset to initial stage when modal opens or lead changes (but not during navigation)
  useEffect(() => {
    if (open && leadPreview?.id) {
      setCurrentStage(initialStage);
    }
  }, [open, leadPreview?.id, initialStage]);

  // Load follow-up tasks when communication tab is opened
  // Note: Inline the logic to avoid referencing a not-yet-initialized callback
  // which can trigger a Temporal Dead Zone error during render.
  // Activity data now loaded by useLeadActivity hook

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
            capturedAt: row.capturedAt ?? null,
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
        capturedAt: (() => {
          const coerce = (val: any): string | null => {
            if (val === undefined || val === null || val === "") return null;
            if (val instanceof Date) return val.toISOString();
            if (typeof val === "string") return val;
            return String(val);
          };
          return coerce(row.capturedAt) ?? base.capturedAt ?? null;
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
          if (Object.prototype.hasOwnProperty.call(patch, "number")) {
            next.number = patch.number ?? null;
          }
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

  // Load quote lines when lead or quoteId changes
  useEffect(() => {
    if (lead?.quoteId) {
      loadQuoteLines();
    } else {
      setQuoteLines([]);
    }
  }, [lead?.quoteId]);

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
      await refreshActivity();
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
      await refreshActivity();
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
      await refreshActivity();
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
      await refreshActivity();
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

  // Get all tasks from unified activities
  const allTasks = activities.filter(event => event.type === 'task');
  
  const pendingTasks = allTasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED");
  const completedTasks = allTasks.filter(t => t.status === "DONE" || t.status === "CANCELLED");

  // Legacy - keep for backward compatibility
  const pendingFollowUpTasks = activities.filter(event => 
    event.type === 'task' &&
    event.status !== "DONE" && 
    event.meta?.type && 
    ["email_followup", "phone_followup"].includes(event.meta.type)
  );

  const completedFollowUpTasks = activities.filter(event =>
    event.type === 'task' &&
    event.status === "DONE" &&
    event.meta?.type &&
    ["email_followup", "phone_followup"].includes(event.meta.type)
  );

  /* ----------------------------- Actions ----------------------------- */

  async function sendQuestionnaire() {
    if (!lead?.id) return;
    setBusyTask(true);
    try {
      // Delegate to backend to send an invite email with signed token + link
      const resp = await apiFetch<{ ok: boolean; url: string }>(`/leads/${encodeURIComponent(lead.id)}/request-info`, {
        method: "POST",
        headers: authHeaders,
      });

      // Move to Info Requested locally as well
      setUiStatus("INFO_REQUESTED");
      await reloadTasks();
      toast("Questionnaire invite sent");
    } catch (e) {
      console.error("send questionnaire failed", e);
      toast("Failed to send questionnaire invite");
    } finally {
      setBusyTask(false);
    }
  }

  async function copyInviteLink() {
    if (!lead?.id) return;
    setBusyTask(true);
    try {
      const resp = await apiFetch<{ ok: boolean; url: string }>(`/leads/${encodeURIComponent(lead.id)}/request-info`, {
        method: "POST",
        headers: authHeaders,
      });
      const url = (resp as any)?.url || "";
      if (url) {
        await navigator.clipboard.writeText(url);
        toast("Invite link copied to clipboard");
      } else {
        toast("Failed to get invite link");
      }
    } catch (e) {
      console.error("copy invite link failed", e);
      toast("Failed to copy invite link");
    } finally {
      setBusyTask(false);
    }
  }

  // Open the public estimator (lead magnet) for this lead in a new tab.
  // For now it shares the /q/:tenant/:lead route used by the legacy questionnaire.
  // Later we may split paths or add mode parameters; keeping simple for initial dual-mode.
  function openEstimator() {
    if (!lead?.id || !settings?.slug) return;
    const url = `${window.location.origin}/tenant/${settings.slug}/estimate`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function requestSupplierPrice() {
    if (!lead?.id) return;
    // Show the supplier selection modal
    setSelectedSupplierId("");
    setQuoteDeadlineDays("7");
    setQuoteNotes("");
    setShowSupplierModal(true);
  }

  async function submitSupplierQuoteRequest() {
    if (!lead?.id) return;
    
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier) {
      toast("Please select a supplier");
      return;
    }

    setBusyTask(true);
    setShowSupplierModal(false);
    
    try {
      await ensureManualTask("supplier_followup");

      const to = supplier.email || "";
      const days = parseInt(quoteDeadlineDays) || 7;
      const quoteDeadline = new Date();
      quoteDeadline.setDate(quoteDeadline.getDate() + days);

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

      // Create SupplierQuoteRequest record
      try {
        await apiFetch("/supplier-quote-requests", {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          json: {
            supplierId: selectedSupplierId,
            leadId: lead.id,
            opportunityId: null, // Can be linked later if needed
            notes: quoteNotes || `Requested via lead ${lead.contactName || lead.id}. Deadline: ${quoteDeadline.toLocaleDateString()}`,
          },
        });
      } catch (err) {
        console.error("Failed to create supplier quote request record:", err);
      }

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

  // Create a product line on the underlying Quote and attach standard fields
  // Callbacks for UnifiedQuoteLineItems
  async function handleAddQuoteLine(newLine: {
    description: string;
    qty: number | null;
    unitPrice?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
    timber?: string;
    finish?: string;
    ironmongery?: string;
    glazing?: string;
  }) {
    if (!lead?.id) return;
    setSaving(true);
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
        if (qid) {
          setLead((prev) => (prev ? { ...prev, quoteId: qid } : prev));
        }
      }
      if (!qid) throw new Error("Couldn't create a draft quote.");

      // Create the line
      const created = await createQuoteLine(qid, {
        description: newLine.description,
        quantity: newLine.qty ?? 1,
        unitPrice: newLine.unitPrice ?? 0,
      });
      const lineId = (created as any)?.line?.id;
      if (!lineId) throw new Error("Line was not created");

      // Attach standard fields to the line
      const lineStandard: Record<string, any> = {};
      if (newLine.widthMm != null) lineStandard.widthMm = newLine.widthMm;
      if (newLine.heightMm != null) lineStandard.heightMm = newLine.heightMm;
      if (newLine.timber) lineStandard.timber = newLine.timber;
      if (newLine.finish) lineStandard.finish = newLine.finish;
      if (newLine.ironmongery) lineStandard.ironmongery = newLine.ironmongery;
      if (newLine.glazing) lineStandard.glazing = newLine.glazing;
      if (Object.keys(lineStandard).length > 0) {
        await updateQuoteLine(qid, lineId, { lineStandard });
      }

      toast("Line added to quote");
      await loadQuoteLines();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to add line");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateQuoteLine(lineId: string, updates: any) {
    if (!lead?.quoteId) return;
    setSaving(true);
    try {
      // Transform flat updates to nested lineStandard
      const lineStandardFields = ['widthMm', 'heightMm', 'timber', 'finish', 'ironmongery', 'glazing'];
      const lineStandard: any = {};
      const directUpdates: any = {};
      
      Object.entries(updates).forEach(([key, value]) => {
        if (lineStandardFields.includes(key)) {
          lineStandard[key] = value;
        } else {
          directUpdates[key] = value;
        }
      });
      
      const payload: any = { ...directUpdates };
      if (Object.keys(lineStandard).length > 0) {
        payload.lineStandard = lineStandard;
      }
      
      await updateQuoteLine(lead.quoteId, lineId, payload);
      toast("Line updated");
      await loadQuoteLines();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to update line");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuoteLine(lineId: string) {
    if (!lead?.quoteId) return;
    setSaving(true);
    try {
      await apiFetch(`/quotes/${encodeURIComponent(lead.quoteId)}/lines/${encodeURIComponent(lineId)}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      toast("Line deleted");
      await loadQuoteLines();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to delete line");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(file: File, lineId?: string) {
    if (!lead?.quoteId) return;
    setSaving(true);
    try {
      // For now, just log - in a real implementation you'd upload the file
      // and trigger AI analysis on the photo
      console.log('Photo uploaded for line:', lineId, file.name);
      toast("Photo uploaded - AI analysis would start here");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to upload photo");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview3d(lineId?: string) {
    // Navigate to full quote builder for 3D preview
    if (!lead?.quoteId) return;
    window.open(`/quotes/${lead.quoteId}?tab=product-config`, '_blank');
  }

  async function loadQuoteLines() {
    if (!lead?.quoteId) {
      setQuoteLines([]);
      return;
    }
    try {
      const data = await apiFetch<any>(`/quotes/${encodeURIComponent(lead.quoteId)}/lines`, {
        headers: authHeaders,
      });
      setQuoteLines(data?.lines || []);
    } catch (e) {
      console.error("Failed to load quote lines:", e);
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
  const emailAttachments = useMemo(() => {
    const attachments = get(lead?.custom, "attachments");
    return Array.isArray(attachments) ? attachments : [];
  }, [lead?.custom]);
  const questionnaireFields = useMemo(
    () => normalizeQuestionnaireFields(settings?.questionnaire ?? null),
    [settings?.questionnaire]
  );
  
  // Extract selected product types from quote lines (currently unavailable; placeholder to avoid runtime errors)
  const selectedProductTypes: string[] = [];
  
  const baseWorkspaceFields = useMemo(
    () =>
      questionnaireFields.filter((field) => {
        if (!field.showOnLead) return false;
        if (field.visibleAfterOrder) {
          return uiStatus === "WON";
        }
        
        // Filter by product types if field has productTypes specified
        if (field.productTypes && field.productTypes.length > 0) {
          // Only show this field if at least one selected product type matches
          if (selectedProductTypes.length === 0) {
            // No products selected yet, hide fields with specific product type requirements
            return false;
          }
          // Check if any selected product type matches the field's product types
          const hasMatch = field.productTypes.some((pt) => selectedProductTypes.includes(pt));
          if (!hasMatch) return false;
        }
        // If field has no productTypes, show it for all products
        
        return true;
      }),
    [questionnaireFields, uiStatus]
  );
  const workspaceFields = useMemo(() => {
    const existingKeys = new Set(baseWorkspaceFields.map((field) => field.key));
    const extras: NormalizedQuestionnaireField[] = [];
    if (!existingKeys.has("enquiryDate")) {
      extras.push({
        id: "__enquiryDate",
        key: "enquiryDate",
        label: "Enquiry Date",
        required: false,
        type: "date",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        internalOnly: true,
        sortOrder: Number.MAX_SAFE_INTEGER - 5,
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
        showOnLead: false,
        internalOnly: true,
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
        label: "Completion Date",
        required: false,
        type: "date",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        visibleAfterOrder: true,
        sortOrder: Number.MAX_SAFE_INTEGER + 2,
      });
    }
    if (!existingKeys.has("installationStartDate")) {
      extras.push({
        id: "__installationStartDate",
        key: "installationStartDate",
        label: "Installation Start Date",
        required: false,
        type: "date",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        visibleAfterOrder: true,
        sortOrder: Number.MAX_SAFE_INTEGER + 3,
      });
    }
    if (!existingKeys.has("installationEndDate")) {
      extras.push({
        id: "__installationEndDate",
        key: "installationEndDate",
        label: "Installation End Date",
        required: false,
        type: "date",
        options: [],
        askInQuestionnaire: false,
        showOnLead: true,
        visibleAfterOrder: true,
        sortOrder: Number.MAX_SAFE_INTEGER + 4,
      });
    }
    return [...baseWorkspaceFields, ...extras];
  }, [baseWorkspaceFields]);
  const customData = useMemo(() => {
    const computed = lead?.computed && typeof lead.computed === "object" ? (lead.computed as Record<string, any>) : {};
    const result = lead?.custom && typeof lead.custom === "object" ? { ...(lead.custom as Record<string, any>), ...computed } : { ...computed };
    
    // Include capturedAt (enquiry date) from the lead if available
    if (lead?.capturedAt && !result.enquiryDate) {
      result.enquiryDate = lead.capturedAt;
    }
    
    return result;
  }, [lead?.custom, lead?.computed, lead?.capturedAt]);
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
  const visionGroups = useMemo<VisionInferenceGroup[]>(() => {
    if (!lead || !Array.isArray(lead.visionInferences) || !lead.visionInferences.length) {
      return [];
    }
    const list = lead.visionInferences;
    const map = new Map<string, VisionInferenceGroup>();
    list.forEach((entry) => {
      if (!entry) return;
      const key = entry.itemNumber != null ? String(entry.itemNumber) : "general";
      if (!map.has(key)) {
        map.set(key, { key, itemNumber: entry.itemNumber ?? null, extras: [] });
      }
      const group = map.get(key)!;
      if (entry.source === "MEASUREMENT" && !group.measurement) {
        group.measurement = entry;
      } else if (entry.source === "INSPIRATION" && !group.inspiration) {
        group.inspiration = entry;
      } else {
        group.extras.push(entry);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const aVal = a.itemNumber ?? Number.MAX_SAFE_INTEGER;
      const bVal = b.itemNumber ?? Number.MAX_SAFE_INTEGER;
      return aVal - bVal;
    });
  }, [lead]);
  const openTasks = tasks.filter(t => t.status !== "DONE");
/* ----------------------------- Render ----------------------------- */

   /* ----------------------------- Render ----------------------------- */

  if (!open || !lead) return null;

  const openCount = openTasks.length;
  const completedCount = tasks.length - openCount;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const _StatusBadge = ({ status }: { status: Lead["status"] }) => (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${
        status === "NEW_ENQUIRY"
          ? "bg-blue-100 text-blue-800"
          : status === "INFO_REQUESTED"
          ? "bg-yellow-100 text-yellow-800"
          : status === "READY_TO_QUOTE"
          ? "bg-green-100 text-green-800"
          : status === "QUOTE_SENT"
          ? "bg-purple-100 text-purple-800"
          : status === "WON"
          ? "bg-emerald-100 text-emerald-800"
          : status === "LOST"
          ? "bg-red-100 text-red-800"
          : status === "REJECTED"
          ? "bg-gray-100 text-gray-800"
          : "bg-gray-100 text-gray-800"
      }`}
    >
      {STATUS_LABELS[status]}
    </span>
  );

  const _formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Unknown";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-gradient-to-br from-sky-500/30 via-indigo-700/20 to-rose-500/30 backdrop-blur flex items-center justify-center px-3 py-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div className="relative flex h-[min(88vh,calc(100vh-3rem))] w-[min(1000px,92vw)] max-h-[88vh] flex-col overflow-hidden rounded-3xl border border-white/30 bg-white/85 shadow-[0_32px_70px_-35px_rgba(30,64,175,0.45)] backdrop-blur-xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -left-10 h-52 w-52 rounded-full bg-sky-200/60 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-rose-200/60 blur-3xl"
        />

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

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Status</label>
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
          </div>

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

          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || loading}>
            Close
          </Button>
        </div>

        {/* Stage Navigation */}
        <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1 mx-6 mt-4">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setCurrentStage(stage.id)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                currentStage === stage.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
              title={stage.description}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{stage.icon}</span>
                <span className="hidden sm:inline">{stage.title}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-sky-100/60 bg-gradient-to-r from-sky-50 via-indigo-50 to-amber-50 text-slate-700">
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
            onClick={copyInviteLink}
            disabled={busyTask || saving}
            title="Copy the invite link to your clipboard"
          >
            <span aria-hidden="true">🔗</span>
            Copy Invite Link
          </Button>

          <Button
            variant="outline"
            onClick={openEstimator}
            disabled={busyTask || saving}
            title="Open the public estimator workflow (lead magnet view)"
          >
            <span aria-hidden="true">🧮</span>
            Open Estimator
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
          {/* CLIENT STAGE */}
          {currentStage === "client" && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-sky-50/70 to-rose-50/60 min-h-[60vh]">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Original Email - shown for enquiries */}
                {(emailSubject || emailSnippet || fromEmail) && (
                  <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span aria-hidden="true">💌</span>
                      Original Enquiry
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
                      {emailSnippet && (
                        <div className="mt-2 text-slate-600 whitespace-pre-wrap">{emailSnippet}</div>
                      )}
                      {emailAttachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                            Attachments ({emailAttachments.length})
                          </div>
                          <ul className="space-y-1.5">
                            {emailAttachments.map((att: any, idx: number) => {
                              const messageId = get(lead?.custom, "messageId");
                              const jwt = typeof window !== "undefined" ? localStorage.getItem("jwt") : null;
                              const attachmentUrl = messageId && att.attachmentId && jwt
                                ? `${API_BASE}/gmail/message/${messageId}/attachments/${att.attachmentId}?jwt=${jwt}`
                                : null;
                              
                              return (
                                <li key={idx} className="flex items-center gap-2 text-sm">
                                  {attachmentUrl ? (
                                    <a
                                      href={attachmentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-700 hover:underline"
                                    >
                                      <span aria-hidden="true">📎</span>
                                      {att.filename}
                                      {typeof att.size === "number" && (
                                        <span className="text-xs text-slate-500">
                                          ({Math.round(att.size / 1024)} KB)
                                        </span>
                                      )}
                                    </a>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                                      <span aria-hidden="true">📎</span>
                                      {att.filename}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client details */}
                  <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                      <span aria-hidden="true">👤</span>
                      Client Details
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-sm">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            Name
                          </span>
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
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            Email
                          </span>
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
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          Phone
                        </span>
                        <input
                          type="tel"
                          className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          onBlur={async () => {
                            setLead((l) => (l ? { ...l, phone: phoneInput || null } : l));
                            await savePatch({ phone: phoneInput || null });
                            // Also update client if linked
                            if (lead?.clientId && phoneInput) {
                              try {
                                await apiFetch(`/clients/${lead.clientId}`, {
                                  method: "PATCH",
                                  json: { phone: phoneInput },
                                });
                              } catch (error) {
                                console.error("Failed to sync phone to client:", error);
                              }
                            }
                          }}
                          placeholder="Phone number"
                        />
                      </label>

                      <label className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          Address
                        </span>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                          value={addressInput}
                          onChange={(e) => setAddressInput(e.target.value)}
                          onBlur={async () => {
                            setLead((l) => (l ? { ...l, address: addressInput || null } : l));
                            await savePatch({ address: addressInput || null });
                            // Also update client if linked
                            if (lead?.clientId && addressInput) {
                              try {
                                await apiFetch(`/clients/${lead.clientId}`, {
                                  method: "PATCH",
                                  json: { address: addressInput },
                                });
                              } catch (error) {
                                console.error("Failed to sync address to client:", error);
                              }
                            }
                          }}
                          placeholder="Client address"
                        />
                      </label>

                      {/* Client Linking */}
                      <div className="col-span-full">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                          Client
                        </span>
                        <ClientSelector
                          currentClientId={lead?.clientId}
                          contactEmail={lead?.email}
                          contactName={lead?.contactName}
                          onSelect={async (clientId) => {
                            // Fetch client details to auto-fill lead fields
                            try {
                              const client = await apiFetch<any>(`/clients/${clientId}`, { headers: authHeaders });
                              if (client) {
                                // Store client data and type
                                setCurrentClientData(client);
                                setClientType(client.type || "public");

                                // Map common address fields from client -> lead custom
                                const addressFields: Record<string, string | null | undefined> = {
                                  address: client.address,
                                  addressLine1: client.addressLine1 || client.address,
                                  addressLine2: client.addressLine2,
                                  street: client.street,
                                  city: client.city,
                                  town: client.town,
                                  postcode: client.postcode || client.postalCode || client.zipcode,
                                  zipcode: client.zipcode || client.postcode || client.postalCode,
                                };

                                // Auto-fill name/email/phone/address directly from client (always, to keep them linked)
                                const updates: any = {
                                  clientId,
                                  contactName: client.name || nameInput || null,
                                  email: client.email || emailInput || null,
                                  phone: client.phone || phoneInput || null,
                                  address: client.address || addressInput || null,
                                };

                                setNameInput(updates.contactName || "");
                                setEmailInput(updates.email || "");
                                setPhoneInput(updates.phone || "");
                                setAddressInput(updates.address || "");

                                // Merge address data into customDraft; only fill missing keys to avoid overwriting user edits
                                let customUpdates = { ...customData };
                                let touchedAddress = false;
                                Object.entries(addressFields).forEach(([key, val]) => {
                                  if (val && !customDraft[key]) {
                                    customUpdates = { ...customUpdates, [key]: val };
                                    touchedAddress = true;
                                  }
                                });
                                if (touchedAddress) {
                                  setCustomDraft((prev) => ({ ...prev, ...customUpdates }));
                                  updates.custom = customUpdates;
                                }

                                setLead((l) => (l ? { ...l, ...updates } : l));
                                await savePatch(updates);
                              } else {
                                setCurrentClientData(null);
                                setClientType("public");
                                setLead((l) => (l ? { ...l, clientId } : l));
                                await savePatch({ clientId });
                              }
                            } catch (error) {
                              console.error('Failed to fetch client details:', error);
                              setCurrentClientData(null);
                              setClientType("public");
                              setLead((l) => (l ? { ...l, clientId } : l));
                              await savePatch({ clientId });
                            }
                          }}
                          onCreateNew={async (data) => {
                            try {
                              const newClient = await apiFetch<{ id: string }>("/clients", {
                                method: "POST",
                                json: {
                                  name: data.name,
                                  email: data.email,
                                  phone: data.phone || phoneInput || null,
                                },
                              });
                              return newClient.id;
                            } catch (error) {
                              console.error("Failed to create client:", error);
                              throw error;
                            }
                          }}
                        />
                      </div>

                      {lead?.clientId && (
                        <label className="text-sm">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            What type of client are they?
                          </span>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                            value={clientType || currentClientData?.type || ""}
                            readOnly
                            placeholder="Client type"
                          />
                        </label>
                      )}

                      {/* Source field - moved to Client Details */}
                      <div className="col-span-full">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                          Source
                        </span>
                        <LeadSourcePicker
                          leadId={lead?.id}
                          value={typeof customData?.source === "string" ? customData.source : null}
                          onSaved={(next) => {
                            const nextStr = next ?? "";
                            setCustomDraft((prev) => ({ ...prev, source: nextStr }));
                            setLead((current) => {
                              if (!current) return current;
                              const prevCustom =
                                current.custom && typeof current.custom === "object"
                                  ? { ...(current.custom as Record<string, any>) }
                                  : {};
                              prevCustom.source = next ?? null;
                              return { ...current, custom: prevCustom };
                            });
                          }}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Project Details */}
                  <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                      <span aria-hidden="true">🗂️</span>
                      Project Details
                    </div>
                    <div className="space-y-4">
                      {/* Enquiry Number */}
                      <label className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          Enquiry Number
                        </span>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                          value={numberInput}
                          onChange={(e) => setNumberInput(e.target.value)}
                          onBlur={() => {
                            setLead((l) => (l ? { ...l, number: numberInput || null } : l));
                            savePatch({ number: numberInput || null });
                          }}
                          placeholder="Enquiry number"
                        />
                      </label>

                      {/* Delivery Address */}
                      <label className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          Delivery Address
                        </span>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                          value={deliveryAddressInput}
                          onChange={(e) => setDeliveryAddressInput(e.target.value)}
                          onBlur={() => {
                            setLead((l) => (l ? { ...l, deliveryAddress: deliveryAddressInput || null } : l));
                            savePatch({ deliveryAddress: deliveryAddressInput || null });
                          }}
                          placeholder="Delivery location (if different from client address)"
                        />
                      </label>

                      {/* Project Description */}
                      <label className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          Project Description
                        </span>
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

                      {/* Workspace fields */}
                      {workspaceFields.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {workspaceFields
                            .filter((field) => {
                              // Filter out address fields, source, notes, and date fields that belong in Order tab
                              const key = field.key.toLowerCase();
                              const labelLc = (field.label || "").toLowerCase();
                              const customOnly = [
                                "clienttype",
                                "what type of client",
                                "jms",
                                "site visit",
                                "follow up",
                                "quoted by",
                                "manufactured",
                                "estimated value",
                                "quoted value",
                              ].some((needle) => key.includes(needle) || labelLc.includes(needle));

                              if (customOnly) return false;
                              return !(
                                key.includes("address") ||
                                key.includes("street") ||
                                key.includes("city") ||
                                key.includes("town") ||
                                key.includes("postcode") ||
                                key.includes("zipcode") ||
                                key.includes("location") ||
                                key === "source" ||
                                key === "notes" ||
                                key === "startdate" ||
                                key === "deliverydate" ||
                                key === "installationstartdate" ||
                                key === "installationenddate"
                              );
                            })
                            .map((field) => {
                          const key = field.key;
                          if (!key) return null;
                          const value = customDraft[key] ?? "";
                          const label = field.label || key;
                          const baseClasses =
                            "w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner focus:outline-none focus:ring-2 focus:ring-sky-200";

                          if (field.type === "textarea") {
                            return (
                              <label key={key} className="text-sm col-span-2">
                                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                  {label}
                                  {field.required && <span className="text-rose-500"> *</span>}
                                </span>
                                <textarea
                                  className={`${baseClasses} min-h-28`}
                                  value={value}
                                  onChange={(e) =>
                                    setCustomDraft((prev) => ({ ...prev, [key]: e.target.value }))
                                  }
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
                                  {field.required && <span className="text-rose-500"> *</span>}
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
                            // Hide enquiryDate and dateQuoteSent as they are auto-set
                            const isAutoSet = key === "enquiryDate" || key === "dateQuoteSent";
                            if (isAutoSet) return null;
                            
                            return (
                              <label key={key} className="text-sm">
                                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                  {label}
                                  {field.required && <span className="text-rose-500"> *</span>}
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
                                {field.required && <span className="text-rose-500"> *</span>}
                              </span>
                              <input
                                type={inputType}
                                className={baseClasses}
                                value={value}
                                onChange={(e) =>
                                  setCustomDraft((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                onBlur={(e) => saveCustomField(field, e.target.value)}
                              />
                            </label>
                          );
                        })}
                        </div>
                      )}

                      {lead?.id && tenantId && (
                        <div className="pt-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            Custom Fields
                          </div>
                          <CustomFieldsPanel
                            entityType="lead"
                            entityId={lead.id}
                            onSave={async () => {
                              if (onUpdated) await onUpdated();
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* QUOTE / QUESTIONNAIRE STAGE */}
          {currentStage === "quote" && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-sky-50/70 to-rose-50/60 min-h-[60vh]">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Quote Line Items - Unified Component */}
                <section className="rounded-2xl border border-indigo-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                    <span aria-hidden="true">📝</span>
                    Quote Line Items
                  </div>

                  <UnifiedQuoteLineItems
                    lines={quoteLines.map((line: any) => ({
                      id: line.id,
                      description: line.description || '',
                      qty: line.qty || 1,
                      widthMm: line.lineStandard?.widthMm,
                      heightMm: line.lineStandard?.heightMm,
                      timber: line.lineStandard?.timber,
                      finish: line.lineStandard?.finish,
                      ironmongery: line.lineStandard?.ironmongery,
                      glazing: line.lineStandard?.glazing,
                      unitPrice: line.unitPrice ?? undefined,
                      sellUnit: line.sellUnit ?? undefined,
                      sellTotal: line.sellTotal ?? undefined,
                      photoUrl: line.lineStandard?.photoDataUri || line.lineStandard?.photoUrl,
                    }))}
                    productCategories={productTypes.length > 0 ? [{ label: 'Products', types: [{ label: 'Types', options: productTypes.map((pt: any) => ({ id: pt.id, label: pt.name })) }] }] : []}
                    currency="GBP"
                    onAddLine={handleAddQuoteLine}
                    onUpdateLine={handleUpdateQuoteLine}
                    onDeleteLine={handleDeleteQuoteLine}
                    onPhotoUpload={handlePhotoUpload}
                    onPreview3d={handlePreview3d}
                  />
                </section>

                {/* Quote Details Fields - only show for fire door manufacturers */}
                {settings?.isFireDoorManufacturer && quoteDetailsFields.length > 0 && (
                  <section className="rounded-2xl border border-indigo-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                      <span aria-hidden="true">📊</span>
                      Quote Details
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {quoteDetailsFields
                        .filter((field) => {
                          // Exclude "What type of client are they?" field
                          const key = field.key?.toLowerCase() || "";
                          const label = field.label?.toLowerCase() || "";
                          if (key.includes("clienttype") || label.includes("what type of client")) {
                            return false;
                          }
                          
                          // Filter by product types if field has productTypes specified
                          if (field.productTypes && field.productTypes.length > 0) {
                            if (selectedProductTypes.length === 0) return false;
                            return field.productTypes.some((pt) => selectedProductTypes.includes(pt));
                          }
                          return true;
                        })
                        .map((field) => {
                        const key = field.key;
                        if (!key) return null;
                        const value = (customData as any)?.[key] ?? "";
                        return (
                          <UnifiedFieldRenderer
                            key={key}
                            field={field as any}
                            value={value}
                            onChange={(val: any) => {
                              const strVal = typeof val === "string" ? val : String(val ?? "");
                              setCustomDraft((prev) => ({ ...prev, [key]: strVal }));
                              saveCustomField(field as any, strVal);
                            }}
                          />
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

                {/* Questionnaire responses moved to Questionnaire tab */}
                {false && (settings?.slug || questionnaireFields.length > 0) && (
                  <>
                  <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span aria-hidden="true">🧾</span>
                      {(Array.isArray(settings?.questionnaire)
                        ? null
                        : (settings?.questionnaire as { title?: string })?.title) || "Questionnaire"}
                    </div>

                    {questionnaireSubmittedAt && (
                      <div className="mt-2 text-xs text-slate-500">
                        Submitted {new Date(questionnaireSubmittedAt || '').toLocaleString()}
                      </div>
                    )}

                    <div className="mt-4 space-y-3">
                      {questionnaireResponses.length ? (
                        <dl className="space-y-3">
                          {questionnaireResponses.map(({ field, value }, idx) => {
                            const k = field.key || field.id || String(idx);
                            const isEditing = !!qEdit[k];
                            const draftVal = customDraft[k] ?? (value ?? "");
                            const inputClasses =
                              "w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200";
                            return (
                              <div
                                key={k}
                                className="rounded-xl border border-slate-200/70 bg-white/70 p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {field.label || field.key || field.id}
                                    {field.required && <span className="text-rose-500"> *</span>}
                                  </dt>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-sky-600 hover:underline"
                                    onClick={() => {
                                      if (isEditing) {
                                        toggleQEdit(k, false);
                                      } else {
                                        if (value !== undefined) {
                                          setCustomDraft((prev) => ({
                                            ...prev,
                                            [k]: value ?? "",
                                          }));
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
                                        onChange={(e) =>
                                          setCustomDraft((prev) => ({
                                            ...prev,
                                            [k]: e.target.value,
                                          }))
                                        }
                                        onBlur={async (e) => {
                                          await saveCustomField(field as any, e.target.value);
                                          toggleQEdit(k, false);
                                        }}
                                      />
                                    ) : (
                                      <input
                                        className={inputClasses}
                                        type={
                                          field.type === "number"
                                            ? "number"
                                            : field.type === "date"
                                            ? "date"
                                            : "text"
                                        }
                                        value={draftVal}
                                        onChange={(e) =>
                                          setCustomDraft((prev) => ({
                                            ...prev,
                                            [k]: e.target.value,
                                          }))
                                        }
                                        onBlur={async (e) => {
                                          await saveCustomField(field as any, e.target.value);
                                          toggleQEdit(k, false);
                                        }}
                                      />
                                    )
                                  ) : (
                                    value ?? (
                                      <span className="text-slate-400">Not provided</span>
                                    )
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

                      {questionnaireUploads.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Attachments
                          </div>
                          <ul className="space-y-2 text-sm">
                            {questionnaireUploads.map((file, idx) => {
                              const dataUrl = `data:${file.mimeType};base64,${file.base64}`;
                              return (
                                <li
                                  key={`${file.filename}-${idx}`}
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <a
                                    href={dataUrl}
                                    download={file.filename}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
                                  >
                                    <span aria-hidden="true">📎</span>
                                    {file.filename}
                                  </a>
                                  {typeof file.sizeKB === "number" && (
                                    <span className="text-xs text-slate-500">
                                      {file.sizeKB.toLocaleString()} KB
                                    </span>
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
                      )}

                      {questionnaireItems.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Items
                          </div>
                          {questionnaireItems.map((it: any, idx: number) => (
                              <div
                                key={idx}
                                className="rounded-xl border border-slate-200/70 bg-white/70 p-3"
                              >
                                <div className="text-sm font-semibold">Item {idx + 1}</div>
                                <div className="mt-2 text-sm text-slate-700 space-y-1">
                                  {Object.keys(it || {}).length === 0 ? (
                                    <div className="text-xs text-slate-400">No details</div>
                                  ) : (
                                    Object.entries(it).map(([k, v]) => {
                                      if (k === "photos" || k === "inspiration_photos") return null;
                                      return (
                                        <div key={k} className="flex items-start gap-2">
                                          <div className="text-xs text-slate-500 w-28">
                                            {String(k)}
                                          </div>
                                          <div className="text-sm text-slate-700 break-words">
                                            {formatAnswer(v) ?? ""}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}

                                  {Array.isArray(it.photos) && it.photos.length > 0 && (
                                    <div className="mt-2">
                                      <div className="text-xs text-slate-500">Photos</div>
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {it.photos.map((p: any, pidx: number) => {
                                          const dataUrl =
                                            p && p.base64
                                              ? `data:${p.mimeType || "image/jpeg"};base64,${
                                                  p.base64
                                                }`
                                              : null;
                                          return (
                                            <a
                                              key={pidx}
                                              href={dataUrl || "#"}
                                              download={p?.filename || `photo-${pidx + 1}`}
                                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
                                            >
                                              <span aria-hidden>📷</span>
                                              {p?.filename || `photo-${pidx + 1}`}
                                            </a>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {Array.isArray(it.inspiration_photos) && it.inspiration_photos.length > 0 && (
                                    <div className="mt-2">
                                      <div className="text-xs text-slate-500">Inspiration photos</div>
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {it.inspiration_photos.map((p: any, pidx: number) => {
                                          const dataUrl =
                                            p && p.base64
                                              ? `data:${p.mimeType || "image/jpeg"};base64,${p.base64}`
                                              : null;
                                          return (
                                            <a
                                              key={`insp-${pidx}`}
                                              href={dataUrl || "#"}
                                              download={p?.filename || `inspiration-${pidx + 1}`}
                                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
                                            >
                                              <span aria-hidden>🎨</span>
                                              {p?.filename || `inspiration-${pidx + 1}`}
                                            </a>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {visionGroups.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <span aria-hidden>✨</span>
                            AI vision insights
                          </div>
                          <div className="space-y-3">
                            {visionGroups.map((group) => {
                              const measurement = group.measurement;
                              const inspiration = group.inspiration;
                              const measurementAttrs = (measurement?.attributes || {}) as Record<string, any>;
                              const inspirationAttrs = (inspiration?.attributes || {}) as Record<string, any>;
                              const measurementRows = [
                                { label: "Product type", value: measurementAttrs.productType },
                                { label: "Opening config", value: measurementAttrs.openingConfig },
                                { label: "Material", value: measurementAttrs.material },
                                { label: "Colour", value: measurementAttrs.colour },
                                { label: "Glazing", value: measurementAttrs.glazingStyle },
                                { label: "Ironmongery", value: measurementAttrs.ironmongeryFinish },
                              ].filter((row) => row.value);
                              const measurementTags = ensureStringArray(measurementAttrs.styleTags);
                              const inspirationTags = ensureStringArray(inspirationAttrs.styleTags);
                              const palette = ensureStringArray(inspirationAttrs.palette);
                              const heroFeatures = ensureStringArray(inspirationAttrs.heroFeatures);
                              const materialCues = ensureStringArray(inspirationAttrs.materialCues);
                              const glazingCues = ensureStringArray(inspirationAttrs.glazingCues);
                              const hardwareCues = ensureStringArray(inspirationAttrs.hardwareCues);
                              const recommendedSpecs = inspirationAttrs.recommendedSpecs;
                              const specPairs = recommendedSpecs
                                ? [
                                    { label: "Timber", value: recommendedSpecs.timber },
                                    { label: "Finish", value: recommendedSpecs.finish },
                                    { label: "Glazing", value: recommendedSpecs.glazing },
                                    { label: "Ironmongery", value: recommendedSpecs.ironmongery },
                                  ].filter((row) => row.value)
                                : [];
                              const confidenceLabel = formatConfidenceLabel(measurement?.confidence);
                              const inspConfidenceLabel = formatConfidenceLabel(inspiration?.confidence);

                              return (
                                <div
                                  key={group.key}
                                  className="space-y-3 rounded-xl border border-indigo-100 bg-white/80 p-4"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                                    <span>{group.itemNumber ? `Item ${group.itemNumber}` : "General"} AI summary</span>
                                    {(measurement?.photoLabel || inspiration?.photoLabel) && (
                                      <span className="text-xs font-medium text-slate-500">
                                        {measurement?.photoLabel || inspiration?.photoLabel}
                                      </span>
                                    )}
                                  </div>

                                  {measurement ? (
                                    <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white/95 p-3">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        Photo measurement
                                      </div>
                                      <div className="text-sm text-slate-800">
                                        {formatDimensionLabel(measurement.widthMm, measurement.heightMm)}
                                      </div>
                                      {confidenceLabel && (
                                        <div className="text-xs text-slate-500">{confidenceLabel}</div>
                                      )}
                                      {measurement.description && (
                                        <p className="text-sm text-slate-700 whitespace-pre-line">
                                          {measurement.description}
                                        </p>
                                      )}
                                      {measurement.notes && (
                                        <p className="text-xs text-slate-500">{measurement.notes}</p>
                                      )}
                                      {measurementRows.length > 0 && (
                                        <div className="grid gap-1 text-xs text-slate-600">
                                          {measurementRows.map((row) => (
                                            <div key={row.label}>
                                              <span className="text-slate-500 mr-1">{row.label}:</span>
                                              {row.value}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {measurementTags.length > 0 && (
                                        <div>
                                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                            Style tags
                                          </div>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {measurementTags.map((tag) => (
                                              <span
                                                key={tag}
                                                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                                              >
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-500">
                                      No measurement photo processed yet.
                                    </div>
                                  )}

                                  {inspiration && (
                                    <div className="space-y-2 rounded-lg border border-amber-100/80 bg-amber-50/60 p-3">
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                        Inspiration analysis
                                      </div>
                                      {inspiration.description && (
                                        <p className="text-sm text-amber-900 whitespace-pre-line">
                                          {inspiration.description}
                                        </p>
                                      )}
                                      {inspiration.notes && (
                                        <p className="text-xs text-amber-700">{inspiration.notes}</p>
                                      )}
                                      {(inspirationAttrs.mood || inspConfidenceLabel) && (
                                        <div className="text-xs text-amber-800">
                                          {inspirationAttrs.mood && <span className="mr-2">Mood: {inspirationAttrs.mood}</span>}
                                          {inspConfidenceLabel}
                                        </div>
                                      )}
                                      {palette.length > 0 && (
                                        <div>
                                          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                            Palette
                                          </div>
                                          <div className="mt-1 flex flex-wrap gap-2">
                                            {palette.map((colour, idx) => (
                                              <div key={`${group.key}-palette-${idx}`} className="flex items-center gap-1 text-xs text-amber-900">
                                                <span
                                                  className="h-4 w-4 rounded-full border border-amber-200"
                                                  style={{ backgroundColor: colour }}
                                                />
                                                {colour}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {inspirationTags.length > 0 && (
                                        <div>
                                          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                            Style tags
                                          </div>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {inspirationTags.map((tag) => (
                                              <span
                                                key={`${group.key}-tag-${tag}`}
                                                className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-amber-800"
                                              >
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {heroFeatures.length > 0 && (
                                        <div className="text-xs text-amber-900">
                                          <span className="font-semibold">Key features:</span> {joinList(heroFeatures)}
                                        </div>
                                      )}
                                      {materialCues.length > 0 && (
                                        <div className="text-xs text-amber-900">
                                          <span className="font-semibold">Material cues:</span> {joinList(materialCues)}
                                        </div>
                                      )}
                                      {glazingCues.length > 0 && (
                                        <div className="text-xs text-amber-900">
                                          <span className="font-semibold">Glazing cues:</span> {joinList(glazingCues)}
                                        </div>
                                      )}
                                      {hardwareCues.length > 0 && (
                                        <div className="text-xs text-amber-900">
                                          <span className="font-semibold">Hardware cues:</span> {joinList(hardwareCues)}
                                        </div>
                                      )}
                                      {specPairs.length > 0 && (
                                        <div>
                                          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                            Recommended specs
                                          </div>
                                          <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                                            {specPairs.map((pair) => (
                                              <li key={`${group.key}-${pair.label}`}>{pair.label}: {pair.value}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {settings?.slug && lead?.id && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a
                          href={`/q/${settings!.slug}/${encodeURIComponent(lead!.id)}`}
                          className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white/80 px-3 py-1.5 text-sm font-semibold text-sky-600 shadow-sm hover:bg-white"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span aria-hidden="true">🔗</span>
                          Open public questionnaire
                        </a>
                      </div>
                    )}
                  </section>

                  {/* Internal Tracking (Unified) */}
                  {internalFields.length > 0 && (
                    <section className="rounded-2xl border border-indigo-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                      <details>
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
                            <span aria-hidden="true">🔒</span>
                            Internal Tracking
                            <span className="ml-2 text-xs text-slate-500 font-normal">(visible only in CRM)</span>
                          </div>
                        </summary>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3">
                          {internalFields.map((field) => {
                            const key = field.key;
                            if (!key) return null;
                            const value = (customData as any)?.[key] ?? "";
                            return (
                              <UnifiedFieldRenderer
                                key={key}
                                field={field as any}
                                value={value}
                                onChange={(val: any) => {
                                  const strVal = typeof val === "string" ? val : String(val ?? "");
                                  setCustomDraft((prev) => ({ ...prev, [key]: strVal }));
                                  saveCustomField(field as any, strVal);
                                }}
                              />
                            );
                          })}
                        </div>
                      </details>
                    </section>
                  )}

                  {/* Manufacturing Fields (WON only) */}
                  {uiStatus === "WON" && manufacturingFields.length > 0 && (
                    <section className="rounded-2xl border border-green-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                        <span aria-hidden="true">🏭</span>
                        Manufacturing Fields
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {manufacturingFields.map((field) => {
                          const key = field.key;
                          if (!key) return null;
                          const value = (customData as any)?.[key] ?? "";
                          return (
                            <UnifiedFieldRenderer
                              key={key}
                              field={field as any}
                              value={value}
                              onChange={(val: any) => {
                                const strVal = typeof val === "string" ? val : String(val ?? "");
                                setCustomDraft((prev) => ({ ...prev, [key]: strVal }));
                                saveCustomField(field as any, strVal);
                              }}
                            />
                          );
                        })}
                      </div>
                    </section>
                  )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* QUESTIONNAIRE STAGE */}
          {(currentStage as any) === "questionnaire" && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-sky-50/70 to-indigo-50/60 min-h-[60vh]">
              <div className="max-w-4xl mx-auto space-y-6">
                <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span aria-hidden="true">📋</span>
                      Questionnaire Responses
                    </div>
                    {questionnaireSubmittedAt && (
                      <span className="text-xs text-slate-500">
                        Submitted {new Date(questionnaireSubmittedAt).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {questionnaireResponses.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500">No questionnaire responses yet</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Send the client a questionnaire to collect their project details
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {questionnaireResponses.map(({ field, value }, idx) => {
                        const k = field.key || field.id || String(idx);
                        return (
                          <div
                            key={k}
                            className="rounded-xl border border-slate-200/70 bg-white/70 p-4"
                          >
                            <dt className="text-sm font-semibold text-slate-700 mb-2">
                              {field.label || field.key || field.id}
                              {field.required && <span className="text-rose-500 ml-1">*</span>}
                            </dt>
                            <dd className="text-sm text-slate-600 whitespace-pre-wrap">
                              {value != null ? String(value) : <span className="text-slate-400 italic">No answer</span>}
                            </dd>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Vision inferences / measurements */}
                {visionGroups.length > 0 && (
                  <section className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                      <span aria-hidden="true">📐</span>
                      Uploaded Measurements & Photos
                    </div>
                    <div className="space-y-3">
                      {visionGroups.map((group) => (
                        <div key={group.key} className="border border-slate-200 rounded-lg p-3">
                          <div className="text-xs font-semibold text-slate-500 mb-2">
                            {group.itemNumber != null ? `Item #${group.itemNumber}` : "Unlabeled"}
                          </div>
                          {group.measurement && (
                            <div className="text-sm text-slate-700">
                              <strong>Dimensions:</strong> {group.measurement.widthMm}mm × {group.measurement.heightMm}mm
                              {group.measurement.confidence != null && (
                                <span className="text-xs text-slate-500 ml-2">
                                  ({(group.measurement.confidence * 100).toFixed(0)}% confidence)
                                </span>
                              )}
                            </div>
                          )}
                          {group.inspiration && (
                            <div className="text-sm text-slate-600 mt-1">
                              <strong>Inspiration:</strong> {group.inspiration.description || "Photo provided"}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {/* TASKS & FOLLOW-UPS STAGE - Embedded TaskCenter */}
          {currentStage === "tasks" && (
            <div className="p-4 sm:p-6">
              <TaskCenter filterRelatedType="LEAD" filterRelatedId={lead?.id || ''} embedded />
            </div>
          )}

          {/* Old communication stage removed - now part of unified tasks tab */}
          {false && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-blue-50/70 to-indigo-50/60 min-h-[60vh]">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Communication Log */}
                <section className="rounded-xl border p-4 bg-white/90 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                    <span aria-hidden="true">💬</span>
                    Communication Log
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <label className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          Type
                        </span>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                          value={communicationType}
                          onChange={(e) =>
                            setCommunicationType(
                              e.target.value as "call" | "email" | "note"
                            )
                          }
                        >
                          <option value="note">📝 Note</option>
                          <option value="call">📞 Phone Call</option>
                          <option value="email">📧 Email</option>
                        </select>
                      </label>

                      <label className="text-sm">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          {communicationType === "call"
                            ? "Call Summary"
                            : communicationType === "email"
                            ? "Email Summary"
                            : "Note"}
                        </span>
                        <textarea
                          className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-3 min-h-20 shadow-inner"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder={
                            communicationType === "call"
                              ? "What was discussed during the call?"
                              : communicationType === "email"
                              ? "Email sent/received summary"
                              : "Add a note about this lead..."
                          }
                        />
                      </label>

                      <Button
                        className="w-full"
                        onClick={addCommunicationNote}
                        disabled={!newNote.trim()}
                      >
                        {communicationType === "call"
                          ? "📞 Log Call"
                          : communicationType === "email"
                          ? "📧 Log Email"
                          : "📝 Add Note"}
                      </Button>
                    </div>

                    {(lead?.communicationLog?.length ?? 0) > 0 && (
                      <div className="space-y-3 pt-4 border-t border-slate-200">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Recent Communications
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {lead?.communicationLog?.map((entry) => (
                            <div
                              key={entry.id}
                              className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs">
                                  {entry.type === "call"
                                    ? "📞"
                                    : entry.type === "email"
                                    ? "📧"
                                    : "📝"}
                                </span>
                                <span className="text-xs font-medium capitalize">
                                  {entry.type}
                                </span>
                                <span className="text-xs text-slate-500 ml-auto">
                                  {new Date(entry.timestamp).toLocaleDateString()}{" "}
                                  {new Date(entry.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700">{entry.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Follow-up scheduling + tasks */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Schedule Follow-up */}
                  <section className="rounded-xl border p-4 bg-white/90 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                      Schedule Follow-up Tasks
                    </h3>

                    {/* Email Follow-up */}
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

                    {/* Phone Follow-up */}
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

                    {/* Auto sequence */}
                    <div className="pt-3 border-t">
                      <button
                        className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        disabled={creatingSequence}
                        onClick={createFollowupSequence}
                      >
                        {creatingSequence
                          ? "Creating..."
                          : "Auto-schedule Follow-up Sequence"}
                      </button>
                      <div className="text-xs text-slate-500 mt-1 text-center">
                        Creates email task (3 days) + phone task (1 week)
                      </div>
                    </div>
                  </section>

                  {/* Scheduled follow-up tasks */}
                  <section className="rounded-xl border p-4 bg-white">
                    <div className="mb-2 text-sm font-semibold text-slate-900 flex items-center justify-between">
                      <span>Scheduled Tasks</span>
                      {loadingActivity && (
                        <span className="text-xs text-slate-500">Loading...</span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {pendingFollowUpTasks.length === 0 ? (
                        <div className="text-sm text-slate-500 text-center py-4">
                          No scheduled follow-up tasks. Create one above.
                        </div>
                      ) : (
                        pendingFollowUpTasks.map((event) => {
                          if (event.type !== 'task') return null;
                          
                          const isFollowUpTask = (event as any).taskType === 'FOLLOW_UP' || (event as any).meta?.aiDraft;
                          
                          // If this is a FOLLOW_UP task with AI draft, open unified TaskModal
                          if (isFollowUpTask) {
                            return (
                              <div key={event.id} className="rounded-lg border-2 border-indigo-200">
                                <Button
                                  variant="ghost"
                                  className="w-full p-3 text-left flex items-center justify-between hover:bg-indigo-50"
                                  onClick={() => setSelectedFollowUpTask(event as Task)}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-indigo-600">✨</span>
                                    <div>
                                      <div className="text-sm font-medium">{event.title}</div>
                                      {(event as any).meta?.aiDraft && (
                                        <div className="text-xs text-indigo-600">AI-Powered Follow-up</div>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-xs text-slate-500">
                                    {event.dueAt
                                      ? `Due ${new Date(event.dueAt).toLocaleDateString()}`
                                      : "Due soon"}
                                  </span>
                                </Button>
                              </div>
                            );
                          }
                          
                          // Regular task rendering
                          return (
                            <div
                              key={event.id}
                              className="rounded-md border p-3 bg-blue-50"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span>
                                    {event.meta?.type === "email_followup" ? "📧" : "📞"}
                                  </span>
                                  <span className="text-sm font-medium">{event.title}</span>
                                </div>
                                <span className="text-xs text-slate-500">
                                  {event.dueAt
                                    ? `Due ${new Date(event.dueAt).toLocaleDateString()}`
                                    : "Due soon"}
                                </span>
                              </div>
                              {event.description && (
                                <div className="text-xs text-slate-600 mb-2">
                                  {event.description}
                                </div>
                              )}
                              <div className="flex gap-2">
                                {event.meta?.type === "email_followup" ? (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => openEmailComposer(event.id)}
                                  >
                                    Compose &amp; Send
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
                                  onClick={() => completeFollowUpTask(event.id)}
                                >
                                  Mark Done
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {completedFollowUpTasks.length > 0 && (
                      <div className="mt-4 pt-3 border-t">
                        <div className="text-xs font-medium text-slate-600 mb-2">
                          Completed
                        </div>
                        <div className="space-y-2">
                          {completedFollowUpTasks.map((event) => {
                            if (event.type !== 'task') return null;
                            return (
                              <div
                                key={event.id}
                                className="rounded-md border p-2 bg-slate-50 opacity-75"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-green-600">✓</span>
                                    <span className="text-xs">{event.title}</span>
                                  </div>
                                  <span className="text-xs text-slate-400">
                                    {event.completedAt
                                      ? new Date(event.completedAt).toLocaleDateString()
                                      : "Done"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* ORDER / WORKSHOP STAGE */}
          {currentStage === "order" && (
            <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-emerald-50/70 to-teal-50/60 min-h-[60vh]">
              <div className="max-w-6xl mx-auto space-y-6">
                {uiStatus !== "WON" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Mark this lead as <strong>Won</strong> to unlock workshop scheduling and
                    material tracking.
                  </div>
                )}

                {uiStatus === "WON" && (
                  <>
                    {/* Project dates / value */}
                    <section className="rounded-2xl border border-emerald-200 bg-white/80 p-5 shadow-sm backdrop-blur space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span aria-hidden>📅</span>
                          {opportunityStage === "WON" ? "Project Overview" : "Opportunity Overview"}
                        </div>
                        {projectValueGBP && (
                          <div className="text-sm text-slate-700">
                            Value:{" "}
                            <span className="font-semibold">
                              £{Number(projectValueGBP).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="block">
                          <span className="text-xs text-slate-600 font-medium mb-1 block">
                            Start Date
                          </span>
                          <input
                            type="date"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={projectStartDate}
                            onChange={(e) => setProjectStartDate(e.target.value)}
                            onBlur={() => {
                              if (projectStartDate) {
                                saveOpportunityField("startDate", projectStartDate);
                              }
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-slate-600 font-medium mb-1 block">
                            Completion Date
                          </span>
                          <input
                            type="date"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={projectDeliveryDate}
                            onChange={(e) => setProjectDeliveryDate(e.target.value)}
                            onBlur={() => {
                              if (projectDeliveryDate) {
                                saveOpportunityField("deliveryDate", projectDeliveryDate);
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="block">
                          <span className="text-xs text-slate-600 font-medium mb-1 block">
                            Installation Start Date
                          </span>
                          <input
                            type="date"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={projectInstallationStartDate}
                            onChange={(e) => setProjectInstallationStartDate(e.target.value)}
                            onBlur={() => {
                              if (projectInstallationStartDate) {
                                saveOpportunityField("installationStartDate", projectInstallationStartDate);
                              }
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-slate-600 font-medium mb-1 block">
                            Installation End Date
                          </span>
                          <input
                            type="date"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={projectInstallationEndDate}
                            onChange={(e) => setProjectInstallationEndDate(e.target.value)}
                            onBlur={() => {
                              if (projectInstallationEndDate) {
                                saveOpportunityField("installationEndDate", projectInstallationEndDate);
                              }
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-slate-600 font-medium mb-1 block">
                            Value (GBP)
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={projectValueGBP}
                            onChange={(e) => setProjectValueGBP(e.target.value)}
                            onBlur={() => {
                              if (projectValueGBP) {
                                saveOpportunityField("valueGBP", Number(projectValueGBP));
                              }
                            }}
                            placeholder="0.00"
                          />
                        </label>
                      </div>
                    </section>

                    {/* Workshop processes */}
                    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm backdrop-blur space-y-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                          <span aria-hidden>🛠️</span>
                          Workshop processes for this project
                        </div>
                        <button
                          type="button"
                          className="text-xs text-emerald-700 hover:text-emerald-900"
                          onClick={async () => {
                            setWkLoading(true);
                            try {
                              const pid = opportunityId || lead.id;
                              const project = await apiFetch<any>(
                                `/workshop-processes/project/${encodeURIComponent(pid)}`
                              ).catch(() => []);
                              const arr = Array.isArray(
                                project?.assignments || project
                              )
                                ? project.assignments || project
                                : [];
                              const norm: ProcAssignment[] = arr.map((it: any) => ({
                                id: String(
                                  it.id || it.assignmentId || crypto.randomUUID()
                                ),
                                processDefinitionId:
                                  it.processDefinitionId || it.processDefinition?.id,
                                processCode:
                                  it.processCode || it.processDefinition?.code,
                                processName:
                                  it.processName || it.processDefinition?.name,
                                required: Boolean(it.required ?? true),
                                estimatedHours:
                                  it.estimatedHours ??
                                  it.processDefinition?.estimatedHours ??
                                  null,
                                assignedUser: it.assignedUser
                                  ? {
                                      id: it.assignedUser.id,
                                      name: it.assignedUser.name ?? null,
                                      email: it.assignedUser.email,
                                    }
                                  : null,
                              }));
                              setWkAssignments(norm);
                            } finally {
                              setWkLoading(false);
                            }
                          }}
                        >
                          Refresh
                        </button>
                      </div>

                      {wkLoading ? (
                        <div className="text-sm text-emerald-800">
                          Loading processes…
                        </div>
                      ) : wkDefs.length === 0 ? (
                        <div className="text-sm text-emerald-800">
                          No tenant processes defined. Configure them in Settings → Workshop
                          Processes.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {wkDefs.map((def) => {
                            const asn = getAssignmentFor(def.id);
                            const required = asn?.required ?? !!def.requiredByDefault;
                            const est =
                              (asn?.estimatedHours ?? def.estimatedHours) ?? null;
                            const userIdSel = asn?.assignedUser?.id || "";
                            return (
                              <div
                                key={def.id}
                                className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 rounded-xl border bg-white/80 px-3 py-2"
                              >
                                <div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {def.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {def.code}
                                  </div>
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={required}
                                    onChange={(e) =>
                                      saveProjectAssignment(def, {
                                        required: e.target.checked,
                                        assignedUserId: userIdSel || null,
                                        estimatedHours: est,
                                      })
                                    }
                                    disabled={wkSavingId === def.id}
                                  />
                                  Required
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-600 whitespace-nowrap">
                                    Assign
                                  </span>
                                  <select
                                    className="rounded-md border px-2 py-1 text-sm"
                                    value={userIdSel}
                                    onChange={(e) =>
                                      saveProjectAssignment(def, {
                                        required,
                                        assignedUserId: e.target.value || null,
                                        estimatedHours: est,
                                      })
                                    }
                                    disabled={wkSavingId === def.id}
                                  >
                                    <option value="">Unassigned</option>
                                    {wkUsers.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name || u.email}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-600 whitespace-nowrap">
                                    Hours
                                  </span>
                                  <input
                                    type="number"
                                    className="w-24 rounded-md border px-2 py-1 text-sm"
                                    value={est ?? ""}
                                    onChange={(e) => {
                                      const val =
                                        e.target.value === ""
                                          ? null
                                          : Number(e.target.value);
                                      saveProjectAssignment(def, {
                                        required,
                                        assignedUserId: userIdSel || null,
                                        estimatedHours: val,
                                      });
                                    }}
                                    disabled={wkSavingId === def.id}
                                  />
                                </div>
                                <div className="text-right">
                                  {asn ? (
                                    <span className="inline-block text-[11px] text-slate-500">
                                      Saved
                                    </span>
                                  ) : (
                                    <span className="inline-block text-[11px] text-slate-500">
                                      Not yet assigned
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    {/* Material Tracking */}
                    <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm backdrop-blur space-y-4">
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
                          { key: "timber", label: "Timber", icon: "🪵" },
                          { key: "glass", label: "Glass", icon: "🪟" },
                          { key: "ironmongery", label: "Ironmongery", icon: "🔩" },
                          { key: "paint", label: "Paint", icon: "🎨" },
                        ].map((material) => {
                          const notApplicableKey =
                            `${material.key}NotApplicable` as keyof MaterialDates;
                          const isNA = materialDates[notApplicableKey] || false;

                          return (
                            <div
                              key={material.key}
                              className="rounded-xl border bg-white/80 p-4"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span>{material.icon}</span>
                                  <span className="text-sm font-medium text-slate-900">
                                    {material.label}
                                  </span>
                                </div>
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!isNA}
                                    onChange={(e) => {
                                      setMaterialDates((prev) => ({
                                        ...prev,
                                        [notApplicableKey]: e.target.checked,
                                        ...(e.target.checked
                                          ? {
                                              [`${material.key}OrderedAt`]: null,
                                              [`${material.key}ExpectedAt`]: null,
                                              [`${material.key}ReceivedAt`]: null,
                                            }
                                          : {}),
                                      }));
                                      setTimeout(() => saveMaterialDates(), 0);
                                    }}
                                    className="rounded"
                                  />
                                  N/A
                                </label>
                              </div>
                              {!isNA ? (
                                <div className="space-y-2">
                                  <label className="block">
                                    <span className="text-xs text-slate-600">Ordered</span>
                                    <input
                                      type="date"
                                      className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                                      value={
                                        (materialDates[
                                          `${material.key}OrderedAt` as keyof MaterialDates
                                        ] as string | undefined) || ""
                                      }
                                      onChange={(e) =>
                                        setMaterialDates((prev) => ({
                                          ...prev,
                                          [`${material.key}OrderedAt`]:
                                            e.target.value || null,
                                        }))
                                      }
                                      onBlur={() =>
                                        setTimeout(() => saveMaterialDates(), 50)
                                      }
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-600">
                                      Expected
                                    </span>
                                    <input
                                      type="date"
                                      className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                                      value={
                                        (materialDates[
                                          `${material.key}ExpectedAt` as keyof MaterialDates
                                        ] as string | undefined) || ""
                                      }
                                      onChange={(e) =>
                                        setMaterialDates((prev) => ({
                                          ...prev,
                                          [`${material.key}ExpectedAt`]:
                                            e.target.value || null,
                                        }))
                                      }
                                      onBlur={() =>
                                        setTimeout(() => saveMaterialDates(), 50)
                                      }
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-600">
                                      Received
                                    </span>
                                    <input
                                      type="date"
                                      className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                                      value={
                                        (materialDates[
                                          `${material.key}ReceivedAt` as keyof MaterialDates
                                        ] as string | undefined) || ""
                                      }
                                      onChange={(e) =>
                                        setMaterialDates((prev) => ({
                                          ...prev,
                                          [`${material.key}ReceivedAt`]:
                                            e.target.value || null,
                                        }))
                                      }
                                      onBlur={() =>
                                        setTimeout(() => saveMaterialDates(), 50)
                                      }
                                    />
                                  </label>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 italic text-center py-4">
                                  Not applicable for this project
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Parse tester output */}
        {parseTesterOpen && (
          <div className="absolute bottom-4 left-4 right-4 z-[70]">
            <div className="rounded-2xl border border-indigo-200 bg-white/95 shadow-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-indigo-800">
                  PDF Parse Test Output
                </div>
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
                {parseApplyResult?.url && (
                  <a
                    className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white"
                    href={parseApplyResult.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open PDF
                    {parseApplyResult.name ? ` (${parseApplyResult.name})` : ""}
                  </a>
                )}
                {parseApplyResult?.error && (
                  <span className="text-xs text-rose-600">
                    {parseApplyResult.error}
                  </span>
                )}
              </div>
              <div className="mt-2 max-h-64 overflow-auto">
                <pre className="text-[11px] leading-snug text-slate-700 whitespace-pre-wrap break-words">
                  {(() => {
                    try {
                      return JSON.stringify(parseTesterOut, null, 2);
                    } catch {
                      return String(parseTesterOut);
                    }
                  })()}
                </pre>
              </div>
            </div>
          </div>
        )}

        {showSupplierModal && (
          <div className="absolute inset-0 z-[85] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Request supplier quote</h3>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => setShowSupplierModal(false)}
                >
                  Close
                </button>
              </div>

              {suppliers.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No suppliers found. Add suppliers in Settings → Suppliers first.
                </div>
              ) : (
                <label className="block text-xs font-semibold text-slate-700">
                  Supplier
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    disabled={busyTask}
                  >
                    <option value="">Select a supplier…</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name || supplier.companyName || "Supplier"}
                        {supplier.email ? ` — ${supplier.email}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Deadline (days)
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner"
                    value={quoteDeadlineDays}
                    onChange={(e) => setQuoteDeadlineDays(e.target.value)}
                    disabled={busyTask}
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Notes
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner"
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Add context for the supplier"
                    disabled={busyTask}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => setShowSupplierModal(false)}
                  disabled={busyTask}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  onClick={submitSupplierQuoteRequest}
                  disabled={busyTask || !selectedSupplierId}
                >
                  {busyTask ? "Sending…" : "Send request"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unified Task Modal (replaces legacy FollowUpTaskPanel) */}
        <TaskModal
          open={!!selectedFollowUpTask}
          task={selectedFollowUpTask as any}
          tenantId={tenantId}
          userId={userId}
          onChanged={async () => {
            await refreshActivity();
          }}
          onClose={() => setSelectedFollowUpTask(null)}
        />

        {/* Simple email composer modal for follow-up tasks */}
        {showEmailComposer && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  Send follow-up email
                </h3>
                <button
                  className="text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => setShowEmailComposer(false)}
                >
                  Close
                </button>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Subject
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={composerSubject}
                    onChange={(e) => setComposerSubject(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700">
                  Body
                  <textarea
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm min-h-[140px]"
                    value={composerBody}
                    onChange={(e) => setComposerBody(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  onClick={() => setShowEmailComposer(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  onClick={sendComposerEmail}
                  disabled={sending || !composerSubject || !composerBody}
                >
                  {sending ? "Sending…" : "Send & Mark Task Done"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={emailPreview.isOpen}
        onClose={() => setEmailPreview(prev => ({ ...prev, isOpen: false }))}
        onSend={handleEmailPreviewSend}
        subject={emailPreview.subject}
        body={emailPreview.body}
        to={emailPreview.to}
        recipientName={emailPreview.recipientName}
      />

    </div>
  );
}