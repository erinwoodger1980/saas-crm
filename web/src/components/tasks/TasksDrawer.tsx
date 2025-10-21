"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { emit, on } from "@/lib/events";
import { TaskModal } from "@/components/tasks/TaskModal";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";

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
  startedAt?: string | null;
  assignees?: { userId: string; role?: string }[];
};

export function TasksDrawer({ tenantId, userId }: { tenantId: string; userId: string }) {
  const ids = getAuthIdsFromJwt();
  const tId = tenantId || ids?.tenantId || "";
  const uId = userId || ids?.userId || "";

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"today" | "overdue" | "all">("today");
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const todayItems = items;
  const doneToday = useMemo(
    () =>
      todayItems.filter(
        (t) =>
          t.status === "DONE" &&
          t.completedAt &&
          new Date(t.completedAt).toDateString() === new Date().toDateString()
      ),
    [todayItems]
  );
  const progress = useMemo(() => {
    const total = todayItems.length || 0;
    const done = doneToday.length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [todayItems, doneToday]);

  async function load() {
    if (!tId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("mine", "true");
      if (scope !== "all") qs.set("due", scope);
      const data = await apiFetch<{ items: Task[]; total: number }>(`/tasks?${qs}`, {
        headers: { "x-tenant-id": tId, "x-user-id": uId },
      });
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, scope]); // eslint-disable-line

  useEffect(() => {
    return on("lead-action-completed", async ({ taskId }) => {
      if (!taskId) return;
      try {
        await apiFetch(`/tasks/${taskId}/complete`, {
          method: "POST",
          headers: { "x-tenant-id": tId, "x-user-id": uId },
        });
        load();
        toast("✅ Done! That’s progress you can feel.");
      } catch {}
    });
  }, [tId, uId]); // eslint-disable-line

  async function toggleComplete(task: Task) {
    const isDone = task.status === "DONE";
    try {
      if (!isDone) {
        await apiFetch(`/tasks/${task.id}/complete`, {
          method: "POST",
          headers: { "x-tenant-id": tId, "x-user-id": uId },
        });
        confetti();
        toast("✅ Done! That’s progress you can feel.");
      } else {
        await apiFetch(`/tasks/${task.id}/reopen`, {
          method: "POST",
          headers: { "x-tenant-id": tId, "x-user-id": uId },
        });
        toast("Reopened.");
      }
      load();
    } catch {}
  }

  function openLinked(task: Task) {
    if (task.relatedType === "LEAD" && task.relatedId) {
      emit("open-lead", { leadId: task.relatedId });
      apiFetch(`/tasks/${task.id}/start`, {
        method: "POST",
        headers: { "x-tenant-id": tId, "x-user-id": uId },
      }).catch(() => {});
    }
  }

  function formatDue(ts?: string | null) {
    if (!ts) return "No due date";
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "No due date";
    }
  }

  const ring = <ProgressRing value={progress.pct} label={`${progress.pct}%`} />;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700"
        aria-label="Open My Tasks"
      >
        My Tasks
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <aside className="relative ml-auto flex h-full w-full max-w-[420px] flex-col overflow-hidden rounded-l-3xl border-l border-white/30 bg-gradient-to-br from-white via-white/95 to-sky-50 shadow-[0_40px_70px_-35px_rgba(30,64,175,0.55)]">
            <div aria-hidden="true" className="pointer-events-none absolute -top-24 -left-32 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-28 h-80 w-80 rounded-full bg-rose-200/45 blur-3xl" />

            <div className="relative flex h-full flex-col gap-5 p-5">
              <header className="flex items-start gap-4">
                {ring}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">My Tasks</div>
                  <div className="text-xs text-slate-500">
                    {progress.done} of {progress.total} today
                  </div>
                </div>
                <button
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
                  onClick={() => load()}
                >
                  Refresh
                </button>
                <button
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </header>

              <div className="flex items-center gap-2 text-xs">
                <Seg v={scope} on="today" set={setScope} label="Today" />
                <Seg v={scope} on="overdue" set={setScope} label="Overdue" />
                <Seg v={scope} on="all" set={setScope} label="All" />
                <div className="ml-auto">
                  <button
                    onClick={() => setShowNew(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:bg-white"
                  >
                    <span aria-hidden="true">➕</span>
                    Add task
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-auto pr-1">
                {loading && <div className="text-sm text-slate-500">Loading…</div>}
                {!loading && items.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-4 text-sm text-slate-500">
                    No tasks in this view yet.
                  </div>
                )}

                {items.map((t) => {
                  const isDoneToday =
                    t.status === "DONE" &&
                    t.completedAt &&
                    new Date(t.completedAt).toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={t.id}
                      className={`rounded-2xl border border-slate-200/70 bg-white/85 p-4 shadow-sm backdrop-blur transition hover:border-sky-200 ${
                        isDoneToday ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={t.status === "DONE"}
                          onChange={() => toggleComplete(t)}
                          aria-label={`Complete ${t.title}`}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              onClick={() => setActiveTask(t)}
                              className="text-left text-sm font-semibold text-slate-800 transition hover:text-sky-600"
                              title={t.title}
                            >
                              {t.title}
                            </button>
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-600">
                              {t.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden="true">⏰</span>
                              {formatDue(t.dueAt)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-rose-600">
                              <span aria-hidden="true">🎯</span>
                              {t.priority.toLowerCase()}
                            </span>
                            {t.relatedType && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-600">
                                <span aria-hidden="true">🔗</span>
                                {t.relatedType.toLowerCase()}
                              </span>
                            )}
                          </div>
                          {t.description ? (
                            <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
                          ) : null}
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <button
                              onClick={() => openLinked(t)}
                              className="inline-flex items-center gap-1 text-sky-600 transition hover:text-sky-700"
                            >
                              Go to record →
                            </button>
                            <button
                              onClick={() => setActiveTask(t)}
                              className="inline-flex items-center gap-1 text-slate-500 transition hover:text-slate-700"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-slate-500">
                ✨ Tip: complete tasks from here or jump into a lead with one click.
              </div>
            </div>
          </aside>
        </div>
      )}

      {showNew && (
        <NewTaskModal
          tenantId={tId}
          userId={uId}
          onClose={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      {activeTask && (
        <TaskModal
          open={!!activeTask}
          onClose={() => setActiveTask(null)}
          task={activeTask}
          tenantId={tId}
          userId={uId}
          onChanged={() => {
            setActiveTask(null);
            load();
          }}
        />
      )}
    </>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg viewBox="0 0 60 60" className="h-14 w-14">
      <circle cx="30" cy="30" r={radius} className="stroke-slate-200" strokeWidth="6" fill="transparent" />
      <circle
        cx="30"
        cy="30"
        r={radius}
        className="stroke-[url(#grad)]"
        strokeWidth="6"
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#fb7185" />
        </linearGradient>
      </defs>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="text-[10px] font-semibold text-slate-700">
        {label}
      </text>
    </svg>
  );
}

function Seg({ v, on, set, label }: { v: string; on: string; set: (v: any) => void; label: string }) {
  const active = v === on;
  return (
    <button
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 text-white shadow"
          : "border border-slate-200 bg-white/70 text-slate-600 hover:bg-white"
      }`}
      onClick={() => set(on)}
    >
      {label}
    </button>
  );
}

function toast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-[1000]";
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
    s.style.transition = "transform 1.2s ease, opacity 1.2s ease";
    s.style.opacity = "1";
    document.body.appendChild(s);
    const x = (Math.random() - 0.5) * 200;
    const y = 120 + Math.random() * 200;
    requestAnimationFrame(() => {
      s.style.transform = `translate(${x}px, ${y}vh) rotate(${(Math.random() - 0.5) * 160}deg)`;
      s.style.opacity = "0";
    });
    setTimeout(() => s.remove(), 1300);
  }
}
