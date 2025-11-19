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
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Activity Timeline
        </h3>
        
        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={activeTab === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('timeline')}
            className="gap-2"
          >
            <Clock className="h-4 w-4" />
            Timeline
          </Button>
          <Button
            variant={activeTab === 'add-note' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('add-note')}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Note
          </Button>
          <Button
            variant={activeTab === 'add-task' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('add-task')}
            className="gap-2"
          >
            <CheckSquare className="h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Timeline View */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-sm">Loading activity...</p>
            </div>
          ) : groupedActivities.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-gradient-to-br from-white to-slate-50 p-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600 mb-2">No activity yet</p>
              <p className="text-sm text-slate-500 mb-4">
                Add a note or schedule a follow-up to get started
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setActiveTab('add-note')} size="sm">
                  Add Note
                </Button>
                <Button onClick={() => setActiveTab('add-task')} variant="outline" size="sm">
                  Create Task
                </Button>
              </div>
            </div>
          ) : (
            groupedActivities.map((group) => (
              <div key={group.date} className="space-y-3">
                {/* Date Header */}
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm py-2 border-b">
                  <h4 className="text-sm font-semibold text-slate-700">{group.label}</h4>
                </div>

                {/* Events in this date group */}
                <div className="space-y-2">
                  {group.events.map((event) => (
                    <ActivityEventCard
                      key={`${event.type}-${event.id}`}
                      event={event}
                      onCompleteTask={onCompleteTask}
                      onComposeEmail={onComposeEmail}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Note Form */}
      {activeTab === 'add-note' && (
        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Log Communication
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('timeline')}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            {(['note', 'call', 'email'] as CommunicationType[]).map((type) => (
              <button
                key={type}
                onClick={() => setCommunicationType(type)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  communicationType === type
                    ? 'bg-white shadow-md border-2 border-green-400'
                    : 'bg-white/60 border border-green-200 hover:bg-white'
                }`}
              >
                {type === 'call' ? (
                  <><Phone className="h-4 w-4 inline mr-1" /> Call</>
                ) : type === 'email' ? (
                  <><Mail className="h-4 w-4 inline mr-1" /> Email</>
                ) : (
                  <><FileText className="h-4 w-4 inline mr-1" /> Note</>
                )}
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
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 min-h-32 text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400"
            autoFocus
          />

          <div className="flex gap-2">
            <Button onClick={handleAddCommunication} disabled={!noteContent.trim() || saving} className="flex-1">
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
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Create Task
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('timeline')}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <input
            type="text"
            value={taskForm.title}
            onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Task title (e.g., Call client about quote)"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
            autoFocus
          />

          <textarea
            value={taskForm.description}
            onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Add details..."
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm min-h-24 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={taskForm.priority}
              onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' }))}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
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
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
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

      {/* Quick Follow-up Actions */}
      {activeTab === 'timeline' && (onScheduleEmailFollowup || onSchedulePhoneFollowup || onCreateAutoSequence) && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Quick Follow-up Scheduling
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {onScheduleEmailFollowup && (
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={onScheduleEmailFollowup}
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Mail className="h-4 w-4" />
                    Email Follow-up
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Schedule email in 3 days
                  </span>
                </div>
              </Button>
            )}

            {onSchedulePhoneFollowup && (
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={onSchedulePhoneFollowup}
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Phone className="h-4 w-4" />
                    Phone Follow-up
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Schedule call in 5 days
                  </span>
                </div>
              </Button>
            )}

            {onCreateAutoSequence && (
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={onCreateAutoSequence}
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2 font-medium">
                    <TrendingUp className="h-4 w-4" />
                    Auto Sequence
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Email (3d) + Phone (7d)
                  </span>
                </div>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Activity Event Card Component
function ActivityEventCard({
  event,
  onCompleteTask,
  onComposeEmail,
}: {
  event: ActivityEvent;
  onCompleteTask: (taskId: string) => Promise<void>;
  onComposeEmail?: (taskId: string) => void;
}) {
  const timestamp = getActivityTimestamp(event);
  const time = new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (event.type === 'note') {
    return (
      <div className="flex gap-3 p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow">
        <div className="flex-shrink-0">
          <FileText className="h-5 w-5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Note</span>
            <span className="text-xs text-slate-500">{time}</span>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{event.text}</p>
        </div>
      </div>
    );
  }

  if (event.type === 'task') {
    const isPending = event.status !== 'DONE' && event.status !== 'CANCELLED';
    const isFollowup = event.meta?.type && ['email_followup', 'phone_followup'].includes(event.meta.type);

    return (
      <div
        className={`flex gap-3 p-4 rounded-lg border transition-all ${
          isPending
            ? 'bg-blue-50 border-blue-200 hover:shadow-md'
            : 'bg-green-50 border-green-200 opacity-75'
        }`}
      >
        <div className="flex-shrink-0">
          {event.meta?.type === 'email_followup' ? (
            <Mail className="h-5 w-5 text-blue-600" />
          ) : event.meta?.type === 'phone_followup' ? (
            <Phone className="h-5 w-5 text-blue-600" />
          ) : isPending ? (
            <Clock className="h-5 w-5 text-blue-600" />
          ) : (
            <CheckSquare className="h-5 w-5 text-green-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {isPending ? 'Task' : 'Completed Task'}
            </span>
            <div className="flex items-center gap-2">
              {event.priority && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    event.priority === 'URGENT'
                      ? 'bg-red-100 text-red-700'
                      : event.priority === 'HIGH'
                      ? 'bg-orange-100 text-orange-700'
                      : event.priority === 'MEDIUM'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {event.priority}
                </span>
              )}
              <span className="text-xs text-slate-500">
                {event.dueAt ? `Due ${new Date(event.dueAt).toLocaleDateString()}` : time}
              </span>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">{event.title}</p>
          {event.description && <p className="text-xs text-slate-600 mb-2">{event.description}</p>}
          {isPending && (
            <div className="flex gap-2 mt-3">
              {isFollowup && event.meta?.type === 'email_followup' && onComposeEmail && (
                <Button size="sm" onClick={() => onComposeEmail(event.id)} className="gap-2">
                  <Mail className="h-3 w-3" />
                  Compose Email
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onCompleteTask(event.id)} className="gap-2">
                <CheckSquare className="h-3 w-3" />
                Mark Done
              </Button>
            </div>
          )}
          {!isPending && event.completedAt && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              Completed {new Date(event.completedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (event.type === 'email') {
    return (
      <div className="flex gap-3 p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow">
        <div className="flex-shrink-0">
          <Mail className={`h-5 w-5 ${event.direction === 'inbound' ? 'text-green-600' : 'text-blue-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Email {event.direction === 'inbound' ? 'Received' : 'Sent'}
            </span>
            <span className="text-xs text-slate-500">{time}</span>
          </div>
          {event.subject && <p className="text-sm font-medium text-slate-900 mb-1">{event.subject}</p>}
          {event.summary && <p className="text-sm text-slate-700">{event.summary}</p>}
          {event.status && (
            <span
              className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                event.status === 'sent'
                  ? 'bg-green-100 text-green-700'
                  : event.status === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {event.status}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (event.type === 'call') {
    return (
      <div className="flex gap-3 p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow">
        <div className="flex-shrink-0">
          <Phone className={`h-5 w-5 ${event.direction === 'inbound' ? 'text-green-600' : 'text-blue-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {event.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call'}
            </span>
            <span className="text-xs text-slate-500">{time}</span>
          </div>
          {event.summary && <p className="text-sm text-slate-700">{event.summary}</p>}
          {event.duration && (
            <p className="text-xs text-slate-500 mt-1">
              Duration: {Math.floor(event.duration / 60)}m {event.duration % 60}s
            </p>
          )}
        </div>
      </div>
    );
  }

  if (event.type === 'status_change') {
    return (
      <div className="flex gap-3 p-4 rounded-lg border border-indigo-200 bg-indigo-50">
        <div className="flex-shrink-0">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Status Changed</span>
            <span className="text-xs text-slate-500">{time}</span>
          </div>
          <p className="text-sm text-slate-900">
            <span className="font-medium">{event.from}</span> → <span className="font-medium">{event.to}</span>
          </p>
          {event.reason && <p className="text-xs text-slate-600 mt-1">{event.reason}</p>}
        </div>
      </div>
    );
  }

  if (event.type === 'quote_event') {
    return (
      <div className="flex gap-3 p-4 rounded-lg border border-purple-200 bg-purple-50">
        <div className="flex-shrink-0">
          <FileSignature className="h-5 w-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {event.kind.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-500">{time}</span>
          </div>
          <p className="text-sm text-slate-900">{event.quoteTitle || `Quote #${event.quoteId}`}</p>
          {event.amount != null && (
            <p className="text-sm font-medium text-purple-700 mt-1">
              {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(event.amount)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (event.type === 'followup_scheduled') {
    return (
      <div className="flex gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50">
        <div className="flex-shrink-0">
          <Calendar className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Follow-up Scheduled</span>
            <span className="text-xs text-slate-500">{time}</span>
          </div>
          <p className="text-sm text-slate-900">
            {event.kind} scheduled for {new Date(event.scheduledFor).toLocaleString()}
          </p>
          {event.details && <p className="text-xs text-slate-600 mt-1">{event.details}</p>}
        </div>
      </div>
    );
  }

  return null;
}
