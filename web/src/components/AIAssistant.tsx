"use client";

import { useState, useEffect } from "react";
import { Bell, Sparkles, CheckCircle2, Clock, TrendingUp, Target, Zap, Coffee, Heart } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AssistantInsight {
  type: "celebration" | "encouragement" | "reminder" | "achievement" | "ritual";
  message: string;
  icon: any;
  color: string;
}

interface TaskStats {
  late: number;
  dueToday: number;
  completed: number;
  total: number;
}

export default function AIAssistant() {
  const { user } = useCurrentUser();
  const [insight, setInsight] = useState<AssistantInsight | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats>({ late: 0, dueToday: 0, completed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component is mounted before enabling functionality
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only load insights if user is authenticated AND component is mounted
    if (!isMounted || !user) return;
    
    loadInsights();
    const interval = setInterval(loadInsights, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [isMounted, user]);

  async function loadInsights() {
    try {
      // Fetch task statistics
      const tasksData = await apiFetch<any>("/tasks/stats?scope=mine");
      if (tasksData) {
        setTaskStats({
          late: tasksData.late || 0,
          dueToday: tasksData.dueToday || 0,
          completed: tasksData.completedToday || 0,
          total: tasksData.total || 0,
        });
      }

      // Generate AI-powered insight
      const insightData = await apiFetch<AssistantInsight>("/ai/assistant-insight");
      if (insightData) {
        setInsight(insightData);
      }
    } catch (error) {
      console.error("Failed to load assistant insights:", error);
    } finally {
      setLoading(false);
    }
  }

  const getDefaultInsight = (): AssistantInsight => {
    const hour = new Date().getHours();
    const firstName = user?.firstName || "there";
    
    // Monday morning check-in
    if (new Date().getDay() === 1 && hour < 12) {
      return {
        type: "ritual",
        message: `Monday Morning Check-in, ${firstName}. Let's plan a great week.`,
        icon: Coffee,
        color: "from-amber-500 to-orange-500",
      };
    }

    // Friday wrap
    if (new Date().getDay() === 5 && hour > 15) {
      return {
        type: "celebration",
        message: `Friday Wrap, ${firstName}. You've moved your business forward this week! 🎉`,
        icon: Heart,
        color: "from-pink-500 to-rose-500",
      };
    }

    // Late tasks warning
    if (taskStats.late > 0) {
      return {
        type: "reminder",
        message: `${taskStats.late} ${taskStats.late === 1 ? 'task needs' : 'tasks need'} attention. You've got this!`,
        icon: Clock,
        color: "from-orange-500 to-red-500",
      };
    }

    // Celebrations for completed tasks
    if (taskStats.completed > 0) {
      return {
        type: "achievement",
        message: `${taskStats.completed} ${taskStats.completed === 1 ? 'task' : 'tasks'} completed today! You're on fire! 🔥`,
        icon: TrendingUp,
        color: "from-emerald-500 to-teal-500",
      };
    }

    // Today's agenda
    if (taskStats.dueToday > 0) {
      return {
        type: "encouragement",
        message: `${taskStats.dueToday} ${taskStats.dueToday === 1 ? 'task' : 'tasks'} on your plate today. Let's make it happen!`,
        icon: Target,
        color: "from-blue-500 to-indigo-500",
      };
    }

    // Default message based on actual stats
    if (taskStats.total > 0) {
      return {
        type: "encouragement",
        message: `${taskStats.total} ${taskStats.total === 1 ? 'active task' : 'active tasks'}. You're organized.`,
        icon: CheckCircle2,
        color: "from-emerald-500 to-teal-500",
      };
    }

    return {
      type: "encouragement",
      message: "All caught up. Ready for what's next.",
      icon: Sparkles,
      color: "from-blue-500 to-cyan-500",
    };
  };

  const currentInsight = insight || getDefaultInsight();
  const Icon = currentInsight.icon;
  const hasNotifications = taskStats.late > 0 || taskStats.dueToday > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative">
        <div className={`flex items-center gap-2 rounded-full border border-slate-200 bg-gradient-to-r ${currentInsight.color} px-4 py-2 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer group`}>
          <Icon className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-medium max-w-[200px] truncate hidden sm:inline">
            {currentInsight.message.split('.')[0]}
          </span>
          {hasNotifications && (
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{taskStats.late + taskStats.dueToday}</span>
            </div>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-6 bg-white shadow-2xl rounded-2xl border-2 border-slate-200">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${currentInsight.color} flex items-center justify-center shadow-lg`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Your AI Assistant</h3>
                <p className="text-xs text-slate-600">Real-time insights from your workspace</p>
              </div>
            </div>
          </div>

          {/* Main Insight */}
          <div className={`rounded-xl bg-gradient-to-br ${currentInsight.color} p-4 text-white shadow-lg`}>
            <p className="text-sm font-medium leading-relaxed">{currentInsight.message}</p>
          </div>

          {/* Task Statistics */}
          <div className="grid grid-cols-2 gap-3">
            {taskStats.late > 0 && (
              <div className="rounded-xl bg-gradient-to-br from-orange-50 to-red-50 p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-900 uppercase tracking-wide">Late</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">{taskStats.late}</p>
                <p className="text-xs text-orange-700 mt-1">Need attention</p>
              </div>
            )}
            
            {taskStats.dueToday > 0 && (
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Today</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{taskStats.dueToday}</p>
                <p className="text-xs text-blue-700 mt-1">On your plate</p>
              </div>
            )}

            {taskStats.completed > 0 && (
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 border border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">Done</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{taskStats.completed}</p>
                <p className="text-xs text-emerald-700 mt-1">Today</p>
              </div>
            )}

            <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide">Total</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{taskStats.total}</p>
              <p className="text-xs text-purple-700 mt-1">Active tasks</p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200">
            <button 
              onClick={() => window.location.href = '/tasks/center'}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 text-sm shadow-lg hover:shadow-xl transition-all"
            >
              View All Tasks
            </button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
