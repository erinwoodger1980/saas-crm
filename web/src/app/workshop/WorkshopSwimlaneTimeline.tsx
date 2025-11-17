"use client";

import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  buildProcessScheduleForProject,
  getWeekCellChunks,
  getProjectProcessLegend,
  type Process,
  type ScheduledSegment,
  type WeekCellChunk,
} from "./swimlaneScheduling";

// Reuse the same types shape used by the workshop page via structural typing
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

export type UserLite = { id: string; name: string | null; email: string; workshopColor?: string | null };

export type Plan = {
  id: string;
  process: WorkshopProcess | string; // be lenient if backend adds more
  plannedWeek: number; // 1..weeks for current view
  assignedUser: { id: string; name: string | null } | null;
  notes?: string | null;
};

export type ProcessAssignment = {
  id: string;
  processCode: string; // e.g. MACHINING
  processName: string;
  sortOrder?: number;
  required: boolean;
  estimatedHours?: number | null;
  isColorKey?: boolean;
  assignmentGroup?: string | null;
  assignedUser?: { id: string; name: string | null; email: string } | null;
};

export type Project = {
  id: string;
  name: string;
  startDate?: string | null; // ISO
  deliveryDate?: string | null; // ISO
  valueGBP?: number | string | null;
  processPlans: Plan[];
  processAssignments?: ProcessAssignment[];
};

export type VisibleWeek = { weekNum: number; isoWeek: number; startDate: Date; endDate: Date };

export function formatProcess(p: string) {
  return p.replace(/_/g, " ");
}

function getUserColor(userId: string, users: UserLite[]): string {
  const user = users.find((u) => u.id === userId);
  return user?.workshopColor || "#60a5fa"; // Tailwind blue-400 as default
}

