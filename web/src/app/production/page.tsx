"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrentUser } from "@/lib/use-current-user";

type UserLite = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isInstaller?: boolean;
  workshopHoursPerDay?: number | null;
  workshopColor?: string | null;
  workshopProcessCodes?: string[];
};

type Holiday = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
};

type ProcessAssignment = {
  id: string;
  processCode: string;
  processName: string;
  sortOrder?: number;
  required: boolean;
  estimatedHours?: number | null;
  assignmentGroup?: string | null;
  assignedUser?: { id: string; name: string | null; email: string } | null;
  completedAt?: string | null;
};

type Project = {
  id: string;
  name: string;
  number?: string | null;
  valueGBP?: string | number | null;
  wonAt?: string | null;
  startDate?: string | null;
  deliveryDate?: string | null;
  installationStartDate?: string | null;
  installationEndDate?: string | null;
  timberOrderedAt?: string | null;
  timberReceivedAt?: string | null;
  timberNotApplicable?: boolean;
  glassOrderedAt?: string | null;
  glassReceivedAt?: string | null;
  glassNotApplicable?: boolean;
  ironmongeryOrderedAt?: string | null;
  ironmongeryReceivedAt?: string | null;
  ironmongeryNotApplicable?: boolean;
  paintOrderedAt?: string | null;
  paintReceivedAt?: string | null;
  paintNotApplicable?: boolean;
  processAssignments?: ProcessAssignment[];
};

type ScheduleResponse = { ok: boolean; projects: Project[] };

type UsersResponse = { ok: boolean; items: UserLite[] };

type HolidaysResponse = { ok: boolean; items: Holiday[] };

