// web/src/components/tasks/TaskCenter.tsx
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
  Plus,
  Filter,
  Search,
  BarChart3,
  Library,
  Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TaskAnalyticsDashboard } from "./TaskAnalyticsDashboard";
import { FormTemplatesLibrary } from "./FormTemplatesLibrary";
import { CalendarIntegration } from "./CalendarIntegration";
import { TaskCelebration } from "./TaskCelebration";
import { TaskStreakTracker } from "./TaskStreakTracker";
import { ScheduledTasksTab } from "./ScheduledTasksTab";
import { TaskModal } from "./TaskModal";
import { CreateTaskWizard } from "./CreateTaskWizard";

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
  
  // Communication fields
  communicationType?: string;
  communicationChannel?: string;
  communicationDirection?: string;
  communicationNotes?: string;
  
  // Form fields
  formSchema?: any;
  requiresSignature?: boolean;
  signedAt?: string;
  
  // Checklist fields
  checklistItems?: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  
  assignees?: Array<{
    userId: string;
    role: "OWNER" | "FOLLOWER";
  }>;
};

const TASK_TYPE_CONFIG = {
  MANUAL: {
    label: "Tasks",
    icon: CheckSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  COMMUNICATION: {
    label: "Communications",
    icon: Phone,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  FOLLOW_UP: {
    label: "Follow-ups",
    icon: Mail,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  SCHEDULED: {
    label: "Scheduled",
    icon: Calendar,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  FORM: {
    label: "Forms",
    icon: FileText,
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
  CHECKLIST: {
    label: "Checklists",
    icon: ListChecks,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
};

export function TaskCenter() {
  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");

  const [activeTab, setActiveTab] = useState<"all" | TaskType | "completed" | "analytics" | "templates" | "calendar" | "scheduled-templates">("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  // Get auth IDs on mount and when localStorage changes
  useEffect(() => {
    const ids = getAuthIdsFromJwt();
    if (ids) {
      setTenantId(ids.tenantId);
      setUserId(ids.userId);
    }
  }, []);
  
  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTask, setCelebrationTask] = useState<Task | null>(null);
  const [celebrationStats, setCelebrationStats] = useState({ streak: 0, total: 0, points: 10 });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);

  const loadTasks = async () => {
    if (!tenantId) {
      return;
    }
    
    // Don't load tasks for special tabs
    const specialTabs = ["analytics", "templates", "calendar", "scheduled-templates"];
    if (specialTabs.includes(activeTab)) {
      setTasks([]);
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("take", "100");
      
      if (activeTab === "completed") {
        params.set("status", "DONE");
        params.set("includeDone", "true");
      } else if (activeTab !== "all") {
        // Only set taskType if it's a valid task type
        const validTaskTypes = Object.keys(TASK_TYPE_CONFIG);
        if (validTaskTypes.includes(activeTab as string)) {
          params.set("taskType", activeTab as string);
        }
      }
      
      if (showOnlyMine && userId) {
        params.set("mine", "true");
      }
      
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const response = await apiFetch<{ items: Task[]; total: number }>(
        `/tasks?${params}`,
        { headers: { "x-tenant-id": tenantId } }
      );
      
      setTasks(response.items);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadTasks();
    }
  }, [tenantId, activeTab, showOnlyMine, searchQuery]); // eslint-disable-line

  // Lightweight stats for mobile header
  const loadStats = async () => {
    if (!tenantId || !userId) return;
    try {
      const statsResponse = await apiFetch<any>(`/tasks/stats/${userId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      setStreakDays(statsResponse.currentStreak || 0);
      setTodayCompleted(statsResponse.tasksCompletedToday || statsResponse.todayCompleted || 0);
    } catch (error) {
      // Non-blocking
      console.warn("Failed to load task stats", error);
    }
  };

  useEffect(() => {
    if (tenantId && userId) {
      loadStats();
    }
  }, [tenantId, userId]); // eslint-disable-line

  const handleSearch = () => {
    loadTasks();
  };

  const handleNewTask = () => {
    setShowCreateWizard(true);
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      // Mark task as complete
      await apiFetch(`/tasks/${task.id}/complete`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
      });

      // Get updated stats for celebration
      const statsResponse = await apiFetch<any>(`/tasks/stats/${userId}`, {
        headers: { "x-tenant-id": tenantId },
      });

      // Show celebration
      setCelebrationTask(task);
      setCelebrationStats({
        streak: statsResponse.currentStreak || 0,
        total: statsResponse.totalTasksCompleted || 0,
        points: task.priority === "URGENT" ? 25 : task.priority === "HIGH" ? 15 : 10,
      });
      setShowCelebration(true);

      // Reload tasks
      await loadTasks();
      // Refresh lightweight stats for mobile header
      await loadStats();
    } catch (error) {
      console.error("Failed to complete task:", error);
      alert("Failed to complete task. Please try again.");
    }
  };

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      completed: 0,
    };
    
    Object.keys(TASK_TYPE_CONFIG).forEach(type => {
      counts[type] = 0;
    });

    tasks.forEach(task => {
      if (task.status === "DONE") {
        counts.completed++;
      } else {
        counts.all++;
        counts[task.taskType]++;
      }
    });

    return counts;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (activeTab === "completed") {
        return task.status === "DONE";
      }
      if (activeTab !== "all") {
        return task.taskType === activeTab && task.status !== "DONE";
      }
      return task.status !== "DONE";
    });
  }, [tasks, activeTab]);

  // Mobile-friendly groupings
  const { overdue, urgent, highPriority, upcoming } = useMemo(() => {
    const now = new Date();
    const overdue: Task[] = [];
    const urgent: Task[] = [];
    const highPriority: Task[] = [];
    const upcoming: Task[] = [];

    filteredTasks.forEach((task) => {
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

    return { overdue, urgent, highPriority, upcoming };
  }, [filteredTasks]);

  const renderTaskCard = (task: Task) => {
    const config = TASK_TYPE_CONFIG[task.taskType] || TASK_TYPE_CONFIG.MANUAL;
    const Icon = config.icon;
    const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "DONE";

    return (
      <Card key={task.id} className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{task.title}</h3>
              <Badge variant={task.priority === "URGENT" ? "destructive" : "secondary"}>
                {task.priority}
              </Badge>
            </div>
            
            {task.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
            )}
            
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className={`px-2 py-1 rounded-full ${
                task.status === "DONE" ? "bg-green-100 text-green-700" :
                task.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                task.status === "BLOCKED" ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-700"
              }`}>
                {task.status}
              </span>
              
              {task.dueAt && (
                <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
                  Due: {new Date(task.dueAt).toLocaleDateString()}
                </span>
              )}
              
              {task.taskType === "CHECKLIST" && task.checklistItems && (
                <span>
                  {task.checklistItems.filter(i => i.completed).length}/{task.checklistItems.length} completed
                </span>
              )}
              
              {task.taskType === "FORM" && task.requiresSignature && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Requires signature
                </span>
              )}
            </div>

            {/* Complete Button */}
            {task.status !== "DONE" && (
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={() => handleCompleteTask(task)}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Complete Task
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col min-h-0">
      {/* Celebration Modal */}
      {showCelebration && celebrationTask && (
        <TaskCelebration
          show={showCelebration}
          onClose={() => setShowCelebration(false)}
          taskTitle={celebrationTask.title}
          celebrationType={celebrationStats.streak >= 7 ? "streak" : "standard"}
          streakDays={celebrationStats.streak}
          totalCompleted={celebrationStats.total}
          pointsEarned={celebrationStats.points}
        />
      )}

      {/* Sticky Header Section */}
      <div className="flex-shrink-0 space-y-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Task Center</h1>
            <p className="text-gray-600 mt-1">Manage all your tasks, communications, and forms in one place</p>
          </div>
        </div>

        {/* Mobile Stats Header */}
        <div className="md:hidden bg-gradient-to-br from-blue-600 to-purple-600 text-white p-4 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-3">My Tasks</h2>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center bg-white/10 backdrop-blur border-white/20">
              <div className="text-2xl font-bold">{filteredTasks.length}</div>
              <div className="text-[10px] opacity-90">Active</div>
            </Card>
            <Card className="p-3 text-center bg-white/10 backdrop-blur border-white/20">
              <div className="text-2xl font-bold">{streakDays}</div>
              <div className="text-[10px] opacity-90">Day Streak</div>
            </Card>
            <Card className="p-3 text-center bg-white/10 backdrop-blur border-white/20">
              <div className="text-2xl font-bold">{todayCompleted}</div>
              <div className="text-[10px] opacity-90">Today</div>
            </Card>
          </div>
        </div>

        {/* Streak Tracker (desktop/tablet) */}
        <div className="hidden md:block">
          <TaskStreakTracker />
        </div>

        {/* Search and Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            
            <Button variant="outline" onClick={handleSearch} className="w-full sm:w-auto">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            
            <Button
              variant={showOnlyMine ? "default" : "outline"}
              onClick={() => setShowOnlyMine(!showOnlyMine)}
              className="w-full sm:w-auto"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showOnlyMine ? "My Tasks" : "All Tasks"}
            </Button>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <TabsList className="flex-1 justify-start overflow-x-auto flex-shrink-0">
          <TabsTrigger value="all" className="flex items-center gap-2">
            All
            {taskCounts.all > 0 && (
              <Badge variant="secondary">{taskCounts.all}</Badge>
            )}
          </TabsTrigger>
          
          {Object.entries(TASK_TYPE_CONFIG).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <TabsTrigger key={type} value={type} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {config.label}
                {taskCounts[type] > 0 && (
                  <Badge variant="secondary">{taskCounts[type]}</Badge>
                )}
              </TabsTrigger>
            );
          })}
          
          <TabsTrigger value="completed" className="flex items-center gap-2">
            Completed
            {taskCounts.completed > 0 && (
              <Badge variant="secondary">{taskCounts.completed}</Badge>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            Templates
          </TabsTrigger>
          
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          
          <TabsTrigger value="scheduled-templates" className="flex items-center gap-2">
             <Calendar className="h-4 w-4" />
             Scheduled
           </TabsTrigger>
         </TabsList>
         
         <Button onClick={handleNewTask} size="lg" className="shadow-lg ml-4">
            <Plus className="h-5 w-5 mr-2" />
            New Task
          </Button>
        </div>

        <div className="mt-6">
          {activeTab === "analytics" ? (
            <TaskAnalyticsDashboard />
          ) : activeTab === "templates" ? (
            <FormTemplatesLibrary />
          ) : activeTab === "calendar" ? (
            <CalendarIntegration />
          ) : activeTab === "scheduled-templates" ? (
            <ScheduledTasksTab />
          ) : loading ? (
            <div className="text-center py-12 text-gray-500">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-gray-400 mb-2">
                <CheckSquare className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">No tasks found</h3>
              <p className="text-gray-500 mt-1">
                {activeTab === "completed" 
                  ? "No completed tasks yet" 
                  : "Create your first task to get started"}
              </p>
            </Card>
          ) : (
            <>
              {/* Mobile grouped sections */}
              <div className="md:hidden space-y-6">
                {overdue.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-red-600">Overdue ({overdue.length})</span>
                    </div>
                    <div className="space-y-3">
                      {overdue.map((t) => renderTaskCard(t))}
                    </div>
                  </section>
                )}
                {urgent.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-orange-600">Urgent ({urgent.length})</span>
                    </div>
                    <div className="space-y-3">
                      {urgent.map((t) => renderTaskCard(t))}
                    </div>
                  </section>
                )}
                {highPriority.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-blue-600">High Priority ({highPriority.length})</span>
                    </div>
                    <div className="space-y-3">
                      {highPriority.map((t) => renderTaskCard(t))}
                    </div>
                  </section>
                )}
                {upcoming.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-gray-700">Upcoming ({upcoming.length})</span>
                    </div>
                    <div className="space-y-3">
                      {upcoming.map((t) => renderTaskCard(t))}
                    </div>
                  </section>
                )}
              </div>

              {/* Desktop/Tablet grid */}
              <div className="hidden md:grid gap-4 pb-6">
                {filteredTasks.map(renderTaskCard)}
              </div>
            </>
          )}
        </div>
      </Tabs>
      {/* Create Task Wizard */}
      <CreateTaskWizard
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        tenantId={tenantId}
        userId={userId}
        onCreated={() => {
          loadTasks();
        }}
      />

      {/* Task Modal (for editing existing tasks) */}
      <TaskModal
        open={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        tenantId={tenantId}
        userId={userId}
        onChanged={() => {
          loadTasks();
          setShowTaskModal(false);
        }}
      />
    </div>
  );
}
