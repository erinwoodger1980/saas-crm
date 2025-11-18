"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeskSurface } from "@/components/DeskSurface";
import { useTenantBrand } from "@/lib/use-tenant-brand";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Line,
  ComposedChart,
  Area
} from "recharts";
import { Target, Calendar, DollarSign, Users, Award, ArrowUp, ArrowDown } from "lucide-react";
import { LeadSourceCostsTab } from "@/components/dashboard/LeadSourceCostsTab";

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
  monthlyDataTwoYear: MonthlyData[];
  yearToDate: {
    enquiries: number;
    quotesCount: number;
    quotesValue: number;
    salesCount: number;
    salesValue: number;
    conversionRate: number;
  };
  previousYear: {
    enquiries: number;
    quotesCount: number;
    quotesValue: number;
    salesCount: number;
    salesValue: number;
    conversionRate: number;
  };
  yoyChanges: {
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
  const [activeTab, setActiveTab] = useState<"overview" | "source-costs">("overview");
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
                    Current: FY{data?.financialYear.current} (ends {data?.financialYear.yearEnd}) - {data?.financialYear.progressPercent}% complete
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
              <DialogTitle>Set Annual Targets for {data?.currentYear}</DialogTitle>
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

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl bg-white/80 p-1 border border-indigo-200/70 shadow-sm">
        <Button
          variant={activeTab === "overview" ? "default" : "ghost"}
          onClick={() => setActiveTab("overview")}
          className="flex-1"
        >
          📊 Overview
        </Button>
        <Button
          variant={activeTab === "source-costs" ? "default" : "ghost"}
          onClick={() => setActiveTab("source-costs")}
          className="flex-1"
        >
          💰 Lead Source Costs
        </Button>
      </div>

      {/* Tab Content - Overview */}
      {activeTab === "overview" && loading && <div className="p-6">Loading dashboard…</div>}
      {activeTab === "overview" && !loading && data && (
        <>
      {/* Year-over-Year Key Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <YoYMetricCard
          title="Enquiries"
          current={data.yearToDate.enquiries}
          previous={data.previousYear.enquiries}
          change={data.yoyChanges.enquiries}
          target={data.targets.ytdEnquiriesTarget}
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
        <YoYMetricCard
          title="Quotes Value"
          current={data.yearToDate.quotesValue}
          previous={data.previousYear.quotesValue}
          change={data.yoyChanges.quotesValue}
          target={data.targets.ytdQuotesValueTarget}
          icon={<DollarSign className="h-5 w-5" />}
          color="green"
          isCurrency
        />
        <YoYMetricCard
          title="Sales Won"
          current={data.yearToDate.salesCount}
          previous={data.previousYear.salesCount}
          change={data.yoyChanges.salesCount}
          target={data.targets.ytdSalesCountTarget}
          icon={<Award className="h-5 w-5" />}
          color="purple"
        />
        <YoYMetricCard
          title="Conversion Rate"
          current={data.yearToDate.conversionRate * 100}
          previous={data.previousYear.conversionRate * 100}
          change={data.yoyChanges.conversionRate}
          target={undefined}
          icon={<Target className="h-5 w-5" />}
          color="orange"
          isPercentage
        />
      </div>

      {/* Visual Progress Indicators */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Financial Year Progress
            </CardTitle>
            <p className="text-sm text-slate-600">
              FY{data.financialYear.current} • Ending {data.financialYear.yearEnd}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative">
              <div className="flex justify-between text-sm mb-2">
                <span>Year Progress</span>
                <span className="font-semibold">{data.financialYear.progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${data.financialYear.progressPercent}%` }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <ProgressIndicator
                label="Enquiries"
                current={data.yearToDate.enquiries}
                target={data.targets.ytdEnquiriesTarget}
                color="blue"
              />
              <ProgressIndicator
                label="Sales Count"
                current={data.yearToDate.salesCount}
                target={data.targets.ytdSalesCountTarget}
                color="green"
              />
              <ProgressIndicator
                label="Sales Value"
                current={data.yearToDate.salesValue}
                target={data.targets.ytdSalesValueTarget}
                color="purple"
                isCurrency
              />
              <ProgressIndicator
                label="Quotes Count"
                current={data.yearToDate.quotesCount}
                target={data.targets.ytdQuotesCountTarget}
                color="orange"
              />
            </div>
          </CardContent>
        </Card>

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
      </div>

      {/* Visual Annual Targets Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Annual Targets vs Actuals (FY{data.financialYear.current})
          </CardTitle>
          <p className="text-sm text-slate-600">
            Track your progress against annual goals
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <TargetVsActualCard
              title="Enquiries"
              current={data.yearToDate.enquiries}
              target={data.targets.enquiriesTarget}
              ytdTarget={data.targets.ytdEnquiriesTarget}
              icon="👥"
              color="blue"
            />
            <TargetVsActualCard
              title="Quotes Value"
              current={data.yearToDate.quotesValue}
              target={data.targets.quotesValueTarget}
              ytdTarget={data.targets.ytdQuotesValueTarget}
              icon="💰"
              color="green"
              isCurrency
            />
            <TargetVsActualCard
              title="Quotes Count"
              current={data.yearToDate.quotesCount}
              target={data.targets.quotesCountTarget}
              ytdTarget={data.targets.ytdQuotesCountTarget}
              icon="📋"
              color="purple"
            />
            <TargetVsActualCard
              title="Sales Value"
              current={data.yearToDate.salesValue}
              target={data.targets.salesValueTarget}
              ytdTarget={data.targets.ytdSalesValueTarget}
              icon="🎯"
              color="orange"
              isCurrency
            />
            <TargetVsActualCard
              title="Sales Count"
              current={data.yearToDate.salesCount}
              target={data.targets.salesCountTarget}
              ytdTarget={data.targets.ytdSalesCountTarget}
              icon="🏆"
              color="indigo"
            />
            <div className="flex items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg">
              <div className="text-center">
                <Calendar className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <div className="text-sm font-medium text-slate-600">Financial Year</div>
                <div className="text-xs text-slate-500">
                  {data.financialYear.progressPercent}% Complete
                </div>
                <div className="mt-2 w-16 bg-slate-200 rounded-full h-2 mx-auto">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                    style={{ width: `${data.financialYear.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced 24-Month Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            24-Month Trends Comparison
          </CardTitle>
          <p className="text-sm text-slate-600">Current vs Previous Year</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={data.monthlyDataTwoYear}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="monthName" 
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="enquiries" fill="#3b82f6" fillOpacity={0.3} stroke="#3b82f6" name="Enquiries" />
              <Line type="monotone" dataKey="quotesCount" stroke="#10b981" strokeWidth={2} name="Quotes Sent" />
              <Line type="monotone" dataKey="salesCount" stroke="#f59e0b" strokeWidth={2} name="Sales Won" />
            </ComposedChart>
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
      </>
      )}

      {/* Tab Content - Lead Source Costs */}
      {activeTab === "source-costs" && <LeadSourceCostsTab />}
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

function _TargetVsActual({
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

function YoYMetricCard({
  title,
  current,
  previous,
  change,
  target,
  icon,
  color,
  isCurrency = false,
  isPercentage = false,
}: {
  title: string;
  current: number;
  previous: number;
  change: number;
  target?: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "orange";
  isCurrency?: boolean;
  isPercentage?: boolean;
}) {
  const formatValue = (value: number) => {
    if (isCurrency) return formatCurrency(value);
    if (isPercentage) return `${value.toFixed(1)}%`;
    return value.toLocaleString();
  };

  const colorClasses = {
    blue: "from-blue-500 to-blue-600 text-blue-600",
    green: "from-green-500 to-green-600 text-green-600", 
    purple: "from-purple-500 to-purple-600 text-purple-600",
    orange: "from-orange-500 to-orange-600 text-orange-600"
  };

  const isPositiveChange = change >= 0;
  const targetProgress = target ? (current / target) * 100 : 100;

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colorClasses[color].split(' ').slice(0, 2).join(' ')}`} />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg bg-gradient-to-r ${colorClasses[color].split(' ').slice(0, 2).join(' ')} text-white`}>
            {icon}
          </div>
          <div className={`flex items-center gap-1 text-sm ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
            {isPositiveChange ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        </div>
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="text-2xl font-bold">{formatValue(current)}</div>
          <div className="text-sm text-slate-500">
            vs {formatValue(previous)} last year
          </div>
          {target && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Target progress</span>
                <span className="font-medium">{targetProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full bg-gradient-to-r ${colorClasses[color].split(' ').slice(0, 2).join(' ')}`}
                  style={{ width: `${Math.min(targetProgress, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressIndicator({
  label,
  current,
  target,
  color,
  isCurrency = false,
}: {
  label: string;
  current: number;
  target: number;
  color: "blue" | "green" | "purple" | "orange";
  isCurrency?: boolean;
}) {
  const progress = target > 0 ? (current / target) * 100 : 0;
  const isOnTrack = progress >= 80;

  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500", 
    purple: "bg-purple-500",
    orange: "bg-orange-500"
  };

  const formatValue = (value: number) => {
    return isCurrency ? formatCurrency(value) : value.toLocaleString();
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`text-xs ${isOnTrack ? 'text-green-600' : 'text-amber-600'}`}>
          {progress.toFixed(0)}%
        </span>
      </div>
      <div className="text-lg font-semibold">{formatValue(current)}</div>
      <div className="text-xs text-slate-500">Target: {formatValue(target)}</div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

function TargetVsActualCard({
  title,
  current,
  target,
  ytdTarget,
  icon,
  color,
  isCurrency = false,
}: {
  title: string;
  current: number;
  target: number;
  ytdTarget: number;
  icon: string;
  color: "blue" | "green" | "purple" | "orange" | "indigo";
  isCurrency?: boolean;
}) {
  const progress = ytdTarget > 0 ? (current / ytdTarget) * 100 : 0;
  const isOnTrack = progress >= 80;
  const annualProgress = target > 0 ? (current / target) * 100 : 0;

  const colorClasses = {
    blue: "from-blue-500 to-blue-600 bg-blue-500",
    green: "from-green-500 to-green-600 bg-green-500", 
    purple: "from-purple-500 to-purple-600 bg-purple-500",
    orange: "from-orange-500 to-orange-600 bg-orange-500",
    indigo: "from-indigo-500 to-indigo-600 bg-indigo-500"
  };

  const formatValue = (value: number) => {
    return isCurrency ? formatCurrency(value) : value.toLocaleString();
  };

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colorClasses[color].split(' ').slice(0, 2).join(' ')}`} />
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{icon}</div>
          <div>
            <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
            <div className="text-xl font-bold">{formatValue(current)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>YTD Target Progress</span>
            <span className={`font-medium ${isOnTrack ? 'text-green-600' : 'text-amber-600'}`}>
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${colorClasses[color].split(' ')[2]}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">
            {formatValue(current)} of {formatValue(ytdTarget)} YTD target
          </div>
        </div>
        
        <div className="pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 mb-1">Annual target: {formatValue(target)}</div>
          <div className="text-xs font-medium">
            {annualProgress.toFixed(1)}% of annual goal
          </div>
        </div>
      </CardContent>
    </Card>
  );
}