type AllocationItem = {
  projectId: string;
  projectName: string;
  projectNumber?: string | null;
  processAssignmentId: string;
  processCode: string;
  processName: string;
  hours: number;
  workshopColor?: string | null;
  // Minimal planning indicators already available on the Opportunity
  materials: {
    timber: "na" | "not-ordered" | "ordered" | "received";
    glass: "na" | "not-ordered" | "ordered" | "received";
    ironmongery: "na" | "not-ordered" | "ordered" | "received";
    paint: "na" | "not-ordered" | "ordered" | "received";
  };
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfYear(year: number): Date {
  const d = new Date(year, 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfYear(year: number): Date {
  const d = new Date(year, 11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function dayInHoliday(d: Date, h: Holiday): boolean {
  const sd = new Date(h.startDate);
  const ed = new Date(h.endDate);
  sd.setHours(0, 0, 0, 0);
  ed.setHours(0, 0, 0, 0);
  const cur = new Date(d);
  cur.setHours(0, 0, 0, 0);
  return cur >= sd && cur <= ed;
}

function materialStatus(orderedAt?: string | null, receivedAt?: string | null, notApplicable?: boolean): "na" | "not-ordered" | "ordered" | "received" {
  if (notApplicable) return "na";
  if (receivedAt) return "received";
  if (orderedAt) return "ordered";
  return "not-ordered";
}

function clampHours(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function formatDayLabel(d: Date): string {
  const wd = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${wd} ${day} ${month}`;
}

function createYearDays(year: number): Date[] {
  const start = startOfYear(year);
  const end = endOfYear(year);
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function defaultCursorStart(year: number): Date {
  const now = new Date();
  const start = startOfYear(year);
  if (year === now.getFullYear() && now > start) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return start;
}

type ComputedSchedule = {
  // userId -> dateStr -> items
  byUser: Record<string, Record<string, AllocationItem[]>>;
  // userId -> dateStr -> usedHours
  usedHours: Record<string, Record<string, number>>;
};

function computeScheduleForYear(params: {
  year: number;
  users: UserLite[];
  holidays: Holiday[];
  projects: Project[];
}): ComputedSchedule {
  const { year, users, holidays, projects } = params;

  const byUser: ComputedSchedule["byUser"] = {};
  const usedHours: ComputedSchedule["usedHours"] = {};

  const projectById = new Map(projects.map((p) => [p.id, p] as const));

  for (const user of users) {
    byUser[user.id] = {};
    usedHours[user.id] = {};

    const userHolidays = holidays.filter((h) => h.userId === user.id);
    const hoursPerDay = user.workshopHoursPerDay != null ? Number(user.workshopHoursPerDay) : 8;

    // Gather assigned process work for this user
    const assignments: Array<{
      project: Project;
      pa: ProcessAssignment;
      hours: number;
      sortKey: string;
    }> = [];

    for (const proj of projects) {
      for (const pa of proj.processAssignments || []) {
        if (!pa.assignedUser || pa.assignedUser.id !== user.id) continue;
        if (pa.completedAt) continue;
        const hrs = clampHours(pa.estimatedHours);
        if (hrs <= 0) continue;

        // Sort: projects with explicit startDate first (earlier first), then wonAt older first, then process sort
        const sd = proj.startDate ? new Date(proj.startDate).getTime() : Number.POSITIVE_INFINITY;
        const won = proj.wonAt ? new Date(proj.wonAt).getTime() : Number.POSITIVE_INFINITY;
        const procSort = pa.sortOrder ?? 0;
        const sortKey = `${String(sd).padStart(20, "0")}|${String(won).padStart(20, "0")}|${String(procSort).padStart(6, "0")}|${proj.id}`;

        assignments.push({ project: proj, pa, hours: hrs, sortKey });
      }
    }

    assignments.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Cursor through working days
    let cursor = defaultCursorStart(year);

    for (const { project, pa } of assignments) {
      let remaining = hours;

      while (remaining > 0) {
        // Advance to next working day
        while (isWeekend(cursor) || userHolidays.some((h) => dayInHoliday(cursor, h))) {
          cursor.setDate(cursor.getDate() + 1);
          cursor.setHours(0, 0, 0, 0);
          if (cursor.getFullYear() !== year) break;
        }
        if (cursor.getFullYear() !== year) break;

        const dayKey = isoDate(cursor);
        const already = usedHours[user.id][dayKey] || 0;
        const free = Math.max(0, hoursPerDay - already);
        if (free <= 0) {
          cursor.setDate(cursor.getDate() + 1);
          cursor.setHours(0, 0, 0, 0);
          continue;
        }

        const chunk = Math.min(remaining, free);

        const projLatest = projectById.get(project.id) || project;
        const item: AllocationItem = {
          projectId: project.id,
          projectName: projLatest.name,
          projectNumber: projLatest.number || null,
          processAssignmentId: pa.id,
          processCode: pa.processCode,
          processName: pa.processName,
          hours: chunk,
          workshopColor: user.workshopColor || null,
          materials: {
            timber: materialStatus(projLatest.timberOrderedAt, projLatest.timberReceivedAt, projLatest.timberNotApplicable),
            glass: materialStatus(projLatest.glassOrderedAt, projLatest.glassReceivedAt, projLatest.glassNotApplicable),
            ironmongery: materialStatus(
              projLatest.ironmongeryOrderedAt,
              projLatest.ironmongeryReceivedAt,
              projLatest.ironmongeryNotApplicable
            ),
            paint: materialStatus(projLatest.paintOrderedAt, projLatest.paintReceivedAt, projLatest.paintNotApplicable),
          },
        };

        (byUser[user.id][dayKey] ||= []).push(item);
        usedHours[user.id][dayKey] = already + chunk;
        remaining -= chunk;

        // If this process completes and we still have capacity today,
        // the next process will start today naturally (same cursor/day).
      }
    }
  }

  return { byUser, usedHours };
}

function statusDotClass(status: AllocationItem["materials"]["timber"]): string {
  switch (status) {
    case "received":
      return "bg-emerald-500";
    case "ordered":
      return "bg-amber-500";
    case "not-ordered":
      return "bg-red-500";
    case "na":
      return "bg-slate-300";
  }
}

export default function ProductionPage() {
  const { user } = useCurrentUser();
  const isAdmin = (user?.role || "").toLowerCase() === "admin" || (user?.role || "").toLowerCase() === "owner";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [users, setUsers] = useState<UserLite[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const todayColRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const from = isoDate(startOfYear(year));
        const to = isoDate(endOfYear(year));

        const [schedR, usersR, holsR] = await Promise.all([
          apiFetch<ScheduleResponse>(`/workshop/schedule?weeks=52`),
          apiFetch<UsersResponse>(`/workshop/users`),
          apiFetch<HolidaysResponse>(`/workshop/holidays?from=${from}&to=${to}`),
        ]);

        if (!schedR?.ok) throw new Error("Failed to load workshop schedule");
        if (!usersR?.ok) throw new Error("Failed to load workshop users");
        if (!holsR?.ok) throw new Error("Failed to load workshop holidays");

        setProjects((schedR.projects || []).map((p) => ({ ...p })));
        setUsers((usersR.items || []).map((u) => ({ ...u })));
        setHolidays(holsR.items || []);
      } catch (e: any) {
        setLoadError(e?.message || "load_failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [year]);

  const yearDays = useMemo(() => createYearDays(year), [year]);

  const workshopUsers = useMemo(() => {
    const items = (users || []).filter((u) => u.role === "workshop" || u.isInstaller);
    // Stable sort: workshop first, then installers; then name/email
    return items.sort((a, b) => {
      const aw = a.role === "workshop" ? 0 : 1;
      const bw = b.role === "workshop" ? 0 : 1;
      if (aw !== bw) return aw - bw;
      const an = (a.name || a.email).toLowerCase();
      const bn = (b.name || b.email).toLowerCase();
      return an.localeCompare(bn);
    });
  }, [users]);

  const computed = useMemo(() => {
    return computeScheduleForYear({ year, users: workshopUsers, holidays, projects });
  }, [year, workshopUsers, holidays, projects]);

  useEffect(() => {
    // After render, scroll to "today" if it's in this year.
    if (year !== new Date().getFullYear()) return;
    if (!scrollerRef.current || !todayColRef.current) return;

    // Keep it simple: center today in viewport.
    const scroller = scrollerRef.current;
    const col = todayColRef.current;

    const colLeft = col.offsetLeft;
    const colWidth = col.offsetWidth;
    const target = Math.max(0, colLeft - (scroller.clientWidth - colWidth) / 2);
    scroller.scrollLeft = target;
  }, [year, workshopUsers.length]);

  async function applyDatesForProject(projectId: string) {
    // Set project start/end based on earliest/latest scheduled day across all users.
    const daysWithWork: string[] = [];
    for (const u of workshopUsers) {
      const byDate = computed.byUser[u.id] || {};
      for (const [dateKey, items] of Object.entries(byDate)) {
        if ((items || []).some((it) => it.projectId === projectId)) {
          daysWithWork.push(dateKey);
        }
      }
    }
    daysWithWork.sort();
    const first = daysWithWork[0];
    const last = daysWithWork[daysWithWork.length - 1];
    if (!first || !last) return;

    await apiFetch(`/opportunities/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: first, deliveryDate: last }),
    });

    // Update local state so indicators update immediately
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, startDate: first, deliveryDate: last } : p))
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-muted-foreground">Loading production plan…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Card className="p-6">
          <div className="text-lg font-semibold">Production</div>
          <div className="mt-2 text-sm text-red-600">{loadError}</div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => setYear(new Date().getFullYear())}>
              Back to current year
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const totalAssignments = projects.reduce((acc, p) => acc + (p.processAssignments || []).length, 0);

  return (
    <div className="mx-auto w-full px-6 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Production</h1>
          <p className="text-sm text-muted-foreground">Workshop user schedule (auto-filled from assigned processes)</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {year}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setYear(new Date().getFullYear())}
            title="Jump to current year"
          >
            Today
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">Users: {workshopUsers.length}</Badge>
        <Badge variant="outline">Projects: {projects.length}</Badge>
        <Badge variant="outline">Process assignments: {totalAssignments}</Badge>
        <Badge variant="outline">Holidays loaded: {holidays.length}</Badge>
        <Badge variant="outline">Auto schedule is computed (not saved)</Badge>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="border-b bg-white px-4 py-3">
          <div className="text-sm font-medium">Year grid</div>
          <div className="text-xs text-muted-foreground">Scroll horizontally to move through the year</div>
        </div>

        <div ref={scrollerRef} className="overflow-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `260px repeat(${yearDays.length}, 160px)`,
              minWidth: 260 + yearDays.length * 160,
            }}
          >
            {/* Header row */}
            <div className="sticky left-0 z-20 border-b bg-white px-4 py-3 text-sm font-semibold">User</div>
            {yearDays.map((d) => {
              const key = isoDate(d);
              const isToday = key === isoDate(new Date());
              const isNewMonth = d.getDate() === 1;
              return (
                <div
                  key={key}
                  ref={isToday ? todayColRef : undefined}
                  className={`z-10 border-b px-3 py-2 text-xs ${isWeekend(d) ? "bg-slate-50" : "bg-white"} ${isToday ? "bg-[rgb(var(--brand))]/10" : ""}`}
                >
                  <div className={`font-semibold ${isNewMonth ? "text-slate-900" : "text-slate-700"}`}>{formatDayLabel(d)}</div>
                  <div className="text-[11px] text-muted-foreground">{isNewMonth ? d.toLocaleDateString("en-GB", { month: "long" }) : ""}</div>
                </div>
              );
            })}

            {/* User rows */}
            {workshopUsers.map((u) => {
              const displayName = (u.name || "").trim() || u.email;
              const hoursPerDay = u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8;
              const roleLabel = u.role === "workshop" ? "Workshop" : u.isInstaller ? "Installer" : u.role;

              return (
                <>
                  <div key={`${u.id}-label`} className="sticky left-0 z-10 border-b bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: u.workshopColor || "#94a3b8" }}
                        title={u.workshopColor || undefined}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {roleLabel} • {hoursPerDay}h/day
                        </div>
                      </div>
                    </div>
                  </div>

                  {yearDays.map((d) => {
                    const dayKey = isoDate(d);
                    const items = computed.byUser[u.id]?.[dayKey] || [];
                    const used = computed.usedHours[u.id]?.[dayKey] || 0;
                    const free = Math.max(0, hoursPerDay - used);

                    return (
                      <div
                        key={`${u.id}-${dayKey}`}
                        className={`border-b border-l px-2 py-2 align-top ${isWeekend(d) ? "bg-slate-50" : "bg-white"}`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>{used > 0 ? `${used.toFixed(1)}h` : ""}</span>
                          <span>{free > 0 && used > 0 ? `${free.toFixed(1)}h free` : ""}</span>
                        </div>

                        <div className="space-y-1">
                          {items.slice(0, 3).map((it) => {
                            const title = `${it.projectNumber ? it.projectNumber + " • " : ""}${it.projectName} • ${it.processName} • ${it.hours.toFixed(1)}h`;
                            return (
                              <div
                                key={`${it.processAssignmentId}-${it.projectId}-${it.hours}-${it.processCode}`}
                                className="rounded px-2 py-1 text-[12px] font-medium text-white overflow-hidden"
                                style={{ backgroundColor: it.workshopColor || "#3b82f6" }}
                                title={title}
                              >
                                <div className="truncate">
                                  {it.projectNumber ? `${it.projectNumber} ` : ""}{it.projectName}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate text-[11px] opacity-95">{it.processName} • {it.hours.toFixed(1)}h</div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(it.materials.timber)}`} title={`Timber: ${it.materials.timber}`} />
                                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(it.materials.glass)}`} title={`Glass: ${it.materials.glass}`} />
                                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(it.materials.ironmongery)}`} title={`Ironmongery: ${it.materials.ironmongery}`} />
                                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(it.materials.paint)}`} title={`Paint: ${it.materials.paint}`} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {items.length > 3 && (
                            <div className="text-[11px] text-muted-foreground">+{items.length - 3} more</div>
                          )}
                        </div>

                        {isAdmin && items.length > 0 && (
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={async () => {
                                // apply based on the first project in this cell
                                await applyDatesForProject(items[0].projectId);
                              }}
                              title="Set start/end dates based on scheduled days (project)"
                            >
                              Apply dates
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
