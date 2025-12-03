"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { 
  Target, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Circle, 
  Clock,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";

interface GoalTask {
  id: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  sortOrder: number;
}

interface WeeklyGoal {
  id: string;
  weekNumber: number;
  description: string;
  completedAt: string | null;
  tasks: GoalTask[];
}

interface MonthlyGoal {
  id: string;
  month: number;
  description: string;
  completedAt: string | null;
  weeklyGoals: WeeklyGoal[];
}

interface GoalPlan {
  id: string;
  title: string;
  year: number;
  createdAt: string;
  monthlyGoals: MonthlyGoal[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function GoalsPage() {
  const router = useRouter();
  const [goalPlan, setGoalPlan] = useState<GoalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [newPlanYear, setNewPlanYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadGoalPlan();
  }, []);

  const loadGoalPlan = async () => {
    try {
      const data = await apiFetch<{ goalPlans: GoalPlan[] }>("/coaching/goal-plans");
      if (data.goalPlans?.[0]) {
        setGoalPlan(data.goalPlans[0]);
      }
    } catch (error) {
      console.error("Failed to load goal plan:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanTitle.trim()) return;

    try {
      setLoading(true);
      const created = await apiFetch<GoalPlan>("/coaching/goal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newPlanTitle, year: newPlanYear }),
      });
      setGoalPlan(created);
      setShowCreateDialog(false);
      setNewPlanTitle("");
    } catch (error) {
      console.error("Failed to create goal plan:", error);
      alert("Failed to create goal plan");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!goalPlan) return;

    try {
      setGenerating(true);
      const updated = await apiFetch<GoalPlan>(`/coaching/goal-plans/${goalPlan.id}/generate`, {
        method: "POST",
      });
      setGoalPlan(updated);
    } catch (error) {
      console.error("Failed to generate goals:", error);
      alert("Failed to generate goals with AI");
    } finally {
      setGenerating(false);
    }
  };

  const toggleMonth = (monthId: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthId)) {
        next.delete(monthId);
      } else {
        next.add(monthId);
      }
      return next;
    });
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : currentStatus === "TODO" ? "IN_PROGRESS" : "DONE";
    
    try {
      await apiFetch(`/coaching/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      // Reload to get updated progress
      await loadGoalPlan();
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const getTaskIcon = (status: string) => {
    switch (status) {
      case "DONE":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "IN_PROGRESS":
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <Circle className="h-5 w-5 text-slate-300" />;
    }
  };

  const getTaskBadge = (status: string) => {
    switch (status) {
      case "DONE":
        return <Badge className="bg-green-100 text-green-700">Done</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>;
      default:
        return <Badge variant="outline">To Do</Badge>;
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

  if (!goalPlan) {
    return (
      <div className="container mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>No Goal Plan Found</CardTitle>
            <CardDescription>Create your first goal plan to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Goal Plan
            </Button>
          </CardContent>
        </Card>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Goal Plan</DialogTitle>
              <DialogDescription>Set up your 12-month strategic plan</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="title">Plan Title</Label>
                <Input
                  id="title"
                  value={newPlanTitle}
                  onChange={(e) => setNewPlanTitle(e.target.value)}
                  placeholder="e.g., 2025 Business Growth Plan"
                />
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={newPlanYear}
                  onChange={(e) => setNewPlanYear(parseInt(e.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePlan} disabled={!newPlanTitle.trim()}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const totalTasks = goalPlan.monthlyGoals.reduce(
    (sum, month) =>
      sum + month.weeklyGoals.reduce((wsum, week) => wsum + week.tasks.length, 0),
    0
  );
  const completedTasks = goalPlan.monthlyGoals.reduce(
    (sum, month) =>
      sum +
      month.weeklyGoals.reduce(
        (wsum, week) => wsum + week.tasks.filter((t) => t.status === "DONE").length,
        0
      ),
    0
  );
  const completedMonths = goalPlan.monthlyGoals.filter((m) => m.completedAt).length;

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{goalPlan.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {completedTasks} of {totalTasks} tasks completed · {completedMonths} of 12 months
          </p>
        </div>
        <Button
          onClick={handleGenerateWithAI}
          disabled={generating || goalPlan.monthlyGoals.length > 0}
        >
          {generating ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
            </>
          )}
        </Button>
      </div>

      {goalPlan.monthlyGoals.length === 0 && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            Click "Generate with AI" to create a complete 12-month goal plan with weekly tasks
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {goalPlan.monthlyGoals
          .sort((a, b) => a.month - b.month)
          .map((monthGoal) => {
            const isExpanded = expandedMonths.has(monthGoal.id);
            const monthTasks = monthGoal.weeklyGoals.reduce(
              (sum, week) => sum + week.tasks.length,
              0
            );
            const monthCompleted = monthGoal.weeklyGoals.reduce(
              (sum, week) => sum + week.tasks.filter((t) => t.status === "DONE").length,
              0
            );
            const progress = monthTasks > 0 ? (monthCompleted / monthTasks) * 100 : 0;

            return (
              <Card key={monthGoal.id} className="overflow-hidden">
                <div
                  className="flex cursor-pointer items-center justify-between p-6 hover:bg-slate-50"
                  onClick={() => toggleMonth(monthGoal.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12">
                      <svg className="h-12 w-12 -rotate-90 transform">
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-slate-200"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 20}`}
                          strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
                          className="text-blue-600 transition-all"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-900">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {MONTHS[monthGoal.month - 1]} {goalPlan.year}
                      </h3>
                      <p className="text-sm text-slate-600">{monthGoal.description}</p>
                      <p className="text-xs text-slate-500">
                        {monthCompleted} of {monthTasks} tasks · {monthGoal.weeklyGoals.length} weeks
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 p-6">
                    <div className="space-y-4">
                      {monthGoal.weeklyGoals
                        .sort((a, b) => a.weekNumber - b.weekNumber)
                        .map((weekGoal) => {
                          const weekCompleted = weekGoal.tasks.filter((t) => t.status === "DONE").length;
                          const weekTotal = weekGoal.tasks.length;

                          return (
                            <Card key={weekGoal.id}>
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base">
                                    Week {weekGoal.weekNumber}
                                  </CardTitle>
                                  <Badge variant="outline">
                                    {weekCompleted}/{weekTotal}
                                  </Badge>
                                </div>
                                <CardDescription>{weekGoal.description}</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  {weekGoal.tasks
                                    .sort((a, b) => a.sortOrder - b.sortOrder)
                                    .map((task) => (
                                      <div
                                        key={task.id}
                                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-slate-300 hover:shadow-sm"
                                      >
                                        <button
                                          onClick={() => handleToggleTask(task.id, task.status)}
                                          className="shrink-0 transition-transform hover:scale-110"
                                        >
                                          {getTaskIcon(task.status)}
                                        </button>
                                        <p
                                          className={`flex-1 text-sm ${
                                            task.status === "DONE"
                                              ? "text-slate-500 line-through"
                                              : "text-slate-900"
                                          }`}
                                        >
                                          {task.description}
                                        </p>
                                        {getTaskBadge(task.status)}
                                      </div>
                                    ))}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
