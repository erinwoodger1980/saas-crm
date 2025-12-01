"use client";

import { useEffect, useState } from "react";
import { apiFetch, ensureDemoAuth } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import WorkshopTimer from "@/components/workshop/WorkshopTimer";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Project = {
  id: string;
  title: string;
  startDate?: string | null;
  deliveryDate?: string | null;
  installationStartDate?: string | null;
  installationEndDate?: string | null;
  totalProjectHours?: number;
};

type ProcessDef = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

type UserLite = {
  id: string;
  name: string | null;
  email: string;
  workshopColor?: string | null;
};

export default function MobileWorkshopPage() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [processes, setProcesses] = useState<ProcessDef[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month' | 'year'>('month');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [quickLogForm, setQuickLogForm] = useState({
    projectId: '',
    process: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  async function loadAll() {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
          try { await ensureDemoAuth(); } catch {}
        }
      }

      const [schedR, procsR, usersR] = await Promise.allSettled([
        apiFetch<{ ok: boolean; projects: Project[] }>("/workshop/schedule?weeks=4"),
        apiFetch<{ ok: boolean; items: ProcessDef[] }>("/workshop-processes"),
        apiFetch<{ ok: boolean; items: UserLite[] }>("/workshop/users"),
      ]);

      if (schedR.status === 'fulfilled' && schedR.value?.ok) {
        const raw = (schedR.value.projects || []) as Project[];
        const byId = new Map<string, Project>();
        for (const p of raw) byId.set(p.id, p);
        setProjects(Array.from(byId.values()));
      }

      if (procsR.status === 'fulfilled' && procsR.value?.ok) {
        const normalized = Array.isArray(procsR.value.items) ? procsR.value.items : [];
        setProcesses(normalized.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)));
      }

      if (usersR.status === 'fulfilled' && usersR.value?.ok) {
        setUsers(usersR.value.items);
      }
    } catch (e) {
      console.error("Failed to load workshop:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleQuickLog() {
    if (!quickLogForm.projectId || !quickLogForm.process || !quickLogForm.hours) return;
    
    try {
      await apiFetch('/workshop/time', {
        method: 'POST',
        json: {
          projectId: quickLogForm.projectId,
          userId: user?.id,
          process: quickLogForm.process,
          date: quickLogForm.date,
          hours: Number(quickLogForm.hours),
          notes: quickLogForm.notes || undefined,
        },
      });
      setShowQuickLog(false);
      setQuickLogForm({
        projectId: '',
        process: '',
        hours: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await loadAll();
    } catch (e: any) {
      alert('Failed to log hours: ' + (e?.message || 'Unknown error'));
    }
  }

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const mondayBasedOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const days = [];
    for (let i = 0; i < mondayBasedOffset; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
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

  const getUserColor = (userId: string): string => {
    const u = users.find(user => user.id === userId);
    return u?.workshopColor || '#60a5fa';
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setCurrentWeek(new Date());
    setCurrentYear(new Date().getFullYear());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Fixed header with timer */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="p-4 max-w-2xl mx-auto">
          <WorkshopTimer
            projects={projects.map(p => ({ id: p.id, title: p.title }))}
            processes={processes.map(p => ({ code: p.code, name: p.name }))}
            onTimerChange={loadAll}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* View tabs */}
        <Tabs value={calendarViewMode} onValueChange={(v) => setCalendarViewMode(v as 'week' | 'month' | 'year')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>

          {/* Month View */}
          <TabsContent value="month" className="mt-4">
            <Card className="p-4">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="sm" onClick={previousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-semibold">
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

              {/* Calendar grid */}
              <div className="space-y-2">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-600 mb-2">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={i}>{day}</div>
                  ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(currentMonth).map((date, idx) => {
                    const isToday = date && 
                      date.getDate() === new Date().getDate() &&
                      date.getMonth() === new Date().getMonth() &&
                      date.getFullYear() === new Date().getFullYear();
                    
                    const isWeekend = date && (date.getDay() === 0 || date.getDay() === 6);
                    const projectsOnDate = date ? getProjectsForDate(date) : [];

                    return (
                      <div
                        key={idx}
                        className={`min-h-12 p-1 text-xs rounded ${
                          !date ? 'bg-slate-50' : 
                          isWeekend ? 'bg-slate-100' :
                          isToday ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-white'
                        }`}
                      >
                        {date && (
                          <>
                            <div className={`font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                              {date.getDate()}
                            </div>
                            {projectsOnDate.length > 0 && (
                              <div className="w-2 h-2 rounded-full bg-green-500 mx-auto" />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Week View */}
          <TabsContent value="week" className="mt-4">
            <Card className="p-4">
              <div className="text-center text-muted-foreground">
                Week view coming soon
              </div>
            </Card>
          </TabsContent>

          {/* Year View */}
          <TabsContent value="year" className="mt-4">
            <Card className="p-4">
              <div className="text-center text-muted-foreground">
                Year view coming soon
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick log hours button */}
        <Button
          onClick={() => setShowQuickLog(!showQuickLog)}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {showQuickLog ? 'Cancel' : 'Log Hours Manually'}
        </Button>

        {/* Quick log form */}
        {showQuickLog && (
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold">Log Hours</h3>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Project</label>
              <Select value={quickLogForm.projectId} onValueChange={(v) => setQuickLogForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Process</label>
              <Select value={quickLogForm.process} onValueChange={(v) => setQuickLogForm(f => ({ ...f, process: v }))}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select process" />
                </SelectTrigger>
                <SelectContent>
                  {processes.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Date</label>
              <Input
                type="date"
                value={quickLogForm.date}
                onChange={(e) => setQuickLogForm(f => ({ ...f, date: e.target.value }))}
                className="h-12"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Hours</label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={quickLogForm.hours}
                onChange={(e) => setQuickLogForm(f => ({ ...f, hours: e.target.value }))}
                placeholder="e.g. 8 or 7.5"
                className="h-12"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
              <Input
                value={quickLogForm.notes}
                onChange={(e) => setQuickLogForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Add a note..."
                className="h-12"
              />
            </div>

            <Button
              onClick={handleQuickLog}
              disabled={!quickLogForm.projectId || !quickLogForm.process || !quickLogForm.hours}
              className="w-full"
              size="lg"
            >
              Log Hours
            </Button>
          </Card>
        )}

        {/* Active projects list */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Active Projects ({projects.length})</h3>
          <div className="space-y-2">
            {projects.slice(0, 10).map(proj => (
              <div key={proj.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{proj.title}</div>
                  {proj.startDate && proj.deliveryDate && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(proj.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - 
                      {new Date(proj.deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  )}
                </div>
                {proj.totalProjectHours !== undefined && (
                  <div className="text-sm font-semibold text-green-600 ml-2">
                    {proj.totalProjectHours}h
                  </div>
                )}
              </div>
            ))}
            {projects.length > 10 && (
              <div className="text-xs text-center text-muted-foreground pt-2">
                +{projects.length - 10} more projects
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
