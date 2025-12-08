"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GitBranch, Plus, Calendar } from "lucide-react";

type DevTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
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

export default function DevTasksPage() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<DevTask | null>(null);
  const [formData, setFormData] = useState<Partial<DevTask>>({
    status: "BACKLOG",
    priority: "MEDIUM"
  });

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

  async function createTask() {
    try {
      const data = await apiFetch<{ ok: boolean; task: DevTask }>("/dev/tasks", {
        method: "POST",
        json: formData
      });
      if (data.ok) {
        setTasks(prev => [...prev, data.task]);
        setShowCreateDialog(false);
        setFormData({ status: "BACKLOG", priority: "MEDIUM" });
      }
    } catch (e: any) {
      alert("Failed to create task: " + e.message);
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
        setEditingTask(null);
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
                <DialogTitle>Create Development Task</DialogTitle>
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
                <div className="grid grid-cols-3 gap-3">
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
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                  <Button onClick={createTask} disabled={!formData.title}>Create Task</Button>
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
                    <Card key={task.id} className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${getPriorityColor(task.priority)}`}>
                      <div className="space-y-2">
                        <div className="font-medium text-sm line-clamp-2">{task.title}</div>
                        {task.category && (
                          <div className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded w-fit">
                            {task.category}
                          </div>
                        )}
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
                            <SelectTrigger className="h-7 text-xs">
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
                            onClick={() => deleteTask(task.id)}
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
    </div>
  );
}
