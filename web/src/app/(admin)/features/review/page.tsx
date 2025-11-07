"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import DiffViewer from "@/components/DiffViewer";

interface AdminFeatureRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  priority: number | null;
  allowedFiles?: string[] | null;
  patchText?: string | null;
  checksStatus?: string | null;
  logs?: string | null;
  tenant?: { id: string; name: string } | null;
}

const taskTemplates = [
  { value: "ads-lp-prod", label: "Ads Landing Page" },
];

export default function AdminFeatureReviewPage() {
  const [requests, setRequests] = useState<AdminFeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<AdminFeatureRequest | null>(null);
  const [runTarget, setRunTarget] = useState<AdminFeatureRequest | null>(null);
  const [taskKey, setTaskKey] = useState("ads-lp-prod");
  const [extraContext, setExtraContext] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<AdminFeatureRequest[]>("/admin/feature-requests");
      setRequests(data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRunAi(e: FormEvent) {
    e.preventDefault();
    if (!runTarget) return;
    setBusyId(runTarget.id);
    try {
      await apiFetch(`/admin/feature-requests/${runTarget.id}/run-ai`, {
        method: "POST",
        json: { taskKey, extraContext: extraContext || undefined },
      });
      setMessage("AI patch generated");
      setRunTarget(null);
      setExtraContext("");
      await load();
    } catch (err: any) {
      setMessage(err?.message || "Failed to run AI");
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/admin/feature-requests/${id}/approve`, { method: "POST" });
      setMessage("Patch approved and PR opened");
      await load();
    } catch (err: any) {
      setMessage(err?.message || "Approval failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = typeof window !== "undefined" ? window.prompt("Reason for rejection?") : "";
    setBusyId(id);
    try {
      await apiFetch(`/admin/feature-requests/${id}/reject`, {
        method: "POST",
        json: { reason: reason || undefined },
      });
      setMessage("Request rejected");
      await load();
    } catch (err: any) {
      setMessage(err?.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI feature queue</h1>
        <p className="text-sm text-muted-foreground">
          Review tenant requests, generate AI patches, and approve once checks pass.
        </p>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-3">
        {requests.map((item) => (
          <div key={item.id} className="rounded border p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">Tenant: {item.tenant?.name || item.tenant?.id || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">Status: {item.status} · Priority: {item.priority ?? "--"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded border px-3 py-1 text-xs font-medium"
                  onClick={() => setRunTarget(item)}
                  disabled={busyId === item.id}
                >
                  Run AI
                </button>
                <button
                  className="rounded border px-3 py-1 text-xs font-medium"
                  onClick={() => setSelectedDiff(item)}
                  disabled={!item.patchText}
                >
                  View diff
                </button>
                <button
                  className="rounded border px-3 py-1 text-xs font-medium"
                  onClick={() => handleApprove(item.id)}
                  disabled={busyId === item.id || !item.patchText}
                >
                  Approve
                </button>
                <button
                  className="rounded border px-3 py-1 text-xs font-medium"
                  onClick={() => handleReject(item.id)}
                  disabled={busyId === item.id}
                >
                  Reject
                </button>
              </div>
            </div>
            {item.logs && (
              <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{item.logs}</pre>
            )}
            {selectedDiff?.id === item.id && (
              <DiffViewer diffText={item.patchText || ""} />
            )}
          </div>
        ))}
      </div>

      {runTarget && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleRunAi} className="w-full max-w-md space-y-4 rounded bg-background p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Run AI for {runTarget.title}</h2>
            <div>
              <label className="block text-sm font-medium">Prompt template</label>
              <select
                value={taskKey}
                onChange={(e) => setTaskKey(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                {taskTemplates.map((tpl) => (
                  <option key={tpl.value} value={tpl.value}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Extra context (optional)</label>
              <textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm min-h-[100px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRunTarget(null)}
                className="rounded border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === runTarget.id}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {busyId === runTarget.id ? "Running…" : "Run AI"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
