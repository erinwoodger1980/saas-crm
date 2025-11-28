// web/src/app/settings/automation/page.tsx
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Play, Pause, Zap } from "lucide-react";

type AutomationRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: string;
    entityType: string;
    fieldName?: string;
  };
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  actions: Array<{
    type: string;
    taskTitle: string;
    taskDescription?: string;
    taskType: string;
    priority: string;
    assignToUserId?: string;
    dueAtCalculation: {
      type: string;
      fieldName?: string;
      offsetDays?: number;
    };
    rescheduleOnTriggerChange: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

type User = {
  id: string;
  name: string;
  email: string;
};

export default function AutomationSettingsPage() {
  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  useEffect(() => {
    const ids = getAuthIdsFromJwt();
    if (ids) {
      setTenantId(ids.tenantId);
      setUserId(ids.userId);
    }
  }, []);

  useEffect(() => {
    if (tenantId) {
      loadRules();
      loadUsers();
    }
  }, [tenantId]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await apiFetch<{ items: AutomationRule[] }>("/automation-rules", {
        headers: { "x-tenant-id": tenantId },
      });
      setRules(response.items || []);
    } catch (error) {
      console.error("Failed to load automation rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiFetch<User[]>("/tenant/users", {
        headers: { "x-tenant-id": tenantId },
      });
      setUsers(response || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const toggleEnabled = async (rule: AutomationRule) => {
    try {
      await apiFetch(`/automation-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "x-tenant-id": tenantId },
        json: { enabled: !rule.enabled },
      });
      await loadRules();
    } catch (error) {
      console.error("Failed to toggle rule:", error);
      alert("Failed to toggle rule");
    }
  };

  const deleteRule = async (rule: AutomationRule) => {
    if (!confirm(`Delete automation rule "${rule.name}"?`)) return;
    try {
      await apiFetch(`/automation-rules/${rule.id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      await loadRules();
    } catch (error) {
      console.error("Failed to delete rule:", error);
      alert("Failed to delete rule");
    }
  };

  const openEditor = (rule?: AutomationRule) => {
    setEditingRule(rule || null);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingRule(null);
  };

  const handleSaved = () => {
    closeEditor();
    loadRules();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Zap className="h-8 w-8 text-indigo-600" />
              Task Automation
            </h1>
            <p className="text-slate-600 mt-1">
              Automatically create and schedule tasks based on field changes
            </p>
          </div>
          <Button onClick={() => openEditor()} className="gap-2">
            <Plus className="h-4 w-4" />
            New Rule
          </Button>
        </div>

        {/* Quick Start Guide */}
        <Card className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">💡 Example Use Cases</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white/60 rounded-lg p-4">
              <div className="font-semibold text-slate-800 mb-1">Order Materials Task</div>
              <div className="text-slate-600">
                When <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">deliveryDate</span> is set on an Opportunity,
                create "Order Materials" task 20 days before that date.
              </div>
            </div>
            <div className="bg-white/60 rounded-lg p-4">
              <div className="font-semibold text-slate-800 mb-1">Installation Prep</div>
              <div className="text-slate-600">
                When <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">installationStartDate</span> is set,
                create "Prepare Installation Team" task 3 days before.
              </div>
            </div>
          </div>
        </Card>

        {/* Rules List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading automation rules...</div>
        ) : rules.length === 0 ? (
          <Card className="p-12 text-center">
            <Zap className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No Automation Rules Yet</h3>
            <p className="text-slate-500 mb-4">
              Create your first rule to automatically schedule tasks based on project dates
            </p>
            <Button onClick={() => openEditor()}>Create Your First Rule</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{rule.name}</h3>
                      {rule.enabled ? (
                        <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Trigger:</span>
                        <code className="bg-slate-100 px-2 py-0.5 rounded">
                          {rule.trigger.entityType}.{rule.trigger.fieldName} {rule.trigger.type}
                        </code>
                      </div>
                      {rule.actions.map((action, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-medium">→</span>
                          <span>Create task: "{action.taskTitle}"</span>
                          {action.dueAtCalculation.type === 'RELATIVE_TO_FIELD' && (
                            <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                              {action.dueAtCalculation.offsetDays && action.dueAtCalculation.offsetDays > 0 ? '+' : ''}
                              {action.dueAtCalculation.offsetDays} days from {action.dueAtCalculation.fieldName}
                            </code>
                          )}
                          {action.rescheduleOnTriggerChange && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                              Auto-reschedule
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleEnabled(rule)}
                      title={rule.enabled ? "Pause rule" : "Activate rule"}
                    >
                      {rule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditor(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRule(rule)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      {showEditor && (
        <RuleEditor
          open={showEditor}
          onClose={closeEditor}
          onSaved={handleSaved}
          rule={editingRule}
          tenantId={tenantId}
          userId={userId}
          users={users}
        />
      )}
    </div>
  );
}

function RuleEditor({
  open,
  onClose,
  onSaved,
  rule,
  tenantId,
  userId,
  users,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  rule: AutomationRule | null;
  tenantId: string;
  userId: string;
  users: User[];
}) {
  const [name, setName] = useState(rule?.name || "");
  const [enabled, setEnabled] = useState(rule?.enabled !== false);
  const [triggerType, setTriggerType] = useState(rule?.trigger.type || "FIELD_UPDATED");
  const [entityType, setEntityType] = useState(rule?.trigger.entityType || "OPPORTUNITY");
  const [fieldName, setFieldName] = useState(rule?.trigger.fieldName || "deliveryDate");
  
  // Task action fields
  const [taskTitle, setTaskTitle] = useState(rule?.actions[0]?.taskTitle || "");
  const [taskDescription, setTaskDescription] = useState(rule?.actions[0]?.taskDescription || "");
  const [taskType, setTaskType] = useState(rule?.actions[0]?.taskType || "MANUAL");
  const [priority, setPriority] = useState(rule?.actions[0]?.priority || "MEDIUM");
  const [assignToUserId, setAssignToUserId] = useState(rule?.actions[0]?.assignToUserId || "");
  const [calculationType, setCalculationType] = useState(rule?.actions[0]?.dueAtCalculation.type || "RELATIVE_TO_FIELD");
  const [dateFieldName, setDateFieldName] = useState(rule?.actions[0]?.dueAtCalculation.fieldName || "deliveryDate");
  const [offsetDays, setOffsetDays] = useState(rule?.actions[0]?.dueAtCalculation.offsetDays?.toString() || "-20");
  const [reschedule, setReschedule] = useState(rule?.actions[0]?.rescheduleOnTriggerChange !== false);
  
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !taskTitle.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        enabled,
        trigger: {
          type: triggerType,
          entityType,
          fieldName: triggerType === 'FIELD_UPDATED' ? fieldName : undefined,
        },
        actions: [
          {
            type: "CREATE_TASK",
            taskTitle,
            taskDescription,
            taskType,
            priority,
            assignToUserId: assignToUserId || undefined,
            relatedTo: entityType as any,
            dueAtCalculation: {
              type: calculationType,
              fieldName: calculationType === 'RELATIVE_TO_FIELD' ? dateFieldName : undefined,
              offsetDays: calculationType === 'RELATIVE_TO_FIELD' ? Number(offsetDays) : undefined,
            },
            rescheduleOnTriggerChange: reschedule,
            taskInstanceKey: `auto_${entityType}_{${entityType.toLowerCase()}Id}_${taskTitle.replace(/\s+/g, '_')}`,
          },
        ],
      };

      if (rule) {
        await apiFetch(`/automation-rules/${rule.id}`, {
          method: "PATCH",
          headers: { "x-tenant-id": tenantId, "x-user-id": userId },
          json: payload,
        });
      } else {
        await apiFetch("/automation-rules", {
          method: "POST",
          headers: { "x-tenant-id": tenantId, "x-user-id": userId },
          json: payload,
        });
      }

      onSaved();
    } catch (error) {
      console.error("Failed to save rule:", error);
      alert("Failed to save rule. Please check the console for details.");
    } finally {
      setSaving(false);
    }
  };

  const availableFields: Record<string, string[]> = {
    OPPORTUNITY: [
      "deliveryDate",
      "installationStartDate",
      "installationEndDate",
      "startDate",
      "timberOrderedAt",
      "timberExpectedAt",
      "glassOrderedAt",
      "glassExpectedAt",
      "ironmongeryOrderedAt",
      "ironmongeryExpectedAt",
      "paintOrderedAt",
      "paintExpectedAt",
    ],
    LEAD: ["capturedAt", "nextActionAt"],
    PROJECT: ["startDate", "deliveryDate"],
    QUOTE: ["dateQuoteSent"],
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto z-[70]">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Automation Rule" : "Create Automation Rule"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rule Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Order Materials 20 Days Before Delivery"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="enabled" className="text-sm font-medium">
                Enable this rule
              </label>
            </div>
          </div>

          {/* Trigger Section */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">📌 Trigger</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Entity Type</label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPPORTUNITY">Opportunity</SelectItem>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="PROJECT">Project</SelectItem>
                    <SelectItem value="QUOTE">Quote</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Trigger Type</label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD_UPDATED">Field Updated</SelectItem>
                    <SelectItem value="STATUS_CHANGED">Status Changed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {triggerType === "FIELD_UPDATED" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Field Name</label>
                  <Select value={fieldName} onValueChange={setFieldName}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields[entityType]?.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </Card>

          {/* Action Section */}
          <Card className="p-4 bg-green-50 border-green-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">⚡ Action: Create Task</h3>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Task Title *</label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g., Order Materials"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Task Type</label>
                  <Select value={taskType} onValueChange={setTaskType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUAL">Manual Task</SelectItem>
                      <SelectItem value="COMMUNICATION">Communication</SelectItem>
                      <SelectItem value="CHECKLIST">Checklist</SelectItem>
                      <SelectItem value="FORM">Form</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Input
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Optional task description"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
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
                  <label className="text-sm font-medium mb-2 block">Assign To</label>
                  <Select value={assignToUserId} onValueChange={setAssignToUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Calculation */}
              <div className="border-t border-green-200 pt-4 mt-4">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">📅 Due Date Calculation</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Calculate From</label>
                    <Select value={dateFieldName} onValueChange={setDateFieldName}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields[entityType]?.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Offset (days)</label>
                    <Input
                      type="number"
                      value={offsetDays}
                      onChange={(e) => setOffsetDays(e.target.value)}
                      placeholder="-20"
                    />
                    <p className="text-xs text-slate-500 mt-1">Negative = before, Positive = after</p>
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center gap-2 pb-2">
                      <input
                        type="checkbox"
                        id="reschedule"
                        checked={reschedule}
                        onChange={(e) => setReschedule(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <label htmlFor="reschedule" className="text-sm">
                        Auto-reschedule if date changes
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
