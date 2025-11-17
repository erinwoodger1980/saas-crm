/**
 * Swimlane Scheduling Utilities
 * 
 * Automatically distributes processes across a project timeline based on estimated hours.
 * Since we don't have explicit start/end dates for each process, we approximate by:
 * 1. Calculating each process's proportion of total project hours
 * 2. Assigning contiguous date ranges proportional to those hours
 * 3. Mapping those ranges to weekly cells for visualization
 */

export type Process = {
  id: string;
  processCode: string;
  processName: string;
  estimatedHours: number | null | undefined;
  sortOrder?: number;
};

export type ScheduledSegment = {
  processId: string;
  processCode: string;
  processName: string;
  start: Date;
  end: Date;
  hours: number;
  sortOrder?: number;
};

export type WeekCellChunk = {
  processId: string;
  processCode: string;
  processName: string;
  proportionOfWeek: number; // 0-1, represents how much of the week this process occupies
  hours: number;
  color: string;
  sortOrder?: number;
};

/**
 * Get number of calendar days between two dates (inclusive)
 */
function getDaysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const startMs = new Date(start).setHours(0, 0, 0, 0);
  const endMs = new Date(end).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((endMs - startMs) / msPerDay) + 1);
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Build a pseudo-schedule for a project's processes.
 * 
 * Algorithm:
 * 1. Sort processes by sortOrder (if available) to maintain logical sequence
 * 2. Calculate total hours across all processes
 * 3. For each process:
 *    - Determine its proportion of total hours
 *    - Assign a contiguous date range proportional to that
 * 4. Ensure the last segment ends exactly on projectEnd (handle rounding)
 * 
 * @param projectStart - Project start date
 * @param projectEnd - Project delivery/end date
 * @param processes - Array of processes with estimated hours
 * @returns Array of scheduled segments with start/end dates per process
 */
export function buildProcessScheduleForProject(
  projectStart: Date,
  projectEnd: Date,
  processes: Process[]
): ScheduledSegment[] {
  if (!projectStart || !projectEnd || processes.length === 0) {
    return [];
  }

  // Normalize dates to start of day
  const start = new Date(projectStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(projectEnd);
  end.setHours(0, 0, 0, 0);

  // Filter out processes without estimated hours and sort by sortOrder
  const validProcesses = processes
    .filter((p) => p.estimatedHours && p.estimatedHours > 0)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  if (validProcesses.length === 0) {
    return [];
  }

  const projectDurationDays = getDaysBetween(start, end);
  const totalHours = validProcesses.reduce((sum, p) => sum + (p.estimatedHours || 0), 0);

  if (totalHours === 0) {
    return [];
  }

  const segments: ScheduledSegment[] = [];
  let currentStart = new Date(start);
  let remainingDays = projectDurationDays;

  validProcesses.forEach((process, index) => {
    const isLast = index === validProcesses.length - 1;
    const hours = process.estimatedHours || 0;
    const fraction = hours / totalHours;

    // Calculate days for this process (at least 1 day)
    let processDays: number;
    if (isLast) {
      // Last process gets all remaining days
      processDays = remainingDays;
    } else {
      processDays = Math.max(1, Math.round(fraction * projectDurationDays));
      // Don't exceed remaining days
      processDays = Math.min(processDays, remainingDays - (validProcesses.length - index - 1));
    }

    const segmentEnd = isLast ? new Date(end) : addDays(currentStart, processDays - 1);

    segments.push({
      processId: process.id,
      processCode: process.processCode,
      processName: process.processName,
      start: new Date(currentStart),
      end: segmentEnd,
      hours,
      sortOrder: process.sortOrder,
    });

    // Move to next process start date
    currentStart = addDays(segmentEnd, 1);
    remainingDays -= processDays;
  });

  return segments;
}

/**
 * Calculate how much of a scheduled segment overlaps with a given week.
 * 
 * @param segment - Scheduled process segment
 * @param weekStart - Week start date (Monday)
 * @param weekEnd - Week end date (Sunday)
 * @returns Number of overlapping days (0 if no overlap)
 */
function getSegmentWeekOverlap(
  segment: ScheduledSegment,
  weekStart: Date,
  weekEnd: Date
): number {
  const segStart = new Date(segment.start).setHours(0, 0, 0, 0);
  const segEnd = new Date(segment.end).setHours(0, 0, 0, 0);
  const wkStart = new Date(weekStart).setHours(0, 0, 0, 0);
  const wkEnd = new Date(weekEnd).setHours(0, 0, 0, 0);

  // No overlap if segment is completely before or after the week
  if (segEnd < wkStart || segStart > wkEnd) {
    return 0;
  }

  // Calculate overlap
  const overlapStart = Math.max(segStart, wkStart);
  const overlapEnd = Math.min(segEnd, wkEnd);
  const msPerDay = 1000 * 60 * 60 * 24;

  return Math.round((overlapEnd - overlapStart) / msPerDay) + 1;
}

/**
 * Generate process color palette
 * Uses a predefined color palette that's visually distinct
 */
const PROCESS_COLORS = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
  "#a855f7", // purple-500
  "#ef4444", // red-500
  "#84cc16", // lime-500
];

