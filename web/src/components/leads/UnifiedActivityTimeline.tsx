/**
 * Unified Activity Timeline
 * 
 * Single, integrated view of all lead activity:
 * - Notes, calls, emails
 * - Tasks and follow-ups
 * - Status changes
 * - Quote events
 * 
 * Features:
 * - Live updates via SWR
 * - Optimistic UI updates
 * - Date grouping
 * - Type-specific icons and formatting
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  CheckSquare, 
  Mail, 
  Phone, 
  TrendingUp, 
  FileSignature,
  Calendar,
  Clock,
  Plus,
  X,
} from "lucide-react";
import { 
  ActivityEvent, 
  groupActivitiesByDate,
  getActivityTimestamp,
} from "@/lib/activity-types";

type CommunicationType = 'call' | 'email' | 'note';

interface UnifiedActivityTimelineProps {
  // All activities come from the unified hook
  activities: ActivityEvent[];
  isLoading?: boolean;
  
  // Action handlers
  onAddNote: (content: string) => Promise<void>;
  onAddCall: (summary: string) => Promise<void>;
  onAddEmail: (summary: string) => Promise<void>;
  onCreateTask: (task: {
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueAt: string;
  }) => Promise<void>;
  onCompleteTask: (taskId: string) => Promise<void>;
  onComposeEmail?: (taskId: string) => void;
  
  // Quick actions
  onScheduleEmailFollowup?: () => Promise<void>;
  onSchedulePhoneFollowup?: () => Promise<void>;
  onCreateAutoSequence?: () => Promise<void>;
}

export function UnifiedActivityTimeline({
  activities,
  isLoading = false,
  onAddNote,
  onAddCall,
  onAddEmail,
  onCreateTask,
  onCompleteTask,
  onComposeEmail,
  onScheduleEmailFollowup,
  onSchedulePhoneFollowup,
  onCreateAutoSequence,
}: UnifiedActivityTimelineProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'add-note' | 'add-task'>('timeline');
  const [communicationType, setCommunicationType] = useState<CommunicationType>('note');
  const [noteContent, setNoteContent] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    dueAt: '',
  });
  const [saving, setSaving] = useState(false);

  // Group activities by date
  const groupedActivities = groupActivitiesByDate(activities);

  const handleAddCommunication = useCallback(async () => {
    if (!noteContent.trim()) return;
    setSaving(true);
    try {
      if (communicationType === 'note') {
        await onAddNote(noteContent);
      } else if (communicationType === 'call') {
        await onAddCall(noteContent);
      } else if (communicationType === 'email') {
        await onAddEmail(noteContent);
      }
      setNoteContent('');
      setActiveTab('timeline');
    } catch (error) {
      console.error('Failed to add communication:', error);
    } finally {
      setSaving(false);
    }
  }, [noteContent, communicationType, onAddNote, onAddCall, onAddEmail]);

  const handleCreateTask = useCallback(async () => {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    try {
      await onCreateTask(taskForm);
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueAt: '' });
      setActiveTab('timeline');
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setSaving(false);
    }
  }, [taskForm, onCreateTask]);

  return (
    <div className="space-y-4">
      {/* Quick Action Tabs */}
      <div className="flex gap-2 flex-wrap bg-white rounded-lg border p-2">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'timeline'
              ? 'bg-blue-100 text-blue-900'
              : 'hover:bg-slate-50 text-slate-600'
          }`}
        >
          📋 Timeline
        </button>
        <button
          onClick={() => setActiveTab('add-note')}
          className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'add-note'
              ? 'bg-green-100 text-green-900'
              : 'hover:bg-slate-50 text-slate-600'
          }`}
        >
          💬 Add Note
        </button>
        <button
          onClick={() => setActiveTab('add-task')}
          className={`flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'add-task'
              ? 'bg-indigo-100 text-indigo-900'
              : 'hover:bg-slate-50 text-slate-600'
          }`}
        >
          ✅ Add Task
        </button>
      </div>

      {/* Timeline View */}
      {activeTab === 'timeline' && (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Activity Timeline</h3>
            {loading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {timelineItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm">No activity yet</p>
                <p className="text-xs mt-1">Use the tabs above to add notes or tasks</p>
              </div>
            ) : (
              timelineItems.map((item, idx) => {
                if (item.type === 'communication') {
                  const entry = item.data as CommunicationEntry;
                  return (
                    <div
                      key={`comm-${entry.id}-${idx}`}
                      className="flex gap-3 p-3 rounded-lg border bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="text-2xl flex-shrink-0">
                        {entry.type === 'call' ? '📞' : entry.type === 'email' ? '📧' : '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {entry.type === 'call' ? 'Phone Call' : entry.type === 'email' ? 'Email' : 'Note'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(entry.timestamp).toLocaleDateString()} at{' '}
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.content}</p>
                      </div>
                    </div>
                  );
                } else {
                  const task = item.data as Task;
                  const isPending = task.status !== 'DONE';
                  const isFollowup = task.meta?.type && ['email_followup', 'phone_followup'].includes(task.meta.type);

                  return (
                    <div
                      key={`task-${task.id}-${idx}`}
                      className={`flex gap-3 p-3 rounded-lg border transition-colors ${
                        isPending
                          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="text-2xl flex-shrink-0">
                        {task.meta?.type === 'email_followup' ? '📧' :
                         task.meta?.type === 'phone_followup' ? '📞' :
                         isPending ? '⏰' : '✅'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {isPending ? 'Pending Task' : 'Completed Task'}
                          </span>
                          <div className="flex items-center gap-2">
                            {task.priority && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                task.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                                task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {task.priority}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              {task.dueAt ? `Due ${new Date(task.dueAt).toLocaleDateString()}` : 'No due date'}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-1">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-slate-600 mb-2">{task.description}</p>
                        )}
                        {isPending && (
                          <div className="flex gap-2 mt-2">
                            {isFollowup && task.meta?.type === 'email_followup' && (
                              <Button size="sm" onClick={() => onComposeEmail(task.id)}>
                                📧 Compose Email
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCompleteTask(task.id)}
                            >
                              ✓ Mark Done
                            </Button>
                          </div>
                        )}
                        {!isPending && task.completedAt && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Completed {new Date(task.completedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
              })
            )}
          </div>
        </div>
      )}

      {/* Add Note Form */}
      {activeTab === 'add-note' && (
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <span>💬</span>
            Log Communication
          </h3>

          <div className="flex gap-2">
            {(['note', 'call', 'email'] as CommunicationType[]).map((type) => (
              <button
                key={type}
                onClick={() => setCommunicationType(type)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  communicationType === type
                    ? 'bg-white shadow-sm border-2 border-green-300'
                    : 'bg-white/50 border border-green-200 hover:bg-white/80'
                }`}
              >
                {type === 'call' ? '📞 Call' : type === 'email' ? '📧 Email' : '📝 Note'}
              </button>
            ))}
          </div>

          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder={
              communicationType === 'call'
                ? 'What was discussed? Any follow-up needed?'
                : communicationType === 'email'
                ? 'Summarize the email conversation...'
                : 'Add any notes about this lead...'
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 min-h-32 text-sm focus:ring-2 focus:ring-green-300 focus:border-green-300"
          />

          <div className="flex gap-2">
            <Button onClick={handleAddNote} disabled={!noteContent.trim() || saving} className="flex-1">
              {saving ? 'Saving...' : `Save ${communicationType === 'call' ? 'Call Log' : communicationType === 'email' ? 'Email Log' : 'Note'}`}
            </Button>
            <Button variant="outline" onClick={() => { setNoteContent(''); setActiveTab('timeline'); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Add Task Form */}
      {activeTab === 'add-task' && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <span>✅</span>
            Create Task
          </h3>

          <input
            type="text"
            value={taskForm.title}
            onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Task title (e.g., Call client about quote)"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
          />

          <textarea
            value={taskForm.description}
            onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Add details..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-24 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={taskForm.priority}
              onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value as Task['priority'] }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent</option>
            </select>

            <input
              type="datetime-local"
              value={taskForm.dueAt}
              onChange={(e) => setTaskForm(prev => ({ ...prev, dueAt: e.target.value }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreateTask} disabled={!taskForm.title.trim() || saving} className="flex-1">
              {saving ? 'Creating...' : 'Create Task'}
            </Button>
            <Button variant="outline" onClick={() => { 
              setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueAt: '' }); 
              setActiveTab('timeline'); 
            }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
