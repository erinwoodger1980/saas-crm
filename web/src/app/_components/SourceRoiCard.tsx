"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Row = {
  source: string;
  spend: number;
  leads: number;
  conversions: number;
  cpl: number;
  cps: number;
  roiPct: number;
  scalable: boolean;
};
type Resp = { month: string | null; rows: Row[]; top: string[] };

export default function SourceRoiCard() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const ok = await ensureDemoAuth();
    if (!ok) return;
    const r = await apiFetch<Resp>("/analytics/source-roi");
    setData(r);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const best = useMemo(() => data?.rows?.[0] ? [...data.rows].sort((a,b)=>{
    if (a.scalable !== b.scalable) return a.scalable ? -1 : 1;
    if (a.cps !== b.cps) return a.cps - b.cps;
    return b.roiPct - a.roiPct;
  })[0] : null, [data]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-600">Loading ROI…</div>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-600">Add some entries in Settings → Lead Source Costs to see ROI.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">ROI by Lead Source</div>
          {data.month && (
            <div className="text-xs text-slate-500">
              {new Date(data.month).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      {/* Top pick */}
      {best && (
        <div className="mb-4 rounded-lg border bg-slate-50 p-3">
          <div className="text-xs text-slate-600 mb-1">Recommended to scale</div>
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="text-lg font-semibold">{best.source}</div>
            <span className="text-xs rounded-full px-2 py-0.5 border">
              {best.scalable ? "Scalable" : "Capacity-limited"}
            </span>
            <div className="text-xs text-slate-600">
              CPL £{best.cpl.toFixed(0)} · CPS £{best.cps.toFixed(0)} · ROI {best.roiPct.toFixed(0)}%
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Source</th>
              <th className="py-2">Spend</th>
              <th className="py-2">Leads</th>
              <th className="py-2">Sales</th>
              <th className="py-2">CPL</th>
              <th className="py-2">CPS</th>
              <th className="py-2">ROI</th>
              <th className="py-2">Scale?</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.source} className="border-b last:border-0">
                <td className="py-1">{r.source}</td>
                <td className="py-1">£{r.spend.toFixed(0)}</td>
                <td className="py-1">{r.leads}</td>
                <td className="py-1">{r.conversions}</td>
                <td className="py-1">£{r.cpl.toFixed(0)}</td>
                <td className="py-1">£{r.cps.toFixed(0)}</td>
                <td className="py-1">{r.roiPct.toFixed(0)}%</td>
                <td className="py-1">{r.scalable ? "✅" : "🚫"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        /* small polish */
        table th, table td { padding-right: .5rem; }
      `}</style>
    </div>
  );
}