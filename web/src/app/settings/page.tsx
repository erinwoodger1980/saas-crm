"use client";
import { API_BASE, apiFetch, ensureDemoAuth } from "@/lib/api";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser, type CurrentUser } from "@/lib/use-current-user";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/constants";
import SourceCosts from "./SourceCosts";
import { TenantImageImport } from "@/components/settings/TenantImageImport";
import SuppliersSection from "@/components/settings/SuppliersSection";
import SoftwareProfilesSection from "@/components/settings/SoftwareProfilesSection";
import PdfTemplatesSection from "@/components/settings/PdfTemplatesSection";
import MaterialCostDebugPanel from "@/components/settings/MaterialCostDebugPanel";
import AdminQuestionnaireFieldsTable from "@/components/questionnaire/AdminQuestionnaireFieldsTable";
import {
  DEFAULT_TASK_PLAYBOOK,
  MANUAL_TASK_KEYS,
  ManualTaskKey,
  TaskPlaybook,
  TaskRecipe,
  normalizeTaskPlaybook,
  type UiStatus,
} from "@/lib/task-playbook";

/* ---------------- Types ---------------- */
type QField = {
  id?: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "source" | "file";
  required?: boolean;
  options?: string[];
  askInQuestionnaire?: boolean;
  showOnLead?: boolean;
  internalOnly?: boolean;
  visibleAfterOrder?: boolean;
  group?: string;
  sortOrder?: number;
};
type Settings = {
  tenantId: string;
  slug: string;
  brandName: string;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  introHtml?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  links?: { label: string; url: string }[] | null;
  questionnaire?: QField[] | null;
  taskPlaybook?: TaskPlaybook | null;
  questionnaireEmailSubject?: string | null;
  questionnaireEmailBody?: string | null;
  isFireDoorManufacturer?: boolean;
  isGroupCoachingMember?: boolean;
  // Social proof / branding metrics
  reviewScore?: number | null;
  reviewCount?: number | null;
  reviewSourceLabel?: string | null;
  serviceArea?: string | null;
  emailTemplates?: {
    declineQuote?: { subject: string; body: string };
    requestSupplierQuote?: { subject: string; body: string };
    sendQuestionnaire?: { subject: string; body: string };
    sendQuote?: { subject: string; body: string };
    followUpEmail?: { subject: string; body: string };
    quoteApproved?: { subject: string; body: string };
    quoteRejected?: { subject: string; body: string };
  } | null;
  aiFollowupLearning?: { crossTenantOptIn: boolean; lastUpdatedISO?: string | null } | null;
  quoteDefaults?: {
    currency?: string;
    defaultMargin?: number;
    vatRate?: number;
    showVat?: boolean;
    validDays?: number;
    tagline?: string;
    email?: string;
    address?: string;
    terms?: string;
    overview?: string;
    defaultTimber?: string;
    defaultFinish?: string;
    defaultGlazing?: string;
    defaultFittings?: string;
    compliance?: string;
    showLineItems?: boolean;
    delivery?: string;
    installation?: string;
    businessHours?: string;
    guaranteeTitle?: string;
    guarantees?: Array<{ title: string; description: string }>;
    testimonials?: Array<{ quote: string; client: string; role?: string; photoDataUrl?: string; photoUrl?: string }>;
    certifications?: Array<{ name: string; description: string }>;
  } | null;
};
type InboxCfg = { gmail: boolean; ms365: boolean; intervalMinutes: number; recallFirst?: boolean };
// (removed unused local types CostRow, AiFollowupInsight)

/* ---------------- Small UI bits ---------------- */
function Section({
  title,
  description,
  right,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border bg-white/90 p-5 shadow-[0_10px_30px_-22px_rgba(2,6,23,0.45)] ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-800">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}
function Field({ label, hint, required, children, className }: { label: string; hint?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ''}`}>
      <div className="mb-1 text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

/* ---------------- Helpers ---------------- */
const FIELD_TYPES: QField["type"][] = ["text", "textarea", "select", "number", "date", "source", "file"];

function makeFieldId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `field-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeQuestionnaire(raw: any): QField[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item: any, idx: number) => {
      if (!item || typeof item !== "object") return null;
      const key = typeof item.key === "string" && item.key.trim() ? item.key.trim() : "";
      if (!key) return null;
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : makeFieldId();
      const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : key;
      const typeRaw = typeof item.type === "string" && item.type.trim() ? item.type.trim() : "text";
      const type = FIELD_TYPES.includes(typeRaw as QField["type"]) ? (typeRaw as QField["type"]) : "text";
      const required = Boolean(item.required);
      const askInQuestionnaire = item.askInQuestionnaire === false ? false : true;
      const showOnLead = Boolean(item.showOnLead);
      const internalOnly = item.internalOnly === true;
      const visibleAfterOrder = item.visibleAfterOrder === true;
      const group = typeof item.group === "string" && item.group.trim() ? item.group.trim() : undefined;
      const options =
        type === "select" && Array.isArray(item.options)
          ? item.options.map((opt: any) => String(opt || "").trim()).filter(Boolean)
          : [];
      const sortOrder =
        typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder) ? item.sortOrder : idx;
      return { id, key, label, type, required, options, askInQuestionnaire, showOnLead, internalOnly, visibleAfterOrder, group, sortOrder } as QField;
    })
    .filter((field): field is QField => Boolean(field?.key))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function serializeQuestionnaire(fields: QField[]): any[] {
  return fields
    .map((field, idx) => {
      const key = field.key?.trim();
      if (!key) return null;
      const label = field.label?.trim() || key;
      const type = FIELD_TYPES.includes(field.type) ? field.type : "text";
      const options =
        type === "select"
          ? (field.options ?? []).map((opt) => opt.trim()).filter(Boolean)
          : undefined;
      return {
        id: field.id || makeFieldId(),
        key,
        label,
        type,
        required: Boolean(field.required),
        options,
        askInQuestionnaire: field.askInQuestionnaire === false ? false : true,
        showOnLead: Boolean(field.showOnLead),
        internalOnly: field.internalOnly === true ? true : undefined,
        visibleAfterOrder: field.visibleAfterOrder === true ? true : undefined,
        group: field.group && field.group.trim() ? field.group.trim() : undefined,
        sortOrder: idx,
      };
    })
    .filter(Boolean);
}

function emitTenantSettingsUpdate(payload: Partial<Settings>) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("tenant-settings:updated", { detail: payload }));
  } catch {
    // no-op
  }
}

