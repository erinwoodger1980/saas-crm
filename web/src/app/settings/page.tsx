// web/src/app/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser, type CurrentUser } from "@/lib/use-current-user";
import {
  DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
  DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
} from "@/lib/constants";
import {
  DEFAULT_TASK_PLAYBOOK,
  MANUAL_TASK_KEYS,
  ManualTaskKey,
  TaskPlaybook,
  TaskRecipe,
  normalizeTaskPlaybook,
} from "@/lib/task-playbook";

/* ---------------- Types ---------------- */
type QField = {
  id?: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "source";
  required?: boolean;
  options?: string[];
  askInQuestionnaire?: boolean;
  showOnLead?: boolean;
  sortOrder?: number;
};
type Settings = {
  tenantId: string;
  slug: string;
  brandName: string;
  introHtml?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  links?: { label: string; url: string }[] | null;
  questionnaire?: QField[] | null;
  taskPlaybook?: TaskPlaybook | null;
  questionnaireEmailSubject?: string | null;
  questionnaireEmailBody?: string | null;
};
type InboxCfg = { gmail: boolean; ms365: boolean; intervalMinutes: number };
type CostRow = {
  id: string;
  tenantId: string;
  source: string;
  month: string; // ISO date (first of month)
  spend: number;
  leads: number;
  conversions: number;
  scalable: boolean;
};

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
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-600">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

/* ---------------- Helpers ---------------- */
const FIELD_TYPES: QField["type"][] = ["text", "textarea", "select", "number", "date", "source"];

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
      const options =
        type === "select" && Array.isArray(item.options)
          ? item.options.map((opt: any) => String(opt || "").trim()).filter(Boolean)
          : [];
      const sortOrder =
        typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder) ? item.sortOrder : idx;
      return { id, key, label, type, required, options, askInQuestionnaire, showOnLead, sortOrder } as QField;
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
        sortOrder: idx,
      };
    })
    .filter(Boolean);
}

