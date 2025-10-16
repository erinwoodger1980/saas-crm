"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Mail, PoundSterling, Target, Users } from "lucide-react";

/* ----------------------------------------------------------------
   Types
----------------------------------------------------------------- */
type Summary = {
  periodLabel: string;                 // e.g. "Oct 2025 (to date)"
  kpis: {
    salesGBP: number;                  // closed won value this month
    enquiries: number;                 // new enquiries this month
    winRatePct: number;                // % of opps won (this month)
    avgDealGBP: number;                // avg value of won deals
    delta?: {                          // optional trend deltas vs. last period
      salesPct?: number;
      enquiriesPct?: number;
      winRatePct?: number;
      avgDealPct?: number;
    };
  };
  salesDaily: Array<{ day: string; gbp: number }>;
  enquiriesWeekly: Array<{ week: string; count: number }>;
  leadStatusShare: Array<{ name: string; value: number }>;
  recentLeads: Array<{
    id: string;
    createdAt: string;
    contactName: string;
    email?: string | null;
    status: string;                    // NEW / CONTACTED / QUALIFIED / etc.
    summary?: string | null;
  }>;
};

/* ----------------------------------------------------------------
   Demo fallback data (used until API endpoint exists)
----------------------------------------------------------------- */
const DEMO: Summary = {
  periodLabel: "This month (to date)",
  kpis: {
    salesGBP: 32850,
    enquiries: 37,
    winRatePct: 26,
    avgDealGBP: 2350,
    delta: { salesPct: 12, enquiriesPct: -5, winRatePct: 3, avgDealPct: 8 },
  },
  salesDaily: Array.from({ length: 30 }).map((_, i) => ({
    day: `${i + 1}`,
    gbp: Math.max(0, Math.round(600 + 400 * Math.sin(i / 4) + (Math.random() - 0.5) * 300)),
  })),
  enquiriesWeekly: [
    { week: "Wk 1", count: 9 },
    { week: "Wk 2", count: 7 },
    { week: "Wk 3", count: 12 },
    { week: "Wk 4", count: 9 },
  ],
  leadStatusShare: [
    { name: "New", value: 18 },
    { name: "Contacted", value: 7 },
    { name: "Qualified", value: 5 },
    { name: "Quote sent", value: 4 },
    { name: "Won", value: 3 },
  ],
  recentLeads: [
    {
      id: "ld_1",
      createdAt: new Date().toISOString(),
      contactName: "Sophie Chambers",
      email: "sophie@example.com",
      status: "NEW",
      summary: "Built-in wardrobes for master bedroom.",
    },
    {
      id: "ld_2",
      createdAt: new Date(Date.now() - 3600e3 * 5).toISOString(),
      contactName: "Adam Reid",
      email: "adam@reidhomes.co.uk",
      status: "CONTACTED",
      summary: "Bespoke alcove units & shelving.",
    },
    {
      id: "ld_3",
      createdAt: new Date(Date.now() - 3600e3 * 28).toISOString(),
      contactName: "Lily Khan",
      email: "lily.k@example.com",
      status: "QUOTE_SENT",
      summary: "New kitchen fit-out — shaker style.",
    },
  ],
};

const PIE_COLOURS = ["#111827", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB"];

/* ----------------------------------------------------------------
   UI helpers
----------------------------------------------------------------- */
function formatGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}
function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function Trend({ pct }: { pct?: number }) {
  if (pct === undefined || pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 text-xs font-medium",
        up ? "text-emerald-600" : "text-rose-600"
      )}
      title={`${up ? "+" : ""}${pct}% vs last period`}
    >
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

function Card(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={classNames("rounded-2xl border border-gray-200 bg-white shadow-sm p-5", props.className)}>
      {props.children}
    </div>
  );
}

function Kpi(props: { icon: React.ReactNode; label: string; value: string; trendPct?: number }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gray-100 text-gray-900 grid place-items-center">{props.icon}</div>
          <div>
            <div className="text-sm text-gray-500">{props.label}</div>
            <div className="text-xl font-semibold text-gray-900">{props.value}</div>
          </div>
        </div>
        <Trend pct={props.trendPct} />
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------
   Page
----------------------------------------------------------------- */
export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to load real stats from API; fall back to demo data gracefully
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // You can implement this endpoint on the API when ready:
        // GET /metrics/summary -> Summary
        const res = await apiFetch<Summary>("/metrics/summary", { method: "GET" });
        if (!mounted) return;
        setData(res);
      } catch {
        if (!mounted) return;
        setData(DEMO);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const d = data ?? DEMO;

  const salesTotal = useMemo(
    () => d.salesDaily.reduce((sum, x) => sum + (x.gbp || 0), 0),
    [d.salesDaily]
  );

  return (
    <main className="px-6 py-6 md:px-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">{d.periodLabel}</p>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Kpi
          icon={<PoundSterling size={18} />}
          label="Sales (month)"
          value={formatGBP(d.kpis.salesGBP)}
          trendPct={d.kpis.delta?.salesPct}
        />
        <Kpi
          icon={<Mail size={18} />}
          label="Enquiries"
          value={String(d.kpis.enquiries)}
          trendPct={d.kpis.delta?.enquiriesPct}
        />
        <Kpi
          icon={<Target size={18} />}
          label="Win rate"
          value={`${d.kpis.winRatePct}%`}
          trendPct={d.kpis.delta?.winRatePct}
        />
        <Kpi
          icon={<Users size={18} />}
          label="Avg deal size"
          value={formatGBP(d.kpis.avgDealGBP)}
          trendPct={d.kpis.delta?.avgDealPct}
        />
      </section>

      {/* Charts */}
      <section className="mt-6 grid grid-cols-1 2xl:grid-cols-3 gap-5">
        {/* Sales line */}
        <Card className="2xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-gray-900 font-semibold">Daily sales</div>
              <div className="text-sm text-gray-500">Total {formatGBP(salesTotal)} this month</div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.salesDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatGBP(v)} labelFormatter={(l) => `Day ${l}`} />
                <Line type="monotone" dataKey="gbp" stroke="#111827" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Lead status pie */}
        <Card>
          <div className="text-gray-900 font-semibold mb-3">Lead pipeline</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={d.leadStatusShare}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {d.leadStatusShare.map((_, i) => (
                    <Cell key={i} fill={PIE_COLOURS[i % PIE_COLOURS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Enquiries bar + Recent leads */}
      <section className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card>
          <div className="text-gray-900 font-semibold mb-3">Enquiries per week</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.enquiriesWeekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#111827" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-900 font-semibold">Recent enquiries</div>
            <a
              href="/leads"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors underline underline-offset-4"
            >
              View all
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {d.recentLeads.map((l) => (
              <div key={l.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{l.contactName}</div>
                  <div className="text-sm text-gray-500 truncate">{l.email || "—"}</div>
                  {l.summary && <div className="text-sm text-gray-600 mt-1 line-clamp-2">{l.summary}</div>}
                </div>
                <div className="shrink-0 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                  {l.status.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Skeleton overlay */}
      {loading && (
        <div className="fixed inset-0 pointer-events-none bg-white/40 backdrop-blur-sm animate-fade" />
      )}
    </main>
  );
}