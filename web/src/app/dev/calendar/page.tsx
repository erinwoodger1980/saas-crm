"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, Edit2, Trash2 } from "lucide-react";

type DevTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  estimatedHours: number | null;
  actualHours: number | null;
  assignee: string | null;
  scheduledDate: string | null;
};

type CalendarSummary = Record<string, Record<string, number>>;

type DaySchedule = {
  id: string;
  date: string;
  isWorkDay: boolean;
  availableHours: number;
  notes: string | null;
};

type TaskAssignment = {
  id: string;
  devTaskId: string;
  date: string;
  allocatedHours: number;
  devTask: DevTask;
};

export default function DevCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [schedules, setSchedules] = useState<Record<string, DaySchedule>>({});
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [summary, setSummary] = useState<CalendarSummary>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<DevTask | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showTaskDetailDialog, setShowTaskDetailDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<DaySchedule>>({});
  const [assignmentForm, setAssignmentForm] = useState<Partial<TaskAssignment>>({});
  const [loading, setLoading] = useState(true);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [timerNotes, setTimerNotes] = useState(\"\");

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

  function getDateRange() {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    switch (viewMode) {
      case 'day':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start.setDate(start.getDate() - start.getDay());
        end.setDate(start.getDate() + 6);
        break;
      case 'month':
        start.setDate(1);
        end.setMonth(end.getMonth() + 1, 0);
        break;
      case 'year':
        start.setMonth(0, 1);
        end.setMonth(11, 31);
        break;
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  async function loadData() {
    setLoading(true);
    try {
      const { startDate: start, endDate: end } = getDateRange();
      
      const [tasksData, schedulesData, assignmentsData, timerData, summaryData] = await Promise.all([
        apiFetch<{ ok: boolean; tasks: DevTask[] }>("/dev/tasks"),
        apiFetch<{ ok: boolean; schedules: DaySchedule[] }>(`/dev/calendar/schedules?month=${currentDate.toISOString()}`),
        apiFetch<{ ok: boolean; assignments: TaskAssignment[] }>(`/dev/calendar/assignments?month=${currentDate.toISOString()}`),
        apiFetch<{ ok: boolean; timer: any }>("/dev/timer/active"),
        apiFetch<{ ok: boolean; summary: CalendarSummary }>(`/dev/calendar/summary?startDate=${start}&endDate=${end}`)
      ]);

      if (tasksData.ok) setTasks(tasksData.tasks);
      
      if (schedulesData.ok) {
        const schedMap: Record<string, DaySchedule> = {};
        schedulesData.schedules.forEach(s => {
          schedMap[s.date] = s;
        });
        setSchedules(schedMap);
      }
      
      if (assignmentsData.ok) setAssignments(assignmentsData.assignments);
      if (timerData.ok && timerData.timer) setActiveTimer(timerData.timer);
      if (summaryData.ok) setSummary(summaryData.summary);
    } catch (e) {
      console.error("Failed to load calendar data:", e);
    } finally {
      setLoading(false);
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
        await loadData();
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
      await loadData();
    } catch (e: any) {
      alert("Failed to stop timer: " + e.message);
    }
  }

  function openTaskDetail(task: DevTask) {
    setSelectedTask(task);
    setShowTaskDetailDialog(true);
  }

  useEffect(() => {
    loadData();
  }, [currentDate, viewMode]);

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function getDaySchedule(dateStr: string): DaySchedule | null {
    return schedules[dateStr] || null;
  }

  function getDayAssignments(dateStr: string): TaskAssignment[] {
    return assignments.filter(a => a.date === dateStr);
  }

  function getDirectlyScheduledTasks(dateStr: string): DevTask[] {
    return tasks.filter(t => t.scheduledDate === dateStr);
  }

  function getTotalAllocated(dateStr: string): number {
    return getDayAssignments(dateStr).reduce((sum, a) => sum + a.allocatedHours, 0);
  }

  async function saveDaySchedule() {
    if (!selectedDate) return;
    try {
      const data = await apiFetch<{ ok: boolean; schedule: DaySchedule }>("/dev/calendar/schedules", {
        method: "POST",
        json: {
          date: selectedDate,
          isWorkDay: editingSchedule.isWorkDay ?? true,
          availableHours: editingSchedule.availableHours ?? 8,
          notes: editingSchedule.notes
        }
      });
      
      if (data.ok) {
        setSchedules(prev => ({ ...prev, [selectedDate]: data.schedule }));
        setShowDayDialog(false);
        setEditingSchedule({});
      }
    } catch (e: any) {
      alert("Failed to save schedule: " + e.message);
    }
  }

  async function assignTask() {
    if (!selectedDate || !assignmentForm.devTaskId) return;
    try {
      const data = await apiFetch<{ ok: boolean; assignment: TaskAssignment }>("/dev/calendar/assignments", {
        method: "POST",
        json: {
          devTaskId: assignmentForm.devTaskId,
          date: selectedDate,
          allocatedHours: assignmentForm.allocatedHours || 1
        }
      });
      
      if (data.ok) {
        setAssignments(prev => [...prev, data.assignment]);
        setShowAssignDialog(false);
        setAssignmentForm({});
      }
    } catch (e: any) {
      alert("Failed to assign task: " + e.message);
    }
  }

  async function deleteAssignment(id: string) {
    if (!confirm("Remove this task assignment?")) return;
    try {
      await apiFetch(`/dev/calendar/assignments/${id}`, { method: "DELETE" });
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      alert("Failed to delete assignment: " + e.message);
    }
  }

  function openDayDialog(dateStr: string) {
    setSelectedDate(dateStr);
    const existing = getDaySchedule(dateStr);
    setEditingSchedule(existing || { isWorkDay: true, availableHours: 8 });
    setShowDayDialog(true);
  }

  function openAssignDialog(dateStr: string) {
    setSelectedDate(dateStr);
    setAssignmentForm({});
    setShowAssignDialog(true);
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case "CRITICAL": return "bg-red-500";
      case "HIGH": return "bg-orange-500";
      case "MEDIUM": return "bg-yellow-500";
      case "LOW": return "bg-green-500";
      default: return "bg-gray-500";
    }
  }

  const renderCalendar = () => {
    const days: JSX.Element[] = [];
    const date = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dateStr = formatDate(date);
      const isCurrentMonth = date.getMonth() === currentDate.getMonth();
      const isToday = formatDate(new Date()) === dateStr;
      const schedule = getDaySchedule(dateStr);
      const dayAssignments = getDayAssignments(dateStr);
      const totalAllocated = getTotalAllocated(dateStr);
      const isOverallocated = schedule && totalAllocated > schedule.availableHours;

      days.push(
        <div
          key={dateStr}
          className={`
            min-h-[120px] border p-2 
            ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
            ${isToday ? 'ring-2 ring-blue-500' : ''}
            ${schedule?.isWorkDay === false ? 'bg-gray-100' : ''}
            ${isOverallocated ? 'bg-red-50' : ''}
            hover:bg-gray-50 cursor-pointer transition-colors
          `}
          onClick={() => openDayDialog(dateStr)}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-medium ${isCurrentMonth ? '' : 'text-gray-400'}`}>
              {date.getDate()}
            </span>
            {schedule?.isWorkDay && (
              <span className="text-xs text-gray-600">
                {totalAllocated}h / {schedule.availableHours}h
              </span>
            )}
          </div>

          {schedule?.isWorkDay === false && (
            <div className="text-xs text-gray-500 italic mb-1">Non-working day</div>
          )}

          <div className="space-y-1">
            {dayAssignments.map(assignment => (
              <div
                key={assignment.id}
                className="text-xs p-1 rounded bg-blue-100 border-l-2 border-blue-500 cursor-pointer hover:bg-blue-200"
                onClick={(e) => {
                  e.stopPropagation();
                  openTaskDetail(assignment.devTask);
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 truncate">
                    <div className="font-medium truncate">{assignment.devTask.title}</div>
                    <div className="text-gray-600">{assignment.allocatedHours}h</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAssignment(assignment.id);
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {getDirectlyScheduledTasks(dateStr).map(task => (
              <div
                key={task.id}
                className="text-xs p-1 rounded bg-purple-100 border-l-2 border-purple-500 cursor-pointer hover:bg-purple-200"
                onClick={(e) => {
                  e.stopPropagation();
                  openTaskDetail(task);
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 truncate">
                    <div className="font-medium truncate">{task.title}</div>
                    <div className="text-gray-600">{task.estimatedHours || 0}h est</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {schedule?.isWorkDay !== false && isCurrentMonth && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openAssignDialog(dateStr);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
            >
              + Task
            </button>
          )}
        </div>
      );

      date.setDate(date.getDate() + 1);
    }

    return days;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      DEVELOPMENT: 'bg-blue-100 text-blue-700',
      BUG_FIX: 'bg-red-100 text-red-700',
      FEATURE: 'bg-green-100 text-green-700',
      COACHING: 'bg-purple-100 text-purple-700',
      FAMILY_TIME: 'bg-pink-100 text-pink-700',
      HOUSEWORK: 'bg-orange-100 text-orange-700',
      ADMIN: 'bg-gray-100 text-gray-700',
      LEARNING: 'bg-cyan-100 text-cyan-700',
      MEETING: 'bg-yellow-100 text-yellow-700',
      OTHER: 'bg-slate-100 text-slate-700'
    };
    return colors[type] || colors.OTHER;
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="w-8 h-8" />
            Development Calendar
          </h1>
          <p className="text-sm text-gray-600">Schedule tasks and set working days</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/dev/tasks'}>
            Back to Tasks
          </Button>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="flex items-center gap-2 bg-white p-2 rounded border w-fit">
        <Button
          size="sm"
          variant={viewMode === 'day' ? 'default' : 'outline'}
          onClick={() => setViewMode('day')}
        >
          Day
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'week' ? 'default' : 'outline'}
          onClick={() => setViewMode('week')}
        >
          Week
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'month' ? 'default' : 'outline'}
          onClick={() => setViewMode('month')}
        >
          Month
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'year' ? 'default' : 'outline'}
          onClick={() => setViewMode('year')}
        >
          Year
        </Button>
      </div>

      {/* Summary Stats by Developer and Type */}
      {Object.keys(summary).length > 0 && (
        <div className="bg-white p-6 rounded border space-y-4">
          <h2 className="text-lg font-semibold">Time Allocation Summary ({viewMode})</h2>
          <div className="space-y-3">
            {Object.entries(summary).map(([assignee, types]) => {
              const total = Object.values(types).reduce((sum, hours) => sum + hours, 0);
              return (
                <div key={assignee} className="border rounded p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-lg">{assignee}</div>
                    <div className="text-lg font-bold text-blue-600">{total.toFixed(1)}h</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(types).map(([type, hours]) => (
                      <div key={type} className={`px-3 py-1 rounded text-sm ${getTypeColor(type)}`}>
                        {type.replace(/_/g, ' ')}: {hours.toFixed(1)}h
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded border">
        <Button variant="outline" onClick={prevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold">{monthName}</h2>
        <Button variant="outline" onClick={nextMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="bg-white p-4 rounded border">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border-l-2 border-blue-500 rounded"></div>
            <span>Scheduled Task</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border rounded"></div>
            <span>Overallocated</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border rounded"></div>
            <span>Non-working Day</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 ring-2 ring-blue-500 rounded"></div>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading calendar...</div>
      ) : (
        <div className="bg-white rounded border">
          <div className="grid grid-cols-7 gap-0">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center font-medium text-sm bg-gray-100 border">
                {day}
              </div>
            ))}
            {renderCalendar()}
          </div>
        </div>
      )}

      {/* Day Schedule Dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Day Schedule: {selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingSchedule.isWorkDay ?? true}
                onChange={(e) => setEditingSchedule({ ...editingSchedule, isWorkDay: e.target.checked })}
                id="isWorkDay"
              />
              <label htmlFor="isWorkDay">This is a working day</label>
            </div>

            {editingSchedule.isWorkDay !== false && (
              <div>
                <label className="text-sm font-medium">Available Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  value={editingSchedule.availableHours ?? 8}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, availableHours: parseFloat(e.target.value) })}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={editingSchedule.notes || ""}
                onChange={(e) => setEditingSchedule({ ...editingSchedule, notes: e.target.value })}
                placeholder="e.g., Half day, meeting in afternoon"
              />
            </div>

            {/* Show assigned tasks for this day */}
            {selectedDate && getDayAssignments(selectedDate).length > 0 && (
              <div>
                <label className="text-sm font-medium">Assigned Tasks</label>
                <div className="space-y-2 mt-2">
                  {getDayAssignments(selectedDate).map(assignment => (
                    <div key={assignment.id} className="p-2 bg-blue-50 rounded border flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{assignment.devTask.title}</div>
                        <div className="text-xs text-gray-600">{assignment.allocatedHours}h allocated</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteAssignment(assignment.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={saveDaySchedule}>Save</Button>
              <Button variant="outline" onClick={() => {
                if (selectedDate) {
                  openAssignDialog(selectedDate);
                  setShowDayDialog(false);
                }
              }}>
                Assign Task
              </Button>
              <Button variant="ghost" onClick={() => setShowDayDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task to {selectedDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Task</label>
              <Select
                value={assignmentForm.devTaskId || ""}
                onValueChange={(v) => {
                  const task = tasks.find(t => t.id === v);
                  setAssignmentForm({
                    ...assignmentForm,
                    devTaskId: v,
                    allocatedHours: task?.estimatedHours || 1
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select a task..." /></SelectTrigger>
                <SelectContent>
                  {tasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                        <span>{task.title}</span>
                        {task.estimatedHours && (
                          <span className="text-xs text-gray-500">({task.estimatedHours}h)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Allocated Hours</label>
              <Input
                type="number"
                step="0.5"
                value={assignmentForm.allocatedHours || 1}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, allocatedHours: parseFloat(e.target.value) })}
              />
            </div>

            {selectedDate && getDaySchedule(selectedDate) && (
              <div className="text-sm text-gray-600">
                Available: {getDaySchedule(selectedDate)!.availableHours}h | 
                Allocated: {getTotalAllocated(selectedDate)}h |
                Remaining: {getDaySchedule(selectedDate)!.availableHours - getTotalAllocated(selectedDate)}h
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={assignTask}>Assign</Button>
              <Button variant="ghost" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={showTaskDetailDialog} onOpenChange={setShowTaskDetailDialog}>
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
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Task Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="ml-2">{selectedTask.status}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Priority:</span>
                    <span className="ml-2">{selectedTask.priority}</span>
                  </div>
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
                <div className="flex gap-2 justify-end border-t pt-4">
                  <Button variant="ghost" onClick={() => setShowTaskDetailDialog(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
