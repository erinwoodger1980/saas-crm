"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface TimeEntry {
  id: string;
  hours: number;
  date: string;
  notes: string | null;
  process: string;
  project: {
    id: string;
    name: string;
    number: string | null;
  } | null;
}

interface DayTotal {
  [dateKey: string]: number;
}

interface ProjectHours {
  projectId: string | null;
  projectName: string;
  process: string;
  dayHours: DayTotal;
  total: number;
}

interface MyTimesheetViewProps {
  userId: string;
  userName: string;
}

function getWeekDates(weekStart: Date) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function MyTimesheetView({ userId, userName }: MyTimesheetViewProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days, else go to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  useEffect(() => {
    loadTimeEntries();
  }, [weekStart, userId]);

  async function loadTimeEntries() {
    setLoading(true);
    try {
      const fromStr = weekStart.toISOString().split("T")[0];
      const toStr = weekEnd.toISOString().split("T")[0];
      const response = await apiFetch<{ entries: TimeEntry[] }>(
        `/workshop/my-timesheet?userId=${userId}&from=${fromStr}&to=${toStr}`
      );
      setTimeEntries(response.entries || []);
    } catch (e) {
      console.error("Failed to load timesheet:", e);
      setTimeEntries([]);
    } finally {
      setLoading(false);
    }
  }

  function shiftWeek(direction: number) {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + direction * 7);
    setWeekStart(newStart);
  }

  function goToThisWeek() {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setWeekStart(monday);
  }

  // Group entries by project and process
  const projectHoursMap = new Map<string, ProjectHours>();
  
  timeEntries.forEach(entry => {
    const key = `${entry.project?.id || 'unassigned'}_${entry.process}`;
    
    if (!projectHoursMap.has(key)) {
      projectHoursMap.set(key, {
        projectId: entry.project?.id || null,
        projectName: entry.project 
          ? `${entry.project.number ? entry.project.number + ' - ' : ''}${entry.project.name}`
          : 'Non-assigned hours',
        process: entry.process,
        dayHours: {},
        total: 0,
      });
    }

    const projectHours = projectHoursMap.get(key)!;
    const dateKey = entry.date;
    projectHours.dayHours[dateKey] = (projectHours.dayHours[dateKey] || 0) + entry.hours;
    projectHours.total += entry.hours;
  });

  const projectHoursList = Array.from(projectHoursMap.values());
  
  // Calculate day totals
  const dayTotals: DayTotal = {};
  projectHoursList.forEach(ph => {
    Object.entries(ph.dayHours).forEach(([date, hours]) => {
      dayTotals[date] = (dayTotals[date] || 0) + hours;
    });
  });

  const weekTotal = Object.values(dayTotals).reduce((sum, h) => sum + h, 0);

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftWeek(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">
                {formatDate(weekStart)} – {formatDate(weekEnd)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => shiftWeek(1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToThisWeek}
            >
              This Week
            </Button>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">
              {weekTotal.toFixed(1)} HOURS
            </div>
          </div>
        </div>

        <div>
          <div className="font-semibold text-lg">{userName}</div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-semibold border-b">DESCRIPTION / JOB NAME</th>
              {weekDates.map((date) => (
                <th key={date.toISOString()} className="text-center p-3 font-semibold border-b w-20">
                  {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </th>
              ))}
              <th className="text-right p-3 font-semibold border-b w-24">TOTAL ↓</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center p-8 text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : projectHoursList.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center p-8 text-muted-foreground">
                  No hours logged this week
                </td>
              </tr>
            ) : (
              <>
                {projectHoursList.map((ph, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-medium">{ph.projectName}</div>
                      <div className="text-sm text-muted-foreground italic">- {ph.process.toLowerCase().replace(/_/g, ' ')}</div>
                    </td>
                    {weekDates.map((date) => {
                      const dateKey = getDateKey(date);
                      const hours = ph.dayHours[dateKey];
                      return (
                        <td
                          key={date.toISOString()}
                          className={`text-center p-3 ${hours ? 'bg-green-50 font-medium' : ''}`}
                        >
                          {hours ? hours.toFixed(1) : ''}
                        </td>
                      );
                    })}
                    <td className="text-right p-3 font-semibold">
                      {ph.total.toFixed(1)}
                    </td>
                  </tr>
                ))}
                <tr className="border-b">
                  <td className="p-3 font-medium">Non-assigned hours</td>
                  {weekDates.map((date) => (
                    <td key={date.toISOString()} className="text-center p-3">
                      0
                    </td>
                  ))}
                  <td className="text-right p-3 font-semibold">0</td>
                </tr>
                <tr className="bg-slate-100 font-bold">
                  <td className="p-3">TOTAL</td>
                  {weekDates.map((date) => {
                    const dateKey = getDateKey(date);
                    const total = dayTotals[dateKey];
                    return (
                      <td key={date.toISOString()} className="text-center p-3">
                        {total ? total.toFixed(1) : ''}
                      </td>
                    );
                  })}
                  <td className="text-right p-3">{weekTotal.toFixed(1)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
