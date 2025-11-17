// web/src/components/tasks/OwnerDashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { NewTaskModal } from "@/components/tasks/NewTaskModal";

type Task = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  relatedType?: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  dueAt?: string | null;
};

type Summary = { overdue: number; dueToday: number; unassigned: number; blocked: number };

const subtle = "text-sm text-slate-500";
const chip = "px-4 py-2 rounded-full border border-slate-200/80 bg-white/70 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white";
const primary = "rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400 text-white px-5 py-2.5 text-sm font-semibold shadow-lg hover:from-sky-500 hover:via-indigo-500 hover:to-rose-500 focus:outline-none focus:ring-2 focus:ring-sky-200";
const rowBtn = "px-4 py-2 rounded-full border border-slate-200/80 bg-white/80 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white";

export default function OwnerDashboard() {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";
  const userId = ids?.userId || "";

  const [scope, setScope] = useState<"today" | "overdue" | "unassigned">("today");
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"" | Task["relatedType"]>("");
  const [q, setQ] = useState("");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter(k => selected[k]), [selected]);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const s = await apiFetch<Summary>("/tasks/summary/owner", { headers: { "x-tenant-id": tenantId } });
      setSummary(s);

      const qs = new URLSearchParams({ status: "OPEN" });
      if (scope === "unassigned") {
        qs.set("unassigned", "true");
      } else {
        qs.set("due", scope); // "today" or "overdue"
      }
      if (typeFilter) qs.set("relatedType", typeFilter);
      if (q.trim()) qs.set("search", q.trim());

      const data = await apiFetch<{ items: Task[]; total: number }>(`/tasks?${qs}`, {
        headers: { "x-tenant-id": tenantId },
      });
      setItems(data.items);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [scope, typeFilter]); // eslint-disable-line

  /* ---------- Bulk actions (footer shows only when selected) ---------- */
  async function bulkAssignToMe() {
    const headers = { "x-tenant-id": tenantId, "x-user-id": userId, "Content-Type": "application/json" };
    for (const id of selectedIds) {
      await apiFetch(`/tasks/${id}/assignees`, { method: "POST", headers, json: { add: [{ userId, role: "OWNER" }] } });
    }
    await load();
  }
  async function bulkSetDue(days: number) {
    const headers = { "x-tenant-id": tenantId, "x-user-id": userId, "Content-Type": "application/json" };
    const dueAt = new Date(Date.now() + days * 86400000).toISOString();
    for (const id of selectedIds) await apiFetch(`/tasks/${id}`, { method: "PATCH", headers, json: { dueAt } });
    await load();
  }
  async function bulkStart() {
    const headers = { "x-tenant-id": tenantId, "x-user-id": userId };
    for (const id of selectedIds) await apiFetch(`/tasks/${id}/start`, { method: "POST", headers });
    toast("Getting this moving—nice.");
    await load();
  }
  async function bulkComplete() {
    const headers = { "x-tenant-id": tenantId, "x-user-id": userId };
    for (const id of selectedIds) await apiFetch(`/tasks/${id}/complete`, { method: "POST", headers });
    confetti(); toast("✅ Done! That’s progress you can feel.");
    await load();
  }

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    if (checked) items.forEach(t => { next[t.id] = true; });
    setSelected(next);
  }

  function toast(msg: string) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-[1000]";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }
  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < 18; i++) {
      const s = document.createElement("span");
      s.textContent = "✨";
      s.style.position = "fixed"; s.style.left = Math.random()*100+"vw"; s.style.top = "-2vh";
      s.style.transition = "transform 1.1s ease, opacity 1.1s ease"; s.style.opacity = "1";
      document.body.appendChild(s);
      const x = (Math.random()-0.5)*200, y = 120 + Math.random()*180;
      requestAnimationFrame(()=>{ s.style.transform = `translate(${x}px, ${y}vh) rotate(${(Math.random()-0.5)*160}deg)`; s.style.opacity="0"; });
      setTimeout(()=>s.remove(), 1200);
    }
  }

  function renderStatusPill(status: Task["status"]) {
    const base = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide";
    const tone: Record<Task["status"], string> = {
      OPEN: "bg-amber-100 text-amber-700",
      IN_PROGRESS: "bg-sky-100 text-sky-700",
      BLOCKED: "bg-rose-100 text-rose-700",
      DONE: "bg-emerald-100 text-emerald-700",
      CANCELLED: "bg-slate-200 text-slate-600",
    };
    const icon: Record<Task["status"], string> = {
      OPEN: "🪄",
      IN_PROGRESS: "🚀",
      BLOCKED: "🧊",
      DONE: "🎉",
      CANCELLED: "💤",
    };
    return (
      <span className={`${base} ${tone[status]}`}>
        <span aria-hidden="true">{icon[status]}</span>
        {status.replace(/_/g, " ")}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="relative overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-r from-sky-400/20 via-indigo-500/15 to-rose-400/20 px-6 py-6 shadow-[0_18px_45px_-25px_rgba(79,70,229,0.4)] backdrop-blur">
        <div aria-hidden="true" className="pointer-events-none absolute -top-10 -left-6 h-40 w-40 rounded-full bg-white/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-8 h-48 w-48 rounded-full bg-rose-200/50 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span aria-hidden="true">🌟</span>
              Owner spotlight
            </span>
            <h1 className="text-3xl font-semibold text-slate-800">Guide every task like it’s the main event</h1>
            <p className={`${subtle} max-w-xl text-slate-600`}>Track overdue adventures, rally today’s priorities, and sprinkle assignments where they belong.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/tasks/print" target="_blank" className={rowBtn}>
              Print A4
            </Link>
            <Link href="/tasks/print?auto=1" target="_blank" className={rowBtn}>
              Quick print
            </Link>
            <button className={primary} onClick={()=>setShowNew(true)}>
              <span aria-hidden="true">➕</span> New task
            </button>
          </div>
        </div>
      </header>

      {/* KPIs (compact) */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Overdue" value={summary.overdue} tone="from-rose-400 via-rose-300 to-amber-300" />
          <Kpi label="Due today" value={summary.dueToday} tone="from-sky-400 via-sky-300 to-indigo-300" />
          <Kpi label="Unassigned" value={summary.unassigned} tone="from-emerald-400 via-teal-300 to-sky-300" />
          <Kpi label="Blocked" value={summary.blocked} tone="from-indigo-400 via-violet-300 to-rose-300" />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur">
        <div className="flex gap-1 rounded-full border border-slate-200/70 bg-slate-50/70 p-1 shadow-inner">
          <button
            className={`${chip} ${scope==="today" ? "bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400 text-white" : ""}`}
            onClick={()=>setScope("today")}
          >Today</button>
          <button
            className={`${chip} ${scope==="overdue" ? "bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300 text-white" : ""}`}
            onClick={()=>setScope("overdue")}
          >Overdue</button>
          <button
            className={`${chip} ${scope==="unassigned" ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-300 text-white" : ""}`}
            onClick={()=>setScope("unassigned")}
          >Unassigned</button>
        </div>

        <button className={rowBtn} onClick={()=>setShowFilters(v=>!v)} aria-expanded={showFilters}>
          {showFilters ? "Hide filters" : "Filters"}
        </button>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 shadow-sm">
            <select
              className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e)=>setTypeFilter(e.target.value as any)}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              <option value="QUOTE">Quote</option>
              <option value="LEAD">Lead</option>
              <option value="EMAIL">Email</option>
              <option value="QUESTIONNAIRE">Questionnaire</option>
              <option value="PROJECT">Project</option>
              <option value="WORKSHOP">Workshop</option>
              <option value="OTHER">Other</option>
            </select>

            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              onKeyDown={(e)=>{ if (e.key==="Enter") load(); }}
              placeholder="Search title…"
              className="min-w-[220px] rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            />
            <button className={rowBtn} onClick={load}>Apply</button>
          </div>
        )}
      </div>

      {/* Table (minimal) */}
      <div className="overflow-auto rounded-3xl border border-slate-200/80 bg-white/85 shadow-sm backdrop-blur">
        <table className="min-w-full text-sm text-slate-700">
          <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  onChange={(e)=>toggleAll(!!e.currentTarget.checked)}
                  checked={items.length>0 && Object.keys(selected).every(id => selected[id])}
                  className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                />
              </th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Due</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Nothing here yet—everything’s on track!
                </td>
              </tr>
            )}
            {items.map(t => (
              <tr key={t.id} className="border-t border-slate-200/70 bg-white/70 transition hover:bg-sky-50/70">
                <td className="p-3 align-top">
                  <input
                    type="checkbox"
                    checked={!!selected[t.id]}
                    onChange={(e)=>{
                      const checked = (e.target as HTMLInputElement).checked;
                      setSelected(s => ({ ...s, [t.id]: checked }));
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                  />
                </td>
                <td className="p-3 align-top">
                  <div className="font-semibold text-slate-800">{t.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{t.dueAt ? new Date(t.dueAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "No due date"}</div>
                </td>
                <td className="p-3 align-top">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    <span aria-hidden="true">🔗</span>
                    {(t.relatedType ?? "—").toLowerCase()}
                  </span>
                </td>
                <td className="p-3 align-top text-sm text-slate-600">
                  {t.dueAt ? new Date(t.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                </td>
                <td className="p-3 align-top">{renderStatusPill(t.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calm tip to differentiate spaces */}
      <p className={`${subtle} text-center md:text-left`}>
        ✨ Tip: <strong>My Tasks</strong> (drawer) is your personal quest log. This stage is for the whole troupe—switch the scope,
        add filters, and unleash bulk magic when rows are selected.
      </p>

      {/* New Task */}
      {showNew && (
        <NewTaskModal
          tenantId={tenantId}
          userId={userId}
          onClose={() => { setShowNew(false); load(); }}
        />
      )}

      {/* Sticky bulk footer */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-auto z-[999]">
          <div className="mx-auto md:ml-auto md:mr-28 w-full md:w-auto rounded-3xl border border-white/40 bg-gradient-to-r from-sky-500/80 via-indigo-500/80 to-rose-500/80 p-4 shadow-[0_18px_45px_-25px_rgba(30,64,175,0.6)] backdrop-blur flex flex-wrap items-center gap-2 text-white">
            <span className="text-sm font-semibold">{selectedIds.length} selected</span>
            <button className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white" onClick={bulkAssignToMe}>Assign to me</button>
            <button className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white" onClick={()=>bulkSetDue(1)}>Due +1 day</button>
            <button className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white" onClick={()=>bulkSetDue(3)}>Due +3 days</button>
            <button className="rounded-full bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400" onClick={bulkStart}>Start</button>
            <button className="rounded-full bg-amber-300/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-amber-300" onClick={bulkComplete}>Complete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/85 p-4 text-center shadow-sm backdrop-blur">
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone} opacity-30`} />
      <div className="relative space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-3xl font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  );
}