"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

function toIsoOrUndefined(localValue: string): string | undefined {
  if (!localValue) return undefined;
  // localValue is like "2025-10-21T17:00" (no timezone).
  // Interpret as local time and convert to UTC ISO.
  const d = new Date(localValue);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function NewTaskModal({
  tenantId,
  userId,
  onClose,
}: {
  tenantId: string;
  userId: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueAt: "", // datetime-local string
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!form.title.trim()) {
      setError("Title required");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/tasks", {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
          "Content-Type": "application/json",
        },
        json: {
          title: form.title.trim(),
          description: form.description || undefined,
          relatedType: "OTHER",
          priority: form.priority,
          // ✅ convert to ISO for the API’s z.string().datetime()
          dueAt: toIsoOrUndefined(form.dueAt),
          // by default assign to the current user (owner)
          assignees: userId ? [{ userId, role: "OWNER" }] : [],
        },
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-gradient-to-br from-sky-400/30 via-indigo-700/20 to-rose-500/30 px-4 py-6 backdrop-blur">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/30 bg-white/90 p-6 sm:p-8 shadow-[0_22px_55px_-25px_rgba(79,70,229,0.45)] backdrop-blur-xl">
        <div aria-hidden="true" className="pointer-events-none absolute -top-10 -left-6 h-40 w-40 rounded-full bg-sky-200/60 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-10 h-44 w-44 rounded-full bg-rose-200/60 blur-3xl" />

        <div className="relative space-y-6">
          <header className="space-y-1 text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Task spell</div>
            <h2 className="text-2xl font-semibold text-slate-800">Invite a new to-do to the adventure</h2>
            <p className="text-sm text-slate-500">Give it a name, a dash of detail, and a due date for the magic hour.</p>
          </header>

          {error && (
            <div className="relative rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <label className="block text-left text-sm font-semibold text-slate-600">
              Title
              <input
                type="text"
                placeholder="e.g. Call the client with good news"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-800 shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>

            <label className="block text-left text-sm font-semibold text-slate-600">
              Description
              <textarea
                placeholder="Add context or a sprinkle of story"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-800 shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 min-h-28"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[160px,1fr]">
              <label className="text-sm font-semibold text-slate-600">
                Priority
                <select
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-600">
                Due date & time
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  value={form.dueAt}
                  onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition disabled:opacity-40"
            >
              {saving ? "Saving…" : "Create task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}