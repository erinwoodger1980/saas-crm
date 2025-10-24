"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch, API_BASE } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
// Using a native range input instead of a custom Slider to avoid extra deps

const MODULES = [
  { id: "lead_classifier", label: "Lead Classifier" },
  { id: "quote_builder", label: "Quotation Builder" },
  { id: "estimator", label: "Estimator" },
  { id: "sales_assistant", label: "Sales Assistant" },
] as const;

type Insight = {
  id: string;
  module: string;
  inputSummary?: string | null;
  decision?: string | null;
  confidence?: number | null;
  userFeedback?: any;
  createdAt: string;
};

type ParamRow = {
  id: string;
  module: string;
  key: string;
  value: any;
  reason?: string | null;
  createdAt: string;
};

type InsightsResponse = {
  ok: boolean;
  items: Insight[];
  params: ParamRow[];
};

function formatDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
  } catch {
    return s;
  }
}

export default function AiTrainingPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [moduleId, setModuleId] = useState<typeof MODULES[number]["id"]>("lead_classifier");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [params, setParams] = useState<ParamRow[]>([]);
  const [threshold, setThreshold] = useState<number>(0.6);
  const [saving, setSaving] = useState(false);
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, { loading: boolean; data?: any; error?: string }>>({});
  const [limit, setLimit] = useState<number>(50);
  const [providerFilter, setProviderFilter] = useState<"all" | "gmail" | "ms365" | "other">("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | "accepted" | "rejected" | "other">("all");

  const isEA = !!user?.isEarlyAdopter;

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await apiFetch<InsightsResponse>(`/ml/insights?module=${moduleId}&limit=${limit}`);
        if (!cancel) {
          setInsights(data.items || []);
          setParams(data.params || []);
          // Pull last threshold if present
          const p = (data.params || []).find((r) => r.key === "lead.threshold" || r.key.endsWith(".threshold"));
          if (p && typeof p.value === "number") setThreshold(p.value);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message || "Failed to load training data");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [moduleId, limit]);

  const avgConf = useMemo(() => {
    const xs = insights.map((i) => i.confidence).filter((x): x is number => typeof x === "number");
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }, [insights]);

  const filteredInsights = useMemo(() => {
    const getProvider = (i: Insight) => {
      if (!i.inputSummary || !i.inputSummary.startsWith("email:")) return "other" as const;
      const p = i.inputSummary.split(":")[1];
      return (p === "gmail" || p === "ms365") ? (p as "gmail" | "ms365") : "other";
    };
    return insights.filter((i) => {
      const prov = getProvider(i);
      const dec = (i.decision || "").toLowerCase();
      const provOk = providerFilter === "all" || prov === providerFilter;
      const decOk =
        decisionFilter === "all" ||
        (decisionFilter === "accepted" && dec === "accepted") ||
        (decisionFilter === "rejected" && dec === "rejected") ||
        (decisionFilter === "other" && dec !== "accepted" && dec !== "rejected");
      return provOk && decOk;
    });
  }, [insights, providerFilter, decisionFilter]);

  const summary = useMemo(() => {
    const s = { total: filteredInsights.length, accepted: 0, rejected: 0 };
    for (const i of filteredInsights) {
      const d = (i.decision || "").toLowerCase();
      if (d === "accepted") s.accepted++;
      else if (d === "rejected") s.rejected++;
    }
    return s;
  }, [filteredInsights]);

  async function saveThreshold() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/ml/params/set`, { method: "POST", json: { module: moduleId, key: "lead.threshold", value: threshold } });
    } catch (e: any) {
      setError(e?.message || "Could not save parameter");
    } finally {
      setSaving(false);
    }
  }

  async function retrain() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/ml/model/retrain`, { method: "POST", json: { module: moduleId } });
    } catch (e: any) {
      setError(e?.message || "Could not trigger retrain");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Reset model parameters and cached adapters for this module?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/ml/model/reset`, { method: "POST", json: { module: moduleId } });
    } catch (e: any) {
      setError(e?.message || "Could not reset model");
    } finally {
      setSaving(false);
    }
  }

  async function sendFeedback(i: Insight, ok: boolean) {
    setSaving(true);
    setError(null);
    try {
      const payload: any = { module: moduleId, insightId: i.id, correct: ok };
      // For lead classifier, also pass isLead flag
      if (moduleId === "lead_classifier") payload.isLead = ok;
      await apiFetch(`/ml/feedback`, { method: "POST", json: payload });
      // Optimistic: mark userFeedback locally
      setInsights((prev) => prev.map((row) => (row.id === i.id ? { ...row, userFeedback: { ...(row.userFeedback || {}), thumbs: ok } } : row)));
      toast({ title: "Feedback saved", description: moduleId === "lead_classifier" ? "Recorded and linked to email ingest." : "Recorded for retraining.", duration: 2500 });
    } catch (e: any) {
      setError(e?.message || "Could not send feedback");
    } finally {
      setSaving(false);
    }
  }

  async function togglePreview(i: Insight) {
    if (!i.inputSummary || !i.inputSummary.startsWith("email:")) return;
    const id = i.id;
    const parts = i.inputSummary.split(":");
    const provider = parts[1];
    const messageId = parts.slice(2).join(":");
    const already = previews[id];

    if (openPreviewId === id) {
      setOpenPreviewId(null);
      return;
    }

    if (!already || (!already.data && !already.loading)) {
      setPreviews((p) => ({ ...p, [id]: { loading: true } }));
      try {
        const msg = await apiFetch<any>(`/${provider}/message/${encodeURIComponent(messageId)}`);
        setPreviews((p) => ({ ...p, [id]: { loading: false, data: msg } }));
      } catch (e: any) {
        setPreviews((p) => ({ ...p, [id]: { loading: false, error: e?.message || "Failed to load message" } }));
      }
    }
    setOpenPreviewId(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI Training</h1>
          <p className="text-sm text-slate-600">Tune sensitivity, review recent decisions, and retrain per module.</p>
        </div>
        {avgConf != null && (
          <Badge variant="secondary" className="text-sm">Avg confidence: {(avgConf * 100).toFixed(0)}%</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {MODULES.map((m) => (
          <Button key={m.id} size="sm" variant={moduleId === m.id ? "default" : "outline"} onClick={() => setModuleId(m.id)}>
            {m.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-slate-600">Limit</label>
          <select className="rounded-md border px-2 py-1 text-xs" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {!isEA && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI Training is limited to early access users for now.
        </div>
      )}

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Sensitivity threshold</p>
            <span className="text-xs text-slate-500">{threshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            value={threshold}
            min={0.3}
            max={0.95}
            step={0.01}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveThreshold} disabled={saving}>Save</Button>
            <Button size="sm" variant="outline" onClick={retrain} disabled={saving}>Retrain</Button>
            <Button size="sm" variant="destructive" onClick={reset} disabled={saving}>Reset</Button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">Recent decisions</p>
            <div className="flex items-center gap-2">
              <select className="rounded-md border px-2 py-1 text-xs" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value as any)}>
                <option value="all">All providers</option>
                <option value="gmail">Gmail</option>
                <option value="ms365">MS365</option>
                <option value="other">Other</option>
              </select>
              <select className="rounded-md border px-2 py-1 text-xs" value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value as any)}>
                <option value="all">All decisions</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="other">Other</option>
              </select>
              <Badge variant="secondary" className="text-xs">{summary.accepted} ✓ / {summary.rejected} ✕ / {summary.total} total</Badge>
            </div>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-2">
            {loading && <div className="text-sm text-slate-500">Loading…</div>}
            {!loading && filteredInsights.length === 0 && (
              <div className="text-sm text-slate-500">No insights yet.</div>
            )}
            {filteredInsights.map((i) => {
              const thumbs = i.userFeedback?.thumbs as boolean | undefined;
              // Derive a source link when inputSummary encodes an email reference
              let sourceEl: ReactNode = null;
              if (i.inputSummary && i.inputSummary.startsWith("email:")) {
                const parts = i.inputSummary.split(":");
                const provider = parts[1];
                const messageId = parts.slice(2).join(":");
                if (API_BASE && (provider === "gmail" || provider === "ms365")) {
                  const href = `${API_BASE}/${provider}/message/${encodeURIComponent(messageId)}`;
                  sourceEl = (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-500 underline hover:text-slate-700"
                    >
                      View email (JSON)
                    </a>
                  );
                } else {
                  sourceEl = <span className="text-xs text-slate-400">Source: {provider} {messageId.slice(0, 8)}…</span>;
                }
              }

              return (
                <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-800">{i.decision || "—"}</div>
                    <div className="text-xs text-slate-500">{formatDate(i.createdAt)}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{i.inputSummary || "(no summary)"}</div>
                  {sourceEl && (
                    <div className="mt-1 flex items-center gap-3">
                      {sourceEl}
                      {i.inputSummary?.startsWith("email:") && (
                        <Button size="sm" variant="outline" onClick={() => togglePreview(i)}>
                          {openPreviewId === i.id ? "Hide" : "Preview"}
                        </Button>
                      )}
                    </div>
                  )}
                  {openPreviewId === i.id && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                      {previews[i.id]?.loading && <div>Loading preview…</div>}
                      {previews[i.id]?.error && <div className="text-rose-600">{previews[i.id]?.error}</div>}
                      {previews[i.id]?.data && (
                        <div className="space-y-2">
                          <div className="font-semibold">{previews[i.id].data.subject || "(no subject)"}</div>
                          <div className="text-slate-600">From: {previews[i.id].data.from || "—"}</div>
                          <div className="text-slate-600">Date: {formatDate(previews[i.id].data.date || null)}</div>
                          <div className="whitespace-pre-wrap rounded-md bg-white p-2 text-[12px] text-slate-800">
                            {previews[i.id].data.bodyText || previews[i.id].data.snippet || "(no content)"}
                          </div>
                          {Array.isArray(previews[i.id].data.attachments) && previews[i.id].data.attachments.length > 0 && (
                            <div className="pt-1">
                              <div className="mb-1 font-medium">Attachments</div>
                              <ul className="list-disc space-y-1 pl-5">
                                {previews[i.id].data.attachments.map((a: any) => {
                                  const parts = (i.inputSummary || "").split(":");
                                  const provider = parts[1];
                                  const messageId = parts.slice(2).join(":");
                                  const attachmentId = a.attachmentId || a.id;
                                  const href = `${API_BASE}/${provider}/message/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
                                  return (
                                    <li key={attachmentId}>
                                      <a className="text-blue-600 hover:underline" href={href} target="_blank" rel="noreferrer">
                                        {a.filename || a.name || "attachment"}
                                      </a>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {typeof i.confidence === "number" && (
                    <div className="mt-1 text-xs text-slate-500">Confidence: {(i.confidence * 100).toFixed(0)}%</div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant={thumbs === true ? "default" : "outline"} onClick={() => sendFeedback(i, true)} disabled={saving}>👍</Button>
                    <Button size="sm" variant={thumbs === false ? "default" : "outline"} onClick={() => sendFeedback(i, false)} disabled={saving}>👎</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
