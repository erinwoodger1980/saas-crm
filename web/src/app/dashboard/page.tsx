"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
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
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const { shortName } = useTenantBrand();

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

  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (loading || !data) return <div className="p-6">Loading dashboard…</div>;

  return (
    <DeskSurface variant="indigo" innerClassName="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
          title="Quick snapshot of your pipeline."
        >
          <span aria-hidden="true">📊</span>
          Insights desk
          {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
        </div>
      </header>

      {/* Top metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Total Leads" value={data.totalLeads} />
        <Metric title="New This Month" value={data.monthLeads} />
        <Metric title="Disqualified" value={data.disqualified} />
        <Metric title="Won" value={data.won} />
      </div>

      <SourcePerformanceCard />

      {/* Disqualification reasons chart */}
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