
"use client";
// Type definitions for QuickLogModal
interface QuickLogUser {
  id: string;
  name: string | null;
  email: string;
}
interface QuickLogSaveInput {
  userId: string;
  process: string; // Will be constrained via UI from PROCESSES
  hours: string; // kept as string until converted on save
  notes?: string;
  date: string; // ISO date yyyy-mm-dd
}
interface QuickLogModalProps {
  users: QuickLogUser[];
  processes: readonly string[]; // PROCESSES constant
  onSave: (data: QuickLogSaveInput) => void | Promise<void>;
  onClose: () => void;
}
// Quick log modal for staff to log hours for today
function QuickLogModal({ users, processes, onSave, onClose }: QuickLogModalProps) {
  const [form, setForm] = useState<Pick<QuickLogSaveInput, 'userId' | 'process' | 'hours' | 'notes'>>({ userId: '', process: '', hours: '', notes: '' });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <Card className="p-6 max-w-md w-full m-4 bg-white shadow-2xl border" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Log Hours for Today</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">User</label>
            <Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map((u: QuickLogUser) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Process/Category</label>
            <Select value={form.process} onValueChange={v => setForm(f => ({ ...f, process: v }))}>
              <SelectTrigger><SelectValue placeholder="Select process or category" /></SelectTrigger>
              <SelectContent>
                {processes.map((p: string) => (
                  <SelectItem key={p} value={p}>{formatProcess(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Hours</label>
            <Input type="number" min="0" step="0.25" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <Input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => onSave({ ...form, date: today })} disabled={!form.userId || !form.process || !form.hours}>Log Hours</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { apiFetch, ensureDemoAuth, API_BASE } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

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
  "CLEANING",
  "ADMIN",
  "HOLIDAY",
] as const;

type WorkshopProcess = typeof PROCESSES[number];

type UserLite = { id: string; name: string | null; email: string };

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
  expectedHours?: number | string | null;
  actualHours?: number | string | null;
};

type ScheduleResponse = { ok: boolean; weeks: number; projects: Project[] };

type UsersResponse = { ok: boolean; items: UserLite[] };

type NewPlan = { projectId: string; process: WorkshopProcess | ""; plannedWeek: number | ""; assignedUserId?: string | "" };

type LogForm = { projectId: string; process: WorkshopProcess | ""; userId: string | ""; date: string; hours: string; notes?: string };

type Holiday = {
  id: string;
  userId: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  notes?: string | null;
  user?: { id: string; name: string | null; email: string };
};

type HolidaysResponse = { ok: boolean; items: Holiday[] };

function formatProcess(p: string) {
  return p.replace(/_/g, " ");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function WorkshopPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(4);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [adding, setAdding] = useState<Record<string, NewPlan>>({});
  const [loggingFor, setLoggingFor] = useState<Record<string, LogForm | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [editingDates, setEditingDates] = useState<Record<string, { startDate: string; deliveryDate: string; value: string; expectedHours?: string; actualHours?: string }>>({});
  const [draggingProject, setDraggingProject] = useState<string | null>(null);
  const [showHoursModal, setShowHoursModal] = useState<{ projectId: string; projectName: string } | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [hoursForm, setHoursForm] = useState<{ process: WorkshopProcess | ""; userId: string; hours: string; date: string }>({
    process: "",
    userId: "",
    hours: "",
    date: new Date().toISOString().split('T')[0]
  });

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

      // Build holidays query range (~5 months around current month)
      const rangeStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 2, 1);
      const rangeEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 3, 0);
      const from = rangeStart.toISOString().split('T')[0];
      const to = rangeEnd.toISOString().split('T')[0];

      setHolidayError(null);
      const [schedR, usersR, holsR] = await Promise.allSettled([
        apiFetch<ScheduleResponse>("/workshop/schedule?weeks=4"),
        apiFetch<UsersResponse>("/workshop/users"),
        apiFetch<HolidaysResponse>(`/workshop/holidays?from=${from}&to=${to}`),
      ]);

      // Schedule load is critical; if it fails we set loadError
      if (schedR.status === 'fulfilled' && (schedR.value as any)?.ok) {
        setWeeks((schedR.value as any).weeks);
        setProjects((schedR.value as any).projects);
      } else if (schedR.status === 'rejected') {
        const msg = (schedR.reason?.message || 'Failed to load schedule').toString();
        setLoadError(msg);
      }

      // Users load – non-fatal
      if (usersR.status === 'fulfilled' && (usersR.value as any)?.ok) {
        setUsers((usersR.value as any).items);
      }

      // Holidays load – non-fatal; show separate warning
      if (holsR.status === 'fulfilled' && (holsR.value as any)?.ok) {
        setHolidays((holsR.value as any).items);
        if ((holsR.value as any).warn) {
          setHolidayError((holsR.value as any).warn);
        }
      } else if (holsR.status === 'rejected') {
        setHolidayError((holsR.reason?.message || 'Failed to load holidays').toString());
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
  }, []);

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

  async function updateProjectDates(projectId: string) {
    const data = editingDates[projectId];
    if (!data) return;
    
    try {
      await apiFetch(`/workshop/project/${projectId}`, {
        method: "PATCH",
        json: {
          startDate: data.startDate || null,
          deliveryDate: data.deliveryDate || null,
          valueGBP: data.value ? Number(data.value) : null,
        },
      });
      setEditingDates(prev => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      await loadAll();
    } catch (e) {
      console.error("Failed to update project dates", e);
    }
  }

  function startEditingDates(proj: Project) {
    setEditingDates(prev => ({
      ...prev,
      [proj.id]: {
        startDate: proj.startDate || '',
        deliveryDate: proj.deliveryDate || '',
        value: proj.valueGBP?.toString() || '',
      }
    }));
  }

  function cancelEditingDates(projectId: string) {
    setEditingDates(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  }

  // Drag and drop handlers
  function handleDragStart(projectId: string) {
    setDraggingProject(projectId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(date: Date) {
    if (!draggingProject) return;
    
    const proj = projects.find(p => p.id === draggingProject);
    if (!proj || !proj.startDate || !proj.deliveryDate) return;
    
    // Calculate duration
    const oldStart = new Date(proj.startDate);
    const oldEnd = new Date(proj.deliveryDate);
    const duration = oldEnd.getTime() - oldStart.getTime();
    
    // Set new dates
    const newStart = date;
    const newEnd = new Date(newStart.getTime() + duration);
    
    try {
      await apiFetch(`/workshop/project/${draggingProject}`, {
        method: "PATCH",
        json: {
          startDate: newStart.toISOString().split('T')[0],
          deliveryDate: newEnd.toISOString().split('T')[0],
        },
      });
      await loadAll();
    } catch (e) {
      console.error("Failed to update project dates", e);
    } finally {
      setDraggingProject(null);
    }
  }

  // Hours tracking
  function openHoursModal(projectId: string, projectName: string) {
    setShowHoursModal({ projectId, projectName });
    setHoursForm({
      process: "",
      userId: "",
      hours: "",
      date: new Date().toISOString().split('T')[0]
    });
  }

  function closeHoursModal() {
    setShowHoursModal(null);
  }

  async function saveHours() {
    if (!showHoursModal || !hoursForm.process || !hoursForm.userId || !hoursForm.hours) return;
    
    try {
      await apiFetch("/workshop/time", {
        method: "POST",
        json: {
          projectId: showHoursModal.projectId,
          process: hoursForm.process,
          userId: hoursForm.userId,
          date: hoursForm.date,
          hours: Number(hoursForm.hours),
        },
      });
      closeHoursModal();
      await loadAll();
    } catch (e) {
      console.error("Failed to log hours", e);
    }
  }

  const weeksArray = Array.from({ length: weeks }, (_, i) => i + 1);

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getProjectsForWeek = (weekNumber: number) => {
    return projects.filter(proj => 
      proj.processPlans.some(plan => plan.plannedWeek === weekNumber)
    );
  };

  // Capacity planning helpers
  const isWeekday = (d: Date) => {
    const day = d.getDay();
    return day !== 0 && day !== 6; // Mon-Fri
  };

  const eachDay = (start: Date, end: Date) => {
    const days: Date[] = [];
    const cur = new Date(start);
    cur.setHours(0,0,0,0);
    const last = new Date(end);
    last.setHours(0,0,0,0);
    while (cur <= last) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  };

  const countWeekdaysInRange = (start: Date, end: Date) => eachDay(start, end).filter(isWeekday).length;

  const dayInHoliday = (d: Date, h: Holiday) => {
    const sd = new Date(h.startDate.split('T')[0]);
    const ed = new Date(h.endDate.split('T')[0]);
    sd.setHours(0,0,0,0);
    ed.setHours(0,0,0,0);
    const dc = new Date(d);
    dc.setHours(0,0,0,0);
    return dc >= sd && dc <= ed;
  };

  const workingHoursPerDay = 8;

  const getWeekCapacity = (weekNumber: number) => {
    // Same week start logic as value calc
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + ((weekNumber - 1) * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const days = eachDay(weekStart, weekEnd).filter(isWeekday);
    // For each user, count working weekdays not covered by a holiday
    let totalHrs = 0;
    for (const u of users) {
      const userHols = holidays.filter(h => h.userId === u.id);
      const workingDays = days.filter(d => !userHols.some(h => dayInHoliday(d, h))).length;
      totalHrs += workingDays * workingHoursPerDay;
    }
    return totalHrs;
  };

  const getProjectExpectedHours = (proj: Project) => {
    if (proj.expectedHours != null && proj.expectedHours !== "") return Number(proj.expectedHours) || 0;
    if (proj.totalProjectHours != null) return Number(proj.totalProjectHours) || 0;
    return 0;
  };

  const getWeekDemand = (weekNumber: number) => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + ((weekNumber - 1) * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    let total = 0;
    for (const proj of projects) {
      if (!proj.startDate || !proj.deliveryDate) continue;
      const ps = new Date(proj.startDate);
      const pe = new Date(proj.deliveryDate);
      const overlapStart = new Date(Math.max(ps.getTime(), weekStart.getTime()));
      const overlapEnd = new Date(Math.min(pe.getTime(), weekEnd.getTime()));
      if (overlapStart > overlapEnd) continue;
      const projDays = Math.max(1, countWeekdaysInRange(ps, pe));
      const overlapDays = countWeekdaysInRange(overlapStart, overlapEnd);
      const expected = getProjectExpectedHours(proj);
      if (projDays > 0 && expected > 0) {
        total += expected * (overlapDays / projDays);
      }
    }
    return Math.round(total);
  };

  // Calculate proportional value for a date range
  const getProportionalValue = (proj: Project, rangeStart: Date, rangeEnd: Date) => {
    if (!proj.startDate || !proj.deliveryDate || !proj.valueGBP) return 0;
    
    const projectStart = new Date(proj.startDate);
    const projectEnd = new Date(proj.deliveryDate);
    const value = Number(proj.valueGBP) || 0;
    
    // Calculate overlap between project dates and range
    const overlapStart = new Date(Math.max(projectStart.getTime(), rangeStart.getTime()));
    const overlapEnd = new Date(Math.min(projectEnd.getTime(), rangeEnd.getTime()));
    
    if (overlapStart > overlapEnd) return 0;
    
    // Calculate days
    const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalProjectDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return (value * overlapDays) / totalProjectDays;
  };

  const getWeekTotal = (weekNumber: number) => {
    // Get first day of the week (assuming week 1 starts at beginning of schedule)
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + ((weekNumber - 1) * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return projects.reduce((sum, proj) => {
      return sum + getProportionalValue(proj, weekStart, weekEnd);
    }, 0);
  };

  const getMonthTotal = () => {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    return projects.reduce((sum, proj) => {
      return sum + getProportionalValue(proj, monthStart, monthEnd);
    }, 0);
  };

  const getProjectsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return projects.filter(proj => {
      if (!proj.startDate || !proj.deliveryDate) return false;
      const start = proj.startDate.split('T')[0];
      const end = proj.deliveryDate.split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  // Calculate project progress percentage
  const getProjectProgress = (proj: Project) => {
    if (!proj.startDate || !proj.deliveryDate) return 0;
    
    const now = new Date();
    const start = new Date(proj.startDate);
    const end = new Date(proj.deliveryDate);
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    return Math.round((elapsed / total) * 100);
  };

  // Get color based on progress
  const getProgressColor = (progress: number) => {
    if (progress === 0) return 'bg-slate-100 text-slate-800';
    if (progress < 25) return 'bg-green-100 text-green-800';
    if (progress < 50) return 'bg-green-200 text-green-900';
    if (progress < 75) return 'bg-green-300 text-green-900';
    if (progress < 100) return 'bg-green-400 text-green-950';
    return 'bg-green-500 text-white';
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  if (loading) return (
    <div className="p-2">
      <h1 className="text-2xl font-semibold mb-2">Workshop</h1>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workshop</h1>
        <Button variant="outline" size="sm" onClick={() => setShowQuickLog(true)}>
          Quick Log Hours
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{projects.length} projects</span>
          <Button 
            variant={viewMode === 'calendar' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewMode('calendar')}
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Calendar
          </Button>
          <Button 
            variant={viewMode === 'list' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowHolidayModal(true)}>Holidays</Button>
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
          {holidayError && (
            <div className="text-amber-800/80">Holidays couldn’t be loaded: {holidayError}</div>
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

      {/* Calendar View */}
      {viewMode === 'calendar' && projects.length > 0 && (
        <div className="space-y-4">
          {/* Month Navigation with Total */}
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <Button variant="outline" size="sm" onClick={previousMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl font-semibold">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Month Total Value</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(getMonthTotal())}
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-lg border overflow-hidden">
            {/* Calendar header - days of week */}
            <div className="grid grid-cols-7 border-b bg-slate-50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-xs font-semibold text-slate-600 border-r last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar body - days */}
            <div className="grid grid-cols-7">
              {getDaysInMonth(currentMonth).map((date, idx) => {
                const isToday = date && 
                  date.getDate() === new Date().getDate() &&
                  date.getMonth() === new Date().getMonth() &&
                  date.getFullYear() === new Date().getFullYear();
                
                const projectsForDay = date ? getProjectsForDate(date) : [];
                
                return (
                  <div
                    key={idx}
                    className={`min-h-24 border-r border-b last:border-r-0 p-2 ${
                      !date ? 'bg-slate-50' : isToday ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (date) handleDrop(date);
                    }}
                  >
                    {date && (
                      <>
                        <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                          {date.getDate()}
                        </div>
                        <div className="space-y-1">
                          {projectsForDay.slice(0, 3).map(proj => {
                            const progress = getProjectProgress(proj);
                            return (
                              <div
                                key={proj.id}
                                className="text-xs p-1 rounded cursor-pointer hover:opacity-80 relative overflow-hidden"
                                style={{
                                  background: `linear-gradient(90deg, #22c55e ${progress}%, #60a5fa ${progress}%)`,
                                  color: 'white'
                                }}
                                draggable
                                onDragStart={() => handleDragStart(proj.id)}
                                onClick={() => openHoursModal(proj.id, proj.name)}
                                title={`${proj.name} (${progress}% complete)`}
                              >
                                <div className="truncate font-medium">
                                  {proj.name}
                                </div>
                              </div>
                            );
                          })}
                          {projectsForDay.length > 3 && (
                            <div className="text-[10px] text-slate-500 text-center">
                              +{projectsForDay.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Week Summary below calendar */}
          <div className="grid gap-4 md:grid-cols-4">
            {weeksArray.map((weekNum: number) => {
              const projectsInWeek = getProjectsForWeek(weekNum);
              const weekTotal = getWeekTotal(weekNum);
              return (
                <Card key={weekNum} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold">Week {weekNum}</div>
                    <div className="text-sm font-bold text-green-600">
                      {formatCurrency(weekTotal)}
                    </div>
                  </div>
                  {/* Capacity vs Demand */}
                  <div className="text-xs mb-3">
                    {(() => {
                      const cap = getWeekCapacity(weekNum);
                      const dem = getWeekDemand(weekNum);
                      const free = Math.round(cap - dem);
                      const freeColor = free < 0 ? 'text-red-600' : 'text-emerald-700';
                      // Holiday day counts in this week
                      const today = new Date();
                      const weekStart = new Date(today);
                      weekStart.setDate(today.getDate() - today.getDay() + ((weekNum - 1) * 7));
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekStart.getDate() + 6);
                      const weekdayList = eachDay(weekStart, weekEnd).filter(isWeekday);
                      let holidayDays = 0;
                      for (const u of users) {
                        const userHols = holidays.filter(h => h.userId === u.id);
                        holidayDays += weekdayList.filter(d => userHols.some(h => dayInHoliday(d, h))).length;
                      }
                      const holidayInfo = holidayDays > 0 ? `Holiday weekdays: ${holidayDays}` : 'No holidays';
                      return (
                        <div className="flex flex-wrap gap-3 items-center">
                          <span>Capacity: <strong>{cap}h</strong></span>
                          <span>Demand: <strong>{dem}h</strong></span>
                          <span className={freeColor + (free < 0 ? ' font-semibold' : '')}>Free: <strong>{free}h</strong></span>
                          <span className="text-slate-500">{holidayInfo}</span>
                          {free < 0 && (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">Overbooked</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    {projectsInWeek.length} project{projectsInWeek.length !== 1 ? 's' : ''}
                  </div>
                  <div className="space-y-2">
                    {projectsInWeek.slice(0, 3).map(proj => {
                      const progress = getProjectProgress(proj);
                      return (
                      <div key={proj.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate flex-1" title={proj.name}>{proj.name}</div>
                          {proj.startDate && proj.deliveryDate && (
                            <span className={`text-xs px-2 py-0.5 rounded ${getProgressColor(progress)}`}>
                              {progress}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                          {proj.valueGBP && (
                            <span>{formatCurrency(Number(proj.valueGBP))}</span>
                          )}
                          {proj.startDate && proj.deliveryDate && (
                            <span className="text-xs">
                              {new Date(proj.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - 
                              {new Date(proj.deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                      );
                    })}
                    {projectsInWeek.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{projectsInWeek.length - 3} more
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((proj) => (
          <Card key={proj.id} className="p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <div className="flex-1">
                <div className="font-medium">{proj.name}</div>
                {proj.valueGBP != null && (
                  <div className="text-xs text-muted-foreground">£{Number(proj.valueGBP).toLocaleString()}</div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">Total hours: {proj.totalProjectHours || 0}</div>
            </div>

            {/* Date and Value Editing */}
            <div className="pt-2 border-t">
              {editingDates[proj.id] ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Start Date</label>
                      <Input
                        type="date"
                        value={editingDates[proj.id].startDate}
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
                        value={editingDates[proj.id].deliveryDate}
                        onChange={(e) => setEditingDates(prev => ({
                          ...prev,
                          [proj.id]: { ...prev[proj.id], deliveryDate: e.target.value }
                        }))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Value (£)</label>
                    <Input
                      type="number"
                      value={editingDates[proj.id].value}
                      onChange={(e) => setEditingDates(prev => ({
                        ...prev,
                        [proj.id]: { ...prev[proj.id], value: e.target.value }
                      }))}
                      className="h-8 text-sm"
                      placeholder="Project value"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Expected Hours</label>
                      <Input
                        type="number"
                        value={editingDates[proj.id].expectedHours || ""}
                        onChange={(e) => setEditingDates(prev => ({
                          ...prev,
                          [proj.id]: { ...prev[proj.id], expectedHours: e.target.value }
                        }))}
                        className="h-8 text-sm"
                        placeholder="Expected hours"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Actual Hours</label>
                      <Input
                        type="number"
                        value={editingDates[proj.id].actualHours || ""}
                        onChange={(e) => setEditingDates(prev => ({
                          ...prev,
                          [proj.id]: { ...prev[proj.id], actualHours: e.target.value }
                        }))}
                        className="h-8 text-sm"
                        placeholder="Actual hours"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateProjectDates(proj.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cancelEditingDates(proj.id)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startEditingDates(proj)}
                  className="text-xs text-muted-foreground hover:text-primary w-full text-left"
                >
                  {proj.startDate && proj.deliveryDate ? (
                    <>
                      📅 {new Date(proj.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {' '}
                      {new Date(proj.deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </>
                  ) : (
                    <>📅 Set start & delivery dates</>
                  )}
                  <span className="ml-2 text-xs text-green-700">Exp: {proj.expectedHours || 0}h</span>
                  <span className="ml-2 text-xs text-blue-700">Act: {proj.actualHours || 0}h</span>
                </button>
              )}
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
        ))}
      </div>
      )}

      {/* Hours Tracking Modal */}
      {showQuickLog && (
        <QuickLogModal
          users={users}
          processes={PROCESSES}
          onSave={async (form: QuickLogSaveInput) => {
            try {
              await apiFetch('/workshop/time', {
                method: 'POST',
                json: {
                  userId: form.userId,
                  process: form.process,
                  date: form.date,
                  hours: Number(form.hours),
                  notes: form.notes,
                },
              });
              setShowQuickLog(false);
              await loadAll();
            } catch (e) {
              alert('Failed to log hours');
            }
          }}
          onClose={() => setShowQuickLog(false)}
        />
      )}
      {/* Holiday Management Modal */}
      {showHolidayModal && (
        <HolidayModal
          users={users}
          holidays={holidays}
          onAdd={async (payload) => {
            await apiFetch('/workshop/holidays', { method: 'POST', json: payload });
            await loadAll();
          }}
          onDelete={async (id) => {
            await apiFetch(`/workshop/holidays/${id}`, { method: 'DELETE' });
            await loadAll();
          }}
          onClose={() => setShowHolidayModal(false)}
        />
      )}
      {showHoursModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeHoursModal}
        >
          <Card 
            className="p-6 max-w-md w-full m-4 bg-white shadow-2xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">
              Log Hours - {showHoursModal.projectName}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Process</label>
                <Select 
                  value={hoursForm.process} 
                  onValueChange={(v) => setHoursForm(prev => ({ ...prev, process: v as WorkshopProcess }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select process" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCESSES.map((p) => (
                      <SelectItem key={p} value={p}>{formatProcess(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">User</label>
                <Select 
                  value={hoursForm.userId} 
                  onValueChange={(v) => setHoursForm(prev => ({ ...prev, userId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Date</label>
                <Input
                  type="date"
                  value={hoursForm.date}
                  onChange={(e) => setHoursForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Hours</label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  placeholder="e.g. 8 or 7.5"
                  value={hoursForm.hours}
                  onChange={(e) => setHoursForm(prev => ({ ...prev, hours: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={saveHours}
                  disabled={!hoursForm.process || !hoursForm.userId || !hoursForm.hours}
                >
                  Log Hours
                </Button>
                <Button variant="ghost" onClick={closeHoursModal}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Holiday management modal
interface HolidayModalProps {
  users: UserLite[];
  holidays: Holiday[];
  onAdd: (payload: { userId: string; startDate: string; endDate: string; notes?: string }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onClose: () => void;
}

function HolidayModal({ users, holidays, onAdd, onDelete, onClose }: HolidayModalProps) {
  const [form, setForm] = useState<{ userId: string; startDate: string; endDate: string; notes?: string }>({ userId: '', startDate: '', endDate: '', notes: '' });
  // Group holidays by user for quick view
  const byUser = users.map(u => ({
    user: u,
    items: holidays.filter(h => h.userId === u.id)
  }));

  const submit = async () => {
    if (!form.userId || !form.startDate || !form.endDate) return;
    await onAdd({ userId: form.userId, startDate: form.startDate, endDate: form.endDate, notes: form.notes });
    setForm({ userId: '', startDate: '', endDate: '', notes: '' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <Card className="p-6 max-w-3xl w-full m-4 bg-white shadow-2xl border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Manage Holidays</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {/* Add form */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">User</label>
            <Select value={form.userId} onValueChange={(v) => setForm(f => ({ ...f, userId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Start</label>
            <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End</label>
            <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Input type="text" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="mb-6">
          <Button onClick={submit} disabled={!form.userId || !form.startDate || !form.endDate}>Add Holiday</Button>
        </div>

        {/* List */}
        <div className="space-y-3 max-h-[50vh] overflow-auto pr-2">
          {byUser.map(group => (
            <div key={group.user.id} className="border rounded p-3">
              <div className="font-medium mb-2">{group.user.name || group.user.email}</div>
              {group.items.length === 0 ? (
                <div className="text-xs text-muted-foreground">No holidays</div>
              ) : (
                <div className="space-y-2">
                  {group.items.map(h => (
                    <div key={h.id} className="flex items-center justify-between text-sm">
                      <div>
                        {new Date(h.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(h.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {h.notes ? <span className="text-xs text-muted-foreground ml-2">{h.notes}</span> : null}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(h.id)}>Delete</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
