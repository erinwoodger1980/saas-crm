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
  financialYear: {
    current: number;
    yearEnd: string;
    progress: number;
    progressPercent: number;
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showTargetsDialog, setShowTargetsDialog] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFinancialYearDialog, setShowFinancialYearDialog] = useState(false);
  const [savingFinancialYear, setSavingFinancialYear] = useState(false);
  const [financialYearEnd, setFinancialYearEnd] = useState("12-31");
  
  // Import data states
  const [importType, setImportType] = useState<'leads' | 'quotes' | 'sales'>('leads');
  const [importDate, setImportDate] = useState('');
  const [importValue, setImportValue] = useState('');
  const [importSource, setImportSource] = useState('');
  const [importingData, setImportingData] = useState(false);
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
      
      // Set financial year end if available
      if (res.financialYear?.yearEnd) {
        setFinancialYearEnd(res.financialYear.yearEnd);
      }
    } catch (e: any) {
      console.error("Failed to load business metrics:", e);
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const saveTargets = async () => {
    try {
      setSavingTargets(true);
      await apiFetch("/analytics/business/targets", {
        method: "POST",
        json: {
          year: data!.currentYear,
          ...targetForm
        }
      });
      
      // Reload data to show updated targets
      await loadData();
      setShowTargetsDialog(false);
      
    } catch (e: any) {
      console.error("Failed to save targets:", e);
      setErr(e?.message || "Failed to save targets");
    } finally {
      setSavingTargets(false);
    }
  };

  const saveFinancialYear = async () => {
    try {
      setSavingFinancialYear(true);
      await apiFetch("/analytics/business/financial-year", {
        method: "POST",
        json: {
          financialYearEnd: financialYearEnd
        }
      });
      
      // Reload data to show updated financial year
      await loadData();
      setShowFinancialYearDialog(false);
      
    } catch (e: any) {
      console.error("Failed to save financial year:", e);
      setErr(e?.message || "Failed to save financial year");
    } finally {
      setSavingFinancialYear(false);
    }
  };

  const importHistoricalData = async () => {
    try {
      setImportingData(true);
      
      const requestData = {
        data: [{
          date: importDate,
          value: importType === 'leads' ? undefined : Number(importValue),
          count: importType === 'leads' ? Number(importValue) : undefined,
          source: importType === 'leads' ? importSource : undefined
        }],
        type: importType
      };
      
      await apiFetch("/analytics/business/import-historical", {
        method: "POST",
        json: requestData
      });
      
      // Reload data to show updated metrics
      await loadData();
      setShowImportDialog(false);
      
      // Reset form
      setImportDate('');
      setImportValue('');
      setImportSource('');
      
    } catch (e: any) {
      console.error("Failed to import data:", e);
      setErr(e?.message || "Failed to import data");
    } finally {
      setImportingData(false);
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
        
        <div className="flex gap-2">
          <Dialog open={showFinancialYearDialog} onOpenChange={setShowFinancialYearDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Financial Year
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Financial Year Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Financial Year End (MM-DD)</label>
                  <Input
                    value={financialYearEnd}
                    onChange={(e) => setFinancialYearEnd(e.target.value)}
                    placeholder="12-31"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: FY{data.financialYear.current} (ends {data.financialYear.yearEnd}) - {data.financialYear.progressPercent}% complete
                  </p>
                </div>
                <Button 
                  className="w-full" 
                  onClick={saveFinancialYear}
                  disabled={savingFinancialYear}
                >
                  {savingFinancialYear ? "Saving..." : "Save Financial Year"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Import Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Historical Data</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Import historical enquiries, quotes, and sales to backdate your metrics.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Import Type</label>
                    <select 
                      className="w-full border rounded-md p-2"
                      value={importType}
                      onChange={(e) => setImportType(e.target.value as any)}
                    >
                      <option value="leads">Enquiries/Leads</option>
                      <option value="quotes">Quotes</option>
                      <option value="sales">Sales/Won Business</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input 
                      type="date" 
                      className="w-full border rounded-md p-2"
                      value={importDate}
                      onChange={(e) => setImportDate(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {importType === 'leads' ? 'Number of Enquiries' : 
                       importType === 'quotes' ? 'Quote Value (£)' : 'Sale Value (£)'}
                    </label>
                    <input 
                      type="number" 
                      className="w-full border rounded-md p-2"
                      value={importValue}
                      onChange={(e) => setImportValue(e.target.value)}
                      placeholder={importType === 'leads' ? '10' : '5000'}
                    />
                  </div>
                  
                  {importType === 'leads' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Source (optional)</label>
                      <input 
                        type="text" 
                        className="w-full border rounded-md p-2"
                        value={importSource}
                        onChange={(e) => setImportSource(e.target.value)}
                        placeholder="Website, Referral, etc."
                      />
                    </div>
                  )}
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={importHistoricalData}
                  disabled={importingData || !importDate || !importValue}
                >
                  {importingData ? "Importing..." : "Import Historical Data"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
              <Button className="w-full" onClick={saveTargets} disabled={savingTargets}>
                {savingTargets ? "Saving..." : "Save Targets"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
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
            <CardTitle className="text-lg">Financial Year to Date (FY{data.financialYear.current})</CardTitle>
            <p className="text-sm text-gray-500">
              Year ending {data.financialYear.yearEnd} • {data.financialYear.progressPercent}% complete
            </p>
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
          <CardTitle className="text-lg">Annual Targets vs Actuals (FY{data.financialYear.current})</CardTitle>
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