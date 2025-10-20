// web/src/components/tasks/TaskModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api"; // ✅ use apiFetch

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

export function TaskModal({
  open,
  onClose,
  task,
  tenantId,
  userId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  tenantId: string;
  userId: string;
  onChanged?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Task | null>(task);

  useEffect(() => setForm(task), [task]);

  const dueISO = useMemo(() => {
    if (!form?.dueAt) return "";
    const d = new Date(form.dueAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [form?.dueAt]);

  if (!open || !form) return null;

  async function update(fields: Partial<Task>) {
    setSaving(true);
    try {
      await apiFetch(`/tasks/${form!.id}`, {
        method: "PATCH",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
        json: {
          ...fields,
          dueAt: fields.dueAt === "" ? null : fields.dueAt,
        },
      });
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function startTask() {
    setSaving(true);
    try {
      await apiFetch(`/tasks/${form!.id}/start`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
      });
      onChanged?.();
      toast("Getting this moving—nice.");
    } finally {
      setSaving(false);
    }
  }

  async function completeTask() {
    setSaving(true);
    try {
      await apiFetch(`/tasks/${form!.id}/complete`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
      });
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
    <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-4 md:p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <input
            className="w-full text-xl md:text-2xl font-semibold outline-none bg-transparent"
            defaultValue={form!.title}
            onBlur={(e) => update({ title: e.currentTarget.value })}
          />
          <button onClick={onClose} className="rounded-full border px-3 py-1">Close</button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase text-gray-500">Status</span>
            <select
              defaultValue={form!.status}
              className="border rounded-lg px-3 py-2"
              onChange={(e) => update({ status: e.target.value as Task["status"] })}
            >
              {["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase text-gray-500">Priority</span>
            <select
              defaultValue={form!.priority}
              className="border rounded-lg px-3 py-2"
              onChange={(e) => update({ priority: e.target.value as Task["priority"] })}
            >
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase text-gray-500">Due</span>
            <input
              type="datetime-local"
              defaultValue={dueISO}
              className="border rounded-lg px-3 py-2"
              onChange={(e) => update({ dueAt: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs uppercase text-gray-500">Description</span>
            <textarea
              defaultValue={form!.description || ""}
              className="border rounded-lg px-3 py-2 min-h-28"
              onBlur={(e) => update({ description: e.currentTarget.value })}
              placeholder="Notes…"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={startTask}
            disabled={saving || form!.status === "IN_PROGRESS" || form!.status === "DONE"}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-40"
          >
            Start
          </button>
          <button
            onClick={completeTask}
            disabled={saving || form!.status === "DONE"}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 disabled:opacity-40"
          >
            Complete
          </button>
          <div className="ml-auto text-sm text-gray-500">
            <span>Saved. One step closer.</span>
          </div>
        </div>
      </div>
    </div>
  );
}