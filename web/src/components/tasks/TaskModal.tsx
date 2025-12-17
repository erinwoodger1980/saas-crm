// web/src/components/tasks/TaskModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FollowUpTaskPanel } from "@/components/follow-up/FollowUpTaskPanel";
import { FileText, CheckSquare } from "lucide-react";

type RecurrencePattern = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  taskType?: "MANUAL" | "COMMUNICATION" | "FOLLOW_UP" | "SCHEDULED" | "FORM" | "CHECKLIST";
  relatedType: "LEAD" | "PROJECT" | "QUOTE" | "EMAIL" | "QUESTIONNAIRE" | "WORKSHOP" | "OTHER";
  relatedId?: string | null;
  dueAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  assignees?: { userId: string; role: "OWNER" | "FOLLOWER" }[];
  meta?: any;
  formSchema?: { fields?: Array<{ id?: string; key?: string; label?: string; type?: string; required?: boolean; options?: string[] }> } | null;
  formSubmissions?: any[] | null;
  checklistItems?: Array<{ id: string; label: string; completed?: boolean; completedBy?: string; completedAt?: string }>; 
  recurrencePattern?: RecurrencePattern | null;
  recurrenceInterval?: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  tenantId: string;
  userId: string;
  onChanged?: () => void;
};

export function TaskModal({ open, onClose, task, tenantId, userId, onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Task | null>(task);
  const [authHeaders, setAuthHeaders] = useState<Record<string,string>>({ "x-tenant-id": tenantId, "x-user-id": userId });
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submittingForm, setSubmittingForm] = useState(false);
  const [checklistBusy, setChecklistBusy] = useState<string | null>(null);
  const [scheduleEdit, setScheduleEdit] = useState<{ pattern: RecurrencePattern; interval: number }>({ pattern: "DAILY", interval: 1 });
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; size: number; mimeType: string; uploadedAt: string; base64?: string }>>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [newFormField, setNewFormField] = useState<{ label: string; type: string; options?: string }>(() => ({ label: "", type: "text", options: "" }));
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assigneeBusy, setAssigneeBusy] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [emailThread, setEmailThread] = useState<Array<{ id: string; subject?: string; from?: string; to?: string; date?: string; snippet?: string; body?: string }>>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [fieldLinks, setFieldLinks] = useState<Array<{ id: string; model: string; fieldPath: string; label?: string }>>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");
  const [linkedRecordId, setLinkedRecordId] = useState<string>("");
  const [leadAttachments, setLeadAttachments] = useState<Array<{ filename?: string; name?: string; url?: string; path?: string }>>([]);
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [moreInfoSubject, setMoreInfoSubject] = useState("Could you provide a few more details?");
  const [moreInfoBody, setMoreInfoBody] = useState("Hi there,\n\nTo help us move forward, could you please answer a few quick questions here: {{QUESTIONNAIRE_LINK}}\n\nThanks!");
  const [leadDetails, setLeadDetails] = useState<any>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<{ subject: string; body: string; endpoint: string } | null>(null);
  const [quoteTaskAutoCreated, setQuoteTaskAutoCreated] = useState(false);
  const isNewTask = !task;

  useEffect(() => {
    if (!task) {
      // Initialize new task form
      setForm({
        id: "",
        title: "",
        description: "",
        status: "OPEN",
        priority: "MEDIUM",
         taskType: "MANUAL",
        relatedType: "OTHER",
        relatedId: null,
        dueAt: null,
      });
    } else {
      setForm(task);
      console.log('[TaskModal] Task loaded:', {
        id: task.id,
        taskType: task.taskType,
        hasFormSchema: !!task.formSchema,
        formFields: task.formSchema?.fields?.length || 0,
        hasChecklistItems: !!task.checklistItems,
        checklistCount: task.checklistItems?.length || 0
      });
      // Seed schedule edit panel
      if (task.recurrencePattern) {
        setScheduleEdit({ pattern: task.recurrencePattern, interval: task.recurrenceInterval || 1 });
      }
      // Seed form data with empty defaults
      if (task.taskType === "FORM" && task.formSchema?.fields) {
        const initial: Record<string, any> = {};
        task.formSchema.fields.forEach(f => {
          const key = f.key || f.id || f.label || "field";
          initial[key] = "";
        });
        setFormData(initial);
      }
      // Seed attachments from meta
      const existing = (task.meta?.attachments as any[]) || [];
      if (Array.isArray(existing)) {
        const norm = existing.map(a => ({
          id: a.id || crypto.randomUUID(),
          filename: a.filename || a.name || 'file',
          size: a.size || 0,
          mimeType: a.mimeType || 'application/octet-stream',
          uploadedAt: a.uploadedAt || new Date().toISOString(),
          base64: a.base64,
        }));
        setAttachments(norm);
      }
    }
  }, [task, open]);

  // Load client email chain for follow-up or enquiry review tasks
  useEffect(() => {
    if (!open || !form || isNewTask) return;
    const isFollowUp = form.taskType === 'FOLLOW_UP';
    const titleLC = (form.title || '').toLowerCase();
    const isReviewEnquiry = titleLC.includes('review') && titleLC.includes('enquiry');
    const leadId = form.relatedType === 'LEAD' ? form.relatedId : null;
    if (!(isFollowUp || isReviewEnquiry) || !leadId) return;
    let cancelled = false;
    async function loadEmails() {
      setEmailLoading(true);
      try {
        const res: any = await apiFetch(`/leads/${leadId}/emails`, {
          method: 'GET',
          headers: authHeaders,
        });
        if (!cancelled && Array.isArray(res?.items)) {
          setEmailThread(res.items);
        }
        // also fetch lead attachments for full context
        const leadRes: any = await apiFetch(`/leads/${leadId}`, {
          method: 'GET',
          headers: authHeaders,
        });
        if (!cancelled) {
          setLeadDetails(leadRes);
        }
        if (!cancelled && Array.isArray(leadRes?.attachments)) {
          setLeadAttachments(leadRes.attachments);
        } else if (!cancelled) {
          setLeadAttachments([]);
        }
      } catch (e) {
        // non-blocking
      } finally {
        if (!cancelled) setEmailLoading(false);
      }
    }
    loadEmails();
    return () => { cancelled = true; };
  }, [open, form?.id, form?.taskType, form?.relatedId, form?.relatedType]);

  // Auto-create a "Create Quote" task when questionnaire info is received/completed
  useEffect(() => {
    if (!open || !form || quoteTaskAutoCreated) return;
    const leadId = form.relatedType === 'LEAD' ? form.relatedId : null;
    if (!leadId) return;
    const completed = Boolean(
      leadDetails?.questionnaireCompleted ||
      leadDetails?.questionnaireStatus === 'COMPLETED' ||
      leadDetails?.hasEstimatorResponses ||
      (Array.isArray(leadDetails?.questionnaireAnswers) && leadDetails.questionnaireAnswers.length > 0)
    );
    if (!completed) return;
    (async () => {
      try {
        const created: any = await apiFetch('/tasks', {
          method: 'POST',
          headers: authHeaders,
          json: {
            title: 'Create Quote',
            description: 'Auto-created after questionnaire completion; prepare customer quote.',
            status: 'OPEN',
            priority: 'HIGH',
            taskType: 'MANUAL',
            relatedType: 'LEAD',
            relatedId: leadId,
          },
        });
        // Tag current task meta with link to the created quote task
        if (form?.id && created?.id) {
          try {
            await apiFetch(`/tasks/${form.id}`, {
              method: 'PATCH',
              headers: authHeaders,
              json: { meta: { ...(form.meta || {}), quoteTaskCreated: true, quoteTaskId: created.id } },
            });
            setForm(prev => prev ? { ...prev, meta: { ...(prev.meta || {}), quoteTaskCreated: true, quoteTaskId: created.id } } : prev);
          } catch {}
        }
        // Mark current follow-up/review task as completed
        if (form?.id) {
          try {
            await apiFetch(`/tasks/${form.id}/complete`, { method: 'POST', headers: authHeaders });
            setForm(prev => prev ? { ...prev, status: 'DONE', completedAt: new Date().toISOString() } : prev);
          } catch {}
        }
        setQuoteTaskAutoCreated(true);
        toast('Quote task auto-created');
        onChanged?.();
      } catch {
        // non-blocking
      }
    })();
  }, [open, leadDetails, form?.relatedId, form?.relatedType, quoteTaskAutoCreated]);

  // Load users for assignment when modal opens (and task exists)
  useEffect(() => {
    if (!open || isNewTask) return;
    let cancelled = false;
    async function load() {
      setLoadingUsers(true);
      try {
        const res: any = await apiFetch('/workshop/users', {
          method: 'GET',
          headers: { 'x-tenant-id': tenantId, 'x-user-id': userId },
        });
        if (!cancelled && (res as any)?.items) {
          const list = (res as any).items as any[];
          const safe = list.map(u => ({ id: u.id, name: u.name || (u.firstName ? `${u.firstName} ${u.lastName||''}`.trim() : 'User'), email: u.email }));
          setUsers(safe);
        }
      } catch {}
      finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, isNewTask, tenantId, userId]);

  // Load field links when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadLinks() {
      try {
        const res: any = await apiFetch('/automation/field-links', {
          method: 'GET',
          headers: authHeaders,
        });
        if (!cancelled && Array.isArray(res?.items)) {
          setFieldLinks(res.items);
          // Pre-populate if task already has a field link
          const existingLink = form?.meta?.linkedField;
          if (existingLink?.type === 'fieldLink' && existingLink?.linkId && existingLink?.recordId) {
            setSelectedLinkId(existingLink.linkId);
            setLinkedRecordId(existingLink.recordId);
          }
        }
      } catch (e) {
        console.error('Failed to load field links:', e);
      }
    }
    loadLinks();
    return () => { cancelled = true; };
  }, [open, authHeaders, form?.meta]);

  async function modifyAssignees(addIds: string[] = [], removeIds: string[] = []) {
    if (!form || isNewTask || (!addIds.length && !removeIds.length)) return;
    setAssigneeBusy(true);
    try {
      await apiFetch(`/tasks/${form.id}/assignees`, {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId, 'x-user-id': userId },
        json: {
          add: addIds.map(id => ({ userId: id, role: 'OWNER' })),
          remove: removeIds,
        },
      });
      // Refresh task locally
      setForm(prev => prev ? {
        ...prev,
        assignees: (prev.assignees || [])
          .filter(a => !removeIds.includes(a.userId))
          .concat(addIds.map(id => ({ userId: id, role: 'OWNER' as any })))
      } : prev);
      onChanged?.();
      toast('Assignees updated');
    } catch (e: any) {
      toast('Failed to update assignees');
    } finally {
      setAssigneeBusy(false);
      setAddUserId("");
    }
  }

  async function linkToField() {
    if (!form || isNewTask || !selectedLinkId || !linkedRecordId.trim()) return;
    setSaving(true);
    try {
      const newMeta = {
        ...(form.meta || {}),
        linkedField: {
          type: 'fieldLink',
          linkId: selectedLinkId,
          recordId: linkedRecordId.trim(),
        },
      };
      await update({ meta: newMeta as any });
      setForm(prev => prev ? { ...prev, meta: newMeta } : prev);
      toast('Task linked to field');
    } catch (e) {
      toast('Failed to link task to field');
    } finally {
      setSaving(false);
    }
  }

  async function unlinkFromField() {
    if (!form || isNewTask) return;
    setSaving(true);
    try {
      const newMeta = { ...(form.meta || {}) };
      delete (newMeta as any).linkedField;
      await update({ meta: newMeta as any });
      setForm(prev => prev ? { ...prev, meta: newMeta } : prev);
      setSelectedLinkId("");
      setLinkedRecordId("");
      toast('Task unlinked from field');
    } catch (e) {
      toast('Failed to unlink task');
    } finally {
      setSaving(false);
    }
  }

  const assignedIds = new Set((form?.assignees || []).map(a => a.userId));
  const unassignedUsers = users.filter(u => !assignedIds.has(u.id));
  function toast(msg: string) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className =
      "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-xl shadow-lg z-[1000]";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  const dueISO = useMemo(() => {
    if (!form?.dueAt) return "";
    const d = new Date(form.dueAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [form?.dueAt]);

  const dueLabel = useMemo(() => {
    if (!form?.dueAt) return "No due date";
    try {
      return new Date(form.dueAt).toLocaleString();
    } catch {
      return "No due date";
    }
  }, [form?.dueAt]);

  if (!open || !form) return null;

  async function createTask() {
    if (!form || !form.title.trim()) {
      toast("Please enter a task title");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || "",
        status: form.status,
        priority: form.priority,
        taskType: form.taskType || "MANUAL",
        relatedType: form.relatedType,
        relatedId: form.relatedId || undefined,
        dueAt: form.dueAt || undefined,
      };
      await apiFetch("/tasks", {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
        json: payload,
      });
      toast("✅ Task created!");
      onChanged?.();
      onClose();
    } catch (e: any) {
      toast("Failed to create task: " + (e.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function update(fields: Partial<Task>) {
    if (!form || isNewTask) return;
    setSaving(true);
    try {
      const payload: Partial<Task> = {
        ...fields,
        dueAt: fields.dueAt === "" ? null : fields.dueAt,
      };
      await apiFetch(`/tasks/${form.id}`, {
        method: "PATCH",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
        json: payload,
      });
      setForm((prev) => (prev ? { ...prev, ...payload } : prev));
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  async function saveAttachments(next: typeof attachments) {
    if (!form || isNewTask) return;
    try {
      await apiFetch(`/tasks/${form.id}`, {
        method: 'PATCH',
        headers: { 'x-tenant-id': tenantId, 'x-user-id': userId },
        json: { meta: { ...(form.meta || {}), attachments: next } },
      });
      setForm(prev => prev ? { ...prev, meta: { ...(prev.meta || {}), attachments: next } } : prev);
      onChanged?.();
      toast('Attachments saved');
    } catch (e: any) {
      toast('Failed to save attachments');
    }
  }

  async function handleAttachmentFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    setUploadingAttachments(true);
    try {
      const newOnes: typeof attachments = [];
      for (const file of Array.from(fileList)) {
        const base64 = await fileToBase64(file);
        newOnes.push({
          id: crypto.randomUUID(),
          filename: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          base64,
        });
      }
      const merged = [...attachments, ...newOnes];
      setAttachments(merged);
      await saveAttachments(merged);
    } finally {
      setUploadingAttachments(false);
    }
  }

  function removeAttachment(id: string) {
    const next = attachments.filter(a => a.id !== id);
    setAttachments(next);
    saveAttachments(next);
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',').pop() || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function startTask() {
    if (!form) return;
    setSaving(true);
    try {
      await apiFetch(`/tasks/${form.id}/start`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
      });
      setForm((prev) => (prev ? { ...prev, status: "IN_PROGRESS" } : prev));
      onChanged?.();
      toast("Getting this moving—nice.");
    } finally {
      setSaving(false);
    }
  }

  async function completeTask() {
    if (!form) return;
    setSaving(true);
    try {
      await apiFetch(`/tasks/${form.id}/complete`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
        },
      });
      setForm((prev) =>
        prev ? { ...prev, status: "DONE", completedAt: new Date().toISOString() } : prev
      );
      onChanged?.();
      confetti();
      toast("✅ Done! That’s progress you can feel.");
    } finally {
      setSaving(false);
    }
  }

  async function submitFormTask() {
    if (!form || form.taskType !== "FORM" || !form.formSchema?.fields) return;
    setSubmittingForm(true);
    try {
      await apiFetch(`/tasks/${form.id}/form-submission`, {
        method: "POST",
        headers: authHeaders,
        json: formData,
      });
      toast("Form submitted ✔");
      onChanged?.();
      onClose();
    } catch (e: any) {
      toast("Failed to submit form: " + (e.message || "error"));
    } finally {
      setSubmittingForm(false);
    }
  }

  async function toggleChecklist(itemId: string, completed: boolean) {
    if (!form || form.taskType !== "CHECKLIST") return;
    setChecklistBusy(itemId);
    try {
      await apiFetch(`/tasks/${form.id}/checklist`, {
        method: "PATCH",
        headers: authHeaders,
        json: { itemId, completed },
      });
      // Optimistic update
      setForm(prev => {
        if (!prev?.checklistItems) return prev;
        return {
          ...prev,
          checklistItems: prev.checklistItems.map(i => i.id === itemId ? { ...i, completed } : i),
        };
      });
      onChanged?.();
    } catch (e: any) {
      toast("Checklist update failed");
    } finally {
      setChecklistBusy(null);
    }
  }

  async function convertToScheduled() {
    if (!form) return;
    try {
      await update({ taskType: "SCHEDULED" as any, recurrencePattern: scheduleEdit.pattern as any, recurrenceInterval: scheduleEdit.interval });
      toast("Task scheduled ✅");
    } catch (e: any) {
      toast("Failed to schedule task");
    }
  }

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const count = 24;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.textContent = "✨";
      s.style.position = "fixed";
      s.style.left = Math.random() * 100 + "vw";
      s.style.top = "-2vh";
      s.style.fontSize = "18px";
      s.style.transition = "transform 1.4s ease, opacity 1.4s ease";
      s.style.opacity = "1";
      document.body.appendChild(s);
      const x = (Math.random() - 0.5) * 200;
      const y = 120 + Math.random() * 200;
      requestAnimationFrame(() => {
        s.style.transform = `translate(${x}px, ${y}vh) rotate(${(Math.random() - 0.5) * 180}deg)`;
        s.style.opacity = "0";
      });
      setTimeout(() => s.remove(), 1500);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-gradient-to-br from-sky-500/40 via-indigo-900/40 to-rose-400/40 backdrop-blur-sm overflow-y-auto px-4 py-4 md:py-12"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full md:max-w-3xl my-auto md:my-0 overflow-hidden md:rounded-3xl rounded-2xl border border-white/30 md:border-white/40 bg-white md:bg-white/90 p-4 md:p-6 shadow-[0_35px_80px_-35px_rgba(30,64,175,0.45)] max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-6rem)]">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-20 h-56 w-56 rounded-full bg-rose-200/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-300/40 blur-3xl" />

        <div className="relative space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)] md:max-h-[calc(100vh-8rem)]">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 space-y-2">
              <input
                className="w-full bg-transparent text-2xl font-semibold tracking-tight text-slate-800 outline-none placeholder:text-slate-400"
                value={form.title}
                onChange={(e) => setForm(prev => prev ? {...prev, title: e.target.value} : prev)}
                onBlur={(e) => !isNewTask && update({ title: e.currentTarget.value })}
                placeholder="Task title"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {!isNewTask && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      <span aria-hidden="true">🔗</span>
                      {form.relatedType.toLowerCase()}
                    </span>
                    <span>{form.relatedId || "No related record"}</span>
                    {form.assignees?.length ? (
                      <span>
                        · {form.assignees.length === 1 ? "Assigned to 1 person" : `Assigned to ${form.assignees.length} people`}
                      </span>
                    ) : null}
                  </>
                )}
                {isNewTask && <span className="text-slate-400">Create a new task</span>}
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Close
            </Button>
          </header>

         <div className="grid gap-4 md:grid-cols-3">
           <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                 <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task Type</div>
                 <select
                   value={form.taskType || "MANUAL"}
                   onChange={(e) => {
                     const newType = e.target.value as Task["taskType"];
                     setForm(prev => prev ? {...prev, taskType: newType} : prev);
                     !isNewTask && update({ taskType: newType });
                   }}
                   className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                 >
                   <option value="MANUAL">Manual Task</option>
                   <option value="COMMUNICATION">Communication</option>
                   <option value="FOLLOW_UP">Follow-up</option>
                   <option value="SCHEDULED">Scheduled</option>
                   <option value="FORM">Form</option>
                   <option value="CHECKLIST">Checklist</option>
                 </select>
             </div>
       
             <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
              <select
                value={form.status}
                onChange={(e) => {
                  const newStatus = e.target.value as Task["status"];
                  setForm(prev => prev ? {...prev, status: newStatus} : prev);
                  !isNewTask && update({ status: newStatus });
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              >
                {["OPEN", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ").toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</div>
              <select
                value={form.priority}
                onChange={(e) => {
                  const newPriority = e.target.value as Task["priority"];
                  setForm(prev => prev ? {...prev, priority: newPriority} : prev);
                  !isNewTask && update({ priority: newPriority });
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              >
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
           <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm md:col-span-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</div>
              <input
                type="datetime-local"
                value={dueISO}
                onChange={(e) => {
                  setForm(prev => prev ? {...prev, dueAt: e.target.value || null} : prev);
                  !isNewTask && update({ dueAt: e.target.value });
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
              />
            </div>

           <div className="md:col-span-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
                <textarea
                  value={form.description || ""}
                  onChange={(e) => setForm(prev => prev ? {...prev, description: e.target.value} : prev)}
                  onBlur={(e) => !isNewTask && update({ description: e.currentTarget.value })}
                  placeholder="Add context, next steps, or links"
                  className="mt-2 min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            {/* FIELD LINK SECTION */}
            {!isNewTask && (
              <div className="md:col-span-3">
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Field Link</div>
                    {form?.meta?.linkedField?.type === 'fieldLink' && (
                      <button
                        onClick={unlinkFromField}
                        disabled={saving}
                        className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                  {form?.meta?.linkedField?.type === 'fieldLink' ? (
                    <div className="space-y-2">
                      <div className="rounded-lg bg-white p-3 text-sm">
                        <div className="font-medium text-emerald-900">Linked to Field</div>
                        {(() => {
                          const link = fieldLinks.find(l => l.id === form.meta.linkedField.linkId);
                          return link ? (
                            <div className="mt-1 text-xs text-slate-600">
                              {link.label || `${link.model}.${link.fieldPath}`}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-slate-600">
                              Link ID: {form.meta.linkedField.linkId}
                            </div>
                          );
                        })()}
                        <div className="text-xs text-slate-600">
                          Record: {form.meta.linkedField.recordId}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">
                        This task is bidirectionally linked to a field. When the field changes, this task auto-completes. When you complete this task, the field updates.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600">
                        Link this task to a field for bidirectional updates
                      </p>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Field Link</label>
                        <select
                          value={selectedLinkId}
                          onChange={(e) => setSelectedLinkId(e.target.value)}
                          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
                        >
                          <option value="">Select a field link...</option>
                          {fieldLinks.map(link => (
                            <option key={link.id} value={link.id}>
                              {link.label || `${link.model}.${link.fieldPath}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Record ID</label>
                        <input
                          type="text"
                          value={linkedRecordId}
                          onChange={(e) => setLinkedRecordId(e.target.value)}
                          placeholder={form.relatedId || "Enter record ID..."}
                          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200"
                        />
                        {form.relatedId && (
                          <button
                            onClick={() => setLinkedRecordId(form.relatedId!)}
                            className="mt-1 text-xs text-emerald-600 hover:text-emerald-700"
                          >
                            Use related record ID ({form.relatedType})
                          </button>
                        )}
                      </div>
                      <button
                        onClick={linkToField}
                        disabled={!selectedLinkId || !linkedRecordId.trim() || saving}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Link Task to Field
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* FOLLOW-UP PANEL (AI email) */}
          {form.taskType === "FOLLOW_UP" && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
              {form.meta?.aiDraft ? (
                <FollowUpTaskPanel
                  task={form as any}
                  authHeaders={authHeaders}
                  onEmailSent={() => { onChanged?.(); }}
                  onTaskCompleted={() => { onChanged?.(); setForm(prev => prev ? { ...prev, status: "DONE" } : prev); }}
                />
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-indigo-900">AI Follow-up</div>
                  <p className="text-sm text-slate-600">Generate an AI email draft and send directly from here.</p>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={async () => {
                        if (!form?.id) return;
                        try {
                          const res = await apiFetch(`/tasks/${form.id}/generate-draft`, {
                            method: 'POST',
                            headers: authHeaders,
                            json: {},
                          });
                          const draft = (res as any)?.draft || { generatedAt: new Date().toISOString() };
                          setForm(prev => prev ? { ...prev, meta: { ...(prev.meta||{}), aiDraft: draft } } : prev);
                          onChanged?.();
                          toast('Draft generated');
                        } catch (e:any) {
                          toast('Failed to generate draft');
                        }
                      }}
                    >Generate Draft</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CLIENT EMAIL CONTEXT */}
          {(form.taskType === 'FOLLOW_UP' || ((form.title||'').toLowerCase().includes('review') && (form.title||'').toLowerCase().includes('enquiry'))) && form.relatedType === 'LEAD' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Client Email Chain</div>
              {emailLoading ? (
                <div className="text-sm text-amber-800">Loading emails…</div>
              ) : emailThread.length === 0 ? (
                <div className="text-sm text-amber-800">No emails found for this lead.</div>
              ) : (
                <div className="space-y-2">
                  {emailThread.map((m) => (
                    <div key={m.id} className="rounded-lg border border-amber-300 bg-white/80 p-3 text-xs">
                      <div className="font-medium text-slate-900">{m.subject || 'No subject'}</div>
                      <div className="text-slate-600">From: {m.from} • To: {m.to}</div>
                      {m.date && <div className="text-slate-500">{new Date(m.date).toLocaleString()}</div>}
                      {m.snippet && <div className="mt-1 text-slate-700 line-clamp-3">{m.snippet}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Attachments</div>
                {leadAttachments.length === 0 ? (
                  <div className="text-xs text-amber-800">No attachments.</div>
                ) : (
                  <div className="space-y-2">
                    {leadAttachments.map((a, idx) => {
                      const href = (a.url || a.path) as string | undefined;
                      const name = a.filename || a.name || `Attachment ${idx+1}`;
                      const isImage = href ? /\.(png|jpg|jpeg|gif|webp)$/i.test(href) : false;
                      const isPdf = href ? /\.(pdf)$/i.test(href) : false;
                      return (
                        <div key={idx} className="rounded-lg border border-amber-300 bg-white/80 p-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-medium text-slate-900 truncate mr-2">{name}</div>
                            {href && (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:text-indigo-900 hover:underline">
                                Open
                              </a>
                            )}
                          </div>
                          {href && isImage && (
                            <div className="mt-2">
                              <img src={href} alt={name} className="max-h-48 w-auto rounded-md border border-slate-200" />
                            </div>
                          )}
                          {href && isPdf && (
                            <div className="mt-2">
                              <iframe src={href} className="w-full h-64 rounded-md border border-slate-200" />
                            </div>
                          )}
                          {!href && (
                            <div className="text-[11px] text-slate-500">No preview available</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Action buttons: Accept / Decline / Reject / Request More Info */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="default"
                  onClick={async () => {
                    if (!form?.id) return;
                    try {
                      const preview: any = await apiFetch(`/tasks/${form.id}/actions/accept-enquiry/preview`, { method: 'POST', headers: authHeaders });
                      setComposeData({ subject: preview.subject, body: preview.body, endpoint: `/tasks/${form.id}/actions/accept-enquiry` });
                      setComposeOpen(true);
                    } catch { toast('Failed to generate preview'); }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >✓ Accept</Button>
                <Button
                  variant="default"
                  onClick={async () => {
                    if (!form?.id) return;
                    try {
                      const preview: any = await apiFetch(`/tasks/${form.id}/actions/decline-enquiry/preview`, { method: 'POST', headers: authHeaders });
                      setComposeData({ subject: preview.subject, body: preview.body, endpoint: `/tasks/${form.id}/actions/decline-enquiry` });
                      setComposeOpen(true);
                    } catch { toast('Failed to generate preview'); }
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >↓ Decline</Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!form?.id) return;
                    if (!confirm('Reject as not a real enquiry?')) return;
                    try {
                      await apiFetch(`/tasks/${form.id}/actions/reject-enquiry`, { method: 'POST', headers: authHeaders });
                      toast('Marked as not an enquiry');
                      onChanged?.();
                    } catch { toast('Failed to reject'); }
                  }}
                  className="border-red-400 text-red-700 hover:bg-red-50"
                >✕ Reject</Button>
                <Button
                  variant="outline"
                  onClick={() => setMoreInfoOpen(true)}
                >Request More Info</Button>
              </div>
            </div>
          )}

          {/* Request More Info Dialog */}
          {moreInfoOpen && (
            <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Request More Information</h3>
                  <Button variant="ghost" size="sm" onClick={() => setMoreInfoOpen(false)}>✕</Button>
                </div>
                <label className="text-sm font-medium text-slate-700">Subject
                  <input
                    value={moreInfoSubject}
                    onChange={e => setMoreInfoSubject(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">Message
                  <textarea
                    value={moreInfoBody}
                    onChange={e => setMoreInfoBody(e.target.value)}
                    rows={8}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </label>
                <div className="text-xs text-slate-500">Tip: include {'{{QUESTIONNAIRE_LINK}}'} where you want the link inserted.</div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setMoreInfoOpen(false)} className="flex-1">Cancel</Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={async () => {
                      if (!form?.id) return;
                      try {
                        // Build questionnaire link if available from meta; otherwise a placeholder
                        const qLink = form.meta?.questionnaireLink || leadDetails?.publicEstimatorUrl || leadDetails?.estimatorLink || `${location.origin}/questionnaire/${form.relatedId || ''}`;
                        const body = moreInfoBody.replace('{{QUESTIONNAIRE_LINK}}', qLink);
                        // open preview compose before sending
                        setComposeData({ subject: moreInfoSubject, body, endpoint: `/tasks/${form.id}/actions/send-email` });
                        setComposeOpen(true);
                        setMoreInfoOpen(false);
                      } catch { toast('Failed to send request'); }
                    }}
                  >Send</Button>
                </div>
              </div>
            </div>
          )}

          {/* Compose & Preview Modal */}
          {composeOpen && composeData && (
            <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4">
              <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Email Preview</h3>
                  <Button variant="ghost" size="sm" onClick={() => setComposeOpen(false)}>✕</Button>
                </div>
                <label className="text-sm font-medium text-slate-700">Subject
                  <input
                    value={composeData.subject}
                    onChange={e => setComposeData(d => d ? { ...d, subject: e.target.value } : d)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">Message
                  <textarea
                    value={composeData.body}
                    onChange={e => setComposeData(d => d ? { ...d, body: e.target.value } : d)}
                    rows={12}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </label>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setComposeOpen(false)} className="flex-1">Cancel</Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={async () => {
                      try {
                        if (!composeData) return;
                        await apiFetch(composeData.endpoint, {
                          method: 'POST',
                          headers: authHeaders,
                          json: { subject: composeData.subject, body: composeData.body },
                        });
                        toast('Email sent');
                        setComposeOpen(false);
                        onChanged?.();
                      } catch { toast('Failed to send'); }
                    }}
                  >Send</Button>
                </div>
              </div>
            </div>
          )}

          {/* Create Quote Task Section */}
          {(form.relatedType === 'LEAD') && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Next Step: Quote</div>
              <div className="text-sm text-emerald-900">Create a quote task, send to supplier, or open the quote builder.</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={async () => {
                    if (!form?.relatedId) return;
                    try {
                      await apiFetch('/tasks', {
                        method: 'POST',
                        headers: authHeaders,
                        json: {
                          title: 'Create Quote',
                          description: 'Prepare customer quote based on questionnaire details',
                          status: 'OPEN',
                          priority: 'HIGH',
                          taskType: 'MANUAL',
                          relatedType: 'LEAD',
                          relatedId: form.relatedId,
                        },
                      });
                      toast('Quote task created');
                      onChanged?.();
                    } catch { toast('Failed to create quote task'); }
                  }}
                >Create Quote Task</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const supplierTemplate = `Hello,\n\nPlease provide a supplier quote for the attached enquiry details.\n\nThanks,`;
                    setComposeData({ subject: 'Supplier Quote Request', body: supplierTemplate, endpoint: `/tasks/${form.id}/actions/send-email` });
                    setComposeOpen(true);
                  }}
                >Send Supplier Quote</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const href = `${location.origin}/quote-builder?leadId=${form.relatedId || ''}`;
                    window.open(href, '_blank');
                  }}
                >Open Quote Builder</Button>
                {leadDetails?.publicEstimatorUrl && (
                  <a
                    href={leadDetails.publicEstimatorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-700 underline"
                  >Public Estimator</a>
                )}
              </div>
            </div>
          )}

          {/* FORM TASK UI */}
          {form.taskType === "FORM" && (
            <div className="rounded-2xl border-2 border-pink-300 bg-gradient-to-br from-pink-50 to-purple-50 p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-pink-600" />
                <div className="text-base font-bold text-slate-800">Form Fields to Complete</div>
              </div>
              {!form.formSchema?.fields?.length ? (
                <div className="text-sm text-slate-600 py-3 bg-white/60 rounded-lg p-4">
                  No form schema configured. Form tasks are created automatically with questionnaires and other workflows.
                </div>
              ) : (
                <>
                <div className="space-y-4">
                {form.formSchema.fields.map((f, idx) => {
                  const key = f.key || f.id || f.label || `field_${idx}`;
                  const label = f.label || key;
                  const type = (f.type || "text").toLowerCase();
                  const required = f.required ? " *" : "";
                  if (type === "select" && f.options?.length) {
                    return (
                      <label key={key} className="block">
                        <span className="font-semibold text-slate-800 mb-2 block">{label}{required}</span>
                        <select
                          value={formData[key] || ""}
                          onChange={e => setFormData(d => ({ ...d, [key]: e.target.value }))}
                          className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none"
                        >
                          <option value="">Select an option…</option>
                          {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </label>
                    );
                  }
                  if (type === "textarea") {
                    return (
                      <label key={key} className="block">
                        <span className="font-semibold text-slate-800 mb-2 block">{label}{required}</span>
                        <textarea
                          value={formData[key] || ""}
                          onChange={e => setFormData(d => ({ ...d, [key]: e.target.value }))}
                          placeholder="Enter your response here..."
                          className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base min-h-[120px] focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none"
                        />
                      </label>
                    );
                  }
                  return (
                    <label key={key} className="block">
                      <span className="font-semibold text-slate-800 mb-2 block">{label}{required}</span>
                      <input
                        type={type === "number" ? "number" : type === "date" ? "date" : type === "email" ? "email" : "text"}
                        value={formData[key] || ""}
                        onChange={e => setFormData(d => ({ ...d, [key]: e.target.value }))}
                        placeholder="Enter your response..."
                        className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none"
                      />
                    </label>
                  );
                })}
                </div>
                {!isNewTask && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-600">Add Field</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        placeholder="Label"
                        value={newFormField.label}
                        onChange={e => setNewFormField(f => ({ ...f, label: e.target.value }))}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <select
                        value={newFormField.type}
                        onChange={e => setNewFormField(f => ({ ...f, type: e.target.value }))}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Select</option>
                      </select>
                      <input
                        placeholder="Options (comma-separated)"
                        value={newFormField.options}
                        onChange={e => setNewFormField(f => ({ ...f, options: e.target.value }))}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!form?.id || !newFormField.label.trim()) return;
                          const nextFields = [...(form.formSchema?.fields || [])];
                          const field: any = { label: newFormField.label, type: newFormField.type };
                          if (newFormField.type === 'select' && newFormField.options) {
                            field.options = newFormField.options.split(',').map(s => s.trim()).filter(Boolean);
                          }
                          nextFields.push(field);
                          try {
                            await update({ formSchema: { ...(form.formSchema || {}), fields: nextFields } as any });
                            setForm(prev => prev ? { ...prev, formSchema: { ...(prev.formSchema || {}), fields: nextFields } } : prev);
                            setNewFormField({ label: '', type: 'text', options: '' });
                            toast('Field added');
                          } catch { toast('Failed to add field'); }
                        }}
                      >Add</Button>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    onClick={submitFormTask}
                    disabled={submittingForm}
                    variant="default"
                  >
                    {submittingForm ? "Submitting…" : "Submit Form"}
                  </Button>
                </div>
                </>
              )}
            </div>
          )}

          {/* CHECKLIST TASK UI */}
          {form.taskType === "CHECKLIST" && (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</div>
              {!form.checklistItems?.length ? (
                <div className="text-sm text-slate-600 py-3">
                  No checklist items configured. Checklist tasks are created automatically with workshop processes and other workflows.
                </div>
              ) : (
                <>
                {form.checklistItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklist(item.id, !item.completed)}
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm mb-1 transition ${item.completed ? "bg-green-50 border-green-300 text-green-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="truncate text-left">{item.label}</span>
                  <span className={`ml-3 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold ${item.completed ? "bg-green-500 text-white border-green-600" : "bg-slate-100 text-slate-600 border-slate-300"}`}>{item.completed ? "✓" : ""}</span>
                </button>
              ))}
              <div className="text-xs text-slate-500 mt-2">
                {form.checklistItems.filter(i => i.completed).length}/{form.checklistItems.length} completed
              </div>
              {!isNewTask && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    placeholder="New item label"
                    value={newChecklistLabel}
                    onChange={e => setNewChecklistLabel(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <Button
                    variant="outline"
                    disabled={!newChecklistLabel.trim()}
                    onClick={async () => {
                      if (!form?.id || !newChecklistLabel.trim()) return;
                      const next = [...(form.checklistItems || [])];
                      next.push({ id: crypto.randomUUID(), label: newChecklistLabel, completed: false });
                      try {
                        await update({ checklistItems: next as any });
                        setForm(prev => prev ? { ...prev, checklistItems: next } : prev);
                        setNewChecklistLabel('');
                        toast('Checklist item added');
                      } catch { toast('Failed to add item'); }
                    }}
                  >Add</Button>
                </div>
              )}
              </>
              )}
            </div>
          )}

          {/* SCHEDULING PANEL */}
          {form.taskType !== "SCHEDULED" && !isNewTask && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Schedule this task</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Pattern
                  <select
                    value={scheduleEdit.pattern}
                    onChange={e => setScheduleEdit(p => ({ ...p, pattern: e.target.value as RecurrencePattern }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">Interval
                  <input
                    type="number"
                    min={1}
                    value={scheduleEdit.interval}
                    onChange={e => setScheduleEdit(p => ({ ...p, interval: Math.max(1, Number(e.target.value)||1) }))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <Button onClick={convertToScheduled} variant="default">Convert to Scheduled</Button>
            </div>
          )}

          {form.taskType === "SCHEDULED" && (
            <div className="rounded-2xl border border-green-200 bg-green-50/70 p-4 text-sm text-green-800">
              Recurs: {form.recurrenceInterval || 1} × {form.recurrencePattern || 'DAILY'}
            </div>
          )}

          {/* ATTACHMENTS PANEL */}
          {!isNewTask && (
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attachments</div>
                <label className="text-xs font-medium text-indigo-600 cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleAttachmentFiles(e.target.files)}
                  />
                  {uploadingAttachments ? 'Uploading…' : 'Add files'}
                </label>
              </div>
              {attachments.length === 0 ? (
                <div className="text-sm text-slate-600">No attachments yet.</div>
              ) : (
                <ul className="space-y-2">
                  {attachments.map(att => (
                    <li key={att.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-700 truncate">{att.filename}</div>
                        <div className="text-[10px] text-slate-500">{(att.size/1024).toFixed(1)} KB · {att.mimeType}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {attachments.length > 0 && (
                <div className="text-[10px] text-slate-500">Stored inline (base64). For large files use a dedicated upload flow later.</div>
              )}
            </div>
          )}

          {/* ASSIGNEES PANEL */}
          {!isNewTask && (
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assignees</div>
                <button
                  type="button"
                  disabled={assigneeBusy || assignedIds.has(userId)}
                  onClick={() => modifyAssignees([userId], [])}
                  className="text-xs font-medium text-indigo-600 disabled:opacity-40"
                >
                  {assignedIds.has(userId) ? 'Assigned to you' : 'Assign to me'}
                </button>
              </div>
              <div className="space-y-2">
                {(form.assignees || []).length === 0 && !assigneeBusy && (
                  <div className="text-sm text-slate-600">No assignees yet.</div>
                )}
                {(form.assignees || []).map(a => {
                  const u = users.find(u => u.id === a.userId);
                  return (
                    <div key={a.userId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-700 truncate">{u?.name || a.userId}</div>
                        <div className="text-[10px] text-slate-500">{u?.email || 'role: ' + a.role}</div>
                      </div>
                      <button
                        type="button"
                        disabled={assigneeBusy}
                        onClick={() => modifyAssignees([], [a.userId])}
                        className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <select
                  value={addUserId}
                  disabled={assigneeBusy || loadingUsers || unassignedUsers.length === 0}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                >
                  <option value="">{loadingUsers ? 'Loading users…' : unassignedUsers.length ? 'Select user…' : 'No users available'}</option>
                  {unassignedUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!addUserId || assigneeBusy}
                  onClick={() => modifyAssignees([addUserId], [])}
                  className="text-xs"
                >Add</Button>
              </div>
              {assigneeBusy && <div className="text-[10px] text-indigo-600">Updating assignees…</div>}
            </div>
          )}

          <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
            <div className="text-xs text-slate-500">
              {!isNewTask && (
                <>
                  <div className="font-semibold text-slate-700">{dueLabel}</div>
                  {form.completedAt ? <div>Completed {new Date(form.completedAt).toLocaleString()}</div> : null}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isNewTask ? (
                <Button
                  onClick={createTask}
                  disabled={saving || !form.title.trim()}
                  variant="default"
                >
                  Create Task
                </Button>
              ) : (
                <>
                  <Button
                    onClick={startTask}
                    disabled={saving || form.status === "IN_PROGRESS" || form.status === "DONE"}
                    variant="outline"
                  >
                    Start task
                  </Button>
                  <Button
                    onClick={completeTask}
                    disabled={saving || form.status === "DONE"}
                    variant="default"
                  >
                    Mark complete
                  </Button>
                </>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
