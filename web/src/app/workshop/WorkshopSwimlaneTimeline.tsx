"use client";

import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
 * - Right side is a horizontally scrollable time axis by weeks, aligned to the same
 *   visible weeks as the month calendar view for consistency.
 * - Each project row shows its process plans positioned in the appropriate week column.
 */
export default function WorkshopSwimlaneTimeline({ projects, users, visibleWeeks, onProjectClick }: WorkshopSwimlaneTimelineProps) {
  const weekNums = useMemo(() => visibleWeeks.map((w) => w.weekNum), [visibleWeeks]);

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
        {projects.map((proj) => (
          <div
            key={proj.id}
            className="grid items-stretch border-b last:border-b-0"
            style={{ gridTemplateColumns: `260px repeat(${visibleWeeks.length}, minmax(120px, 1fr))` }}
          >
            {/* Sticky left project info */}
            <div className="sticky left-0 z-10 bg-white/95 backdrop-blur px-3 py-2 border-r flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate" title={proj.name}>{proj.name}</div>
                {(proj.startDate || proj.deliveryDate) && (
                  <div className="text-[11px] text-slate-500 truncate">
                    {proj.startDate ? new Date(proj.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?"}
                    {" → "}
                    {proj.deliveryDate ? new Date(proj.deliveryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?"}
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

            {/* Week columns - render process plan badges in the appropriate week */}
            {visibleWeeks.map((w) => {
              const plans = (proj.processPlans || []).filter((p) => Number(p.plannedWeek) === w.weekNum);
              return (
                <div key={`${proj.id}-w${w.weekNum}`} className="relative border-r last:border-r-0 px-2 py-2">
                  {/* Grid background line for subtle guidance */}
                  <div className="absolute inset-0 pointer-events-none border-slate-100" />

                  {/* Plans in this week */}
                  <div className="flex flex-wrap gap-1 items-start">
                    {plans.map((p) => {
                      const assignedName = p.assignedUser?.name || "Unassigned";
                      // Try color by assigned user (from users list); fallback to neutral
                      const userClr = p.assignedUser?.id ? getUserColor(p.assignedUser.id, users) : "#64748b"; // slate-500
                      const bg = userClr;
                      return (
                        <div
                          key={p.id}
                          className="group relative cursor-pointer"
                          onClick={() => onProjectClick?.(proj.id)}
                          title={`${proj.name} • ${formatProcess(String(p.process))}\n${weekLabel(w).range}\nAssigned: ${assignedName}`}
                        >
                          <div
                            className="text-[11px] text-white px-2 py-1 rounded shadow-sm"
                            style={{ backgroundColor: bg }}
                          >
                            {formatProcess(String(p.process))}
                          </div>
                          {/* Simple tooltip */}
                          <div className="absolute z-20 hidden group-hover:block left-0 mt-1 min-w-[220px]">
                            <Card className="p-2 shadow-lg text-xs">
                              <div className="font-medium truncate" title={proj.name}>{proj.name}</div>
                              <div className="text-slate-600">{formatProcess(String(p.process))}</div>
                              <div className="text-slate-500">{weekLabel(w).range}</div>
                              <div className="text-slate-500">👤 {assignedName}</div>
                            </Card>
                          </div>
                        </div>
                      );
                    })}
                    {plans.length === 0 && (
                      <div className="h-6" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
