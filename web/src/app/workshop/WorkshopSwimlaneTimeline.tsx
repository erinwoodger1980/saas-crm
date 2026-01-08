"use client";

import React, { useMemo, useState } from "react";
import { useState as useAsyncState } from "react";
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
  completedAt?: string | null;
};

export type Project = {
  id: string;
  name: string;
  number?: string | null;
  description?: string | null;
  startDate?: string | null; // ISO
  deliveryDate?: string | null; // ISO
  valueGBP?: number | string | null;
  processPlans: Plan[];
  processAssignments?: ProcessAssignment[];
  // Optional analytics/progress fields (if provided by parent)
  expectedHours?: number | string | null;
  actualHours?: number | string | null;
  totalHoursByProcess?: Record<string, number>;
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

  // UI state: expanded legends per project and open week details popover
  const [legendExpanded, setLegendExpanded] = useState<Record<string, boolean>>({});
  const [openCell, setOpenCell] = useState<{ projectId: string; weekNum: number } | null>(null);

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
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header grid with sticky left label column */}
      <div className="grid bg-slate-50 border-b-2 border-slate-200" style={{ gridTemplateColumns: `260px repeat(${visibleWeeks.length}, minmax(120px, 1fr))` }}>
        {/* Left spacer (sticky header label) */}
        <div className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
          Project
        </div>
        {visibleWeeks.map((w) => {
          const { title, range } = weekLabel(w);
          return (
            <div key={w.weekNum} className="border-r border-slate-200 last:border-r-0 px-2 py-2 text-center">
              <div className="text-xs font-bold text-slate-700">{title}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">{range}</div>
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
                <div className="sticky left-0 z-10 bg-white border-r flex flex-col gap-2 px-3 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate leading-tight" title={(proj.description || proj.name) + (proj.number ? ` - ${proj.number}` : '')}>
                        {(proj.description || proj.name) + (proj.number ? ` - ${proj.number}` : '')}
                      </div>
                      {(proj.startDate || proj.deliveryDate) && (
                        <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                          <div>
                            <span className="text-[10px] text-slate-500">Mfg:</span>{" "}
                            {proj.startDate
                              ? new Date(proj.startDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "?"}
                            <span className="text-slate-400 mx-1">→</span>
                            {proj.deliveryDate
                              ? new Date(proj.deliveryDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "?"}
                          </div>
                          {(proj.installationStartDate || proj.installationEndDate) && (
                            <div className="mt-0.5">
                              <span className="text-[10px] text-slate-500">Install:</span>{" "}
                              {proj.installationStartDate
                                ? new Date(proj.installationStartDate).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                  })
                                : "?"}
                              <span className="text-slate-400 mx-1">→</span>
                              {proj.installationEndDate
                                ? new Date(proj.installationEndDate).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                  })
                                : "?"}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Progress indicator (hours + processes) */}
                      {(() => {
                        const expected = Number((proj as any).expectedHours ?? (proj as any).totalProjectHours ?? 0) || 0;
                        const actual = Number((proj as any).actualHours ?? 0) || 0;
                        const pct = expected > 0 ? Math.max(0, Math.min(1, actual / expected)) : 0;

                        // Process completion (based on hours logged vs estimate if available)
                        const totalPA = (proj.processAssignments || []).filter((pa) => (pa.estimatedHours || 0) > 0).length;
                        let donePA = 0;
                        if ((proj as any).totalHoursByProcess) {
                          const totals = (proj as any).totalHoursByProcess as Record<string, number>;
                          for (const pa of (proj.processAssignments || [])) {
                            const est = Number(pa.estimatedHours || 0);
                            if (est <= 0) continue;
                            const logged = Number(totals[pa.processCode] || 0);
                            if (logged >= est * 0.99) donePA++;
                          }
                        }

                        const showProgress = expected > 0 || totalPA > 0;
                        if (!showProgress) return null;
                        return (
                          <div className="mt-2">
                            <div className="h-2 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-sky-500"
                                style={{ width: `${pct * 100}%` }}
                              />
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                              <span>
                                {expected > 0 ? `${Math.round(pct * 100)}% · ${Math.round(actual)}h / ${Math.round(expected)}h` : null}
                              </span>
                              {totalPA > 0 ? (
                                <span>{donePA}/{totalPA} processes</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline shrink-0 font-medium"
                      onClick={() => onProjectClick?.(proj.id)}
                    >
                      Details
                    </button>
                  </div>

                  {/* Process legend for this project */}
                  {legend.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(legendExpanded[proj.id] ? legend : legend.slice(0, 5)).map((item) => {
                        // Find the matching process assignment for completion status
                        const pa = (proj.processAssignments || []).find((p) => p.processCode === item.processCode);
                        const isComplete = !!pa?.completedAt;
                        const [loading, setLoading] = useAsyncState(false);
                        const handleTick = async () => {
                          if (!pa || isComplete || loading) return;
                          setLoading(true);
                          try {
                            await fetch(`/api/workshop/process-assignment/${pa.id}/complete`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                            });
                            // Optionally, trigger a refresh or update state
                            window.location.reload();
                          } catch (e) {}
                          setLoading(false);
                        };
                        return (
                          <div
                            key={item.processCode}
                            className="flex items-center gap-1 text-[10px] bg-slate-50 rounded px-1.5 py-0.5 border border-slate-200"
                            title={`${item.processName}: ${item.totalHours}h`}
                          >
                            <button
                              className={`w-3 h-3 rounded border flex items-center justify-center mr-1 ${isComplete ? 'bg-emerald-400 border-emerald-600' : 'bg-white border-slate-300'} transition-all`}
                              style={{ minWidth: '18px' }}
                              disabled={!pa || isComplete || loading}
                              onClick={handleTick}
                              title={isComplete ? 'Completed' : (!pa ? 'Unavailable' : 'Mark as complete')}
                            >
                              {isComplete ? (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6.5l2 2 4-4" stroke="#065f46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              ) : null}
                            </button>
                            <div
                              className="w-2.5 h-2.5 rounded-sm border border-white shadow-sm shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-slate-700 font-medium truncate max-w-[70px]">
                              {item.processName.replace(/_/g, ' ').split(' ')[0]}
                            </span>
                          </div>
                        );
                      })}
                      {legend.length > 5 && (
                        <button
                          className="text-[10px] px-2 py-0.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                          onClick={() => setLegendExpanded((prev) => ({ ...prev, [proj.id]: !prev[proj.id] }))}
                        >
                          {legendExpanded[proj.id] ? "Show less" : `+${legend.length - 5} more`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Installation timeline indicator */}
                  {(proj.installationStartDate || proj.installationEndDate) && (
                    <div className="mt-1 text-[10px] text-purple-600 font-medium flex items-center gap-1">
                      <span>🔧</span>
                      <span>Install:</span>
                      {proj.installationStartDate && (
                        <span>{new Date(proj.installationStartDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      )}
                      <span>→</span>
                      {proj.installationEndDate && (
                        <span>{new Date(proj.installationEndDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      )}
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
                      className="relative border-r last:border-r-0 px-2 py-3 flex items-center min-h-[56px]"
                    >
                      {hasWork ? (
                        <div className="w-full group relative">
                          {/* Visual bar showing process distribution */}
                          <div className="h-6 w-full rounded-md bg-slate-100 overflow-hidden shadow-sm border border-slate-200 hover:border-slate-300 transition-all">
                            <div className="flex h-full">
                              {chunks.map((chunk) => (
                                <div
                                  key={chunk.processId}
                                  className="h-full transition-all hover:brightness-110 cursor-pointer"
                                  style={{
                                    flex: chunk.proportionOfWeek,
                                    backgroundColor: chunk.color,
                                    minWidth: '2px',
                                  }}
                                  title={`${chunk.processName}: ${chunk.hours}h`}
                                  onClick={() => setOpenCell((c) => (c && c.projectId === proj.id && c.weekNum === w.weekNum ? null : { projectId: proj.id, weekNum: w.weekNum }))}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Details popover (hover or click) */}
                          <div className={`absolute z-[60] ${openCell && openCell.projectId === proj.id && openCell.weekNum === w.weekNum ? 'block' : 'hidden group-hover:block'} left-1/2 -translate-x-1/2 top-full mt-2`}
                               onMouseLeave={() => setOpenCell((c) => (c && c.projectId === proj.id && c.weekNum === w.weekNum ? null : c))}>
                            <div className="bg-white border-2 border-slate-200 rounded-lg shadow-xl p-3 min-w-[240px] pointer-events-auto">
                              <div className="text-xs font-semibold mb-2 text-slate-700 border-b pb-1">
                                {weekLabel(w).range}
                              </div>
                              <div className="space-y-1.5">
                                {chunks.map((chunk) => (
                                  <div
                                    key={chunk.processId}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <div
                                      className="w-3 h-3 rounded shrink-0 border border-white shadow-sm"
                                      style={{ backgroundColor: chunk.color }}
                                    />
                                    <span className="text-slate-800 flex-1 font-medium">
                                      {chunk.processName.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-slate-600 shrink-0 font-semibold">
                                      {Math.round(chunk.hours * 10) / 10}h
                                    </span>
                                  </div>
                                ))}
                                <div className="pt-1.5 mt-1.5 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-900">
                                  <span>Total:</span>
                                  <span>{Math.round(totalHours * 10) / 10}h</span>
                                </div>
                              </div>
                              {/* Pointer arrow */}
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l-2 border-t-2 border-slate-200 rotate-45" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Empty state for weeks with no work
                        <div className="w-full h-6 rounded-md border border-dashed border-slate-300 bg-slate-50/50" />
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
