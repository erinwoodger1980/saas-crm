"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GitBranch, Plus, Calendar } from "lucide-react";

type DevTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  category: string | null;
  sprint: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  assignee: string | null;
  feedbackIds: string[];
  tenantIds: string[];
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
};

const STATUS_COLUMNS = [
  { key: "BACKLOG", label: "Backlog", color: "bg-gray-100" },
  { key: "TODO", label: "To Do", color: "bg-blue-100" },
  { key: "IN_PROGRESS", label: "In Progress", color: "bg-yellow-100" },
  { key: "IN_REVIEW", label: "In Review", color: "bg-purple-100" },
  { key: "TESTING", label: "Testing", color: "bg-orange-100" },
  { key: "DONE", label: "Done", color: "bg-green-100" },
  { key: "BLOCKED", label: "Blocked", color: "bg-red-100" }
];

function DevTasksContent() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<DevTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<DevTask | null>(null);
  const [formData, setFormData] = useState<Partial<DevTask>>({
    status: "BACKLOG",
    priority: "MEDIUM",
    type: "DEVELOPMENT"
  });
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [timerNotes, setTimerNotes] = useState("");

  // Check if we're creating from feedback
  useEffect(() => {
    const createFrom = searchParams?.get("createFrom");
    if (createFrom === "feedback") {
      const feedbackId = searchParams?.get("feedbackId");
      const title = searchParams?.get("title");
      const description = searchParams?.get("description");
      
      setFormData({
        status: "BACKLOG",
        priority: "MEDIUM",
        title: title || "",
        description: description || "",
        feedbackIds: feedbackId ? [feedbackId] : []
      });
      setShowCreateDialog(true);
    }
  }, [searchParams]);

  async function loadTasks() {
    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; tasks: DevTask[] }>("/dev/tasks");
      if (data.ok) setTasks(data.tasks);
    } catch (e: any) {
      console.error("Failed to load tasks:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveTimer() {
    try {
      const data = await apiFetch<{ ok: boolean; timer: any }>("/dev/timer/active");
      if (data.ok && data.timer) {
        setActiveTimer(data.timer);
      }
    } catch (e: any) {
      console.error("Failed to load active timer:", e);
    }
  }

  async function startTimer(taskId: string) {
    try {
      const data = await apiFetch<{ ok: boolean; timer: any }>("/dev/timer/start", {
        method: "POST",
        json: { devTaskId: taskId, notes: timerNotes }
      });
      if (data.ok) {
        setActiveTimer(data.timer);
        setTimerNotes("");
        await loadTasks(); // Reload to get updated actualHours
      }
    } catch (e: any) {
      alert("Failed to start timer: " + e.message);
    }
  }

  async function stopTimer() {
    if (!activeTimer) return;
    try {
      await apiFetch("/dev/timer/stop", {
        method: "POST",
        json: { notes: timerNotes }
      });
      setActiveTimer(null);
      setTimerNotes("");
      await loadTasks(); // Reload to get updated actualHours
    } catch (e: any) {
      alert("Failed to stop timer: " + e.message);
    }
  }

  function openTaskDetail(task: DevTask) {
    setSelectedTask(task);
    setScheduledDate("");
    setShowDetailDialog(true);
  }

  async function createTask() {
    try {
      if (editingTask) {
        // Update existing task
        const data = await apiFetch<{ ok: boolean; task: DevTask }>(`/dev/tasks/${editingTask.id}`, {
          method: "PATCH",
          json: formData
        });
        if (data.ok) {
          setTasks(prev => prev.map(t => t.id === editingTask.id ? data.task : t));
          
          // If scheduledDate is set and task has estimated hours, create/update assignment
          if (scheduledDate && data.task.estimatedHours) {
            await apiFetch("/dev/calendar/assignments", {
              method: "POST",
              json: {
                devTaskId: data.task.id,
                date: scheduledDate,
                allocatedHours: parseFloat(String(data.task.estimatedHours))
              }
            });
          }
          
          setShowCreateDialog(false);
          setFormData({ status: "BACKLOG", priority: "MEDIUM" });
          setScheduledDate("");
          setEditingTask(null);
        }
      } else {
        // Create new task
        const data = await apiFetch<{ ok: boolean; task: DevTask }>("/dev/tasks", {
          method: "POST",
          json: formData
        });
        if (data.ok) {
          setTasks(prev => [...prev, data.task]);
          
          // If scheduledDate is set and task has estimated hours, create assignment
          if (scheduledDate && data.task.estimatedHours) {
            await apiFetch("/dev/calendar/assignments", {
              method: "POST",
              json: {
                devTaskId: data.task.id,
                date: scheduledDate,
                allocatedHours: parseFloat(String(data.task.estimatedHours))
              }
            });
          }
          
          setShowCreateDialog(false);
          setFormData({ status: "BACKLOG", priority: "MEDIUM" });
          setScheduledDate("");
        }
      }
    } catch (e: any) {
      alert(`Failed to ${editingTask ? 'update' : 'create'} task: ` + e.message);
    }
  }

  async function updateTask(id: string, updates: Partial<DevTask>) {
    try {
      const data = await apiFetch<{ ok: boolean; task: DevTask }>(`/dev/tasks/${id}`, {
        method: "PATCH",
        json: updates
      });
      if (data.ok) {
        setTasks(prev => prev.map(t => t.id === id ? data.task : t));
        
        // If scheduledDate is set and task has estimated hours, create/update assignment
        if (scheduledDate && data.task.estimatedHours) {
          await apiFetch("/dev/calendar/assignments", {
            method: "POST",
            json: {
              devTaskId: id,
              date: scheduledDate,
              allocatedHours: parseFloat(String(data.task.estimatedHours))
            }
          });
        }
        
        setEditingTask(null);
        setScheduledDate("");
      }
    } catch (e: any) {
      alert("Failed to update task: " + e.message);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await apiFetch(`/dev/tasks/${id}`, { method: "DELETE" });
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e: any) {
      alert("Failed to delete task: " + e.message);
    }
  }

  useEffect(() => {
    loadTasks();
    loadActiveTimer();
    
    // Poll for timer updates every 5 seconds
    const interval = setInterval(() => {
      loadActiveTimer();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "border-l-4 border-red-500";
      case "HIGH": return "border-l-4 border-orange-500";
      case "MEDIUM": return "border-l-4 border-yellow-500";
      case "LOW": return "border-l-4 border-green-500";
      default: return "";
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GitBranch className="w-8 h-8" />
          Development Tasks
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/dev/calendar'}>
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </Button>
          <Button variant="outline" onClick={loadTasks}>Refresh</Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTask ? 'Edit' : 'Create'} Development Task</DialogTitle>
                <DialogDescription>
                  {editingTask ? 'Update task details and schedule' : 'Create a new development task and optionally schedule it'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={formData.title || ""}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Task title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Detailed description"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <Select 
                      value={formData.type || 'DEVELOPMENT'}
                      onValueChange={(v) => setFormData({...formData, type: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEVELOPMENT">Development</SelectItem>
                        <SelectItem value="BUG_FIX">Bug Fix</SelectItem>
                        <SelectItem value="FEATURE">Feature</SelectItem>
                        <SelectItem value="COACHING">Coaching</SelectItem>
                        <SelectItem value="FAMILY_TIME">Family Time</SelectItem>
                        <SelectItem value="HOUSEWORK">Housework</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="LEARNING">Learning</SelectItem>
                        <SelectItem value="MEETING">Meeting</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <Select 
                      value={formData.priority}
                      onValueChange={(v) => setFormData({...formData, priority: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Input
                      value={formData.category || ""}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      placeholder="Feature, Bug, etc."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Est. Hours</label>
                    <Input
                      type="number"
                      value={formData.estimatedHours || ""}
                      onChange={(e) => setFormData({...formData, estimatedHours: parseFloat(e.target.value)})}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Assignee</label>
                  <Input
                    value={formData.assignee || ""}
                    onChange={(e) => setFormData({...formData, assignee: e.target.value})}
                    placeholder="Developer name/email"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Scheduled Date</label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                  {scheduledDate && formData.estimatedHours && (
                    <p className="text-xs text-gray-500 mt-1">
                      Will create calendar assignment for {formData.estimatedHours}h
                    </p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => {
                    setShowCreateDialog(false);
                    setEditingTask(null);
                    setFormData({ status: "BACKLOG", priority: "MEDIUM" });
                  }}>Cancel</Button>
                  <Button onClick={createTask} disabled={!formData.title}>
                    {editingTask ? 'Update' : 'Create'} Task
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading tasks...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {STATUS_COLUMNS.map((column) => {
            const columnTasks = tasks.filter(t => t.status === column.key);
            return (
              <div key={column.key} className="space-y-3">
                <div className={`p-3 rounded-lg ${column.color}`}>
                  <h3 className="font-semibold text-sm">{column.label}</h3>
                  <div className="text-xs text-muted-foreground">{columnTasks.length} tasks</div>
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <Card 
                      key={task.id} 
                      className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${getPriorityColor(task.priority)}`}
                      onClick={() => openTaskDetail(task)}
                    >
                      <div className="space-y-2">
                        <div className="font-medium text-sm line-clamp-2">{task.title}</div>
                        <div className="flex gap-1 flex-wrap">
                          {task.type && (
                            <div className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              {task.type.replace(/_/g, ' ')}
                            </div>
                          )}
                          {task.category && (
                            <div className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {task.category}
                            </div>
                          )}
                        </div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </div>
                        )}
                        {task.estimatedHours && (
                          <div className="text-xs text-muted-foreground">
                            Est: {task.estimatedHours}h
                          </div>
                        )}
                        {task.assignee && (
                          <div className="text-xs text-muted-foreground">
                            👤 {task.assignee}
                          </div>
                        )}

                        <div className="flex gap-1 pt-2">
                          <Select
                            value={task.status}
                            onValueChange={(v) => updateTask(task.id, { status: v })}
                          >
                            <SelectTrigger className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_COLUMNS.map(col => (
                                <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTask(task.id);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                    selectedTask.priority === "CRITICAL" ? "bg-red-500" :
                    selectedTask.priority === "HIGH" ? "bg-orange-500" :
                    selectedTask.priority === "MEDIUM" ? "bg-yellow-500" :
                    "bg-green-500"
                  }`}></span>
                  {selectedTask.title}
                </DialogTitle>
                <DialogDescription>
                  View task details, track time, and manage task progress
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Task Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="ml-2">{STATUS_COLUMNS.find(c => c.key === selectedTask.status)?.label}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Priority:</span>
                    <span className="ml-2">{selectedTask.priority}</span>
                  </div>
                  {selectedTask.type && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Type:</span>
                      <span className="ml-2">{selectedTask.type.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {selectedTask.category && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Category:</span>
                      <span className="ml-2">{selectedTask.category}</span>
                    </div>
                  )}
                  {selectedTask.assignee && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Assignee:</span>
                      <span className="ml-2">{selectedTask.assignee}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-600">Estimated:</span>
                    <span className="ml-2">{selectedTask.estimatedHours || 0}h</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Actual:</span>
                    <span className="ml-2">{selectedTask.actualHours || 0}h</span>
                  </div>
                </div>

                {/* Description */}
                {selectedTask.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <div className="p-3 bg-gray-50 rounded whitespace-pre-wrap">
                      {selectedTask.description}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedTask.notes && (
                  <div>
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <div className="p-3 bg-gray-50 rounded whitespace-pre-wrap">
                      {selectedTask.notes}
                    </div>
                  </div>
                )}

                {/* Timer Section */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Time Tracking</h3>
                  
                  {activeTimer && activeTimer.devTaskId === selectedTask.id ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-green-700">Timer Running</div>
                            <div className="text-sm text-green-600">
                              Started: {new Date(activeTimer.startedAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-green-700">
                            {Math.floor((Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000 / 60)}m
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Notes (optional)</label>
                        <Input
                          value={timerNotes}
                          onChange={(e) => setTimerNotes(e.target.value)}
                          placeholder="What did you work on?"
                        />
                      </div>
                      
                      <Button onClick={stopTimer} className="w-full" variant="destructive">
                        Stop Timer
                      </Button>
                    </div>
                  ) : activeTimer ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                      <div className="font-medium text-yellow-700">
                        Timer active on another task: {activeTimer.devTask?.title}
                      </div>
                      <div className="text-sm text-yellow-600 mt-1">
                        Stop that timer before starting a new one
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Notes (optional)</label>
                        <Input
                          value={timerNotes}
                          onChange={(e) => setTimerNotes(e.target.value)}
                          placeholder="What are you working on?"
                        />
                      </div>
                      
                      <Button 
                        onClick={() => startTimer(selectedTask.id)} 
                        className="w-full"
                        disabled={selectedTask.status === "DONE" || selectedTask.status === "BLOCKED"}
                      >
                        Start Timer
                      </Button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-between border-t pt-4">
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this task?")) {
                        deleteTask(selectedTask.id);
                        setShowDetailDialog(false);
                      }
                    }}
                  >
                    Delete Task
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      setEditingTask(selectedTask);
                      setFormData(selectedTask);
                      setShowDetailDialog(false);
                      setShowCreateDialog(true);
                    }}>
                      Edit Task
                    </Button>
                    <Button variant="ghost" onClick={() => setShowDetailDialog(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DevTasksPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading tasks...</div>}>
      <DevTasksContent />
    </Suspense>
  );
}
