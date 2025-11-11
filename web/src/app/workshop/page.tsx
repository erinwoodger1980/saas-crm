"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth, API_BASE } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";

// Mirror of schema enum
const PROCESSES = [
  "MACHINING",
  "ASSEMBLY",
  "SANDING",
  "SPRAYING",
  "FINAL_ASSEMBLY",
  "GLAZING",
  "IRONMONGERY",
  "INSTALLATION",
] as const;

type WorkshopProcess = typeof PROCESSES[number];

type UserLite = { id: string; name: string | null; email: string };

type Month = {
  year: number;
  month: number;
  label: string;
};

type CalendarProject = {
  id: string;
  title: string;
  valueGBP: number;
  wonAt: string | null;
  startDate: string;
  deliveryDate: string;
  totalDays: number;
  monthlyValues: Record<string, number>;
};

type CalendarResponse = {
  ok: boolean;
  months: Month[];
  projects: CalendarProject[];
  monthlyTotals: Record<string, number>;
};

type Plan = {
  id: string;
  process: WorkshopProcess;
  plannedWeek: number;
  assignedUser: { id: string; name: string | null } | null;
  notes?: string | null;
};

type Project = {
  id: string;
  name: string;
  valueGBP?: string | number | null;
  wonAt?: string | null;
  startDate?: string | null;
  deliveryDate?: string | null;
  weeks: number;
  processPlans: Plan[];
  totalHoursByProcess: Record<string, number>;
  totalProjectHours: number;
};

type ScheduleResponse = { ok: boolean; weeks: number; projects: Project[] };

type UsersResponse = { ok: boolean; items: UserLite[] };

type NewPlan = { projectId: string; process: WorkshopProcess | ""; plannedWeek: number | ""; assignedUserId?: string | "" };

type LogForm = { projectId: string; process: WorkshopProcess | ""; userId: string | ""; date: string; hours: string; notes?: string };

