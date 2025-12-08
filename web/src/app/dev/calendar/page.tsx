"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [createTaskForm, setCreateTaskForm] = useState<Partial<DevTask>>({ status: 'BACKLOG', priority: 'MEDIUM', type: 'DEVELOPMENT' });
  const [loading, setLoading] = useState(true);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [timerNotes, setTimerNotes] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingTaskAssignee, setEditingTaskAssignee] = useState<string | null>(null);

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

  function openCreateTaskDialog(dateStr?: string) {
    if (dateStr) setSelectedDate(dateStr);
    setCreateTaskForm({ status: 'BACKLOG', priority: 'MEDIUM', type: 'DEVELOPMENT', scheduledDate: dateStr });
    setShowCreateTaskDialog(true);
  }

  async function createTask() {
    try {
      const data = await apiFetch<{ ok: boolean; task: DevTask }>("/dev/tasks", {
        method: "POST",
        json: createTaskForm
      });
      if (data.ok) {
        setTasks(prev => [...prev, data.task]);
        setShowCreateTaskDialog(false);
        setCreateTaskForm({ status: 'BACKLOG', priority: 'MEDIUM', type: 'DEVELOPMENT' });
        await loadData(); // Reload to get updated summary
      }
    } catch (e: any) {
      alert("Failed to create task: " + e.message);
    }
  }

  async function updateTaskAssignee(taskId: string, assignee: string) {
    try {
      const data = await apiFetch<{ ok: boolean; task: DevTask }>("/dev/tasks/" + taskId, {
        method: "PATCH",
        json: { assignee }
      });
      if (data.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? data.task : t));
        if (selectedTask?.id === taskId) {
          setSelectedTask(data.task);
        }
        setEditingTaskAssignee(null);
        await loadData();
      }
    } catch (e: any) {
      alert("Failed to update assignee: " + e.message);
    }
  }

  async function createTaskAndAssign() {
    if (!selectedDate || !newTaskTitle) {
      alert("Please provide a task title and select a date.");
      return;
    }

    try {
      const data = await apiFetch<{ ok: boolean; task: DevTask }>("/dev/tasks", {
        method: "POST",
        json: { title: newTaskTitle, priority: "MEDIUM", estimatedHours: 1 }
      });

      if (data.ok) {
        setTasks(prev => [...prev, data.task]);
        setAssignmentForm({
          devTaskId: data.task.id,
          allocatedHours: 1
        });
        alert("Task created and ready to assign.");
      } else {
        alert("Failed to create task.");
      }
    } catch (e: any) {
      alert("Error creating task: " + e.message);
    }
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

  const renderDayView = () => {
    const dateStr = formatDate(currentDate);
    const schedule = getDaySchedule(dateStr);
    const dayAssignments = getDayAssignments(dateStr);
    const directlyScheduled = getDirectlyScheduledTasks(dateStr);
    const totalAllocated = getTotalAllocated(dateStr);
    
    return (
      <div className="bg-white rounded border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
          {schedule?.isWorkDay && (
            <div className="text-lg">
              <span className="font-bold text-blue-600">{totalAllocated}h</span>
              <span className="text-gray-600"> / {schedule.availableHours}h available</span>
            </div>
          )}
        </div>
        
        {schedule?.isWorkDay === false && (
          <div className="p-4 bg-gray-100 rounded text-gray-600">Non-working day</div>
        )}
        
        {dayAssignments.length === 0 && directlyScheduled.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No tasks scheduled for this day</div>
        ) : (
          <div className="space-y-3">
            {dayAssignments.map(assignment => (
              <div key={assignment.id} className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-lg cursor-pointer hover:text-blue-600" onClick={() => openTaskDetail(assignment.devTask)}>
                      {assignment.devTask.title}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{assignment.devTask.type?.replace(/_/g, ' ')}</div>
                    {assignment.devTask.description && (
                      <div className="text-sm text-gray-500 mt-2">{assignment.devTask.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{assignment.allocatedHours}h</div>
                      <div className="text-xs text-gray-500">allocated</div>
                    </div>
                    <button
                      onClick={() => deleteAssignment(assignment.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {directlyScheduled.map(task => (
              <div key={task.id} className="p-4 border rounded-lg hover:bg-gray-50 bg-purple-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-lg cursor-pointer hover:text-purple-600" onClick={() => openTaskDetail(task)}>
                      {task.title}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{task.type?.replace(/_/g, ' ')}</div>
                    {task.description && (
                      <div className="text-sm text-gray-500 mt-2">{task.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">{task.estimatedHours || 0}h</div>
                      <div className="text-xs text-gray-500">estimated</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <button
            onClick={() => openAssignDialog(dateStr)}
            className="flex-1 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
          >
            + Assign Task
          </button>
          <button
            onClick={() => openCreateTaskDialog(dateStr)}
            className="flex-1 p-4 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:border-purple-500 hover:text-purple-700 transition-colors"
          >
            + Create Task
          </button>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      weekDays.push(date);
    }
    
    return (
      <div className="bg-white rounded border overflow-hidden">
        <div className="grid grid-cols-7 gap-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
            <div key={day} className="p-4 text-center font-semibold bg-gray-100 border-b">
              <div>{day}</div>
              <div className="text-sm font-normal text-gray-600">{weekDays[idx].getDate()}</div>
            </div>
          ))}
          {weekDays.map(date => {
            const dateStr = formatDate(date);
            const isToday = formatDate(new Date()) === dateStr;
            const schedule = getDaySchedule(dateStr);
            const dayAssignments = getDayAssignments(dateStr);
            const totalAllocated = getTotalAllocated(dateStr);
            
            return (
              <div
                key={dateStr}
                className={`min-h-[200px] border p-3 ${isToday ? 'ring-2 ring-blue-500' : ''} ${schedule?.isWorkDay === false ? 'bg-gray-50' : 'bg-white'}`}
              >
                {schedule?.isWorkDay && (
                  <div className="text-xs text-gray-600 mb-2">
                    {totalAllocated}h / {schedule.availableHours}h
                  </div>
                )}
                <div className="space-y-2">
                  {dayAssignments.map(assignment => (
                    <div
                      key={assignment.id}
                      className="text-xs p-2 rounded bg-blue-100 border-l-2 border-blue-500 cursor-pointer hover:bg-blue-200"
                      onClick={() => openTaskDetail(assignment.devTask)}
                    >
                      <div className="font-medium truncate">{assignment.devTask.title}</div>
                      <div className="text-gray-600">{assignment.allocatedHours}h</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => openCreateTaskDialog(dateStr)}
                  className="text-xs mt-2 p-1 text-purple-600 hover:bg-purple-50 rounded w-full text-center"
                >
                  + Create
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = [];
    
    for (let month = 0; month < 12; month++) {
      const monthDate = new Date(year, month, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
      
      // Count tasks for this month
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const monthTasks = assignments.filter(a => {
        const assignDate = new Date(a.date);
        return assignDate >= monthStart && assignDate <= monthEnd;
      });
      const monthHours = monthTasks.reduce((sum, a) => sum + a.allocatedHours, 0);
      
      months.push({ month, monthName, tasks: monthTasks.length, hours: monthHours });
    }
    
    return (
      <div className="bg-white rounded border p-6">
        <h3 className="text-2xl font-bold text-center mb-6">{year}</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
          {months.map(({ month, monthName, tasks, hours }) => (
            <div
              key={month}
              className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => {
                setCurrentDate(new Date(year, month, 1));
                setViewMode('month');
              }}
            >
              <div className="font-semibold text-lg">{monthName}</div>
              <div className="text-sm text-gray-600 mt-2">
                <div>{tasks} tasks</div>
                <div className="font-medium text-blue-600">{hours.toFixed(1)}h</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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

  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() - 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() + 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const getViewTitle = () => {
    switch (viewMode) {
      case 'day':
        return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'year':
        return currentDate.getFullYear().toString();
    }
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

      {/* Per Developer Summary Table */}
      {Object.keys(summary).length > 0 && (
        <div className="bg-white p-6 rounded border space-y-4">
          <h2 className="text-lg font-semibold">Hours per Developer - {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left font-medium">Developer</th>
                  {(() => {
                    const allTypes = new Set<string>();
                    Object.values(summary).forEach(types => {
                      Object.keys(types).forEach(type => allTypes.add(type));
                    });
                    return Array.from(allTypes).sort().map(type => (
                      <th key={type} className="border p-2 text-center font-medium text-sm">
                        {type.replace(/_/g, ' ')}
                      </th>
                    ));
                  })()}
                  <th className="border p-2 text-center font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary).map(([assignee, types]) => {
                  const allTypes = new Set<string>();
                  Object.values(summary).forEach(t => Object.keys(t).forEach(type => allTypes.add(type)));
                  const total = Object.values(types).reduce((sum, hours) => sum + hours, 0);
                  
                  return (
                    <tr key={assignee} className="hover:bg-gray-50">
                      <td className="border p-2 font-medium">{assignee}</td>
                      {Array.from(allTypes).sort().map(type => (
                        <td key={type} className="border p-2 text-center text-sm">
                          {types[type] ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(type)}`}>
                              {types[type].toFixed(1)}h
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      ))}
                      <td className="border p-2 text-center font-bold text-blue-600">
                        {total.toFixed(1)}h
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded border">
        <Button variant="outline" onClick={navigatePrevious}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold">{getViewTitle()}</h2>
        <Button variant="outline" onClick={navigateNext}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading calendar...</div>
      ) : (
        <>
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'year' && renderYearView()}
          {viewMode === 'month' && (
            <>
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

              {/* Month Calendar Grid */}
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
            </>
          )}
        </>
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

            <div>
              <label className="text-sm font-medium">New Task Title</label>
              <Input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title..."
              />
              <Button onClick={createTaskAndAssign}>Create Task</Button>
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
                  <div>
                    <span className="text-sm font-medium text-gray-600">Type:</span>
                    <span className="ml-2">{selectedTask.type?.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Assigned To:</span>
                    {editingTaskAssignee !== null ? (
                      <div className="mt-2 space-y-2">
                        <Input
                          value={editingTaskAssignee}
                          onChange={(e) => setEditingTaskAssignee(e.target.value)}
                          placeholder="Developer name"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateTaskAssignee(selectedTask.id, editingTaskAssignee)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingTaskAssignee(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <span>{selectedTask.assignee || 'Unassigned'}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTaskAssignee(selectedTask.assignee || '')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
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

      {/* Create Task Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Task Title *</label>
              <Input
                value={createTaskForm.title || ""}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, title: e.target.value })}
                placeholder="What needs to be done?"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={createTaskForm.description || ""}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, description: e.target.value })}
                placeholder="Additional details..."
                className="resize-none h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={createTaskForm.status || "BACKLOG"}
                  onValueChange={(v) => setCreateTaskForm({ ...createTaskForm, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BACKLOG">Backlog</SelectItem>
                    <SelectItem value="TODO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="IN_REVIEW">In Review</SelectItem>
                    <SelectItem value="TESTING">Testing</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={createTaskForm.priority || "MEDIUM"}
                  onValueChange={(v) => setCreateTaskForm({ ...createTaskForm, priority: v })}
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
            </div>

            <div>
              <label className="text-sm font-medium">Task Type</label>
              <Select
                value={createTaskForm.type || "DEVELOPMENT"}
                onValueChange={(v) => setCreateTaskForm({ ...createTaskForm, type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEVELOPMENT">Development</SelectItem>
                  <SelectItem value="BUG_FIX">Bug Fix</SelectItem>
                  <SelectItem value="FEATURE">Feature</SelectItem>
                  <SelectItem value="COACHING">Coaching</SelectItem>
                  <SelectItem value="FAMILY_TIME">Family Time</SelectItem>
                  <SelectItem value="HOUSEWORK">Housework</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="LEARNING">Learning</SelectItem>
                  <SelectItem value="MEETING">Meeting</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Estimated Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  value={createTaskForm.estimatedHours || ""}
                  onChange={(e) => setCreateTaskForm({ ...createTaskForm, estimatedHours: parseFloat(e.target.value) || null })}
                  placeholder="4"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Scheduled Date</label>
                <Input
                  type="date"
                  value={createTaskForm.scheduledDate || ""}
                  onChange={(e) => setCreateTaskForm({ ...createTaskForm, scheduledDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={createTask} disabled={!createTaskForm.title}>
                Create Task
              </Button>
              <Button variant="ghost" onClick={() => setShowCreateTaskDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
