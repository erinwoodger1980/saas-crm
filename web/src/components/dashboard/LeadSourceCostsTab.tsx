"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, TrendingUp, DollarSign, Target } from "lucide-react";

type SourceCostRow = {
  id: string;
  source: string;
  month: string;
  spend: number;
  leads: number;
  conversions: number;
  scalable: boolean;
  cpl?: number | null;
  cps?: number | null;
};

type SourceSummary = {
  source: string;
  month: string;
  spend: number;
  leads: number;
  conversions: number;
  cpl: number | null;
  cps: number | null;
};

export function LeadSourceCostsTab() {
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<SourceCostRow[]>([]);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  // Form state
  const [newEntry, setNewEntry] = useState({
    source: "",
    month: "",
    spend: "",
    leads: "",
    conversions: "",
    scalable: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      
      // Load all costs
      const costsData = await apiFetch<SourceCostRow[]>(
        `/source-costs?${params.toString()}`
      );
      setCosts(costsData);
      
      // Load source summaries
      const sourcesData = await apiFetch<SourceSummary[]>("/source-costs/sources");
      setSources(sourcesData);
    } catch (e: any) {
      console.error("Failed to load source costs:", e);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async () => {
    if (!newEntry.source.trim() || !newEntry.month.trim()) {
      alert("Source and month are required");
      return;
    }

    try {
      setSaving(true);
      await apiFetch("/source-costs", {
        method: "POST",
        json: {
          source: newEntry.source.trim(),
          month: newEntry.month.trim(),
          spend: Number(newEntry.spend) || 0,
          leads: Number(newEntry.leads) || 0,
          conversions: Number(newEntry.conversions) || 0,
          scalable: newEntry.scalable,
        },
      });
      
      // Reset form
      setNewEntry({
        source: "",
        month: "",
        spend: "",
        leads: "",
        conversions: "",
        scalable: true,
      });
      
      setShowAddDialog(false);
      await loadData();
    } catch (e: any) {
      console.error("Failed to add entry:", e);
      alert(e?.message || "Failed to add entry");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    
    try {
      await apiFetch(`/source-costs/${id}`, { method: "DELETE" });
      await loadData();
    } catch (e: any) {
      console.error("Failed to delete entry:", e);
      alert(e?.message || "Failed to delete entry");
    }
  };

  const recalculateFromLeads = async () => {
    if (!confirm("Recalculate lead counts from the last 3 months of leads data?")) return;
    
    try {
      await apiFetch("/source-costs/recalc", { method: "POST" });
      await loadData();
    } catch (e: any) {
      console.error("Failed to recalculate:", e);
      alert(e?.message || "Failed to recalculate");
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

  const formatMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
  };

  if (loading) {
    return <div className="p-6">Loading source costs...</div>;
  }

  // Calculate totals
  const totalSpend = costs.reduce((sum, c) => sum + Number(c.spend || 0), 0);
  const totalLeads = costs.reduce((sum, c) => sum + Number(c.leads || 0), 0);
  const totalConversions = costs.reduce((sum, c) => sum + Number(c.conversions || 0), 0);
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCPS = totalConversions > 0 ? totalSpend / totalConversions : 0;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Lead Source Costs</h2>
          <p className="text-sm text-slate-600 mt-1">
            Track marketing spend, lead generation, and ROI by source
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={recalculateFromLeads}>
            Recalculate from Leads
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Source Cost Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Source</label>
                  <Input
                    value={newEntry.source}
                    onChange={(e) => setNewEntry({ ...newEntry, source: e.target.value })}
                    placeholder="Google Ads, Facebook, Referral, etc."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Month (YYYY-MM)</label>
                  <Input
                    type="month"
                    value={newEntry.month}
                    onChange={(e) => setNewEntry({ ...newEntry, month: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Spend (£)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newEntry.spend}
                    onChange={(e) => setNewEntry({ ...newEntry, spend: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Leads</label>
                  <Input
                    type="number"
                    value={newEntry.leads}
                    onChange={(e) => setNewEntry({ ...newEntry, leads: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Conversions</label>
                  <Input
                    type="number"
                    value={newEntry.conversions}
                    onChange={(e) => setNewEntry({ ...newEntry, conversions: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newEntry.scalable}
                    onChange={(e) => setNewEntry({ ...newEntry, scalable: e.target.checked })}
                  />
                  <label className="text-sm">Scalable</label>
                </div>
                <Button className="w-full" onClick={addEntry} disabled={saving}>
                  {saving ? "Saving..." : "Add Entry"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpend)}</div>
            <p className="text-xs text-slate-500 mt-1">All sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-slate-500 mt-1">Generated leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Avg CPL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgCPL)}</div>
            <p className="text-xs text-slate-500 mt-1">Cost per lead</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Avg CPS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgCPS)}</div>
            <p className="text-xs text-slate-500 mt-1">Cost per sale</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter by Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">From</label>
              <Input
                type="month"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">To</label>
              <Input
                type="month"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button onClick={loadData}>Apply</Button>
            <Button
              variant="outline"
              onClick={() => {
                setFromDate("");
                setToDate("");
                loadData();
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sources Summary */}
      {sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sources Overview</CardTitle>
            <p className="text-sm text-slate-600">Latest metrics by source</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                    <th className="px-3 py-2 text-left font-medium">Latest Month</th>
                    <th className="px-3 py-2 text-right font-medium">Spend</th>
                    <th className="px-3 py-2 text-right font-medium">Leads</th>
                    <th className="px-3 py-2 text-right font-medium">Conversions</th>
                    <th className="px-3 py-2 text-right font-medium">CPL</th>
                    <th className="px-3 py-2 text-right font-medium">CPS</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.source} className="border-t">
                      <td className="px-3 py-2 font-medium">{s.source}</td>
                      <td className="px-3 py-2 text-slate-600">{formatMonth(s.month)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(s.spend)}</td>
                      <td className="px-3 py-2 text-right">{s.leads}</td>
                      <td className="px-3 py-2 text-right">{s.conversions}</td>
                      <td className="px-3 py-2 text-right">
                        {s.cpl ? formatCurrency(s.cpl) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.cps ? formatCurrency(s.cps) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Entries */}
      <Card>
        <CardHeader>
          <CardTitle>All Entries</CardTitle>
          <p className="text-sm text-slate-600">Complete history of source costs</p>
        </CardHeader>
        <CardContent>
          {costs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No entries yet. Click "Add Entry" to start tracking.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                    <th className="px-3 py-2 text-left font-medium">Month</th>
                    <th className="px-3 py-2 text-right font-medium">Spend</th>
                    <th className="px-3 py-2 text-right font-medium">Leads</th>
                    <th className="px-3 py-2 text-right font-medium">Conversions</th>
                    <th className="px-3 py-2 text-right font-medium">CPL</th>
                    <th className="px-3 py-2 text-right font-medium">CPS</th>
                    <th className="px-3 py-2 text-center font-medium">Scalable</th>
                    <th className="px-3 py-2 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((cost) => (
                    <tr key={cost.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{cost.source}</td>
                      <td className="px-3 py-2">{formatMonth(cost.month)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(cost.spend)}</td>
                      <td className="px-3 py-2 text-right">{cost.leads}</td>
                      <td className="px-3 py-2 text-right">{cost.conversions}</td>
                      <td className="px-3 py-2 text-right">
                        {cost.cpl ? formatCurrency(cost.cpl) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {cost.cps ? formatCurrency(cost.cps) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {cost.scalable ? "✓" : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEntry(cost.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
