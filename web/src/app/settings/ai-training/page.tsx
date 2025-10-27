"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
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

type FollowupLearningResponse = {
  optIn: boolean;
  summary?: string;
  sampleSize?: number;
  variants?: {
    variant: string;
    sampleSize: number;
    replyRate?: number;
    conversionRate?: number;
    avgDelayDays?: number | null;
    successScore?: number;
  }[];
  call?: {
    sampleSize?: number;
    avgDelayDays?: number | null;
    conversionRate?: number | null;
  };
  lastUpdatedISO?: string | null;
};

function formatDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
  } catch {
    return s;
  }
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  const pct = value * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${Math.round(pct * 10) / 10}%`;
}

function formatDaysLabel(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  const days = Number(value);
  if (!Number.isFinite(days)) return "—";
  if (days <= 0) return "Same day";
  if (days < 1) {
    const hrs = Math.max(1, Math.round(days * 24));
    return `${hrs} hr${hrs === 1 ? "" : "s"}`;
  }
  const rounded = Math.round(days * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    const whole = Math.max(1, Math.round(rounded));
    return `${whole} day${whole === 1 ? "" : "s"}`;
  }
  return `${rounded} days`;
}

export default function AiTrainingPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [mlHealth, setMlHealth] = useState<{ ok: boolean; target?: string } | null>(null);
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // Historic supplier quotes ingestion
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ id: string; name: string; uploadedAt?: string; mimeType?: string; sizeBytes?: number | null }>>([]);
  const [fileSel, setFileSel] = useState<Record<string, boolean>>({});
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [followupLearning, setFollowupLearning] = useState<FollowupLearningResponse | null>(null);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [updatingFollowupOptIn, setUpdatingFollowupOptIn] = useState(false);

  const fetchFollowupLearning = useCallback(async () => {
    setFollowupLoading(true);
    setFollowupError(null);
    try {
      const data = await apiFetch<FollowupLearningResponse>("/ai/followup/learning");
      setFollowupLearning(data);
    } catch (e: any) {
      setFollowupError(e?.message || "Failed to load follow-up learning");
    } finally {
      setFollowupLoading(false);
    }
  }, []);

  const isEA = !!user?.isEarlyAdopter;

  // ML health indicator
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const h = await apiFetch<{ ok: boolean; target?: string }>("/ml/health");
        if (!cancel) setMlHealth(h);
      } catch {
        if (!cancel) setMlHealth({ ok: false });
      }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    void fetchFollowupLearning();
  }, [fetchFollowupLearning]);

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

  // Load recent supplier quote files
  useEffect(() => {
    let cancel = false;
    setFilesLoading(true);
    setFilesError(null);
    (async () => {
      try {
        const resp = await apiFetch<{ ok: boolean; items: any[] }>(`/files?kind=SUPPLIER_QUOTE&limit=50`);
        if (!cancel) setFiles((resp.items || []).map((x) => ({ id: x.id, name: x.name, uploadedAt: x.uploadedAt, mimeType: x.mimeType, sizeBytes: x.sizeBytes })));
      } catch (e: any) {
        if (!cancel) setFilesError(e?.message || "Failed to load uploaded files");
      } finally {
        if (!cancel) setFilesLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

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

  const trendData = useMemo(() => {
    // Aggregate accepted/rejected counts by date (YYYY-MM-DD)
    const byDate = new Map<string, { date: string; accepted: number; rejected: number }>();
    for (const i of filteredInsights) {
      const d = i.createdAt ? new Date(i.createdAt) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, { date: key, accepted: 0, rejected: 0 });
      const row = byDate.get(key)!;
      const dec = (i.decision || "").toLowerCase();
      if (dec === "accepted") row.accepted += 1;
      else if (dec === "rejected") row.rejected += 1;
    }
    // Sort ascending by date
    return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [filteredInsights]);

  const followupHasData = (followupLearning?.sampleSize ?? 0) > 0;

  const followupTopVariant = useMemo(() => {
    if (!followupLearning?.variants || followupLearning.variants.length === 0) return null;
    const ordered = [...followupLearning.variants].sort(
      (a, b) => (b.successScore ?? 0) - (a.successScore ?? 0),
    );
    return ordered[0];
  }, [followupLearning?.variants]);

  function parseEmailRef(inputSummary?: string | null): { provider: string; messageId: string } | null {
    if (!inputSummary || !inputSummary.startsWith("email:")) return null;
    const parts = inputSummary.split(":");
    const provider = parts[1];
    const messageId = parts.slice(2).join(":");
    return { provider, messageId };
  }

  function toCsvValue(v: any): string {
    if (v == null) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function toggleFile(id: string) {
    setFileSel((s) => ({ ...s, [id]: !s[id] }));
  }

  function selectAllFiles() {
    const next: Record<string, boolean> = { ...fileSel };
    for (const f of files) next[f.id] = true;
    setFileSel(next);
  }

  function clearFiles() {
    setFileSel({});
  }

  async function toggleFollowupOptIn(next: boolean) {
    setUpdatingFollowupOptIn(true);
    try {
      await apiFetch("/tenant/settings", {
        method: "PATCH",
        json: { aiFollowupLearning: { crossTenantOptIn: next } },
      });
      setFollowupLearning((prev) => (prev ? { ...prev, optIn: next } : { optIn: next }));
      toast({
        title: next ? "Sharing enabled" : "Sharing paused",
        description: next
          ? "Your follow-ups contribute to the network playbook."
          : "We’ll keep future follow-ups private.",
        duration: 2600,
      });
      await fetchFollowupLearning();
    } catch (e: any) {
      toast({ title: "Couldn’t update sharing", description: e?.message || "", variant: "destructive" });
    } finally {
      setUpdatingFollowupOptIn(false);
    }
  }

  async function trainOnSelectedFiles() {
    const ids = Object.entries(fileSel).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/internal/ml/save-train-from-uploaded`, { method: "POST", json: { uploadedFileIds: ids } });
      toast({ title: "Training kicked", description: `${ids.length} file(s) sent to ML`, duration: 2500 });
      clearFiles();
    } catch (e: any) {
      setError(e?.message || "Could not send files to train");
    } finally {
      setSaving(false);
    }
  }

  async function createDraftQuoteAndOpen() {
    setCreatingQuote(true);
    try {
      const q = await apiFetch<any>("/quotes", { method: "POST", json: { title: `Draft quote ${new Date().toLocaleString()}` } });
      if (q?.id) {
        window.location.href = `/settings/ai-training/quotes/${encodeURIComponent(q.id)}`;
      }
    } catch (e) {
      // silently ignore; error box below handles general API errors
    } finally {
      setCreatingQuote(false);
    }
  }

  function exportCsv() {
    const headers = [
      "timestamp",
      "module",
      "provider",
      "messageId",
      "decision",
      "confidence",
      "feedbackThumbs",
      "inputSummary",
    ];
    const rows = filteredInsights.map((i) => {
      const ref = parseEmailRef(i.inputSummary);
      const provider = ref?.provider || "";
      const messageId = ref?.messageId || "";
      const thumbs = typeof i.userFeedback?.thumbs === "boolean" ? i.userFeedback.thumbs : "";
      return [
        i.createdAt,
        i.module,
        provider,
        messageId,
        i.decision || "",
        typeof i.confidence === "number" ? i.confidence.toFixed(3) : "",
        thumbs,
        i.inputSummary || "",
      ].map(toCsvValue).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `ai-training-${moduleId}-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toggleSelectOne(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function selectAllCurrent() {
    const next: Record<string, boolean> = { ...selected };
    for (const i of filteredInsights) next[i.id] = true;
    setSelected(next);
  }

  function clearSelection() {
    setSelected({});
  }

  async function retrainWithSelection() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/ml/model/retrain`, { method: "POST", json: { module: moduleId, insightIds: ids } });
      toast({ title: "Retrain queued", description: `${ids.length} examples selected`, duration: 2500 });
      clearSelection();
    } catch (e: any) {
      setError(e?.message || "Could not retrain with selection");
    } finally {
      setSaving(false);
    }
  }

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
      <div className="flex items-center gap-2">
        {mlHealth && (
          <Badge variant={mlHealth.ok ? "secondary" : "destructive"} className="text-xs">
            ML: {mlHealth.ok ? "online" : "offline"}{mlHealth?.target ? ` • ${mlHealth.target}` : ""}
          </Badge>
        )}
        {avgConf != null && (
          <Badge variant="secondary" className="text-sm">Avg confidence: {(avgConf * 100).toFixed(0)}%</Badge>
        )}
      </div>
    </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Quote follow-up learning</p>
            <p className="text-xs text-slate-500">See what the model is saying and how it times follow-ups after quotes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {followupLearning?.sampleSize != null ? (
              <Badge variant="secondary" className="text-xs">
                {(followupLearning.sampleSize ?? 0).toLocaleString()} emails analyzed
              </Badge>
            ) : null}
            {followupLearning ? (
              <Badge variant={followupLearning.optIn ? "secondary" : "destructive"} className="text-xs">
                {followupLearning.optIn ? "Sharing insights" : "Sharing paused"}
              </Badge>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void fetchFollowupLearning()} disabled={followupLoading}>
              {followupLoading ? "Refreshing…" : "Refresh"}
            </Button>
            {followupLearning ? (
              <Button
                size="sm"
                variant={followupLearning.optIn ? "outline" : "default"}
                onClick={() => toggleFollowupOptIn(!(followupLearning.optIn))}
                disabled={updatingFollowupOptIn}
              >
                {updatingFollowupOptIn
                  ? "Saving…"
                  : followupLearning.optIn
                  ? "Pause sharing"
                  : "Enable sharing"}
              </Button>
            ) : null}
          </div>
        </div>
        {followupError ? (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{followupError}</div>
        ) : null}
        {followupLoading && !followupHasData ? (
          <div className="mt-4 text-sm text-slate-500">Loading follow-up insights…</div>
        ) : null}
        {!followupLoading && !followupHasData ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
            Send your first follow-up from an opportunity to unlock cadence analytics.
          </div>
        ) : null}
        {followupLearning ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What we’re saying</div>
              <div className="mt-2 text-sm text-slate-800">
                {followupLearning.summary || "We’ll summarise messaging once a few follow-ups have been sent."}
              </div>
              {followupLearning.lastUpdatedISO ? (
                <div className="mt-2 text-[10px] text-slate-500">
                  Updated {formatDate(followupLearning.lastUpdatedISO)}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cadence & performance</div>
              <div className="mt-2 text-sm text-slate-800">
                {followupTopVariant && followupTopVariant.avgDelayDays != null
                  ? `Variant ${followupTopVariant.variant} wins after about ${formatDaysLabel(followupTopVariant.avgDelayDays)}.`
                  : followupHasData
                  ? `AI is comparing ${followupLearning.variants?.length || 0} variants right now.`
                  : "Cadence insights will appear here once we have a few sends."}
              </div>
              {followupTopVariant ? (
                <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                  <div>
                    Replies: {formatPercent(followupTopVariant.replyRate)} · Wins: {formatPercent(followupTopVariant.conversionRate)}
                  </div>
                  {followupTopVariant.avgDelayDays != null ? (
                    <div>Average delay {formatDaysLabel(followupTopVariant.avgDelayDays)}</div>
                  ) : null}
                </div>
              ) : null}
              {followupLearning.call?.sampleSize ? (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] text-blue-900">
                  Phone nudges: {followupLearning.call.sampleSize} samples · {formatDaysLabel(followupLearning.call.avgDelayDays)} after send · Conversion {formatPercent(followupLearning.call.conversionRate)}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {followupLearning?.variants && followupLearning.variants.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 bg-white">
            <table className="min-w-full text-left text-xs text-slate-600">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2">Samples</th>
                  <th className="px-3 py-2">Reply rate</th>
                  <th className="px-3 py-2">Conversion</th>
                  <th className="px-3 py-2">Avg delay</th>
                </tr>
              </thead>
              <tbody>
                {followupLearning.variants.slice(0, 5).map((variant) => {
                  const leader = followupTopVariant?.variant === variant.variant;
                  return (
                    <tr key={variant.variant} className={`border-t border-slate-100 ${leader ? "bg-slate-50/80" : ""}`}>
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        Variant {variant.variant}
                        {leader ? (
                          <Badge variant="secondary" className="ml-2 align-middle text-[10px]">Leading</Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{variant.sampleSize.toLocaleString()}</td>
                      <td className="px-3 py-2">{formatPercent(variant.replyRate)}</td>
                      <td className="px-3 py-2">{formatPercent(variant.conversionRate)}</td>
                      <td className="px-3 py-2">{formatDaysLabel(variant.avgDelayDays)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Quote Builder quick access */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-700">Quote Builder</p>
            <p className="text-xs text-slate-500">Parse supplier PDFs, map to questions, and price.</p>
          </div>
          <Button size="sm" onClick={createDraftQuoteAndOpen} disabled={creatingQuote}>
            {creatingQuote ? "Creating…" : "New draft quote"}
          </Button>
        </div>
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
        {/* Left: Controls */}
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

  {/* Right: Trend + Recent decisions */
  }
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Decision trend</p>
              <span className="text-xs text-slate-500">by day</span>
            </div>
            <div className="h-40 w-full">
              {trendData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-500">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="acceptedFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rejectedFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} />
                    <Tooltip wrapperClassName="!text-xs" />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="accepted" stroke="#10b981" fillOpacity={1} fill="url(#acceptedFill)" />
                    <Area type="monotone" dataKey="rejected" stroke="#ef4444" fillOpacity={1} fill="url(#rejectedFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
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
              <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
              <Button size="sm" onClick={retrainWithSelection} disabled={saving || Object.values(selected).every((v) => !v)}>Retrain with selection</Button>
              <Button size="sm" variant="outline" onClick={selectAllCurrent}>Select all</Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
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

              const checked = !!selected[i.id];
              return (
                <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="size-4" checked={checked} onChange={() => toggleSelectOne(i.id)} />
                      <div className="font-medium text-slate-800">{i.decision || "—"}</div>
                    </div>
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

      {/* Historic supplier quotes ingestion */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Historic supplier quotes</p>
            <p className="text-xs text-slate-500">Select past uploaded PDFs and send them to the ML trainer.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={selectAllFiles}>Select all</Button>
            <Button size="sm" variant="ghost" onClick={clearFiles}>Clear</Button>
            <Button size="sm" onClick={trainOnSelectedFiles} disabled={saving || Object.values(fileSel).every((v) => !v)}>Train on selected</Button>
          </div>
        </div>
        {filesLoading && <div className="text-sm text-slate-500">Loading files…</div>}
        {filesError && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{filesError}</div>}
        {!filesLoading && !filesError && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((f) => {
              const checked = !!fileSel[f.id];
              const when = f.uploadedAt ? formatDate(f.uploadedAt) : "—";
              const size = typeof f.sizeBytes === 'number' && f.sizeBytes > 0 ? `${(f.sizeBytes/1024/1024).toFixed(2)} MB` : '';
              return (
                <label key={f.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="mt-1 size-4" checked={checked} onChange={() => toggleFile(f.id)} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{f.name}</div>
                    <div className="text-xs text-slate-500">{when}{size ? ` • ${size}` : ''}</div>
                  </div>
                </label>
              );
            })}
            {files.length === 0 && <div className="text-sm text-slate-500">No supplier quote files found.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
