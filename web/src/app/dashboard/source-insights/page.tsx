// web/src/app/(dashboard)/source-insights/page.tsx
"use client";

import { useEffect, useState } from "react";
import Sparkline from "@/components/Sparkline";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

export default function SourceInsightsPage() {
  const [series, setSeries] = useState<{ source: string; points: any[] }[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [budget, setBudget] = useState("1500");
  const [recs, setRecs] = useState<any[] | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/analytics/source-trends?months=6`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setMonths(d.months || []);
        setSeries(d.series || []);
      })
      .catch(() => {});
  }, []);

  async function suggest() {
    const r = await fetch(`${API_BASE}/analytics/budget-suggest`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalBudgetGBP: Number(budget), months: 3 }),
    });
    const j = await r.json();
    setRecs(j.recommendations || []);
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Lead Sources</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {series.map((s) => {
          const cps = s.points.map((p) => (p.cps ?? 0));
          const leads = s.points.map((p) => p.leads || 0);
          return (
            <div key={s.source} className="rounded-xl border bg-white p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{s.source}</div>
                <div className="text-xs text-slate-500">
                  {months.length ? `${months[0]} → ${months[months.length - 1]}` : ""}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Leads (last mo): {leads[leads.length - 1] ?? 0}
                </div>
              </div>
              <div className="text-blue-600">
                <Sparkline values={cps.map((v) => Number(v || 0))} title={`${s.source} CPS`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="text-sm font-medium">Budget Suggestions</div>
        <div className="flex gap-2 items-center">
          <input
            className="w-40 rounded-md border p-2 text-sm"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <button
            onClick={suggest}
            className="rounded-md bg-[rgb(var(--brand))] text-white px-3 py-2 text-sm"
          >
            Suggest allocation
          </button>
        </div>
        {recs && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
    </div>
  );
}
