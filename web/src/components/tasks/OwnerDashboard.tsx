// web/src/components/tasks/OwnerDashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

const subtle = "text-sm text-gray-600";
const chip = "px-3 py-1.5 rounded-full border";
const primary = "rounded-lg bg-blue-600 text-white px-4 py-2 shadow hover:bg-blue-700";
const rowBtn = "px-3 py-1.5 rounded-lg border";

export default function OwnerDashboard() {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";
  const userId = ids?.userId || "";

  const [scope, setScope] = useState<"today" | "overdue">("today");
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
      qs.set("due", scope); // "today" or "overdue"
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Owner Dashboard</h1>
          <p className={subtle}>A calm overview for overdue and today — bulk actions only when you need them.</p>
        </div>
        <button className={primary} onClick={()=>setShowNew(true)}>+ New Task</button>
      </header>

      {/* KPIs (compact) */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Overdue" value={summary.overdue} />
          <Kpi label="Due today" value={summary.dueToday} />
          <Kpi label="Unassigned" value={summary.unassigned} />
          <Kpi label="Blocked" value={summary.blocked} />
        </div>
      )}

      {/* Calm controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-white p-1 rounded-full border">
          <button
            className={`${chip} ${scope==="today" ? "bg-gray-900 text-white" : ""}`}
            onClick={()=>setScope("today")}
          >Today</button>
          <button
            className={`${chip} ${scope==="overdue" ? "bg-gray-900 text-white" : ""}`}
            onClick={()=>setScope("overdue")}
          >Overdue</button>
        </div>

        <button className={rowBtn} onClick={()=>setShowFilters(v=>!v)} aria-expanded={showFilters}>
          {showFilters ? "Hide filters" : "Filters"}
        </button>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 border rounded-xl bg-white px-3 py-2">
            <select
              className="border rounded-lg px-3 py-1.5"
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
              className="border rounded-lg px-3 py-1.5 min-w-[220px]"
            />
            <button className={rowBtn} onClick={load}>Apply</button>
          </div>
        )}
      </div>

      {/* Table (minimal) */}
      <div className="overflow-auto bg-white rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">
                <input
                  type="checkbox"
                  onChange={(e)=>toggleAll(!!e.currentTarget.checked)}
                  checked={items.length>0 && Object.keys(selected).every(id => selected[id])}
                />
              </th>
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Due</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">Nothing here — nice.</td></tr>
            )}
            {items.map(t => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={!!selected[t.id]}
                    onChange={(e)=>{
                      const checked = (e.target as HTMLInputElement).checked;
                      setSelected(s => ({ ...s, [t.id]: checked }));
                    }}
                  />
                </td>
                <td className="p-2 font-medium">{t.title}</td>
                <td className="p-2">
                  <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {t.relatedType ?? "—"}
                  </span>
                </td>
                <td className="p-2">{t.dueAt ? new Date(t.dueAt).toLocaleString() : "—"}</td>
                <td className="p-2">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calm tip to differentiate spaces */}
      <p className={subtle}>
        Tip: <strong>My Tasks</strong> (drawer) is your personal list. This page is for the whole team: pick a scope,
        optionally filter, and use bulk actions when rows are selected.
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
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-auto z-[60]">
          <div className="mx-auto md:ml-auto w-full md:w-auto rounded-2xl bg-white/95 backdrop-blur border shadow-lg p-3 flex flex-wrap items-center gap-2">
            <span className={subtle}>{selectedIds.length} selected</span>
            <button className={rowBtn} onClick={bulkAssignToMe}>Assign to me</button>
            <button className={rowBtn} onClick={()=>bulkSetDue(1)}>Due +1 day</button>
            <button className={rowBtn} onClick={()=>bulkSetDue(3)}>Due +3 days</button>
            <button className="px-3 py-1.5 rounded-lg bg-slate-800 text-white" onClick={bulkStart}>Start</button>
            <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white" onClick={bulkComplete}>Complete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}