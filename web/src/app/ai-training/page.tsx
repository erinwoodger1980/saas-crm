"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type Provider = "gmail" | "ms365";

type GmailConnection = { ok: boolean; connection?: { id: string; gmailAddress: string | null } | null };

type SamplesResp = {
  ok: boolean;
  count: number;
  items: Array<{
    id: string;
    tenantId: string;
    messageId: string;
    attachmentId: string;
    url: string;
    quotedAt?: string | null;
    createdAt: string;
  }>;
};

type CollectTrainResponse = {
  ok?: boolean;
  tenantId?: string;
  requested?: number;
  collected?: number;
  saved?: number;
  datasetCount?: number | null;
  modelVersionId?: string | null;
  promoted?: boolean;
  awaitingApproval?: boolean;
  metrics?: Record<string, any> | null;
};

type EstimatorStatus = {
  recentSamples14d: number;
  lastTrainingRun?: {
    id: string;
    status: string;
    datasetCount?: number | null;
    modelVersionId?: string | null;
    finishedAt?: string | null;
    metrics?: Record<string, any> | null;
  };
  productionModel?: {
    id: string;
    version?: string | null;
    metrics?: Record<string, any> | null;
    createdAt?: string;
  };
  modelConfidence: number | null;
  serviceHealth: "online" | "degraded" | "offline" | string;
};

type MlStatusSummary = {
  ok: boolean;
  models: Array<{
    id: string;
    model: string;
    label: string;
    datasetHash: string;
    createdAt: string;
    metrics: Record<string, any> | null;
    keyMetric?: { key: string; value: number | null; preference: "higher" | "lower" };
  }>;
  trainingRuns: Array<{
    id: string;
    model: string;
    status: string;
    createdAt: string;
    metrics: Record<string, any> | null;
    modelVersionId?: string | null;
    datasetHash?: string | null;
    datasetCount?: number | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  }>;
  suppliers: Array<{ supplier: string; count: number }>;
  estimates: {
    total: number;
    withActual: number;
    won: number;
    lost: number;
    averageMape: number | null;
  };
  inferenceActivity: {
    since: string;
    parsedSupplierLines: number;
    estimates: number;
    inferenceEvents: number;
  };
  estimator?: EstimatorStatus;
};

type FollowupSummaryResponse = {
  ok: boolean;
  days: number;
  totals: {
    sent: number;
    openRate: number | null;
    replyRate: number | null;
    conversionRate: number | null;
  };
  variants: Array<{
    key: string;
    label: string;
    sent: number;
    openRate: number | null;
    replyRate: number | null;
    conversionRate: number | null;
  }>;
  winner: string | null;
  rows: Array<{
    delayDays: number | null;
    sent: number;
    openRate: number | null;
    replyRate: number | null;
    conversionRate: number | null;
  }>;
};

type MarketingRoiRow = {
  source: string;
  leads: number;
  wins: number;
  avgJobValue: number | null;
  spend: number;
  followupCost: number;
  costPerWin: number | null;
  conversionRate: number | null;
  roi: number | null;
};

