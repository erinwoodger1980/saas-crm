"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const categories = [
  { value: "UI", label: "UI" },
  { value: "COPY", label: "Copy" },
  { value: "PRICING", label: "Pricing" },
  { value: "ANALYTICS", label: "Analytics" },
  { value: "INTEGRATION", label: "Integration" },
  { value: "OTHER", label: "Other" },
];

export default function NewFeatureRequestPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [allowedFiles, setAllowedFiles] = useState("");
  const [priority, setPriority] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch<{ id: string; tenantId: string }>("/auth/me")
      .then((me) => {
        if (me?.tenantId) {
          setTenantId(me.tenantId);
        }
      })
      .catch(() => {
        setTenantId("");
      });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) {
      setError("Tenant not resolved. Please refresh and try again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/feature-requests", {
        method: "POST",
        json: {
          tenantId,
          title,
          description,
          category,
          allowedFiles,
          priority: priority ? Number(priority) : undefined,
        },
      });
      setSuccess(true);
      setTimeout(() => router.push("/(tenant)/features"), 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Request a feature</h1>
        <p className="text-sm text-muted-foreground">
          Tell the Joinery AI team what you need. Our admins will review and prepare an AI-generated patch.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            placeholder="Short summary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm min-h-[140px]"
            placeholder="Describe the desired behaviour"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              {categories.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              <option value="1">High</option>
              <option value="2">Medium</option>
              <option value="3">Low</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Allowed file globs (optional)</label>
          <textarea
            value={allowedFiles}
            onChange={(e) => setAllowedFiles(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm min-h-[100px]"
            placeholder="e.g. web/src/app/(tenant)/**"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Separate multiple paths with new lines. Admin AI patches will be limited to these files.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">Request submitted! Redirecting…</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
