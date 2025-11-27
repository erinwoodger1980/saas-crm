// web/src/components/tasks/TaskModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FollowUpTaskPanel } from "@/components/follow-up/FollowUpTaskPanel";

type RecurrencePattern = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  taskType?: "MANUAL" | "COMMUNICATION" | "FOLLOW_UP" | "SCHEDULED" | "FORM" | "CHECKLIST";
  relatedType: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string | null;
  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  assignees?: { userId: string; role: "OWNER" | "FOLLOWER" }[];
  meta?: any;
  formSchema?: { fields?: Array<{ id?: string; key?: string; label?: string; type?: string; required?: boolean; options?: string[] }> } | null;
  formSubmissions?: any[] | null;
  checklistItems?: Array<{ id: string; label: string; completed?: boolean; completedBy?: string; completedAt?: string }>; 
  recurrencePattern?: RecurrencePattern | null;
  recurrenceInterval?: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  tenantId: string;
  userId: string;
  onChanged?: () => void;
};

export function TaskModal({ open, onClose, task, tenantId, userId, onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Task | null>(task);
  const [authHeaders, setAuthHeaders] = useState<Record<string,string>>({ "x-tenant-id": tenantId, "x-user-id": userId });
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submittingForm, setSubmittingForm] = useState(false);
  const [checklistBusy, setChecklistBusy] = useState<string | null>(null);
  const [scheduleEdit, setScheduleEdit] = useState<{ pattern: RecurrencePattern; interval: number }>({ pattern: "DAILY", interval: 1 });
  const isNewTask = !task;

  useEffect(() => {
    if (!task) {
      // Initialize new task form
      setForm({
        id: "",
        title: "",
        description: "",
        status: "OPEN",
        priority: "MEDIUM",
         taskType: "MANUAL",
        relatedType: "OTHER",
        relatedId: null,
        dueAt: null,
      });
    } else {
      setForm(task);
      // Seed schedule edit panel
      if (task.recurrencePattern) {
        setScheduleEdit({ pattern: task.recurrencePattern, interval: task.recurrenceInterval || 1 });
      }
      // Seed form data with empty defaults
      if (task.taskType === "FORM" && task.formSchema?.fields) {
        const initial: Record<string, any> = {};
        task.formSchema.fields.forEach(f => {
          const key = f.key || f.id || f.label || "field";
          initial[key] = "";
        });
        setFormData(initial);
      }
    }
  }, [task, open]);
  function toast(msg: string) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className =
      "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-[1000]";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  const dueISO = useMemo(() => {
    if (!form?.dueAt) return "";
    const d = new Date(form.dueAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [form?.dueAt]);

  const dueLabel = useMemo(() => {
    if (!form?.dueAt) return "No due date";
    try {
      return new Date(form.dueAt).toLocaleString();
    } catch {
      return "No due date";
    }
  }, [form?.dueAt]);

  if (!open || !form) return null;

  async function createTask() {
    if (!form || !form.title.trim()) {
      toast("Please enter a task title");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || "",
        status: form.status,
        priority: form.priority,
        taskType: form.taskType || "MANUAL",
        relatedType: form.relatedType,
        relatedId: form.relatedId || undefined,
        dueAt: form.dueAt || undefined,
      };
      await apiFetch("/tasks", {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
        json: payload,
      });
      toast("✅ Task created!");
      onChanged?.();
      onClose();
    } catch (e: any) {
      toast("Failed to create task: " + (e.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function update(fields: Partial<Task>) {
    if (!form || isNewTask) return;
    setSaving(true);
    try {
      const payload: Partial<Task> = {
        ...fields,
        dueAt: fields.dueAt === "" ? null : fields.dueAt,
      };
      await apiFetch(`/tasks/${form.id}`, {
        method: "PATCH",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
        json: payload,
      });
      setForm((prev) => (prev ? { ...prev, ...payload } : prev));
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function startTask() {
    if (!form) return;
    setSaving(true);
    try {
      await apiFetch(`/tasks/${form.id}/start`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
      });
      setForm((prev) => (prev ? { ...prev, status: "IN_PROGRESS" } : prev));
      onChanged?.();
      toast("Getting this moving—nice.");
    } finally {
      setSaving(false);
    }
  }

  async function completeTask() {
    if (!form) return;
    setSaving(true);
    try {
      await apiFetch(`/tasks/${form.id}/complete`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
      });
      setForm((prev) =>
        prev ? { ...prev, status: "DONE", completedAt: new Date().toISOString() } : prev
      );
      onChanged?.();
      confetti();
      toast("✅ Done! That’s progress you can feel.");
    } finally {
      setSaving(false);
    }
  }

  async function submitFormTask() {
    if (!form || form.taskType !== "FORM" || !form.formSchema?.fields) return;
    setSubmittingForm(true);
    try {
      await apiFetch(`/tasks/${form.id}/form-submission`, {
        method: "POST",
        headers: authHeaders,
        json: formData,
      });
      toast("Form submitted ✔");
      onChanged?.();
      onClose();
    } catch (e: any) {
      toast("Failed to submit form: " + (e.message || "error"));
    } finally {
      setSubmittingForm(false);
    }
  }

  async function toggleChecklist(itemId: string, completed: boolean) {
    if (!form || form.taskType !== "CHECKLIST") return;
    setChecklistBusy(itemId);
    try {
      await apiFetch(`/tasks/${form.id}/checklist`, {
        method: "PATCH",
        headers: authHeaders,
        json: { itemId, completed },
      });
      // Optimistic update
      setForm(prev => {
        if (!prev?.checklistItems) return prev;
        return {
          ...prev,
          checklistItems: prev.checklistItems.map(i => i.id === itemId ? { ...i, completed } : i),
        };
      });
      onChanged?.();
    } catch (e: any) {
      toast("Checklist update failed");
    } finally {
      setChecklistBusy(null);
    }
  }

  async function convertToScheduled() {
    if (!form) return;
    try {
      await update({ taskType: "SCHEDULED" as any, recurrencePattern: scheduleEdit.pattern as any, recurrenceInterval: scheduleEdit.interval });
      toast("Task scheduled ✅");
    } catch (e: any) {
      toast("Failed to schedule task");
    }
  }

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const count = 24;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.textContent = "✨";
      s.style.position = "fixed";
      s.style.left = Math.random() * 100 + "vw";
      s.style.top = "-2vh";
      s.style.fontSize = "18px";
      s.style.transition = "transform 1.4s ease, opacity 1.4s ease";
      s.style.opacity = "1";
      document.body.appendChild(s);
      const x = (Math.random() - 0.5) * 200;
      const y = 120 + Math.random() * 200;
      requestAnimationFrame(() => {
        s.style.transform = `translate(${x}px, ${y}vh) rotate(${(Math.random() - 0.5) * 180}deg)`;
        s.style.opacity = "0";
      });
      setTimeout(() => s.remove(), 1500);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center bg-gradient-to-br from-sky-500/40 via-indigo-900/40 to-rose-400/40 backdrop-blur-sm overflow-y-auto px-4 py-4 md:py-12"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full md:max-w-3xl my-auto md:my-0 overflow-hidden md:rounded-3xl rounded-2xl border border-white/30 md:border-white/40 bg-white md:bg-white/90 p-4 md:p-6 shadow-[0_35px_80px_-35px_rgba(30,64,175,0.45)] max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-6rem)]">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-20 h-56 w-56 rounded-full bg-rose-200/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-300/40 blur-3xl" />

        <div className="relative space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)] md:max-h-[calc(100vh-8rem)]">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 space-y-2">
              <input
                className="w-full bg-transparent text-2xl font-semibold tracking-tight text-slate-800 outline-none placeholder:text-slate-400"
                value={form.title}
                onChange={(e) => setForm(prev => prev ? {...prev, title: e.target.value} : prev)}
                onBlur={(e) => !isNewTask && update({ title: e.currentTarget.value })}
                placeholder="Task title"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {!isNewTask && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      <span aria-hidden="true">🔗</span>
                      {form.relatedType.toLowerCase()}
                    </span>
                    <span>{form.relatedId || "No related record"}</span>
                    {form.assignees?.length ? (
                      <span>
                        · {form.assignees.length === 1 ? "Assigned to 1 person" : `Assigned to ${form.assignees.length} people`}
                      </span>
                    ) : null}
                  </>
                )}
                {isNewTask && <span className="text-slate-400">Create a new task</span>}
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Close
            </Button>
          </header>

         <div className="grid gap-4 md:grid-cols-3">
           <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                 <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task Type</div>
                 <select
                   value={form.taskType || "MANUAL"}
                   onChange={(e) => {
                     const newType = e.target.value as Task["taskType"];
                     setForm(prev => prev ? {...prev, taskType: newType} : prev);
                     !isNewTask && update({ taskType: newType });
                   }}
                   className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                 >
                   <option value="MANUAL">Manual Task</option>
                   <option value="COMMUNICATION">Communication</option>
                   <option value="FOLLOW_UP">Follow-up</option>
                   <option value="SCHEDULED">Scheduled</option>
                   <option value="FORM">Form</option>
                   <option value="CHECKLIST">Checklist</option>
                 </select>
             </div>
       
             <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
              <select
                value={form.status}
                onChange={(e) => {
                  const newStatus = e.target.value as Task["status"];
                  setForm(prev => prev ? {...prev, status: newStatus} : prev);
                  !isNewTask && update({ status: newStatus });
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              >
                {["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ").toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</div>
              <select
                value={form.priority}
                onChange={(e) => {
                  const newPriority = e.target.value as Task["priority"];
                  setForm(prev => prev ? {...prev, priority: newPriority} : prev);
                  !isNewTask && update({ priority: newPriority });
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              >
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
           <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm md:col-span-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</div>
              <input
                type="datetime-local"
                value={dueISO}
                onChange={(e) => {
                  setForm(prev => prev ? {...prev, dueAt: e.target.value || null} : prev);
                  !isNewTask && update({ dueAt: e.target.value });
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              />
            </div>

           <div className="md:col-span-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
                <textarea
                  value={form.description || ""}
                  onChange={(e) => setForm(prev => prev ? {...prev, description: e.target.value} : prev)}
                  onBlur={(e) => !isNewTask && update({ description: e.currentTarget.value })}
                  placeholder="Add context, next steps, or links"
                  className="mt-2 min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>
          </div>

          {/* FOLLOW-UP PANEL (AI email) */}
          {form.taskType === "FOLLOW_UP" && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
              {form.meta?.aiDraft ? (
                <FollowUpTaskPanel
                  task={form as any}
                  authHeaders={authHeaders}
                  onEmailSent={() => { onChanged?.(); }}
                  onTaskCompleted={() => { onChanged?.(); setForm(prev => prev ? { ...prev, status: "DONE" } : prev); }}
                />
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-indigo-900">AI Follow-up Task</div>
                  <p className="text-sm text-slate-600">
                    Follow-up tasks with AI drafts are created automatically from lead actions. 
                    To generate an AI follow-up, use the follow-up features in the lead modal.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* FORM TASK UI */}
          {form.taskType === "FORM" && (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Form Fields</div>
              {!form.formSchema?.fields?.length ? (
                <div className="text-sm text-slate-600 py-3">
                  No form schema configured. Form tasks are created automatically with questionnaires and other workflows.
                </div>
              ) : (
                <>
                <div className="space-y-3">
                {form.formSchema.fields.map((f, idx) => {
                  const key = f.key || f.id || f.label || `field_${idx}`;
                  const label = f.label || key;
                  const type = (f.type || "text").toLowerCase();
                  if (type === "select" && f.options?.length) {
                    return (
                      <label key={key} className="block text-sm">
                        <span className="font-medium text-slate-700">{label}</span>
                        <select
                          value={formData[key] || ""}
                          onChange={e => setFormData(d => ({ ...d, [key]: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Select…</option>
                          {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </label>
                    );
                  }
                  if (type === "textarea") {
                    return (
                      <label key={key} className="block text-sm">
                        <span className="font-medium text-slate-700">{label}</span>
                        <textarea
                          value={formData[key] || ""}
                          onChange={e => setFormData(d => ({ ...d, [key]: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm min-h-[100px]"
                        />
                      </label>
                    );
                  }
                  return (
                    <label key={key} className="block text-sm">
                      <span className="font-medium text-slate-700">{label}</span>
                      <input
                        value={formData[key] || ""}
                        onChange={e => setFormData(d => ({ ...d, [key]: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  );
                })}
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={submitFormTask}
                    disabled={submittingForm}
                    variant="default"
                  >
                    {submittingForm ? "Submitting…" : "Submit Form"}
                  </Button>
                </div>
                </>
              )}
            </div>
          )}

          {/* CHECKLIST TASK UI */}
          {form.taskType === "CHECKLIST" && (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</div>
              {!form.checklistItems?.length ? (
                <div className="text-sm text-slate-600 py-3">
                  No checklist items configured. Checklist tasks are created automatically with workshop processes and other workflows.
                </div>
              ) : (
                <>
                {form.checklistItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklist(item.id, !item.completed)}
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm mb-1 transition ${item.completed ? "bg-green-50 border-green-300 text-green-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="truncate text-left">{item.label}</span>
                  <span className={`ml-3 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold ${item.completed ? "bg-green-500 text-white border-green-600" : "bg-slate-100 text-slate-600 border-slate-300"}`}>{item.completed ? "✓" : ""}</span>
                </button>
              ))}
              <div className="text-xs text-slate-500 mt-2">
                {form.checklistItems.filter(i => i.completed).length}/{form.checklistItems.length} completed
              </div>
              </>
              )}
            </div>
          )}

          {/* SCHEDULING PANEL */}
          {form.taskType !== "SCHEDULED" && !isNewTask && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Schedule this task</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Pattern
                  <select
                    value={scheduleEdit.pattern}
                    onChange={e => setScheduleEdit(p => ({ ...p, pattern: e.target.value as RecurrencePattern }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Interval
                  <input
                    type="number"
                    min={1}
                    value={scheduleEdit.interval}
                    onChange={e => setScheduleEdit(p => ({ ...p, interval: Math.max(1, Number(e.target.value)||1) }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <Button onClick={convertToScheduled} variant="default">Convert to Scheduled</Button>
            </div>
          )}

          {form.taskType === "SCHEDULED" && (
            <div className="rounded-2xl border border-green-200 bg-green-50/70 p-4 text-sm text-green-800">
              Recurs: {form.recurrenceInterval || 1} × {form.recurrencePattern || 'DAILY'}
            </div>
          )}

          <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
            <div className="text-xs text-slate-500">
              {!isNewTask && (
                <>
                  <div className="font-semibold text-slate-700">{dueLabel}</div>
                  {form.completedAt ? <div>Completed {new Date(form.completedAt).toLocaleString()}</div> : null}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isNewTask ? (
                <Button
                  onClick={createTask}
                  disabled={saving || !form.title.trim()}
                  variant="default"
                >
                  Create Task
                </Button>
              ) : (
                <>
                  <Button
                    onClick={startTask}
                    disabled={saving || form.status === "IN_PROGRESS" || form.status === "DONE"}
                    variant="outline"
                  >
                    Start task
                  </Button>
                  <Button
                    onClick={completeTask}
                    disabled={saving || form.status === "DONE"}
                    variant="default"
                  >
                    Mark complete
                  </Button>
                </>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
