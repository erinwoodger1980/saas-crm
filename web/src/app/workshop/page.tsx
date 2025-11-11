"use client";

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
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(4);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [adding, setAdding] = useState<Record<string, NewPlan>>({});
  const [loggingFor, setLoggingFor] = useState<Record<string, LogForm | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [editingDates, setEditingDates] = useState<Record<string, { startDate: string; deliveryDate: string; value: string }>>({});

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

      const [sched, usersResp] = await Promise.all([
        apiFetch<ScheduleResponse>("/workshop/schedule?weeks=4"),
        apiFetch<UsersResponse>("/workshop/users"),
      ]);
      if (sched?.ok) {
        setWeeks(sched.weeks);
        setProjects(sched.projects);
      }
      if (usersResp?.ok) setUsers(usersResp.items);
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

  const getWeekTotal = (weekNumber: number) => {
    const weekProjects = getProjectsForWeek(weekNumber);
    return weekProjects.reduce((sum, proj) => sum + (Number(proj.valueGBP) || 0), 0);
  };

  const getMonthTotal = () => {
    // Get all unique projects with scheduled work
    const activeProjects = new Set<string>();
    projects.forEach(proj => {
      if (proj.processPlans.length > 0) {
        activeProjects.add(proj.id);
      }
    });
    return Array.from(activeProjects).reduce((sum, projId) => {
      const proj = projects.find(p => p.id === projId);
      return sum + (Number(proj?.valueGBP) || 0);
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
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-slate-50 border-b">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-3 text-center text-sm font-semibold text-slate-600">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {getDaysInMonth(currentMonth).map((date, idx) => {
                const isToday = date && 
                  date.toDateString() === new Date().toDateString();
                const projectsOnDate = date ? getProjectsForDate(date) : [];
                
                return (
                  <div
                    key={idx}
                    className={`min-h-[120px] p-2 border-r border-b ${
                      !date ? 'bg-slate-50' : ''
                    } ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    {date && (
                      <>
                        <div className={`text-sm mb-2 ${isToday ? 'font-bold text-blue-600' : 'text-slate-600'}`}>
                          {date.getDate()}
                        </div>
                        <div className="space-y-1">
                          {projectsOnDate.map(proj => {
                            const isStartDate = proj.startDate && 
                              new Date(proj.startDate).toDateString() === date.toDateString();
                            const isDeliveryDate = proj.deliveryDate && 
                              new Date(proj.deliveryDate).toDateString() === date.toDateString();
                            
                            return (
                              <div 
                                key={proj.id} 
                                className="text-xs p-1 rounded bg-blue-100 text-blue-800 truncate"
                                title={`${proj.name} - ${formatCurrency(Number(proj.valueGBP) || 0)}`}
                              >
                                {isStartDate && <span className="font-bold">▶ </span>}
                                {proj.name.length > 15 ? proj.name.substring(0, 15) + '...' : proj.name}
                                {isDeliveryDate && <span className="font-bold"> ✓</span>}
                              </div>
                            );
                          })}
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
                  <div className="text-sm text-muted-foreground mb-3">
                    {projectsInWeek.length} project{projectsInWeek.length !== 1 ? 's' : ''}
                  </div>
                  <div className="space-y-2">
                    {projectsInWeek.slice(0, 3).map(proj => (
                      <div key={proj.id} className="text-sm">
                        <div className="font-medium truncate" title={proj.name}>{proj.name}</div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
                    ))}
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
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateProjectDates(proj.id)}>
                      Save Dates
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
    </div>
  );
}
