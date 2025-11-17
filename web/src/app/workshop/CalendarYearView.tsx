"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type Project,
  type UserLite,
  type Holiday,
  getMonthTotals,
  getMonthBoundaries,
  getTotalValue,
  formatCurrency,
  getProjectsForDate,
} from "./calendarUtils";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type CalendarYearViewProps = {
  currentYear: number;
  projects: Project[];
  users: UserLite[];
  holidays: Holiday[];
  showValues: boolean;
  onPreviousYear: () => void;
  onNextYear: () => void;
  onToday: () => void;
  onMonthClick?: (year: number, month: number) => void;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDaysInMonth(year: number, month: number): (Date | null)[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  // Convert to Monday-start (0=Monday, 6=Sunday)
  const mondayBasedOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const days: (Date | null)[] = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < mondayBasedOffset; i++) {
    days.push(null);
  }

  // Add actual days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month - 1, day));
  }

  return days;
}

/**
 * Calculate demand intensity for a month (0-1 scale)
 * Based on the ratio of demand to capacity
 */
function getMonthIntensity(
  year: number,
  month: number,
  users: UserLite[],
  holidays: Holiday[],
  projects: Project[]
): number {
  const totals = getMonthTotals(year, month, users, holidays, projects);
  if (totals.capacity === 0) return 0;
  const ratio = totals.demand / totals.capacity;
  return Math.min(ratio, 1.5); // Cap at 150% for color scale
}

/**
 * Get background color intensity based on demand/capacity ratio
 */
function getIntensityColor(intensity: number): string {
  if (intensity === 0) return "bg-slate-50";
  if (intensity < 0.5) return "bg-green-100";
  if (intensity < 0.75) return "bg-yellow-100";
  if (intensity < 1.0) return "bg-orange-100";
  if (intensity < 1.25) return "bg-red-100";
  return "bg-red-200"; // Over 125% capacity
}

/**
 * Get project count for a specific day
 */
function getDayProjectCount(date: Date, projects: Project[]): number {
  return getProjectsForDate(date, projects).length;
}

/**
 * Get color intensity for day based on project count
 */
