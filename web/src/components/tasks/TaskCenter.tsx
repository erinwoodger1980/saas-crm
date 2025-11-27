// web/src/components/tasks/TaskCenter.tsx (reconstructed simplified version)
"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { CheckSquare, Mail, Plus, Search, Filter, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TaskModal } from "./TaskModal";
import { CreateTaskWizard } from "./CreateTaskWizard";
import { TaskCelebration } from "./TaskCelebration";
import { TaskStreakTracker } from "./TaskStreakTracker";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  taskType: "MANUAL" | "COMMUNICATION" | "FOLLOW_UP" | "SCHEDULED" | "FORM" | "CHECKLIST";
  dueAt?: string;
  completedAt?: string;
  relatedType: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string;
  checklistItems?: Array<{ id: string; label: string; completed?: boolean }>;
  formSchema?: any;
  meta?: any;
  assignees?: Array<{ userId: string; role: "OWNER" | "FOLLOWER" }>;
  requiresSignature?: boolean; // optional form signature flag
};

const TASK_TYPE_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  MANUAL: { label: "Task", color: "text-blue-600", bgColor: "bg-blue-50" },
  COMMUNICATION: { label: "Comm", color: "text-green-600", bgColor: "bg-green-50" },
  FOLLOW_UP: { label: "Follow", color: "text-purple-600", bgColor: "bg-purple-50" },
  SCHEDULED: { label: "Sched", color: "text-orange-600", bgColor: "bg-orange-50" },
  FORM: { label: "Form", color: "text-pink-600", bgColor: "bg-pink-50" },
  CHECKLIST: { label: "Checklist", color: "text-indigo-600", bgColor: "bg-indigo-50" },
};