function defaultQuestions(): QField[] {
  return normalizeQuestionnaire([
    {
      id: makeFieldId(),
      key: "contactName",
      label: "Your name",
      type: "text",
      required: true,
      askInQuestionnaire: true,
      showOnLead: false,
    },
    {
      id: makeFieldId(),
      key: "email",
      label: "Email",
      type: "text",
      required: true,
      askInQuestionnaire: true,
      showOnLead: false,
    },
    {
      id: makeFieldId(),
      key: "projectType",
      label: "Project type",
      type: "select",
      options: ["Windows", "Doors", "Conservatory", "Other"],
      askInQuestionnaire: true,
      showOnLead: true,
    },
    {
      id: makeFieldId(),
      key: "enquiryType",
      label: "Type of enquiry",
      type: "select",
      options: ["Supply & install", "Supply only", "Service"],
      askInQuestionnaire: false,
      showOnLead: true,
    },
    {
      id: makeFieldId(),
      key: "source",
      label: "Lead source",
      type: "source",
      askInQuestionnaire: false,
      showOnLead: true,
    },
    {
      id: makeFieldId(),
      key: "quotedAt",
      label: "Date quoted",
      type: "date",
      askInQuestionnaire: false,
      showOnLead: true,
    },
    {
      id: makeFieldId(),
      key: "notes",
      label: "Notes",
      type: "textarea",
      askInQuestionnaire: true,
      showOnLead: false,
    },
  ]);
}
function initials(name?: string | null) {
  if (!name) return "JB";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function firstOfMonthISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const STATUS_ORDER = [
  "NEW_ENQUIRY",
  "INFO_REQUESTED",
  "DISQUALIFIED",
  "REJECTED",
  "READY_TO_QUOTE",
  "QUOTE_SENT",
  "WON",
  "LOST",
] as const;
type StatusKey = (typeof STATUS_ORDER)[number];

const STATUS_COPY: Record<StatusKey, { title: string; blurb: string; emoji: string }> = {
  NEW_ENQUIRY: {
    title: "New enquiry",
    blurb: "First-response follow-ups to keep leads warm.",
    emoji: "✨",
  },
  INFO_REQUESTED: {
    title: "Info requested",
    blurb: "Remind the team to chase questionnaires and replies.",
    emoji: "📬",
  },
  DISQUALIFIED: {
    title: "Disqualified",
    blurb: "Archive or hand-off steps for non-fit enquiries.",
    emoji: "🚫",
  },
  REJECTED: {
    title: "Rejected",
    blurb: "Closing notes or tidy-up admin when you decline work.",
    emoji: "🙅",
  },
  READY_TO_QUOTE: {
    title: "Ready to quote",
    blurb: "Tasks that keep estimates moving swiftly.",
    emoji: "📐",
  },
  QUOTE_SENT: {
    title: "Quote sent",
    blurb: "Automated nudges to follow up on proposals.",
    emoji: "📨",
  },
  WON: {
    title: "Won",
    blurb: "Hand-off steps once a deal is secured.",
    emoji: "🏆",
  },
  LOST: {
    title: "Lost",
    blurb: "Optional aftercare, feedback or tidy-up tasks.",
    emoji: "🧹",
  },
};

const MANUAL_COPY: Record<ManualTaskKey, { title: string; blurb: string; emoji: string }> = {
  questionnaire_followup: {
    title: "Questionnaire sent",
    blurb: "Add tasks after sharing or receiving your discovery form.",
    emoji: "🧾",
  },
  supplier_followup: {
    title: "Supplier request",
    blurb: "Remind yourself to chase supplier prices or replies.",
    emoji: "🤝",
  },
  quote_draft_complete: {
    title: "Draft estimate created",
    blurb: "Ensure the draft gets polished and sent.",
    emoji: "📝",
  },
};

const PRIORITY_OPTIONS: Array<TaskRecipe["priority"]> = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const RELATED_TYPE_OPTIONS: Array<TaskRecipe["relatedType"]> = [
  "LEAD",
  "PROJECT",
  "QUOTE",
  "EMAIL",
  "QUESTIONNAIRE",
  "WORKSHOP",
  "OTHER",
];

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ============================================================
   Page
============================================================ */
export default function SettingsPage() {
  const { toast } = useToast();
  const { user, mutate: mutateCurrentUser } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Settings | null>(null);
  const [inbox, setInbox] = useState<InboxCfg>({ gmail: false, ms365: false, intervalMinutes: 10 });
  const [savingInbox, setSavingInbox] = useState(false);
  const [updatingEarlyAccess, setUpdatingEarlyAccess] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Costs
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [costDraft, setCostDraft] = useState({
    id: null as string | null | undefined,
    source: "",
    month: firstOfMonthISO(),
    spend: "",
    leads: "",
    conversions: "",
    scalable: true,
  });
  const [savingCost, setSavingCost] = useState(false);

  const [playbook, setPlaybook] = useState<TaskPlaybook>(normalizeTaskPlaybook(DEFAULT_TASK_PLAYBOOK));
  const [savingPlaybook, setSavingPlaybook] = useState(false);

  const derivedFirstName = useMemo(() => {
    const direct = user?.firstName?.trim();
    if (direct) return direct;
    const fallback = user?.name?.trim();
    if (!fallback) return "";
    const parts = fallback.split(/\s+/).filter(Boolean);
    if (!parts.length) return "";
    return parts[0];
  }, [user?.firstName, user?.name]);

  const derivedLastName = useMemo(() => {
    const direct = user?.lastName?.trim();
    if (direct) return direct;
    const fallback = user?.name?.trim();
    if (!fallback) return "";
    const parts = fallback.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return "";
    return parts.slice(1).join(" ");
  }, [user?.lastName, user?.name]);

  useEffect(() => {
    setProfileFirstName(derivedFirstName);
    setProfileLastName(derivedLastName);
  }, [derivedFirstName, derivedLastName]);

  const profileDirty = useMemo(() => {
    if (!user) return false;
    const nextFirst = profileFirstName.trim();
    const nextLast = profileLastName.trim();
    return nextFirst !== derivedFirstName || nextLast !== derivedLastName;
  }, [user, profileFirstName, profileLastName, derivedFirstName, derivedLastName]);

  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      try {
        const data = await apiFetch<Settings>("/tenant/settings");
        const normalizedQuestionnaire = normalizeQuestionnaire((data as any).questionnaire ?? defaultQuestions());
        setS({
          ...data,
          links: (data.links as any) ?? [],
          questionnaire: normalizedQuestionnaire.length ? normalizedQuestionnaire : defaultQuestions(),
          introHtml: data.introHtml ?? "",
          taskPlaybook: normalizeTaskPlaybook((data as any).taskPlaybook),
          questionnaireEmailSubject:
            typeof (data as any).questionnaireEmailSubject === "string" && (data as any).questionnaireEmailSubject
              ? (data as any).questionnaireEmailSubject
              : DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
          questionnaireEmailBody:
            typeof (data as any).questionnaireEmailBody === "string" && (data as any).questionnaireEmailBody
              ? (data as any).questionnaireEmailBody
              : DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
        });
        setPlaybook(normalizeTaskPlaybook((data as any).taskPlaybook));
        const inboxCfg = await apiFetch<InboxCfg>("/tenant/inbox");
        setInbox(inboxCfg);
        const costRows = await apiFetch<CostRow[]>("/tenant/costs");
        setCosts(costRows);
      } catch (e: any) {
        toast({ title: "Failed to load settings", description: e?.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  /* ---------------- Actions: Profile ---------------- */
  async function saveProfile() {
    if (!user || !profileDirty) return;
    setSavingProfile(true);

    const nextFirst = profileFirstName.trim();
    const nextLast = profileLastName.trim();
    const optimisticName = [nextFirst, nextLast].filter(Boolean).join(" ") || null;
    const previousUser = user;

    mutateCurrentUser(
      (prev) =>
        prev
          ? {
              ...prev,
              firstName: nextFirst || null,
              lastName: nextLast || null,
              name: optimisticName,
            }
          : prev,
      false,
    );

    try {
      const updated = await apiFetch<CurrentUser>("/auth/me", {
        method: "PATCH",
        json: { firstName: profileFirstName, lastName: profileLastName },
      });
      mutateCurrentUser(updated, false);
      toast({ title: "Profile updated" });
    } catch (e: any) {
      mutateCurrentUser(previousUser, false);
      toast({
        title: "Couldn’t update profile",
        description: e?.message || "unknown",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  /* ---------------- Actions: Early access ---------------- */
  async function updateEarlyAccess(next: boolean) {
    if (!user) return;
    setUpdatingEarlyAccess(true);

    const previous = user;
    mutateCurrentUser((prev) => (prev ? { ...prev, isEarlyAdopter: next } : prev), false);

    try {
      const updated = await apiFetch<CurrentUser>("/auth/me", {
        method: "PATCH",
        json: { isEarlyAdopter: next },
      });
      mutateCurrentUser(updated, false);
      toast({
        title: next ? "Early access enabled" : "Early access disabled",
        description: next
          ? "You’ll see the feedback button and upcoming previews."
          : "We’ll hide early adopter tools for now.",
      });
    } catch (e: any) {
      mutateCurrentUser(previous, false);
      toast({
        title: "Couldn’t update early access",
        description: e?.message || "unknown",
        variant: "destructive",
      });
    } finally {
      setUpdatingEarlyAccess(false);
    }
  }

  /* ---------------- Actions: Brand ---------------- */
  async function saveBrand() {
    if (!s) return;
    try {
      const payloadQuestionnaire = serializeQuestionnaire(s.questionnaire ?? []);
      const updated = await apiFetch<Settings>("/tenant/settings", {
        method: "PUT",
        json: {
          ...s,
          taskPlaybook: playbook,
          links: s.links ?? [],
          questionnaire: payloadQuestionnaire,
        },
      });
      const normalizedPlaybook = normalizeTaskPlaybook((updated as any).taskPlaybook ?? playbook);
      const normalizedQuestionnaire = normalizeQuestionnaire((updated as any).questionnaire ?? payloadQuestionnaire);
      setS({
        ...updated,
        links: (updated.links as any) ?? [],
        questionnaire: normalizedQuestionnaire,
        taskPlaybook: normalizedPlaybook,
        questionnaireEmailSubject:
          typeof (updated as any).questionnaireEmailSubject === "string" && (updated as any).questionnaireEmailSubject
            ? (updated as any).questionnaireEmailSubject
            : DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody:
          typeof (updated as any).questionnaireEmailBody === "string" && (updated as any).questionnaireEmailBody
            ? (updated as any).questionnaireEmailBody
            : DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
      });
      setPlaybook(normalizedPlaybook);
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "unknown", variant: "destructive" });
    }
  }

  async function pullFromWebsite() {
    if (!s?.website) {
      toast({ title: "Add your website first", description: "Enter your website URL, then click Pull from website." });
      return;
    }
    try {
      const res = await apiFetch<{ ok: boolean; settings: Settings }>("/tenant/settings/enrich", {
        method: "POST",
        json: { website: s.website },
      });
      const normalizedPlaybook = normalizeTaskPlaybook((res.settings as any).taskPlaybook ?? playbook);
      const merged = {
        ...s,
        ...res.settings,
        questionnaire: s.questionnaire,
        taskPlaybook: normalizedPlaybook,
        questionnaireEmailSubject:
          typeof (res.settings as any).questionnaireEmailSubject === "string" &&
          (res.settings as any).questionnaireEmailSubject
            ? (res.settings as any).questionnaireEmailSubject
            : s.questionnaireEmailSubject ?? DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody:
          typeof (res.settings as any).questionnaireEmailBody === "string" &&
          (res.settings as any).questionnaireEmailBody
            ? (res.settings as any).questionnaireEmailBody
            : s.questionnaireEmailBody ?? DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
      };
      setS(merged);
      setPlaybook(normalizedPlaybook);
      toast({ title: "Branding imported", description: "Logo, links and intro updated." });
    } catch (e: any) {
      toast({ title: "Couldn’t pull branding", description: e?.message || "Please check the website URL.", variant: "destructive" });
    }
  }

  /* ---------------- Actions: Inbox ---------------- */
  async function saveInboxCfg() {
    setSavingInbox(true);
    try {
      await apiFetch("/tenant/inbox", { method: "PUT", json: inbox });
      toast({ title: "Inbox watch updated" });
    } catch (e: any) {
      toast({ title: "Failed to save inbox settings", description: e?.message, variant: "destructive" });
    } finally {
      setSavingInbox(false);
    }
  }

  async function connectGmail() {
    const fallbackBase = (
      process.env.NEXT_PUBLIC_API_BASE ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000"
    ).replace(/\/$/, "");

    try {
      const resp = await apiFetch<{ authUrl?: string }>("/gmail/connect/start");
      if (resp?.authUrl) {
        window.location.href = resp.authUrl;
        return;
      }
    } catch (e: any) {
      console.error("Failed to fetch Gmail auth URL", e);
    }

    if (typeof window !== "undefined") {
      window.location.href = `${fallbackBase}/gmail/connect`;
      return;
    }

    toast({ title: "Couldn’t start Gmail connect", description: "Auth URL not provided by API.", variant: "destructive" });
  }

  async function importNow(provider: "gmail" | "ms365") {
    try {
      await apiFetch("/" + (provider === "gmail" ? "gmail/import" : "ms365/import"), {
        method: "POST",
        json: provider === "gmail" ? { max: 25, q: "newer_than:30d" } : { max: 25 },
      });
      toast({ title: `Imported from ${provider.toUpperCase()}` });
    } catch (e: any) {
      toast({ title: `Import from ${provider.toUpperCase()} failed`, description: e?.message, variant: "destructive" });
    }
  }

  /* ---------------- Actions: Costs ---------------- */
  async function refreshCosts() {
    const rows = await apiFetch<CostRow[]>("/tenant/costs");
    setCosts(rows);
  }

  async function saveCostRow() {
    if (!s) return;
    const { source, month, spend, leads, conversions, scalable } = costDraft;
    if (!source || !month) {
      toast({ title: "Source and month required", variant: "destructive" });
      return;
    }
    setSavingCost(true);
    try {
      await apiFetch<CostRow>("/tenant/costs", {
        method: "POST",
        json: {
          source,
          month,
          spend: Number(spend || 0),
          leads: Number(leads || 0),
          conversions: Number(conversions || 0),
          scalable,
        },
      });
      await refreshCosts();
      setCostDraft({
        id: null,
        source: "",
        month: firstOfMonthISO(),
        spend: "",
        leads: "",
        conversions: "",
        scalable: true,
      });
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Could not save cost row.", variant: "destructive" });
    } finally {
      setSavingCost(false);
    }
  }

  async function deleteCostRow(id: string) {
    try {
      await apiFetch(`/tenant/costs/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshCosts();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Could not delete.", variant: "destructive" });
    }
  }

  function updateStatusRecipe(status: StatusKey, index: number, patch: Partial<TaskRecipe>) {
    setPlaybook((prev) => {
      const nextStatus = { ...prev.status };
      const items = [...(nextStatus[status] || [])];
      if (!items[index]) return prev;
      items[index] = { ...items[index], ...patch };
      nextStatus[status] = items;
      return { ...prev, status: nextStatus };
    });
  }

  function addStatusRecipe(status: StatusKey) {
    const fresh: TaskRecipe = {
      id: generateId(`status-${status.toLowerCase()}`),
      title: "New follow-up",
      dueInDays: 1,
      priority: "MEDIUM",
      relatedType: "LEAD",
      active: true,
    };
    setPlaybook((prev) => {
      const nextStatus = { ...prev.status };
      const items = [...(nextStatus[status] || [])];
      items.push(fresh);
      nextStatus[status] = items;
      return { ...prev, status: nextStatus };
    });
  }

  function removeStatusRecipe(status: StatusKey, index: number) {
    setPlaybook((prev) => {
      const nextStatus = { ...prev.status };
      const items = [...(nextStatus[status] || [])];
      items.splice(index, 1);
      nextStatus[status] = items;
      return { ...prev, status: nextStatus };
    });
  }

  function updateManualRecipeField(key: ManualTaskKey, patch: Partial<TaskRecipe>) {
    setPlaybook((prev) => {
      const current = prev.manual[key] ?? {
        id: generateId(`manual-${key}`),
        title: "",
        active: true,
        priority: "MEDIUM",
        relatedType: "LEAD",
      };
      return {
        ...prev,
        manual: {
          ...prev.manual,
          [key]: { ...current, ...patch },
        },
      };
    });
  }

  function resetPlaybook() {
    const defaults = normalizeTaskPlaybook(DEFAULT_TASK_PLAYBOOK);
    setPlaybook(defaults);
    setS((prev) => (prev ? { ...prev, taskPlaybook: defaults } : prev));
  }

  async function saveTaskPlaybook() {
    setSavingPlaybook(true);
    try {
      const updated = await apiFetch<Settings>("/tenant/settings", {
        method: "PATCH",
        json: { taskPlaybook: playbook },
      });
      const normalized = normalizeTaskPlaybook((updated as any).taskPlaybook ?? playbook);
      setPlaybook(normalized);
      setS((prev) => (prev ? { ...prev, taskPlaybook: normalized } : prev));
      toast({ title: "Task playbook saved" });
    } catch (e: any) {
      toast({
        title: "Couldn’t save playbook",
        description: e?.message || "unknown",
        variant: "destructive",
      });
    } finally {
      setSavingPlaybook(false);
    }
  }

  /* ---------------- Derived ---------------- */
  const logoPreview = useMemo(() => {
    const url = s?.logoUrl?.trim();
    if (!url) return null;
    try { return new URL(url).toString(); } catch { return null; }
  }, [s?.logoUrl]);

  if (loading || !s) return <div className="p-6 text-sm text-slate-600">Loading…</div>;

  /* ---------------- Render ---------------- */
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-sm text-slate-500">Brand, questionnaire, inbox, and cost tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => location.reload()}>Reload</Button>
          <Button onClick={saveBrand}>Save All</Button>
        </div>
      </div>

      <Section
        title="Profile"
        description="Update how your name appears across the workspace."
        right={
          <Button
            size="sm"
            onClick={saveProfile}
            disabled={!user || savingProfile || !profileDirty}
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <input
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
              value={profileFirstName}
              onChange={(e) => setProfileFirstName(e.target.value)}
              placeholder="Erin"
            />
          </Field>
          <Field label="Last name">
            <input
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
              value={profileLastName}
              onChange={(e) => setProfileLastName(e.target.value)}
              placeholder="Callahan"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Early access"
        description="Control whether you see experimental tools and the floating feedback widget."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-1">
            <div className="text-sm font-semibold text-slate-700">Enable early adopter tools</div>
            <p className="text-xs text-slate-500">
              Turn this on to pin the “Give feedback” button to every page and unlock early feature previews.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={!!user?.isEarlyAdopter}
              disabled={!user || updatingEarlyAccess}
              onChange={(e) => updateEarlyAccess(e.target.checked)}
            />
            <span>
              {updatingEarlyAccess
                ? "Saving…"
                : user
                  ? user.isEarlyAdopter
                    ? "On"
                    : "Off"
                  : "Loading…"}
            </span>
          </label>
        </div>
      </Section>

      {/* Brand */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
        <Section
          title="Brand & Identity"
          description="These details show on shared pages and emails."
          right={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={pullFromWebsite}>Pull from website</Button>
              <Button size="sm" onClick={saveBrand}>Save</Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Brand name">
              <input className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.brandName || ""} onChange={(e) => setS({ ...s, brandName: e.target.value })} />
            </Field>

            <Field label="Public slug" hint="Used for your public questionnaire link.">
              <input className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.slug || ""} onChange={(e) => setS({ ...s, slug: e.target.value })} />
            </Field>

            <Field label="Website">
              <input className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.website || ""} onChange={(e) => setS({ ...s, website: e.target.value })} placeholder="https://your-site.com" />
            </Field>

            <Field label="Phone">
              <input className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.phone || ""} onChange={(e) => setS({ ...s, phone: e.target.value })} placeholder="+44 1234 567890" />
            </Field>

            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
              <Field label="Logo URL" hint="Paste a full HTTPS link to an image (PNG/SVG/JPG).">
                <input className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                  value={s.logoUrl || ""} onChange={(e) => setS({ ...s, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.svg" />
              </Field>
              <div className="justify-self-end">
                <Button variant="outline" onClick={saveBrand}>Save</Button>
              </div>
            </div>

            <Field label="Intro (plain text)">
              <textarea className="min-h-[110px] w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.introHtml || ""} onChange={(e) => setS({ ...s, introHtml: e.target.value })}
                placeholder="A short welcome shown to new enquiries." />
            </Field>

            {/* Helpful links */}
            <div className="sm:col-span-2">
              <div className="mb-2 text-sm font-medium">Helpful links</div>
              <div className="space-y-2">
                {(s.links ?? []).map((lnk, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <input className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                      placeholder="Label" value={lnk.label}
                      onChange={(e) => {
                        const next = [...(s.links ?? [])];
                        next[i] = { ...next[i], label: e.target.value };
                        setS({ ...s, links: next });
                      }} />
                    <input className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                      placeholder="https://…" value={lnk.url}
                      onChange={(e) => {
                        const next = [...(s.links ?? [])];
                        next[i] = { ...next[i], url: e.target.value };
                        setS({ ...s, links: next });
                      }} />
                    <Button variant="secondary" onClick={() => {
                      const next = [...(s.links ?? [])];
                      next.splice(i, 1);
                      setS({ ...s, links: next });
                    }}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setS({ ...s, links: [...(s.links ?? []), { label: "", url: "" }] })}>
                  Add link
                </Button>
              </div>
            </div>
          </div>
        </Section>

        {/* Preview */}
        <Section title="Preview" description="How it may appear on shared pages.">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 grid place-items-center overflow-hidden shadow-sm">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-semibold text-slate-600">{initials(s.brandName)}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{s.brandName || "Your brand"}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {s.website || "www.example.com"} · {s.phone || "01234 567890"}
                </div>
              </div>
            </div>
            {s.introHtml && <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700 line-clamp-5">{s.introHtml}</div>}
            {(s.links?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.links!.map((l, i) => (
                  <span key={i} className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    {l.label || l.url || "Link"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      <Section
        title="Task playbook"
        description="Decide which tasks spring to life when statuses change or when you trigger key actions."
        right={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetPlaybook}>
              Reset
            </Button>
            <Button size="sm" onClick={saveTaskPlaybook} disabled={savingPlaybook}>
              {savingPlaybook ? "Saving…" : "Save playbook"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <div className="mb-3 text-sm font-semibold text-slate-600">Lead status journeys</div>
            <div className="grid gap-4 lg:grid-cols-2">
              {STATUS_ORDER.map((status) => {
                const recipes = playbook.status[status] || [];
                const copy = STATUS_COPY[status];
                return (
                  <div key={status} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <span aria-hidden="true">{copy.emoji}</span>
                          {copy.title}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{copy.blurb}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => addStatusRecipe(status)}>
                        Add follow-up
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {recipes.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-500">
                          No automatic tasks for this stage yet.
                        </div>
                      )}
                      {recipes.map((recipe, idx) => (
                        <div key={recipe.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <Field label="Task title">
                              <input
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                                value={recipe.title}
                                onChange={(e) => updateStatusRecipe(status, idx, { title: e.target.value })}
                              />
                            </Field>
                            <Field label="Due after (days)" hint="0 = immediately">
                              <input
                                type="number"
                                min={0}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                                value={recipe.dueInDays ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const parsed = raw === "" ? undefined : Math.max(0, Number(raw));
                                  updateStatusRecipe(status, idx, {
                                    dueInDays: typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined,
                                  });
                                }}
                              />
                            </Field>
                            <Field label="Priority">
                              <select
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                                value={recipe.priority ?? "MEDIUM"}
                                onChange={(e) =>
                                  updateStatusRecipe(status, idx, {
                                    priority: e.target.value as TaskRecipe["priority"],
                                  })
                                }
                              >
                                {PRIORITY_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt.toLowerCase()}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Related record">
                              <select
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                                value={recipe.relatedType ?? "LEAD"}
                                onChange={(e) =>
                                  updateStatusRecipe(status, idx, {
                                    relatedType: e.target.value as TaskRecipe["relatedType"],
                                  })
                                }
                              >
                                {RELATED_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt.toLowerCase()}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={recipe.active !== false}
                                onChange={(e) => updateStatusRecipe(status, idx, { active: e.target.checked })}
                              />
                              Active
                            </label>
                            <button
                              type="button"
                              onClick={() => removeStatusRecipe(status, idx)}
                              className="font-semibold text-rose-500 hover:text-rose-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-600">Action triggers</div>
            <div className="grid gap-4 md:grid-cols-3">
              {MANUAL_TASK_KEYS.map((key) => {
                const recipe = playbook.manual[key];
                const copy = MANUAL_COPY[key];
                return (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <span aria-hidden="true">{copy.emoji}</span>
                          {copy.title}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{copy.blurb}</p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={recipe?.active !== false}
                          onChange={(e) => updateManualRecipeField(key, { active: e.target.checked })}
                        />
                        Active
                      </label>
                    </div>
                    <div className="space-y-3">
                      <Field label="Task title">
                        <input
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                          value={recipe?.title ?? ""}
                          onChange={(e) => updateManualRecipeField(key, { title: e.target.value })}
                        />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Due after (days)" hint="0 = immediately">
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                            value={recipe?.dueInDays ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsed = raw === "" ? undefined : Math.max(0, Number(raw));
                              updateManualRecipeField(key, {
                                dueInDays: typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined,
                              });
                            }}
                          />
                        </Field>
                        <Field label="Priority">
                          <select
                            className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                            value={recipe?.priority ?? "MEDIUM"}
                            onChange={(e) =>
                              updateManualRecipeField(key, {
                                priority: e.target.value as TaskRecipe["priority"],
                              })
                            }
                          >
                            {PRIORITY_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt.toLowerCase()}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field label="Related record">
                        <select
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                          value={recipe?.relatedType ?? "LEAD"}
                          onChange={(e) =>
                            updateManualRecipeField(key, {
                              relatedType: e.target.value as TaskRecipe["relatedType"],
                            })
                          }
                        >
                          {RELATED_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt.toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Questionnaire */}
      <Section title="Questionnaire" description="Pick the fields you want to ask on the public form." right={<Button size="sm" onClick={saveBrand}>Save</Button>}>
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              label="Email subject"
              hint="Placeholders: {{contactName}}, {{firstName}}, {{brandName}}, {{link}}"
            >
              <input
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={s.questionnaireEmailSubject ?? ""}
                onChange={(e) => setS({ ...s, questionnaireEmailSubject: e.target.value })}
                placeholder={DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT}
              />
            </Field>
            <div className="lg:col-span-2">
              <Field
                label="Email body"
                hint="Placeholders: {{contactName}}, {{firstName}}, {{brandName}}, {{link}}"
              >
                <textarea
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                  rows={6}
                  value={s.questionnaireEmailBody ?? ""}
                  onChange={(e) => setS({ ...s, questionnaireEmailBody: e.target.value })}
                  placeholder={DEFAULT_QUESTIONNAIRE_EMAIL_BODY}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-3">
            {(s.questionnaire ?? []).map((q, i) => {
              const askClients = q.askInQuestionnaire !== false;
              const showOnLead = !!q.showOnLead;
              const cardKey = q.id || `${q.key}-${i}`;
              return (
                <div key={cardKey} className="rounded-xl border p-3 bg-white hover:shadow-sm transition">
                  <div className="grid items-end gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
                    <Field label="Key">
                      <input
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                        value={q.key}
                        onChange={(e) => {
                          const next = [...(s.questionnaire ?? [])];
                          next[i] = { ...next[i], key: e.target.value };
                          setS({ ...s, questionnaire: next });
                        }}
                      />
                    </Field>
                    <Field label="Label">
                      <input
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                        value={q.label}
                        onChange={(e) => {
                          const next = [...(s.questionnaire ?? [])];
                          next[i] = { ...next[i], label: e.target.value };
                          setS({ ...s, questionnaire: next });
                        }}
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                        value={q.type}
                        onChange={(e) => {
                          const nextType = e.target.value as QField["type"];
                          const next = [...(s.questionnaire ?? [])];
                          next[i] = {
                            ...next[i],
                            type: nextType,
                            options: nextType === "select" ? next[i].options ?? [] : [],
                            ...(nextType === "source"
                              ? { showOnLead: true, askInQuestionnaire: false }
                              : {}),
                          };
                          setS({ ...s, questionnaire: next });
                        }}
                      >
                        {FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="flex flex-wrap items-center justify-end gap-3 pb-2">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!q.required}
                          onChange={(e) => {
                            const next = [...(s.questionnaire ?? [])];
                            next[i] = { ...next[i], required: e.target.checked };
                            setS({ ...s, questionnaire: next });
                          }}
                        />
                        <span>Required</span>
                      </label>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const next = [...(s.questionnaire ?? [])];
                          next.splice(i, 1);
                          setS({ ...s, questionnaire: next });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={askClients}
                        onChange={(e) => {
                          const next = [...(s.questionnaire ?? [])];
                          next[i] = { ...next[i], askInQuestionnaire: e.target.checked };
                          setS({ ...s, questionnaire: next });
                        }}
                      />
                      <span>Ask on client questionnaire</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={showOnLead}
                        onChange={(e) => {
                          const next = [...(s.questionnaire ?? [])];
                          next[i] = { ...next[i], showOnLead: e.target.checked };
                          setS({ ...s, questionnaire: next });
                        }}
                      />
                      <span>Show in lead workspace</span>
                    </label>
                  </div>

                  {q.type === "select" && (
                    <div className="mt-3">
                      <Field label="Options (comma-separated)">
                        <input
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                          value={(q.options ?? []).join(", ")}
                          onChange={(e) => {
                            const opts = e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            const next = [...(s.questionnaire ?? [])];
                            next[i] = { ...next[i], options: opts };
                            setS({ ...s, questionnaire: next });
                          }}
                        />
                      </Field>
                    </div>
                  )}

                  {q.type === "source" && (
                    <p className="mt-3 text-xs text-slate-500">
                      Links to the lead source picker so you can track budgets and conversion performance per source.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const nextId = makeFieldId();
                setS({
                  ...s,
                  questionnaire: [
                    ...(s.questionnaire ?? []),
                    {
                      id: nextId,
                      key: `field${(s.questionnaire?.length ?? 0) + 1}`,
                      label: "New field",
                      type: "text",
                      askInQuestionnaire: true,
                      showOnLead: false,
                    },
                  ],
                });
              }}
            >
              Add field
            </Button>
            <Button variant="ghost" onClick={() => setS({ ...s, questionnaire: defaultQuestions() })}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </Section>

      {/* Inbox */}
      <Section
        title="Inbox"
        description="Connect Gmail / Microsoft 365 and set an automatic import schedule."
        right={
          <Button size="sm" onClick={saveInboxCfg} disabled={savingInbox}>
            {savingInbox ? "Saving…" : "Save"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
            <input type="checkbox" className="h-4 w-4" checked={inbox.gmail} onChange={(e) => setInbox({ ...inbox, gmail: e.target.checked })} />
            <span className="text-sm">Gmail</span>
          </label>

          <label className="flex items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
            <input type="checkbox" className="h-4 w-4" checked={inbox.ms365} onChange={(e) => setInbox({ ...inbox, ms365: e.target.checked })} />
            <span className="text-sm">Microsoft 365</span>
          </label>

          <Field label="Interval (minutes)">
            <input type="number" min={2} className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
              value={inbox.intervalMinutes}
              onChange={(e) => setInbox({ ...inbox, intervalMinutes: Math.max(2, Number(e.target.value || 10)) })} />
          </Field>
        </div>

        {/* Machine Learning */}
        <div className="mt-6 border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">Machine Learning</h3>
          <p className="text-sm text-gray-500 mb-4">Train the model using the last 500 sent quote emails with PDF attachments.</p>

          <Button
            onClick={async () => {
              try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/ml/train`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("jwt")}`,
                  },
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || "Training failed");
                alert(`✅ Model training started.\n${json.message || "Training triggered."}`);
              } catch (err: any) {
                console.error("Train model failed:", err);
                alert(`❌ ${err.message || "Failed to trigger training"}`);
              }
            }}
          >
            ✨ Train Model
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={connectGmail}>Connect Gmail</Button>
          <Button variant="outline" onClick={() => importNow("gmail")}>Import Gmail now</Button>
          <Button variant="outline" onClick={() => importNow("ms365")}>Import MS365 now</Button>
        </div>
      </Section>

      {/* Lead Source Costs */}
      <Section title="Lead Source Costs" description="Track monthly budget and results by source.">
        {/* Editor */}
        <div className="rounded-xl border bg-white p-3 mb-4">
          <div className="grid gap-2 sm:grid-cols-[1.2fr_1.1fr_repeat(3,0.8fr)_auto] items-end">
            <Field label="Source">
              <input className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                placeholder="Google Ads / Facebook / Referral"
                value={costDraft.source} onChange={(e) => setCostDraft({ ...costDraft, source: e.target.value })} />
            </Field>
            <Field label="Month (YYYY-MM-01)">
              <input type="date" className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={costDraft.month} onChange={(e) => setCostDraft({ ...costDraft, month: e.target.value })} />
            </Field>
            <Field label="Budget">
              <input type="number" className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={costDraft.spend} onChange={(e) => setCostDraft({ ...costDraft, spend: e.target.value })} />
            </Field>
            <Field label="Leads">
              <input type="number" className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={costDraft.leads} onChange={(e) => setCostDraft({ ...costDraft, leads: e.target.value })} />
            </Field>
            <Field label="Sales">
              <input type="number" className="rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                value={costDraft.conversions} onChange={(e) => setCostDraft({ ...costDraft, conversions: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" className="h-4 w-4" checked={costDraft.scalable}
                onChange={(e) => setCostDraft({ ...costDraft, scalable: e.target.checked })} />
              <span className="text-sm text-slate-700">Scalable</span>
            </label>
            <Button onClick={saveCostRow} disabled={savingCost}>{savingCost ? "Saving…" : "Save"}</Button>
          </div>
        </div>

        {/* List */}
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2">Month</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-right px-3 py-2">Budget</th>
                <th className="text-right px-3 py-2">Leads</th>
                <th className="text-right px-3 py-2">Sales</th>
                <th className="text-center px-3 py-2">Scalable</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {costs.length === 0 ? (
                <tr><td className="px-3 py-4 text-center text-slate-500" colSpan={7}>No rows yet.</td></tr>
              ) : (
                costs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{new Date(r.month).toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2">{r.source}</td>
                    <td className="px-3 py-2 text-right">£{r.spend.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{r.leads}</td>
                    <td className="px-3 py-2 text-right">{r.conversions}</td>
                    <td className="px-3 py-2 text-center">{r.scalable ? "✓" : "–"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="secondary" size="sm" onClick={() =>
                        setCostDraft({
                          id: r.id,
                          source: r.source,
                          month: new Date(r.month).toISOString().slice(0, 10),
                          spend: String(r.spend),
                          leads: String(r.leads),
                          conversions: String(r.conversions),
                          scalable: r.scalable,
                        })
                      }>
                        Edit
                      </Button>{" "}
                      <Button variant="destructive" size="sm" onClick={() => deleteCostRow(r.id)}>Delete</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}