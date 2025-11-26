// web/src/components/tasks/TaskModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedType: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string | null;
  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  assignees?: { userId: string; role: "OWNER" | "FOLLOWER" }[];
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
        relatedType: "OTHER",
        relatedId: null,
        dueAt: null,
      });
    } else {
      setForm(task);
    }
  }, [task, open]);

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

  function toast(msg: string) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className =
      "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-[1000]";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
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
      className="fixed inset-0 z-[999] flex items-center justify-center bg-gradient-to-br from-sky-500/20 via-indigo-900/25 to-rose-400/20 px-4 py-12 backdrop-blur"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/40 bg-white/90 p-6 sm:p-8 shadow-[0_35px_80px_-35px_rgba(30,64,175,0.55)]">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-20 h-56 w-56 rounded-full bg-rose-200/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-300/40 blur-3xl" />

        <div className="relative space-y-6">
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

          <div className="grid gap-4 md:grid-cols-2">
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

            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm md:col-span-2">
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

            <div className="md:col-span-2">
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

          <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
