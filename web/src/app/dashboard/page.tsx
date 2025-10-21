"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import QuestionnaireDemo from "@/components/QuestionnaireDemo";
import SourcePerformanceCard from "./SourcePerformanceCard";

type DashboardData = {
  totalLeads: number;
  monthLeads: number;
  disqualified: number;
  won: number;
  reasonCounts: Record<string, number>;
  ml?: {
    avgPredictedPrice: number | null;
    avgWinProbability: number | null; // 0..1
    sampleSizes: { price: number; win: number };
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const { shortName } = useTenantBrand();

  // --- ML tester state ---
  const [area, setArea] = useState<number>(12);
  const [grade, setGrade] = useState<"Basic" | "Standard" | "Premium">("Standard");
  const [mlLoading, setMlLoading] = useState(false);
  const [mlResult, setMlResult] = useState<{ predicted_price?: number; win_probability?: number; error?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<DashboardData>("/analytics/dashboard");
        setData(res);
      } catch (e: any) {
        console.error("Failed to load dashboard:", e);
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const reasonData = useMemo(
    () => Object.entries(data?.reasonCounts || {}).map(([name, value]) => ({ name, value })),
    [data]
  );

  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#14b8a6", "#f97316"];

  async function runPrediction() {
    setMlLoading(true);
    setMlResult(null);
    try {
      // 1) Try through API proxy (recommended)
      try {
        const res = await apiFetch<{ predicted_price: number; win_probability: number }>("/ml/predict", {
          method: "POST",
          json: { area_m2: area, materials_grade: grade },
        });
        setMlResult(res);
        return;
      } catch {
        // fall back to direct
      }

      // 2) Fallback to direct ML URL if provided
      const ML_URL =
        (typeof process !== "undefined" &&
          (process.env.NEXT_PUBLIC_ML_URL || "")) || "";
      if (!ML_URL) throw new Error("ML service not configured (NEXT_PUBLIC_ML_URL).");

      const res = await fetch(`${ML_URL.replace(/\/$/, "")}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_m2: area, materials_grade: grade }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `ML request failed ${res.status}`);
      setMlResult(json);
    } catch (e: any) {
      setMlResult({ error: e?.message || "Prediction failed" });
    } finally {
      setMlLoading(false);
    }
  }

  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (loading || !data) return <div className="p-6">Loading dashboard…</div>;

  const avgPrice = data.ml?.avgPredictedPrice ?? null;
  const avgWin = data.ml?.avgWinProbability ?? null;
  const nPrice = data.ml?.sampleSizes.price ?? 0;
  const nWin = data.ml?.sampleSizes.win ?? 0;

  return (
    <DeskSurface variant="indigo" innerClassName="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
          title="Quick snapshot of your pipeline plus a live ML prediction tester."
        >
          <span aria-hidden="true">📊</span>
          Insights desk
          {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
        </div>
      </header>

      {/* Top metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric title="Total Leads" value={data.totalLeads} />
        <Metric title="New This Month" value={data.monthLeads} />
        <Metric title="Disqualified" value={data.disqualified} />
        <Metric title="Won" value={data.won} />
        <Metric
          title="Avg Predicted Price"
          value={avgPrice != null ? `£${Math.round(avgPrice).toLocaleString()}` : "—"}
          subtitle={nPrice ? `from ${nPrice} lead${nPrice === 1 ? "" : "s"}` : undefined}
        />
        <Metric
          title="Avg Win Probability"
          value={avgWin != null ? `${Math.round(avgWin * 100)}%` : "—"}
          subtitle={nWin ? `from ${nWin} lead${nWin === 1 ? "" : "s"}` : undefined}
        />
      </div>

      <SourcePerformanceCard />

      {/* Two columns: Pie + ML tester */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Disqualification Reasons</h2>
          {reasonData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={reasonData} dataKey="value" nameKey="name" outerRadius={120} label>
                  {reasonData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">No disqualified leads yet.</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">🔮 Price & Win Probability (ML)</h2>
          <p className="mb-4 text-sm text-slate-600">Try a quick prediction using your trained model.</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Area (m²)</div>
              <input
                type="number"
                min={1}
                className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
                value={area}
                onChange={(e) => setArea(Math.max(1, Number(e.target.value || 1)))}
              />
            </label>

            <label className="block">
              <div className="text-xs text-slate-600 mb-1">Materials grade</div>
              <select
                className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
                value={grade}
                onChange={(e) => setGrade(e.target.value as any)}
              >
                <option>Basic</option>
                <option>Standard</option>
                <option>Premium</option>
              </select>
            </label>

            <div className="flex items-end">
              <Button className="w-full" onClick={runPrediction} disabled={mlLoading}>
                {mlLoading ? "Predicting…" : "Run Prediction"}
              </Button>
            </div>
          </div>

          {/* Result */}
          {mlResult && (
            <div className="mt-4 rounded-lg border bg-slate-50 p-3 text-sm">
              {mlResult.error ? (
                <div className="text-red-600">Error: {mlResult.error}</div>
              ) : (
                <div className="space-y-1">
                  <div>
                    💰 Predicted Price:{" "}
                    <b>£{Number(mlResult.predicted_price ?? 0).toLocaleString()}</b>
                  </div>
                  <div>
                    🎯 Win Probability:{" "}
                    <b>{Math.round(100 * Number(mlResult.win_probability ?? 0))}%</b>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 text-[11px] text-slate-500">
            This calls <code>/ml/predict</code> on your API; if unavailable it falls back to <code>NEXT_PUBLIC_ML_URL</code>.
          </div>
        </Card>
      </div>

      <QuestionnaireDemo />
    </DeskSurface>
  );
}

function Metric({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <Card className="shadow-md border bg-white/90">
      <CardContent className="p-4 text-center">
        <div className="text-xs text-slate-600 mb-1">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
        {subtitle && <div className="mt-1 text-[11px] text-slate-500">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}