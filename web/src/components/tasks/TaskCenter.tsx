"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { CheckSquare, Mail, Plus, Search, Filter, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TaskModal } from "./TaskModal";
import { CreateTaskWizard } from "./CreateTaskWizard";
import { TaskCelebration } from "./TaskCelebration";
import { TaskStreakTracker } from "./TaskStreakTracker";
import { useAuthIds } from "@/hooks/useAuthIds";

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
  requiresSignature?: boolean;
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
  onTasksChanged,
}: {
  filterRelatedType?: Task["relatedType"];
  filterRelatedId?: string;
  embedded?: boolean;
  onTasksChanged?: () => void | Promise<void>;
} = {}) {
  const [tenantId, setTenantId] = useState("");
  const [userId, setUserId] = useState("");

  const { ids } = useAuthIds();

  const [activeTab] = useState("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyMine, setShowOnlyMine] = useState(!embedded);
  const [formDataMap, setFormDataMap] = useState<Record<string, Record<string, any>>>({});
  const [taskEditMap, setTaskEditMap] = useState<Record<string, { taskType: Task['taskType']; status: Task['status']; priority: Task['priority']; dueAt: string; description: string; linkId?: string; recordId?: string; }>>({});

  useEffect(() => {
    if (!ids?.tenantId) return;
    setTenantId(ids.tenantId);
    setUserId(ids.userId);
  }, [ids?.tenantId, ids?.userId]);

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTask, setCelebrationTask] = useState<Task | null>(null);
  const [celebrationStats, setCelebrationStats] = useState({ streak: 0, total: 0, points: 10 });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [emailComposeMap, setEmailComposeMap] = useState<Record<string, { open: boolean; subject: string; body: string; sending?: boolean }>>({});
  const [headerCollapsed, setHeaderCollapsed] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [leadPreviews, setLeadPreviews] = useState<Record<string, any>>({});
  const [fieldLinks, setFieldLinks] = useState<Record<string, any>>({});
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({ quickEdit: true, leadDetails: true, linkedField: true, emailThread: true, attachments: true, reply: false, formFields: true, checklist: true });
  const [emailPreview, setEmailPreview] = useState<{ isOpen: boolean; subject: string; body: string; to: string; recipientName?: string; action?: 'accept' | 'decline'; taskId?: string; }>({ isOpen: false, subject: '', body: '', to: '' });

  const saveInlineReplyDraft = async (taskId: string, draft: { subject: string; body: string }) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      const existingMeta = (task as any)?.meta || {};
      const newMeta = { ...existingMeta, inlineReplyDraft: { subject: draft.subject || '', body: draft.body || '', updatedAt: new Date().toISOString() } };
      await apiFetch(`/tasks/${taskId}`, { method: 'PATCH', headers: { 'x-tenant-id': tenantId, 'x-user-id': userId }, json: { meta: newMeta } });
      setTasks(prev => prev.map(t => (t.id === taskId ? ({ ...t, meta: newMeta }) : t)));
    } catch (e) { console.error('Failed to save inline reply draft:', e); }
  };

  const loadTasks = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('take', '100');
      if (showOnlyMine && userId) params.set('mine', 'true');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (filterRelatedType && filterRelatedId) {
        params.set('relatedType', filterRelatedType);
        params.set('relatedId', filterRelatedId);
        // In embedded/related-record views (e.g. Lead modal), we need completed items too
        // so users can see communication context after completing a comms task.
        params.set('includeDone', 'true');
      }
      const response = await apiFetch<{ items: Task[]; total: number }>(`/tasks?${params}`, { headers: { 'x-tenant-id': tenantId } });
      setTasks(response.items);
      const newFormDataMap: Record<string, Record<string, any>> = {}; const newTaskEditMap: Record<string, any> = {};
      response.items.forEach((task: Task) => {
        if (task.taskType === 'FORM' && task.formSchema?.submissions && Array.isArray(task.formSchema.submissions) && task.formSchema.submissions.length > 0) {
          const latestSubmission = task.formSchema.submissions[task.formSchema.submissions.length - 1]; if (latestSubmission?.data) newFormDataMap[task.id] = latestSubmission.data;
        }
        const meta = (task as any).meta || {}; const lf = meta.linkedField || {};
        const toLocal = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
        newTaskEditMap[task.id] = { taskType: task.taskType, status: task.status, priority: task.priority, dueAt: toLocal(task.dueAt), description: task.description || '', linkId: lf?.linkId || '', recordId: lf?.recordId || '' };
      });
      setFormDataMap(prev => ({ ...prev, ...newFormDataMap })); setTaskEditMap(prev => ({ ...prev, ...newTaskEditMap }));
    } catch (e) { console.error('Failed to load tasks:', e); setTasks([]); } finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) { loadTasks(); (async () => { try { const res = await apiFetch<{ items: any[] }>(`/automation/field-links`, { headers: { 'x-tenant-id': tenantId } }); const map: Record<string, any> = {}; (res.items || []).forEach((l: any) => { map[l.id] = l; }); setFieldLinks(map); } catch { console.warn('Failed to load field links'); } })(); } }, [tenantId, activeTab, showOnlyMine, searchQuery]);

  const loadStats = async () => { if (!tenantId || !userId) return; try { const stats = await apiFetch<any>(`/tasks/stats/${userId}`, { headers: { 'x-tenant-id': tenantId } }); setStreakDays(stats.currentStreak || 0); setTodayCompleted(stats.tasksCompletedToday || stats.todayCompleted || 0); } catch (e) { console.warn('Failed to load task stats', e); } };
  useEffect(() => { if (tenantId && userId) loadStats(); }, [tenantId, userId]);

  const handleSearch = () => { loadTasks(); };
  const handleNewTask = () => { setShowCreateWizard(true); };

  const handleCompleteTask = async (task: Task) => {
    try {
      await apiFetch(`/tasks/${task.id}/complete`, { method: 'POST', headers: { 'x-tenant-id': tenantId } });
      const stats = await apiFetch<any>(`/tasks/stats/${userId}`, { headers: { 'x-tenant-id': tenantId } });
      setCelebrationTask(task);
      setCelebrationStats({ streak: stats.currentStreak || 0, total: stats.totalTasksCompleted || 0, points: task.priority === 'URGENT' ? 25 : task.priority === 'HIGH' ? 15 : 10 });
      setShowCelebration(true);
      await loadTasks();
      await loadStats();
      await Promise.resolve(onTasksChanged?.());
    } catch (e) {
      console.error('Failed to complete task:', e);
      alert('Failed to complete task. Please try again.');
    }
  };

  const taskCounts = useMemo(() => { const counts: Record<string, number> = { all: 0, completed: 0 }; Object.keys(TASK_TYPE_CONFIG).forEach(type => { counts[type] = 0; }); tasks.forEach(task => { if (task.status === 'DONE') counts.completed++; else { counts.all++; counts[task.taskType]++; } }); return counts; }, [tasks]);
  const filteredTasks = useMemo(() => tasks.filter(task => { if (activeTab === 'completed') return task.status === 'DONE'; if (activeTab !== 'all') return task.taskType === activeTab && task.status !== 'DONE'; return task.status !== 'DONE'; }), [tasks, activeTab]);

  const completedCommunicationTasks = useMemo(() => {
    if (!filterRelatedType || !filterRelatedId) return [] as Task[];
    return tasks
      .filter((task) => (task.taskType === 'COMMUNICATION' || task.taskType === 'FOLLOW_UP') && task.status === 'DONE')
      .sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [tasks, filterRelatedType, filterRelatedId]);

  const { overdue, urgent, highPriority, upcoming } = useMemo(() => { const now = new Date(); const overdue: Task[] = []; const urgent: Task[] = []; const highPriority: Task[] = []; const upcoming: Task[] = []; filteredTasks.forEach((task) => { const dueDate = task.dueAt ? new Date(task.dueAt) : null; const isOver = dueDate && dueDate < now; if (isOver) overdue.push(task); else if (task.priority === 'URGENT') urgent.push(task); else if (task.priority === 'HIGH') highPriority.push(task); else upcoming.push(task); }); return { overdue, urgent, highPriority, upcoming }; }, [filteredTasks]);

  const handleSkipTask = async (taskId: string) => {
    if (!confirm('Skip this task?')) return;
    try {
      await apiFetch(`/tasks/${taskId}`, { method: 'PATCH', headers: { 'x-tenant-id': tenantId }, json: { status: 'CANCELLED' } });
      await loadTasks();
      await Promise.resolve(onTasksChanged?.());
      alert('Task skipped');
    } catch (e) {
      console.error('Failed to skip task:', e);
      alert('Failed to skip task');
    }
  };

  const handleSendEmailPreview = async (taskId: string, action: 'accept' | 'decline') => { try { const endpoint = action === 'accept' ? 'accept-enquiry' : 'decline-enquiry'; const preview = await apiFetch<any>(`/tasks/${taskId}/actions/${endpoint}/preview`, { method: 'POST', headers: { 'x-tenant-id': tenantId } }); setEmailPreview({ isOpen: true, subject: preview.subject, body: preview.body, to: preview.to, recipientName: preview.recipientName, action, taskId }); } catch { alert('Failed to generate email preview'); } };

  const handleRejectEnquiry = async (taskId: string) => {
    if (!confirm('Reject as not a real enquiry? This will mark the lead as rejected and provide feedback to the ML system.')) return;
    try {
      await apiFetch(`/tasks/${taskId}/actions/reject-enquiry`, { method: 'POST', headers: { 'x-tenant-id': tenantId } });
      await loadTasks();
      await Promise.resolve(onTasksChanged?.());
      alert('Marked as not an enquiry');
    } catch {
      alert('Failed to reject enquiry');
    }
  };

  const handleAcceptNoEmail = async (taskId: string) => {
    try {
      await apiFetch(`/tasks/${taskId}/actions/accept-enquiry`, {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId },
        json: { skipEmail: true },
      });
      await loadTasks();
      await Promise.resolve(onTasksChanged?.());
      alert('Enquiry accepted (no email sent)');
    } catch {
      alert('Failed to accept enquiry');
    }
  };

  const toggleTaskExpansion = async (taskId: string, leadId?: string) => { const newExpanded = new Set(expandedTaskIds); if (newExpanded.has(taskId)) newExpanded.delete(taskId); else { newExpanded.add(taskId);
      const t = tasks.find(tt => tt.id === taskId); if (t && (t as any).meta?.inlineReplyDraft && !emailComposeMap[taskId]) { const draft = (t as any).meta.inlineReplyDraft; setEmailComposeMap(prev => ({ ...prev, [taskId]: { open: false, subject: draft.subject || '', body: draft.body || '' } })); }
      if (t && !taskEditMap[taskId]) { const meta = (t as any).meta || {}; const lf = meta.linkedField || {}; const toLocal = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }; setTaskEditMap(prev => ({ ...prev, [taskId]: { taskType: t.taskType, status: t.status, priority: t.priority, dueAt: toLocal(t.dueAt), description: t.description || '', linkId: lf?.linkId || '', recordId: lf?.recordId || '' } })); }
      if (leadId && !leadPreviews[leadId]) { try { const [lead, emailsRes] = await Promise.all([ apiFetch<any>(`/leads/${leadId}`, { headers: { 'x-tenant-id': tenantId } }), apiFetch<any>(`/leads/${leadId}/emails`, { headers: { 'x-tenant-id': tenantId } }).catch(() => ({ items: [] })) ]); const leadWithEmails = { ...lead, emails: emailsRes.items || [] }; setLeadPreviews(prev => ({ ...prev, [leadId]: leadWithEmails })); } catch (err) { console.error('Failed to fetch lead details:', err); } }
    }
    setExpandedTaskIds(newExpanded); };

  const renderTaskCard = (task: Task) => {
    const config = TASK_TYPE_CONFIG[task.taskType] || TASK_TYPE_CONFIG.MANUAL;
    const IconComponent = task.taskType === 'FOLLOW_UP' ? Mail : task.taskType === 'FORM' ? FileText : CheckSquare;
    const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== 'DONE';
    const taskMeta = (task as any).meta || {};
    const trigger = taskMeta.trigger || '';
    const isReviewEnquiry = trigger === 'new_lead_received' || (task.title.toLowerCase().includes('review') && task.title.toLowerCase().includes('enquiry'));
    const isAITask = task.taskType === 'FOLLOW_UP' || trigger.includes('follow_up');
    const isExpanded = expandAll || expandedTaskIds.has(task.id);
    const leadId = task.relatedType === 'LEAD' ? task.relatedId : null;
    const leadData = leadId ? leadPreviews[leadId] : null;

    const edit = taskEditMap[task.id] || { taskType: task.taskType, status: task.status, priority: task.priority, dueAt: '', description: task.description || '', linkId: (task as any)?.meta?.linkedField?.linkId || '', recordId: (task as any)?.meta?.linkedField?.recordId || '' };

    const saveQuickEdit = async () => { try { const fromLocal = (val?: string) => (val ? new Date(val).toISOString() : undefined); const patch: any = { taskType: edit.taskType, status: edit.status, priority: edit.priority, dueAt: fromLocal(edit.dueAt), description: edit.description }; const existingMeta = (task as any)?.meta || {}; patch.meta = { ...existingMeta }; patch.meta.linkedField = edit.linkId ? { type: 'fieldLink', linkId: edit.linkId, recordId: edit.recordId || existingMeta?.linkedField?.recordId } : null; await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', headers: { 'x-tenant-id': tenantId, 'x-user-id': userId }, json: patch }); setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, taskType: edit.taskType, status: edit.status, priority: edit.priority, dueAt: patch.dueAt || undefined, description: edit.description, meta: patch.meta } : t))); alert('Task updated'); } catch (e) { console.error('Failed to update task', e); alert('Failed to update task'); } };

    return (
      <Card key={task.id} className="p-4 hover:shadow-md transition-all">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <IconComponent className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 truncate cursor-pointer hover:text-indigo-600" onClick={() => { setSelectedTask(task); setShowTaskModal(true); }}>{task.title}</h3>
              <div className="flex items-center gap-2">
                {task.relatedType === 'LEAD' && task.relatedId && (<button onClick={(e) => { e.stopPropagation(); toggleTaskExpansion(task.id, task.relatedId); }} className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition">{isExpanded ? '▲ Hide' : '▼ Details'}</button>)}
                <Badge variant={task.priority === 'URGENT' ? 'destructive' : 'secondary'}>{task.priority}</Badge>
              </div>
            </div>
            {task.description && (<p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>)}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className={`px-2 py-1 rounded-full ${task.status === 'DONE' ? 'bg-green-100 text-green-700' : task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : task.status === 'BLOCKED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{task.status}</span>
              {task.meta?.quoteTaskCreated && task.meta?.quoteTaskId && (<button className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200" onClick={(e) => { e.stopPropagation(); (async () => { try { const fetched: any = await apiFetch(`/tasks/${task.meta!.quoteTaskId}`, { headers: { 'x-tenant-id': tenantId } }); if (fetched && fetched.id) { setSelectedTask(fetched); setShowTaskModal(true); } else { alert('Quote task created'); } } catch { alert('Unable to open quote task'); } })(); }}>Quote task created</button>)}
              {task.dueAt && (<span className={isOverdue ? 'text-red-600 font-semibold' : ''}>Due: {new Date(task.dueAt).toLocaleDateString()}</span>)}
              {task.taskType === 'CHECKLIST' && task.checklistItems && (<span>{task.checklistItems.filter(i => i.completed).length}/{task.checklistItems.length} completed</span>)}
              {task.taskType === 'FORM' && task.requiresSignature && (<span className="flex items-center gap-1"><FileText className="h-3 w-3" />Requires signature</span>)}
            </div>

            {task.status !== 'DONE' && (
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                {isReviewEnquiry ? (
                  <>
                    <Button size="sm" variant="default" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleSendEmailPreview(task.id, 'accept')}>✓ Accept</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleAcceptNoEmail(task.id)}>✓ Accept (no email)</Button>
                    <Button size="sm" variant="default" className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={() => handleSendEmailPreview(task.id, 'decline')}>↓ Decline</Button>
                    <Button size="sm" variant="outline" className="flex-1 border-red-400 text-red-700 hover:bg-red-50" onClick={() => handleRejectEnquiry(task.id)}>✕ Reject</Button>
                  </>
                ) : isAITask ? (
                  <>
                    <Button size="sm" variant="default" className="flex-1" onClick={() => { setSelectedTask(task); setShowTaskModal(true); }}><Mail className="h-4 w-4 mr-2" />Send Email</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleSkipTask(task.id)}>Skip</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => handleCompleteTask(task)} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"><CheckSquare className="h-4 w-4 mr-2" />Complete Task</Button>
                )}
              </div>
            )}

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center justify-between mb-2"><div className="font-semibold text-slate-900">Quick Edit</div><button className="text-xs text-slate-600 hover:text-slate-900" onClick={() => setSectionOpen(prev => ({ ...prev, quickEdit: !prev.quickEdit }))}>{sectionOpen.quickEdit ? 'Hide' : 'Show'}</button></div>
                  {sectionOpen.quickEdit && (<>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div><label className="text-xs text-slate-600">Task Type</label><select className="w-full rounded border px-2 py-2 text-sm" value={edit.taskType} onChange={(e) => setTaskEditMap(prev => ({ ...prev, [task.id]: { ...edit, taskType: e.target.value as Task['taskType'] } }))}>{Object.keys(TASK_TYPE_CONFIG).map(k => (<option key={k} value={k}>{TASK_TYPE_CONFIG[k].label}</option>))}</select></div>
                      <div><label className="text-xs text-slate-600">Status</label><select className="w-full rounded border px-2 py-2 text-sm" value={edit.status} onChange={(e) => setTaskEditMap(prev => ({ ...prev, [task.id]: { ...edit, status: e.target.value as Task['status'] } }))}>{['OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED'].map(s => (<option key={s} value={s}>{s.toLowerCase()}</option>))}</select></div>
                      <div><label className="text-xs text-slate-600">Priority</label><select className="w-full rounded border px-2 py-2 text-sm" value={edit.priority} onChange={(e) => setTaskEditMap(prev => ({ ...prev, [task.id]: { ...edit, priority: e.target.value as Task['priority'] } }))}>{['LOW','MEDIUM','HIGH','URGENT'].map(p => (<option key={p} value={p}>{p.toLowerCase()}</option>))}</select></div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                      <div><label className="text-xs text-slate-600">Due Date</label><input type="datetime-local" className="w-full rounded border px-2 py-2 text-sm" value={edit.dueAt} onChange={(e) => setTaskEditMap(prev => ({ ...prev, [task.id]: { ...edit, dueAt: e.target.value } }))} /></div>
                      <div><label className="text-xs text-slate-600">Notes</label><input className="w-full rounded border px-2 py-2 text-sm" placeholder="Optional notes" value={edit.description} onChange={(e) => setTaskEditMap(prev => ({ ...prev, [task.id]: { ...edit, description: e.target.value } }))} /></div>
                    </div>
                    <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex items-center justify-between mb-2"><div className="text-xs font-medium text-emerald-900">Field Link</div><button className="text-xs text-emerald-700 hover:text-emerald-900" onClick={() => setSectionOpen(prev => ({ ...prev, linkedField: !prev.linkedField }))}>{sectionOpen.linkedField ? 'Hide' : 'Show'}</button></div>
                      {sectionOpen.linkedField && (<div className="grid md:grid-cols-2 gap-3"><div><label className="text-xs text-slate-600">Field Link</label><select className="w-full rounded border px-2 py-2 text-sm" value={edit.linkId || ''} onChange={(e) => setTaskEditMap(prev => ({ ...prev, [task.id]: { ...edit, linkId: e.target.value } }))}><option value="">None</option>{Object.values(fieldLinks).map((l: any) => (<option key={l.id} value={l.id}>{l.label || `${l.model}.${l.fieldPath}`}</option>))}</select></div><div><label className="text-xs text-slate-600">Record ID</label><input className="w-full rounded border px-2 py-2 text-sm" placeholder="Optional record id" value={edit.recordId || ''} onChange={(e) => setTaskEditMap(prev => ({ ...prev, [task.id]: { ...edit, recordId: e.target.value } }))} /></div></div>)}
                      <div className="flex justify-end mt-3"><button className="rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-2" onClick={saveQuickEdit}>Save Changes</button></div>
                    </div>
                  </>)}
                </div>

                {leadData && taskMeta?.linkedField?.linkId && (
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center justify-between"><div className="text-xs text-slate-600">Linked Field</div><button className="text-xs text-slate-600 hover:text-slate-900" onClick={() => setSectionOpen(prev => ({ ...prev, linkedField: !prev.linkedField }))}>{sectionOpen.linkedField ? 'Hide' : 'Show'}</button></div>
                    {sectionOpen.linkedField && (<div className="mt-1 text-slate-900 text-sm">{(fieldLinks[taskMeta.linkedField.linkId]?.label) || `${fieldLinks[taskMeta.linkedField.linkId]?.model || ''}.${fieldLinks[taskMeta.linkedField.linkId]?.fieldPath || ''}` || `Link ID: ${taskMeta.linkedField.linkId}`}</div>)}
                  </div>
                )}

                {leadData && (
                  <div className="bg-slate-50 rounded p-3 border border-slate-200">
                    <div className="flex items-center justify-between mb-2"><div className="font-semibold text-slate-900">Lead Details</div><button className="text-xs text-slate-600 hover:text-slate-900" onClick={() => setSectionOpen(prev => ({ ...prev, leadDetails: !prev.leadDetails }))}>{sectionOpen.leadDetails ? 'Hide' : 'Show'}</button></div>
                    {sectionOpen.leadDetails && (<><div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">{leadData.contactName && (<div><span className="font-medium text-slate-600">Name:</span> {leadData.contactName}</div>)}{leadData.email && (<div><span className="font-medium text-slate-600">Email:</span> {leadData.email}</div>)}{leadData.phone && (<div><span className="font-medium text-slate-600">Phone:</span> {leadData.phone}</div>)}{leadData.estimatedValue && (<div><span className="font-medium text-slate-600">Est. Value:</span> ${leadData.estimatedValue.toLocaleString()}</div>)}</div>{leadData.description && (<div className="bg-white rounded p-3 mt-2"><div className="font-medium text-slate-700 mb-1">Description</div><div className="text-slate-600 whitespace-pre-wrap">{leadData.description}</div></div>)}</>) }
                  </div>
                )}

                {task.taskType === 'FOLLOW_UP' && leadData && (
                  <div className="space-y-3">
                    {leadData.emails && leadData.emails.length > 0 && (
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <div className="flex items-center justify-between mb-2"><div className="font-semibold text-purple-900 flex items-center gap-2"><Mail className="h-4 w-4" />Email Conversation ({leadData.emails.length})</div><button className="text-xs text-purple-700 hover:text-purple-900" onClick={() => setSectionOpen(prev => ({ ...prev, emailThread: !prev.emailThread }))}>{sectionOpen.emailThread ? 'Hide' : 'Show'}</button></div>
                        {sectionOpen.emailThread && (<div className="space-y-3">{leadData.emails.map((email: any, idx: number) => (<div key={email.id || idx} className="bg-white rounded-lg p-3 border border-purple-100"><div className="flex items-start justify-between mb-2"><div className="flex-1"><div className="font-medium text-sm text-gray-900">{email.subject || '(No subject)'}</div><div className="text-xs text-gray-600 mt-1"><span className="font-medium">From:</span> {email.from || 'Unknown'}</div>{email.to && (<div className="text-xs text-gray-600"><span className="font-medium">To:</span> {email.to}</div>)}</div>{email.date && (<div className="text-xs text-gray-500 ml-2">{new Date(email.date).toLocaleDateString()}</div>)}</div>{email.snippet && (<div className="text-sm text-gray-700 mt-2 line-clamp-3 italic">{email.snippet}</div>)}{email.body && (<details className="mt-2"><summary className="text-xs text-purple-600 cursor-pointer hover:text-purple-800">View full message</summary><div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-auto bg-gray-50 rounded p-2">{email.body}</div></details>)}</div>))}</div>)}
                      </div>
                    )}
                    {leadData.attachments && leadData.attachments.length > 0 && (
                      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                        <div className="flex items-center justify-between mb-2"><div className="font-semibold text-indigo-900 flex items-center gap-2"><FileText className="h-4 w-4" />Email Attachments ({leadData.attachments.length})</div><button className="text-xs text-indigo-700 hover:text-indigo-900" onClick={() => setSectionOpen(prev => ({ ...prev, attachments: !prev.attachments }))}>{sectionOpen.attachments ? 'Hide' : 'Show'}</button></div>
                        {sectionOpen.attachments && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{leadData.attachments.map((att: any, idx: number) => { const fileName = att.filename || att.name || `Attachment ${idx + 1}`; const fileUrl = att.url || att.path; const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i); const isPdf = fileName.match(/\.pdf$/i); return (<div key={idx} className="bg-white rounded-lg p-3 border border-indigo-100"><a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 group"><FileText className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" /><div className="flex-1 min-w-0"><div className="text-sm font-medium text-indigo-900 group-hover:text-indigo-700 truncate">{fileName}</div>{att.size && (<div className="text-xs text-gray-500">{(att.size / 1024).toFixed(1)} KB</div>)}</div></a>{isImage && fileUrl && (<div className="mt-2 rounded overflow-hidden border border-gray-200"><img src={fileUrl} alt={fileName} className="w-full h-32 object-cover" loading="lazy" /></div>)}{isPdf && (<div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">📄 PDF Document</div>)}</div>); })}</div>)}
                      </div>
                    )}
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center justify-between mb-2"><div className="font-semibold text-purple-900">Reply</div><button className="text-xs text-purple-700 hover:text-purple-900" onClick={() => { setEmailComposeMap(prev => { const curr = prev[task.id]; const draft = (task as any)?.meta?.inlineReplyDraft; const subject = curr?.subject || draft?.subject || `Re: ${leadData?.originalEmail?.subject || task.title || 'Your enquiry'}`; const body = curr?.body || draft?.body || ''; return { ...prev, [task.id]: { open: !curr?.open, subject, body } }; }); setSectionOpen(prev => ({ ...prev, reply: true })); }}>{emailComposeMap[task.id]?.open ? 'Hide' : 'Reply'}</button></div>
                      {sectionOpen.reply && emailComposeMap[task.id]?.open && (<div className="space-y-2"><input className="w-full rounded border border-purple-200 px-3 py-2 text-sm" placeholder="Subject" value={emailComposeMap[task.id]?.subject || ''} onChange={(e) => setEmailComposeMap(prev => ({ ...prev, [task.id]: { ...(prev[task.id]||{ open: true }), subject: e.target.value, body: prev[task.id]?.body || '' } }))} onBlur={() => { const compose = emailComposeMap[task.id] || { subject: '', body: '' }; saveInlineReplyDraft(task.id, { subject: compose.subject, body: compose.body }); }} /><textarea className="w-full rounded border border-purple-200 px-3 py-2 text-sm min-h-[120px]" placeholder="Write your reply..." value={emailComposeMap[task.id]?.body || ''} onChange={(e) => setEmailComposeMap(prev => ({ ...prev, [task.id]: { ...(prev[task.id]||{ open: true }), subject: prev[task.id]?.subject || '', body: e.target.value } }))} onBlur={() => { const compose = emailComposeMap[task.id] || { subject: '', body: '' }; saveInlineReplyDraft(task.id, { subject: compose.subject, body: compose.body }); }} /><div className="flex gap-2"><button className="rounded bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-2 disabled:opacity-50" disabled={emailComposeMap[task.id]?.sending} onClick={async () => { const compose = emailComposeMap[task.id] || { subject: '', body: '' }; try { setEmailComposeMap(prev => ({ ...prev, [task.id]: { ...(prev[task.id]||{ open: true }), sending: true } })); await apiFetch(`/tasks/${task.id}/actions/send-email`, { method: 'POST', headers: { 'x-tenant-id': tenantId, 'x-user-id': userId }, json: { subject: compose.subject, body: compose.body } }); alert('Email sent'); setEmailComposeMap(prev => ({ ...prev, [task.id]: { open: true, subject: compose.subject, body: '', sending: false } })); saveInlineReplyDraft(task.id, { subject: compose.subject, body: '' }); if (task.relatedType === 'LEAD' && task.relatedId) { try { const emailsRes = await apiFetch<any>(`/leads/${task.relatedId}/emails`, { headers: { 'x-tenant-id': tenantId } }); setLeadPreviews(prev => ({ ...prev, [task.relatedId as string]: { ...(prev[task.relatedId as string] || {}), emails: emailsRes.items || [] } })); } catch { console.warn('Failed to refresh email thread'); } } } catch (e) { console.error('Failed to send email', e); alert('Failed to send email'); setEmailComposeMap(prev => ({ ...prev, [task.id]: { ...(prev[task.id]||{ open: true }), sending: false } })); } }}>Send</button><button className="rounded border border-purple-300 text-purple-800 text-sm px-3 py-2" onClick={() => setEmailComposeMap(prev => ({ ...prev, [task.id]: { open: false, subject: '', body: '' } }))}>Cancel</button></div></div>)}
                    </div>
                  </div>
                )}

                {task.taskType === 'FORM' && task.formSchema?.fields && task.formSchema.fields.length > 0 && (
                  <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                    <div className="flex items-center justify-between mb-2"><div className="font-semibold text-pink-900 flex items-center gap-2"><FileText className="h-4 w-4" />Form Fields ({task.formSchema.fields.length})</div><button className="text-xs text-pink-700 hover:text-pink-900" onClick={() => setSectionOpen(prev => ({ ...prev, formFields: !prev.formFields }))}>{sectionOpen.formFields ? 'Hide' : 'Show'}</button></div>
                    {sectionOpen.formFields && (<div className="space-y-3">{task.formSchema.fields.map((field: any, idx: number) => { const key = field.key || field.id || field.label || `field_${idx}`; const label = field.label || key; const type = (field.type || 'text').toLowerCase(); const required = field.required ? ' *' : ''; const taskFormData = formDataMap[task.id] || {}; const value = taskFormData[key] || ''; const handleChange = (newValue: string) => setFormDataMap(prev => ({ ...prev, [task.id]: { ...(prev[task.id] || {}), [key]: newValue } })); const handleBlur = async () => { try { const currentData = formDataMap[task.id] || {}; await apiFetch(`/tasks/${task.id}`, { method: 'PATCH', headers: { 'x-tenant-id': tenantId, 'x-user-id': userId }, json: { formSubmissions: [{ submittedAt: new Date().toISOString(), submittedBy: userId, data: currentData }] } }); } catch (e) { console.error('Failed to save form data:', e); } }; return (<div key={key} className="bg-white rounded-lg p-3 border border-pink-100"><label className="block text-sm font-medium text-gray-700 mb-2">{label}{required}</label>{type === 'select' && field.options?.length ? (<select value={value} onChange={(e) => handleChange(e.target.value)} onBlur={handleBlur} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-200"><option value="">Select...</option>{field.options.map((opt: string) => (<option key={opt} value={opt}>{opt}</option>))}</select>) : type === 'textarea' ? (<textarea value={value} onChange={(e) => handleChange(e.target.value)} onBlur={handleBlur} placeholder="Enter response..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm min-h-[80px] focus:border-pink-400 focus:ring-2 focus:ring-pink-200" />) : (<input type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'email' ? 'email' : 'text'} value={value} onChange={(e) => handleChange(e.target.value)} onBlur={handleBlur} placeholder="Enter response..." className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-200" />)}</div>); })}</div>)}
                  </div>
                )}

                {task.taskType === 'CHECKLIST' && task.checklistItems && task.checklistItems.length > 0 && (
                  <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                    <div className="flex items-center justify-between mb-2"><div className="font-semibold text-indigo-900 flex items-center gap-2"><CheckSquare className="h-4 w-4" />Checklist ({task.checklistItems.filter(i => i.completed).length}/{task.checklistItems.length})</div><button className="text-xs text-indigo-700 hover:text-indigo-900" onClick={() => setSectionOpen(prev => ({ ...prev, checklist: !prev.checklist }))}>{sectionOpen.checklist ? 'Hide' : 'Show'}</button></div>
                    {sectionOpen.checklist && (<div className="space-y-2">{task.checklistItems.map((item: any) => (<button key={item.id} onClick={async () => { try { await apiFetch(`/tasks/${task.id}/checklist/${item.id}/toggle`, { method: 'POST', headers: { 'x-tenant-id': tenantId, 'x-user-id': userId } }); setTasks(prev => prev.map(t => t.id !== task.id ? t : ({ ...t, checklistItems: t.checklistItems?.map(ci => ci.id === item.id ? { ...ci, completed: !ci.completed } : ci) }))); } catch (e) { console.error('Failed to toggle checklist item:', e); } }} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors hover:opacity-80 ${item.completed ? 'bg-green-100 text-green-800' : 'bg-white text-gray-700 hover:bg-gray-50'}`}><div className={`flex items-center justify-center h-5 w-5 rounded border-2 transition-colors ${item.completed ? 'bg-green-500 border-green-600' : 'bg-white border-gray-300'}`}>{item.completed && <span className="text-white text-xs">✓</span>}</div><span className="text-sm flex-1 text-left">{item.label}</span></button>))}</div>)}
                  </div>
                )}
              </div>
            )}

            {isExpanded && !(task.relatedType === 'LEAD' && task.relatedId && leadData) && task.relatedType === 'LEAD' && task.relatedId && (<div className="mt-4 pt-4 border-t border-slate-200 text-center text-sm text-slate-500">Loading lead details...</div>)}
          </div>
        </div>
      </Card>
    );
  };

  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const showCategories = true;

  return (
    <div className={`flex flex-col min-h-0 ${focusMode ? 'bg-white' : ''}`}>
      {!embedded && mobile && (
        <div className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 flex items-center gap-2 shadow-sm">
          <button onClick={() => setHeaderCollapsed(!headerCollapsed)} className="text-xs font-semibold px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition">{headerCollapsed ? 'Show' : 'Hide'} Header</button>
          <h2 className="text-sm font-bold flex-1 truncate">Tasks ({filteredTasks.length})</h2>
          <button onClick={() => setExpandAll(v => !v)} className="text-xs px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition">{expandAll ? 'Collapse All' : 'Expand All'}</button>
          <button onClick={() => setFocusMode(!focusMode)} className="text-xs px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition">{focusMode ? 'Exit Focus' : 'Focus'}</button>
          <button onClick={handleNewTask} className="text-xs px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 transition">New</button>
        </div>
      )}

      {showCelebration && celebrationTask && (
        <TaskCelebration show={showCelebration} onClose={() => setShowCelebration(false)} taskTitle={celebrationTask.title} celebrationType={celebrationStats.streak >= 7 ? 'streak' : 'standard'} streakDays={celebrationStats.streak} totalCompleted={celebrationStats.total} pointsEarned={celebrationStats.points} />
      )}

      {!embedded && !focusMode && (
        <div className={`space-y-4 pb-4 ${mobile && headerCollapsed ? 'hidden' : 'block'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{filterRelatedType && filterRelatedId ? `${filterRelatedType} Tasks` : 'Task Center'}</h1>
              <p className="text-gray-600 mt-1">{filterRelatedType && filterRelatedId ? 'Filtered to the current record' : 'Manage all your tasks, communications, and forms in one place'}</p>
            </div>
            <div className="hidden md:flex items-center gap-2" />
          </div>

          <div className="hidden md:grid grid-cols-3 gap-4">
            <Card className="p-4 text-center"><div className="text-2xl font-bold">{filteredTasks.length}</div><div className="text-xs text-gray-500">Active</div></Card>
            <Card className="p-4 text-center"><div className="text-2xl font-bold">{streakDays}</div><div className="text-xs text-gray-500">Day Streak</div></Card>
            <Card className="p-4 text-center"><div className="text-2xl font-bold">{todayCompleted}</div><div className="text-xs text-gray-500">Completed Today</div></Card>
          </div>

          <div className="hidden md:block"><TaskStreakTracker /></div>

          {showCategories && (
            <Card className="p-4 md:sticky md:top-0 md:z-20 md:bg-white/95 md:backdrop-blur">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" />
                </div>
                <Button variant="outline" onClick={handleSearch} className="w-full sm:w-auto"><Search className="h-4 w-4 mr-2" />Search</Button>
                <Button variant={showOnlyMine ? 'default' : 'outline'} onClick={() => setShowOnlyMine(!showOnlyMine)} className="w-full sm:w-auto"><Filter className="h-4 w-4 mr-2" />{showOnlyMine ? 'My Tasks' : 'All Tasks'}</Button>
                <Button variant="outline" onClick={() => setExpandAll(v => !v)} className="w-full sm:w-auto">{expandAll ? 'Collapse All' : 'Expand All'}</Button>
                <Button variant="default" onClick={handleNewTask} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />New</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {embedded && (
        <div className="mb-3">
          <Card className="p-3 bg-white/90 backdrop-blur border border-slate-200">
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="pl-10" />
              </div>
              <div className="flex gap-2">
                <Button variant={showOnlyMine ? 'default' : 'outline'} size="sm" onClick={() => setShowOnlyMine(!showOnlyMine)}>{showOnlyMine ? 'My Tasks' : 'All Tasks'}</Button>
                <Button variant="outline" size="sm" onClick={() => setExpandAll(v => !v)}>{expandAll ? 'Collapse All' : 'Expand All'}</Button>
                <Button variant="default" size="sm" onClick={handleNewTask}>New</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-gray-400 mb-2"><CheckSquare className="h-12 w-12 mx-auto" /></div>
            <h3 className="text-lg font-semibold text-gray-700">No tasks found</h3>
            <p className="text-gray-500 mt-1">Create your first task to get started</p>
          </Card>
        ) : (
          <>
            <div className={`md:hidden space-y-6 ${focusMode ? 'pt-2' : ''}`}>
              {overdue.length > 0 && (<section><div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-red-600">Overdue ({overdue.length})</span></div><div className="space-y-3">{overdue.map((t) => renderTaskCard(t))}</div></section>)}
              {urgent.length > 0 && (<section><div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-orange-600">Urgent ({urgent.length})</span></div><div className="space-y-3">{urgent.map((t) => renderTaskCard(t))}</div></section>)}
              {highPriority.length > 0 && (<section><div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-blue-600">High Priority ({highPriority.length})</span></div><div className="space-y-3">{highPriority.map((t) => renderTaskCard(t))}</div></section>)}
              {upcoming.length > 0 && (<section><div className="flex items-center gap-2 mb-3"><span className="text-sm font-semibold text-gray-700">Upcoming ({upcoming.length})</span></div><div className="space-y-3">{upcoming.map((t) => renderTaskCard(t))}</div></section>)}
            </div>

            <div className="hidden md:grid gap-4 pb-6">{filteredTasks.map(renderTaskCard)}</div>

            {embedded && filterRelatedType === 'LEAD' && filterRelatedId && completedCommunicationTasks.length > 0 && (
              <div className="mt-8">
                <div className="mb-3 text-sm font-semibold text-slate-900">Communication history ({completedCommunicationTasks.length})</div>
                <div className="grid gap-4 md:grid-cols-1">
                  {completedCommunicationTasks.map(renderTaskCard)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CreateTaskWizard
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        tenantId={tenantId}
        userId={userId}
        relatedType={filterRelatedType}
        relatedId={filterRelatedId}
        onCreated={async () => {
          await loadTasks();
          await Promise.resolve(onTasksChanged?.());
        }}
      />

      <TaskModal
        open={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        tenantId={tenantId}
        userId={userId}
        onChanged={async () => {
          await loadTasks();
          await Promise.resolve(onTasksChanged?.());
        }}
      />

      {emailPreview.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 z-[60]">
          <Card className="w-full h-full max-w-none md:max-w-2xl md:h-auto md:my-10 rounded-none md:rounded-xl overflow-y-auto">
            <div className="p-4 md:p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">{emailPreview.action === 'accept' ? '✓ Accept Enquiry' : '↓ Decline Enquiry'}</h2><Button variant="ghost" size="sm" onClick={() => setEmailPreview({ ...emailPreview, isOpen: false })}>✕</Button></div>
              <div className="space-y-4 flex-1 overflow-y-auto">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">To:</label><div className="text-sm text-gray-900">{emailPreview.recipientName ? `${emailPreview.recipientName} <${emailPreview.to}>` : emailPreview.to}</div></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label><Input value={emailPreview.subject} onChange={(e) => setEmailPreview({ ...emailPreview, subject: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Message:</label><textarea value={emailPreview.body} onChange={(e) => setEmailPreview({ ...emailPreview, body: e.target.value })} rows={12} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm" /></div>
                <div className="flex gap-3 pt-4 flex-wrap">
                  <Button variant="outline" onClick={() => setEmailPreview({ ...emailPreview, isOpen: false })} className="flex-1">Cancel</Button>
                  {emailPreview.action === 'accept' && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!emailPreview.taskId) return;
                        try {
                          await apiFetch(`/tasks/${emailPreview.taskId}/actions/accept-enquiry`, {
                            method: 'POST',
                            headers: { 'x-tenant-id': tenantId },
                            json: { skipEmail: true },
                          });
                          setEmailPreview({ ...emailPreview, isOpen: false });
                          await loadTasks();
                          alert('Enquiry accepted (no email sent)');
                        } catch {
                          alert('Failed to accept enquiry');
                        }
                      }}
                      className="flex-1"
                    >Accept (no email)</Button>
                  )}
                  <Button onClick={async () => { if (!emailPreview.taskId || !emailPreview.action) return; try { const endpoint = emailPreview.action === 'accept' ? 'accept-enquiry' : 'decline-enquiry'; await apiFetch(`/tasks/${emailPreview.taskId}/actions/${endpoint}`, { method: 'POST', headers: { 'x-tenant-id': tenantId }, json: { subject: emailPreview.subject, body: emailPreview.body } }); setEmailPreview({ ...emailPreview, isOpen: false }); await loadTasks(); alert('Email sent successfully!'); } catch { alert('Failed to send email'); } }} className="flex-1 bg-blue-600 hover:bg-blue-700"><Mail className="h-4 w-4 mr-2" />Send Email</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
