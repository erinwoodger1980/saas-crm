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
import LeadSourcePicker from "@/components/leads/LeadSourcePicker";
import DeclineEnquiryButton from "./DeclineEnquiryButton";

/* ----------------------------- Types ----------------------------- */

export type Lead = {
  id: string;
  contactName?: string | null;
  email?: string | null;
  quoteId?: string | null;
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
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
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
  internalOnly: boolean;
  visibleAfterOrder: boolean;
  sortOrder: number;
};

type TenantSettings = {
  tenantId: string;
  slug: string;
  brandName: string;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  questionnaire?: { title?: string; questions?: QuestionnaireField[] } | QuestionnaireField[] | null;
  taskPlaybook?: TaskPlaybook | null;
  questionnaireEmailSubject?: string | null;
  questionnaireEmailBody?: string | null;
};

type EmailThread = {
  id: string;
  threadId?: string | null;
  subject?: string | null;
  from?: string | null;
  to?: string | null;
  receivedAt?: string | null;
  snippet?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
};

/* ----------------------------- Utils ----------------------------- */

function avatarText(name?: string | null): string {
  if (!name?.trim()) return "?";
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] || p[0][1] || "")).toUpperCase();
}

const FIELD_TYPES = new Set(["text", "textarea", "select", "number", "date", "source"]);