function weekLabel(w: VisibleWeek) {
  const range = `${w.startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${w.endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  return { title: `W${w.isoWeek}`, range };
}

export type WorkshopSwimlaneTimelineProps = {
  projects: Project[];
  users: UserLite[];
  visibleWeeks: VisibleWeek[]; // from parent calendar helpers to align granularity
  onProjectClick?: (projectId: string) => void;
};

/**
 * WorkshopSwimlaneTimeline
 * - Renders a vertical list of projects (rows) with a sticky left info column
 * - Right side is a horizontally scrollable time axis by weeks
 * - Shows visual process bars distributed across the project timeline based on estimated hours
 */
export default function WorkshopSwimlaneTimeline({ projects, users, visibleWeeks, onProjectClick }: WorkshopSwimlaneTimelineProps) {
  const weekNums = useMemo(() => visibleWeeks.map((w) => w.weekNum), [visibleWeeks]);

  // Pre-compute schedules for all projects
  const projectSchedules = useMemo(() => {
    const schedules = new Map<string, ScheduledSegment[]>();
    
    projects.forEach((proj) => {
      if (!proj.startDate || !proj.deliveryDate || !proj.processAssignments) {
        schedules.set(proj.id, []);
        return;
      }

      const processes: Process[] = proj.processAssignments.map((pa) => ({
        id: pa.id,
        processCode: pa.processCode,
        processName: pa.processName,
        estimatedHours: pa.estimatedHours,
        sortOrder: pa.sortOrder,
      }));

      const schedule = buildProcessScheduleForProject(
        new Date(proj.startDate),
        new Date(proj.deliveryDate),
        processes
      );

      schedules.set(proj.id, schedule);
    });

    return schedules;
  }, [projects]);

  return (
    <div className="bg-white rounded-lg border">
      {/* Header grid with sticky left label column */}
      <div className="grid" style={{ gridTemplateColumns: `260px repeat(${visibleWeeks.length}, minmax(120px, 1fr))` }}>
        {/* Left spacer (sticky header label) */}
        <div className="sticky left-0 z-10 bg-white border-b px-3 py-2 text-xs font-semibold text-slate-600">
          Project
        </div>
        {visibleWeeks.map((w) => {
          const { title, range } = weekLabel(w);
          return (
            <div key={w.weekNum} className="border-b px-2 py-2 text-center text-xs font-semibold text-slate-600">
              <div>{title}</div>
              <div className="text-[10px] text-slate-500">{range}</div>
            </div>
          );
        })}
      </div>

      {/* Rows */}
      <div className="max-h-[70vh] overflow-y-auto">
        {projects.map((proj) => {
          const schedule = projectSchedules.get(proj.id) || [];
          const legend = getProjectProcessLegend(schedule);
          const hasSchedule = schedule.length > 0;

          return (
            <div key={proj.id} className="border-b last:border-b-0">
              {/* Main row grid */}
              <div
                className="grid items-stretch"
                style={{ gridTemplateColumns: `260px repeat(${visibleWeeks.length}, minmax(120px, 1fr))` }}
              >
                {/* Sticky left project info */}
                <div className="sticky left-0 z-10 bg-white/95 backdrop-blur px-3 py-3 border-r flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate" title={proj.name}>
                        {proj.name}
                      </div>
                      {(proj.startDate || proj.deliveryDate) && (
                        <div className="text-[11px] text-slate-500 truncate">
                          {proj.startDate
                            ? new Date(proj.startDate).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })
                            : "?"}
                          {" → "}
                          {proj.deliveryDate
                            ? new Date(proj.deliveryDate).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                              })
                            : "?"}
                        </div>
                      )}
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:underline shrink-0"
                      onClick={() => onProjectClick?.(proj.id)}
                    >
                      Details
                    </button>
                  </div>

                  {/* Process legend for this project */}
                  {legend.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {legend.map((item) => (
                        <div
                          key={item.processCode}
                          className="flex items-center gap-1 text-[10px]"
                          title={`${item.processName}: ${item.totalHours}h`}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-slate-600 truncate max-w-[60px]">
                            {item.processName.split("_")[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Week columns - render visual process bars */}
                {visibleWeeks.map((w) => {
                  const chunks = hasSchedule
                    ? getWeekCellChunks(schedule, w.startDate, w.endDate)
                    : [];
                  const totalHours = chunks.reduce((sum, c) => sum + c.hours, 0);
                  const hasWork = chunks.length > 0;

                  return (
                    <div
                      key={`${proj.id}-w${w.weekNum}`}
                      className="relative border-r last:border-r-0 px-2 py-3 flex items-center"
                    >
                      {hasWork ? (
                        <div className="w-full group relative">
                          {/* Visual bar showing process distribution */}
                          <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden shadow-sm">
                            <div className="flex h-full">
                              {chunks.map((chunk) => (
                                <div
                                  key={chunk.processId}
                                  className="h-full transition-opacity hover:opacity-80"
                                  style={{
                                    flex: chunk.proportionOfWeek,
                                    backgroundColor: chunk.color,
                                  }}
                                  title={`${chunk.processName}: ${chunk.hours}h`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Hover tooltip showing details */}
                          <div className="absolute z-20 hidden group-hover:block left-0 top-full mt-1 min-w-[200px]">
                            <Card className="p-2 shadow-lg">
                              <div className="text-xs font-medium mb-1">
                                {weekLabel(w).range}
                              </div>
                              <div className="space-y-1">
                                {chunks.map((chunk) => (
                                  <div
                                    key={chunk.processId}
                                    className="flex items-center gap-2 text-[11px]"
                                  >
                                    <div
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: chunk.color }}
                                    />
                                    <span className="text-slate-700 truncate flex-1">
                                      {chunk.processName}
                                    </span>
                                    <span className="text-slate-500 shrink-0">
                                      {chunk.hours}h
                                    </span>
                                  </div>
                                ))}
                                <div className="pt-1 mt-1 border-t border-slate-200 flex justify-between text-[11px] font-medium">
                                  <span>Total:</span>
                                  <span>{Math.round(totalHours * 10) / 10}h</span>
                                </div>
                              </div>
                            </Card>
                          </div>
                        </div>
                      ) : (
                        // Empty state for weeks with no work
                        <div className="w-full h-4 rounded-full border border-dashed border-slate-200 bg-slate-50" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
