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
  internalOnly: boolean;
  visibleAfterOrder: boolean;
  sortOrder: number;
};

type TenantSettings = {
  taskPlaybook?: TaskPlaybook;
  questionnaire?: QuestionnaireField[];
  questionnaireEmailSubject?: string;
  questionnaireEmailBody?: string;
};

/* ----------------------------- Constants & Helpers ----------------------------- */

const STATUS_LABELS: Record<Lead["status"], string> = {
  NEW_ENQUIRY: "New Enquiry",
  INFO_REQUESTED: "Info Requested",
  DISQUALIFIED: "Disqualified",
  REJECTED: "Rejected",
  READY_TO_QUOTE: "Ready to Quote",
  QUOTE_SENT: "Quote Sent",
  WON: "Won",
  LOST: "Lost",
};

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
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
}

function findTaskRecipe(playbook: TaskPlaybook, task: Task): TaskRecipe | null {
  const key = task.meta?.key;
  if (!key) return null;
  // Note: manualTasks might not exist in the current TaskPlaybook type
  return null;
}

function cleanString(value: string): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function htmlToText(html: string): string {
  if (!html) return "";
  let str = String(html);
  str = str.replace(/<[^>]*>/g, "");
  str = str.replace(/&nbsp;/g, " ");
  const el = document.createElement("div");
  el.innerHTML = str;
  return el.textContent || el.innerText || "";
}

function formatDateForInput(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
}

