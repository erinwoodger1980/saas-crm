// web/src/components/tasks/CreateTaskWizard.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { 
  CheckSquare, 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  ClipboardList,
  ArrowRight,
  X
} from "lucide-react";

type TaskType = "TASK" | "COMMUNICATION" | "FOLLOW_UP" | "SCHEDULED" | "FORM" | "CHECKLIST";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  userId: string;
  onCreated?: () => void;
  relatedType?: string;
  relatedId?: string;
};

const TASK_TYPES = [
  {
    type: "TASK" as TaskType,
    icon: CheckSquare,
    label: "Task",
    description: "General work item or to-do",
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  {
    type: "COMMUNICATION" as TaskType,
    icon: Phone,
    label: "Communication",
    description: "Phone call, meeting, or conversation",
    color: "text-green-600",
    bgColor: "bg-green-50"
  },
  {
    type: "FOLLOW_UP" as TaskType,
    icon: Mail,
    label: "Follow-up",
    description: "Email follow-up with AI assistance",
    color: "text-purple-600",
    bgColor: "bg-purple-50"
  },
  {
    type: "SCHEDULED" as TaskType,
    icon: Calendar,
    label: "Recurring Task",
    description: "Task that repeats on a schedule",
    color: "text-orange-600",
    bgColor: "bg-orange-50"
  },
  {
    type: "FORM" as TaskType,
    icon: FileText,
    label: "Form",
    description: "Fill out or collect form data",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50"
  },
  {
    type: "CHECKLIST" as TaskType,
    icon: ClipboardList,
    label: "Checklist",
    description: "Multi-step checklist workflow",
    color: "text-rose-600",
    bgColor: "bg-rose-50"
  }
];

export function CreateTaskWizard({ open, onClose, tenantId, userId, onCreated, relatedType, relatedId }: Props) {
  const [step, setStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelectType = (type: TaskType) => {
    setSelectedType(type);
    setStep("details");
  };

  const handleBack = () => {
    setStep("type");
    setSelectedType(null);
  };

  const handleClose = () => {
    setStep("type");
    setSelectedType(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="task-wizard-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{step === "type" ? "Create New Task" : "Task Details"}</span>
            {step === "details" && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                ← Back
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        {step === 'type' && (
          <p id="task-wizard-desc" className="sr-only">Select the type of task to create, then enter its details in the wizard form.</p>
        )}

        {step === "type" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose the type of task you want to create
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TASK_TYPES.map((taskType) => {
                const Icon = taskType.icon;
                return (
                  <Card
                    key={taskType.type}
                    className={`p-6 cursor-pointer hover:shadow-lg transition-all ${taskType.bgColor} border-2 border-transparent hover:border-current ${taskType.color}`}
                    onClick={() => handleSelectType(taskType.type)}
                  >
                    <div className="space-y-3">
                      <div className={`w-12 h-12 rounded-xl ${taskType.bgColor} flex items-center justify-center`}>
                        <Icon className={`h-6 w-6 ${taskType.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{taskType.label}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {taskType.description}
                        </p>
                      </div>
                      <div className="flex items-center text-sm font-medium">
                        Select <ArrowRight className="h-4 w-4 ml-2" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : selectedType === "TASK" ? (
          <BasicTaskForm
            tenantId={tenantId}
            userId={userId}
            relatedType={relatedType}
            relatedId={relatedId}
            onCreated={() => {
              onCreated?.();
              handleClose();
            }}
            setSaving={setSaving}
            saving={saving}
          />
        ) : selectedType === "FORM" ? (
          <FormTaskCreator
            tenantId={tenantId}
            userId={userId}
            relatedType={relatedType}
            relatedId={relatedId}
            onCreated={() => {
              onCreated?.();
              handleClose();
            }}
            setSaving={setSaving}
            saving={saving}
          />
        ) : selectedType === "CHECKLIST" ? (
          <ChecklistCreator
            tenantId={tenantId}
            userId={userId}
            relatedType={relatedType}
            relatedId={relatedId}
            onCreated={() => {
              onCreated?.();
              handleClose();
            }}
            setSaving={setSaving}
            saving={saving}
          />
        ) : selectedType === "SCHEDULED" ? (
          <ScheduledTaskCreator
            tenantId={tenantId}
            userId={userId}
            relatedType={relatedType}
            relatedId={relatedId}
            onCreated={() => { onCreated?.(); handleClose(); }}
            setSaving={setSaving}
            saving={saving}
          />
        ) : selectedType === "FOLLOW_UP" ? (
          <FollowUpCreator
            tenantId={tenantId}
            userId={userId}
            relatedType={relatedType}
            relatedId={relatedId}
            onCreated={() => {
              onCreated?.();
              handleClose();
            }}
            setSaving={setSaving}
            saving={saving}
          />
        ) : selectedType === "COMMUNICATION" ? (
          <CommunicationTaskForm
            tenantId={tenantId}
            userId={userId}
            relatedType={relatedType}
            relatedId={relatedId}
            onCreated={() => {
              onCreated?.();
              handleClose();
            }}
            setSaving={setSaving}
            saving={saving}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Basic Task Form
function BasicTaskForm({ tenantId, userId, onCreated, setSaving, saving, relatedType, relatedId }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [dueAt, setDueAt] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      const isoDueAt = dueAt ? new Date(dueAt).toISOString() : undefined;
      await apiFetch("/tasks", {
        method: "POST",
        headers: { "x-tenant-id": tenantId, "x-user-id": userId },
        json: {
          title,
          description,
          priority,
          taskType: "MANUAL",
          relatedType: relatedType || "OTHER",
          relatedId: relatedId,
          assignees: userId ? [{ userId, role: "OWNER" }] : undefined,
          status: "OPEN",
          dueAt: isoDueAt
        }
      });
      onCreated();
    } catch (error) {
      console.error("Failed to create task:", error);
      alert("Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Task Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          autoFocus
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details, context, or instructions..."
          rows={4}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Priority</label>
          <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
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
          <label className="text-sm font-medium mb-2 block">Due Date</label>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleCreate} disabled={saving || !title.trim()}>
          Create Task
        </Button>
      </div>
    </div>
  );
}

// Form Task Creator - Select or create form
function FormTaskCreator({ tenantId, userId, onCreated, setSaving, saving, relatedType, relatedId }: any) {
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Array<{ label: string; type: string; options?: string }>>([]);
  const [requiresSignature, setRequiresSignature] = useState<boolean>(false);
  const [dueAt, setDueAt] = useState<string>("");
  const [scheduleForm, setScheduleForm] = useState<boolean>(false);
  const [pattern, setPattern] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY">("DAILY");
  const [interval, setInterval] = useState<number>(1);
  const [startAt, setStartAt] = useState<string>("");
  const addField = () => setFields(f => [...f, { label: "", type: "text" }]);
  const updateField = (i: number, patch: Partial<{ label: string; type: string; options?: string }>) => {
    setFields(f => f.map((field, idx) => idx === i ? { ...field, ...patch } : field));
  };
  const removeField = (i: number) => setFields(f => f.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!title.trim() || fields.length === 0 || fields.some(f => !f.label.trim())) return;
    setSaving(true);
    try {
      const schemaFields = fields.map(f => ({ label: f.label.trim(), type: f.type, options: f.type === 'select' && f.options ? f.options.split(',').map(o => o.trim()).filter(Boolean) : undefined })).map((f, idx) => ({ ...f, id: `f_${idx}_${Date.now()}` }));
      const isoDueAt = dueAt ? new Date(dueAt).toISOString() : undefined;
      const isoStart = startAt ? new Date(startAt).toISOString() : undefined;
      const baseJson: any = {
        title,
        description: `Form task with ${schemaFields.length} fields`,
        relatedType: relatedType || 'OTHER',
        relatedId: relatedId,
        status: 'OPEN',
        priority: 'MEDIUM',
        assignees: userId ? [{ userId, role: 'OWNER' }] : undefined,
        formSchema: { fields: schemaFields },
        requiresSignature: requiresSignature || undefined,
      };
      if (scheduleForm) {
        await apiFetch('/tasks', {
          method: 'POST',
          headers: { 'x-tenant-id': tenantId, 'x-user-id': userId },
          json: {
            ...baseJson,
            taskType: 'SCHEDULED',
            dueAt: isoStart,
            recurrencePattern: pattern,
            recurrenceInterval: interval,
          }
        });
      } else {
        await apiFetch('/tasks', {
          method: 'POST',
          headers: { 'x-tenant-id': tenantId, 'x-user-id': userId },
          json: {
            ...baseJson,
            taskType: 'FORM',
            dueAt: isoDueAt,
          }
        });
      }
      onCreated();
    } catch (e) {
      alert('Failed to create form task');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Form Title *</label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Site Survey Form" autoFocus />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Fields</label>
        <Button variant="outline" size="sm" onClick={addField}>+ Add Field</Button>
      </div>
      {fields.length === 0 && <p className="text-xs text-muted-foreground">No fields yet. Add your first field.</p>}
      <div className="space-y-3">
        {fields.map((f, i) => (
          <Card key={i} className="p-3 space-y-2">
            <div className="grid md:grid-cols-3 gap-2">
              <Input
                value={f.label}
                onChange={e => updateField(i, { label: e.target.value })}
                placeholder="Label"
                className="text-sm"
              />
              <Select value={f.type} onValueChange={(v: any) => updateField(i, { type: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={f.options || ''}
                onChange={e => updateField(i, { options: e.target.value })}
                placeholder={f.type === 'select' ? 'Options (comma separated)' : '—'}
                disabled={f.type !== 'select'}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => removeField(i)}>Remove</Button>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium mb-1 block">Due Date (optional)</label>
          <Input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 mt-6 md:mt-8">
          <input id="requiresSignature" type="checkbox" className="h-4 w-4" checked={requiresSignature} onChange={e => setRequiresSignature(e.target.checked)} />
          <label htmlFor="requiresSignature" className="text-sm">Require signature</label>
        </div>
      </div>

      <div className="mt-2 p-3 border rounded-lg">
        <div className="flex items-center gap-2">
          <input id="scheduleForm" type="checkbox" className="h-4 w-4" checked={scheduleForm} onChange={e => setScheduleForm(e.target.checked)} />
          <label htmlFor="scheduleForm" className="text-sm font-medium">Schedule this form</label>
        </div>
        {scheduleForm && (
          <div className="mt-3 grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Pattern</label>
              <Select value={pattern} onValueChange={(v: any) => setPattern(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Interval</label>
              <Input type="number" min={1} value={interval} onChange={e => setInterval(Math.max(1, Number(e.target.value)||1))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Start</label>
              <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleCreate} disabled={saving || !title.trim() || fields.length === 0 || fields.some(f => !f.label.trim())}>{scheduleForm ? 'Create Scheduled Form' : 'Create Form Task'}</Button>
      </div>
    </div>
  );
}

// Checklist Creator
function ChecklistCreator({ tenantId, userId, onCreated, setSaving, saving, relatedType, relatedId }: any) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>([""]);

  const addItem = () => setItems([...items, ""]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    const validItems = items.filter(i => i.trim());
    if (validItems.length === 0) return;

    setSaving(true);
    try {
      await apiFetch("/tasks", {
        method: "POST",
        headers: { "x-tenant-id": tenantId, "x-user-id": userId },
        json: {
          title,
          description: `Checklist with ${validItems.length} items:\n${validItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}`,
          taskType: "CHECKLIST",
          relatedType: relatedType || "OTHER",
          relatedId: relatedId,
          status: "OPEN",
          priority: "MEDIUM",
          assignees: userId ? [{ userId, role: "OWNER" }] : undefined,
        }
      });
      onCreated();
    } catch (error) {
      console.error("Failed to create checklist:", error);
      alert("Failed to create checklist");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Checklist Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., New Client Onboarding"
          autoFocus
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Checklist Items</label>
          <Button variant="outline" size="sm" onClick={addItem}>
            + Add Item
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder={`Step ${index + 1}`}
              />
              {items.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button 
          onClick={handleCreate} 
          disabled={saving || !title.trim() || items.filter(i => i.trim()).length === 0}
        >
          Create Checklist
        </Button>
      </div>
    </div>
  );
}

// Follow-up Creator - Email with AI
function FollowUpCreator({ tenantId, userId, onCreated, setSaving, saving, relatedType, relatedId }: any) {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState<"professional" | "friendly" | "formal">("professional");

  const handleCreate = async () => {
    if (!recipient.trim() || !subject.trim()) return;
    
    setSaving(true);
    try {
      await apiFetch("/tasks", {
        method: "POST",
        headers: { "x-tenant-id": tenantId, "x-user-id": userId },
        json: {
          title: `Follow-up: ${subject}`,
          description: `Email follow-up to ${recipient}\nTone: ${tone}\nContext: ${context}`,
          taskType: "FOLLOW_UP",
          relatedType: relatedType || "OTHER",
          relatedId: relatedId,
          status: "OPEN",
          priority: "MEDIUM",
          assignees: userId ? [{ userId, role: "OWNER" }] : undefined,
        }
      });
      onCreated();
    } catch (error) {
      console.error("Failed to create follow-up:", error);
      alert("Failed to create follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-purple-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-purple-900">AI-Powered Follow-up</h4>
            <p className="text-sm text-purple-700 mt-1">
              Create a task to send a follow-up email. AI will help draft the message based on your context and chosen tone.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Recipient Email *</label>
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="customer@example.com"
          type="email"
          autoFocus
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Subject *</label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Following up on our conversation"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Context / Notes</label>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Add context about what you discussed, what you need to follow up on, or any specific points to mention..."
          rows={4}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Email Tone</label>
        <Select value={tone} onValueChange={(v: any) => setTone(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="formal">Formal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button 
          onClick={handleCreate} 
          disabled={saving || !recipient.trim() || !subject.trim()}
        >
          Create Follow-up Task
        </Button>
      </div>
    </div>
  );
}

// Communication Task Form
function CommunicationTaskForm({ tenantId, userId, onCreated, setSaving, saving, relatedType, relatedId }: any) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"call" | "meeting" | "email">("call");
  const [notes, setNotes] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      const isoScheduled = scheduledFor ? new Date(scheduledFor).toISOString() : undefined;
      await apiFetch("/tasks", {
        method: "POST",
        headers: { "x-tenant-id": tenantId, "x-user-id": userId },
        json: {
          title,
          description: `${type.toUpperCase()}: ${notes}`,
          taskType: "COMMUNICATION",
          relatedType: relatedType || "OTHER",
          relatedId: relatedId,
          status: "OPEN",
          priority: "MEDIUM",
          dueAt: isoScheduled,
          assignees: userId ? [{ userId, role: "OWNER" }] : undefined,
        }
      });
      onCreated();
    } catch (error) {
      console.error("Failed to create communication:", error);
      alert("Failed to create communication");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Communication Type</label>
        <Select value={type} onValueChange={(v: any) => setType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="call">Phone Call</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Subject/Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's this communication about?"
          autoFocus
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Notes</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add agenda, talking points, or summary..."
          rows={4}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Scheduled For</label>
        <Input
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={handleCreate} disabled={saving || !title.trim()}>
          Create Communication
        </Button>
      </div>
    </div>
  );
}

// Scheduled Task Creator (top-level)
function ScheduledTaskCreator({ tenantId, userId, onCreated, setSaving, saving, relatedType, relatedId }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pattern, setPattern] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY">("DAILY");
  const [interval, setInterval] = useState<number>(1);
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [startAt, setStartAt] = useState<string>("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const isoStart = startAt ? new Date(startAt).toISOString() : undefined;
      await apiFetch('/tasks', {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId, 'x-user-id': userId },
        json: {
          title,
          description,
          taskType: 'SCHEDULED',
          relatedType: relatedType || 'OTHER',
          relatedId: relatedId,
          status: 'OPEN',
          priority,
          dueAt: isoStart,
          recurrencePattern: pattern,
          recurrenceInterval: interval,
          assignees: userId ? [{ userId, role: 'OWNER' }] : undefined,
        }
      });
      onCreated();
    } catch { alert('Failed to create scheduled task'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Title *</label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Weekly Project Review" autoFocus />
      </div>
      <div>
        <label className="text-sm font-medium mb-2 block">Description</label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Optional context" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Recurrence Pattern</label>
          <Select value={pattern} onValueChange={(v: any) => setPattern(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="QUARTERLY">Quarterly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Interval</label>
          <Input type="number" min={1} value={interval} onChange={e => setInterval(Math.max(1, Number(e.target.value)||1))} />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Priority</label>
          <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Start / First Due</label>
          <Input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleCreate} disabled={saving || !title.trim()}>Create Scheduled Task</Button>
      </div>
    </div>
  );
}
