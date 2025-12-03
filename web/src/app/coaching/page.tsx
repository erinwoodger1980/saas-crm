"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";
import { apiFetch } from "@/lib/api";
import { Target, FileText, TrendingUp, ChevronRight, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoalPlanSummary {
  id: string;
  title: string;
  year: number;
  completedMonths: number;
  totalMonths: number;
  completedTasks: number;
  totalTasks: number;
}

interface CoachingNotesSummary {
  totalSessions: number;
  lastSessionDate: string | null;
  pendingCommitments: number;
}

interface FinancialPlanSummary {
  id: string;
  year: number;
  actualRevenue: number;
  targetRevenue: number;
  actualNetMargin: number;
  targetNetMargin: number;
}

export default function CoachingHubPage() {
  const { user } = useCurrentUser();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [goalPlan, setGoalPlan] = useState<GoalPlanSummary | null>(null);
  const [notes, setNotes] = useState<CoachingNotesSummary | null>(null);
  const [financialPlan, setFinancialPlan] = useState<FinancialPlanSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Try to fetch tenant settings to check flags
        const settings = await apiFetch<{ isGroupCoachingMember?: boolean }>("/tenant/settings");
        
        // Allow access when tenant has Coaching Hub enabled; owner not required for now
        if (!settings?.isGroupCoachingMember) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        setHasAccess(true);

        // Fetch summaries in parallel
        const [goalRes, notesRes, financeRes] = await Promise.allSettled([
          apiFetch<{ goalPlans: GoalPlanSummary[] }>("/coaching/goal-plans"),
          apiFetch<CoachingNotesSummary>("/coaching/notes/summary"),
          apiFetch<{ plans: FinancialPlanSummary[] }>("/coaching/financial-plans"),
        ]);

        if (goalRes.status === "fulfilled" && goalRes.value.goalPlans?.[0]) {
          setGoalPlan(goalRes.value.goalPlans[0]);
        }
        if (notesRes.status === "fulfilled") {
          setNotes(notesRes.value);
        }
        if (financeRes.status === "fulfilled" && financeRes.value.plans?.[0]) {
          setFinancialPlan(financeRes.value.plans[0]);
        }
      } catch (error) {
        console.error("Failed to load coaching hub:", error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkAccess();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
        </div>
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="container mx-auto px-6 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
          "Coaching Hub is disabled for this tenant."
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Coaching Hub</h1>
          <p className="mt-2 text-sm text-slate-600">
            Strategic planning, coaching notes, and financial performance tracking
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">AI-Powered Insights</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Goal Planner Card */}
        <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-blue-100 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Goal Planner</CardTitle>
            <CardDescription>12-month strategic goals with AI generation</CardDescription>
          </CardHeader>
          <CardContent>
            {goalPlan ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600">Current Plan</p>
                  <p className="font-semibold text-slate-900">{goalPlan.title}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16">
                    <svg className="h-16 w-16 -rotate-90 transform">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        className="text-slate-200"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - goalPlan.completedMonths / goalPlan.totalMonths)}`}
                        className="text-blue-600 transition-all"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-900">
                        {Math.round((goalPlan.completedMonths / goalPlan.totalMonths) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-slate-600">
                      {goalPlan.completedTasks} of {goalPlan.totalTasks} tasks
                    </p>
                    <p className="text-slate-600">
                      {goalPlan.completedMonths} of {goalPlan.totalMonths} months
                    </p>
                  </div>
                </div>
                <Link href="/coaching/goals">
                  <Button className="w-full" variant="outline">
                    View Goals
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">No active goal plan</p>
                <Link href="/coaching/goals">
                  <Button className="w-full">
                    Create Goal Plan
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coaching Notes Card */}
        <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-purple-100 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <CardTitle>Coaching Notes</CardTitle>
            <CardDescription>Session notes and commitments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notes ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{notes.totalSessions}</p>
                      <p className="text-xs text-slate-600">Total Sessions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{notes.pendingCommitments}</p>
                      <p className="text-xs text-slate-600">Pending</p>
                    </div>
                  </div>
                  {notes.lastSessionDate && (
                    <p className="text-sm text-slate-600">
                      Last session: {new Date(notes.lastSessionDate).toLocaleDateString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-600">No coaching sessions yet</p>
              )}
              <Link href="/coaching/notes">
                <Button className="w-full" variant="outline">
                  View Notes
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Financial Plan & P&L Card */}
        <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-green-100 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Financial Plan & P&L</CardTitle>
            <CardDescription>Revenue, margins, and AI improvement suggestions</CardDescription>
          </CardHeader>
          <CardContent>
            {financialPlan ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600">Year {financialPlan.year}</p>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-600">Revenue</span>
                      <span className="font-medium text-slate-900">
                        ${Math.round((financialPlan.actualRevenue / financialPlan.targetRevenue) * 100)}% of target
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-green-600 transition-all"
                        style={{
                          width: `${Math.min((financialPlan.actualRevenue / financialPlan.targetRevenue) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-600">Net Margin</span>
                      <span className="font-medium text-slate-900">
                        {financialPlan.actualNetMargin.toFixed(1)}% (target: {financialPlan.targetNetMargin.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{
                          width: `${Math.min((financialPlan.actualNetMargin / financialPlan.targetNetMargin) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <Link href={`/coaching/finance/${financialPlan.id}`}>
                  <Button className="w-full" variant="outline">
                    View Financials
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">No financial plan yet</p>
                <Link href="/coaching/finance">
                  <Button className="w-full">
                    Create Financial Plan
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