export function TaskCenter({
  filterRelatedType,
  filterRelatedId,
  embedded = false,
}: {
  filterRelatedType?: Task["relatedType"]; filterRelatedId?: string; embedded?: boolean;
} = {}) {
  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");

  const [activeTab] = useState("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyMine, setShowOnlyMine] = useState(true);

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
  // Mobile UI state
  const [headerCollapsed, setHeaderCollapsed] = useState(true);
  const [focusMode, setFocusMode] = useState(false); // hides non-task chrome for deep focus
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set()); // track which tasks are expanded
  const [expandAll, setExpandAll] = useState(false);
  const [leadPreviews, setLeadPreviews] = useState<Record<string, any>>({}); // cache lead details
  const [emailPreview, setEmailPreview] = useState<{
    isOpen: boolean;
    subject: string;
    body: string;
    to: string;
    recipientName?: string;
    action?: 'accept' | 'decline';
    taskId?: string;
  }>({
    isOpen: false,
    subject: '',
    body: '',
    to: '',
  });

  const loadTasks = async () => {
    if (!tenantId) {
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("take", "100");
      // Completed filter not exposed in simplified UI
      
      if (showOnlyMine && userId) {
        params.set("mine", "true");
      }
      
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      // Apply contextual filters if provided (lead/opportunity etc.)
      if (filterRelatedType && filterRelatedId) {
        params.set("relatedType", filterRelatedType);
        params.set("relatedId", filterRelatedId);
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

  const handleSkipTask = async (taskId: string) => {
    if (!confirm('Skip this task?')) return;
    try {
      await apiFetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { "x-tenant-id": tenantId },
        json: { status: 'CANCELLED' }
      });
      await loadTasks();
      alert('Task skipped');
    } catch (error) {
      console.error("Failed to skip task:", error);
      alert("Failed to skip task");
    }
  };

  const handleSendEmailPreview = async (taskId: string, action: 'accept' | 'decline') => {
    try {
      const endpoint = action === 'accept' ? 'accept-enquiry' : 'decline-enquiry';
      const preview = await apiFetch<any>(`/tasks/${taskId}/actions/${endpoint}/preview`, {
        method: 'POST',
        headers: { "x-tenant-id": tenantId },
      });
      setEmailPreview({
        isOpen: true,
        subject: preview.subject,
        body: preview.body,
        to: preview.to,
        recipientName: preview.recipientName,
        action,
        taskId,
      });
    } catch (err) {
      alert('Failed to generate email preview');
    }
  };

  const handleRejectEnquiry = async (taskId: string) => {
    if (!confirm('Reject as not a real enquiry? This will mark the lead as rejected and provide feedback to the ML system.')) return;
    try {
      await apiFetch(`/tasks/${taskId}/actions/reject-enquiry`, {
        method: 'POST',
        headers: { "x-tenant-id": tenantId },
      });
      await loadTasks();
      alert('Marked as not an enquiry');
    } catch (err) {
      alert('Failed to reject enquiry');
    }
  };

  const toggleTaskExpansion = async (taskId: string, leadId?: string) => {
    const newExpanded = new Set(expandedTaskIds);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
      // Fetch lead details if not already cached and leadId exists
      if (leadId && !leadPreviews[leadId]) {
        try {
          const lead = await apiFetch<any>(`/leads/${leadId}`, {
            headers: { "x-tenant-id": tenantId },
          });
          setLeadPreviews(prev => ({ ...prev, [leadId]: lead }));
        } catch (err) {
          console.error('Failed to fetch lead details:', err);
        }
      }
    }
    setExpandedTaskIds(newExpanded);
  };

  const renderTaskCard = (task: Task) => {
    const config = TASK_TYPE_CONFIG[task.taskType] || TASK_TYPE_CONFIG.MANUAL;
    // Reuse Mail icon for follow-ups, CheckSquare for manual, FileText for form, default for others
    const IconComponent = task.taskType === 'FOLLOW_UP' ? Mail : task.taskType === 'FORM' ? FileText : CheckSquare;
    const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "DONE";
    
    // Check if this is a review enquiry task or AI follow-up task
    const taskMeta = (task as any).meta || {};
    const trigger = taskMeta.trigger || '';
    const isReviewEnquiry = trigger === 'new_lead_received' || task.title.toLowerCase().includes('review') && task.title.toLowerCase().includes('enquiry');
    const isAITask = task.taskType === "FOLLOW_UP" || trigger.includes('follow_up');
    const isExpanded = expandAll || expandedTaskIds.has(task.id);
    const leadId = task.relatedType === 'LEAD' ? task.relatedId : null;
    const leadData = leadId ? leadPreviews[leadId] : null;

    return (
      <Card 
        key={task.id} 
        className="p-4 hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <IconComponent className={`h-5 w-5 ${config.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 
                className="font-semibold text-gray-900 truncate cursor-pointer hover:text-indigo-600"
                onClick={() => {
                  setSelectedTask(task);
                  setShowTaskModal(true);
                }}
              >
                {task.title}
              </h3>
              <div className="flex items-center gap-2">
                {leadId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskExpansion(task.id, leadId);
                    }}
                    className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                  >
                    {isExpanded ? '▲ Hide' : '▼ Details'}
                  </button>
                )}
                <Badge variant={task.priority === "URGENT" ? "destructive" : "secondary"}>
                  {task.priority}
                </Badge>
              </div>
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
              {task.meta?.quoteTaskCreated && task.meta?.quoteTaskId && (
                <button
                  className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Open the created quote task in the modal
                    const found = tasks.find(t => t.id === task.meta.quoteTaskId);
                    if (found) {
                      setSelectedTask(found);
                      setShowTaskModal(true);
                    } else {
                      alert('Quote task created');
                    }
                  }}
                >Quote task created</button>
              )}
              
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

            {/* Contextual Action Buttons */}
            {task.status !== "DONE" && (
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                {isReviewEnquiry ? (
                  // Review Enquiry: Accept / Decline / Reject
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleSendEmailPreview(task.id, 'accept')}
                    >
                      ✓ Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleSendEmailPreview(task.id, 'decline')}
                    >
                      ↓ Decline
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-400 text-red-700 hover:bg-red-50"
                      onClick={() => handleRejectEnquiry(task.id)}
                    >
                      ✕ Reject
                    </Button>
                  </>
                ) : isAITask ? (
                  // AI Follow-up tasks: Send Email / Skip
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1"
                      onClick={() => {
                        setSelectedTask(task);
                        setShowTaskModal(true);
                      }}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSkipTask(task.id)}
                    >
                      Skip
                    </Button>
                  </>
                ) : (
                  // Standard tasks: Complete
                  <Button
                    size="sm"
                    onClick={() => handleCompleteTask(task)}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Complete Task
                  </Button>
                )}
              </div>
            )}

            {/* Expanded Lead Preview */}
            {isExpanded && leadData && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 text-sm">
                <div className="font-semibold text-slate-900">Lead Details</div>
                
                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {leadData.contactName && (
                    <div><span className="font-medium text-slate-600">Name:</span> {leadData.contactName}</div>
                  )}
                  {leadData.email && (
                    <div><span className="font-medium text-slate-600">Email:</span> {leadData.email}</div>
                  )}
                  {leadData.phone && (
                    <div><span className="font-medium text-slate-600">Phone:</span> {leadData.phone}</div>
                  )}
                  {leadData.estimatedValue && (
                    <div><span className="font-medium text-slate-600">Est. Value:</span> ${leadData.estimatedValue.toLocaleString()}</div>
                  )}
                </div>

                {/* Description */}
                {leadData.description && (
                  <div className="bg-slate-50 rounded p-3">
                    <div className="font-medium text-slate-700 mb-1">Description</div>
                    <div className="text-slate-600 whitespace-pre-wrap">{leadData.description}</div>
                  </div>
                )}

                {/* Quote Details */}
                {leadData.quoteId && (
                  <div className="bg-blue-50 rounded p-3">
                    <div className="font-medium text-blue-900 mb-1">Quote</div>
                    <div className="text-blue-700 text-xs">
                      Quote ID: {leadData.quoteId}
                      {leadData.quotedValue && ` • Value: $${leadData.quotedValue.toLocaleString()}`}
                      {leadData.quoteStatus && ` • Status: ${leadData.quoteStatus}`}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {leadData.attachments && leadData.attachments.length > 0 && (
                  <div>
                    <div className="font-medium text-slate-700 mb-2">Attachments ({leadData.attachments.length})</div>
                    <div className="space-y-1">
                      {leadData.attachments.map((att: any, idx: number) => (
                        <a
                          key={idx}
                          href={att.url || att.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          {att.filename || att.name || `Attachment ${idx + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email Preview (if available) */}
                {leadData.originalEmail && (
                  <div className="bg-amber-50 rounded p-3">
                    <div className="font-medium text-amber-900 mb-1">Original Email</div>
                    <div className="text-amber-800 text-xs space-y-1">
                      {leadData.originalEmail.subject && (
                        <div><span className="font-medium">Subject:</span> {leadData.originalEmail.subject}</div>
                      )}
                      {leadData.originalEmail.from && (
                        <div><span className="font-medium">From:</span> {leadData.originalEmail.from}</div>
                      )}
                      {leadData.originalEmail.snippet && (
                        <div className="mt-2 text-amber-700 italic line-clamp-3">{leadData.originalEmail.snippet}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isExpanded && !leadData && leadId && (
              <div className="mt-4 pt-4 border-t border-slate-200 text-center text-sm text-slate-500">
                Loading lead details...
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const showCategories = true; // simple flag to always show search/filter bar

  return (
    <div className={`flex flex-col min-h-0 ${focusMode ? 'bg-white' : ''}`}>
      {/* Mobile Top Bar */}
      {!embedded && mobile && (
        <div className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 flex items-center gap-2 shadow-sm">
          <button onClick={() => setHeaderCollapsed(!headerCollapsed)} className="text-xs font-semibold px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition">
            {headerCollapsed ? 'Show' : 'Hide'} Header
          </button>
          <h2 className="text-sm font-bold flex-1 truncate">Tasks ({filteredTasks.length})</h2>
          <button onClick={() => setExpandAll(v => !v)} className="text-xs px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition">
            {expandAll ? 'Collapse All' : 'Expand All'}
          </button>
          <button onClick={() => setFocusMode(!focusMode)} className="text-xs px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition">
            {focusMode ? 'Exit Focus' : 'Focus'}
          </button>
          <button onClick={handleNewTask} className="text-xs px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 transition">New</button>
        </div>
      )}

      {/* Celebration Modal */}
      {showCelebration && celebrationTask && (
        <TaskCelebration
          show={showCelebration}
          onClose={() => setShowCelebration(false)}
          taskTitle={celebrationTask.title}
          celebrationType={celebrationStats.streak >= 7 ? 'streak' : 'standard'}
          streakDays={celebrationStats.streak}
          totalCompleted={celebrationStats.total}
          pointsEarned={celebrationStats.points}
        />
      )}

      {/* Header (desktop) */}
      {!embedded && !focusMode && (
        <div className={`space-y-4 pb-4 ${mobile && headerCollapsed ? 'hidden' : 'block'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{filterRelatedType && filterRelatedId ? `${filterRelatedType} Tasks` : 'Task Center'}</h1>
              <p className="text-gray-600 mt-1">{filterRelatedType && filterRelatedId ? 'Filtered to the current record' : 'Manage all your tasks, communications, and forms in one place'}</p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setExpandAll(v => !v)}>{expandAll ? 'Collapse All' : 'Expand All'}</Button>
            </div>
              <Button variant="default" onClick={handleNewTask} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
          </div>

          {/* Stats (mobile collapsed view handled above) */}
          <div className="hidden md:grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold">{filteredTasks.length}</div>
              <div className="text-xs text-gray-500">Active</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold">{streakDays}</div>
              <div className="text-xs text-gray-500">Day Streak</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold">{todayCompleted}</div>
              <div className="text-xs text-gray-500">Completed Today</div>
            </Card>
          </div>

          <div className="hidden md:block">
            <TaskStreakTracker />
          </div>

          {showCategories && (
            <Card className="p-4 md:sticky md:top-0 md:z-20 md:bg-white/95 md:backdrop-blur">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={handleSearch} className="w-full sm:w-auto">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <Button variant={showOnlyMine ? 'default' : 'outline'} onClick={() => setShowOnlyMine(!showOnlyMine)} className="w-full sm:w-auto">
                  <Filter className="h-4 w-4 mr-2" />
                  {showOnlyMine ? 'My Tasks' : 'All Tasks'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Task Feed */}
      <div className="mt-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-gray-400 mb-2">
                <CheckSquare className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">No tasks found</h3>
              <p className="text-gray-500 mt-1">
                Create your first task to get started
              </p>
            </Card>
          ) : (
            <>
              {/* Mobile grouped sections */}
              <div className={`md:hidden space-y-6 ${focusMode ? 'pt-2' : ''}`}>
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

      {/* Create Task Wizard */}
      <CreateTaskWizard
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        tenantId={tenantId}
        userId={userId}
        onCreated={() => loadTasks()}
      />

      {/* Task Modal */}
      <TaskModal
        open={showTaskModal}
        onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
        task={selectedTask}
        tenantId={tenantId}
        userId={userId}
        onChanged={() => { loadTasks(); }}
      />

      {/* Email Preview Modal */}
      {emailPreview.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 z-[60]">
          <Card className="w-full h-full max-w-none md:max-w-2xl md:h-auto md:my-10 rounded-none md:rounded-xl overflow-y-auto">
            <div className="p-4 md:p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{emailPreview.action === 'accept' ? '✓ Accept Enquiry' : '↓ Decline Enquiry'}</h2>
                <Button variant="ghost" size="sm" onClick={() => setEmailPreview({ ...emailPreview, isOpen: false })}>✕</Button>
              </div>
              <div className="space-y-4 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                  <div className="text-sm text-gray-900">{emailPreview.recipientName ? `${emailPreview.recipientName} <${emailPreview.to}>` : emailPreview.to}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                  <Input value={emailPreview.subject} onChange={(e) => setEmailPreview({ ...emailPreview, subject: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
                  <textarea
                    value={emailPreview.body}
                    onChange={(e) => setEmailPreview({ ...emailPreview, body: e.target.value })}
                    rows={12}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setEmailPreview({ ...emailPreview, isOpen: false })} className="flex-1">Cancel</Button>
                  <Button
                    onClick={async () => {
                      if (!emailPreview.taskId || !emailPreview.action) return;
                      try {
                        const endpoint = emailPreview.action === 'accept' ? 'accept-enquiry' : 'decline-enquiry';
                        await apiFetch(`/tasks/${emailPreview.taskId}/actions/${endpoint}`, {
                          method: 'POST',
                          headers: { 'x-tenant-id': tenantId },
                          json: { subject: emailPreview.subject, body: emailPreview.body },
                        });
                        setEmailPreview({ ...emailPreview, isOpen: false });
                        await loadTasks();
                        alert('Email sent successfully!');
                      } catch (err) {
                        alert('Failed to send email');
                      }
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
