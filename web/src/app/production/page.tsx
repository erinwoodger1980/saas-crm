"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  isWorkshopUser?: boolean;
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
  valueGBPAllocated?: number;
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

function parseGBP(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatGBP(value: number): string {
  return gbpFormatter.format(Number.isFinite(value) ? value : 0);
}

function startOfWeekMonday(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // Mon->0, Sun->6
  out.setDate(out.getDate() - diff);
  return out;
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
  overflow: Array<{ userId: string; projectId: string; processAssignmentId: string; remainingHours: number }>;
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
  const overflow: ComputedSchedule["overflow"] = [];

  const projectById = new Map(projects.map((p) => [p.id, p] as const));
  const projectTotalHours = new Map<string, number>();
  const projectValueGBP = new Map<string, number>();

  for (const p of projects) {
    projectValueGBP.set(p.id, parseGBP(p.valueGBP));
    let total = 0;
    for (const pa of p.processAssignments || []) {
      if (pa.completedAt) continue;
      total += clampHours(pa.estimatedHours);
    }
    projectTotalHours.set(p.id, total);
  }

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

    for (const { project, pa, hours } of assignments) {
      let remaining = hours;

      while (remaining > 0) {
        // Advance to next working day
        while (isWeekend(cursor) || userHolidays.some((h) => dayInHoliday(cursor, h))) {
          cursor.setDate(cursor.getDate() + 1);
          cursor.setHours(0, 0, 0, 0);
          if (cursor.getFullYear() !== year) break;
        }
        if (cursor.getFullYear() !== year) {
          overflow.push({
            userId: user.id,
            projectId: project.id,
            processAssignmentId: pa.id,
            remainingHours: remaining,
          });
          break;
        }

        const dayKey = isoDate(cursor);
        const already = usedHours[user.id][dayKey] || 0;
        const free = Math.max(0, hoursPerDay - already);
        if (free <= 0) {
          cursor.setDate(cursor.getDate() + 1);
          cursor.setHours(0, 0, 0, 0);
          continue;
        }

        const chunk = Math.min(remaining, free);

        const projValue = projectValueGBP.get(project.id) || 0;
        const projTotalHrs = projectTotalHours.get(project.id) || 0;
        const valueChunk = projTotalHrs > 0 ? (projValue * chunk) / projTotalHrs : 0;

        const projLatest = projectById.get(project.id) || project;
        const item: AllocationItem = {
          projectId: project.id,
          projectName: projLatest.name,
          projectNumber: projLatest.number || null,
          processAssignmentId: pa.id,
          processCode: pa.processCode,
          processName: pa.processName,
          hours: chunk,
          valueGBPAllocated: valueChunk,
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

  return { byUser, usedHours, overflow };
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
    const items = (users || []).filter((u) => u.isWorkshopUser || u.role === "workshop" || u.isInstaller);
    // Stable sort: workshop first, then installers; then name/email
    return items.sort((a, b) => {
      const aw = a.isWorkshopUser || a.role === "workshop" ? 0 : 1;
      const bw = b.isWorkshopUser || b.role === "workshop" ? 0 : 1;
      if (aw !== bw) return aw - bw;
      const an = (a.name || a.email).toLowerCase();
      const bn = (b.name || b.email).toLowerCase();
      return an.localeCompare(bn);
    });
  }, [users]);

  const computed = useMemo(() => {
    return computeScheduleForYear({ year, users: workshopUsers, holidays, projects });
  }, [year, workshopUsers, holidays, projects]);

  const undatedWonProjects = useMemo(() => {
    return (projects || []).filter((p) => !p.startDate && !p.deliveryDate);
  }, [projects]);

  const dayTotals = useMemo(() => {
    const totals: Record<string, { scheduledHours: number; capacityHours: number; valueGBP: number; idleUsers: number }> = {};

    const holidaysByUserId = new Map<string, Holiday[]>();
    for (const h of holidays) {
      const list = holidaysByUserId.get(h.userId) || [];
      list.push(h);
      holidaysByUserId.set(h.userId, list);
    }

    for (const d of yearDays) {
      const dayKey = isoDate(d);
      let scheduledHours = 0;
      let valueGBP = 0;
      let capacityHours = 0;
      let idleUsers = 0;

      if (!isWeekend(d)) {
        for (const u of workshopUsers) {
          const hoursPerDay = u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8;
          const userHolidays = holidaysByUserId.get(u.id) || [];
          const isOnHoliday = userHolidays.some((h) => dayInHoliday(d, h));
          const hasCapacity = !isOnHoliday && hoursPerDay > 0;
          if (hasCapacity) capacityHours += hoursPerDay;

          const userScheduled = computed.usedHours[u.id]?.[dayKey] || 0;
          scheduledHours += userScheduled;
          if (hasCapacity && userScheduled <= 0) idleUsers += 1;
          const items = computed.byUser[u.id]?.[dayKey] || [];
          for (const it of items) valueGBP += it.valueGBPAllocated || 0;
        }
      }

      totals[dayKey] = { scheduledHours, capacityHours, valueGBP, idleUsers };
    }

    return totals;
  }, [computed.byUser, computed.usedHours, holidays, workshopUsers, yearDays]);

  const periodSummary = useMemo(() => {
    const now = new Date();
    const ref = year === now.getFullYear() ? now : startOfYear(year);

    const weekStart = startOfWeekMonday(ref);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const yearStart = startOfYear(year);
    const yearEnd = endOfYear(year);

    function sumRange(from: Date, to: Date) {
      let valueGBP = 0;
      let scheduledHours = 0;
      let capacityHours = 0;
      for (const d of yearDays) {
        if (d < from || d > to) continue;
        const t = dayTotals[isoDate(d)];
        if (!t) continue;
        valueGBP += t.valueGBP;
        scheduledHours += t.scheduledHours;
        capacityHours += t.capacityHours;
      }
      return { valueGBP, scheduledHours, capacityHours };
    }

    return {
      refDate: ref,
      week: sumRange(weekStart, weekEnd),
      month: sumRange(monthStart, monthEnd),
      year: sumRange(yearStart, yearEnd),
    };
  }, [dayTotals, year, yearDays]);

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
  const overflowCount = computed.overflow.length;
  const overflowProjectCount = new Set(computed.overflow.map((o) => o.projectId)).size;

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
        <Badge variant="outline">Undated WON: {undatedWonProjects.length}</Badge>
        <Badge variant="outline">Backlog (not placed): {overflowProjectCount}</Badge>
        <Badge variant="outline">Holidays loaded: {holidays.length}</Badge>
        <Badge variant="outline">£ week: {formatGBP(periodSummary.week.valueGBP)}</Badge>
        <Badge variant="outline">£ month: {formatGBP(periodSummary.month.valueGBP)}</Badge>
        <Badge variant="outline">£ year: {formatGBP(periodSummary.year.valueGBP)}</Badge>
        <Badge variant="outline">Auto schedule is computed (not saved)</Badge>
      </div>

      {(undatedWonProjects.length > 0 || overflowCount > 0) && (
        <Card className="p-4">
          <div className="text-sm font-semibold">Visibility</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Undated WON jobs are included; backlog indicates work that could not be placed within this year’s capacity.
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {undatedWonProjects.length > 0 && (
              <Badge variant="secondary">Undated WON: {undatedWonProjects.length}</Badge>
            )}
            {overflowCount > 0 && (
              <Badge variant="secondary">Backlog hours: {computed.overflow.reduce((s, o) => s + o.remainingHours, 0).toFixed(1)}h</Badge>
            )}
          </div>
        </Card>
      )}

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
              const t = dayTotals[key];
              const pct = t && t.capacityHours > 0 ? Math.round((t.scheduledHours / t.capacityHours) * 100) : 0;
              return (
                <div
                  key={key}
                  ref={isToday ? todayColRef : undefined}
                  className={`z-10 border-b px-3 py-2 text-xs ${isWeekend(d) ? "bg-slate-50" : "bg-white"} ${isToday ? "bg-[rgb(var(--brand))]/10" : ""}`}
                >
                  <div className={`font-semibold ${isNewMonth ? "text-slate-900" : "text-slate-700"}`}>{formatDayLabel(d)}</div>
                  <div className="text-[11px] text-muted-foreground">{isNewMonth ? d.toLocaleDateString("en-GB", { month: "long" }) : ""}</div>
                  {!isWeekend(d) && t && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      <div>
                        {t.scheduledHours.toFixed(0)}/{t.capacityHours.toFixed(0)}h ({pct}%)
                      </div>
                      <div>{t.valueGBP > 0 ? formatGBP(t.valueGBP) : ""}</div>
                      <div>{t.idleUsers > 0 ? `Idle: ${t.idleUsers}` : ""}</div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Totals row */}
            <div className="sticky left-0 z-10 border-b bg-white px-4 py-3 text-sm font-semibold">Total</div>
            {yearDays.map((d) => {
              const key = isoDate(d);
              const t = dayTotals[key];
              const pct = t && t.capacityHours > 0 ? Math.round((t.scheduledHours / t.capacityHours) * 100) : 0;

              return (
                <div
                  key={`total-${key}`}
                  className={`border-b border-l px-3 py-2 text-xs ${isWeekend(d) ? "bg-slate-50" : "bg-white"}`}
                >
                  {!isWeekend(d) && t ? (
                    <>
                      <div className="text-[11px] text-slate-700 font-semibold">
                        {t.scheduledHours.toFixed(0)}/{t.capacityHours.toFixed(0)}h
                      </div>
                      <div className="text-[11px] text-muted-foreground">{pct}%</div>
                      <div className="text-[11px] text-muted-foreground">{t.valueGBP > 0 ? formatGBP(t.valueGBP) : ""}</div>
                      <div className="text-[11px] text-muted-foreground">{t.idleUsers > 0 ? `Idle: ${t.idleUsers}` : ""}</div>
                    </>
                  ) : null}
                </div>
              );
            })}

            {/* User rows */}
            {workshopUsers.map((u) => {
              const displayName = (u.name || "").trim() || u.email;
              const hoursPerDay = u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8;
              const roleLabel = u.isWorkshopUser || u.role === "workshop" ? "Workshop" : u.isInstaller ? "Installer" : u.role;

              return (
                <Fragment key={u.id}>
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

                        </Fragment>
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