function formatProcess(p: string) {
  return p.replace(/_/g, " ");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function WorkshopPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'legacy'>('calendar');
  const [loading, setLoading] = useState(true);
  const [weeksCount, setWeeksCount] = useState(4);
  const [projects, setProjects] = useState<Project[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [adding, setAdding] = useState<Record<string, NewPlan>>({});
  const [loggingFor, setLoggingFor] = useState<Record<string, LogForm | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [editingDates, setEditingDates] = useState<Record<string, { startDate: string; deliveryDate: string }>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editValueForm, setEditValueForm] = useState<{ projectId: string; value: string }>({ projectId: '', value: '' });
  const [draggingProject, setDraggingProject] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'start' | 'end' | 'move' | null>(null);
  const [dragAnchorDate, setDragAnchorDate] = useState<Date | null>(null);
  const [dragOriginalRange, setDragOriginalRange] = useState<{ start: Date; end: Date } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ start: Date; end: Date } | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      // In local dev, try to ensure a demo session; in prod, rely on existing auth
      if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
          try { await ensureDemoAuth(); } catch {}
        }
      }

      if (viewMode === 'calendar') {
        const [calendar, usersResp] = await Promise.all([
          apiFetch<CalendarResponse>("/workshop/calendar"),
          apiFetch<UsersResponse>("/workshop/users"),
        ]);
        if (calendar?.ok) {
          setCalendarData(calendar);
        }
        if (usersResp?.ok) setUsers(usersResp.items);
      } else {
        const [sched, usersResp] = await Promise.all([
          apiFetch<ScheduleResponse>("/workshop/schedule?weeks=4"),
          apiFetch<UsersResponse>("/workshop/users"),
        ]);
        if (sched?.ok) {
          setWeeksCount(sched.weeks);
          setProjects(sched.projects);
        }
        if (usersResp?.ok) setUsers(usersResp.items);
      }
    } catch (e) {
      console.error("Failed to load workshop:", e);
      const msg = (e as any)?.message || (e as any)?.toString?.() || "load_failed";
      setLoadError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [viewMode]);

  function initAdd(projectId: string) {
    setAdding((prev) => ({
      ...prev,
      [projectId]: { projectId, process: "", plannedWeek: 1, assignedUserId: "" },
    }));
  }

  function cancelAdd(projectId: string) {
    setAdding((prev) => ({ ...prev, [projectId]: undefined as any }));
  }

  async function saveAdd(projectId: string) {
    const data = adding[projectId];
    if (!data || !data.projectId || !data.process || !data.plannedWeek) return;
    try {
      await apiFetch("/workshop/plan", {
        method: "POST",
        json: {
          projectId: data.projectId,
          process: data.process,
          plannedWeek: Number(data.plannedWeek),
          assignedUserId: data.assignedUserId || undefined,
        },
      });
      cancelAdd(projectId);
      await loadAll();
    } catch (e) {
      console.error("Failed to save plan", e);
    }
  }

  function startLog(projectId: string) {
    setLoggingFor((prev) => ({
      ...prev,
      [projectId]: { projectId, process: "", userId: "", date: new Date().toISOString().slice(0, 10), hours: "1" },
    }));
  }

  function cancelLog(projectId: string) {
    setLoggingFor((prev) => ({ ...prev, [projectId]: null }));
  }

  async function saveLog(projectId: string) {
    const form = loggingFor[projectId];
    if (!form || !form.process || !form.userId || !form.date || !form.hours) return;
    try {
      await apiFetch("/workshop/time", {
        method: "POST",
        json: {
          projectId: form.projectId,
          process: form.process,
          userId: form.userId,
          date: form.date,
          hours: Number(form.hours),
          notes: form.notes || undefined,
        },
      });
      cancelLog(projectId);
      await loadAll();
    } catch (e) {
      console.error("Failed to log time", e);
    }
  }

  function startEditDates(projectId: string, startDate: string | null, deliveryDate: string | null) {
    setEditingDates(prev => ({
      ...prev,
      [projectId]: {
        startDate: startDate || '',
        deliveryDate: deliveryDate || ''
      }
    }));
  }

  function cancelEditDates(projectId: string) {
    setEditingDates(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  }

  async function saveDates(projectId: string) {
    const dates = editingDates[projectId];
    if (!dates || !dates.startDate || !dates.deliveryDate) return;

    try {
      await apiFetch(`/workshop/project/${projectId}`, {
        method: "PATCH",
        json: {
          startDate: dates.startDate,
          deliveryDate: dates.deliveryDate
        }
      });
      cancelEditDates(projectId);
      await loadAll();
    } catch (e) {
      console.error("Failed to save dates", e);
    }
  }

  const weeksArray = useMemo(() => Array.from({ length: weeksCount }, (_, i) => i + 1), [weeksCount]);

  if (loading) return (
    <div className="p-2">
      <h1 className="text-2xl font-semibold mb-2">Workshop</h1>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );

  // Helper functions for calendar
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];
    
    // Add days from previous month to fill first week
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }
    
    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  const getProjectsForDate = (date: Date) => {
    if (!calendarData) return [];
    const dateStr = date.toISOString().split('T')[0];
    return calendarData.projects.filter(proj => {
      const start = new Date(proj.startDate).toISOString().split('T')[0];
      const end = new Date(proj.deliveryDate).toISOString().split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const toISODate = (d: Date) => d.toISOString().split('T')[0];
  const addDays = (d: Date, n: number) => {
    const dd = new Date(d);
    dd.setDate(dd.getDate() + n);
    return dd;
  };
  const diffInDays = (a: Date, b: Date) => {
    const A = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const B = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((B - A) / (1000 * 60 * 60 * 24));
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  async function updateProjectValue(projectId: string, newValue: string) {
    try {
      await apiFetch(`/workshop/project/${projectId}`, {
        method: "PATCH",
        json: { valueGBP: Number(newValue) }
      });
      setEditingValue(null);
      await loadAll();
    } catch (e) {
      console.error("Failed to update value", e);
    }
  }

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  const weeks = useMemo(() => {
    const result: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  // Drag-and-drop handlers for calendar bars
  useEffect(() => {
    if (!draggingProject || !dragType) return;

    function getDateFromPoint(clientX: number, clientY: number): Date | null {
      const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      if (!el) return null;
      let node: HTMLElement | null = el;
      while (node) {
        const iso = node.getAttribute?.('data-date');
        if (iso) {
          const d = new Date(iso);
          if (!isNaN(d.getTime())) return d;
        }
        node = node.parentElement;
      }
      return null;
    }

    const onMove = (e: MouseEvent) => {
      const hover = getDateFromPoint(e.clientX, e.clientY);
      if (!hover || !dragAnchorDate || !dragOriginalRange) return;
      if (dragType === 'move') {
        const delta = diffInDays(dragAnchorDate, hover);
        const start = addDays(dragOriginalRange.start, delta);
        const end = addDays(dragOriginalRange.end, delta);
        setDragPreview({ start, end });
      } else if (dragType === 'start') {
        const start = hover <= dragOriginalRange.end ? hover : dragOriginalRange.end;
        setDragPreview({ start, end: dragOriginalRange.end });
      } else if (dragType === 'end') {
        const end = hover >= dragOriginalRange.start ? hover : dragOriginalRange.start;
        setDragPreview({ start: dragOriginalRange.start, end });
      }
    };

    const onUp = async (e: MouseEvent) => {
      const drop = getDateFromPoint(e.clientX, e.clientY);
      let nextRange = dragPreview || null;
      if (!nextRange && drop && dragAnchorDate && dragOriginalRange) {
        if (dragType === 'move') {
          const delta = diffInDays(dragAnchorDate, drop);
          nextRange = { start: addDays(dragOriginalRange.start, delta), end: addDays(dragOriginalRange.end, delta) };
        } else if (dragType === 'start') {
          nextRange = { start: drop <= dragOriginalRange.end ? drop : dragOriginalRange.end, end: dragOriginalRange.end };
        } else if (dragType === 'end') {
          nextRange = { start: dragOriginalRange.start, end: drop >= dragOriginalRange.start ? drop : dragOriginalRange.start };
        }
      }

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      try {
        if (nextRange) {
          await apiFetch(`/workshop/project/${draggingProject}`, {
            method: 'PATCH',
            json: {
              startDate: toISODate(nextRange.start),
              deliveryDate: toISODate(nextRange.end),
            },
          });
          await loadAll();
        }
      } finally {
        setDraggingProject(null);
        setDragType(null);
        setDragAnchorDate(null);
        setDragOriginalRange(null);
        setDragPreview(null);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [draggingProject, dragType, dragAnchorDate, dragOriginalRange]);

  // Calendar view
  if (viewMode === 'calendar') {
    const projectCount = calendarData?.projects.length || 0;
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold">Workshop Calendar</h1>
            <span className="text-sm text-muted-foreground">{projectCount} projects</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setViewMode('legacy')}>
              Process View
            </Button>
            <Button variant="outline" size="sm" onClick={loadAll}>Refresh</Button>
          </div>
        </div>

        {projectCount === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
            <div>
              <div className="font-semibold">No projects with dates set.</div>
              <div>Add start and delivery dates to your won projects to see them in the calendar.</div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  setBackfillBusy(true);
                  try {
                    await apiFetch("/workshop/backfill", { method: "POST" });
                    await loadAll();
                  } catch (e) {
                    alert((e as any)?.message || "Backfill failed");
                  } finally {
                    setBackfillBusy(false);
                  }
                }}
                disabled={backfillBusy}
              >
                {backfillBusy ? "Backfilling…" : "Backfill Won leads → Projects"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setViewMode('legacy')}>
                View All Projects
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Monthly calendar grid */}
            <div className="space-y-6">
              {/* Month navigation */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-2xl font-semibold">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
                  <Button variant="outline" size="sm" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="bg-muted p-2 text-center text-sm font-semibold">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {weeks.map((week, weekIdx) => (
                  week.map((day, dayIdx) => {
                    const projectsOnDay = getProjectsForDate(day.date);
                    const today = isToday(day.date);
                    const isoDay = toISODate(day.date);
                    const inPreview = dragPreview ? (isoDay >= toISODate(dragPreview.start) && isoDay <= toISODate(dragPreview.end)) : false;
                    
                    return (
                      <div
                        key={`${weekIdx}-${dayIdx}`}
                        data-date={toISODate(day.date)}
                        className={`
                          bg-background p-2 min-h-[100px] relative
                          ${!day.isCurrentMonth ? 'opacity-40' : ''}
                          ${today ? 'ring-2 ring-primary' : ''}
                          ${inPreview ? 'outline outline-1 outline-primary/40' : ''}
                        `}
                      >
                        <div className={`text-sm mb-1 ${today ? 'font-bold text-primary' : ''}`}>
                          {day.date.getDate()}
                        </div>
                        
                        {/* Project bars for this day */}
                        <div className="space-y-1">
                          {projectsOnDay.map(proj => {
                            const projectStart = new Date(proj.startDate);
                            const projectEnd = new Date(proj.deliveryDate);
                            const isFirstDay = day.date.toDateString() === projectStart.toDateString();
                            const isLastDay = day.date.toDateString() === projectEnd.toDateString();
                            
                            return (
                              <div
                                key={proj.id}
                                className="group text-xs p-1 rounded bg-primary/20 text-primary cursor-pointer hover:bg-primary/30 truncate relative"
                                onMouseDown={(e) => {
                                  if (!isFirstDay) return; // attach drag start only on first-day chip to avoid duplicates
                                  // If clicked near edges, don't start move here; edge spans handle it
                                  setDraggingProject(proj.id);
                                  setDragType('move');
                                  setDragAnchorDate(day.date);
                                  setDragOriginalRange({ start: projectStart, end: projectEnd });
                                  setDragPreview({ start: projectStart, end: projectEnd });
                                  e.preventDefault();
                                }}
                                onClick={() => {
                                  if (editingValue === proj.id) {
                                    setEditingValue(null);
                                  } else {
                                    setEditingValue(proj.id);
                                  }
                                }}
                                title={`${proj.title} - ${formatCurrency(proj.valueGBP)}`}
                              >
                                {isFirstDay && (
                                  <span className="font-semibold">{proj.title}</span>
                                )}
                                {/* Drag handles only on first/last day chips so UX is predictable */}
                                {isFirstDay && (
                                  <span
                                    className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/40 opacity-0 group-hover:opacity-100 cursor-ew-resize rounded-l"
                                    onMouseDown={(e) => {
                                      setDraggingProject(proj.id);
                                      setDragType('start');
                                      setDragAnchorDate(day.date);
                                      setDragOriginalRange({ start: projectStart, end: projectEnd });
                                      setDragPreview({ start: projectStart, end: projectEnd });
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                  />
                                )}
                                {isLastDay && (
                                  <span
                                    className="absolute right-0 top-0 bottom-0 w-1.5 bg-primary/40 opacity-0 group-hover:opacity-100 cursor-ew-resize rounded-r"
                                    onMouseDown={(e) => {
                                      setDraggingProject(proj.id);
                                      setDragType('end');
                                      setDragAnchorDate(day.date);
                                      setDragOriginalRange({ start: projectStart, end: projectEnd });
                                      setDragPreview({ start: projectStart, end: projectEnd });
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                  />
                                )}
                                {editingValue === proj.id && isFirstDay && (
                                  <input
                                    type="number"
                                    className="w-full mt-1 px-1 py-0.5 text-xs rounded border"
                                    defaultValue={proj.valueGBP}
                                    onBlur={(e) => {
                                      updateProjectValue(proj.id, e.target.value);
                                      setEditingValue(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateProjectValue(proj.id, e.currentTarget.value);
                                        setEditingValue(null);
                                      }
                                    }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ))}
              </div>

              {/* Monthly summary */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-muted-foreground">Total for {currentMonth.toLocaleDateString('en-US', { month: 'long' })}</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        projects
                          .filter(p => p.startDate && p.deliveryDate)
                          .reduce((sum, proj) => {
                            const projectStart = new Date(proj.startDate!);
                            const projectEnd = new Date(proj.deliveryDate!);
                            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                            const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                            
                            // Calculate overlap
                            const overlapStart = new Date(Math.max(projectStart.getTime(), monthStart.getTime()));
                            const overlapEnd = new Date(Math.min(projectEnd.getTime(), monthEnd.getTime()));
                            
                            if (overlapStart <= overlapEnd) {
                              const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                              const totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                              const value = typeof proj.valueGBP === 'string' ? parseFloat(proj.valueGBP) : (proj.valueGBP || 0);
                              const monthValue = (value * overlapDays) / totalDays;
                              return sum + monthValue;
                            }
                            return sum;
                          }, 0)
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Active Projects</div>
                    <div className="text-2xl font-bold">
                      {getDaysInMonth(currentMonth).flat().reduce((count, day) => {
                        const projectsOnDay = getProjectsForDate(day.date);
                        return Math.max(count, new Set(projectsOnDay.map(p => p.id)).size);
                      }, 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Project list for setting dates */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-3">All Won Projects</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {calendarData?.projects.map(proj => (
                  <Card key={proj.id} className="p-3">
                    <div className="font-medium">{proj.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Value: {formatCurrency(proj.valueGBP)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(proj.startDate).toLocaleDateString()} → {new Date(proj.deliveryDate).toLocaleDateString()}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Legacy process view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workshop</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{projects.length} projects</span>
          <Button variant="outline" size="sm" onClick={() => setViewMode('calendar')}>
            <Calendar className="w-4 h-4 mr-2" />
            Switch to Calendar
          </Button>
          <Button variant="outline" size="sm" onClick={loadAll}>Refresh</Button>
        </div>
      </div>

      {/* Connection/Config hints when nothing is visible */}
      {projects.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
          {loadError ? (
            <div>
              <div className="font-semibold">Couldn’t load the workshop schedule.</div>
              <div className="text-amber-800/90">{loadError}</div>
            </div>
          ) : (
            <div>
              <div className="font-semibold">No projects yet.</div>
              <div>Mark a lead as Won to create a project automatically, or backfill existing Won leads.</div>
            </div>
          )}
          {(!API_BASE && typeof window !== "undefined") ? (
            <div className="text-amber-800/80">
              Tip: API base isn’t configured for the browser. Either set NEXT_PUBLIC_API_BASE, or set API_ORIGIN for server rewrites.
            </div>
          ) : null}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                setBackfillBusy(true);
                try {
                  await apiFetch("/workshop/backfill", { method: "POST" });
                  await loadAll();
                } catch (e) {
                          alert((e as any)?.message || "Backfill failed");
                } finally {
                  setBackfillBusy(false);
                }
              }}
              disabled={backfillBusy}
            >
              {backfillBusy ? "Backfilling…" : "Backfill Won leads → Projects"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((proj) => {
          const editing = editingDates[proj.id];
          
          return (
          <Card key={proj.id} className="p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <div className="flex-1">
                <div className="font-medium">{proj.name}</div>
                {proj.valueGBP != null && (
                  <div className="text-xs text-muted-foreground">£{Number(proj.valueGBP).toLocaleString()}</div>
                )}
                
                {/* Date editing */}
                <div className="mt-2">
                  {editing ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Start Date</label>
                        <Input
                          type="date"
                          value={editing.startDate}
                          onChange={(e) => setEditingDates(prev => ({
                            ...prev,
                            [proj.id]: { ...prev[proj.id], startDate: e.target.value }
                          }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Delivery Date</label>
                        <Input
                          type="date"
                          value={editing.deliveryDate}
                          onChange={(e) => setEditingDates(prev => ({
                            ...prev,
                            [proj.id]: { ...prev[proj.id], deliveryDate: e.target.value }
                          }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveDates(proj.id)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelEditDates(proj.id)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditDates(proj.id, proj.startDate || null, proj.deliveryDate || null)}
                      className="text-xs text-muted-foreground hover:text-primary"
                    >
                      {proj.startDate && proj.deliveryDate ? (
                        <>📅 {new Date(proj.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {new Date(proj.deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                      ) : (
                        <>📅 Set dates for calendar</>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Total hours: {proj.totalProjectHours || 0}</div>
            </div>

            <div className="overflow-auto">
              <div className="min-w-[520px] grid grid-cols-[100px_repeat(4,1fr)] gap-x-2 items-start">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Week</div>
                {weeksArray.map((w) => (
                  <div key={w} className="text-xs font-semibold uppercase text-muted-foreground text-center">W{w}</div>
                ))}

                {PROCESSES.map((proc) => (
                  <div key={`row-${proc}`} className="contents">
                    <div className="text-xs py-1">{formatProcess(proc)}</div>
                    {weeksArray.map((w) => {
                      const plans = (proj.processPlans || []).filter((p) => p.process === proc && p.plannedWeek === w);
                      return (
                        <div key={`${proc}-${w}`} className="py-1">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {plans.map((p) => (
                              <Badge key={p.id} variant="secondary">
                                {formatProcess(p.process)}{p.assignedUser?.name ? ` · ${p.assignedUser.name}` : ""}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Add plan */}
            {adding[proj.id] ? (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                <Select value={(adding[proj.id].process as string) || ""} onValueChange={(v) => setAdding((prev) => ({ ...prev, [proj.id]: { ...prev[proj.id], process: v as WorkshopProcess } }))}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Process" /></SelectTrigger>
                  <SelectContent>
                    {PROCESSES.map((p) => (
                      <SelectItem key={p} value={p}>{formatProcess(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={String(adding[proj.id].plannedWeek || "")} onValueChange={(v) => setAdding((prev) => ({ ...prev, [proj.id]: { ...prev[proj.id], plannedWeek: Number(v) } }))}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Week" /></SelectTrigger>
                  <SelectContent>
                    {weeksArray.map((w) => (
                      <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={String(adding[proj.id].assignedUserId || "")} onValueChange={(v) => setAdding((prev) => ({ ...prev, [proj.id]: { ...prev[proj.id], assignedUserId: v } }))}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Assign (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button size="sm" onClick={() => saveAdd(proj.id)}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => cancelAdd(proj.id)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button size="sm" variant="secondary" onClick={() => initAdd(proj.id)}>Add plan</Button>
                {loggingFor[proj.id] ? (
                  <></>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => startLog(proj.id)}>Log time</Button>
                )}
              </div>
            )}

            {/* Log time */}
            {loggingFor[proj.id] ? (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(loggingFor[proj.id]?.process || "")} onValueChange={(v) => setLoggingFor((prev) => ({ ...prev, [proj.id]: { ...(prev[proj.id] as LogForm), process: v as WorkshopProcess } }))}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Process" /></SelectTrigger>
                  <SelectContent>
                    {PROCESSES.map((p) => (
                      <SelectItem key={p} value={p}>{formatProcess(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={String(loggingFor[proj.id]?.userId || "")} onValueChange={(v) => setLoggingFor((prev) => ({ ...prev, [proj.id]: { ...(prev[proj.id] as LogForm), userId: v } }))}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="User" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input type="date" className="w-[160px]" value={String(loggingFor[proj.id]?.date || "")} onChange={(e) => setLoggingFor((prev) => ({ ...prev, [proj.id]: { ...(prev[proj.id] as LogForm), date: e.target.value } }))} />
                <Input type="number" className="w-[120px]" min="0" step="0.25" value={String(loggingFor[proj.id]?.hours || "")} onChange={(e) => setLoggingFor((prev) => ({ ...prev, [proj.id]: { ...(prev[proj.id] as LogForm), hours: e.target.value } }))} />
                <Input type="text" className="w-[200px]" placeholder="Notes (optional)" value={String(loggingFor[proj.id]?.notes || "")} onChange={(e) => setLoggingFor((prev) => ({ ...prev, [proj.id]: { ...(prev[proj.id] as LogForm), notes: e.target.value } }))} />

                <Button size="sm" onClick={() => saveLog(proj.id)}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => cancelLog(proj.id)}>Cancel</Button>
              </div>
            ) : null}
          </Card>
        );
        })}
      </div>
    </div>
  );
}
