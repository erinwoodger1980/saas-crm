"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

type MonthlyData = {
  year: number;
  month: number;
  monthName: string;
  enquiries: number;
  quotesCount: number;
  quotesValue: number;
  salesCount: number;
  salesValue: number;
  conversionRate: number;
  sourceConversions: Record<string, { leads: number; wins: number; rate: number }>;
};

type BusinessMetrics = {
  monthlyData: MonthlyData[];
  yearToDate: {
    enquiries: number;
    quotesCount: number;
    quotesValue: number;
    salesCount: number;
    salesValue: number;
    conversionRate: number;
  };
  targets: {
    enquiriesTarget: number;
    quotesValueTarget: number;
    quotesCountTarget: number;
    salesValueTarget: number;
    salesCountTarget: number;
    ytdEnquiriesTarget: number;
    ytdQuotesValueTarget: number;
    ytdQuotesCountTarget: number;
    ytdSalesValueTarget: number;
    ytdSalesCountTarget: number;
  };
  sourceAnalysis: Record<string, {
    totalSpend: number;
    totalLeads: number;
    totalWins: number;
    costPerLead: number;
    costPerSale: number;
  }>;
  currentYear: number;
  currentMonth: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showTargetsDialog, setShowTargetsDialog] = useState(false);
  const [targetForm, setTargetForm] = useState({
    enquiriesTarget: 120,
    quotesValueTarget: 120000,
    quotesCountTarget: 48,
    salesValueTarget: 60000,
    salesCountTarget: 24,
  });
  const { shortName } = useTenantBrand();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<BusinessMetrics>("/analytics/business/business-metrics");
      setData(res);
      setTargetForm({
        enquiriesTarget: res.targets.enquiriesTarget,
        quotesValueTarget: res.targets.quotesValueTarget,
        quotesCountTarget: res.targets.quotesCountTarget,
        salesValueTarget: res.targets.salesValueTarget,
        salesCountTarget: res.targets.salesCountTarget,
      });
    } catch (e: any) {
      console.error("Failed to load business metrics:", e);
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return (value * 100).toFixed(1) + '%';
  };

  const currentMonth = useMemo(() => {
    if (!data?.monthlyData.length) return null;
    return data.monthlyData[data.monthlyData.length - 1];
  }, [data]);

  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (loading || !data) return <div className="p-6">Loading dashboard…</div>;

  return (
    <DeskSurface variant="indigo" innerClassName="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-500 shadow-sm"
          title="Business performance metrics and targets."
        >
          <span aria-hidden="true">📊</span>
          Business Analytics
          {shortName && <span className="hidden sm:inline text-slate-400">· {shortName}</span>}
        </div>
        
        <Dialog open={showTargetsDialog} onOpenChange={setShowTargetsDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Set Targets
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Annual Targets for {data.currentYear}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Enquiries Target (annual)</label>
                <Input
                  type="number"
                  value={targetForm.enquiriesTarget}
                  onChange={(e) => setTargetForm({...targetForm, enquiriesTarget: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Quotes Value Target (annual)</label>
                <Input
                  type="number"
                  value={targetForm.quotesValueTarget}
                  onChange={(e) => setTargetForm({...targetForm, quotesValueTarget: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Quotes Count Target (annual)</label>
                <Input
                  type="number"
                  value={targetForm.quotesCountTarget}
                  onChange={(e) => setTargetForm({...targetForm, quotesCountTarget: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Sales Value Target (annual)</label>
                <Input
                  type="number"
                  value={targetForm.salesValueTarget}
                  onChange={(e) => setTargetForm({...targetForm, salesValueTarget: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Sales Count Target (annual)</label>
                <Input
                  type="number"
                  value={targetForm.salesCountTarget}
                  onChange={(e) => setTargetForm({...targetForm, salesCountTarget: Number(e.target.value)})}
                />
              </div>
              <Button className="w-full" disabled>
                Save Targets (Coming Soon)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Current Month vs Year-to-Date Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">This Month ({currentMonth?.monthName})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricItem 
                title="Enquiries" 
                value={currentMonth?.enquiries || 0}
                subtitle="new leads"
              />
              <MetricItem 
                title="Quotes Sent" 
                value={currentMonth?.quotesCount || 0}
                subtitle={formatCurrency(currentMonth?.quotesValue || 0)}
              />
              <MetricItem 
                title="Sales Won" 
                value={currentMonth?.salesCount || 0}
                subtitle={formatCurrency(currentMonth?.salesValue || 0)}
              />
              <MetricItem 
                title="Conversion Rate" 
                value={formatPercent(currentMonth?.conversionRate || 0)}
                subtitle="enquiry to sale"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Year to Date ({data.currentYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricItem 
                title="Enquiries" 
                value={data.yearToDate.enquiries}
                subtitle={`Target: ${data.targets.ytdEnquiriesTarget}`}
                isOnTrack={data.yearToDate.enquiries >= data.targets.ytdEnquiriesTarget}
              />
              <MetricItem 
                title="Quotes Sent" 
                value={data.yearToDate.quotesCount}
                subtitle={`Target: ${data.targets.ytdQuotesCountTarget} | ${formatCurrency(data.yearToDate.quotesValue)}`}
                isOnTrack={data.yearToDate.quotesCount >= data.targets.ytdQuotesCountTarget}
              />
              <MetricItem 
                title="Sales Won" 
                value={data.yearToDate.salesCount}
                subtitle={`Target: ${data.targets.ytdSalesCountTarget} | ${formatCurrency(data.yearToDate.salesValue)}`}
                isOnTrack={data.yearToDate.salesCount >= data.targets.ytdSalesCountTarget}
              />
              <MetricItem 
                title="Conversion Rate" 
                value={formatPercent(data.yearToDate.conversionRate)}
                subtitle="enquiry to sale"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Annual Targets vs Actuals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Annual Targets vs Actuals ({data.currentYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <TargetVsActual
              title="Enquiries"
              target={data.targets.enquiriesTarget}
              actual={data.yearToDate.enquiries}
              ytdTarget={data.targets.ytdEnquiriesTarget}
            />
            <TargetVsActual
              title="Quotes Value"
              target={data.targets.quotesValueTarget}
              actual={data.yearToDate.quotesValue}
              ytdTarget={data.targets.ytdQuotesValueTarget}
              isCurrency
            />
            <TargetVsActual
              title="Quotes Count"
              target={data.targets.quotesCountTarget}
              actual={data.yearToDate.quotesCount}
              ytdTarget={data.targets.ytdQuotesCountTarget}
            />
            <TargetVsActual
              title="Sales Value"
              target={data.targets.salesValueTarget}
              actual={data.yearToDate.salesValue}
              ytdTarget={data.targets.ytdSalesValueTarget}
              isCurrency
            />
            <TargetVsActual
              title="Sales Count"
              target={data.targets.salesCountTarget}
              actual={data.yearToDate.salesCount}
              ytdTarget={data.targets.ytdSalesCountTarget}
            />
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">12-Month Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthName" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="enquiries" stroke="#3b82f6" name="Enquiries" />
              <Line type="monotone" dataKey="quotesCount" stroke="#10b981" name="Quotes Sent" />
              <Line type="monotone" dataKey="salesCount" stroke="#f59e0b" name="Sales Won" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Source Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lead Source Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(data.sourceAnalysis).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-right">Total Spend</th>
                    <th className="px-3 py-2 text-right">Total Leads</th>
                    <th className="px-3 py-2 text-right">Total Wins</th>
                    <th className="px-3 py-2 text-right">Conversion Rate</th>
                    <th className="px-3 py-2 text-right">Cost per Lead (COL)</th>
                    <th className="px-3 py-2 text-right">Cost per Sale (COS)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.sourceAnalysis).map(([source, metrics]) => (
                    <tr key={source} className="border-t">
                      <td className="px-3 py-2 font-medium">{source}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(metrics.totalSpend)}</td>
                      <td className="px-3 py-2 text-right">{metrics.totalLeads}</td>
                      <td className="px-3 py-2 text-right">{metrics.totalWins}</td>
                      <td className="px-3 py-2 text-right">
                        {metrics.totalLeads > 0 ? formatPercent(metrics.totalWins / metrics.totalLeads) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(metrics.costPerLead)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(metrics.costPerSale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Add lead source costs in Settings to see cost analysis.
            </p>
          )}
        </CardContent>
      </Card>
    </DeskSurface>
  );
}

function MetricItem({
  title,
  value,
  subtitle,
  isOnTrack,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  isOnTrack?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-xs text-slate-600 mb-1">{title}</div>
      <div className={`text-xl font-semibold ${isOnTrack === false ? 'text-red-600' : isOnTrack ? 'text-green-600' : ''}`}>
        {value}
      </div>
      {subtitle && (
        <div className="mt-1 text-[11px] text-slate-500">{subtitle}</div>
      )}
    </div>
  );
}

function TargetVsActual({
  title,
  target,
  actual,
  ytdTarget,
  isCurrency = false,
}: {
  title: string;
  target: number;
  actual: number;
  ytdTarget: number;
  isCurrency?: boolean;
}) {
  const percentage = ytdTarget > 0 ? (actual / ytdTarget) * 100 : 0;
  const isOnTrack = percentage >= 80; // Consider on track if at 80% or above
  
  const formatValue = (value: number) => {
    return isCurrency ? formatCurrency(value) : value.toLocaleString();
  };

  return (
    <div className="text-center space-y-2">
      <div className="text-xs font-medium text-slate-600">{title}</div>
      <div className="space-y-1">
        <div className="text-lg font-semibold">{formatValue(actual)}</div>
        <div className="text-xs text-slate-500">of {formatValue(target)}</div>
        <div className={`text-xs font-medium ${isOnTrack ? 'text-green-600' : 'text-amber-600'}`}>
          {percentage.toFixed(0)}% YTD
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full ${isOnTrack ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}