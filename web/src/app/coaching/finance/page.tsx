"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Plus, TrendingUp } from "lucide-react";
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

interface FinancialPlan {
  id: string;
  title: string;
  createdAt: string;
  yearCount: number;
  totalRevenue: number;
  avgGrossMargin: number;
  avgNetMargin: number;
}

export default function FinancePlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [durationYears, setDurationYears] = useState(1);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await apiFetch<{ ok?: boolean; plans?: FinancialPlan[] }>("/coaching/financial-plans");
      setPlans(data.plans ?? []);
    } catch (error) {
      console.error("Failed to load financial plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanTitle.trim() || !startYear || !durationYears) return;

    try {
      setLoading(true);
      const created = await apiFetch<{ ok: boolean; plan: FinancialPlan }>("/coaching/financial-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newPlanTitle.trim(), startYear, durationYears }),
      });
      setShowCreateDialog(false);
      setNewPlanTitle("");
      setStartYear(new Date().getFullYear());
      setDurationYears(1);
      const newId = (created.plan as any)?.id ?? (created.plan as any)?.planId;
      if (newId) {
        router.push(`/coaching/finance/${newId}`);
      } else {
        console.error("Created plan missing id:", created.plan);
        alert("Plan created but missing id; please refresh.");
        await loadPlans();
      }
    } catch (error) {
      console.error("Failed to create financial plan:", error);
      alert("Failed to create financial plan");
    } finally {
      setLoading(false);
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

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Financial Plans</h1>
          <p className="mt-2 text-sm text-slate-600">
            Track P&L, set targets, and get AI-powered improvement suggestions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Financial Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Financial Plans Yet</CardTitle>
            <CardDescription>Create your first financial plan to start tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Financial Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={(plan as any).id ?? (plan as any).planId ?? Math.random().toString(36)}
              className="group cursor-pointer transition-all hover:shadow-lg"
              onClick={() => {
                const safeId = (plan as any)?.id ?? (plan as any)?.planId;
                if (safeId) {
                  router.push(`/coaching/finance/${safeId}`);
                } else {
                  console.error("Plan missing id:", plan);
                  alert("This plan is missing an id. Try refreshing.");
                }
              }}
            >
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 transition-colors group-hover:bg-green-200">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>{plan.title}</CardTitle>
                <CardDescription>
                  Created {new Date(plan.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Revenue</span>
                    <span className="font-semibold text-slate-900">
                      ${(plan.totalRevenue ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Avg Gross Margin</span>
                    <span className="font-semibold text-slate-900">
                      {(plan.avgGrossMargin ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Avg Net Margin</span>
                    <span className="font-semibold text-slate-900">
                      {(plan.avgNetMargin ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Years Tracked</span>
                    <span className="font-semibold text-slate-900">{plan.yearCount ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Financial Plan</DialogTitle>
            <DialogDescription>Set up a new financial tracking plan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Plan Title</Label>
              <Input
                id="title"
                value={newPlanTitle}
                onChange={(e) => setNewPlanTitle(e.target.value)}
                placeholder="e.g., 2025 Financial Plan"
              />
            </div>
            <div>
              <Label htmlFor="startYear">Start Year</Label>
              <Input
                id="startYear"
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="durationYears">Duration (years)</Label>
              <Input
                id="durationYears"
                type="number"
                min={1}
                max={5}
                value={durationYears}
                onChange={(e) => setDurationYears(parseInt(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePlan} disabled={!newPlanTitle.trim() || !startYear || !durationYears}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
