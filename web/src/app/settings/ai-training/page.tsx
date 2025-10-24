"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [moduleId, setModuleId] = useState<typeof MODULES[number]["id"]>("lead_classifier");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [params, setParams] = useState<ParamRow[]>([]);
  const [threshold, setThreshold] = useState<number>(0.6);
  const [saving, setSaving] = useState(false);

  const isEA = !!user?.isEarlyAdopter;

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await apiFetch<InsightsResponse>(`/ml/insights?module=${moduleId}&limit=50`);
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
  }, [moduleId]);

  const avgConf = useMemo(() => {
    const xs = insights.map((i) => i.confidence).filter((x): x is number => typeof x === "number");
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }, [insights]);

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
          <p className="mb-3 text-sm font-medium text-slate-700">Recent decisions</p>
          <div className="max-h-[420px] space-y-2 overflow-auto pr-2">
            {loading && <div className="text-sm text-slate-500">Loading…</div>}
            {!loading && insights.length === 0 && (
              <div className="text-sm text-slate-500">No insights yet.</div>
            )}
            {insights.map((i) => (
              <div key={i.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-800">{i.decision || "—"}</div>
                  <div className="text-xs text-slate-500">{formatDate(i.createdAt)}</div>
                </div>
                <div className="mt-1 text-xs text-slate-600">{i.inputSummary || "(no summary)"}</div>
                {typeof i.confidence === "number" && (
                  <div className="mt-1 text-xs text-slate-500">Confidence: {(i.confidence * 100).toFixed(0)}%</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
