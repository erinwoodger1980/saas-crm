// web/src/app/(dashboard)/source-insights/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Sparkline from "@/components/Sparkline";
import { API_BASE, apiFetch, ensureDemoAuth } from "@/lib/api";

type TrendPoint = {
  month: string;   // e.g. "2025-08-01"
  leads?: number;
  cps?: number;    // cost per sale (or your metric)
  cpl?: number;    // cost per lead (optional)
};

type TrendSeries = {
  source: string;
  points: TrendPoint[];
};

type TrendsResponse = {
  months: string[];
  series: TrendSeries[];
};

type BudgetSuggestReq = {
  totalBudgetGBP: number;
  months?: number;
};

type BudgetSuggestRes = {
  recommendations: Array<{
    source: string;
    recommendedGBP: number;
    basis: { cps?: number; cpl?: number };
  }>;
};

export default function SourceInsightsPage() {
  const [series, setSeries] = useState<TrendSeries[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [budget, setBudget] = useState("1500");
  const [recs, setRecs] = useState<BudgetSuggestRes["recommendations"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const ok = await ensureDemoAuth();
        if (!ok) {
          setErr("Not authenticated");
          setLoading(false);
          return;
        }

        // Use apiFetch so Authorization Bearer is attached automatically
        const data = await apiFetch<TrendsResponse>("/analytics/source-trends?months=6");
        setMonths(data.months || []);
        setSeries(data.series || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load trends");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function suggest() {
    setSuggesting(true);
    setErr(null);
    try {
      const payload: BudgetSuggestReq = {
        totalBudgetGBP: Number(budget) || 0,
        months: 3,
      };
      const res = await apiFetch<BudgetSuggestRes>("/analytics/budget-suggest", {
        method: "POST",
        json: payload,
      });
      setRecs(res.recommendations || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch budget suggestions");
      setRecs(null);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lead Sources</h1>
        {/* Tiny proof of API base in case you need to sanity check in the UI */}
        <span className="text-[11px] text-slate-400">API: {API_BASE.replace(/^https?:\/\//, "")}</span>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-600">Loading…</div>
      ) : err ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {err}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {series.map((s) => {
              const cps = s.points.map((p) => Number(p.cps ?? 0));
              const leads = s.points.map((p) => Number(p.leads ?? 0));
              const lastLeads = leads.length ? leads[leads.length - 1] : 0;

              return (
                <div
                  key={s.source}
                  className="flex items-center justify-between rounded-xl border bg-white p-4"
                >
                  <div>
                    <div className="text-sm font-medium">{s.source}</div>
                    <div className="text-xs text-slate-500">
                      {months.length ? `${months[0]} → ${months[months.length - 1]}` : ""}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Leads (last mo): {lastLeads}
                    </div>
                  </div>
                  <div className="text-blue-600">
                    <Sparkline values={cps} title={`${s.source} CPS`} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border bg-white p-4">
            <div className="text-sm font-medium">Budget Suggestions</div>
            <div className="flex items-center gap-2">
              <input
                className="w-40 rounded-md border p-2 text-sm"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                inputMode="numeric"
              />
              <Button
                onClick={suggest}
                disabled={suggesting}
                variant="default"
              >
                {suggesting ? "Suggesting…" : "Suggest Allocation"}
              </Button>
            </div>
            {recs && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recs.map((r) => (
                  <div key={r.source} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{r.source}</div>
                    <div className="text-xs text-slate-600">
                      Recommended: £{Math.round(r.recommendedGBP)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Basis CPS: {r.basis.cps ? `£${Math.round(r.basis.cps)}` : "n/a"} · CPL:{" "}
                      {r.basis.cpl ? `£${Math.round(r.basis.cpl)}` : "n/a"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}