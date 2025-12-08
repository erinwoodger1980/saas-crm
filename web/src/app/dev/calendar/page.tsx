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
  estimatedHours: number | null;
  actualHours: number | null;
  assignee: string | null;
  scheduledDate: string | null;
};

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
  const [tasks, setTasks] = useState<DevTask[]>([]);
  const [schedules, setSchedules] = useState<Record<string, DaySchedule>>({});
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<DaySchedule>>({});
  const [assignmentForm, setAssignmentForm] = useState<Partial<TaskAssignment>>({});
  const [loading, setLoading] = useState(true);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

  async function loadData() {
    setLoading(true);
    try {
      const [tasksData, schedulesData, assignmentsData] = await Promise.all([
        apiFetch<{ ok: boolean; tasks: DevTask[] }>("/dev/tasks?status=BACKLOG&status=TODO&status=IN_PROGRESS"),
        apiFetch<{ ok: boolean; schedules: DaySchedule[] }>(`/dev/calendar/schedules?month=${currentDate.toISOString()}`),
        apiFetch<{ ok: boolean; assignments: TaskAssignment[] }>(`/dev/calendar/assignments?month=${currentDate.toISOString()}`)
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
    } catch (e) {
      console.error("Failed to load calendar data:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [currentDate]);

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function getDaySchedule(dateStr: string): DaySchedule | null {
    return schedules[dateStr] || null;
  }

  function getDayAssignments(dateStr: string): TaskAssignment[] {
    return assignments.filter(a => a.date === dateStr);
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
                  setSelectedDate(dateStr);
                  setShowAssignDialog(true);
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
    </div>
  );
}
