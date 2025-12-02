"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Check, X, Download, Calendar, Users, ChevronLeft, ChevronRight } from "lucide-react";

type Timesheet = {
  id: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalHours: number;
  status: string;
  signedOffAt: string | null;
  notes: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    workshopColor?: string;
  };
  signedOffBy?: {
    id: string;
    name: string;
    email: string;
  };
};

type User = {
  id: string;
  name: string;
  email: string;
};

type TimeEntry = {
  id: string;
  process: string;
  hours: number;
  notes: string | null;
  project: { id: string; title: string } | null;
};

type UserActivity = {
  user: { id: string; name: string; email: string; workshopColor: string | null };
  days: Record<string, TimeEntry[]>;
};

export default function TimesheetsPage() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Team activity state
  const [activityLoading, setActivityLoading] = useState(false);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [activityFrom, setActivityFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  });
  const [activityTo, setActivityTo] = useState<Date>(new Date());

  async function loadTimesheets() {
    setLoading(true);
    try {
  const params = new URLSearchParams();
      if (filterUser !== "all") params.append("userId", filterUser);
      if (filterStatus !== "all") params.append("status", filterStatus);
  // Ask API to backfill missing timesheets from recent time entries
  params.append("generate", "1");

      const data = await apiFetch<{ ok: boolean; items: Timesheet[] }>(
        `/timesheets?${params.toString()}`
      );

      if (data.ok) {
        setTimesheets(data.items);
      }
    } catch (e: any) {
      console.error("Failed to load timesheets:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await apiFetch<{ ok: boolean; items: User[] }>("/auth/users");
      if (data.ok) {
        setUsers(data.items);
      }
    } catch (e: any) {
      console.error("Failed to load users:", e);
    }
  }

  async function signOff(timesheetId: string) {
    const confirmed = confirm("Sign off this timesheet?");
    if (!confirmed) return;

    try {
      const data = await apiFetch<{ ok: boolean }>(
        `/timesheets/${timesheetId}/sign-off`,
        { method: "POST" }
      );

      if (data.ok) {
        loadTimesheets();
      }
    } catch (e: any) {
      alert("Failed to sign off: " + (e?.message || "Unknown error"));
    }
  }

  async function reject(timesheetId: string) {
    const notes = prompt("Reason for rejection:");
    if (!notes) return;

    try {
      const data = await apiFetch<{ ok: boolean }>(
        `/timesheets/${timesheetId}/reject`,
        { method: "POST", json: { notes } }
      );

      if (data.ok) {
        loadTimesheets();
      }
    } catch (e: any) {
      alert("Failed to reject: " + (e?.message || "Unknown error"));
    }
  }

  async function exportPayroll() {
    try {
      window.open("/api/timesheets/export/payroll", "_blank");
    } catch (e: any) {
      alert("Failed to export: " + (e?.message || "Unknown error"));
    }
  }

  async function loadTeamActivity() {
    setActivityLoading(true);
    try {
      const fromStr = activityFrom.toISOString().split("T")[0];
      const toStr = activityTo.toISOString().split("T")[0];
      const res = await apiFetch<{ users: UserActivity[] }>(
        `/workshop/team-activity?from=${fromStr}&to=${toStr}`
      );
      setUserActivity(res.users || []);
    } catch (e) {
      console.error("Failed to load team activity:", e);
    } finally {
      setActivityLoading(false);
    }
  }

  function shiftWeek(direction: number) {
    const days = 7 * direction;
    setActivityFrom((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
    setActivityTo((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  }

  function goToToday() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    setActivityFrom(weekStart);
    setActivityTo(today);
  }

  useEffect(() => {
    loadTimesheets();
    loadUsers();
  }, [filterUser, filterStatus]);

  useEffect(() => {
    if (activeTab === "activity" || activeTab === "overview") {
      loadTeamActivity();
    }
  }, [activeTab, activityFrom, activityTo]);

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function formatActivityDate(d: Date) {
    const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
    return d.toLocaleDateString("en-GB", options);
  }

  function isToday(d: Date) {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }

  function getTotalHoursForDay(entries: TimeEntry[]) {
    return entries.reduce((sum, e) => sum + e.hours, 0);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "signed_off":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Signed Off</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  // Generate date range for activity view
  const dateRange: Date[] = [];
  const current = new Date(activityFrom);
  while (current <= activityTo) {
    dateRange.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="w-8 h-8" />
            Timesheets & Team Activity
          </h1>
          <p className="text-muted-foreground mt-1">
            Review workshop hours, sign off timesheets, and monitor team activity
          </p>
        </div>
        {activeTab === "timesheets" && (
          <Button onClick={exportPayroll} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Payroll CSV
          </Button>
        )}
        {(activeTab === "activity" || activeTab === "overview") && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Users className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="timesheets">
            <Clock className="w-4 h-4 mr-2" />
            Timesheets
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Users className="w-4 h-4 mr-2" />
            Team Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="text-sm text-muted-foreground flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4" />
            {formatActivityDate(activityFrom)} – {formatActivityDate(activityTo)}
          </div>

          {activityLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading overview...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border p-3 bg-muted text-left font-semibold sticky left-0 bg-muted z-10">
                      PERSON
                    </th>
                    {dateRange.map((date) => {
                      const dayName = date.toLocaleDateString("en-GB", { weekday: "short" });
                      const dayDate = date.getDate();
                      return (
                        <th
                          key={date.toISOString()}
                          className={`border border-border p-3 text-center font-semibold min-w-[80px] ${
                            isToday(date) ? "bg-primary/10" : "bg-muted"
                          }`}
                        >
                          <div className="text-xs">{dayName.charAt(0)}</div>
                          <div className="text-sm">{dayDate}</div>
                        </th>
                      );
                    })}
                    <th className="border border-border p-3 bg-muted text-right font-semibold sticky right-0 bg-muted z-10">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {userActivity.map((ua) => {
                    const userTotal = Object.values(ua.days).reduce(
                      (sum, entries) => sum + getTotalHoursForDay(entries),
                      0
                    );

                    return (
                      <tr key={ua.user.id} className="hover:bg-muted/50">
                        <td className="border border-border p-3 sticky left-0 bg-background z-10">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: ua.user.workshopColor || "#6b7280" }}
                            >
                              {(ua.user.name || ua.user.email)[0].toUpperCase()}
                            </div>
                            <span className="font-medium">{ua.user.name || ua.user.email}</span>
                          </div>
                        </td>
                        {dateRange.map((date) => {
                          const dateKey = date.toISOString().split("T")[0];
                          const entries = ua.days[dateKey] || [];
                          const dayHours = getTotalHoursForDay(entries);

                          // Color code based on hours (similar to Timedock)
                          const getColorClass = (hours: number) => {
                            if (hours === 0) return "bg-background";
                            if (hours < 4) return "bg-green-100 text-green-900";
                            if (hours < 8) return "bg-green-200 text-green-900";
                            if (hours <= 9) return "bg-green-300 text-green-900";
                            if (hours > 9) return "bg-red-200 text-red-900"; // Overtime
                            return "bg-gray-100";
                          };

                          return (
                            <td
                              key={dateKey}
                              className={`border border-border p-3 text-center font-semibold ${getColorClass(
                                dayHours
                              )} ${isToday(date) ? "ring-2 ring-primary ring-inset" : ""}`}
                            >
                              {dayHours > 0 ? dayHours.toFixed(1) : ""}
                            </td>
                          );
                        })}
                        <td className="border border-border p-3 text-right font-bold sticky right-0 bg-background z-10">
                          {userTotal.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted font-bold">
                    <td className="border border-border p-3 sticky left-0 bg-muted z-10">TOTAL</td>
                    {dateRange.map((date) => {
                      const dateKey = date.toISOString().split("T")[0];
                      const dayTotal = userActivity.reduce((sum, ua) => {
                        const entries = ua.days[dateKey] || [];
                        return sum + getTotalHoursForDay(entries);
                      }, 0);

                      return (
                        <td
                          key={dateKey}
                          className={`border border-border p-3 text-center ${
                            isToday(date) ? "bg-primary/10" : ""
                          }`}
                        >
                          {dayTotal > 0 ? dayTotal.toFixed(1) : ""}
                        </td>
                      );
                    })}
                    <td className="border border-border p-3 text-right sticky right-0 bg-muted z-10">
                      {userActivity
                        .reduce((sum, ua) => {
                          return (
                            sum +
                            Object.values(ua.days).reduce(
                              (daySum, entries) => daySum + getTotalHoursForDay(entries),
                              0
                            )
                          );
                        }, 0)
                        .toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="timesheets" className="space-y-6 mt-6">

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filter by User</label>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Filter by Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="signed_off">Signed Off</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={loadTimesheets}>Refresh</Button>
          </div>
        </div>
      </Card>

      {/* Timesheets List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading timesheets...</div>
      ) : timesheets.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">No timesheets found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Timesheets are automatically created when users log workshop hours
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {timesheets.map((ts) => (
            <Card key={ts.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: ts.user.workshopColor || "#3b82f6" }}
                  >
                    {(ts.user.name || ts.user.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{ts.user.name || ts.user.email}</h3>
                    <p className="text-sm text-muted-foreground">
                      Week: {formatDate(ts.weekStartDate)} - {formatDate(ts.weekEndDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(ts.status)}
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">{ts.totalHours}h</div>
                    <div className="text-xs text-muted-foreground">Total Hours</div>
                  </div>
                </div>
              </div>

              {ts.signedOffBy && (
                <div className="text-sm text-muted-foreground mb-4">
                  Signed off by {ts.signedOffBy.name} on {formatDate(ts.signedOffAt!)}
                </div>
              )}

              {ts.notes && (
                <div className="text-sm bg-slate-50 p-3 rounded mb-4">
                  <strong>Notes:</strong> {ts.notes}
                </div>
              )}

              {ts.status === "pending" && (
                <div className="flex gap-2">
                  <Button onClick={() => signOff(ts.id)} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Check className="w-4 h-4 mr-2" />
                    Sign Off
                  </Button>
                  <Button onClick={() => reject(ts.id)} size="sm" variant="outline">
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6 mt-6">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {formatActivityDate(activityFrom)} – {formatActivityDate(activityTo)}
          </div>

          {activityLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading team activity...</div>
          ) : (
            <div className="space-y-4">
              {userActivity.map((ua) => {
                const totalHours = Object.values(ua.days).reduce(
                  (sum, entries) => sum + getTotalHoursForDay(entries),
                  0
                );

                return (
                  <Card key={ua.user.id}>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: ua.user.workshopColor || "#6b7280" }}
                          />
                          <div>
                            <h3 className="text-lg font-semibold">{ua.user.name || ua.user.email}</h3>
                            <p className="text-sm text-muted-foreground">{ua.user.email}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-sm">
                          <Clock className="h-3 w-3 mr-1" />
                          {totalHours.toFixed(1)}h total
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {dateRange.map((date) => {
                          const dateKey = date.toISOString().split("T")[0];
                          const entries = ua.days[dateKey] || [];
                          const dayHours = getTotalHoursForDay(entries);

                          if (entries.length === 0) return null;

                          return (
                            <div
                              key={dateKey}
                              className={`border rounded-lg p-3 ${
                                isToday(date) ? "border-primary bg-primary/5" : "border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium text-sm">{formatActivityDate(date)}</div>
                                <Badge variant="outline" className="text-xs">
                                  {dayHours.toFixed(1)}h
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                {entries.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="flex items-start gap-2 text-sm bg-background/50 rounded p-2"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium">
                                        {entry.project ? (
                                          <span className="text-primary">{entry.project.title}</span>
                                        ) : (
                                          <span className="text-muted-foreground capitalize">
                                            {entry.process.toLowerCase().replace(/_/g, " ")}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {entry.process.replace(/_/g, " ")}
                                        {entry.notes && ` • ${entry.notes}`}
                                      </div>
                                    </div>
                                    <Badge variant="secondary" className="text-xs shrink-0">
                                      {entry.hours}h
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {dateRange.every((d) => !ua.days[d.toISOString().split("T")[0]]) && (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            No logged time in this period
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
