/**
 * Shared calendar calculation utilities for Workshop scheduling
 * 
 * These functions calculate capacity, demand, and free hours for different time periods.
 * Used consistently across Week, Month, and Year views.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type WorkshopProcess =
  | "MACHINING"
  | "ASSEMBLY"
  | "SANDING"
  | "SPRAYING"
  | "FINAL_ASSEMBLY"
  | "GLAZING"
  | "IRONMONGERY"
  | "INSTALLATION"
  | "CLEANING"
  | "ADMIN"
  | "HOLIDAY";

export type UserLite = {
  id: string;
  name: string | null;
  email: string;
  workshopHoursPerDay?: number | null;
  workshopColor?: string | null;
};

export type Holiday = {
  id: string;
  userId: string;
  startDate: string; // ISO
  endDate: string; // ISO
  notes?: string | null;
  user?: { id: string; name: string | null; email: string };
};

export type Project = {
  id: string;
  name: string;
  valueGBP?: string | number | null;
  wonAt?: string | null;
  startDate?: string | null;  // Manufacturing start date
  deliveryDate?: string | null;  // Completion date
  installationStartDate?: string | null;  // Installation start date
  installationEndDate?: string | null;  // Installation end date
  weeks: number;
  totalProjectHours: number;
  expectedHours?: number | string | null;
  actualHours?: number | string | null;
  [key: string]: any; // Allow other properties
};

export type TimeTotal = {
  capacity: number; // Total available hours
  demand: number; // Total scheduled hours
  free: number; // capacity - demand
  holidayDays: number; // Number of holiday weekdays
};

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Check if a date is a weekday (Mon-Fri)
 */
export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6; // Not Sunday or Saturday
}

/**
 * Generate array of all dates between start and end (inclusive)
 */
export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Count weekdays in a date range
 */
export function countWeekdaysInRange(start: Date, end: Date): number {
  return eachDay(start, end).filter(isWeekday).length;
}

/**
 * Check if a date falls within a holiday period
 */
export function dayInHoliday(d: Date, h: Holiday): boolean {
  const sd = new Date(h.startDate.split("T")[0]);
  const ed = new Date(h.endDate.split("T")[0]);
  sd.setHours(0, 0, 0, 0);
  ed.setHours(0, 0, 0, 0);
  const dc = new Date(d);
  dc.setHours(0, 0, 0, 0);
  return dc >= sd && dc <= ed;
}

/**
 * Get ISO week number (1-53) for a given date
 */
export function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get start and end of a specific month
 */
