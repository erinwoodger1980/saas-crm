"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/analytics/dashboard");
        setData(res);
      } catch (e) {
        console.error("Failed to load dashboard:", e);
      }
    })();
  }, []);

  if (!data) return <div className="p-6">Loading dashboard…</div>;

  const reasonData = Object.entries(data.reasonCounts || {}).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"];

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-4">📊 Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Metric title="Total Leads" value={data.totalLeads} />
        <Metric title="New This Month" value={data.monthLeads} />
        <Metric title="Disqualified" value={data.disqualified} />
        <Metric title="Won" value={data.won} />
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Disqualification Reasons</h2>
        {reasonData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={reasonData} dataKey="value" nameKey="name" outerRadius={120} label>
                {reasonData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-500 text-sm">No disqualified leads yet.</p>
        )}
      </Card>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card className="shadow-md border bg-white/90">
      <CardContent className="p-4 text-center">
        <div className="text-sm text-slate-600 mb-1">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}