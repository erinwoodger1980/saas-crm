// web/src/components/tasks/ScheduledTasksTab.tsx
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Repeat,
  Plus,
  Edit,
  Trash2,
  User,
  CheckSquare,
  PlayCircle,
  PauseCircle,
} from "lucide-react";

type RecurrencePattern = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
type TaskType = "MANUAL" | "COMMUNICATION" | "FOLLOW_UP" | "SCHEDULED" | "FORM" | "CHECKLIST";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type TaskTemplate = {
  id: string;
  name: string;
  description?: string;
  taskType: TaskType;
  defaultTitle: string;
  defaultDescription?: string;
  defaultPriority: TaskPriority;
  recurrencePattern?: RecurrencePattern;
  recurrenceInterval?: number;
  isActive: boolean;
  defaultAssigneeIds: string[];
  createdAt: string;
};

type User = {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
};

const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const TASK_TYPE_OPTIONS = [
  { value: "MANUAL", label: "Manual Task" },
  { value: "COMMUNICATION", label: "Communication" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CHECKLIST", label: "Checklist" },
];

export function ScheduledTasksTab() {
  const ids = getAuthIdsFromJwt();
  const tenantId = ids?.tenantId || "";
  const userId = ids?.userId || "";

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    taskType: "SCHEDULED" as TaskType,
    defaultTitle: "",
    defaultDescription: "",
    defaultPriority: "MEDIUM" as TaskPriority,
    recurrencePattern: "DAILY" as RecurrencePattern,
    recurrenceInterval: 1,
    defaultAssigneeIds: [] as string[],
  });

  useEffect(() => {
    loadTemplates();
    loadUsers();
  }, [tenantId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/tasks/templates", {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiFetch("/users", {
        headers: { "x-tenant-id": tenantId },
      });
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : data.items || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      taskType: "SCHEDULED",
      defaultTitle: "",
      defaultDescription: "",
      defaultPriority: "MEDIUM",
      recurrencePattern: "DAILY",
      recurrenceInterval: 1,
      defaultAssigneeIds: [],
    });
    setEditingTemplate(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      taskType: template.taskType,
      defaultTitle: template.defaultTitle,
      defaultDescription: template.defaultDescription || "",
      defaultPriority: template.defaultPriority,
      recurrencePattern: template.recurrencePattern || "DAILY",
      recurrenceInterval: template.recurrenceInterval || 1,
      defaultAssigneeIds: template.defaultAssigneeIds || [],
    });
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.defaultTitle.trim()) {
      alert("Please fill in required fields");
      return;
    }

    try {
      const url = editingTemplate
        ? `/tasks/templates/${editingTemplate.id}`
        : "/tasks/templates";
      const method = editingTemplate ? "PATCH" : "POST";

      await apiFetch(url, {
        method,
        headers: {
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
        json: formData,
      });

      const toast = document.createElement("div");
      toast.textContent = `✓ Template ${editingTemplate ? "updated" : "created"} successfully`;
      toast.className =
        "fixed bottom-6 right-6 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);

      setShowCreateModal(false);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
      alert("Failed to save template");
    }
  };

  const handleToggleActive = async (template: TaskTemplate) => {
    try {
      await apiFetch(`/tasks/templates/${template.id}`, {
        method: "PATCH",
        headers: {
          "x-tenant-id": tenantId,
          "Content-Type": "application/json",
        },
        json: { isActive: !template.isActive },
      });
      loadTemplates();
    } catch (error) {
      console.error("Failed to toggle template:", error);
      alert("Failed to toggle template");
    }
  };

  const handleDelete = async (template: TaskTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      await apiFetch(`/tasks/templates/${template.id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      alert("Failed to delete template");
    }
  };

  const getUserNames = (userIds: string[]) => {
    return userIds
      .map((id) => {
        const user = users.find((u) => u.id === id);
        return user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
          : null;
      })
      .filter(Boolean)
      .join(", ");
  };

  const getRecurrenceLabel = (template: TaskTemplate) => {
    if (!template.recurrencePattern) return "One-time";
    const pattern = RECURRENCE_LABELS[template.recurrencePattern];
    const interval = template.recurrenceInterval || 1;
    return interval > 1 ? `Every ${interval} ${pattern.toLowerCase()}` : pattern;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading scheduled tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Scheduled Tasks & Templates</h2>
          <p className="text-sm text-muted-foreground">
            Create recurring tasks that automatically generate on schedule
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No scheduled tasks yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first task template to automate recurring work
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`p-4 hover:shadow-lg transition-shadow ${
                !template.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold line-clamp-1">{template.name}</h3>
                      {!template.isActive && (
                        <Badge variant="outline" className="text-xs">
                          Paused
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckSquare className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{template.defaultTitle}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Repeat className="h-4 w-4" />
                    <span>{getRecurrenceLabel(template)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge
                      variant={
                        template.defaultPriority === "URGENT"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {template.defaultPriority}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {template.taskType}
                    </Badge>
                  </div>

                  {template.defaultAssigneeIds.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1">
                        {getUserNames(template.defaultAssigneeIds)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(template)}
                    className="flex-1"
                  >
                    {template.isActive ? (
                      <>
                        <PauseCircle className="h-4 w-4 mr-1" />
                        Pause
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Resume
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(template)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Task Template"}
            </DialogTitle>
            <DialogDescription>
              Configure a template that will automatically create tasks on a schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Template Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Daily Safety Check"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Task Type</label>
                <Select
                  value={formData.taskType}
                  onValueChange={(value: TaskType) =>
                    setFormData((prev) => ({ ...prev, taskType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Brief description of this template"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Task Details</h4>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Task Title *
                  </label>
                  <Input
                    value={formData.defaultTitle}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        defaultTitle: e.target.value,
                      }))
                    }
                    placeholder="e.g., Complete safety inspection"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Task Description
                  </label>
                  <textarea
                    value={formData.defaultDescription}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        defaultDescription: e.target.value,
                      }))
                    }
                    placeholder="Instructions for completing this task"
                    className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Priority</label>
                    <Select
                      value={formData.defaultPriority}
                      onValueChange={(value: TaskPriority) =>
                        setFormData((prev) => ({ ...prev, defaultPriority: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Recurrence
                    </label>
                    <Select
                      value={formData.recurrencePattern}
                      onValueChange={(value: RecurrencePattern) =>
                        setFormData((prev) => ({
                          ...prev,
                          recurrencePattern: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Repeat Every
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={formData.recurrenceInterval}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          recurrenceInterval: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      {RECURRENCE_LABELS[formData.recurrencePattern].toLowerCase()}(s)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Assign To Users
                  </label>
                  <Select
                    value={formData.defaultAssigneeIds[0] || ""}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        defaultAssigneeIds: value ? [value] : [],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No assignment</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                            user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tasks will be automatically assigned to this user when created
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || !formData.defaultTitle.trim()}
            >
              {editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
