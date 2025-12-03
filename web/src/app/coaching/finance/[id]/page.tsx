"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Plus, TrendingUp, Sparkles, Target, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface MonthlyPnl {
  id: string;
  month: number;
  revenue: number;
  labourCost: number;
  materialCost: number;
  marketingCost: number;
  overheads: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

interface FinancialYear {
  id: string;
  year: number;
  totalRevenue: number;
  totalGrossProfit: number;
  totalNetProfit: number;
  avgGrossMargin: number;
  avgNetMargin: number;
  monthlyPnl: MonthlyPnl[];
}

interface FinancialTarget {
  id: string;
  horizon: "ONE_YEAR" | "FIVE_YEAR";
  targetRevenue: number;
  targetGrossMargin: number;
  targetNetMargin: number;
}

interface FinancialPlan {
  id: string;
  title: string;
  createdAt: string;
  financialYears: FinancialYear[];
  targets: FinancialTarget[];
}

interface AIImprovement {
  focusArea: string;
  currentValue: string;
  recommendation: string;
  potentialImpact: string;
  priority: string;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function FinancePlanPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ yearId: string; month: number; field: string } | null>(null);
  const [cellValue, setCellValue] = useState("");
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [targetHorizon, setTargetHorizon] = useState<"ONE_YEAR" | "FIVE_YEAR">("ONE_YEAR");
  const [targetRevenue, setTargetRevenue] = useState("");
  const [targetGrossMargin, setTargetGrossMargin] = useState("");
  const [targetNetMargin, setTargetNetMargin] = useState("");
  const [aiImprovements, setAiImprovements] = useState<AIImprovement[]>([]);
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => {
    if (planId) {
      loadPlan();
    }
  }, [planId]);

  const loadPlan = async () => {
    try {
      const data = await apiFetch<FinancialPlan>(`/coaching/financial-plans/${planId}`);
      setPlan(data);
    } catch (error) {
      console.error("Failed to load financial plan:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (yearId: string, month: number, field: string, currentValue: number) => {
    setEditingCell({ yearId, month, field });
    setCellValue(currentValue.toString());
  };

  const handleCellSave = async () => {
    if (!editingCell) return;

    const pnl = plan?.financialYears
      .find((y) => y.id === editingCell.yearId)
      ?.monthlyPnl.find((m) => m.month === editingCell.month);

    if (!pnl) return;

    try {
      await apiFetch(`/coaching/monthly-pnl/${pnl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [editingCell.field]: parseFloat(cellValue) || 0 }),
      });
      
      await loadPlan();
      setEditingCell(null);
    } catch (error) {
      console.error("Failed to update P&L:", error);
    }
  };

  const handleSetTarget = async () => {
    if (!plan) return;

    try {
      await apiFetch(`/coaching/financial-plans/${plan.id}/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horizon: targetHorizon,
          targetRevenue: parseFloat(targetRevenue) || 0,
          targetGrossMargin: parseFloat(targetGrossMargin) || 0,
          targetNetMargin: parseFloat(targetNetMargin) || 0,
        }),
      });
      
      setShowTargetDialog(false);
      setTargetRevenue("");
      setTargetGrossMargin("");
      setTargetNetMargin("");
      await loadPlan();
    } catch (error) {
      console.error("Failed to set target:", error);
      alert("Failed to save target");
    }
  };

  const handleGetAIImprovements = async () => {
    if (!plan) return;

    try {
      setGeneratingAI(true);
      const data = await apiFetch<{ improvements: AIImprovement[] }>(
        `/coaching/financial-plans/${plan.id}/suggest-improvements`,
        { method: "POST" }
      );
      setAiImprovements(data.improvements || []);
    } catch (error) {
      console.error("Failed to get AI improvements:", error);
      alert("Failed to generate AI suggestions");
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="container mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Plan Not Found</CardTitle>
            <CardDescription>The requested financial plan could not be loaded</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/coaching/finance">
              <Button>Back to Financial Plans</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const oneYearTarget = plan.targets.find((t) => t.horizon === "ONE_YEAR");
  const fiveYearTarget = plan.targets.find((t) => t.horizon === "FIVE_YEAR");
  const currentYear = plan.financialYears[0];

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/coaching/finance">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{plan.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Financial planning and P&L tracking
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTargetDialog(true)}>
            <Target className="mr-2 h-4 w-4" />
            Set Targets
          </Button>
          <Button onClick={handleGetAIImprovements} disabled={generatingAI}>
            {generatingAI ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Get AI Improvements
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Targets Summary */}
      {(oneYearTarget || fiveYearTarget) && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {oneYearTarget && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">1-Year Targets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Revenue</span>
                  <span className="font-semibold">${oneYearTarget.targetRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Margin</span>
                  <span className="font-semibold">{oneYearTarget.targetGrossMargin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Net Margin</span>
                  <span className="font-semibold">{oneYearTarget.targetNetMargin.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          )}
          {fiveYearTarget && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">5-Year Targets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Revenue</span>
                  <span className="font-semibold">${fiveYearTarget.targetRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Margin</span>
                  <span className="font-semibold">{fiveYearTarget.targetGrossMargin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Net Margin</span>
                  <span className="font-semibold">{fiveYearTarget.targetNetMargin.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* AI Improvements */}
      {aiImprovements.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <CardTitle>AI-Powered Improvement Suggestions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {aiImprovements.map((improvement, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900">{improvement.focusArea}</h4>
                    <Badge
                      variant={
                        improvement.priority === "High"
                          ? "destructive"
                          : improvement.priority === "Medium"
                          ? "default"
                          : "outline"
                      }
                    >
                      {improvement.priority}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-700">Current: </span>
                      <span className="text-slate-600">{improvement.currentValue}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Recommendation: </span>
                      <span className="text-slate-600">{improvement.recommendation}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Potential Impact: </span>
                      <span className="text-slate-600">{improvement.potentialImpact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* P&L Table */}
      {currentYear && (
        <Card>
          <CardHeader>
            <CardTitle>P&L Year {currentYear.year}</CardTitle>
            <CardDescription>Click any cell to edit actuals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 pr-4 text-left font-semibold">Metric</th>
                    {MONTHS.map((month, idx) => (
                      <th key={idx} className="px-2 pb-2 text-right font-semibold">
                        {month}
                      </th>
                    ))}
                    <th className="pl-4 pb-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Revenue */}
                  <tr>
                    <td className="py-2 pr-4 font-medium">Revenue</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td
                          key={pnl.id}
                          className="cursor-pointer px-2 py-2 text-right transition-colors hover:bg-blue-50"
                          onClick={() => handleCellClick(currentYear.id, pnl.month, "revenue", pnl.revenue)}
                        >
                          {editingCell?.yearId === currentYear.id &&
                          editingCell?.month === pnl.month &&
                          editingCell?.field === "revenue" ? (
                            <Input
                              type="number"
                              value={cellValue}
                              onChange={(e) => setCellValue(e.target.value)}
                              onBlur={handleCellSave}
                              onKeyDown={(e) => e.key === "Enter" && handleCellSave()}
                              className="h-7 w-20 text-right"
                              autoFocus
                            />
                          ) : (
                            `$${pnl.revenue.toLocaleString()}`
                          )}
                        </td>
                      ))}
                    <td className="bg-slate-100 pl-4 py-2 text-right font-semibold">
                      ${currentYear.totalRevenue.toLocaleString()}
                    </td>
                  </tr>

                  {/* Labour Cost */}
                  <tr>
                    <td className="py-2 pr-4 font-medium">Labour Cost</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td
                          key={pnl.id}
                          className="cursor-pointer px-2 py-2 text-right transition-colors hover:bg-blue-50"
                          onClick={() => handleCellClick(currentYear.id, pnl.month, "labourCost", pnl.labourCost)}
                        >
                          ${pnl.labourCost.toLocaleString()}
                        </td>
                      ))}
                    <td className="bg-slate-100 pl-4 py-2 text-right font-semibold">
                      ${currentYear.monthlyPnl.reduce((sum, m) => sum + m.labourCost, 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Material Cost */}
                  <tr>
                    <td className="py-2 pr-4 font-medium">Material Cost</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td
                          key={pnl.id}
                          className="cursor-pointer px-2 py-2 text-right transition-colors hover:bg-blue-50"
                          onClick={() => handleCellClick(currentYear.id, pnl.month, "materialCost", pnl.materialCost)}
                        >
                          ${pnl.materialCost.toLocaleString()}
                        </td>
                      ))}
                    <td className="bg-slate-100 pl-4 py-2 text-right font-semibold">
                      ${currentYear.monthlyPnl.reduce((sum, m) => sum + m.materialCost, 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Gross Profit */}
                  <tr className="bg-slate-50">
                    <td className="py-2 pr-4 font-semibold">Gross Profit</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td key={pnl.id} className="px-2 py-2 text-right font-medium">
                          ${pnl.grossProfit.toLocaleString()}
                        </td>
                      ))}
                    <td className="bg-slate-200 pl-4 py-2 text-right font-bold">
                      ${currentYear.totalGrossProfit.toLocaleString()}
                    </td>
                  </tr>

                  {/* Gross Margin */}
                  <tr>
                    <td className="py-2 pr-4 font-medium">Gross Margin %</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td key={pnl.id} className="px-2 py-2 text-right">
                          {pnl.grossMargin.toFixed(1)}%
                        </td>
                      ))}
                    <td className="bg-slate-100 pl-4 py-2 text-right font-semibold">
                      {currentYear.avgGrossMargin.toFixed(1)}%
                    </td>
                  </tr>

                  {/* Marketing Cost */}
                  <tr>
                    <td className="py-2 pr-4 font-medium">Marketing Cost</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td
                          key={pnl.id}
                          className="cursor-pointer px-2 py-2 text-right transition-colors hover:bg-blue-50"
                          onClick={() => handleCellClick(currentYear.id, pnl.month, "marketingCost", pnl.marketingCost)}
                        >
                          ${pnl.marketingCost.toLocaleString()}
                        </td>
                      ))}
                    <td className="bg-slate-100 pl-4 py-2 text-right font-semibold">
                      ${currentYear.monthlyPnl.reduce((sum, m) => sum + m.marketingCost, 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Overheads */}
                  <tr>
                    <td className="py-2 pr-4 font-medium">Overheads</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td
                          key={pnl.id}
                          className="cursor-pointer px-2 py-2 text-right transition-colors hover:bg-blue-50"
                          onClick={() => handleCellClick(currentYear.id, pnl.month, "overheads", pnl.overheads)}
                        >
                          ${pnl.overheads.toLocaleString()}
                        </td>
                      ))}
                    <td className="bg-slate-100 pl-4 py-2 text-right font-semibold">
                      ${currentYear.monthlyPnl.reduce((sum, m) => sum + m.overheads, 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Net Profit */}
                  <tr className="bg-slate-50">
                    <td className="py-2 pr-4 font-semibold">Net Profit</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td key={pnl.id} className="px-2 py-2 text-right font-medium">
                          ${pnl.netProfit.toLocaleString()}
                        </td>
                      ))}
                    <td className="bg-slate-200 pl-4 py-2 text-right font-bold">
                      ${currentYear.totalNetProfit.toLocaleString()}
                    </td>
                  </tr>

                  {/* Net Margin */}
                  <tr>
                    <td className="py-2 pr-4 font-medium">Net Margin %</td>
                    {currentYear.monthlyPnl
                      .sort((a, b) => a.month - b.month)
                      .map((pnl) => (
                        <td key={pnl.id} className="px-2 py-2 text-right">
                          {pnl.netMargin.toFixed(1)}%
                        </td>
                      ))}
                    <td className="bg-slate-100 pl-4 py-2 text-right font-semibold">
                      {currentYear.avgNetMargin.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Set Targets Dialog */}
      <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Financial Targets</DialogTitle>
            <DialogDescription>Define your revenue and margin goals</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="horizon">Time Horizon</Label>
              <Select
                value={targetHorizon}
                onValueChange={(v) => setTargetHorizon(v as "ONE_YEAR" | "FIVE_YEAR")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONE_YEAR">1 Year</SelectItem>
                  <SelectItem value="FIVE_YEAR">5 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="targetRevenue">Target Revenue ($)</Label>
              <Input
                id="targetRevenue"
                type="number"
                value={targetRevenue}
                onChange={(e) => setTargetRevenue(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div>
              <Label htmlFor="targetGrossMargin">Target Gross Margin (%)</Label>
              <Input
                id="targetGrossMargin"
                type="number"
                step="0.1"
                value={targetGrossMargin}
                onChange={(e) => setTargetGrossMargin(e.target.value)}
                placeholder="40.0"
              />
            </div>
            <div>
              <Label htmlFor="targetNetMargin">Target Net Margin (%)</Label>
              <Input
                id="targetNetMargin"
                type="number"
                step="0.1"
                value={targetNetMargin}
                onChange={(e) => setTargetNetMargin(e.target.value)}
                placeholder="15.0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTargetDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSetTarget}
              disabled={!targetRevenue || !targetGrossMargin || !targetNetMargin}
            >
              Save Target
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
