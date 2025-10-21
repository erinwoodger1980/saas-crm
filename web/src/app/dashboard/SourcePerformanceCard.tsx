"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SourceRow = {
  source: string;
  month: string;
  budget: number;
  leads: number;
  wins: number;
  conversionRate: number | null;
  costPerLead: number | null;
  costPerAcquisition: number | null;
  scalable: boolean;
};

type ApiResponse = { rows: SourceRow[] };

function formatCurrency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "–";
  return `£${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "–";
  return `${Math.round(value * 100)}%`;
}

export default function SourcePerformanceCard() {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<ApiResponse>("/analytics/source-performance");
      setRows(res.rows ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load source performance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const bestSource = useMemo(() => {
    if (!rows.length) return null;
    const sortable = rows.filter((row) => row.costPerAcquisition != null);
    if (!sortable.length) return null;
    return [...sortable].sort((a, b) => (a.costPerAcquisition ?? Infinity) - (b.costPerAcquisition ?? Infinity))[0];
  }, [rows]);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Source performance</h2>
          <p className="text-xs text-slate-500">Budget, conversion and acquisition cost by lead source.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      ) : loading ? (
        <div className="mt-4 text-sm text-slate-600">Loading source performance…</div>
      ) : rows.length === 0 ? (
        <div className="mt-4 text-sm text-slate-500">Add some entries under Settings → Lead Source Costs to see performance metrics.</div>
      ) : (
        <>
          {bestSource ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <div className="font-semibold">Most efficient right now: {bestSource.source}</div>
              <div>
                {formatPercent(bestSource.conversionRate)} conversion · Cost per acquisition {formatCurrency(bestSource.costPerAcquisition)}
              </div>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Month</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Leads</th>
                  <th className="px-3 py-2 text-right">Won</th>
                  <th className="px-3 py-2 text-right">Conversion</th>
                  <th className="px-3 py-2 text-right">Cost/lead</th>
                  <th className="px-3 py-2 text-right">COA</th>
                  <th className="px-3 py-2 text-center">Scalable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.source}-${row.month}`} className="border-t">
                    <td className="px-3 py-2">{row.source}</td>
                    <td className="px-3 py-2">{new Date(row.month).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.budget)}</td>
                    <td className="px-3 py-2 text-right">{row.leads}</td>
                    <td className="px-3 py-2 text-right">{row.wins}</td>
                    <td className="px-3 py-2 text-right">{formatPercent(row.conversionRate)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.costPerLead)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.costPerAcquisition)}</td>
                    <td className="px-3 py-2 text-center">{row.scalable ? "✅" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