export default function AITrainingPage() {
  const [provider, setProvider] = useState<Provider>("gmail");
  const [gmailConn, setGmailConn] = useState<{ connected: boolean; address?: string | null }>({ connected: false });
  const [ms365Enabled, setMs365Enabled] = useState<boolean>(false);
  const [samples, setSamples] = useState<SamplesResp | null>(null);
  const [statusSummary, setStatusSummary] = useState<MlStatusSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<number>(50);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const [followupSummary, setFollowupSummary] = useState<FollowupSummaryResponse | null>(null);
  const [followupLoading, setFollowupLoading] = useState<boolean>(false);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [marketingRoi, setMarketingRoi] = useState<MarketingRoiRow[] | null>(null);
  const [marketingRoiLoading, setMarketingRoiLoading] = useState<boolean>(false);
  const [marketingRoiError, setMarketingRoiError] = useState<string | null>(null);
  const [roiPeriodLabel, setRoiPeriodLabel] = useState<string>("");
  const { toast } = useToast();

  const formatDateTime = (value?: string | null) => {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    try {
      return dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return dt.toISOString();
    }
  };

  const estimatorStatus = statusSummary?.estimator;
  const estimatorSamples = estimatorStatus?.recentSamples14d ?? 0;
  const estimatorConfidencePct =
    typeof estimatorStatus?.modelConfidence === "number"
      ? Math.round(Math.max(0, Math.min(1, estimatorStatus.modelConfidence)) * 100)
      : null;
  const estimatorConfidenceDisplay =
    estimatorConfidencePct != null ? `${estimatorConfidencePct}%` : undefined;
  const estimatorLastTrainedLabel = formatDateTime(estimatorStatus?.lastTrainingRun?.finishedAt);
  const estimatorServiceHealth = typeof estimatorStatus?.serviceHealth === "string"
    ? estimatorStatus.serviceHealth
    : "unknown";
  const estimatorHealthLabel = estimatorServiceHealth
    ? estimatorServiceHealth.charAt(0).toUpperCase() + estimatorServiceHealth.slice(1)
    : "Unknown";
  const estimatorHealthTone =
    estimatorServiceHealth === "online"
      ? "text-emerald-600"
      : estimatorServiceHealth === "degraded"
      ? "text-amber-600"
      : estimatorServiceHealth === "offline"
      ? "text-rose-600"
      : "text-slate-600";
  const estimatorProdVersion = estimatorStatus?.productionModel?.version ?? estimatorStatus?.productionModel?.id ?? null;

  useEffect(() => {
    (async () => {
      try {
        // Gmail connection
        let gmailConnected = false;
        try {
          const j = await apiFetch<GmailConnection>("/gmail/connection");
          gmailConnected = !!j?.connection;
          setGmailConn({ connected: gmailConnected, address: (j as any)?.connection?.gmailAddress ?? null });
        } catch {
          setGmailConn({ connected: false });
        }
        // Inbox flags (for ms365 visibility)
        try {
          const ts = await apiFetch<any>("/tenant/settings");
          const inbox = (ts as any)?.inbox || {};
          setMs365Enabled(!!inbox.ms365);
          // Prefer Gmail by default if connected, else fallback to ms365 if enabled
          setProvider((prev) => (prev ? prev : gmailConnected ? "gmail" : inbox.ms365 ? "ms365" : "gmail"));
        } catch {}
        // Load samples
        await refreshSamples();
        await loadStatusSummary();
        await Promise.all([loadFollowupSummary(28), loadMarketingRoi()]);
      } catch (e: any) {
        setError(e?.message || "Failed to load AI training info");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSamples() {
    try {
      const s = await apiFetch<SamplesResp>("/internal/ml/samples");
      setSamples(s);
    } catch (e: any) {
      setError(e?.message || "Failed to load samples");
    }
  }

  async function loadStatusSummary() {
    try {
      setStatusLoading(true);
      const summary = await apiFetch<MlStatusSummary>("/ml/status");
      setStatusSummary(summary);
    } catch (e) {
      console.warn("[ai-training] failed to load ML status", e);
    } finally {
      setStatusLoading(false);
    }
  }

  async function loadFollowupSummary(days = 28) {
    try {
      setFollowupLoading(true);
      setFollowupError(null);
      const summary = await apiFetch<FollowupSummaryResponse>(`/followups/summary?days=${days}`);
      setFollowupSummary(summary);
    } catch (e: any) {
      setFollowupError(e?.message || "Failed to load follow-up summary");
    } finally {
      setFollowupLoading(false);
    }
  }

  async function loadMarketingRoi() {
    try {
      setMarketingRoiLoading(true);
      setMarketingRoiError(null);
      const now = new Date();
      const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      setRoiPeriodLabel(
        now.toLocaleString(undefined, {
          month: "short",
          year: "numeric",
        }),
      );
      const rows = await apiFetch<MarketingRoiRow[]>(`/marketing/roi?period=${encodeURIComponent(period)}`);
      setMarketingRoi(rows);
    } catch (e: any) {
      setMarketingRoiError(e?.message || "Failed to load ROI data");
    } finally {
      setMarketingRoiLoading(false);
    }
  }

  async function pollEstimatorStatus(timeoutMs = 60000) {
    const started = Date.now();
    setStatusLoading(true);
    let lastSummary: MlStatusSummary | null = null;
    try {
      while (Date.now() - started < timeoutMs) {
        try {
          const summary = await apiFetch<MlStatusSummary>("/ml/status");
          lastSummary = summary;
          setStatusSummary(summary);
          const estimator = summary?.estimator;
          if (estimator) {
            const hasSamples = (estimator.recentSamples14d ?? 0) > 0;
            const finishedIso = estimator.lastTrainingRun?.finishedAt;
            if (hasSamples && finishedIso) {
              const finished = new Date(finishedIso);
              if (!Number.isNaN(finished.getTime())) {
                const isRecent = Date.now() - finished.getTime() < 10 * 60 * 1000;
                if (isRecent) break;
              }
            }
          }
        } catch (err) {
          console.warn("[ai-training] estimator status poll failed", err);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!lastSummary) {
        await loadStatusSummary();
      }
    } finally {
      setStatusLoading(false);
    }
  }

  async function collectAndTrain() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        method: "POST",
        json: { limit: Math.max(1, Math.min(500, Number(limit || 50))) },
      } as const;

      let response: CollectTrainResponse | null = null;
      if (provider === "gmail") {
        response = await apiFetch<CollectTrainResponse>("/internal/ml/collect-train-save", payload);
      } else if (provider === "ms365") {
        response = await apiFetch<CollectTrainResponse>("/internal/ml/collect-train-save-ms365", payload);
      }

      await refreshSamples();
      await pollEstimatorStatus();
      await Promise.all([loadFollowupSummary(), loadMarketingRoi()]);

      if (response) {
        const savedCount = response.saved ?? 0;
        const datasetCount = response.datasetCount ?? savedCount;
        toast({
          title: "Training started",
          description: `Saved ${savedCount} samples (dataset size ${datasetCount}).`,
        });
        if (response.promoted) {
          toast({
            title: "Estimator model promoted",
            description: "New estimator version is now live for predictions.",
          });
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to collect/train");
    } finally {
      setBusy(false);
    }
  }

  const connectedLabel = useMemo(() => {
    if (provider === "gmail") return gmailConn.connected ? `Connected${gmailConn.address ? `: ${gmailConn.address}` : ""}` : "Not connected";
    return ms365Enabled ? "Enabled in inbox settings" : "Disabled";
  }, [provider, gmailConn.connected, gmailConn.address, ms365Enabled]);

  const variantHighlights = useMemo(() => {
    if (!followupSummary || followupSummary.variants.length === 0) return [];
    const byKey = new Map<string, (typeof followupSummary.variants)[number]>();
    for (const variant of followupSummary.variants) {
      byKey.set(variant.key.toUpperCase(), variant);
    }
    const picks: (typeof followupSummary.variants)[number][] = [];
    const variantA = byKey.get("A");
    const variantB = byKey.get("B");
    if (variantA) picks.push(variantA);
    if (variantB) picks.push(variantB);
    if (picks.length < 2) {
      for (const variant of followupSummary.variants) {
        if (picks.includes(variant)) continue;
        picks.push(variant);
        if (picks.length === 2) break;
      }
    }
    return picks;
  }, [followupSummary]);

  const formatPercent = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return "–";
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return "–";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: value >= 1000 ? 0 : 1,
    }).format(value);
  };

  const formatMetricValue = (metric?: { key: string; value: number | null } | null) => {
    if (!metric || metric.value == null) return "–";
    if (metric.value <= 1) return `${(metric.value * 100).toFixed(1)}%`;
    return metric.value.toFixed(2);
  };

  const pickRunMetric = (model: string, metrics?: Record<string, any> | null) => {
    if (!metrics) return null;
    const lowerModel = (model || "").toLowerCase();
    if (lowerModel.includes("estimator")) {
      const raw = metrics.mape ?? metrics.MAPE ?? metrics.mean_absolute_percentage_error;
      if (raw == null) return null;
      const num = Number(raw);
      return Number.isFinite(num) ? `${(num * 100).toFixed(1)}% MAPE` : null;
    }
    if (lowerModel.includes("classifier")) {
      const raw = metrics.f1 ?? metrics.f1_score ?? metrics.F1;
      if (raw == null) return null;
      const num = Number(raw);
      return Number.isFinite(num) ? `${(num * 100).toFixed(1)}% F1` : null;
    }
    const firstKey = Object.keys(metrics).find((key) => typeof metrics[key] === "number");
    if (!firstKey) return null;
    const value = Number(metrics[firstKey]);
    if (!Number.isFinite(value)) return null;
    const display = value <= 1 ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
    return `${display} ${firstKey}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">AI training</h1>
        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border bg-white/95 px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
          >
            <option value="gmail">Gmail</option>
            <option value="ms365">Microsoft 365</option>
          </select>
          <span className="text-xs text-slate-500">{connectedLabel}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              Follow-ups ({followupSummary?.days ?? 28}d)
            </h2>
            <Button variant="outline" size="sm" onClick={() => loadFollowupSummary()} disabled={followupLoading}>
              {followupLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>
          {followupLoading && !followupSummary ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : followupError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">{followupError}</div>
          ) : followupSummary ? (
            <div className="space-y-4 text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border bg-white/80 p-3">
                  <div className="text-xs text-slate-500">Sent</div>
                  <div className="text-lg font-semibold text-slate-800">{followupSummary.totals.sent}</div>
                </div>
                <div className="rounded-lg border bg-white/80 p-3">
                  <div className="text-xs text-slate-500">Open rate</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {formatPercent(followupSummary.totals.openRate)}
                  </div>
                </div>
                <div className="rounded-lg border bg-white/80 p-3">
                  <div className="text-xs text-slate-500">Reply rate</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {formatPercent(followupSummary.totals.replyRate)}
                  </div>
                </div>
                <div className="rounded-lg border bg-white/80 p-3">
                  <div className="text-xs text-slate-500">Conversion</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {formatPercent(followupSummary.totals.conversionRate)}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-white/70 p-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                  <span>A vs B</span>
                  {followupSummary.winner ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Winner {followupSummary.winner}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {variantHighlights.length === 0 ? (
                    <p className="text-xs text-slate-500">No active variants.</p>
                  ) : (
                    variantHighlights.map((variant) => (
                      <div
                        key={variant.key}
                        className={`rounded-lg border bg-white/80 p-3 ${
                          followupSummary.winner && followupSummary.winner === variant.key
                            ? "border-emerald-400 shadow-sm"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="text-xs font-semibold uppercase text-slate-500">
                          {variant.label || variant.key}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-800">
                          {formatPercent(variant.conversionRate)}
                        </div>
                        <div className="text-xs text-slate-500">Conversion</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {followupSummary.rows.length ? (
                <div className="overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="px-3 py-2 font-medium">Delay</th>
                        <th className="px-3 py-2 font-medium">Sent</th>
                        <th className="px-3 py-2 font-medium">Open %</th>
                        <th className="px-3 py-2 font-medium">Reply %</th>
                        <th className="px-3 py-2 font-medium">Conversion %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {followupSummary.rows.map((row, idx) => (
                        <tr key={`${row.delayDays ?? "none"}-${idx}`} className="border-b last:border-b-0">
                          <td className="px-3 py-2 text-[13px] text-slate-600">
                            {row.delayDays != null ? `${row.delayDays} day${row.delayDays === 1 ? "" : "s"}` : "–"}
                          </td>
                          <td className="px-3 py-2 text-[13px] text-slate-600">{row.sent}</td>
                          <td className="px-3 py-2 text-[13px] text-slate-600">{formatPercent(row.openRate)}</td>
                          <td className="px-3 py-2 text-[13px] text-slate-600">{formatPercent(row.replyRate)}</td>
                          <td className="px-3 py-2 text-[13px] text-slate-600">{formatPercent(row.conversionRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No follow-ups in this window.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No follow-ups yet.</p>
          )}
        </div>
        <div className="rounded-2xl border bg-white/90 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Source ROI ({roiPeriodLabel || "current"})</h2>
            <Button variant="outline" size="sm" onClick={() => loadMarketingRoi()} disabled={marketingRoiLoading}>
              {marketingRoiLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>
          {marketingRoiLoading && !marketingRoi ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : marketingRoiError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">{marketingRoiError}</div>
          ) : marketingRoi && marketingRoi.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Leads</th>
                    <th className="px-3 py-2 font-medium">Wins</th>
                    <th className="px-3 py-2 font-medium">Spend</th>
                    <th className="px-3 py-2 font-medium">Cost / Win</th>
                    <th className="px-3 py-2 font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {marketingRoi.map((row, idx) => {
                    const totalSpend = (row.spend || 0) + (row.followupCost || 0);
                    return (
                      <tr key={`${row.source}-${idx}`} className="border-b last:border-b-0">
                        <td className="px-3 py-2 text-[13px] text-slate-600">{row.source}</td>
                        <td className="px-3 py-2 text-[13px] text-slate-600">{row.leads}</td>
                        <td className="px-3 py-2 text-[13px] text-slate-600">{row.wins}</td>
                        <td className="px-3 py-2 text-[13px] text-slate-600">{formatCurrency(totalSpend)}</td>
                        <td className="px-3 py-2 text-[13px] text-slate-600">{formatCurrency(row.costPerWin)}</td>
                        <td className="px-3 py-2 text-[13px] text-slate-600">{formatPercent(row.roi)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
      ) : (
        <p className="text-sm text-slate-500">No ROI data for this period.</p>
      )}
    </div>
  </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Estimator samples (14d)</h2>
          {statusLoading && !estimatorStatus ? (
            <p className="mt-2 text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="mt-2">
              <div className="text-3xl font-semibold text-slate-800">{estimatorSamples}</div>
              <p className="text-xs text-slate-500">
                Includes supplier &amp; client quotes collected in the last 14 days.
              </p>
            </div>
          )}
        </div>
        <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Estimator confidence</h2>
          {statusLoading && estimatorConfidenceDisplay === undefined ? (
            <p className="mt-2 text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="mt-2">
              <div className="text-3xl font-semibold text-slate-800">
                {estimatorConfidenceDisplay ?? "0%"}
              </div>
              <p className="text-xs text-slate-500">
                {estimatorLastTrainedLabel
                  ? `Last trained ${estimatorLastTrainedLabel}`
                  : "Train the estimator to build confidence."}
              </p>
            </div>
          )}
        </div>
        <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">ML service health</h2>
          {statusLoading && !estimatorStatus ? (
            <p className="mt-2 text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="mt-2">
              <div className={`text-3xl font-semibold ${estimatorHealthTone}`}>{estimatorHealthLabel}</div>
              <p className="text-xs text-slate-500">
                {estimatorProdVersion
                  ? `Production model ${estimatorProdVersion}`
                  : "No production model promoted yet."}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Models in production</h2>
          {!statusSummary || statusLoading ? (
            <p className="mt-2 text-sm text-slate-500">Loading…</p>
          ) : statusSummary.models.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No production models yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {statusSummary.models.slice(0, 3).map((model) => (
                <li key={model.id} className="flex flex-col">
                  <span className="font-medium">{model.model}</span>
                  <span className="text-xs text-slate-500">{model.label}</span>
                  <span className="text-xs text-slate-500">
                    {model.keyMetric?.key
                      ? `${model.keyMetric.key.toUpperCase()}: ${formatMetricValue(model.keyMetric)}`
                      : "Metric pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Recent training runs</h2>
          {!statusSummary || statusLoading ? (
            <p className="mt-2 text-sm text-slate-500">Loading…</p>
          ) : statusSummary.trainingRuns.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No runs logged yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {statusSummary.trainingRuns.slice(0, 3).map((run) => (
                <li key={run.id} className="flex flex-col">
                  <span className="font-medium">{run.model}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(run.createdAt).toLocaleString()} • {run.status}
                  </span>
                  <span className="text-xs text-slate-500">{pickRunMetric(run.model, run.metrics) || "Metrics pending"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Inference activity (last 7d)</h2>
          {!statusSummary || statusLoading ? (
            <p className="mt-2 text-sm text-slate-500">Loading…</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li className="flex items-center justify-between">
                <span>Parsed supplier lines</span>
                <span className="font-medium">{statusSummary.inferenceActivity.parsedSupplierLines}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Estimates generated</span>
                <span className="font-medium">{statusSummary.inferenceActivity.estimates}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Inference events</span>
                <span className="font-medium">{statusSummary.inferenceActivity.inferenceEvents}</span>
              </li>
              <li className="flex items-center justify-between text-xs text-slate-500">
                <span>Average MAPE</span>
                <span className="font-medium text-slate-600">
                  {statusSummary.estimates.averageMape != null
                    ? `${(statusSummary.estimates.averageMape * 100).toFixed(1)}%`
                    : "–"}
                </span>
              </li>
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Collect training samples</h2>
            <p className="text-xs text-slate-500">
              We look for recently sent quote PDFs to help the model learn what a good opportunity looks like.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-28 rounded-xl border bg-white/95 px-3 py-2 text-sm"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value || 50))}
            />
            <Button onClick={collectAndTrain} disabled={busy}>
              {busy ? "Working…" : "Collect + Train"}
            </Button>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Tip: For Microsoft 365, enable it in Settings → Inbox & Integrations. Training collection will be added next.
        </div>
      </section>

      <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Recent training samples</h2>
          <Button variant="outline" onClick={refreshSamples} disabled={busy}>Refresh</Button>
        </div>
        {!samples ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : samples.count === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
            No samples yet. Click Collect + Train to gather data.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-slate-500">
                  <th className="px-3 py-2">Message ID</th>
                  <th className="px-3 py-2">Attachment</th>
                  <th className="px-3 py-2">Quoted At</th>
                  <th className="px-3 py-2">URL</th>
                </tr>
              </thead>
              <tbody>
                {samples.items.map((it) => (
                  <tr key={it.id} className="border-b hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{it.messageId}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{it.attachmentId}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{it.quotedAt ? new Date(it.quotedAt).toLocaleString() : "-"}</td>
                    <td className="px-3 py-2">
                      <Link className="text-blue-600 hover:text-blue-800" href={it.url} target="_blank">
                        open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white/90 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">How learning works</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
          <li>We use model predictions to pre-filter incoming emails and only create leads when confident.</li>
          <li>Your actions teach the model: moving leads to READY_TO_QUOTE or WON marks them as positive; rejecting marks as negative.</li>
          <li>Gmail training can collect sent quote PDFs to improve scoring; Microsoft 365 collection is coming soon.</li>
        </ul>
      </section>
    </div>
  );
}
