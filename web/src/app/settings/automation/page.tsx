// web/src/app/settings/automation/page.tsx
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Play, Pause, Zap, Sparkles } from "lucide-react";
import { X } from "lucide-react";
import AutomationAI from "@/components/automation/AutomationAI";

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
  const [showAI, setShowAI] = useState(false);
  const [editorMode, setEditorMode] = useState<'manual' | 'ai'>('manual');

  // Field ↔ Task Links
  const [links, setLinks] = useState<any[]>([]);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [editingLink, setEditingLink] = useState<any | null>(null);

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
      loadLinks();
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

  const loadLinks = async () => {
    try {
      const response = await apiFetch<{ items: any[] }>("/automation/field-links", {
        headers: { "x-tenant-id": tenantId },
      });
      setLinks(response.items || []);
    } catch (error) {
      console.error("Failed to load field links:", error);
    }
  };

  const openLinkEditor = (link?: any) => {
    setEditingLink(link || null);
    setShowLinkEditor(true);
  };

  const closeLinkEditor = () => {
    setShowLinkEditor(false);
    setEditingLink(null);
  };

  const deleteLink = async (link: any) => {
    if (!confirm(`Delete link \"${link.label || link.fieldPath}\"?`)) return;
    try {
      await apiFetch(`/automation/field-links/${link.id}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      await loadLinks();
    } catch (error) {
      console.error("Failed to delete link:", error);
      alert("Failed to delete link");
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

  const openEditor = (rule?: AutomationRule, mode: 'manual' | 'ai' = 'manual') => {
    setEditingRule(rule || null);
    setEditorMode(mode);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingRule(null);
    setEditorMode('manual');
  };

  const handleSaved = () => {
    closeEditor();
    loadRules();
  };

  const handleAIRuleGenerated = (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Pre-fill the manual editor with the AI-generated rule
    setEditingRule({
      id: '',
      ...rule,
      createdAt: '',
      updatedAt: '',
    });
    setEditorMode('manual');
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
          <div className="flex gap-2">
            <Button onClick={() => openEditor(undefined, 'ai')} variant="outline" className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50">
              <Sparkles className="h-4 w-4" />
              AI Assistant
            </Button>
            <Button onClick={() => openEditor()} className="gap-2">
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          </div>
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
                          {/* Show linked field if configured on action */}
                          {((action as any).taskMeta?.linkedField?.linkId) && (() => {
                            const linkId = (action as any).taskMeta.linkedField.linkId;
                            const link = links.find(l => l.id === linkId);
                            return (
                              <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                Linked: {link ? (link.label || `${link.model}.${link.fieldPath}`) : `Link ${linkId}`}
                              </span>
                            );
                          })()}
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

        {/* Field ↔ Task Links */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-slate-900">Field ↔ Task Links</h2>
            <Button onClick={() => openLinkEditor()} className="gap-2">
              <Plus className="h-4 w-4" /> New Link
            </Button>
          </div>
          {links.length === 0 ? (
            <Card className="p-6 text-slate-600">No links configured yet.</Card>
          ) : (
            <div className="space-y-3">
              {links.map((link) => (
                <Card key={link.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{link.label || `${link.model}.${link.fieldPath}`}</div>
                    <div className="text-xs text-slate-600 mt-1">
                      {link.model}.{link.fieldPath} • Complete when: {formatCondition(link.completionCondition)} • On complete: {formatAction(link.onTaskComplete)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openLinkEditor(link)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteLink(link)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Dialog */}
      {showEditor && editorMode === 'ai' ? (
        <Dialog open={showEditor} onOpenChange={closeEditor}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Create Automation with AI
              </DialogTitle>
              <DialogDescription>
                Describe what you want to automate in plain English, and AI will create the rule for you
              </DialogDescription>
            </DialogHeader>
            <AutomationAI
              tenantId={tenantId}
              onRuleGenerated={handleAIRuleGenerated}
              onCancel={closeEditor}
            />
          </DialogContent>
        </Dialog>
      ) : showEditor ? (
        <RuleEditor
          open={showEditor}
          onClose={closeEditor}
          onSaved={handleSaved}
          rule={editingRule}
          tenantId={tenantId}
          userId={userId}
          users={users}
          links={links}
        />
      ) : null}

      {showLinkEditor && (
        <FieldLinkEditor
          open={showLinkEditor}
          onClose={closeLinkEditor}
          onSaved={() => { closeLinkEditor(); loadLinks(); }}
          tenantId={tenantId}
          link={editingLink}
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
  links,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  rule: AutomationRule | null;
  tenantId: string;
  userId: string;
  users: User[];
  links: any[];
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
  const [assignToUserId, setAssignToUserId] = useState(rule?.actions[0]?.assignToUserId || "UNASSIGNED");
  const [calculationType, setCalculationType] = useState(rule?.actions[0]?.dueAtCalculation.type || "RELATIVE_TO_FIELD");
  const [dateFieldName, setDateFieldName] = useState(rule?.actions[0]?.dueAtCalculation.fieldName || "deliveryDate");
  const [offsetDays, setOffsetDays] = useState(rule?.actions[0]?.dueAtCalculation.offsetDays?.toString() || "-20");
  const [reschedule, setReschedule] = useState(rule?.actions[0]?.rescheduleOnTriggerChange !== false);
  
  const [saving, setSaving] = useState(false);
  const [linkId, setLinkId] = useState<string>(((rule as any)?.actions?.[0]?.taskMeta?.linkedField?.linkId) || "");

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
            assignToUserId: assignToUserId && assignToUserId !== "UNASSIGNED" ? assignToUserId : undefined,
            relatedTo: entityType as any,
            dueAtCalculation: {
              type: calculationType,
              fieldName: calculationType === 'RELATIVE_TO_FIELD' ? dateFieldName : undefined,
              offsetDays: calculationType === 'RELATIVE_TO_FIELD' ? Number(offsetDays) : undefined,
            },
            rescheduleOnTriggerChange: reschedule,
            taskInstanceKey: `auto_${entityType}_{${entityType.toLowerCase()}Id}_${taskTitle.replace(/\s+/g, '_')}`,
            ...(linkId && linkId !== '__NONE__' ? { taskMeta: { linkedField: { type: 'fieldLink', linkId } } } : {}),
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
    PROJECT: [
      "startDate",
      "deliveryDate",
      // Fire Door Schedule fields
      "dateReceived",
      "signOffDate",
      "approxDeliveryDate",
      "blanksOrderedAt",
      "blanksExpectedAt",
      "blanksReceivedAt",
      "lippingsOrderedAt",
      "lippingsExpectedAt",
      "lippingsReceivedAt",
      "facingsOrderedAt",
      "facingsExpectedAt",
      "facingsReceivedAt",
      "glassOrderedAt",
      "glassExpectedAt",
      "glassReceivedAt",
      "cassettesOrderedAt",
      "cassettesExpectedAt",
      "cassettesReceivedAt",
      "timbersOrderedAt",
      "timbersExpectedAt",
      "timbersReceivedAt",
      "ironmongeryOrderedAt",
      "ironmongeryExpectedAt",
      "ironmongeryReceivedAt",
    ],
    QUOTE: ["dateQuoteSent"],
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Automation Rule" : "Create Automation Rule"}</DialogTitle>
          <DialogDescription>
            Configure when and how tasks are automatically created based on field changes
          </DialogDescription>
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
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPPORTUNITY">Opportunity</SelectItem>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="PROJECT">Project (Won Opportunity)</SelectItem>
                    <SelectItem value="QUOTE">Quote</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Trigger Type</label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger type" />
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
                      <SelectValue placeholder="Select field" />
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
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent >
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
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent >
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
                    <SelectContent >
                      <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
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
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent >
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

              {/* Link task to field */}
              <div className="border-t border-purple-200 pt-4 mt-4">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">🔗 Link this task to a field</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Field Link</label>
                    <Select value={linkId} onValueChange={setLinkId}>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="__NONE__">None</SelectItem>
                        {links.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.label || `${l.model}.${l.fieldPath}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">If set, the created task will be linked to this field and auto-complete / write-back based on the link configuration.</p>
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

function FieldLinkEditor({ open, onClose, onSaved, tenantId, link }: { open: boolean; onClose: () => void; onSaved: () => void; tenantId: string; link: any | null; }) {
  const [model, setModel] = useState<string>(link?.model || "FireDoorScheduleProject");
  const [fieldPath, setFieldPath] = useState<string>(link?.fieldPath || "blanksDateOrdered");
  const [label, setLabel] = useState<string>(link?.label || "");
  const [condKind, setCondKind] = useState<string>(link?.completionCondition?.kind || "NON_NULL");
  const [condValue, setCondValue] = useState<string>(link?.completionCondition?.value ?? "");
  const [actionKind, setActionKind] = useState<string>(link?.onTaskComplete?.kind || "SET_NOW");
  const [actionValue, setActionValue] = useState<string>(link?.onTaskComplete?.value ?? "");
  const [saving, setSaving] = useState(false);

  const models = [
    { value: "FireDoorScheduleProject", label: "Fire Door Project" },
    { value: "Lead", label: "Lead" },
    { value: "Opportunity", label: "Opportunity" },
    { value: "Quote", label: "Quote" },
  ];

  const modelFields: Record<string, string[]> = {
    FireDoorScheduleProject: [
      "dateReceived",
      "dateRequired",
      "approxDeliveryDate",
      "blanksDateOrdered",
      "blanksDateExpected",
      "blanksDateReceived",
      "lippingsDateOrdered",
      "lippingsDateExpected",
      "lippingsDateReceived",
      "facingsDateOrdered",
      "facingsDateExpected",
      "facingsDateReceived",
      "glassDateOrdered",
      "glassDateExpected",
      "glassDateReceived",
      "cassettesDateOrdered",
      "cassettesDateExpected",
      "cassettesDateReceived",
      "timbersDateOrdered",
      "timbersDateExpected",
      "timbersDateReceived",
      "ironmongeryDateOrdered",
      "ironmongeryDateExpected",
      "ironmongeryDateReceived",
      "deliveryDate",
      "installStart",
      "installEnd",
      "signOffDate",
      "blanksStatus",
      "lippingsStatus",
      "facingsStatus",
      "glassStatus",
      "cassettesStatus",
      "timbersStatus",
      "ironmongeryStatus",
      "doorPaperworkStatus",
      "finalCncSheetStatus",
      "finalChecksSheetStatus",
      "deliveryChecklistStatus",
      "framesPaperworkStatus",
      "certificationRequired",
      "invoiceStatus",
      "transportStatus",
      "snaggingStatus",
      "blanksChecked",
      "lippingsChecked",
      "facingsChecked",
      "glassChecked",
      "cassettesChecked",
      "timbersChecked",
      "ironmongeryChecked",
      "snaggingComplete",
      "fscRequired",
    ],
    Lead: [
      "capturedAt",
      "nextActionAt",
      "dateQuoteSent",
      "status",
      "deliveryDate",
      "startDate",
    ],
    Opportunity: [
      "startDate",
      "deliveryDate",
      "installationStartDate",
      "installationEndDate",
      "timberOrderedAt",
      "timberExpectedAt",
      "timberReceivedAt",
      "glassOrderedAt",
      "glassExpectedAt",
      "glassReceivedAt",
      "ironmongeryOrderedAt",
      "ironmongeryExpectedAt",
      "ironmongeryReceivedAt",
      "paintOrderedAt",
      "paintExpectedAt",
      "paintReceivedAt",
    ],
    Quote: [
      "dateQuoteSent",
      "deliveryDate",
    ],
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        model,
        fieldPath,
        label: label || undefined,
        completionCondition: { kind: condKind, ...(condKind === "EQUALS" ? { value: condValue } : {}) },
        onTaskComplete: actionKind ? { kind: actionKind, ...(actionKind === "SET_VALUE" ? { value: actionValue } : {}) } : undefined,
      };

      if (link?.id) {
        await apiFetch(`/automation/field-links/${link.id}`, {
          method: "PUT",
          headers: { "x-tenant-id": tenantId },
          json: payload,
        });
      } else {
        await apiFetch(`/automation/field-links`, {
          method: "POST",
          headers: { "x-tenant-id": tenantId },
          json: payload,
        });
      }

      onSaved();
    } catch (e) {
      console.error("Failed to save link", e);
      alert("Failed to save link");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{link ? "Edit Field ↔ Task Link" : "Create Field ↔ Task Link"}</DialogTitle>
          <DialogDescription>
            Link a field to a task so they update each other automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Model</label>
              <Select value={model} onValueChange={(newModel) => {
                setModel(newModel);
                // Reset field path when model changes
                const availableFields = modelFields[newModel] || [];
                if (availableFields.length > 0) {
                  setFieldPath(availableFields[0]);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent >
                  {models.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Field Path</label>
              <Select value={fieldPath} onValueChange={setFieldPath}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(modelFields[model] || []).map((field) => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Label (optional)</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Friendly name" />
          </div>

          <Card className="p-4 border-blue-200 bg-blue-50">
            <div className="font-semibold text-slate-900 mb-3">What action completes the task?</div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Condition</label>
                <Select value={condKind} onValueChange={setCondKind}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent >
                    <SelectItem value="NON_NULL">Field is set</SelectItem>
                    <SelectItem value="EQUALS">Field equals value</SelectItem>
                    <SelectItem value="DATE_SET">Field is a date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {condKind === "EQUALS" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Value</label>
                  <Input value={condValue} onChange={(e) => setCondValue(e.target.value)} placeholder="e.g., Printed in Office" />
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4 border-green-200 bg-green-50">
            <div className="font-semibold text-slate-900 mb-3">When the task is marked complete, update the field</div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Action</label>
                <Select value={actionKind} onValueChange={setActionKind}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent >
                    <SelectItem value="SET_NOW">Set to current date</SelectItem>
                    <SelectItem value="SET_VALUE">Set to specific value</SelectItem>
                    <SelectItem value="SET_TRUE">Set to true</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {actionKind === "SET_VALUE" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Value</label>
                  <Input value={actionValue} onChange={(e) => setActionValue(e.target.value)} placeholder="e.g., Printed in Office" />
                </div>
              )}
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : link ? "Update Link" : "Create Link"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatCondition(cond: any): string {
  if (!cond) return "—";
  if (cond.kind === "NON_NULL") return "field is set";
  if (cond.kind === "DATE_SET") return "field is a date";
  if (cond.kind === "EQUALS") return `equals \"${cond.value}\"`;
  return "custom";
}

function formatAction(act: any): string {
  if (!act) return "no change";
  if (act.kind === "SET_NOW") return "set to now";
  if (act.kind === "SET_TRUE") return "set true";
  if (act.kind === "SET_VALUE") return `set \"${act.value}\"`;
  return "custom";
}
