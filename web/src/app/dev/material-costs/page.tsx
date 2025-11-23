"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Filter } from "lucide-react";

interface MaterialCost {
  material_code?: string;
  material_name?: string;
  supplier_name?: string;
  unit_price?: number;
  previous_unit_price?: number | null;
  price_change_percent?: number | null;
  captured_at?: string;
}

interface TrendItem {
  material_code?: string;
  material_name?: string;
  supplier_name?: string;
  series: number[];
  pct_change: number;
  latest: number;
  first: number;
}

export default function MaterialCostsPage() {
  const [materials, setMaterials] = useState<MaterialCost[]>([]);
  const [recent, setRecent] = useState<MaterialCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterCode, setFilterCode] = useState("");
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<any>("/ml/material-costs/recent");
      if (!r.ok) throw new Error(r.error || "Failed to load material costs");
      setMaterials(r.materials || []);
      setRecent(r.recent || []);
      setCached(r.cached || false);
      const t = await apiFetch<any>("/ml/material-costs/trends");
      if (t.ok) setTrends(t.trends || []);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6" />Material Cost Changes</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            placeholder="Filter supplier"
            value={filterSupplier}
            onChange={e => setFilterSupplier(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <input
            placeholder="Filter code"
            value={filterCode}
            onChange={e => setFilterCode(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
            <input type="checkbox" checked={showOnlyChanged} onChange={e => setShowOnlyChanged(e.target.checked)} />
            Changed only
          </label>
          <Button variant="outline" onClick={load} className="flex items-center gap-1"><Filter className="w-4 h-4" />Refresh</Button>
        </div>
      </div>
      {cached && <div className="text-xs text-muted-foreground">Cached (≤60s)</div>}
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-6">
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-2">Latest per Material</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Supplier</th>
                    <th className="py-2 pr-4">Current £</th>
                    <th className="py-2 pr-4">Prev £</th>
                    <th className="py-2 pr-4">Δ %</th>
                    <th className="py-2 pr-4">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {materials
                    .filter(m => !filterSupplier || (m.supplier_name || '').toLowerCase().includes(filterSupplier.toLowerCase()))
                    .filter(m => !filterCode || (m.material_code || '').toLowerCase().includes(filterCode.toLowerCase()))
                    .filter(m => !showOnlyChanged || (m.price_change_percent != null && Math.abs(m.price_change_percent) > 0))
                    .map(m => {
                    const code = m.material_code || "-";
                    const name = m.material_name || code;
                    return (
                      <tr key={code + m.captured_at} className="border-b last:border-0">
                        <td className="py-1 pr-4 font-mono text-xs">{code}</td>
                        <td className="py-1 pr-4">{name}</td>
                        <td className="py-1 pr-4">{m.supplier_name || '-'}</td>
                        <td className="py-1 pr-4">{m.unit_price?.toFixed(2) ?? '-'}</td>
                        <td className="py-1 pr-4 text-muted-foreground">{m.previous_unit_price?.toFixed(2) ?? '-'}</td>
                        <td className="py-1 pr-4">
                          {m.price_change_percent != null ? (
                            <span className={m.price_change_percent > 0 ? 'text-green-600' : m.price_change_percent < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                              {m.price_change_percent.toFixed(2)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-1 pr-4 whitespace-nowrap">{m.captured_at ? new Date(m.captured_at).toLocaleString() : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-2">Recent Snapshots (latest 100)</h2>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1 pr-3">Code</th>
                    <th className="py-1 pr-3">Name</th>
                    <th className="py-1 pr-3">Supplier</th>
                    <th className="py-1 pr-3">£</th>
                    <th className="py-1 pr-3">Prev £</th>
                    <th className="py-1 pr-3">Δ %</th>
                    <th className="py-1 pr-3">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {recent
                    .filter(m => !filterSupplier || (m.supplier_name || '').toLowerCase().includes(filterSupplier.toLowerCase()))
                    .filter(m => !filterCode || (m.material_code || '').toLowerCase().includes(filterCode.toLowerCase()))
                    .filter(m => !showOnlyChanged || (m.price_change_percent != null && Math.abs(m.price_change_percent) > 0))
                    .map((m,i) => (
                    <tr key={m.material_code + m.captured_at + i} className="border-b last:border-0">
                      <td className="py-1 pr-3 font-mono">{m.material_code || '-'}</td>
                      <td className="py-1 pr-3">{m.material_name || '-'}</td>
                      <td className="py-1 pr-3">{m.supplier_name || '-'}</td>
                      <td className="py-1 pr-3">{m.unit_price?.toFixed(2) ?? '-'}</td>
                      <td className="py-1 pr-3 text-muted-foreground">{m.previous_unit_price?.toFixed(2) ?? '-'}</td>
                      <td className="py-1 pr-3">{m.price_change_percent != null ? m.price_change_percent.toFixed(2) : '-'}</td>
                      <td className="py-1 pr-3 whitespace-nowrap">{m.captured_at ? new Date(m.captured_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-2">Trend Sparkline (last 12 points)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1 pr-3">Code</th>
                    <th className="py-1 pr-3">Name</th>
                    <th className="py-1 pr-3">Supplier</th>
                    <th className="py-1 pr-3">Trend</th>
                    <th className="py-1 pr-3">Latest</th>
                    <th className="py-1 pr-3">Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  {trends
                    .filter(t => !filterSupplier || (t.supplier_name || '').toLowerCase().includes(filterSupplier.toLowerCase()))
                    .filter(t => !filterCode || (t.material_code || '').toLowerCase().includes(filterCode.toLowerCase()))
                    .filter(t => !showOnlyChanged || Math.abs(t.pct_change) > 0)
                    .map(t => {
                      const series = t.series || [];
                      const max = Math.max(...series);
                      const min = Math.min(...series);
                      const points = series.map((v,i) => {
                        const x = (i / Math.max(series.length - 1,1)) * 100;
                        const y = max === min ? 50 : (1 - (v - min)/(max - min)) * 100;
                        return `${x},${y}`;
                      }).join(' ');
                      return (
                        <tr key={t.material_code} className="border-b last:border-0">
                          <td className="py-1 pr-3 font-mono">{t.material_code || '-'}</td>
                          <td className="py-1 pr-3">{t.material_name || '-'}</td>
                          <td className="py-1 pr-3">{t.supplier_name || '-'}</td>
                          <td className="py-1 pr-3">
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-32 h-8">
                              <polyline
                                fill="none"
                                stroke={t.pct_change >= 0 ? '#16a34a' : '#dc2626'}
                                strokeWidth="3"
                                points={points}
                              />
                            </svg>
                          </td>
                          <td className="py-1 pr-3">{t.latest.toFixed(2)}</td>
                          <td className="py-1 pr-3">
                            <span className={t.pct_change > 0 ? 'text-green-600' : t.pct_change < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                              {t.pct_change.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