function normalizeQuestionnaireFields(config?: QuestionnaireField[]): NormalizedQuestionnaireField[] {
  if (!config) return [];
  const list = Array.isArray(config) ? config : [];
  
  return list
    .map((raw: any, index: number) => {
      const key = typeof raw.key === "string" && raw.key.trim() ? raw.key.trim() : undefined;
      if (!key) return null;
      const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : key;
      const label = typeof raw.label === "string" && raw.label.trim()
        ? raw.label.trim()
        : key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");

      const typeRaw = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim() : "text";
      const type = FIELD_TYPES.has(typeRaw) ? typeRaw : "text";
      const required = Boolean((raw as any).required);
      const options = Array.isArray((raw as any).options)
        ? (raw as any).options.filter((opt: any) => typeof opt === "string" && opt.trim()).map((opt: string) => opt.trim())
        : [];

      const askInQuestionnaire = (raw as any).askInQuestionnaire !== false;
      const showOnLead = (raw as any).showOnLead !== false;
      const internalOnly = (raw as any).internalOnly === true ? true : undefined;
      const visibleAfterOrder = (raw as any).visibleAfterOrder === true ? true : undefined;
      const sortOrder = typeof (raw as any).sortOrder === "number" ? (raw as any).sortOrder : index;

      return {
        id,
        key,
        label,
        required,
        type,
        options,
        askInQuestionnaire,
        showOnLead,
        internalOnly: internalOnly ?? false,
        visibleAfterOrder: visibleAfterOrder ?? false,
        sortOrder,
      };
    })
    .filter((field: any): field is NormalizedQuestionnaireField => field !== null)
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

  // Core state
  const [lead, setLead] = useState<Lead | null>(leadPreview);
  const [uiStatus, setUiStatus] = useState<Lead["status"]>("NEW_ENQUIRY");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTask, setBusyTask] = useState(false);

  // Stage navigation
  const [currentStage, setCurrentStage] = useState<'overview' | 'details' | 'questionnaire' | 'tasks'>('overview');

  // Form inputs
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [descInput, setDescInput] = useState("");

  // Task management
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [taskComposer, setTaskComposer] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Task["priority"],
    dueAt: "",
  });

  // Auto-save with debouncing to prevent saving on every character
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const savePatch = useCallback(async (patch: Partial<Lead>) => {
    if (!lead?.id) return;
    
    try {
      setSaving(true);
      await apiFetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(patch),
      });
      
      await onUpdated?.();
    } catch (err) {
      console.error("Save error:", err);
      toast("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [lead?.id, authHeaders, onUpdated]);
  
  const debouncedSave = useCallback((data: Partial<Lead>) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(() => {
      savePatch(data);
    }, 1000); // Wait 1 second after user stops typing
    
    setSaveTimeout(timeout);
  }, [saveTimeout, savePatch]);

  // Form handlers with debounced saving
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNameInput(value);
    setLead((l) => (l ? { ...l, contactName: value || null } : l));
    debouncedSave({ contactName: value || null });
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailInput(value);
    setLead((l) => (l ? { ...l, email: value || null } : l));
    debouncedSave({ email: value || null });
  };

  const handleDescChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDescInput(value);
    setLead((l) => (l ? { ...l, description: value || null } : l));
    debouncedSave({ description: value || null });
  };

  // Load data when modal opens
  useEffect(() => {
    if (!open || !leadPreview?.id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load lead details
        const leadData = await apiFetch<Lead>(`/api/leads/${leadPreview.id}`, {
          headers: authHeaders,
        });
        
        setLead(leadData);
        setUiStatus(leadData.status || "NEW_ENQUIRY");
        setNameInput(leadData.contactName || "");
        setEmailInput(leadData.email || "");
        setDescInput(leadData.description || "");

        // Load tasks
        const tasksData = await apiFetch<Task[]>(`/api/tasks?relatedType=LEAD&relatedId=${leadPreview.id}`, {
          headers: authHeaders,
        });
        
        setTasks(tasksData || []);

        // Load email threads
        const emailData = await apiFetch<EmailThread[]>(`/api/leads/${leadPreview.id}/emails`, {
          headers: authHeaders,
        });
        
        setEmailThreads(emailData || []);

        // Load settings
        const settingsData = await apiFetch<TenantSettings>("/api/settings", {
          headers: authHeaders,
        });
        
        setSettings(settingsData);
        
      } catch (err) {
        console.error("Error loading lead data:", err);
        toast("Failed to load lead data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, leadPreview?.id, authHeaders]);

  // Action handlers
  const sendQuestionnaire = async () => {
    if (!lead?.id || !lead?.email) {
      toast("Lead must have an email to send questionnaire");
      return;
    }

    setBusyTask(true);
    try {
      await apiFetch(`/api/leads/${lead.id}/send-questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          emailSubject: settings?.questionnaireEmailSubject || DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
          emailBody: settings?.questionnaireEmailBody || DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
        }),
      });

      toast("Questionnaire sent successfully");
      setUiStatus("INFO_REQUESTED");
      savePatch({ status: "INFO_REQUESTED" });
    } catch (err) {
      console.error("Error sending questionnaire:", err);
      toast("Failed to send questionnaire");
    } finally {
      setBusyTask(false);
    }
  };

  const requestSupplierQuote = async () => {
    setBusyTask(true);
    try {
      await apiFetch(`/api/leads/${lead?.id}/supplier-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });

      toast("Supplier quote request sent");
    } catch (err) {
      console.error("Error requesting supplier quote:", err);
      toast("Failed to send supplier request");
    } finally {
      setBusyTask(false);
    }
  };

  const openQuoteBuilder = () => {
    if (!lead?.quoteId) {
      toast("No quote associated with this lead");
      return;
    }
    window.open(`/quotes/${lead.quoteId}`, "_blank");
  };

  const createTask = async () => {
    if (!taskComposer.title.trim()) {
      toast("Task title is required");
      return;
    }

    try {
      const newTask = await apiFetch<Task>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          title: taskComposer.title,
          description: taskComposer.description || null,
          priority: taskComposer.priority,
          dueAt: taskComposer.dueAt || null,
          relatedType: "LEAD",
          relatedId: lead?.id,
          status: "OPEN",
        }),
      });

      setTasks(prev => [...prev, newTask]);
      setTaskComposer({
        title: "",
        description: "",
        priority: "MEDIUM",
        dueAt: "",
      });
      setShowTaskComposer(false);
      toast("Task created successfully");
    } catch (err) {
      console.error("Error creating task:", err);
      toast("Failed to create task");
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: Task["status"]) => {
    const newStatus = currentStatus === "DONE" ? "OPEN" : "DONE";
    
    try {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ status: newStatus }),
      });

      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    } catch (err) {
      console.error("Error updating task:", err);
      toast("Failed to update task");
    }
  };

  // Computed values
  const questionnaireFields = useMemo(() => {
    if (!settings?.questionnaire) return [];
    const config = Array.isArray(settings.questionnaire) 
      ? settings.questionnaire 
      : settings.questionnaire.questions || [];
    return normalizeQuestionnaireFields(config);
  }, [settings?.questionnaire]);

  const customData = lead?.custom || {};
  const questionnaireItems = customData?.items || [];
  const openTasks = tasks.filter(t => t.status !== "DONE" && t.status !== "CANCELLED");
  const completedTasks = tasks.filter(t => t.status === "DONE");
  const progress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      
      <div className="relative w-full max-w-7xl max-h-[90vh] mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
              {avatarText(lead?.contactName)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {lead?.contactName || "Unnamed Lead"}
              </h2>
              <p className="text-sm text-gray-500">{lead?.email}</p>
            </div>
            {saving && (
              <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                Saving...
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={uiStatus}
              onChange={(e) => {
                const newStatus = e.target.value as Lead["status"];
                setUiStatus(newStatus);
                savePatch({ status: newStatus });
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            >
              <option value="NEW_ENQUIRY">New Enquiry</option>
              <option value="INFO_REQUESTED">Info Requested</option>
              <option value="READY_TO_QUOTE">Ready to Quote</option>
              <option value="QUOTE_SENT">Quote Sent</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
              <option value="REJECTED">Rejected</option>
            </select>
            
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b bg-gradient-to-r from-sky-50 via-indigo-50 to-amber-50">
          {uiStatus === "NEW_ENQUIRY" && (
            <DeclineEnquiryButton
              lead={{
                id: lead?.id || leadPreview?.id || "",
                contactName: lead?.contactName ?? leadPreview?.contactName,
                email: lead?.email ?? leadPreview?.email,
                description: lead?.description ?? leadPreview?.description,
                custom: lead?.custom ?? leadPreview?.custom ?? null,
              }}
              disabled={saving || loading}
              authHeaders={authHeaders}
              brandName={settings?.brandName ?? null}
              onMarkedRejected={() => {
                setUiStatus("REJECTED");
                return savePatch({ status: "REJECTED" });
              }}
            />
          )}

          <button
            className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-white"
            onClick={sendQuestionnaire}
            disabled={busyTask || saving || !lead?.email}
            title="Send questionnaire to client"
          >
            <span aria-hidden="true">📜</span>
            Send questionnaire
          </button>

          <button
            className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-white"
            onClick={requestSupplierQuote}
            disabled={busyTask}
            title="Request quote from supplier"
          >
            <span aria-hidden="true">🧞</span>
            Request supplier quote
          </button>

          <button
            className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 text-white px-4 py-2 text-sm font-semibold shadow hover:from-indigo-600 hover:to-sky-600"
            onClick={openQuoteBuilder}
            title="Open quote builder"
            disabled={!lead?.quoteId}
          >
            Open Quote Builder
          </button>
        </div>

        {/* Stage Navigation */}
        <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1 mx-6 mt-4">
          {[
            { key: "overview", label: "Overview", icon: "📊", description: "Lead summary and actions" },
            { key: "details", label: "Details", icon: "📝", description: "Contact info and notes" },
            { key: "questionnaire", label: "Questionnaire", icon: "📋", description: "Client responses" },
            { key: "tasks", label: "Tasks", icon: "✅", description: "Action items" },
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

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 min-h-[60vh]">
            {/* Main Content Area */}
            <div className="lg:col-span-3 p-6 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading...</div>
                </div>
              ) : (
                <>
                  {/* Overview Stage */}
                  {currentStage === 'overview' && (
                    <div className="space-y-6">
                      {/* Lead Summary */}
                      <div className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
                          <span aria-hidden="true">✨</span>
                          Lead Summary
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Contact</div>
                            <div className="text-sm text-slate-700">
                              {lead?.contactName || "No name provided"}
                              {lead?.email && (
                                <div className="text-xs text-slate-500">{lead.email}</div>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Status</div>
                            <div className="text-sm text-slate-700">
                              {uiStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                          </div>
                        </div>

                        {lead?.description && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Description</div>
                            <div className="text-sm text-slate-700 bg-gray-50 p-3 rounded-lg">
                              {lead.description}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Email Thread */}
                      {emailThreads.length > 0 && (
                        <div className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm">
                          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
                            <span aria-hidden="true">✉️</span>
                            Email Thread
                          </h3>
                          
                          <div className="space-y-3">
                            {emailThreads.map((email) => (
                              <div key={email.id} className="border border-gray-200 rounded-lg p-3">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <div className="font-medium text-sm">{email.subject}</div>
                                    <div className="text-xs text-gray-500">
                                      From: {email.from} • {email.receivedAt && new Date(email.receivedAt).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                {email.snippet && (
                                  <div className="text-sm text-gray-700 mt-2">
                                    {email.snippet}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Questionnaire Responses */}
                      {questionnaireItems.length > 0 && (
                        <div className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm">
                          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
                            <span aria-hidden="true">📋</span>
                            Client Responses
                          </h3>
                          
                          <div className="space-y-3">
                            {questionnaireItems.map((item: any, idx: number) => (
                              <div key={idx} className="border border-gray-200 rounded-lg p-3">
                                <div className="font-medium text-sm mb-2">Item {idx + 1}</div>
                                <div className="space-y-1">
                                  {Object.entries(item || {}).map(([k, v]) => {
                                    if (k === "photos") return null;
                                    const answer = formatAnswer(v);
                                    if (!answer) return null;
                                    return (
                                      <div key={k} className="flex gap-2">
                                        <div className="text-xs text-gray-500 w-24 shrink-0">{k}</div>
                                        <div className="text-sm text-gray-700">{answer}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Details Stage */}
                  {currentStage === 'details' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
                          <span aria-hidden="true">📝</span>
                          Contact Details
                        </h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <label className="text-sm">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Name</span>
                            <input
                              className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                              value={nameInput}
                              onChange={handleNameChange}
                              placeholder="Client name"
                            />
                          </label>

                          <label className="text-sm">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Email</span>
                            <input
                              className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-inner"
                              value={emailInput}
                              onChange={handleEmailChange}
                              placeholder="client@email.com"
                            />
                          </label>
                        </div>

                        <label className="text-sm block">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Notes</span>
                          <textarea
                            className="w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-3 min-h-32 shadow-inner"
                            value={descInput}
                            onChange={handleDescChange}
                            placeholder="Project background, requirements, constraints…"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Questionnaire Stage */}
                  {currentStage === 'questionnaire' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4">
                          <span aria-hidden="true">📋</span>
                          Questionnaire Responses
                        </h3>
                        
                        {questionnaireFields.length === 0 ? (
                          <div className="text-sm text-gray-500">No questionnaire configured</div>
                        ) : (
                          <div className="space-y-4">
                            {questionnaireFields.map((field) => {
                              const value = customData[field.key] || "";
                              return (
                                <div key={field.key}>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                    {field.label}
                                    {field.required && <span className="text-red-500">*</span>}
                                  </div>
                                  
                                  {field.type === "textarea" ? (
                                    <textarea
                                      value={value}
                                      readOnly
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                      rows={3}
                                    />
                                  ) : field.type === "select" ? (
                                    <select
                                      value={value}
                                      disabled
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                    >
                                      <option value="">Select an option</option>
                                      {field.options.map((option, i) => (
                                        <option key={i} value={option}>{option}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type={field.type}
                                      value={value}
                                      readOnly
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tasks Stage */}
                  {currentStage === 'tasks' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-sky-100 bg-white/85 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                            <span aria-hidden="true">✅</span>
                            Tasks
                          </h3>
                          <button
                            onClick={() => setShowTaskComposer(!showTaskComposer)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            + Add Task
                          </button>
                        </div>
                        
                        {showTaskComposer && (
                          <div className="bg-gray-50 p-4 rounded-lg space-y-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Task Title
                              </label>
                              <input
                                type="text"
                                value={taskComposer.title}
                                onChange={(e) => setTaskComposer(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Enter task title"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                              </label>
                              <textarea
                                value={taskComposer.description}
                                onChange={(e) => setTaskComposer(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Enter task description"
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Priority
                                </label>
                                <select
                                  value={taskComposer.priority}
                                  onChange={(e) => setTaskComposer(prev => ({ ...prev, priority: e.target.value as Task["priority"] }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                >
                                  <option value="LOW">Low</option>
                                  <option value="MEDIUM">Medium</option>
                                  <option value="HIGH">High</option>
                                  <option value="URGENT">Urgent</option>
                                </select>
                              </div>
                              
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Due Date
                                </label>
                                <input
                                  type="date"
                                  value={taskComposer.dueAt}
                                  onChange={(e) => setTaskComposer(prev => ({ ...prev, dueAt: e.target.value }))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={createTask}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                              >
                                Create Task
                              </button>
                              <button
                                onClick={() => setShowTaskComposer(false)}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          {tasks.length === 0 ? (
                            <div className="text-sm text-gray-500 py-4">No tasks yet</div>
                          ) : (
                            tasks.map((task) => (
                              <div
                                key={task.id}
                                className={`p-3 rounded-lg border ${
                                  task.status === "DONE" 
                                    ? "bg-green-50 border-green-200" 
                                    : "bg-white border-gray-200"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <button
                                    onClick={() => toggleTaskStatus(task.id, task.status)}
                                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      task.status === "DONE"
                                        ? "bg-green-500 border-green-500 text-white"
                                        : "border-gray-300 hover:border-green-400"
                                    }`}
                                  >
                                    {task.status === "DONE" && "✓"}
                                  </button>
                                  
                                  <div className="flex-1">
                                    <div className={`font-medium ${task.status === "DONE" ? "line-through text-gray-500" : ""}`}>
                                      {task.title}
                                    </div>
                                    {task.description && (
                                      <div className="text-sm text-gray-600 mt-1">
                                        {task.description}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        task.priority === "URGENT" ? "bg-red-100 text-red-700" :
                                        task.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                                        task.priority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                                        "bg-gray-100 text-gray-700"
                                      }`}>
                                        {task.priority}
                                      </span>
                                      {task.dueAt && (
                                        <span className="text-xs text-gray-500">
                                          Due: {new Date(task.dueAt).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sidebar - Always Visible Tasks */}
            <div className="lg:col-span-1 bg-gradient-to-br from-indigo-900/10 via-white to-rose-50 p-4 border-l space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <span aria-hidden="true">⭐</span>
                    Task Progress
                  </div>
                  <div className="text-xs text-slate-500">{openTasks.length} open</div>
                </div>
                
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-1">
                    <span>{completedTasks.length} completed</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {openTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleTaskStatus(task.id, task.status)}
                          className="w-3 h-3 rounded-full border border-gray-300 hover:border-green-400 flex-shrink-0"
                        />
                        <span className="truncate">{task.title}</span>
                      </div>
                    </div>
                  ))}
                  
                  {openTasks.length > 5 && (
                    <button
                      onClick={() => setCurrentStage('tasks')}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      View all {openTasks.length} tasks →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}