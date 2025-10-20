"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { emit, on } from "@/lib/events";

type Task = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedType?: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
};

export function TasksDrawer({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const ids = getAuthIdsFromJwt();
  const tId = tenantId || ids?.tenantId || "";
  const uId = userId || ids?.userId || "";

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"today" | "overdue" | "all">("today");
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const todayItems = items; // since we load by scope on the server
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
      if (scope !== "all") qs.set("due", scope); // today | overdue
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

  // When lead UI finishes its action, it tells us, and we complete the task (if provided)
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
    // if already done today, unchecking is a “reopen” affordance (optional)
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
    } catch (e) {}
  }

  function openLinked(task: Task) {
    if (task.relatedType === "LEAD" && task.relatedId) {
      // tell the app to open the Lead quick view/modal
      emit("open-lead", { leadId: task.relatedId });
      // Optional: also pre-mark as started to avoid duplicate effort
      apiFetch(`/tasks/${task.id}/start`, {
        method: "POST",
        headers: { "x-tenant-id": tId, "x-user-id": uId },
      }).catch(() => {});
    }
  }

  const ring = (
    <ProgressRing value={progress.pct} label={`${progress.pct}%`} />
  );

  return (
    <>
      {/* tiny launcher button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-indigo-600 text-white px-4 py-3 shadow-lg hover:bg-indigo-700"
        aria-label="Open My Tasks"
      >
        My Tasks
      </button>

      {!open ? null : (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <aside className="absolute right-0 top-0 h-full w-[360px] md:w-[420px] bg-white shadow-2xl p-4 flex flex-col">
            {/* header */}
            <div className="flex items-center gap-3">
              {ring}
              <div className="flex-1">
                <div className="font-semibold">My Tasks</div>
                <div className="text-xs text-gray-500">
                  {progress.done} of {progress.total} today
                </div>
              </div>
              <button className="text-sm text-gray-500" onClick={() => load()}>
                Refresh
              </button>
              <button className="text-sm" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {/* scope */}
            <div className="mt-3 flex gap-2">
              <Seg v={scope} on="today" set={setScope} label="Today" />
              <Seg v={scope} on="overdue" set={setScope} label="Overdue" />
              <Seg v={scope} on="all" set={setScope} label="All" />
              <div className="ml-auto text-xs text-gray-500">
                Owner tip: A quick assign clears most blockers.
              </div>
            </div>

            {/* list */}
            <div className="mt-4 space-y-2 overflow-auto">
              {loading && <div className="text-sm text-gray-500">Loading…</div>}
              {!loading && items.length === 0 && (
                <div className="text-sm text-gray-500">No tasks here yet.</div>
              )}

              {items.map((t) => {
                const isDoneToday =
                  t.status === "DONE" &&
                  t.completedAt &&
                  new Date(t.completedAt).toDateString() ===
                    new Date().toDateString();

                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-3 hover:bg-gray-50 transition
                    ${isDoneToday ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={t.status === "DONE"}
                        onChange={() => toggleComplete(t)}
                        aria-label={`Complete ${t.title}`}
                        className="mt-1"
                      />

                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => openLinked(t)}
                          className={`text-left font-medium truncate ${
                            t.relatedType === "LEAD"
                              ? "text-blue-700 hover:underline"
                              : "text-gray-900"
                          }`}
                          title={t.title}
                        >
                          {isDoneToday ? "✓ " : ""}
                          {t.title}
                        </button>

                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                            {t.relatedType || "OTHER"}
                          </span>
                          <span>
                            {t.dueAt
                              ? new Date(t.dueAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "No due"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* end-of-day celebration */}
            {progress.total > 0 && progress.done === progress.total && after4pm() && (
              <div className="mt-auto">
                <DayClearOverlay />
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

/* ---------- UI bits ---------- */

function Seg({
  v,
  on,
  set,
  label,
}: {
  v: "today" | "overdue" | "all";
  on: "today" | "overdue" | "all";
  set: (v: "today" | "overdue" | "all") => void;
  label: string;
}) {
  const active = v === on;
  return (
    <button
      onClick={() => set(on)}
      className={`px-3 py-1.5 rounded-full border ${
        active ? "bg-gray-900 text-white" : ""
      }`}
    >
      {label}
    </button>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} stroke="#e5e7eb" strokeWidth="6" fill="none" />
      <circle
        cx="24"
        cy="24"
        r={r}
        stroke="#111827"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="26" textAnchor="middle" fontSize="12" fill="#111827">
        {label}
      </text>
    </svg>
  );
}

function after4pm() {
  const d = new Date();
  return d.getHours() >= 16;
}

function DayClearOverlay() {
  return (
    <div className="rounded-2xl border bg-white p-4 text-center">
      <div className="text-2xl">🎉</div>
      <div className="mt-2 font-medium">✨ Your board is clear. Breathe.</div>
      <div className="text-sm text-gray-600">You finished today’s focus.</div>
      <button
        className="mt-3 px-3 py-1.5 rounded-lg border"
        onClick={() => {
          navigator.clipboard?.writeText("I cleared my tasks today. 🎉");
        }}
      >
        Share
      </button>
    </div>
  );
}

/* ---------- micro interactions ---------- */
function toast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.className =
    "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-[1000]";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
function confetti() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    s.textContent = "✨";
    s.style.position = "fixed";
    s.style.left = Math.random() * 100 + "vw";
    s.style.top = "-2vh";
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