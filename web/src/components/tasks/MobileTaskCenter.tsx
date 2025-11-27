// web/src/components/tasks/MobileTaskCenter.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { 
  CheckSquare, 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  ListChecks,
  ChevronRight,
  Clock,
  AlertCircle,
  Sparkles,
  Trophy,
  Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskCelebration } from "./TaskCelebration";
import confetti from "canvas-confetti";

type TaskType = "MANUAL" | "COMMUNICATION" | "FOLLOW_UP" | "SCHEDULED" | "FORM" | "CHECKLIST";
type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  taskType: TaskType;
  dueAt?: string;
  completedAt?: string;
  relatedType: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string;
};

const TASK_TYPE_CONFIG = {
  MANUAL: { icon: CheckSquare, color: "text-blue-600", gradient: "from-blue-500 to-blue-600" },
  COMMUNICATION: { icon: Phone, color: "text-green-600", gradient: "from-green-500 to-emerald-600" },
  FOLLOW_UP: { icon: Mail, color: "text-purple-600", gradient: "from-purple-500 to-purple-600" },
  SCHEDULED: { icon: Calendar, color: "text-orange-600", gradient: "from-orange-500 to-orange-600" },
  FORM: { icon: FileText, color: "text-pink-600", gradient: "from-pink-500 to-pink-600" },
  CHECKLIST: { icon: ListChecks, color: "text-indigo-600", gradient: "from-indigo-500 to-indigo-600" },
};

export function MobileTaskCenter() {
  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTask, setCelebrationTask] = useState<Task | null>(null);

  useEffect(() => {
    const ids = getAuthIdsFromJwt();
    if (ids) {
      setTenantId(ids.tenantId);
      setUserId(ids.userId);
    }
  }, []);

  const loadTasks = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("take", "100");
      params.set("mine", "true"); // Only show user's tasks
      
      const response = await apiFetch<{ items: Task[]; total: number }>(
        `/tasks?${params}`,
        { headers: { "x-tenant-id": tenantId } }
      );
      
      setTasks(response.items.filter(t => t.status !== "DONE" && t.status !== "CANCELLED"));
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!tenantId || !userId) return;
    
    try {
      const stats = await apiFetch<any>(`/tasks/stats/${userId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      setStreakDays(stats.currentStreak || 0);
      setTodayCompleted(stats.todayCompleted || 0);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadTasks();
      loadStats();
    }
  }, [tenantId, userId]); // eslint-disable-line

  const handleCompleteTask = async (task: Task) => {
    try {
      await apiFetch(`/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
      });

      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Show celebration
      setCelebrationTask(task);
      setShowCelebration(true);

      // Reload
      await Promise.all([loadTasks(), loadStats()]);
    } catch (error) {
      console.error("Failed to complete task:", error);
      alert("Failed to complete task. Please try again.");
    }
  };

  // Group tasks
  const { urgent, highPriority, overdue, upcoming } = useMemo(() => {
    const now = new Date();
    const urgent: Task[] = [];
    const highPriority: Task[] = [];
    const overdue: Task[] = [];
    const upcoming: Task[] = [];

    tasks.forEach(task => {
      const dueDate = task.dueAt ? new Date(task.dueAt) : null;
      const isOverdue = dueDate && dueDate < now;

      if (isOverdue) {
        overdue.push(task);
      } else if (task.priority === "URGENT") {
        urgent.push(task);
      } else if (task.priority === "HIGH") {
        highPriority.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return { urgent, highPriority, overdue, upcoming };
  }, [tasks]);

  const renderTaskCard = (task: Task, showCompleteButton = true) => {
    const config = TASK_TYPE_CONFIG[task.taskType] || TASK_TYPE_CONFIG.MANUAL;
    const Icon = config.icon;
    const dueDate = task.dueAt ? new Date(task.dueAt) : null;
    const isOverdue = dueDate && dueDate < new Date();

    return (
      <Card 
        key={task.id} 
        className="p-4 active:scale-[0.98] transition-transform touch-manipulation"
      >
        <div className="flex items-start gap-3">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} flex-shrink-0`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">{task.title}</h3>
              {task.priority === "URGENT" && (
                <Badge variant="destructive" className="flex-shrink-0">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  URGENT
                </Badge>
              )}
            </div>
            
            {task.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
            )}
            
            <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
              {dueDate && (
                <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : ""}`}>
                  <Clock className="h-3 w-3" />
                  {isOverdue ? "Overdue" : dueDate.toLocaleDateString()}
                </span>
              )}
              <Badge variant="outline" className="text-xs">
                {task.relatedType}
              </Badge>
            </div>

            {showCompleteButton && (
              <Button
                onClick={() => handleCompleteTask(task)}
                className={`w-full bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white shadow-lg`}
                size="lg"
              >
                <CheckSquare className="h-5 w-5 mr-2" />
                Complete Task
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-500">Loading your tasks...</p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Celebration Modal */}
      {showCelebration && celebrationTask && (
        <TaskCelebration
          show={showCelebration}
          onClose={() => setShowCelebration(false)}
          taskTitle={celebrationTask.title}
          celebrationType={streakDays >= 7 ? "streak" : "standard"}
          streakDays={streakDays}
          totalCompleted={todayCompleted}
          pointsEarned={celebrationTask.priority === "URGENT" ? 25 : celebrationTask.priority === "HIGH" ? 15 : 10}
        />
      )}

      {/* Stats Header */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white p-6 rounded-b-3xl shadow-lg mb-6">
        <h1 className="text-2xl font-bold mb-4">My Tasks</h1>
        
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center bg-white/10 backdrop-blur border-white/20">
            <div className="text-3xl font-bold">{tasks.length}</div>
            <div className="text-xs opacity-90">Active</div>
          </Card>
          
          <Card className="p-3 text-center bg-white/10 backdrop-blur border-white/20">
            <div className="text-3xl font-bold flex items-center justify-center gap-1">
              <Flame className="h-6 w-6 text-orange-400" />
              {streakDays}
            </div>
            <div className="text-xs opacity-90">Day Streak</div>
          </Card>
          
          <Card className="p-3 text-center bg-white/10 backdrop-blur border-white/20">
            <div className="text-3xl font-bold flex items-center justify-center gap-1">
              <Trophy className="h-6 w-6 text-yellow-400" />
              {todayCompleted}
            </div>
            <div className="text-xs opacity-90">Today</div>
          </Card>
        </div>
      </div>

      {/* Task Sections */}
      <div className="space-y-6 px-4">
        {overdue.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-bold text-red-600">Overdue ({overdue.length})</h2>
            </div>
            <div className="space-y-3">
              {overdue.map(task => renderTaskCard(task))}
            </div>
          </section>
        )}

        {urgent.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-bold text-gray-900">Urgent ({urgent.length})</h2>
            </div>
            <div className="space-y-3">
              {urgent.map(task => renderTaskCard(task))}
            </div>
          </section>
        )}

        {highPriority.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ChevronRight className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">High Priority ({highPriority.length})</h2>
            </div>
            <div className="space-y-3">
              {highPriority.map(task => renderTaskCard(task))}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Upcoming ({upcoming.length})</h2>
            </div>
            <div className="space-y-3">
              {upcoming.map(task => renderTaskCard(task))}
            </div>
          </section>
        )}

        {tasks.length === 0 && (
          <Card className="p-12 text-center">
            <Trophy className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">All Done!</h3>
            <p className="text-gray-600">You've completed all your tasks. Great work! 🎉</p>
          </Card>
        )}
      </div>
    </div>
  );
}