function getDayColor(count: number): string {
  if (count === 0) return "";
  if (count === 1) return "bg-blue-100";
  if (count === 2) return "bg-blue-200";
  if (count === 3) return "bg-blue-300";
  return "bg-blue-400"; // 4+ projects
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CalendarYearView({
  currentYear,
  projects,
  users,
  holidays,
  showValues,
  onPreviousYear,
  onNextYear,
  onToday,
  onMonthClick,
}: CalendarYearViewProps) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Calculate year totals
  const yearTotals = months.reduce(
    (acc, month) => {
      const monthTotals = getMonthTotals(currentYear, month, users, holidays, projects);
      const { start, end } = getMonthBoundaries(currentYear, month);
      const monthValue = getTotalValue(start, end, projects);

      return {
        capacity: acc.capacity + monthTotals.capacity,
        demand: acc.demand + monthTotals.demand,
        free: acc.free + monthTotals.free,
        value: acc.value + monthValue,
      };
    },
    { capacity: 0, demand: 0, free: 0, value: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Year Header with Navigation and Totals */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="sm" onClick={onPreviousYear}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <h2 className="text-2xl font-bold">{currentYear}</h2>
            <div className="text-sm text-muted-foreground">Full Year Overview</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={onNextYear}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Year Totals Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Annual Capacity</div>
            <div className="text-2xl font-bold text-blue-600">{yearTotals.capacity}h</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Annual Demand</div>
            <div className="text-2xl font-bold text-purple-600">{yearTotals.demand}h</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">Annual Free</div>
            <div
              className={`text-2xl font-bold ${
                yearTotals.free < 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {yearTotals.free}h
            </div>
          </div>
          {showValues && (
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Annual Value</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(yearTotals.value)}
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Month Grid - 3x4 layout */}
        <div className="lg:col-span-3">
          <div className="grid md:grid-cols-3 gap-4">
            {months.map((month) => {
              const monthName = new Date(currentYear, month - 1, 1).toLocaleDateString("en-US", {
                month: "long",
              });
              const days = getDaysInMonth(currentYear, month);
              const monthTotals = getMonthTotals(currentYear, month, users, holidays, projects);
              const { start, end } = getMonthBoundaries(currentYear, month);
              const monthValue = getTotalValue(start, end, projects);
              const intensity = getMonthIntensity(currentYear, month, users, holidays, projects);
              const intensityColor = getIntensityColor(intensity);

              const isCurrentMonth =
                currentYear === new Date().getFullYear() && month === new Date().getMonth() + 1;

              return (
                <Card
                  key={month}
                  className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
                    isCurrentMonth ? "ring-2 ring-blue-500" : ""
                  }`}
                  onClick={() => onMonthClick?.(currentYear, month)}
                >
                  {/* Month header */}
                  <div className="text-center mb-2">
                    <h3 className="font-semibold text-sm">{monthName}</h3>
                  </div>

                  {/* Mini calendar grid */}
                  <div className="grid grid-cols-7 gap-0.5 mb-2">
                    {/* Day headers */}
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => (
                      <div key={idx} className="text-[8px] text-center text-muted-foreground">
                        {day}
                      </div>
                    ))}

                    {/* Days */}
                    {days.map((date, idx) => {
                      if (!date) {
                        return <div key={`empty-${idx}`} className="aspect-square" />;
                      }

                      const projectCount = getDayProjectCount(date, projects);
                      const dayColor = getDayColor(projectCount);
                      const isToday =
                        date.getDate() === new Date().getDate() &&
                        date.getMonth() === new Date().getMonth() &&
                        date.getFullYear() === new Date().getFullYear();

                      return (
                        <div
                          key={idx}
                          className={`aspect-square text-[8px] flex items-center justify-center rounded ${dayColor} ${
                            isToday ? "ring-1 ring-blue-500 font-bold" : ""
                          }`}
                          title={
                            projectCount > 0
                              ? `${projectCount} project${projectCount !== 1 ? "s" : ""}`
                              : undefined
                          }
                        >
                          {date.getDate()}
                        </div>
                      );
                    })}
                  </div>

                  {/* Month stats */}
                  <div className={`text-[10px] p-2 rounded ${intensityColor}`}>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Cap:</span>
                      <span className="font-semibold">{monthTotals.capacity}h</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Demand:</span>
                      <span className="font-semibold">{monthTotals.demand}h</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted-foreground">Free:</span>
                      <span
                        className={`font-semibold ${
                          monthTotals.free < 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {monthTotals.free}h
                      </span>
                    </div>
                    {showValues && (
                      <div className="flex justify-between pt-1 border-t border-slate-200">
                        <span className="text-muted-foreground">Value:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(monthValue)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Intensity indicator */}
                  {monthTotals.free < 0 && (
                    <div className="mt-2 text-center">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                        Overbooked
                      </span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Monthly Totals Sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-4 sticky top-4">
            <h3 className="font-semibold mb-3">Monthly Breakdown</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {months.map((month) => {
                const monthName = new Date(currentYear, month - 1, 1).toLocaleDateString("en-US", {
                  month: "short",
                });
                const monthTotals = getMonthTotals(currentYear, month, users, holidays, projects);
                const { start, end } = getMonthBoundaries(currentYear, month);
                const monthValue = getTotalValue(start, end, projects);

                const isCurrentMonth =
                  currentYear === new Date().getFullYear() && month === new Date().getMonth() + 1;

                return (
                  <div
                    key={month}
                    className={`p-2 border rounded text-xs cursor-pointer hover:bg-slate-50 ${
                      isCurrentMonth ? "bg-blue-50 border-blue-300" : ""
                    }`}
                    onClick={() => onMonthClick?.(currentYear, month)}
                  >
                    <div className="font-semibold mb-1">{monthName}</div>
                    <div className="space-y-0.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span>{monthTotals.capacity}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Demand:</span>
                        <span>{monthTotals.demand}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Free:</span>
                        <span
                          className={monthTotals.free < 0 ? "text-red-600 font-semibold" : ""}
                        >
                          {monthTotals.free}h
                        </span>
                      </div>
                      {showValues && (
                        <div className="flex justify-between pt-0.5 border-t border-slate-200">
                          <span className="text-muted-foreground">Value:</span>
                          <span className="text-green-600 font-semibold">
                            {formatCurrency(monthValue)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Legend */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Legend</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium mb-2">Day Intensity (Project Count)</div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-slate-50 border" />
                <span>0</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-blue-100" />
                <span>1</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-blue-200" />
                <span>2</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-blue-300" />
                <span>3</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-blue-400" />
                <span>4+</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Month Capacity Load</div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-green-100" />
                <span>&lt;50%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-yellow-100" />
                <span>50-75%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-orange-100" />
                <span>75-100%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-red-100" />
                <span>100-125%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded bg-red-200" />
                <span>&gt;125%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