/* ----------------------------- Main Component ----------------------------- */

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
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Stage navigation
  const [currentStage, setCurrentStage] = useState<'overview' | 'details' | 'questionnaire' | 'tasks'>('overview');

  // Form inputs
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});

  // Task creation
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [taskComposer, setTaskComposer] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as Task["priority"],
    dueAt: "",
  });
  const [taskSaving, setTaskSaving] = useState(false);

  const lastSavedServerStatusRef = useRef<string | null>(null);

  const playbook = useMemo(
    () => normalizeTaskPlaybook(settings?.taskPlaybook ?? DEFAULT_TASK_PLAYBOOK),
    [settings?.taskPlaybook]
  );

  // Navigation stages configuration
  const stages = [
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
    }
  ];

  // Initialize form fields when lead changes
  useEffect(() => {
    if (leadPreview) {
      setLead(leadPreview);
      setUiStatus(leadPreview.status);
      setNameInput(leadPreview.contactName || "");
      setEmailInput(leadPreview.email || "");
      setDescInput(leadPreview.description || "");
      lastSavedServerStatusRef.current = leadPreview.status;
    }
  }, [leadPreview]);

  // Load settings and tasks
  useEffect(() => {
    if (!open || !tenantId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [settingsResult, tasksResult] = await Promise.all([
          apiFetch<TenantSettings>("/tenant-settings", { headers: authHeaders }),
          leadPreview?.id
            ? apiFetch<Task[]>(`/tasks?relatedType=LEAD&relatedId=${leadPreview.id}`, { headers: authHeaders })
            : Promise.resolve([])
        ]);

        setSettings(settingsResult);
        setTasks(tasksResult);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, tenantId, leadPreview?.id, authHeaders]);

  // Utility components
  const StatusBadge = ({ status }: { status: Lead["status"] }) => (
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

  const StatusPipeline = ({ currentStatus, onStatusChange, disabled }: {
    currentStatus: Lead["status"];
    onStatusChange: (status: Lead["status"]) => void;
    disabled?: boolean;
  }) => (
    <select
      value={currentStatus}
      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
      onChange={(e) => onStatusChange(e.target.value as Lead["status"])}
      disabled={disabled}
    >
      {(Object.keys(STATUS_LABELS) as Lead["status"][]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Unknown";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  };

  // Stage Navigation Component
  const StageNavigation = () => (
    <div className="flex border-b border-gray-200 bg-gray-50">
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

  // Overview Stage Component
  const OverviewStage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {lead?.contactName || lead?.email || "Unnamed Lead"}
          </h2>
          <p className="text-gray-600 mt-1">{lead?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={uiStatus} />
            <span className="text-sm text-gray-500">
              Lead #{lead?.id?.slice(-8)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {lead && (
            <DeclineEnquiryButton 
              lead={lead}
              authHeaders={authHeaders}
              onMarkedRejected={() => {
                onUpdated?.();
                onOpenChange(false);
              }}
            />
          )}
        </div>
      </div>

      {lead?.description && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Initial Enquiry</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{lead.description}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => setCurrentStage('details')}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">📝</span>
                <div>
                  <div className="font-medium">Edit Details</div>
                  <div className="text-sm text-gray-500">Update contact information</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => setCurrentStage('questionnaire')}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">📋</span>
                <div>
                  <div className="font-medium">View Questionnaire</div>
                  <div className="text-sm text-gray-500">Client responses and data</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => setCurrentStage('tasks')}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <div className="font-medium">Manage Tasks</div>
                  <div className="text-sm text-gray-500">Create and track next steps</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Lead Progress</h3>
          <StatusPipeline 
            currentStatus={uiStatus}
            onStatusChange={(newStatus: Lead["status"]) => {
              setUiStatus(newStatus);
              if (lead?.id) {
                setSaving(true);
                apiFetch(`/leads/${lead.id}`, {
                  method: "PATCH",
                  headers: { ...authHeaders, "Content-Type": "application/json" },
                  body: JSON.stringify({ status: newStatus })
                })
                  .then(() => {
                    lastSavedServerStatusRef.current = newStatus;
                    onUpdated?.();
                  })
                  .catch((err: any) => console.error("Failed to update status:", err))
                  .finally(() => setSaving(false));
              }
            }}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  );

  // Details Stage Component 
  const DetailsStage = () => (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Contact Details</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter contact name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter email address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={descInput}
            onChange={(e) => setDescInput(e.target.value)}
            placeholder="Enter lead description"
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setCurrentStage('overview')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            if (lead?.id) {
              setSaving(true);
              try {
                await apiFetch(`/leads/${lead.id}`, {
                  method: "PATCH",
                  headers: { ...authHeaders, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contactName: nameInput || null,
                    email: emailInput || null,
                    description: descInput || null,
                  })
                });
                onUpdated?.();
                setCurrentStage('overview');
              } catch (err) {
                console.error("Failed to update lead:", err);
              } finally {
                setSaving(false);
              }
            }
          }}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );

  // Questionnaire Stage Component
  const QuestionnaireStage = () => {
    const fields = normalizeQuestionnaireFields(settings?.questionnaire);
    
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Questionnaire</h2>
        
        {fields.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No questionnaire configured</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field) => {
              const value = lead?.custom?.[field.key] || "";
              return (
                <div key={field.id} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  
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
    );
  };

  // Tasks Stage Component
  const TasksStage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
        <button
          onClick={() => setShowTaskComposer(!showTaskComposer)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Task
        </button>
      </div>
      
      {showTaskComposer && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title
            </label>
            <input
              type="text"
              value={taskComposer.title}
              onChange={(e) => setTaskComposer(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowTaskComposer(false);
                setTaskComposer({
                  title: "",
                  description: "",
                  priority: "MEDIUM",
                  dueAt: "",
                });
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!taskComposer.title.trim() || !lead?.id) return;
                
                setTaskSaving(true);
                try {
                  const newTask = await apiFetch<Task>("/tasks", {
                    method: "POST",
                    headers: { ...authHeaders, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: taskComposer.title,
                      description: taskComposer.description || null,
                      priority: taskComposer.priority,
                      dueAt: taskComposer.dueAt || null,
                      relatedType: "LEAD",
                      relatedId: lead.id,
                    })
                  });
                  
                  setTasks(current => [...current, newTask]);
                  
                  setShowTaskComposer(false);
                  setTaskComposer({
                    title: "",
                    description: "",
                    priority: "MEDIUM",
                    dueAt: "",
                  });
                } catch (err) {
                  console.error("Failed to create task:", err);
                } finally {
                  setTaskSaving(false);
                }
              }}
              disabled={taskSaving || !taskComposer.title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {taskSaving ? "Creating..." : "Create Task"}
            </button>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No tasks yet</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      task.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                      task.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                      task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      task.status === 'DONE' ? 'bg-green-100 text-green-800' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    {task.dueAt && (
                      <span className="text-xs text-gray-500">
                        Due: {formatDate(task.dueAt)}
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={async () => {
                    try {
                      await apiFetch(`/tasks/${task.id}`, {
                        method: "PATCH",
                        headers: { ...authHeaders, "Content-Type": "application/json" },
                        body: JSON.stringify({
                          status: task.status === "DONE" ? "OPEN" : "DONE"
                        })
                      });
                      
                      setTasks(current => 
                        current.map(t => 
                          t.id === task.id 
                            ? { ...t, status: t.status === "DONE" ? "OPEN" : "DONE" }
                            : t
                        )
                      );
                    } catch (err) {
                      console.error("Failed to update task:", err);
                    }
                  }}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    task.status === "DONE"
                      ? "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {task.status === "DONE" ? "Reopen" : "Complete"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-gradient-to-br from-sky-500/30 via-indigo-700/20 to-rose-500/30 backdrop-blur flex items-center justify-center px-3 py-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div className="relative flex h-[min(88vh,calc(100vh-3rem))] w-[min(1200px,95vw)] max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-white/30 bg-white shadow-[0_32px_70px_-35px_rgba(30,64,175,0.45)] backdrop-blur-xl">
        
        {/* Stage Navigation */}
        <StageNavigation />
        
        {/* Stage Content */}
        <div className="flex-1 overflow-auto">
          {currentStage === 'overview' && <OverviewStage />}
          {currentStage === 'details' && <DetailsStage />}
          {currentStage === 'questionnaire' && <QuestionnaireStage />}
          {currentStage === 'tasks' && <TasksStage />}
        </div>
        
        {/* Close Button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow-sm border border-gray-200"
          >
            <span className="text-gray-600">✕</span>
          </button>
        </div>
        
      </div>
    </div>
  );
}