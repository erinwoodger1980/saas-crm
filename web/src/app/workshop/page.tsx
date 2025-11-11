"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ensureDemoAuth, API_BASE } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

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
  const [weeks, setWeeks] = useState(4);
  const [projects, setProjects] = useState<Project[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [adding, setAdding] = useState<Record<string, NewPlan>>({});
  const [loggingFor, setLoggingFor] = useState<Record<string, LogForm | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [editingDates, setEditingDates] = useState<Record<string, { startDate: string; deliveryDate: string }>>({});

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
          setWeeks(sched.weeks);
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

  const weeksArray = useMemo(() => Array.from({ length: weeks }, (_, i) => i + 1), [weeks]);

  if (loading) return (
    <div className="p-2">
      <h1 className="text-2xl font-semibold mb-2">Workshop</h1>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );

  // Calendar view
  if (viewMode === 'calendar') {
    const projectCount = calendarData?.projects.length || 0;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Workshop Calendar</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{projectCount} projects</span>
            <Button variant="outline" size="sm" onClick={() => setViewMode('legacy')}>
              Switch to Process View
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
            {/* Calendar header with months */}
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2">
                      <th className="sticky left-0 bg-background z-10 p-2 text-left font-semibold w-64 border-r">
                        Project
                      </th>
                      {calendarData?.months.map(m => (
                        <th key={`${m.year}-${m.month}`} className="p-2 text-center font-semibold min-w-32 border-r">
                          {m.label}
                        </th>
                      ))}
                      <th className="p-2 text-right font-semibold min-w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendarData?.projects.map(proj => {
                      const editing = editingDates[proj.id];
                      
                      return (
                        <tr key={proj.id} className="border-b hover:bg-muted/50">
                          <td className="sticky left-0 bg-background z-10 p-2 border-r">
                            <div className="font-medium">{proj.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {editing ? (
                                <div className="space-y-1">
                                  <Input
                                    type="date"
                                    value={editing.startDate}
                                    onChange={(e) => setEditingDates(prev => ({
                                      ...prev,
                                      [proj.id]: { ...prev[proj.id], startDate: e.target.value }
                                    }))}
                                    className="h-6 text-xs"
                                  />
                                  <Input
                                    type="date"
                                    value={editing.deliveryDate}
                                    onChange={(e) => setEditingDates(prev => ({
                                      ...prev,
                                      [proj.id]: { ...prev[proj.id], deliveryDate: e.target.value }
                                    }))}
                                    className="h-6 text-xs"
                                  />
                                  <div className="flex gap-1">
                                    <Button size="sm" className="h-6 text-xs" onClick={() => saveDates(proj.id)}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => cancelEditDates(proj.id)}>Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditDates(proj.id, proj.startDate, proj.deliveryDate)}
                                  className="text-left hover:text-primary"
                                >
                                  {new Date(proj.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {new Date(proj.deliveryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  <br />
                                  {proj.totalDays} days
                                </button>
                              )}
                            </div>
                          </td>
                          {calendarData?.months.map(m => {
                            const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
                            const value = proj.monthlyValues[key] || 0;
                            const hasValue = value > 0;
                            
                            return (
                              <td key={key} className={`p-1 text-center border-r ${hasValue ? 'bg-primary/5' : ''}`}>
                                {hasValue && (
                                  <div className="text-xs font-medium text-primary">
                                    {formatCurrency(value)}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-2 text-right font-semibold">
                            {formatCurrency(proj.valueGBP)}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Monthly totals row */}
                    <tr className="border-t-2 font-semibold bg-muted/30">
                      <td className="sticky left-0 bg-muted/30 z-10 p-2 border-r">
                        Monthly Total
                      </td>
                      {calendarData?.months.map(m => {
                        const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
                        const total = calendarData?.monthlyTotals[key] || 0;
                        
                        return (
                          <td key={key} className="p-2 text-center border-r bg-primary/10">
                            <div className="text-sm font-bold text-primary">
                              {total > 0 ? formatCurrency(total) : '—'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-2 text-right">
                        {formatCurrency(calendarData?.projects.reduce((sum, p) => sum + p.valueGBP, 0) || 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
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
