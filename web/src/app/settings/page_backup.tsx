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
   Main Component
============================================================ */
export default function SettingsPage() {
  const { toast } = useToast();
  const { user, mutate: mutateCurrentUser } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState<'company' | 'questionnaire' | 'automation' | 'integrations'>('company');
  const [s, setS] = useState<Settings | null>(null);
  const [inbox, setInbox] = useState<InboxCfg>({ gmail: false, ms365: false, intervalMinutes: 10 });
  const [savingInbox, setSavingInbox] = useState(false);
  const [gmailConn, setGmailConn] = useState<{ gmailAddress?: string | null } | null>(null);
  const [ms365Conn, setMs365Conn] = useState<{ ms365Address?: string | null } | null>(null);
  const [updatingEarlyAccess, setUpdatingEarlyAccess] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [qFields, setQFields] = useState<QField[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [playbook, setPlaybook] = useState<TaskPlaybook>(normalizeTaskPlaybook(DEFAULT_TASK_PLAYBOOK));

  // Navigation stages configuration
  const stages = [
    {
      id: 'company' as const,
      title: 'Company',
      icon: '🏢',
      description: 'Basic company info and profile'
    },
    {
      id: 'questionnaire' as const,
      title: 'Questionnaire',
      icon: '📋',
      description: 'Lead capture form fields'
    },
    {
      id: 'automation' as const,
      title: 'Automation',
      icon: '⚡',
      description: 'Task playbooks and workflows'
    },
    {
      id: 'integrations' as const,
      title: 'Integrations',
      icon: '🔗',
      description: 'Email and external connections'
    }
  ];

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
   Main Component
============================================================ */
export default function SettingsPage() {
  const { toast } = useToast();
  const { user, mutate: mutateCurrentUser } = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState<'company' | 'questionnaire' | 'automation' | 'integrations'>('company');
  const [s, setS] = useState<Settings | null>(null);
  const [inbox, setInbox] = useState<InboxCfg>({ gmail: false, ms365: false, intervalMinutes: 10 });
  const [savingInbox, setSavingInbox] = useState(false);
  const [gmailConn, setGmailConn] = useState<{ gmailAddress?: string | null } | null>(null);
  const [ms365Conn, setMs365Conn] = useState<{ ms365Address?: string | null } | null>(null);
  const [updatingEarlyAccess, setUpdatingEarlyAccess] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [qFields, setQFields] = useState<QField[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [playbook, setPlaybook] = useState<TaskPlaybook>(normalizeTaskPlaybook(DEFAULT_TASK_PLAYBOOK));

  // Navigation stages configuration
  const stages = [
    {
      id: 'company' as const,
      title: 'Company',
      icon: '🏢',
      description: 'Basic company info and profile'
    },
    {
      id: 'questionnaire' as const,
      title: 'Questionnaire',
      icon: '📋',
      description: 'Lead capture form fields'
    },
    {
      id: 'automation' as const,
      title: 'Automation',
      icon: '⚡',
      description: 'Task playbooks and workflows'
    },
    {
      id: 'integrations' as const,
      title: 'Integrations',
      icon: '🔗',
      description: 'Email and external connections'
    }
  ];

  useEffect(() => {
    (async () => {
      const ok = await ensureDemoAuth();
      if (!ok) return;
      try {
        await mutateCurrentUser();
        const data = await apiFetch<Settings>("/tenant/settings");
        setS(data);
        if ((data as any)?.inbox) setInbox((data as any).inbox as InboxCfg);
        setQFields(normalizeQuestionnaire((data as any)?.questionnaire ?? []));
        setPlaybook(normalizeTaskPlaybook((data as any)?.taskPlaybook ?? DEFAULT_TASK_PLAYBOOK));
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
      try {
        await apiFetch("/tenant/settings", {
          method: "PATCH",
          json: { ownerFirstName: profileFirstName, ownerLastName: profileLastName },
        });
        setS((prev) => (prev ? { ...prev, ownerFirstName: profileFirstName, ownerLastName: profileLastName } : prev));
      } catch (err) {
        toast({ title: "Profile updated (owner name not saved)", description: String((err as any)?.message || "") });
      }
      toast({ title: "Profile updated" });
    } catch (e: any) {
      toast({ title: "Couldn't update profile", description: e?.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

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

  // Task Playbook editor helpers
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
      toast({ title: "Failed to save inbox", description: e?.message || "", variant: "destructive" });
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
      toast({ title: "Couldn't update early access", description: e?.message, variant: "destructive" });
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

  async function connectMs365() {
    const base = API_BASE.replace(/\/$/, "");
    window.location.href = `${base}/ms365/login`;
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

  // Stage Navigation Component
  const StageNavigation = () => (
    <div className="flex border-b border-gray-200 bg-gray-50 rounded-t-lg">
      {stages.map((stage) => (
        <button
          key={stage.id}
          onClick={() => setCurrentStage(stage.id)}
          className={`flex-1 px-4 py-3 text-sm font-medium text-center transition-colors ${
            currentStage === stage.id
              ? 'text-blue-600 bg-white border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">{stage.icon}</span>
            <div className="flex flex-col">
              <span>{stage.title}</span>
              <span className="text-xs text-gray-400">{stage.description}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  // Company Stage Component
  const CompanyStage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Company Profile</h2>
        <div className="flex gap-3">
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </Button>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={s?.brandName ?? ""}
              onChange={(e) => setS((prev) => (prev ? { ...prev, brandName: e.target.value } : prev))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={s?.website ?? ""}
              onChange={(e) => setS((prev) => (prev ? { ...prev, website: e.target.value } : prev))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={s?.phone ?? ""}
              onChange={(e) => setS((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner First Name
            </label>
            <input
              type="text"
              value={profileFirstName}
              onChange={(e) => setProfileFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner Last Name
            </label>
            <input
              type="text"
              value={profileLastName}
              onChange={(e) => setProfileLastName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Intro HTML
              <span className="text-xs text-gray-500 ml-2">Optional HTML shown on public questionnaire</span>
            </label>
            <textarea
              value={s?.introHtml ?? ""}
              onChange={(e) => setS((prev) => (prev ? { ...prev, introHtml: e.target.value } : prev))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-3">Source Costs</h3>
        <SourceCosts />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-3">Early Access</h3>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!user?.isEarlyAdopter}
            disabled={updatingEarlyAccess}
            onChange={(e) => updateEarlyAccess(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">
            {user?.isEarlyAdopter ? "Early access enabled" : "Enable early access features"}
          </span>
        </label>
      </div>
    </div>
  );

  // Questionnaire Stage Component
  const QuestionnaireStage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Lead Questionnaire</h2>
        <div className="flex gap-3">
          <Button
            onClick={() =>
              setQFields((prev) => [
                ...prev,
                { id: makeFieldId(), key: `field_${prev.length + 1}`, label: `Field ${prev.length + 1}`, type: "text" },
              ])
            }
          >
            Add Question
          </Button>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? "Saving..." : "Save Questionnaire"}
          </Button>
        </div>
      </div>

      {qFields.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No questionnaire fields yet</p>
          <Button onClick={() => 
            setQFields([
              { id: makeFieldId(), key: "project_type", label: "Project Type", type: "select", options: ["Renovation", "New Build", "Extension"] },
              { id: makeFieldId(), key: "budget", label: "Budget Range", type: "select", options: ["Under $50k", "$50k-$100k", "$100k+"] },
              { id: makeFieldId(), key: "timeline", label: "Timeline", type: "text" }
            ])
          }>
            Add Sample Questions
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {qFields.map((field, idx) => (
            <div key={field.id || idx} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field Key</label>
                  <input
                    type="text"
                    value={field.key}
                    onChange={(e) =>
                      setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, key: e.target.value } : p)))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) =>
                      setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={field.type}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {field.type === "select" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                  <div className="space-y-2">
                    {(field.options ?? []).map((option, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) =>
                            setQFields((prev) =>
                              prev.map((p, i) =>
                                i === idx
                                  ? { ...p, options: (p.options ?? []).map((o, j) => (j === optIdx ? e.target.value : o)) }
                                  : p
                              )
                            )
                          }
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setQFields((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, options: (p.options ?? []).filter((_, j) => j !== optIdx) } : p))
                            )
                          }
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, options: [...(p.options ?? []), ""] } : p)))}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      + Add Option
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!field.required}
                    onChange={(e) =>
                      setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, required: e.target.checked } : p)))
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Required</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.askInQuestionnaire !== false && !field.internalOnly}
                    onChange={(e) =>
                      setQFields((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, askInQuestionnaire: e.target.checked, internalOnly: e.target.checked ? false : p.internalOnly } : p
                        )
                      )
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Show on public form</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!field.showOnLead}
                    onChange={(e) =>
                      setQFields((prev) => prev.map((p, i) => (i === idx ? { ...p, showOnLead: e.target.checked } : p)))
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Show in lead</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!field.internalOnly}
                    onChange={(e) =>
                      setQFields((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, internalOnly: e.target.checked, askInQuestionnaire: e.target.checked ? false : p.askInQuestionnaire } : p
                        )
                      )
                    }
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Internal-only</span>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setQFields((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove Question
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Automation Stage Component  
  const AutomationStage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Task Automation</h2>
        <Button onClick={saveSettings} disabled={savingSettings}>
          {savingSettings ? "Saving..." : "Save Playbook"}
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status-Based Tasks</h3>
          <p className="text-sm text-gray-600 mb-4">
            Configure tasks that are automatically created when a lead changes to each status.
          </p>
          
          {STATUS_KEYS.map((status) => (
            <div key={status} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">
                  {status.replace(/_/g, " ")}
                </h4>
                <button
                  type="button"
                  onClick={() => addStatusRecipe(status)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  + Add Task
                </button>
              </div>
              
              {(playbook.status[status] || []).length === 0 ? (
                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                  No automatic tasks for this status
                </div>
              ) : (
                <div className="space-y-3">
                  {(playbook.status[status] || []).map((recipe, idx) => (
                    <div key={recipe.id || idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="text"
                        value={recipe.title}
                        onChange={(e) => updateStatusRecipe(status, idx, { title: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Task title"
                      />
                      
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Due in</label>
                        <input
                          type="number"
                          value={recipe.dueInDays ?? 1}
                          onChange={(e) => updateStatusRecipe(status, idx, { dueInDays: Number(e.target.value || 0) })}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                        />
                        <span className="text-sm text-gray-600">days</span>
                      </div>
                      
                      <select
                        value={recipe.priority || "MEDIUM"}
                        onChange={(e) => updateStatusRecipe(status, idx, { priority: e.target.value as any })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                          <option key={p} value={p}>{p.toLowerCase()}</option>
                        ))}
                      </select>
                      
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={recipe.active !== false}
                            onChange={(e) => updateStatusRecipe(status, idx, { active: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Active</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeStatusRecipe(status, idx)}
                          className="text-red-600 hover:text-red-800 text-sm ml-auto"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick-Add Tasks</h3>
          <p className="text-sm text-gray-600 mb-4">
            Configure templates for manually adding common tasks.
          </p>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="space-y-3">
              {(MANUAL_TASK_KEYS as readonly ManualTaskKey[]).map((key) => {
                const recipe = playbook.manual[key];
                return (
                  <div key={key} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={recipe.title}
                      onChange={(e) => updateManualRecipe(key, { title: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Task title"
                    />
                    
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Due in</label>
                      <input
                        type="number"
                        value={recipe.dueInDays ?? 1}
                        onChange={(e) => updateManualRecipe(key, { dueInDays: Number(e.target.value || 0) })}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                      />
                      <span className="text-sm text-gray-600">days</span>
                    </div>
                    
                    <select
                      value={recipe.priority || "MEDIUM"}
                      onChange={(e) => updateManualRecipe(key, { priority: e.target.value as any })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                        <option key={p} value={p}>{p.toLowerCase()}</option>
                      ))}
                    </select>
                    
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={recipe.active !== false}
                        onChange={(e) => updateManualRecipe(key, { active: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Integrations Stage Component
  const IntegrationsStage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Email & Integrations</h2>
        <Button onClick={saveInbox} disabled={savingInbox}>
          {savingInbox ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📧</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Gmail</h3>
              <p className="text-sm text-gray-600">
                {gmailConn?.gmailAddress ? `Connected as ${gmailConn.gmailAddress}` : "Not connected"}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={inbox.gmail} 
                onChange={(e) => setInbox((p) => ({ ...p, gmail: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Enable Gmail ingestion</span>
            </label>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={connectGmail}>
                {gmailConn?.gmailAddress ? "Reconnect" : "Connect"} Gmail
              </Button>
              <Button variant="outline" onClick={runImportGmail}>
                Import Now
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📫</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Microsoft 365</h3>
              <p className="text-sm text-gray-600">
                {ms365Conn?.ms365Address ? `Connected as ${ms365Conn.ms365Address}` : "Not connected"}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={inbox.ms365} 
                onChange={(e) => setInbox((p) => ({ ...p, ms365: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Enable MS365 ingestion</span>
            </label>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={connectMs365}>
                {ms365Conn?.ms365Address ? "Reconnect" : "Connect"} MS365
              </Button>
              <Button variant="outline" onClick={runImportMs365}>
                Import Now
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Inbox Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Poll Interval (minutes)
            </label>
            <input 
              type="number" 
              value={inbox.intervalMinutes} 
              onChange={(e) => setInbox((p) => ({ ...p, intervalMinutes: Number(e.target.value || 10) }))}
              min="1"
              max="60"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 mt-6">
              <input 
                type="checkbox" 
                checked={!!inbox.recallFirst} 
                onChange={(e) => setInbox((p) => ({ ...p, recallFirst: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Prefer recall (never miss leads)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading || !s) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-6xl p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          
          {/* Stage Navigation */}
          <StageNavigation />
          
          {/* Stage Content */}
          <div className="min-h-[600px]">
            {currentStage === 'company' && <CompanyStage />}
            {currentStage === 'questionnaire' && <QuestionnaireStage />}
            {currentStage === 'automation' && <AutomationStage />}
            {currentStage === 'integrations' && <IntegrationsStage />}
          </div>
          
        </div>
      </div>
    </div>
  );
}