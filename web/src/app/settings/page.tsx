"use client";
import { API_BASE, apiFetch, ensureDemoAuth } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser, type CurrentUser } from "@/lib/use-current-user";
import {
  DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
  DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
} from "@/lib/constants";
import SourceCosts from "./SourceCosts";
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
  aiFollowupLearning?: { crossTenantOptIn: boolean; lastUpdatedISO?: string | null } | null;
};
type InboxCfg = { gmail: boolean; ms365: boolean; intervalMinutes: number; recallFirst?: boolean };
type CostRow = {
  id: string;
  tenantId: string;
  source: string;
  month: string;
  spend: number;
  leads: number;
  conversions: number;
  scalable: boolean;
};
type AiFollowupInsight = {
  optIn: boolean;
  summary?: string;
  sampleSize?: number;
  variants?: {
    variant: string;
    sampleSize: number;
    replyRate?: number;
    conversionRate?: number;
    avgDelayDays?: number | null;
    successScore?: number;
  }[];
  call?: {
    sampleSize?: number;
    avgDelayDays?: number | null;
    conversionRate?: number | null;
  };
  lastUpdatedISO?: string | null;
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

/* ============================================================
   Page
============================================================ */
export default function SettingsPage() {
  const { toast } = useToast();
  const { user, mutate: mutateCurrentUser } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"company" | "questionnaire" | "playbook" | "email">("company");
  const [s, setS] = useState<Settings | null>(null);
  const [inbox, setInbox] = useState<InboxCfg>({ gmail: false, ms365: false, intervalMinutes: 10 });
  const [savingInbox, setSavingInbox] = useState(false);
  const [updatingEarlyAccess, setUpdatingEarlyAccess] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [qFields, setQFields] = useState<QField[]>([]);
  const [qSearch, setQSearch] = useState("");
  const [qHideInternal, setQHideInternal] = useState(true);
  const [qOnlyPublic, setQOnlyPublic] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [playbook, setPlaybook] = useState<TaskPlaybook>(normalizeTaskPlaybook(DEFAULT_TASK_PLAYBOOK));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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
  }, [mutateCurrentUser, toast]);

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
  }, [user?.firstName, user?.lastName]);

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
        inbox,
        questionnaire: serializeQuestionnaire(qFields),
        taskPlaybook: playbook,
      } as any;

      const updated = await apiFetch<Settings>("/tenant/settings", { method: "PATCH", json: payload });
      setS(updated);
      setQFields(normalizeQuestionnaire((updated as any)?.questionnaire ?? []));
      setPlaybook(normalizeTaskPlaybook((updated as any)?.taskPlaybook ?? DEFAULT_TASK_PLAYBOOK));
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Failed to save settings", description: e?.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
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

  /* Machine Learning section */
  async function trainModel() {
    try {
      const json = await apiFetch<{ message?: string; error?: string }>("/ml/train", { method: "POST" });
      alert(`✅ Model training started.\n${json?.message || "Training triggered."}`);
    } catch (err: any) {
      console.error("Train model failed:", err);
      alert(`❌ ${err?.message || "Failed to trigger training"}`);
    }
  }

  if (loading || !s) return <div className="p-6 text-sm text-slate-600">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 -mx-4 mb-2 bg-gradient-to-b from-white/90 to-white/0 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "company", label: "Company" },
            { key: "questionnaire", label: "Questionnaire" },
            { key: "playbook", label: "Playbook" },
            { key: "email", label: "Email ingest" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm border ${
                tab === (t.key as any)
                  ? "bg-[rgb(var(--brand))] border-[rgb(var(--brand))] text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "company" && (
      <>
      <Section title="Company profile" description="Edit basic company and owner details" right={<Button onClick={saveProfile}>Save Profile</Button>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Company name">
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
          <Field label="Phone">
            <input
              className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
              value={s.phone ?? ""}
              onChange={(e) => setS((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
            />
          </Field>
          <Field label="Intro HTML" hint="Optional HTML shown on the public questionnaire">
            <textarea
              className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm min-h-[80px]"
              value={s.introHtml ?? ""}
              onChange={(e) => setS((prev) => (prev ? { ...prev, introHtml: e.target.value } : prev))}
            />
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? "Saving settings…" : "Save settings"}
          </Button>
        </div>
      </Section>
      <Section title="Source costs">
        <SourceCosts />
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
      </>
      )}

      {tab === "questionnaire" && (
      <Section title="Questionnaire" description="Manage the public questionnaire fields">
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
                  <button
                    type="button"
                    className="text-xs text-slate-600 hover:text-slate-800"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [groupName]: !(prev[groupName] ?? true) }))}
                  >
                    {(openGroups[groupName] ?? true) ? "Collapse" : "Expand"}
                  </button>
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
                        <button
                          type="button"
                          className="text-sm text-rose-500"
                          onClick={() =>
                            setQFields((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, options: (p.options ?? []).filter((_, j) => j !== optIdx) } : p))
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-sm text-[rgb(var(--brand))]"
                      onClick={() => setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, options: [...(p.options ?? []), ""] } : p)))}
                    >
                      Add option
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="text-sm text-rose-500"
                  onClick={() => setQFields((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
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
      </Section>
      )}

      {tab === "playbook" && (
      <Section title="Task playbook" description="Define the tasks to create for each stage and the quick-add actions">
        <div className="space-y-6">
          {STATUS_KEYS.map((status) => (
            <div key={status} className="rounded-xl border bg-white/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">{status.replace(/_/g, " ")}</div>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => addStatusRecipe(status)}
                >
                  Add task
                </button>
              </div>
              {(playbook.status[status] || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white/60 p-3 text-xs text-slate-500">
                  No tasks yet for this stage.
                </div>
              ) : (
                (playbook.status[status] || []).map((r, idx) => (
                  <div key={r.id || idx} className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
                    <input
                      className="rounded-xl border bg-white/95 px-3 py-2 text-sm"
                      value={r.title}
                      onChange={(e) => updateStatusRecipe(status, idx, { title: e.target.value })}
                    />
                    <input
                      type="number"
                      className="w-28 rounded-xl border bg-white/95 px-3 py-2 text-sm"
                      value={r.dueInDays ?? 1}
                      onChange={(e) => updateStatusRecipe(status, idx, { dueInDays: Number(e.target.value || 0) })}
                    />
                    <select
                      className="w-32 rounded-xl border bg-white/95 px-3 py-2 text-sm"
                      value={r.priority || "MEDIUM"}
                      onChange={(e) => updateStatusRecipe(status, idx, { priority: e.target.value as any })}
                    >
                      {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                        <option key={p} value={p}>{p.toLowerCase()}</option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.active !== false}
                        onChange={(e) => updateStatusRecipe(status, idx, { active: e.target.checked })}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      className="text-sm text-rose-600"
                      onClick={() => removeStatusRecipe(status, idx)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          ))}

          <div className="rounded-xl border bg-white/70 p-3">
            <div className="mb-2 text-sm font-semibold text-slate-800">Quick-add tasks</div>
            <div className="space-y-2">
              {(MANUAL_TASK_KEYS as readonly ManualTaskKey[]).map((key) => {
                const r = playbook.manual[key];
                return (
                  <div key={key} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                    <input
                      className="rounded-xl border bg-white/95 px-3 py-2 text-sm"
                      value={r.title}
                      onChange={(e) => updateManualRecipe(key, { title: e.target.value })}
                    />
                    <input
                      type="number"
                      className="w-28 rounded-xl border bg-white/95 px-3 py-2 text-sm"
                      value={r.dueInDays ?? 1}
                      onChange={(e) => updateManualRecipe(key, { dueInDays: Number(e.target.value || 0) })}
                    />
                    <select
                      className="w-32 rounded-xl border bg-white/95 px-3 py-2 text-sm"
                      value={r.priority || "MEDIUM"}
                      onChange={(e) => updateManualRecipe(key, { priority: e.target.value as any })}
                    >
                      {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                        <option key={p} value={p}>{p.toLowerCase()}</option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={r.active !== false}
                        onChange={(e) => updateManualRecipe(key, { active: e.target.checked })}
                      />
                      Active
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving playbook…" : "Save playbook"}
            </Button>
          </div>
        </div>
      </Section>
      )}

      {tab === "email" && (
      <>
      <Section title="Inbox & Integrations" description="Enable Gmail or Microsoft 365 ingestion">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={inbox.gmail} onChange={(e) => setInbox((p) => ({ ...p, gmail: e.target.checked }))} />
            <span>Gmail</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={inbox.ms365} onChange={(e) => setInbox((p) => ({ ...p, ms365: e.target.checked }))} />
            <span>Microsoft 365</span>
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
        <div className="mt-3">
          <Button onClick={saveInbox} disabled={savingInbox}>{savingInbox ? "Saving…" : "Save inbox"}</Button>
        </div>
      </Section>
      <Section title="Gmail Integration">
        <Button onClick={connectGmail}>Connect Gmail</Button>
      </Section>
      </>
      )}
    </div>
  );
}