/**
 * Get a consistent color for a process based on its code
 */
export function getProcessColor(processCode: string): string {
  // Hash the process code to get a consistent color index
  let hash = 0;
  for (let i = 0; i < processCode.length; i++) {
    hash = processCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PROCESS_COLORS.length;
  return PROCESS_COLORS[index];
}

/**
 * Map scheduled segments to a specific week's cell.
 * 
 * For each segment that overlaps the week:
 * - Calculate what proportion of the week it occupies
 * - Calculate hours allocated to this week
 * - Assign a color
 * 
 * @param segments - All scheduled segments for a project
 * @param weekStart - Week start date
 * @param weekEnd - Week end date
 * @returns Array of chunks to render in the week cell
 */
export function getWeekCellChunks(
  segments: ScheduledSegment[],
  weekStart: Date,
  weekEnd: Date
): WeekCellChunk[] {
  const weekDays = 7; // Standard week length
  const chunks: WeekCellChunk[] = [];

  segments.forEach((segment) => {
    const overlapDays = getSegmentWeekOverlap(segment, weekStart, weekEnd);

    if (overlapDays > 0) {
      const proportionOfWeek = overlapDays / weekDays;
      const segmentDurationDays = getDaysBetween(segment.start, segment.end);
      
      // Proportional hours for this week
      const hoursThisWeek = (segment.hours * overlapDays) / segmentDurationDays;

      chunks.push({
        processId: segment.processId,
        processCode: segment.processCode,
        processName: segment.processName,
        proportionOfWeek,
        hours: Math.round(hoursThisWeek * 10) / 10, // Round to 1 decimal
        color: getProcessColor(segment.processCode),
        sortOrder: segment.sortOrder,
      });
    }
  });

  // Sort chunks by sortOrder to maintain process sequence
  return chunks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/**
 * Get all unique processes from scheduled segments for legend
 */
export function getProjectProcessLegend(segments: ScheduledSegment[]): Array<{
  processCode: string;
  processName: string;
  color: string;
  totalHours: number;
  sortOrder?: number;
}> {
  const processMap = new Map<string, {
    processCode: string;
    processName: string;
    color: string;
    totalHours: number;
    sortOrder?: number;
  }>();

  segments.forEach((seg) => {
    if (!processMap.has(seg.processCode)) {
      processMap.set(seg.processCode, {
        processCode: seg.processCode,
        processName: seg.processName,
        color: getProcessColor(seg.processCode),
        totalHours: seg.hours,
        sortOrder: seg.sortOrder,
      });
    }
  });

  return Array.from(processMap.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}
