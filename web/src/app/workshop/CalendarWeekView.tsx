"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type Project,
  type UserLite,
  type Holiday,
  getWeekBoundaries,
  getWeekTotals,
  getProjectsForDate,
  getProjectProgress,
  getProgressColor,
  formatCurrency,
  getTotalValue,
  eachDay,
  isWeekday,
  getISOWeek,
  getProcessCapacities,
} from "./calendarUtils";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ProcessAssignment = {
  id: string;
  processCode: string;
  processName: string;
  sortOrder?: number;
  required: boolean;
  estimatedHours?: number | null;
  isColorKey?: boolean;
  assignmentGroup?: string | null;
  assignedUser?: { id: string; name: string | null; email: string } | null;
};

export type ExtendedProject = Project & {
  processAssignments?: ProcessAssignment[];
  // Material tracking
  timberOrderedAt?: string | null;
  timberExpectedAt?: string | null;
  timberReceivedAt?: string | null;
  timberNotApplicable?: boolean;
  glassOrderedAt?: string | null;
  glassExpectedAt?: string | null;
  glassReceivedAt?: string | null;
  glassNotApplicable?: boolean;
  ironmongeryOrderedAt?: string | null;
  ironmongeryExpectedAt?: string | null;
  ironmongeryReceivedAt?: string | null;
  ironmongeryNotApplicable?: boolean;
  paintOrderedAt?: string | null;
  paintExpectedAt?: string | null;
  paintReceivedAt?: string | null;
  paintNotApplicable?: boolean;
};