/* ============================================================
   Page
============================================================ */
export default function SettingsPage() {
  const { toast } = useToast();
  const { user, mutate: mutateCurrentUser } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  
  // Support ?tab=pdf-templates URL parameter
  const initialTab = (() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'pdf-templates') return 'pdf-templates';
    }
    return 'business';
  })();
  
  const [currentStage, setCurrentStage] = useState<"business" | "questionnaire" | "email-templates" | "marketing" | "automation" | "workshop-processes" | "integrations" | "suppliers" | "software-profiles" | "pdf-templates" | "material-costs">(initialTab as any);
  const [s, setS] = useState<Settings | null>(null);
  const [inbox, setInbox] = useState<InboxCfg>({ gmail: false, ms365: false, intervalMinutes: 10 });
  const [savingInbox, setSavingInbox] = useState(false);
  const [gmailConn, setGmailConn] = useState<{ gmailAddress?: string | null } | null>(null);
  const [ms365Conn, setMs365Conn] = useState<{ ms365Address?: string | null } | null>(null);
  const [userGmailConn, setUserGmailConn] = useState<{ gmailAddress?: string | null } | null>(null);
  const [userMs365Conn, setUserMs365Conn] = useState<{ ms365Address?: string | null } | null>(null);
  const [updatingEarlyAccess, setUpdatingEarlyAccess] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [qFields, setQFields] = useState<QField[]>([]);
  const [qSearch, setQSearch] = useState("");
  const [qHideInternal, setQHideInternal] = useState(true);
  const [qOnlyPublic, setQOnlyPublic] = useState(false);
  const [qScopeTab, setQScopeTab] = useState<"client" | "public" | "internal" | "manufacturing">("public");
  const [savingSettings, setSavingSettings] = useState(false);
    // Seed placeholder testimonials if none exist on initial load
    useEffect(() => {
      if (s && (s.quoteDefaults?.testimonials || []).length === 0) {
        const placeholders = [
          { quote: 'Outstanding craftsmanship and attention to detail.', client: 'Sarah W.', role: 'Interior Designer' },
          { quote: 'Delivered on time and the quality exceeded expectations.', client: 'Mark R.', role: 'Property Developer' },
          { quote: 'Professional, responsive, and superb finish.', client: 'Helen T.', role: 'Homeowner' },
        ];
        setS(prev => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: placeholders } } : prev);
      }
    }, [s]);
  const [savingFireDoor, setSavingFireDoor] = useState(false);
  const [savingCoaching, setSavingCoaching] = useState(false);
  const [enrichingWebsite, setEnrichingWebsite] = useState(false);
  const [uploadingQuotePdf, setUploadingQuotePdf] = useState(false);
  const [playbook, setPlaybook] = useState<TaskPlaybook>(normalizeTaskPlaybook(DEFAULT_TASK_PLAYBOOK));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // Workshop processes state
  type ProcessDef = {
    id: string;
    code: string;
    name: string;
    sortOrder: number;
    requiredByDefault: boolean;
    estimatedHours?: number | null;
    isColorKey?: boolean;
    isGeneric?: boolean;
    isLastManufacturing?: boolean;
    isLastInstallation?: boolean;
    assignmentGroup?: string | null;
  };
  const [processes, setProcesses] = useState<ProcessDef[]>([]);
  const [procLoading, setProcLoading] = useState(false);
  const [procSavingId, setProcSavingId] = useState<string | "new" | null>(null);
  const [newProcess, setNewProcess] = useState<Omit<ProcessDef, "id">>({ code: "", name: "", sortOrder: 0, requiredByDefault: true, estimatedHours: 1, isColorKey: false, isGeneric: false, isLastManufacturing: false, isLastInstallation: false, assignmentGroup: null });

  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      try {
        await mutateCurrentUser();
        const data = await apiFetch<Settings>("/tenant/settings");
        setS(data);
        // initialize inbox
        if ((data as any)?.inbox) setInbox((data as any).inbox as InboxCfg);
        // initialize questionnaire editor from settings
        setQFields(normalizeQuestionnaire((data as any)?.questionnaire ?? []));
  // initialize task playbook editor
  setPlaybook(normalizeTaskPlaybook((data as any)?.taskPlaybook ?? DEFAULT_TASK_PLAYBOOK));
  // initialize profile name fields from current user (if available)
        setProfileFirstName(user?.firstName ?? "");
        setProfileLastName(user?.lastName ?? "");
      } catch (e: any) {
        toast({ title: "Failed to load settings", description: e?.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [mutateCurrentUser, toast, user?.firstName, user?.lastName]);

  // Load workshop processes when entering that stage
  useEffect(() => {
    (async () => {
      if (currentStage !== "workshop-processes") return;
      setProcLoading(true);
      try {
        await ensureDemoAuth();
        const list = await apiFetch<ProcessDef[]>("/workshop-processes");
        const normalized = Array.isArray(list) ? list : [];
        setProcesses(normalized.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)));
      } catch (e: any) {
        toast({ title: "Failed to load processes", description: e?.message || "", variant: "destructive" });
      } finally {
        setProcLoading(false);
      }
    })();
  }, [currentStage, toast]);

  async function refreshProcesses() {
    try {
      const list = await apiFetch<ProcessDef[]>("/workshop-processes");
      setProcesses((Array.isArray(list) ? list : []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)));
    } catch {}
  }

  async function createProcess() {
    if (!newProcess.code.trim() || !newProcess.name.trim()) {
      toast({ title: "Missing fields", description: "Code and name are required", variant: "destructive" });
      return;
    }
    setProcSavingId("new");
    try {
      const payload = {
        code: newProcess.code.trim().toUpperCase().replace(/\s+/g, "_"),
        name: newProcess.name.trim(),
        sortOrder: Number(newProcess.sortOrder || 0),
        requiredByDefault: !!newProcess.requiredByDefault,
        estimatedHours: newProcess.estimatedHours == null || newProcess.estimatedHours === undefined ? null : Number(newProcess.estimatedHours),
        isColorKey: !!newProcess.isColorKey,
        isGeneric: !!newProcess.isGeneric,
        isLastManufacturing: !!newProcess.isLastManufacturing,
        isLastInstallation: !!newProcess.isLastInstallation,
        assignmentGroup: newProcess.assignmentGroup?.trim() || null,
      };
      await apiFetch<ProcessDef>("/workshop-processes", { method: "POST", json: payload });
      setNewProcess({ code: "", name: "", sortOrder: 0, requiredByDefault: true, estimatedHours: 1, isColorKey: false, isLastManufacturing: false, isLastInstallation: false, assignmentGroup: null });
      await refreshProcesses();
      toast({ title: "Process created" });
    } catch (e: any) {
      toast({ title: "Create failed", description: e?.message || "", variant: "destructive" });
    } finally {
      setProcSavingId(null);
    }
  }

  async function updateProcess(p: ProcessDef) {
    if (!p?.id) return;
    setProcSavingId(p.id);
    try {
      const payload = {
        code: p.code.trim().toUpperCase().replace(/\s+/g, "_"),
        name: p.name.trim(),
        sortOrder: Number(p.sortOrder || 0),
        requiredByDefault: !!p.requiredByDefault,
        estimatedHours: p.estimatedHours == null || p.estimatedHours === undefined ? null : Number(p.estimatedHours),
        isColorKey: !!p.isColorKey,
        isGeneric: !!p.isGeneric,
        isLastManufacturing: !!p.isLastManufacturing,
        isLastInstallation: !!p.isLastInstallation,
        assignmentGroup: p.assignmentGroup?.trim() || null,
      };
      await apiFetch(`/workshop-processes/${p.id}`, { method: "PATCH", json: payload });
      await refreshProcesses();
      toast({ title: "Process saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "", variant: "destructive" });
    } finally {
      setProcSavingId(null);
    }
  }

  async function deleteProcess(id: string) {
    if (!id) return;
    if (!confirm("Delete this process? This cannot be undone.")) return;
    setProcSavingId(id);
    try {
      await apiFetch(`/workshop-processes/${id}`, { method: "DELETE" });
      await refreshProcesses();
      toast({ title: "Process deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "", variant: "destructive" });
    } finally {
      setProcSavingId(null);
    }
  }

  async function seedDefaultProcesses() {
    setProcSavingId("seed");
    try {
      await apiFetch(`/workshop-processes/seed-default`, { method: "POST" });
      await refreshProcesses();
      toast({ title: "Default processes seeded" });
    } catch (e: any) {
      toast({ title: "Seeding failed", description: e?.message || "", variant: "destructive" });
    } finally {
      setProcSavingId(null);
    }
  }

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updated = await apiFetch<CurrentUser>("/auth/me", {
        method: "PATCH",
        json: { firstName: profileFirstName, lastName: profileLastName },
      });
      mutateCurrentUser(updated, false);
        // also persist owner names to tenant settings so they show up in company profile
        try {
          await apiFetch("/tenant/settings", {
            method: "PATCH",
            json: { ownerFirstName: profileFirstName, ownerLastName: profileLastName },
          });
          setS((prev) => (prev ? { ...prev, ownerFirstName: profileFirstName, ownerLastName: profileLastName } : prev));
        } catch (err) {
          // Not fatal — show a toast but keep profile updated
          toast({ title: "Profile updated (owner name not saved)", description: String((err as any)?.message || "") });
        }
      toast({ title: "Profile updated" });
    } catch (e: any) {
      toast({ title: "Couldn’t update profile", description: e?.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

  // keep profile fields synced if user changes externally
  useEffect(() => {
    setProfileFirstName(user?.firstName ?? "");
    setProfileLastName(user?.lastName ?? "");
  }, [user]);

  async function saveSettings() {
    if (!s) return;
    setSavingSettings(true);
    try {
      const payload = {
        brandName: s.brandName,
        ownerFirstName: s.ownerFirstName,
        ownerLastName: s.ownerLastName,
        introHtml: s.introHtml,
        website: s.website,
        phone: s.phone,
        logoUrl: s.logoUrl,
        reviewScore: s.reviewScore,
        reviewCount: s.reviewCount,
        reviewSourceLabel: s.reviewSourceLabel,
        serviceArea: s.serviceArea,
        inbox,
        questionnaire: serializeQuestionnaire(qFields),
        taskPlaybook: playbook,
        isFireDoorManufacturer: s?.isFireDoorManufacturer,
      } as any;

      const updated = await apiFetch<Settings>("/tenant/settings", { method: "PATCH", json: payload });
      setS(updated);
      setQFields(normalizeQuestionnaire((updated as any)?.questionnaire ?? []));
      setPlaybook(normalizeTaskPlaybook((updated as any)?.taskPlaybook ?? DEFAULT_TASK_PLAYBOOK));
      emitTenantSettingsUpdate({ isFireDoorManufacturer: updated?.isFireDoorManufacturer });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Failed to save settings", description: e?.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleFireDoorToggle(nextValue: boolean) {
    if (!s || savingFireDoor) return;
    const previousValue = !!s.isFireDoorManufacturer;
    setS((prev) => (prev ? { ...prev, isFireDoorManufacturer: nextValue } : prev));
    setSavingFireDoor(true);
    try {
      const updated = await apiFetch<Settings>("/tenant/settings", {
        method: "PATCH",
        json: { isFireDoorManufacturer: nextValue },
      });
      setS(updated);
      emitTenantSettingsUpdate({ isFireDoorManufacturer: updated?.isFireDoorManufacturer });
      toast({ title: nextValue ? "Fire Door Calculator enabled" : "Fire Door Calculator disabled" });
    } catch (e: any) {
      setS((prev) => (prev ? { ...prev, isFireDoorManufacturer: previousValue } : prev));
      toast({ title: "Failed to update Fire Door setting", description: e?.message, variant: "destructive" });
    } finally {
      setSavingFireDoor(false);
    }
  }

  async function handleCoachingToggle(nextValue: boolean) {
    if (!s || savingCoaching) return;
    const previousValue = !!s.isGroupCoachingMember;
    setS((prev) => (prev ? { ...prev, isGroupCoachingMember: nextValue } : prev));
    setSavingCoaching(true);
    try {
      // Persist to backend TenantSettings so backend flags are in sync
      const updated = await apiFetch<Settings>("/tenant/settings", {
        method: "PUT",
        json: { isGroupCoachingMember: nextValue },
      });
      setS(updated);
      // Emit event so AppShell updates sidebar immediately
      emitTenantSettingsUpdate({ isGroupCoachingMember: updated?.isGroupCoachingMember });
      toast({ title: nextValue ? "Coaching Hub enabled" : "Coaching Hub disabled" });
    } catch (e: any) {
      setS((prev) => (prev ? { ...prev, isGroupCoachingMember: previousValue } : prev));
      toast({ title: "Failed to update Coaching Hub setting", description: e?.message, variant: "destructive" });
    } finally {
      setSavingCoaching(false);
    }
  }

  // ---- Task Playbook editor helpers ----
  const STATUS_KEYS: UiStatus[] = [
    "NEW_ENQUIRY",
    "INFO_REQUESTED",
    "DISQUALIFIED",
    "REJECTED",
    "READY_TO_QUOTE",
    "QUOTE_SENT",
    "WON",
    "LOST",
  ];

  function updateStatusRecipe(status: UiStatus, idx: number, patch: Partial<TaskRecipe>) {
    setPlaybook((prev) => {
      const list = (prev.status[status] || []).slice();
      list[idx] = { ...list[idx], ...patch } as TaskRecipe;
      return { ...prev, status: { ...prev.status, [status]: list } };
    });
  }

  function addStatusRecipe(status: UiStatus) {
    setPlaybook((prev) => {
      const list = (prev.status[status] || []).slice();
      const next: TaskRecipe = {
        id: `${status.toLowerCase()}-${list.length + 1}`,
        title: "New task",
        dueInDays: 1,
        priority: "MEDIUM",
        relatedType: "LEAD",
        active: true,
      };
      return { ...prev, status: { ...prev.status, [status]: [...list, next] } };
    });
  }

  function removeStatusRecipe(status: UiStatus, idx: number) {
    setPlaybook((prev) => {
      const list = (prev.status[status] || []).slice();
      list.splice(idx, 1);
      return { ...prev, status: { ...prev.status, [status]: list } };
    });
  }

  function updateManualRecipe(key: ManualTaskKey, patch: Partial<TaskRecipe>) {
    setPlaybook((prev) => ({ ...prev, manual: { ...prev.manual, [key]: { ...prev.manual[key], ...patch } } }));
  }

  async function saveInbox() {
    setSavingInbox(true);
    try {
      await apiFetch("/tenant/settings", { method: "PATCH", json: { inbox } });
      toast({ title: "Inbox settings saved" });
    } catch (e: any) {
      toast({ title: "Failed to save inbox", description: e?.message || "" , variant: "destructive" });
    } finally {
      setSavingInbox(false);
    }
  }

  async function updateEarlyAccess(next: boolean) {
    if (!user) return;
    setUpdatingEarlyAccess(true);
    try {
      const updated = await apiFetch<CurrentUser>("/auth/me", {
        method: "PATCH",
        json: { isEarlyAdopter: next },
      });
      mutateCurrentUser(updated, false);
      toast({ title: next ? "Early access enabled" : "Early access disabled" });
    } catch (e: any) {
      toast({ title: "Couldn’t update early access", description: e?.message, variant: "destructive" });
    } finally {
      setUpdatingEarlyAccess(false);
    }
  }

  async function connectGmail() {
    const fallbackBase = API_BASE.replace(/\/$/, "");
    try {
      const resp = await apiFetch<{ authUrl?: string }>("/gmail/connect/start");
      if (resp?.authUrl) {
        window.location.href = resp.authUrl;
        return;
      }
    } catch {
      window.location.href = `${fallbackBase}/gmail/connect`;
    }
  }

  async function connectGmailUser() {
    const base = API_BASE.replace(/\/$/, "");
    // Try JSON start first
    try {
      const resp = await apiFetch<{ authUrl?: string }>("/gmail/user/connect/start");
      if (resp?.authUrl) {
        window.location.href = resp.authUrl;
        return;
      }
    } catch {}
    window.location.href = `${base}/gmail/user/connect`;
  }

  async function disconnectGmailUser() {
    try {
      await apiFetch("/gmail/user/disconnect", { method: "POST" });
      await refreshConnections();
      toast({ title: "Gmail disconnected for your user" });
    } catch (e: any) {
      toast({ title: "Disconnect failed", description: e?.message || "", variant: "destructive" });
    }
  }

  async function connectMs365() {
    const base = API_BASE.replace(/\/$/, "");
    window.location.href = `${base}/ms365/login`;
  }

  async function connectMs365User() {
    const base = API_BASE.replace(/\/$/, "");
    window.location.href = `${base}/ms365/user/connect`;
  }

  async function disconnectMs365User() {
    try {
      await apiFetch("/ms365/user/disconnect", { method: "POST" });
      await refreshConnections();
      toast({ title: "Microsoft 365 disconnected for your user" });
    } catch (e: any) {
      toast({ title: "Disconnect failed", description: e?.message || "", variant: "destructive" });
    }
  }

  async function refreshConnections() {
    try {
      const g = await apiFetch<{ ok: boolean; connection: { gmailAddress?: string | null } | null }>("/gmail/connection");
      setGmailConn(g?.connection || null);
    } catch {}
    try {
      const m = await apiFetch<{ ok: boolean; connection: { ms365Address?: string | null } | null }>("/ms365/connection");
      setMs365Conn(m?.connection || null);
    } catch {}
    try {
      const ug = await apiFetch<{ ok: boolean; connection: { gmailAddress?: string | null } | null }>("/gmail/user/connection");
      setUserGmailConn(ug?.connection || null);
    } catch {}
    try {
      const um = await apiFetch<{ ok: boolean; connection: { ms365Address?: string | null } | null }>("/ms365/user/connection");
      setUserMs365Conn(um?.connection || null);
    } catch {}
  }

  useEffect(() => {
    if (currentStage === "integrations") {
      refreshConnections();
    }
  }, [currentStage]);

  async function runImportGmail() {
    try {
      const r = await apiFetch<{ ok: boolean; imported: Array<{ createdLead: boolean }> }>("/gmail/import", {
        method: "POST",
        json: { max: 10, q: "newer_than:30d" },
      });
      const created = (r.imported || []).filter((x) => x.createdLead).length;
      toast({ title: "Gmail import complete", description: `${created} new lead(s) created.` });
    } catch (e: any) {
      toast({ title: "Gmail import failed", description: e?.message || "", variant: "destructive" });
    }
  }

  async function runImportMs365() {
    try {
      const r = await apiFetch<{ ok: boolean; imported: Array<{ createdLead: boolean }> }>("/ms365/import", {
        method: "POST",
        json: { max: 10 },
      });
      const created = (r.imported || []).filter((x) => x.createdLead).length;
      toast({ title: "Microsoft 365 import complete", description: `${created} new lead(s) created.` });
    } catch (e: any) {
      toast({ title: "MS365 import failed", description: e?.message || "", variant: "destructive" });
    }
  }

  async function enrichFromWebsite() {
    if (!(typeof s?.website === 'string' && s.website.trim())) {
      toast({ title: "Website required", description: "Please enter a website URL first", variant: "destructive" });
      return;
    }

    setEnrichingWebsite(true);
    try {
      const result = await apiFetch<{
        ok: boolean;
        settings: Settings;
        enriched: any;
      }>("/tenant/settings/enrich", {
        method: "POST",
        json: { website: s.website },
      });

      // Update settings with the saved data from backend
      if (result.settings) {
        setS(result.settings);
      }

      // Show what was found
      const enriched = result.enriched || {};
      const enrichedQD = enriched?.quoteDefaults || {};
      toast({ 
        title: "Website data imported successfully", 
        description: `Found: ${[
          enriched.brandName && "company name",
          enriched.phone && "phone number", 
          enriched.logoUrl && "logo",
          enriched.introSuggestion && "intro text",
          enriched.address && "address",
          enrichedQD.tagline && "tagline",
          enrichedQD.businessHours && "opening hours",
          enrichedQD.overview && "company overview",
          enrichedQD.guarantees?.length && "guarantees",
          enrichedQD.testimonials?.length && "testimonials",
          enrichedQD.certifications?.length && "certifications"
        ].filter(Boolean).join(", ") || "some basic info"}` 
      });
    } catch (e: any) {
      toast({ 
        title: "Failed to import website data", 
        description: e?.message || "Could not extract company information from website", 
        variant: "destructive" 
      });
    } finally {
      setEnrichingWebsite(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload PNG, JPG, WebP, SVG, or GIF", variant: "destructive" });
      return;
    }

    try {
      const form = new FormData();
      form.append('logo', file, file.name);
      const url = `${API_BASE || '/api'}/tenant/settings/upload-logo`;
      const res = await fetch(url, { method: 'POST', body: form, credentials: 'include' as RequestCredentials });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data?.error || 'Upload failed');

      // Update settings with new logo URL
      if (data.logoUrl) {
        setS((prev) => prev ? { ...prev, logoUrl: data.logoUrl } : prev);
        // Emit event so AppShell updates logo immediately
        emitTenantSettingsUpdate({ logoUrl: data.logoUrl });
        toast({ title: 'Logo uploaded successfully', description: 'Your logo has been updated' });
      }
    } catch (e: any) {
      toast({ title: 'Failed to upload logo', description: e?.message || '', variant: 'destructive' });
    } finally {
      // Reset input so same file can be reselected
      e.currentTarget.value = '';
    }
  }

  async function handleQuotePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: "Please upload a PDF", variant: "destructive" });
      return;
    }
    setUploadingQuotePdf(true);
    try {
      const form = new FormData();
      form.append('pdfFile', file, file.name);
      const url = `${API_BASE || '/api'}/tenant/settings/import-quote-pdf`;
      const res = await fetch(url, { method: 'POST', body: form, credentials: 'include' as RequestCredentials });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');

      const saved = data?.settings as Settings;
      if (saved) setS(saved);
      const extracted = data?.extracted || {};
      const filled = [
        extracted?.brandName && 'company name',
        extracted?.phone && 'phone',
        extracted?.email && 'quote email',
        extracted?.address && 'address',
        extracted?.quoteDefaults?.tagline && 'tagline',
        extracted?.quoteDefaults?.overview && 'overview',
        (extracted?.quoteDefaults?.guarantees?.length ? 'guarantees' : null),
        (extracted?.quoteDefaults?.testimonials?.length ? 'testimonials' : null),
        (extracted?.quoteDefaults?.certifications?.length ? 'certifications' : null),
      ].filter(Boolean).join(', ');
      toast({ title: 'Quote imported', description: filled ? `Extracted: ${filled}` : 'Some details were imported' });
    } catch (e: any) {
      toast({ title: 'Failed to import quote', description: e?.message || '', variant: 'destructive' });
    } finally {
      setUploadingQuotePdf(false);
      // reset input so same file can be reselected
      e.currentTarget.value = '';
    }
  }

  /* Email Templates section */
  function getTemplateDisplayName(templateKey: string): string {
    const names: Record<string, string> = {
      declineQuote: "Decline Quote",
      requestSupplierQuote: "Request Supplier Quote", 
      sendQuestionnaire: "Send Questionnaire",
      sendQuote: "Send Quote",
      followUpEmail: "Follow-up Email",
      quoteApproved: "Quote Approved",
      quoteRejected: "Quote Rejected"
    };
    return names[templateKey] || templateKey;
  }

  function getTemplateDescription(templateKey: string): string {
    const descriptions: Record<string, string> = {
      declineQuote: "Email sent when declining to provide a quote to a potential client",
      requestSupplierQuote: "Email sent to suppliers when requesting quotes for client projects",
      sendQuestionnaire: "Email sent to clients with questionnaire link for project details",
      sendQuote: "Email sent to clients when delivering their completed quote",
      followUpEmail: "Email sent to follow up on quotes that haven't received a response",
      quoteApproved: "Email sent when a client approves a quote",
      quoteRejected: "Email sent as a thank you when a client rejects a quote"
    };
    return descriptions[templateKey] || "Custom email template";
  }

  function updateEmailTemplate(templateKey: string, field: 'subject' | 'body', value: string) {
    setS((prev) => {
      if (!prev) return prev;
      
      const currentTemplates = prev.emailTemplates || {};
      const currentTemplate = currentTemplates[templateKey as keyof typeof DEFAULT_EMAIL_TEMPLATES] || 
                              DEFAULT_EMAIL_TEMPLATES[templateKey as keyof typeof DEFAULT_EMAIL_TEMPLATES];

      return {
        ...prev,
        emailTemplates: {
          ...currentTemplates,
          [templateKey]: {
            ...currentTemplate,
            [field]: value
          }
        }
      };
    });
  }

  function resetEmailTemplate(templateKey: string) {
    const defaultTemplate = DEFAULT_EMAIL_TEMPLATES[templateKey as keyof typeof DEFAULT_EMAIL_TEMPLATES];
    if (!defaultTemplate) return;
    
    setS((prev) => {
      if (!prev) return prev;
      
      const currentTemplates = prev.emailTemplates || {};
      
      return {
        ...prev,
        emailTemplates: {
          ...currentTemplates,
          [templateKey]: { ...defaultTemplate }
        }
      };
    });
    
    toast({ title: "Template reset", description: "Email template has been reset to default" });
  }

  async function previewEmailTemplate(templateKey: string) {
    if (!s) return;
    
    const template = s.emailTemplates?.[templateKey as keyof typeof DEFAULT_EMAIL_TEMPLATES] || 
                    DEFAULT_EMAIL_TEMPLATES[templateKey as keyof typeof DEFAULT_EMAIL_TEMPLATES];
    
    // Create a sample preview with placeholder data
    let previewSubject = template.subject;
    let previewBody = template.body;
    
    const sampleData: Record<string, string> = {
      '{{contactName}}': 'John Smith',
      '{{brandName}}': s.brandName || 'Your Company',
      '{{ownerName}}': `${s.ownerFirstName || 'Your'} ${s.ownerLastName || 'Name'}`,
      '{{phone}}': s.phone || 'Your Phone',
      '{{projectName}}': 'Kitchen Renovation',
      '{{deadline}}': '2 weeks',
      '{{projectDescription}}': 'Complete kitchen renovation including cabinets, countertops, and appliances',
      '{{quoteDeadline}}': 'within 3 days',
      '{{questionnaireLink}}': 'https://yourapp.com/questionnaire/123',
      '{{quoteLink}}': 'https://yourapp.com/quote/123',
      '{{quoteTotal}}': '£15,000',
      '{{quoteExpiry}}': '30 days',
      '{{quoteDate}}': 'November 1st',
      '{{startDate}}': 'Next Monday',
      '{{completionDate}}': 'End of month'
    };
    
    Object.entries(sampleData).forEach(([placeholder, value]) => {
      previewSubject = previewSubject.replace(new RegExp(placeholder, 'g'), value);
      previewBody = previewBody.replace(new RegExp(placeholder, 'g'), value);
    });
    
    alert(`EMAIL PREVIEW\n\nSubject: ${previewSubject}\n\n${previewBody}`);
  }

  async function saveEmailTemplates() {
    if (!s) return;
    
    try {
      await apiFetch("/tenant/settings", {
        method: "PATCH",
        json: { emailTemplates: s.emailTemplates },
      });
      toast({ title: "Email templates saved", description: "Your email templates have been updated successfully" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "", variant: "destructive" });
    }
  }

  // (removed unused trainModel helper)

  if (loading || !s) return <div className="p-6 text-sm text-slate-600">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex items-center gap-2">
          <a
            href="/settings/users"
            className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
          >
            👥 Users
          </a>
          {user?.isDeveloper && (
            <>
              <a
                href="/dev"
                className="inline-flex items-center gap-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium"
                target="_blank"
                rel="noopener noreferrer"
                title="Open the new Developer Dashboard"
              >
                Dev Dashboard
              </a>
              <a
                href="/admin/dev-console"
                className="inline-flex items-center gap-2 px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                Landing Editor (legacy)
              </a>
            </>
          )}
        </div>
      </div>

      {/* Stage Navigation */}
      <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1 mb-6">
        {[
          { key: "business", label: "Business", icon: "🏢", description: "Company profile and quote settings" },
          { key: "questionnaire", label: "Questionnaire", icon: "📋", description: "Lead capture form fields" },
          { key: "email-templates", label: "Email Templates", icon: "📧", description: "Customize email templates" },
          { key: "marketing", label: "Marketing", icon: "�", description: "Landing pages and SEO" },
          { key: "automation", label: "Automation", icon: "⚡", description: "Task playbooks and workflows" },
          { key: "workshop-processes", label: "Workshop", icon: "🛠️", description: "Workshop processes" },
          { key: "suppliers", label: "Suppliers", icon: "🏗️", description: "Manage supplier contacts" },
          { key: "software-profiles", label: "Software", icon: "💻", description: "PDF parsing profiles" },
          { key: "pdf-templates", label: "PDF Templates", icon: "📄", description: "View annotated PDF templates" },
          { key: "material-costs", label: "Material Costs", icon: "💰", description: "Debug material cost data" },
          { key: "integrations", label: "Integrations", icon: "🔗", description: "Email and external connections" },
        ].map((stage) => (
          <Button
            key={stage.key}
            variant={currentStage === stage.key ? "default" : "ghost"}
            onClick={() => setCurrentStage(stage.key as any)}
            className="flex-1"
          >
            <div className="flex items-center justify-center gap-2">
              <span>{stage.icon}</span>
              <span className="hidden sm:inline">{stage.label}</span>
            </div>
          </Button>
        ))}
      </div>

      <div className="rounded-xl border bg-slate-50/50 p-6">{/* Content area with background */}

      {currentStage === "business" && (
      <>
  <Section 
    title="Quick Setup" 
    description="Get started fast! Import data from your website or upload an existing quote PDF to auto-fill company details, pricing, testimonials, and more."
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Website Import */}
      <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
          🌐 Import from Website
        </h3>
        <p className="text-xs text-slate-600 mb-3">
          Extract company name, logo, phone, address, and business details from your website
        </p>
        <div className="space-y-2">
          <input
            className="w-full rounded-2xl border bg-white px-4 py-2 text-sm"
            value={s.website ?? ""}
            onChange={(e) => setS((prev) => (prev ? { ...prev, website: e.target.value } : prev))}
            placeholder="https://yourcompany.com"
          />
          <Button 
            onClick={enrichFromWebsite}
            disabled={enrichingWebsite || !(typeof s.website === 'string' && s.website.trim())}
            className="w-full"
          >
            {enrichingWebsite ? "Importing..." : "Import from Website"}
          </Button>
        </div>
      </div>

      {/* Quote PDF Import */}
      <div className="rounded-xl border bg-gradient-to-br from-purple-50 to-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
          📄 Import from Quote PDF
        </h3>
        <p className="text-xs text-slate-600 mb-3">
          Upload an existing quote/proposal to extract company info, terms, guarantees, and testimonials
        </p>
        <div className="space-y-2">
          <div className="border-2 border-dashed rounded-xl p-4 text-center bg-white hover:bg-slate-50 transition cursor-pointer">
            <input type="file" accept=".pdf" className="hidden" id="quote-pdf-upload" onChange={handleQuotePdfUpload} />
            <label htmlFor="quote-pdf-upload" className="cursor-pointer">
              <div className="text-2xl mb-1">📤</div>
              <div className="text-xs text-slate-600">Click to upload or drag & drop</div>
              <div className="text-xs text-slate-500 mt-1">PDF up to 10MB</div>
            </label>
          </div>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => document.getElementById('quote-pdf-upload')?.click()} 
            disabled={uploadingQuotePdf}
          >
            {uploadingQuotePdf ? 'Importing…' : 'Choose PDF to Import'}
          </Button>
        </div>
      </div>
    </div>
  </Section>

  {/* Setup checklist */}
  <Section 
    title="Company Details" 
    description="Core business information shown on quotes and throughout the system"
    right={<Button onClick={saveSettings} disabled={savingSettings}>{savingSettings ? "Saving…" : "Save Company"}</Button>}
  >
    {/* Missing info highlights */}
    {(() => {
      const missing: string[] = [];
      if (!(typeof s.brandName === 'string' && s.brandName.trim())) missing.push('Company name');
      if (!(typeof s.phone === 'string' && s.phone.trim())) missing.push('Phone');
      if (!(typeof s.quoteDefaults?.email === 'string' && s.quoteDefaults.email.trim())) missing.push('Quote email');
      if (!(typeof s.quoteDefaults?.address === 'string' && s.quoteDefaults.address.trim())) missing.push('Address');
      if (s.quoteDefaults?.defaultMargin == null) missing.push('Default margin');
      if (s.quoteDefaults?.vatRate == null) missing.push('VAT rate');
      if (!(typeof s.quoteDefaults?.tagline === 'string' && s.quoteDefaults.tagline.trim())) missing.push('Tagline');
      if (!(typeof s.quoteDefaults?.overview === 'string' && s.quoteDefaults.overview.trim())) missing.push('Company overview');
      if (!(s.quoteDefaults?.guarantees || []).length) missing.push('Guarantees');
      if (!(s.quoteDefaults?.testimonials || []).length) missing.push('Testimonials');
      return missing.length ? (
        <div className="mb-4 rounded-xl border bg-amber-50 p-3 text-xs text-amber-800">
          Missing info to complete setup: {missing.map((m, i) => (
            <span key={i} className="inline-block bg-amber-100 border border-amber-200 text-amber-900 rounded-full px-2 py-0.5 mr-1 mb-1">
              {m}
            </span>
          ))}
        </div>
      ) : null;
    })()}
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="Company name" required>
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.brandName ?? ""}
          onChange={(e) => setS((prev) => (prev ? { ...prev, brandName: e.target.value } : prev))}
        />
      </Field>
      <Field label="Website">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.website ?? ""}
          onChange={(e) => setS((prev) => (prev ? { ...prev, website: e.target.value } : prev))}
          placeholder="https://yourcompany.com"
        />
      </Field>
      <Field label="Phone" required>
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.phone ?? ""}
          onChange={(e) => setS((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
        />
      </Field>
      <Field label="Quote Email" required hint="Contact email shown on proposals">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.email ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, email: e.target.value } } : prev)}
          placeholder="quotes@company.com"
        />
      </Field>
      <Field label="Owner first name">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={profileFirstName}
          onChange={(e) => setProfileFirstName(e.target.value)}
        />
      </Field>
      <Field label="Owner last name">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={profileLastName}
          onChange={(e) => setProfileLastName(e.target.value)}
        />
      </Field>
      <Field label="Logo URL" hint="Auto-populated from website import or upload your own">
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 rounded-2xl border bg-white/95 px-4 py-2 text-sm"
            value={s.logoUrl ?? ""}
            onChange={(e) => setS((prev) => (prev ? { ...prev, logoUrl: e.target.value } : prev))}
            placeholder="https://example.com/logo.png"
          />
          <label className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              className="hidden"
              onChange={handleLogoUpload}
            />
            📤 Upload
          </label>
          {s.logoUrl && (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded border overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.logoUrl}
                alt="Logo preview"
                className="w-full h-full object-contain"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </span>
          )}
        </div>
      </Field>
      <Field label="Tagline" hint="Appears on PDF proposals">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.tagline ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, tagline: e.target.value } } : prev)}
          placeholder="Timber Joinery Specialists"
        />
      </Field>
      <Field label="Business Address" className="md:col-span-2">
        <textarea
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm min-h-[60px]"
          value={s.quoteDefaults?.address ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, address: e.target.value } } : prev)}
          placeholder="123 Business Street, City, Postcode"
        />
      </Field>
      <Field label="Business Hours">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.businessHours ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, businessHours: e.target.value } } : prev)}
          placeholder="Monday-Friday 9am-5pm"
        />
      </Field>
      <Field label="Company Overview" hint="About your company section on proposals" className="md:col-span-2">
        <textarea
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm min-h-[100px]"
          value={s.quoteDefaults?.overview ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, overview: e.target.value } } : prev)}
          placeholder="We are a specialist in bespoke timber joinery..."
        />
      </Field>
    </div>
  </Section>

  <Section title="Social Proof" description="Review metrics and local service area shown on public estimator and landing pages" right={<Button onClick={saveSettings} disabled={savingSettings}>{savingSettings ? "Saving…" : "Save Social Proof"}</Button>}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Average Review Score" hint="Typical range 4.5 – 5.0">
        <input
          type="number"
          step="0.01"
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.reviewScore == null ? "" : s.reviewScore}
          onChange={(e) => setS((prev) => prev ? { ...prev, reviewScore: e.target.value === "" ? null : Number(e.target.value) } : prev)}
          placeholder="4.9"
        />
      </Field>
      <Field label="Total Reviews" hint="Total count across the source">
        <input
          type="number"
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.reviewCount == null ? "" : s.reviewCount}
          onChange={(e) => setS((prev) => prev ? { ...prev, reviewCount: e.target.value === "" ? null : Number(e.target.value) } : prev)}
          placeholder="182"
        />
      </Field>
      <Field label="Review Source Label" hint="e.g. Google Reviews, Trustpilot">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.reviewSourceLabel ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, reviewSourceLabel: e.target.value } : prev)}
          placeholder="Google Reviews"
        />
      </Field>
      <Field label="Service Area" hint="Key cities / regions you cover">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.serviceArea ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, serviceArea: e.target.value } : prev)}
          placeholder="London • Surrey • Kent"
        />
      </Field>
    </div>
  </Section>

  <Section title="Quote & Pricing Settings" description="Configure default pricing, VAT, and proposal settings">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field label="Currency">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.currency ?? "GBP"}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, currency: e.target.value } } : prev)}
          placeholder="GBP"
        />
      </Field>
      <Field label="Default Margin %" hint="e.g., 0.25 for 25%">
        <input
          type="number"
          step="0.01"
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.defaultMargin ?? 0.25}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, defaultMargin: Number(e.target.value) } } : prev)}
        />
      </Field>
      <Field label="VAT Rate %" hint="e.g., 0.20 for 20%">
        <input
          type="number"
          step="0.01"
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.vatRate ?? 0.2}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, vatRate: Number(e.target.value) } } : prev)}
        />
      </Field>
      <Field label="Valid for (days)">
        <input
          type="number"
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.validDays ?? 30}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, validDays: Number(e.target.value) } } : prev)}
        />
      </Field>
      <Field label="Delivery Info">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.delivery ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, delivery: e.target.value } } : prev)}
          placeholder="6-8 weeks"
        />
      </Field>
      <Field label="Installation Info">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.installation ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, installation: e.target.value } } : prev)}
          placeholder="Professional installation available"
        />
      </Field>
    </div>
    <div className="mt-4 space-y-2">
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={s.quoteDefaults?.showVat !== false}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, showVat: e.target.checked } } : prev)}
        />
        Show VAT on quotes
      </label>
      <label className="inline-flex items-center gap-2 text-sm ml-4">
        <input
          type="checkbox"
          checked={s.quoteDefaults?.showLineItems !== false}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, showLineItems: e.target.checked } } : prev)}
        />
        Show individual line item prices
      </label>
    </div>
  </Section>

  <Section title="Product Specifications" description="Default specifications for quotes">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Default Timber">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.defaultTimber ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, defaultTimber: e.target.value } } : prev)}
          placeholder="Engineered timber"
        />
      </Field>
      <Field label="Default Finish">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.defaultFinish ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, defaultFinish: e.target.value } } : prev)}
          placeholder="Factory finished"
        />
      </Field>
      <Field label="Default Glazing">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.defaultGlazing ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, defaultGlazing: e.target.value } } : prev)}
          placeholder="Low-energy double glazing"
        />
      </Field>
      <Field label="Default Fittings">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.defaultFittings ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, defaultFittings: e.target.value } } : prev)}
          placeholder="Premium hardware"
        />
      </Field>
      <Field label="Compliance Standards" hint="e.g., CE marked, Building Regulations" className="md:col-span-2">
        <input
          className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
          value={s.quoteDefaults?.compliance ?? ""}
          onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, compliance: e.target.value } } : prev)}
          placeholder="Industry standards"
        />
      </Field>
    </div>
  </Section>

  <Section title="Terms & Conditions" description="Legal terms that appear on proposals">
    <Field label="Terms">
      <textarea
        className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm min-h-[120px]"
        value={s.quoteDefaults?.terms ?? ""}
        onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, terms: e.target.value } } : prev)}
        placeholder="Prices are valid for 30 days and subject to site survey. Payment terms: 50% upfront, 50% on delivery..."
      />
    </Field>
  </Section>

  <Section title="Guarantees" description="Guarantees shown on proposals">
    <Field label="Guarantee Section Title">
      <input
        className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm mb-3"
        value={s.quoteDefaults?.guaranteeTitle ?? ""}
        onChange={(e) => setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, guaranteeTitle: e.target.value } } : prev)}
        placeholder="Our Guarantee"
      />
    </Field>
    <div className="space-y-3">
      {(s.quoteDefaults?.guarantees || []).map((g, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            className="flex-1 rounded-2xl border bg-white/95 px-3 py-2 text-sm"
            placeholder="Guarantee title"
            value={String(g.title || "")}
            onChange={(e) => {
              const updated = [...(s.quoteDefaults?.guarantees || [])];
              updated[idx] = { ...updated[idx], title: e.target.value };
              setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, guarantees: updated } } : prev);
            }}
          />
          <input
            className="flex-[2] rounded-2xl border bg-white/95 px-3 py-2 text-sm"
            placeholder="Description"
            value={String(g.description || "")}
            onChange={(e) => {
              const updated = [...(s.quoteDefaults?.guarantees || [])];
              updated[idx] = { ...updated[idx], description: e.target.value };
              setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, guarantees: updated } } : prev);
            }}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              const updated = (s.quoteDefaults?.guarantees || []).filter((_, i) => i !== idx);
              setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, guarantees: updated } } : prev);
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const updated = [...(s.quoteDefaults?.guarantees || []), { title: "", description: "" }];
          setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, guarantees: updated } } : prev);
        }}
      >
        Add Guarantee
      </Button>
    </div>
  </Section>

  <Section title="Testimonials" description="Customer testimonials shown on proposals and public estimator">
    <div className="space-y-3">
      {(s.quoteDefaults?.testimonials || []).map((t, idx) => (
        <div key={idx} className="border rounded-xl p-3 bg-white/60 flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-xl border bg-slate-100 overflow-hidden flex items-center justify-center text-xs text-slate-500">
              {t.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.photoUrl} alt={String(t.client || 'photo')} className="w-full h-full object-cover" />
              ) : t.photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.photoDataUrl} alt={String(t.client || 'photo')} className="w-full h-full object-cover" />
              ) : (
                <span>{String(t.client || 'Client').slice(0,1)}</span>
              )}
            </div>
            <textarea
              className="flex-1 rounded-2xl border bg-white/95 px-3 py-2 text-sm min-h-[60px]"
              placeholder="Testimonial quote"
              value={String(t.quote || "")}
              onChange={(e) => {
                const updated = [...(s.quoteDefaults?.testimonials || [])];
                updated[idx] = { ...updated[idx], quote: e.target.value };
                setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 rounded-2xl border bg-white/95 px-3 py-2 text-sm"
              placeholder="Client name"
              value={String(t.client || "")}
              onChange={(e) => {
                const updated = [...(s.quoteDefaults?.testimonials || [])];
                updated[idx] = { ...updated[idx], client: e.target.value };
                setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
              }}
            />
            <input
              className="flex-1 rounded-2xl border bg-white/95 px-3 py-2 text-sm"
              placeholder="Role (optional)"
              value={String(t.role || "")}
              onChange={(e) => {
                const updated = [...(s.quoteDefaults?.testimonials || [])];
                updated[idx] = { ...updated[idx], role: e.target.value };
                setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
              }}
            />
            <label className="inline-flex items-center gap-2 text-xs font-medium">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Attempt upload to backend storage; fallback to base64 inline
                  try {
                    const form = new FormData();
                    form.append('photo', file, file.name);
                    const uploadUrl = `${API_BASE || '/api'}/tenant/settings/testimonials/${idx}/photo`;
                    const resp = await fetch(uploadUrl, { method: 'POST', body: form, credentials: 'include' as RequestCredentials });
                    const data = await resp.json();
                    if (!resp.ok || !data.photoUrl) throw new Error(data.error || 'upload_failed');
                    const updated = [...(s.quoteDefaults?.testimonials || [])];
                    updated[idx] = { ...updated[idx], photoUrl: data.photoUrl };
                    delete (updated[idx] as any).photoDataUrl;
                    setS(prev => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
                  } catch (err) {
                    console.error('testimonial photo upload failed, falling back to base64', err);
                    const reader = new FileReader();
                    reader.onload = () => {
                      const updated = [...(s.quoteDefaults?.testimonials || [])];
                      updated[idx] = { ...updated[idx], photoDataUrl: reader.result as string };
                      setS(prev => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={(ev) => {
                  const input = (ev.currentTarget.parentElement?.querySelector('input[type=file]')) as HTMLInputElement | null;
                  input?.click();
                }}
              >
                {t.photoUrl || t.photoDataUrl ? 'Change Photo' : 'Add Photo'}
              </Button>
            </label>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                const updated = (s.quoteDefaults?.testimonials || []).filter((_, i) => i !== idx);
                setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
              }}
            >
              Remove
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const url = `${API_BASE || '/api'}/tenant/settings/testimonials/${idx}/clear-photo`;
                  const resp = await fetch(url, { method: 'POST', credentials: 'include' as RequestCredentials });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data?.error || 'Clear failed');
                  const updated = [...(s.quoteDefaults?.testimonials || [])];
                  const next = { ...updated[idx] } as any;
                  delete next.photoUrl;
                  delete next.photoDataUrl;
                  updated[idx] = next;
                  setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
                  toast({ title: 'Photo removed', description: 'Testimonial will show initials fallback' });
                } catch (e: any) {
                  toast({ title: 'Failed to remove photo', description: e?.message || '', variant: 'destructive' });
                }
              }}
            >
              Remove Photo
            </Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const updated = [...(s.quoteDefaults?.testimonials || []), { quote: "", client: "", role: "" }];
            setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
          }}
        >
          Add Testimonial
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const updated = [
              { quote: 'Outstanding craftsmanship and attention to detail.', client: 'Sarah W.', role: 'Interior Designer' },
              { quote: 'Delivered on time and the quality exceeded expectations.', client: 'Mark R.', role: 'Property Developer' },
              { quote: 'Professional, responsive, and superb finish.', client: 'Helen T.', role: 'Homeowner' },
            ];
            setS(prev => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, testimonials: updated } } : prev);
          }}
        >
          Reset Placeholders
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            try {
              const url = `${API_BASE || '/api'}/tenant/settings/testimonials/migrate-photos`;
              const resp = await fetch(url, { method: 'POST', credentials: 'include' as RequestCredentials });
              const data = await resp.json();
              if (!resp.ok) throw new Error(data?.error || 'Migration failed');
              setS(prev => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, ...(data.quoteDefaults || {}) } } : prev);
              toast({ title: 'Migrated testimonial photos', description: `${data.migrated || 0} item(s) converted to stored photos` });
            } catch (e: any) {
              toast({ title: 'Migration failed', description: e?.message || '', variant: 'destructive' });
            }
          }}
        >
          Migrate Photos to Storage
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            try {
              const resp = await apiFetch<Settings>("/tenant/settings", { method: 'PATCH', json: { quoteDefaults: { ...(s.quoteDefaults || {}), testimonials: s.quoteDefaults?.testimonials || [] } } });
              setS(resp);
              toast({ title: 'Testimonials saved' });
            } catch (e: any) {
              toast({ title: 'Save failed', description: e?.message || '', variant: 'destructive' });
            }
          }}
        >
          Save Testimonials
        </Button>
      </div>
    </div>
  </Section>

  <Section title="Certifications & Accreditations" description="Industry certifications shown on proposals">
    <div className="space-y-3">
      {(s.quoteDefaults?.certifications || []).map((c, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            className="flex-1 rounded-2xl border bg-white/95 px-3 py-2 text-sm"
            placeholder="Certification name"
            value={String(c.name || "")}
            onChange={(e) => {
              const updated = [...(s.quoteDefaults?.certifications || [])];
              updated[idx] = { ...updated[idx], name: e.target.value };
              setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, certifications: updated } } : prev);
            }}
          />
          <input
            className="flex-[2] rounded-2xl border bg-white/95 px-3 py-2 text-sm"
            placeholder="Description"
            value={String(c.description || "")}
            onChange={(e) => {
              const updated = [...(s.quoteDefaults?.certifications || [])];
              updated[idx] = { ...updated[idx], description: e.target.value };
              setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, certifications: updated } } : prev);
            }}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              const updated = (s.quoteDefaults?.certifications || []).filter((_, i) => i !== idx);
              setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, certifications: updated } } : prev);
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const updated = [...(s.quoteDefaults?.certifications || []), { name: "", description: "" }];
          setS((prev) => prev ? { ...prev, quoteDefaults: { ...prev.quoteDefaults, certifications: updated } } : prev);
        }}
      >
        Add Certification
      </Button>
    </div>
  </Section>
  
  <Section title="Early Access">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={!!user?.isEarlyAdopter}
        disabled={updatingEarlyAccess}
        onChange={(e) => updateEarlyAccess(e.target.checked)}
      />
      <span>{user?.isEarlyAdopter ? "Enabled" : "Disabled"}</span>
    </label>
  </Section>

  <Section title="Fire Door Calculator" description="Enable advanced fire door costing and pricing calculator">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={!!s?.isFireDoorManufacturer}
        disabled={savingFireDoor}
        onChange={(e) => handleFireDoorToggle(e.target.checked)}
      />
      <span>Enable Fire Door Calculator feature</span>
    </label>
    {savingFireDoor && (
      <p className="text-xs text-slate-500 mt-1">Saving…</p>
    )}
    <p className="text-xs text-slate-600 mt-2">
      When enabled, a "Fire Door Calculator" link will appear in the main navigation for quick access to the fire door pricing tool.
    </p>
  </Section>

  <Section title="Group Coaching Hub" description="Enable access to the coaching and planning features">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={!!s?.isGroupCoachingMember}
        disabled={savingCoaching}
        onChange={(e) => handleCoachingToggle(e.target.checked)}
      />
      <span>Enable Coaching Hub feature</span>
    </label>
    {savingCoaching && (
      <p className="text-xs text-slate-500 mt-1">Saving…</p>
    )}
    <p className="text-xs text-slate-600 mt-2">
      When enabled, a "Coaching Hub" link will appear in the main navigation for owners to access goal planning, coaching notes, and financial planning tools.
    </p>
  </Section>
  </>
      )}

      {currentStage === "questionnaire" && (
      <Section 
        title="Questionnaire Fields" 
        description="Configure fields across scopes. Drag to reorder, click to edit inline."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {([
              { key: "client", label: "Client Info" },
              { key: "public", label: "Public Questionnaire" },
              { key: "internal", label: "Internal" },
              { key: "manufacturing", label: "Manufacturing" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setQScopeTab(key)}
                className={`px-3 py-1 rounded-full text-xs border ${qScopeTab === key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <AdminQuestionnaireFieldsTable apiBase={API_BASE} scope={qScopeTab} />
        </div>
      </Section>
      )}

      {/* Old questionnaire editor removed - now using AdminQuestionnaireFieldsTable */}
      {false && (
      <div className="hidden">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            className="w-64 rounded-2xl border bg-white/95 px-3 py-2 text-sm"
            placeholder="Search questions…"
            value={qSearch}
            onChange={(e) => setQSearch(e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={qHideInternal} onChange={(e) => setQHideInternal(e.target.checked)} />
            Hide internal-only
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={qOnlyPublic} onChange={(e) => setQOnlyPublic(e.target.checked)} />
            Show only public form fields
          </label>
        </div>
        <div className="space-y-3">
          {qFields.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
              No questions yet.
            </div>
          ) : (
            Object.entries(
              qFields.reduce((acc: Record<string, QField[]>, f) => {
                const g = (f.group || "(Ungrouped)").trim();
                if (!acc[g]) acc[g] = [];
                acc[g].push(f);
                return acc;
              }, {})
            ).map(([groupName, fields]) => (
              <div key={groupName} className="rounded-xl border bg-white/80">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="text-sm font-semibold text-slate-800">
                    {groupName}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [groupName]: !(prev[groupName] ?? true) }))}
                  >
                    {(openGroups[groupName] ?? true) ? "Collapse" : "Expand"}
                  </Button>
                </div>
                {(openGroups[groupName] ?? true) && (
                  <div className="space-y-3 border-t px-3 py-3">
                    {fields
                      .filter((f) => (qHideInternal ? !f.internalOnly : true))
                      .filter((f) => (qOnlyPublic ? f.askInQuestionnaire !== false && !f.internalOnly : true))
                      .filter((f) => {
                        const hay = `${f.key} ${f.label} ${f.group || ""}`.toLowerCase();
                        const q = qSearch.trim().toLowerCase();
                        return !q || hay.includes(q);
                      })
                      .map((f) => {
                        const idx = qFields.findIndex((q) => (q.id && f.id ? q.id === f.id : q.key === f.key));
                        return (
              <div key={f.id || idx} className="flex flex-wrap items-center gap-2">
                <input
                  className="w-36 rounded-2xl border bg-white/95 px-3 py-2 text-sm"
                  value={f.key}
                  onChange={(e) =>
                    setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, key: e.target.value } : p)))
                  }
                />
                <input
                  className="flex-1 rounded-2xl border bg-white/95 px-3 py-2 text-sm"
                  value={f.label}
                  onChange={(e) =>
                    setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))
                  }
                />
                <select
                  className="rounded-2xl border bg-white/95 px-3 py-2 text-sm"
                  value={f.type}
                  onChange={(e) => {
                    const newType = e.target.value as QField["type"];
                    setQFields((prev) =>
                      prev.map((p, i) =>
                        i === idx
                          ? {
                              ...p,
                              type: newType,
                              options: newType === "select" ? (p.options ?? []) : p.options,
                            }
                          : p
                      )
                    );
                  }}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) =>
                      setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, required: e.target.checked } : p)))
                    }
                  />
                  Required
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={f.askInQuestionnaire !== false && !f.internalOnly}
                    onChange={(e) =>
                      setQFields((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, askInQuestionnaire: e.target.checked, internalOnly: e.target.checked ? false : p.internalOnly } : p
                        )
                      )
                    }
                  />
                  Show on public form
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!f.showOnLead}
                    onChange={(e) =>
                      setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, showOnLead: e.target.checked } : p)))
                    }
                  />
                  Show in lead
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!f.internalOnly}
                    onChange={(e) =>
                      setQFields((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, internalOnly: e.target.checked, askInQuestionnaire: e.target.checked ? false : p.askInQuestionnaire } : p
                        )
                      )
                    }
                  />
                  Internal-only
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!f.visibleAfterOrder}
                    onChange={(e) =>
                      setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, visibleAfterOrder: e.target.checked } : p)))
                    }
                  />
                  Show after order (WON)
                </label>
                <input
                  className="w-40 rounded-2xl border bg-white/95 px-3 py-2 text-sm"
                  placeholder="Group (optional)"
                  value={f.group || ""}
                  onChange={(e) => setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, group: e.target.value } : p)))}
                />
                {f.type === "select" ? (
                  <div className="w-full mt-2 flex flex-wrap items-center gap-2">
                    {(f.options ?? []).map((opt, optIdx) => (
                      <div key={optIdx} className="inline-flex items-center gap-2">
                        <input
                          className="rounded-2xl border bg-white/95 px-3 py-2 text-sm"
                          value={opt}
                          onChange={(e) =>
                            setQFields((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? { ...p, options: (p.options ?? []).map((o, j) => (j === optIdx ? e.target.value : o)) }
                                  : p
                              )
                            )
                          }
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          type="button"
                          onClick={() =>
                            setQFields((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, options: (p.options ?? []).filter((_, j) => j !== optIdx) } : p))
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, options: [...(p.options ?? []), ""] } : p)))}
                    >
                      Add Option
                    </Button>
                  </div>
                ) : null}
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  onClick={() => setQFields((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </Button>
              </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ))
          )}

          <div>
            <Button
              variant="outline"
              onClick={() =>
                setQFields((prev) => [
                  ...prev,
                  { id: makeFieldId(), key: `field_${prev.length + 1}`, label: `Field ${prev.length + 1}`, type: "text" },
                ])
              }
            >
              Add question
            </Button>
          </div>

          <div className="mt-3">
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving settings…" : "Save questionnaire"}
            </Button>
          </div>
        </div>
      </div>
      )}

      {currentStage === "email-templates" && (
        <Section title="Email Templates" description="Customize the email templates used throughout your CRM. Use template variables like {{contactName}}, {{brandName}}, {{ownerName}}, {{phone}}, etc.">
          <div className="space-y-6">
            {/* Questionnaire Intro HTML */}
            <div className="rounded-xl border bg-white/70 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-800 mb-1">
                  Questionnaire Intro HTML
                </h3>
                <p className="text-xs text-slate-600">
                  Optional HTML shown at the top of the public questionnaire page
                </p>
              </div>
              <Field label="Intro HTML">
                <textarea
                  className="w-full rounded-2xl border bg-white/95 px-4 py-3 text-sm min-h-[100px] font-mono text-xs"
                  value={s.introHtml ?? ""}
                  onChange={(e) => setS((prev) => (prev ? { ...prev, introHtml: e.target.value } : prev))}
                  placeholder="<p>Welcome! Please fill out this form...</p>"
                />
              </Field>
              <div className="mt-3">
                <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? "Saving..." : "Save Intro HTML"}
                </Button>
              </div>
            </div>

            {Object.entries(DEFAULT_EMAIL_TEMPLATES).map(([templateKey, defaultTemplate]) => {
              const currentTemplate = s.emailTemplates?.[templateKey as keyof typeof DEFAULT_EMAIL_TEMPLATES] || defaultTemplate;
              
              return (
                <div key={templateKey} className="rounded-xl border bg-white/70 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">
                      {getTemplateDisplayName(templateKey)}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {getTemplateDescription(templateKey)}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <Field label="Subject Line">
                      <input
                        className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
                        value={currentTemplate.subject}
                        onChange={(e) => updateEmailTemplate(templateKey, 'subject', e.target.value)}
                        placeholder={defaultTemplate.subject}
                      />
                    </Field>
                    
                    <Field label="Email Body">
                      <textarea
                        className="w-full rounded-2xl border bg-white/95 px-4 py-3 text-sm min-h-[120px]"
                        value={currentTemplate.body}
                        onChange={(e) => updateEmailTemplate(templateKey, 'body', e.target.value)}
                        placeholder={defaultTemplate.body}
                      />
                    </Field>
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => resetEmailTemplate(templateKey)}
                    >
                      Reset to Default
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => previewEmailTemplate(templateKey)}
                    >
                      Preview
                    </Button>
                  </div>
                </div>
              );
            })}
            
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={saveEmailTemplates}>
                Save Email Templates
              </Button>
            </div>
          </div>
        </Section>
      )}

      {currentStage === "marketing" && (
        <Section 
          title="Landing Pages & SEO" 
          description="Create and manage your conversion-optimized landing pages"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Build beautiful, SEO-optimized landing pages for your business with the visual editor:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li>Visual WYSIWYG editor for content</li>
              <li>Image gallery management</li>
              <li>Customer reviews showcase</li>
              <li>SEO optimization tools</li>
              <li>Preview before publishing</li>
            </ul>
            <div className="flex gap-3 pt-2">
              <a
                href="/admin/tenants"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Open Landing Page Editor →
              </a>
              {s?.slug && (
                <a
                  href={`/tenant/${s.slug}/landing`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  View Your Landing Page →
                </a>
              )}
              <a
                href="/admin/example-photos"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
                title="Manage curated inspiration photos for the public estimator"
              >
                Manage Example Photos →
              </a>
            </div>
          </div>
        </Section>
      )}

      {currentStage === "automation" && (
      <Section title="Task Automation" description="Automate task creation based on field changes and status updates">
        <div className="space-y-6">
          <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-white p-6 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Task Automation Rules
            </h3>
            <p className="text-sm text-slate-600 mb-4 max-w-2xl mx-auto">
              Create powerful automation rules that automatically generate tasks when fields change or statuses update.
              Perfect for triggering follow-ups, reminders, and workflow actions.
            </p>
            <div className="flex justify-center gap-3">
              <a
                href="/settings/automation"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Open Automation Builder →
              </a>
            </div>
          </div>

          <div className="rounded-xl border bg-white/70 p-5">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">
              Migration from Task Playbook
            </h4>
            <p className="text-sm text-slate-600 mb-4">
              The new automation system replaces the old task playbook with more powerful, flexible rules. 
              You can replicate all playbook functionality by creating automation rules:
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="text-2xl">1️⃣</span>
                <div>
                  <strong>Status Change Tasks:</strong>
                  <p className="text-slate-600 mt-1">
                    Create a rule with trigger "Status Changed" → choose entity (Lead/Opportunity) → 
                    select the status (e.g., "QUOTE_SENT") → action "Create Task" with your task details.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">2️⃣</span>
                <div>
                  <strong>Field Update Tasks:</strong>
                  <p className="text-slate-600 mt-1">
                    Create a rule with trigger "Field Updated" → choose field (e.g., "deliveryDate") → 
                    action "Create Task" with relative date calculation (e.g., 20 days before delivery).
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">3️⃣</span>
                <div>
                  <strong>Auto-rescheduling:</strong>
                  <p className="text-slate-600 mt-1">
                    Enable "Automatically reschedule task if trigger field changes" to keep tasks synchronized 
                    with changing dates and values.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-amber-50 p-4">
            <div className="flex gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <strong className="text-sm text-amber-900">Example Use Cases:</strong>
                <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Order materials 20 days before completion date</li>
                  <li>Send follow-up email 7 days after quote sent</li>
                  <li>Schedule site visit when opportunity moves to "READY_TO_QUOTE"</li>
                  <li>Request customer feedback 14 days after project completion</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>
      )}

      {currentStage === "workshop-processes" && (
        <Section
          title="Workshop Processes"
          description="Create and manage your tenant's workshop processes. These can be auto-assigned to projects and used in scheduling."
          right={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={seedDefaultProcesses} disabled={procSavingId === "seed"}>
                {procSavingId === "seed" ? "Seeding…" : "Seed defaults"}
              </Button>
              <Button onClick={refreshProcesses} variant="outline" disabled={procLoading}>
                Refresh
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* New row */}
            <div className="rounded-xl border bg-white/80 p-3 overflow-x-auto">
              <div className="mb-2 text-sm font-semibold text-slate-800">Add process</div>
              <div className="min-w-[1600px] grid grid-cols-[140px_1fr_80px_140px_100px_120px_120px_120px_140px_140px_180px] items-center gap-2">
                <input
                  className="rounded-xl border bg-white/95 px-3 py-2 text-sm uppercase tracking-wide"
                  placeholder="CODE"
                  value={newProcess.code}
                  onChange={(e) => setNewProcess((p) => ({ ...p, code: e.target.value }))}
                />
                <input
                  className="rounded-xl border bg-white/95 px-3 py-2 text-sm"
                  placeholder="Name"
                  value={newProcess.name}
                  onChange={(e) => setNewProcess((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  type="number"
                  className="rounded-xl border bg-white/95 px-3 py-2 text-sm"
                  placeholder="0"
                  value={newProcess.sortOrder}
                  onChange={(e) => setNewProcess((p) => ({ ...p, sortOrder: Number(e.target.value || 0) }))}
                />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!newProcess.requiredByDefault}
                    onChange={(e) => setNewProcess((p) => ({ ...p, requiredByDefault: e.target.checked }))}
                  />
                  Required by default
                </label>
                <input
                  type="number"
                  className="rounded-xl border bg-white/95 px-3 py-2 text-sm"
                  placeholder="Hours"
                  value={newProcess.estimatedHours ?? ""}
                  onChange={(e) => setNewProcess((p) => ({ ...p, estimatedHours: e.target.value === "" ? null : Number(e.target.value) }))}
                />
                <label className="inline-flex items-center gap-2 text-sm" title="This process determines the project's schedule color">
                  <input
                    type="checkbox"
                    checked={!!newProcess.isColorKey}
                    onChange={(e) => setNewProcess((p) => ({ ...p, isColorKey: e.target.checked }))}
                  />
                  Color key
                </label>
                <label className="inline-flex items-center gap-2 text-sm" title="Generic processes don't require a project (e.g., Holiday, Sick Leave)">
                  <input
                    type="checkbox"
                    checked={!!newProcess.isGeneric}
                    onChange={(e) => setNewProcess((p) => ({ ...p, isGeneric: e.target.checked }))}
                  />
                  Generic
                </label>
                <label className="inline-flex items-center gap-2 text-sm" title="Last manufacturing process triggers project completion">
                  <input
                    type="checkbox"
                    checked={!!newProcess.isLastManufacturing}
                    onChange={(e) => setNewProcess((p) => ({ ...p, isLastManufacturing: e.target.checked }))}
                  />
                  Last Mfg
                </label>
                <label className="inline-flex items-center gap-2 text-sm" title="Last installation process triggers full project completion">
                  <input
                    type="checkbox"
                    checked={!!newProcess.isLastInstallation}
                    onChange={(e) => setNewProcess((p) => ({ ...p, isLastInstallation: e.target.checked }))}
                  />
                  Last Install
                </label>
                <input
                  className="rounded-xl border bg-white/95 px-3 py-2 text-sm"
                  placeholder="Group"
                  title="Assignment group (e.g., PRODUCTION). Assigning a user to one process assigns to all in group."
                  value={newProcess.assignmentGroup ?? ""}
                  onChange={(e) => setNewProcess((p) => ({ ...p, assignmentGroup: e.target.value || null }))}
                />
                <div className="flex gap-2 justify-end">
                  <Button onClick={createProcess} disabled={procSavingId === "new"}>Create</Button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="rounded-xl border bg-white/80 overflow-x-auto">
              <div className="min-w-[1600px]">
                <div className="grid grid-cols-[140px_1fr_80px_140px_100px_120px_120px_140px_140px_120px_180px] items-center gap-2 px-3 py-2 border-b text-[12px] text-slate-600 font-medium">
                  <div>Code</div>
                  <div>Name</div>
                  <div>Sort</div>
                  <div>Required by default</div>
                  <div>Est. hours</div>
                  <div>Color key</div>
                  <div>Generic</div>
                  <div>Last Mfg</div>
                  <div>Last Install</div>
                  <div>Group</div>
                  <div className="text-right">Actions</div>
                </div>
                {procLoading ? (
                  <div className="px-3 py-4 text-sm text-slate-600">Loading…</div>
                ) : processes.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-slate-600">No processes yet.</div>
                ) : (
                  <div className="divide-y">
                    {processes.map((p, idx) => (
                      <div key={p.id} className="grid grid-cols-[140px_1fr_80px_140px_100px_120px_120px_140px_140px_120px_180px] items-center gap-2 px-3 py-2">
                      <input
                        className="rounded-xl border bg-white/95 px-3 py-1.5 text-sm uppercase"
                        value={p.code}
                        onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, code: e.target.value } : it)))}
                      />
                      <input
                        className="rounded-xl border bg-white/95 px-3 py-1.5 text-sm"
                        value={p.name}
                        onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, name: e.target.value } : it)))}
                      />
                      <input
                        type="number"
                        className="rounded-xl border bg-white/95 px-3 py-1.5 text-sm"
                        value={p.sortOrder ?? 0}
                        onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, sortOrder: Number(e.target.value || 0) } : it)))}
                      />
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!p.requiredByDefault}
                          onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, requiredByDefault: e.target.checked } : it)))}
                        />
                        Required by default
                      </label>
                      <input
                        type="number"
                        className="rounded-xl border bg-white/95 px-3 py-1.5 text-sm"
                        value={p.estimatedHours ?? ""}
                        onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, estimatedHours: e.target.value === "" ? null : Number(e.target.value) } : it)))}
                      />
                      <label className="inline-flex items-center gap-2 text-sm" title="This process determines the project's schedule color">
                        <input
                          type="checkbox"
                          checked={!!p.isColorKey}
                          onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, isColorKey: e.target.checked } : it)))}
                        />
                        Color key
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm" title="Generic processes don't require a project">
                        <input
                          type="checkbox"
                          checked={!!p.isGeneric}
                          onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, isGeneric: e.target.checked } : it)))}
                        />
                        Generic
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm" title="Last manufacturing process">
                        <input
                          type="checkbox"
                          checked={!!p.isLastManufacturing}
                          onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, isLastManufacturing: e.target.checked } : it)))}
                        />
                        Last Mfg
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm" title="Last installation process">
                        <input
                          type="checkbox"
                          checked={!!p.isLastInstallation}
                          onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, isLastInstallation: e.target.checked } : it)))}
                        />
                        Last Install
                      </label>
                      <input
                        className="rounded-xl border bg-white/95 px-3 py-1.5 text-sm"
                        placeholder="Group"
                        title="Assignment group (e.g., PRODUCTION). Assigning a user to one process assigns to all in group."
                        value={p.assignmentGroup ?? ""}
                        onChange={(e) => setProcesses((prev) => prev.map((it) => (it.id === p.id ? { ...it, assignmentGroup: e.target.value || null } : it)))}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => updateProcess(p)} disabled={procSavingId === p.id}>Save</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteProcess(p.id)} disabled={procSavingId === p.id}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        </Section>
      )}

      {currentStage === "suppliers" && (
      <>
      <Section title="Suppliers" description="Manage your supplier contacts for outsourcing quote requests">
        <SuppliersSection />
      </Section>
      </>
      )}

      {currentStage === "software-profiles" && (
        <Section title="Software Profiles" description="Manage parsing profiles for software-generated quotes">
          <SoftwareProfilesSection />
        </Section>
      )}

      {currentStage === "pdf-templates" && (
        <Section title="PDF Templates" description="View all annotated PDF templates (app-wide)">
          <PdfTemplatesSection />
        </Section>
      )}

      {currentStage === "material-costs" && (
        <Section title="Material Cost Debug" description="Verify material costs are visible and correct in the database">
          <MaterialCostDebugPanel />
        </Section>
      )}

      {currentStage === "integrations" && (
      <>
      <Section title="Tenant Images" description="Import high-quality images from your website to use in landing pages">
        <TenantImageImport tenantSlug={s.slug} website={s.website || ""} />
      </Section>
      
      <Section title="Your Email Connections" description="Connect your own email account for sending and receiving">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Connect your personal Gmail or Microsoft 365 account. When you send emails from the CRM, they'll come from your connected account. 
            All admin users' connected accounts will automatically import leads.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-white/70 p-4">
              <div className="mb-3">
                <div className="text-sm font-semibold text-slate-800">Your Gmail</div>
                <div className="mt-1 text-xs text-slate-600">
                  {userGmailConn?.gmailAddress ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      Connected as {userGmailConn.gmailAddress}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                      Not connected
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {userGmailConn?.gmailAddress ? (
                  <Button variant="destructive" size="sm" onClick={disconnectGmailUser}>Disconnect</Button>
                ) : (
                  <Button variant="default" size="sm" onClick={connectGmailUser}>Connect Gmail</Button>
                )}
              </div>
            </div>
            
            <div className="rounded-xl border bg-white/70 p-4">
              <div className="mb-3">
                <div className="text-sm font-semibold text-slate-800">Your Microsoft 365</div>
                <div className="mt-1 text-xs text-slate-600">
                  {userMs365Conn?.ms365Address ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      Connected as {userMs365Conn.ms365Address}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                      Not connected
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {userMs365Conn?.ms365Address ? (
                  <Button variant="destructive" size="sm" onClick={disconnectMs365User}>Disconnect</Button>
                ) : (
                  <Button variant="default" size="sm" onClick={connectMs365User}>Connect Microsoft 365</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Inbox Settings" description="Configure email import and polling">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={inbox.gmail} onChange={(e) => setInbox((p) => ({ ...p, gmail: e.target.checked }))} />
            <span>Enable Gmail import</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={inbox.ms365} onChange={(e) => setInbox((p) => ({ ...p, ms365: e.target.checked }))} />
            <span>Enable Microsoft 365 import</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <span className="text-xs text-slate-500">Poll interval (minutes)</span>
            <input type="number" value={inbox.intervalMinutes} onChange={(e) => setInbox((p) => ({ ...p, intervalMinutes: Number(e.target.value || 10) }))} className="w-24 rounded-md border px-2 py-1" />
          </label>
          <label className="inline-flex items-center gap-2 md:col-span-3">
            <input type="checkbox" checked={!!inbox.recallFirst} onChange={(e) => setInbox((p) => ({ ...p, recallFirst: e.target.checked }))} />
            <span>Prefer recall (never miss leads)</span>
          </label>
        </div>
        <div className="mt-4">
          <Button onClick={saveInbox} disabled={savingInbox}>{savingInbox ? "Saving…" : "Save inbox settings"}</Button>
        </div>
      </Section>

      <Section title="Tenant-Level Connections (Legacy)" description="Legacy tenant-wide email connections">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-white/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Tenant Gmail</div>
              <div className="text-xs text-slate-600">{gmailConn?.gmailAddress ? `Connected as ${gmailConn.gmailAddress}` : "Not connected"}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={connectGmail}>Connect</Button>
              <Button variant="outline" size="sm" onClick={runImportGmail}>Run import</Button>
            </div>
          </div>
          <div className="rounded-xl border bg-white/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Tenant Microsoft 365</div>
              <div className="text-xs text-slate-600">{ms365Conn?.ms365Address ? `Connected as ${ms365Conn.ms365Address}` : "Not connected"}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={connectMs365}>Connect</Button>
              <Button variant="outline" size="sm" onClick={runImportMs365}>Run import</Button>
            </div>
          </div>
        </div>
      </Section>
      </>
      )}
      </div>{/* End content area */}
    </div>
  );
}