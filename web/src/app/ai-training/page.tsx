"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

  async function collectAndTrain() {
    setBusy(true);
    setError(null);
    try {
      if (provider === "gmail") {
        const r = await apiFetch<any>("/internal/ml/collect-train-save", {
          method: "POST",
          json: { limit: Math.max(1, Math.min(500, Number(limit || 50))) },
        });
        await refreshSamples();
        await loadStatusSummary();
        alert(`Collected ${r.collected} attachments, saved ${r.saved}. ML: ${r?.ml?.status || "ok"}`);
      } else if (provider === "ms365") {
        const r = await apiFetch<any>("/internal/ml/collect-train-save-ms365", {
          method: "POST",
          json: { limit: Math.max(1, Math.min(500, Number(limit || 50))) },
        });
        await refreshSamples();
        await loadStatusSummary();
        alert(`Collected ${r.collected} attachments, saved ${r.saved}. ML: ${r?.ml?.status || "ok"}`);
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
