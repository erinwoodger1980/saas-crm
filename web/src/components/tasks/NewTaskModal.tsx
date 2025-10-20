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
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">New Task</h2>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Title"
          className="w-full border rounded-lg px-3 py-2"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <textarea
          placeholder="Description"
          className="w-full border rounded-lg px-3 py-2 min-h-24"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="flex gap-2">
          <select
            className="border rounded-lg px-3 py-2"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            className="border rounded-lg px-3 py-2 flex-1"
            value={form.dueAt}
            onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Task"}
          </button>
        </div>
      </div>
    </div>
  );
}