export type CalendarWeekViewProps = {
  currentWeek: Date; // Any date in the week to display
  projects: ExtendedProject[];
  users: UserLite[];
  holidays: Holiday[];
  showValues: boolean;
  timelineViewFilter?: 'both' | 'manufacturing' | 'installation';
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onProjectClick?: (projectId: string) => void;
  onProjectDrop?: (projectId: string, date: Date) => void;
  onDragStart?: (projectId: string) => void;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getUserColor(userId: string, users: UserLite[]): string {
  const user = users.find((u) => u.id === userId);
  return user?.workshopColor || "#60a5fa"; // Default to blue
}

function getProjectColor(proj: ExtendedProject, users: UserLite[]): string {
  // Find the color key process (e.g., Assembly)
  const colorKeyAssignment = (proj.processAssignments || []).find((pa) => pa.isColorKey);

  // If there's a color key process with an assigned user, use that user's color
  if (colorKeyAssignment?.assignedUser) {
    return getUserColor(colorKeyAssignment.assignedUser.id, users);
  }

  // Fallback: use first assigned user's color
  const firstAssignment = (proj.processAssignments || []).find((pa) => pa.assignedUser);
  if (firstAssignment?.assignedUser) {
    return getUserColor(firstAssignment.assignedUser.id, users);
  }

  // No assignments: default blue
  return "#60a5fa";
}

type MaterialStatus = "not-applicable" | "not-ordered" | "ordered" | "received";

function getMaterialStatus(
  orderedAt?: string | null,
  receivedAt?: string | null,
  notApplicable?: boolean
): MaterialStatus {
  if (notApplicable) return "not-applicable";
  if (receivedAt) return "received";
  if (orderedAt) return "ordered";
  return "not-ordered";
}

function getMaterialColor(status: MaterialStatus): string {
  switch (status) {
    case "not-applicable":
      return "#6b7280"; // Grey
    case "received":
      return "#22c55e"; // Green
    case "ordered":
      return "#f59e0b"; // Amber
    case "not-ordered":
      return "#ef4444"; // Red
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CalendarWeekView({
  currentWeek,
  projects,
  users,
  holidays,
  showValues,
  timelineViewFilter = 'both',
  onPreviousWeek,
  onNextWeek,
  onToday,
  onProjectClick,
  onProjectDrop,
  onDragStart,
}: CalendarWeekViewProps) {
  const { start: weekStart, end: weekEnd } = getWeekBoundaries(currentWeek);
  const weekDays = eachDay(weekStart, weekEnd);
  const weekTotals = getWeekTotals(weekStart, weekEnd, users, holidays, projects);
  const weekValue = getTotalValue(weekStart, weekEnd, projects);
  const isoWeek = getISOWeek(weekStart);
  
  // Calculate per-process capacity
  const processCodes = ["MACHINING", "ASSEMBLY", "SANDING", "SPRAYING", "FINAL_ASSEMBLY", "GLAZING", "IRONMONGERY", "INSTALLATION"];
  const processCapacities = getProcessCapacities(weekStart, weekEnd, users, holidays, processCodes);

  // Group projects by row to avoid overlaps
  const projectRows: ExtendedProject[][] = [];
  projects.forEach((proj) => {
    if (!proj.startDate || !proj.deliveryDate) return;

    const projStart = new Date(proj.startDate);
    const projEnd = new Date(proj.deliveryDate);

    // Only show projects that overlap with current week
    if (projEnd < weekStart || projStart > weekEnd) return;

    // Find first row where this project doesn't overlap
    let rowIndex = 0;
    while (rowIndex < projectRows.length) {
      const hasOverlap = projectRows[rowIndex].some((existingProj) => {
        if (!existingProj.startDate || !existingProj.deliveryDate) return false;
        const existingStart = new Date(existingProj.startDate);
        const existingEnd = new Date(existingProj.deliveryDate);
        return !(projEnd < existingStart || projStart > existingEnd);
      });
      if (!hasOverlap) break;
      rowIndex++;
    }

    if (!projectRows[rowIndex]) projectRows[rowIndex] = [];
    projectRows[rowIndex].push(proj);
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (onProjectDrop) {
      // Extract project ID from drag data if needed
      onProjectDrop("", date); // Will need to be enhanced based on your drag implementation
    }
  };

  return (
    <div className="space-y-4">
      {/* Week Header with Navigation and Totals */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={onPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <h2 className="text-xl font-semibold">
              Week {isoWeek} - {weekStart.getFullYear()}
            </h2>
            <div className="text-sm text-muted-foreground">
              {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
              {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={onNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Week Totals Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Capacity</div>
            <div className="text-2xl font-bold text-blue-600">{weekTotals.capacity}h</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Demand</div>
            <div className="text-2xl font-bold text-purple-600">{weekTotals.demand}h</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Free</div>
            <div
              className={`text-2xl font-bold ${
                weekTotals.free < 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {weekTotals.free}h
            </div>
          </div>
          {weekTotals.holidayDays > 0 && (
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Holiday Days</div>
              <div className="text-2xl font-bold text-slate-600">{weekTotals.holidayDays}</div>
            </div>
          )}
          {showValues && (
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Week Value</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(weekValue)}</div>
            </div>
          )}
          {weekTotals.free < 0 && (
            <div className="col-span-full text-center">
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                ⚠️ Overbooked by {Math.abs(weekTotals.free)}h
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Process Capacity Breakdown */}
      <Card className=\"p-4\">
        <h3 className=\"font-semibold mb-3 text-sm\">Capacity by Process</h3>
        <div className=\"grid grid-cols-2 md:grid-cols-4 gap-3\">
          {Object.entries(processCapacities).map(([code, capacity]) => {
            const displayName = code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            return (
              <div key={code} className=\"p-2 bg-slate-50 rounded border\">
                <div className=\"text-xs text-muted-foreground\">{displayName}</div>
                <div className=\"text-lg font-bold text-blue-600\">{capacity}h</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Week Calendar Grid */}
      <div className=\"bg-white rounded-lg border overflow-hidden\">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-slate-50">
          {weekDays.map((day, idx) => {
            const isToday =
              day.getDate() === new Date().getDate() &&
              day.getMonth() === new Date().getMonth() &&
              day.getFullYear() === new Date().getFullYear();
            const isWeekdayDate = isWeekday(day);

            return (
              <div
                key={idx}
                className={`p-3 text-center border-r last:border-r-0 ${
                  isToday ? "bg-blue-50" : ""
                }`}
              >
                <div className="text-xs font-semibold text-slate-600">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div
                  className={`text-xl font-bold ${
                    isToday ? "text-blue-600" : isWeekdayDate ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {day.toLocaleDateString("en-US", { month: "short" })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day cells with project bars */}
        <div className="grid grid-cols-7 relative" style={{ minHeight: "400px" }}>
          {weekDays.map((day, idx) => {
            const isToday =
              day.getDate() === new Date().getDate() &&
              day.getMonth() === new Date().getMonth() &&
              day.getFullYear() === new Date().getFullYear();
            const isWeekendDay = !isWeekday(day);
            const projectsOnDay = getProjectsForDate(day, projects);

            return (
              <div
                key={idx}
                className={`min-h-[400px] border-r last:border-r-0 p-2 ${
                  isWeekendDay ? "bg-slate-100" : isToday ? "bg-blue-50" : "bg-white"
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                {/* Daily project count indicator */}
                {projectsOnDay.length > 0 && (
                  <div className="text-xs text-center text-muted-foreground mb-2">
                    {projectsOnDay.length} project{projectsOnDay.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            );
          })}

          {/* Project bars overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ paddingTop: "3rem", zIndex: 10 }}
          >
            {/* Manufacturing bars */}
            {(timelineViewFilter === 'both' || timelineViewFilter === 'manufacturing') && projectRows.map((row, rowIdx) => (
              <div
                key={`mfg-${rowIdx}`}
                style={{
                  position: "absolute",
                  top: `${rowIdx * 32 + 16}px`,
                  left: 0,
                  right: 0,
                  height: "28px",
                }}
              >
                {row.map((proj) => {
                  const projStart = new Date(proj.startDate!);
                  const projEnd = new Date(proj.deliveryDate!);

                  // Calculate visible start and end within the week
                  const visibleStart = projStart < weekStart ? weekStart : projStart;
                  const visibleEnd = projEnd > weekEnd ? weekEnd : projEnd;

                  // Calculate position
                  const daysSinceWeekStart = Math.floor(
                    (visibleStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const duration =
                    Math.floor(
                      (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24)
                    ) + 1;

                  const startCol = daysSinceWeekStart;
                  const progress = getProjectProgress(proj);
                  const projectColor = getProjectColor(proj, users);

                  // Get assigned users
                  const assignedUsers = (proj.processAssignments || [])
                    .filter((pa) => pa.assignedUser)
                    .map((pa) => pa.assignedUser!.name || pa.assignedUser!.email.split("@")[0])
                    .filter((name, idx, arr) => arr.indexOf(name) === idx);

                  const usersSummary =
                    assignedUsers.length > 0 ? ` | Assigned: ${assignedUsers.join(", ")}` : "";

                  // Create background with progress
                  const background = projectColor.startsWith("linear-gradient")
                    ? projectColor
                    : `linear-gradient(90deg, #22c55e ${progress}%, ${projectColor} ${progress}%)`;

                  // Material status
                  const timberStatus = getMaterialStatus(
                    proj.timberOrderedAt,
                    proj.timberReceivedAt,
                    proj.timberNotApplicable
                  );
                  const glassStatus = getMaterialStatus(
                    proj.glassOrderedAt,
                    proj.glassReceivedAt,
                    proj.glassNotApplicable
                  );
                  const ironmongeryStatus = getMaterialStatus(
                    proj.ironmongeryOrderedAt,
                    proj.ironmongeryReceivedAt,
                    proj.ironmongeryNotApplicable
                  );
                  const paintStatus = getMaterialStatus(
                    proj.paintOrderedAt,
                    proj.paintReceivedAt,
                    proj.paintNotApplicable
                  );

                  return (
                    <div
                      key={proj.id}
                      className="absolute rounded text-xs font-medium text-white cursor-pointer hover:opacity-90 pointer-events-auto flex items-stretch gap-1"
                      style={{
                        left: `${(startCol / 7) * 100}%`,
                        width: `${(duration / 7) * 100}%`,
                      }}
                      draggable
                      onDragStart={() => onDragStart?.(proj.id)}
                      onClick={() => onProjectClick?.(proj.id)}
                      title={`${proj.name} (${progress}% complete)${usersSummary}`}
                    >
                      {/* Material traffic lights */}
                      <div className="flex gap-0.5 shrink-0 items-center pl-1 pr-0.5 py-1 bg-white rounded-l">
                        <div className="flex flex-col items-center">
                          <div className="text-[8px] font-bold leading-none mb-0.5 text-gray-700">
                            T
                          </div>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getMaterialColor(timberStatus) }}
                            title="Timber"
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="text-[8px] font-bold leading-none mb-0.5 text-gray-700">
                            G
                          </div>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getMaterialColor(glassStatus) }}
                            title="Glass"
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="text-[8px] font-bold leading-none mb-0.5 text-gray-700">
                            I
                          </div>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getMaterialColor(ironmongeryStatus) }}
                            title="Ironmongery"
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="text-[8px] font-bold leading-none mb-0.5 text-gray-700">
                            P
                          </div>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getMaterialColor(paintStatus) }}
                            title="Paint"
                          />
                        </div>
                      </div>

                      {/* Project content with gradient */}
                      <div
                        className="flex items-center gap-1 px-2 py-1 flex-1 rounded-r"
                        style={{ background }}
                      >
                        <div className="truncate flex-1">{proj.name}</div>
                        {assignedUsers.length > 0 && (
                          <div className="text-[10px] opacity-90 truncate shrink-0">
                            👤 {assignedUsers.slice(0, 2).join(", ")}
                            {assignedUsers.length > 2 && ` +${assignedUsers.length - 2}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Installation bars - render below manufacturing bars */}
            {(timelineViewFilter === 'both' || timelineViewFilter === 'installation') && projectRows.map((row, rowIdx) => (
              <div
                key={`install-${rowIdx}`}
                style={{
                  position: "absolute",
                  top: `${rowIdx * 32 + 16}px`,
                  left: 0,
                  right: 0,
                  height: "28px",
                }}
              >
                {row.map((proj) => {
                  // Only render if project has installation dates
                  if (!proj.installationStartDate || !proj.installationEndDate) return null;

                  const installStart = new Date(proj.installationStartDate);
                  const installEnd = new Date(proj.installationEndDate);

                  // Only show if installation overlaps with current week
                  if (installEnd < weekStart || installStart > weekEnd) return null;

                  // Calculate visible start and end within the week
                  const visibleStart = installStart < weekStart ? weekStart : installStart;
                  const visibleEnd = installEnd > weekEnd ? weekEnd : installEnd;

                  // Calculate position
                  const daysSinceWeekStart = Math.floor(
                    (visibleStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const duration =
                    Math.floor(
                      (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24)
                    ) + 1;

                  const startCol = daysSinceWeekStart;

                  return (
                    <div
                      key={`install-${proj.id}`}
                      className="absolute rounded text-xs font-medium text-white cursor-pointer hover:opacity-90 pointer-events-auto"
                      style={{
                        left: `${(startCol / 7) * 100}%`,
                        width: `${(duration / 7) * 100}%`,
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                        border: '2px dashed rgba(255,255,255,0.5)',
                      }}
                      onClick={() => onProjectClick?.(proj.id)}
                      title={`${proj.name} - Installation`}
                    >
                      <div className="flex items-center gap-1 px-2 py-1">
                        <span className="text-[10px]">🔧</span>
                        <div className="truncate flex-1">{proj.name} - Install</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects List */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">
          Projects This Week ({projects.filter((p) => p.startDate && p.deliveryDate && new Date(p.deliveryDate!) >= weekStart && new Date(p.startDate!) <= weekEnd).length})
        </h3>
        <div className="space-y-2">
          {projects
            .filter((p) => {
              if (!p.startDate || !p.deliveryDate) return false;
              const pStart = new Date(p.startDate);
              const pEnd = new Date(p.deliveryDate);
              return pEnd >= weekStart && pStart <= weekEnd;
            })
            .map((proj) => {
              const progress = getProjectProgress(proj);
              return (
                <div
                  key={proj.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-slate-50 cursor-pointer"
                  onClick={() => onProjectClick?.(proj.id)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{proj.name}</div>
                    <div className="text-sm text-muted-foreground">
                      <div>
                        <span className="text-xs text-slate-500">Manufacturing:</span>{" "}
                        {proj.startDate &&
                          new Date(proj.startDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                        -{" "}
                        {proj.deliveryDate &&
                          new Date(proj.deliveryDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                      </div>
                      {(proj.installationStartDate || proj.installationEndDate) && (
                        <div className="mt-1">
                          <span className="text-xs text-slate-500">Installation:</span>{" "}
                          {proj.installationStartDate &&
                            new Date(proj.installationStartDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}{" "}
                          -{" "}
                          {proj.installationEndDate &&
                            new Date(proj.installationEndDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {showValues && proj.valueGBP && (
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(Number(proj.valueGBP))}
                      </div>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded ${getProgressColor(progress)}`}
                    >
                      {progress}%
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}
