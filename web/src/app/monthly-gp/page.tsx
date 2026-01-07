'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface ProjectGP {
  projectId: string;
  projectName: string;
  hoursThisMonth: number;
  hoursToDate: number;
  budgetHours: number;
  percentCompleteThisMonth: number;
  percentCompleteToDate: number;
  revenueThisMonth: number;
  labourCostThisMonth: number;
  materialsCostThisMonth: number;
  totalCostThisMonth: number;
  grossProfitThisMonth: number;
  grossProfitPercent: number;
}

interface MonthlyGPSummary {
  month: string;
  totalRevenue: number;
  totalCost: number;
  totalGrossProfit: number;
  grossProfitPercent: number;
  projects: ProjectGP[];
}

export default function MonthlyGPDashboard() {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [summary, setSummary] = useState<MonthlyGPSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWageBillInput, setShowWageBillInput] = useState(false);
  const [wageBill, setWageBill] = useState('');

  // Load available months on mount
  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  // Auto-load current month
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (availableMonths.includes(currentMonth)) {
        setSelectedMonth(currentMonth);
      } else {
        setSelectedMonth(availableMonths[0]);
      }
    }
  }, [availableMonths]);

  // Load GP data when month changes
  useEffect(() => {
    if (selectedMonth) {
      loadMonthlyGP();
    }
  }, [selectedMonth]);

  const fetchAvailableMonths = async () => {
    try {
      const res = await fetch('/api/monthly-gp/months/list');
      if (res.ok) {
        const months = await res.json();
        setAvailableMonths(months);
      }
    } catch (err) {
      console.error('Error fetching months:', err);
    }
  };

  const loadMonthlyGP = async () => {
    if (!selectedMonth) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/monthly-gp/${selectedMonth}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.error?.includes('No wage bill')) {
          setShowWageBillInput(true);
          setError(errorData.error);
        } else {
          setError(errorData.error || 'Failed to load GP data');
        }
        setSummary(null);
        return;
      }

      const data = await res.json();
      setSummary(data);
      setShowWageBillInput(false);
    } catch (err: any) {
      setError(err.message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const saveWageBill = async () => {
    if (!wageBill || !selectedMonth) return;

    try {
      const res = await fetch('/api/monthly-gp/wage-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          wageBill: parseFloat(wageBill)
        })
      });

      if (res.ok) {
        setWageBill('');
        setShowWageBillInput(false);
        loadMonthlyGP();
      }
    } catch (err) {
      console.error('Error saving wage bill:', err);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monthly Gross Profit</h1>
          <p className="text-muted-foreground">
            Track revenue earned and costs incurred by project hours
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Label htmlFor="month-select">Month:</Label>
          <select
            id="month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {new Date(month + '-01').toLocaleDateString('en-GB', { 
                  year: 'numeric', 
                  month: 'long' 
                })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Wage Bill Input */}
      {showWageBillInput && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle>Add Wage Bill</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="wage-bill">Total wage bill for {selectedMonth}</Label>
                <Input
                  id="wage-bill"
                  type="number"
                  placeholder="e.g. 45000"
                  value={wageBill}
                  onChange={(e) => setWageBill(e.target.value)}
                />
              </div>
              <Button onClick={saveWageBill}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && !showWageBillInput && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Summary Cards */}
      {summary && !loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Revenue Earned */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Revenue Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(summary.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on hours worked
                </p>
              </CardContent>
            </Card>

            {/* Cost of Sales */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cost Incurred
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {formatCurrency(summary.totalCost)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Labour + materials
                </p>
              </CardContent>
            </Card>

            {/* Gross Profit */}
            <Card className="col-span-1 md:col-span-2 border-2 border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gross Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-3">
                  <div className="text-4xl font-bold text-primary">
                    {formatCurrency(summary.totalGrossProfit)}
                  </div>
                  <div className="text-2xl font-semibold text-muted-foreground">
                    {formatPercent(summary.grossProfitPercent)}
                  </div>
                  {summary.grossProfitPercent >= 30 ? (
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  ) : summary.grossProfitPercent >= 20 ? (
                    <TrendingUp className="h-6 w-6 text-orange-500" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Contribution Table */}
          <Card>
            <CardHeader>
              <CardTitle>Project Contribution</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">% Complete</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">GP</TableHead>
                    <TableHead className="text-right">GP %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.projects
                    .sort((a, b) => b.grossProfitThisMonth - a.grossProfitThisMonth)
                    .map((project) => {
                      const isLoss = project.grossProfitThisMonth < 0;
                      const isLowMargin = project.grossProfitPercent < 20;

                      return (
                        <TableRow 
                          key={project.projectId}
                          className={isLoss ? 'bg-red-50' : isLowMargin ? 'bg-orange-50' : ''}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {isLoss && <AlertTriangle className="h-4 w-4 text-red-500" />}
                              {project.projectName}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(project.percentCompleteToDate)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(project.revenueThisMonth)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(project.totalCostThisMonth)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${
                            isLoss ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatCurrency(project.grossProfitThisMonth)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${
                            isLoss ? 'text-red-600' : 
                            isLowMargin ? 'text-orange-600' : 
                            'text-green-600'
                          }`}>
                            {formatPercent(project.grossProfitPercent)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