export function getMonthBoundaries(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Get start and end of a specific week (Mon-Sun)
 */
export function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ============================================================================
// PROJECT UTILITIES
// ============================================================================

/**
 * Get expected hours for a project (from expectedHours or totalProjectHours)
 */
export function getProjectExpectedHours(proj: Project): number {
  if (proj.expectedHours != null && proj.expectedHours !== "") {
    return Number(proj.expectedHours) || 0;
  }
  if (proj.totalProjectHours != null) {
    return Number(proj.totalProjectHours) || 0;
  }
  return 0;
}

/**
 * Calculate proportional value for a date range based on project overlap
 */
export function getProportionalValue(
  proj: Project,
  rangeStart: Date,
  rangeEnd: Date
): number {
  if (!proj.startDate || !proj.deliveryDate || !proj.valueGBP) return 0;

  const projectStart = new Date(proj.startDate);
  projectStart.setHours(0, 0, 0, 0);
  const projectEnd = new Date(proj.deliveryDate);
  projectEnd.setHours(23, 59, 59, 999);
  const value = Number(proj.valueGBP) || 0;

  if (value === 0) return 0;

  // Calculate overlap between project dates and range
  const overlapStart = new Date(Math.max(projectStart.getTime(), rangeStart.getTime()));
  const overlapEnd = new Date(Math.min(projectEnd.getTime(), rangeEnd.getTime()));

  // No overlap if range doesn't intersect with project
  if (overlapStart > overlapEnd) return 0;

  // Calculate days (use full 24h periods)
  const overlapDays =
    Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const totalProjectDays =
    Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const proportionalValue = (value * overlapDays) / totalProjectDays;
  return proportionalValue;
}

// ============================================================================
// CAPACITY & DEMAND CALCULATIONS
// ============================================================================

/**
 * Calculate capacity for a date range considering user hours and holidays
 */
export function getCapacity(
  rangeStart: Date,
  rangeEnd: Date,
  users: UserLite[],
  holidays: Holiday[]
): number {
  const days = eachDay(rangeStart, rangeEnd).filter(isWeekday);

  let totalHrs = 0;
  for (const u of users) {
    const userHoursPerDay = u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8;
    const userHols = holidays.filter((h) => h.userId === u.id);
    const workingDays = days.filter((d) => !userHols.some((h) => dayInHoliday(d, h))).length;
    totalHrs += workingDays * userHoursPerDay;
  }

  return totalHrs;
}

/**
 * Calculate demand for a date range based on project schedules
 */
export function getDemand(rangeStart: Date, rangeEnd: Date, projects: Project[]): number {
  let total = 0;

  for (const proj of projects) {
    if (!proj.startDate || !proj.deliveryDate) continue;

    const ps = new Date(proj.startDate);
    const pe = new Date(proj.deliveryDate);
    const overlapStart = new Date(Math.max(ps.getTime(), rangeStart.getTime()));
    const overlapEnd = new Date(Math.min(pe.getTime(), rangeEnd.getTime()));

    if (overlapStart > overlapEnd) continue;

    const projDays = Math.max(1, countWeekdaysInRange(ps, pe));
    const overlapDays = countWeekdaysInRange(overlapStart, overlapEnd);
    const expected = getProjectExpectedHours(proj);

    if (projDays > 0 && expected > 0) {
      total += expected * (overlapDays / projDays);
    }
  }

  return Math.round(total);
}

/**
 * Count holiday weekdays in a date range
 */
export function getHolidayDays(
  rangeStart: Date,
  rangeEnd: Date,
  users: UserLite[],
  holidays: Holiday[]
): number {
  const weekdayList = eachDay(rangeStart, rangeEnd).filter(isWeekday);
  let holidayDays = 0;

  for (const u of users) {
    const userHols = holidays.filter((h) => h.userId === u.id);
    holidayDays += weekdayList.filter((d) => userHols.some((h) => dayInHoliday(d, h))).length;
  }

  return holidayDays;
}

/**
 * Calculate week totals (capacity, demand, free hours)
 */
export function getWeekTotals(
  weekStart: Date,
  weekEnd: Date,
  users: UserLite[],
  holidays: Holiday[],
  projects: Project[]
): TimeTotal {
  const capacity = getCapacity(weekStart, weekEnd, users, holidays);
  const demand = getDemand(weekStart, weekEnd, projects);
  const holidayDays = getHolidayDays(weekStart, weekEnd, users, holidays);

  return {
    capacity,
    demand,
    free: Math.round(capacity - demand),
    holidayDays,
  };
}

/**
 * Calculate month totals (capacity, demand, free hours)
 */
export function getMonthTotals(
  year: number,
  month: number,
  users: UserLite[],
  holidays: Holiday[],
  projects: Project[]
): TimeTotal {
  const { start, end } = getMonthBoundaries(year, month);
  return getWeekTotals(start, end, users, holidays, projects);
}

/**
 * Calculate total value for a date range across all projects
 */
export function getTotalValue(rangeStart: Date, rangeEnd: Date, projects: Project[]): number {
  return projects.reduce((sum, proj) => {
    return sum + getProportionalValue(proj, rangeStart, rangeEnd);
  }, 0);
}

/**
 * Get all projects that overlap with a specific date
 */
export function getProjectsForDate(date: Date, projects: Project[]): Project[] {
  const dateStr = date.toISOString().split("T")[0];
  return projects.filter((proj) => {
    if (!proj.startDate || !proj.deliveryDate) return false;
    const start = proj.startDate.split("T")[0];
    const end = proj.deliveryDate.split("T")[0];
    return dateStr >= start && dateStr <= end;
  });
}

/**
 * Calculate project progress percentage based on current date
 */
export function getProjectProgress(proj: Project): number {
  if (!proj.startDate || !proj.deliveryDate) return 0;

  const now = new Date();
  const start = new Date(proj.startDate);
  const end = new Date(proj.deliveryDate);

  if (now < start) return 0;
  if (now > end) return 100;

  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();

  return Math.round((elapsed / total) * 100);
}

/**
 * Get color class based on progress percentage
 */
export function getProgressColor(progress: number): string {
  if (progress === 0) return "bg-slate-100 text-slate-800";
  if (progress < 25) return "bg-green-100 text-green-800";
  if (progress < 50) return "bg-green-200 text-green-900";
  if (progress < 75) return "bg-green-300 text-green-900";
  if (progress < 100) return "bg-green-400 text-green-950";
  return "bg-green-500 text-white";
}

/**
 * Format currency value (GBP)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format process name (convert SNAKE_CASE to Title Case)
 */
export function formatProcess(p: string): string {
  return p.replace(/_/g, " ");
}
