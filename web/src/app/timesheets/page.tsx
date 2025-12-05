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
import { Clock, Check, X, Download, Calendar, Users, ChevronLeft, ChevronRight, Upload } from "lucide-react";

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
  user: { id: string; name: string; email: string; workshopColor: string | null; profilePictureUrl?: string | null };
  days: Record<string, TimeEntry[]>;
  hasActiveTimer?: boolean;
};

type Project = {
  id: string;
  name: string;
  startDate: string | null;
  deliveryDate: string | null;
  wonAt: string | null;
  totalHours: number;
  status: string;
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
    // Get Monday of current week
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days, else go to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [activityTo, setActivityTo] = useState<Date>(() => {
    // Get Sunday of current week
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 0 : 7 - day; // If Sunday, stay, else go to Sunday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + diff);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTimers, setActiveTimers] = useState<Record<string, boolean>>({});

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<any>(null);

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
      // Use workshop-safe roster endpoint
      const data = await apiFetch<{ ok: boolean; items: User[] }>("/workshop/users");
      if (data.ok) {
        setUsers(data.items);
      }
    } catch (e: any) {
      console.error("Failed to load users:", e);
      // Fallback: keep users empty but prevent UI crash
      setUsers([]);
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

  async function uploadProfilePicture(userId: string, file: File) {
    try {
      // Convert to data URL for simplicity
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        await apiFetch(`/workshop/users/${userId}/profile-picture`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profilePictureUrl: dataUrl }),
        });
        // Reload activity to show new picture
        await loadTeamActivity();
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      alert("Failed to upload: " + (e?.message || "Unknown error"));
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
      
      // Load active timers
      try {
        const timersRes = await apiFetch<{ timers: Array<{ userId: string }> }>("/workshop/timers/active");
        const timersMap: Record<string, boolean> = {};
        (timersRes.timers || []).forEach((t) => {
          timersMap[t.userId] = true;
        });
        setActiveTimers(timersMap);
      } catch (e) {
        console.error("Failed to load active timers:", e);
      }
    } catch (e) {
      console.error("Failed to load team activity:", e);
      // Fallback: build empty activity rows for all users
      try {
        const roster = await apiFetch<{ ok: boolean; items: User[] }>("/workshop/users");
        const empty: UserActivity[] = (roster.items || []).map((u) => ({
          user: {
            id: u.id,
            name: u.name,
            email: u.email,
            workshopColor: (u as any).workshopColor || null,
            profilePictureUrl: (u as any).profilePictureUrl || null,
          },
          hasActiveTimer: false,
          days: {},
        }));
        setUserActivity(empty);
      } catch (e2) {
        console.error("Failed to load user roster fallback:", e2);
      }
    } finally {
      setActivityLoading(false);
    }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    try {
      const res = await apiFetch<{ projects: Project[] }>("/workshop/projects");
      setProjects(res.projects || []);
    } catch (e) {
      console.error("Failed to load projects:", e);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadProjectDetail(projectId: string) {
    setProjectsLoading(true);
    try {
      const res = await apiFetch<any>(`/workshop/projects/${projectId}`);
      setProjectDetail(res);
      setSelectedProjectId(projectId);
    } catch (e) {
      console.error("Failed to load project detail:", e);
    } finally {
      setProjectsLoading(false);
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
    // Get Monday of current week
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    
    // Get Sunday of current week
    const diffToSunday = day === 0 ? 0 : 7 - day;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + diffToSunday);
    sunday.setHours(23, 59, 59, 999);
    
    setActivityFrom(monday);
    setActivityTo(sunday);
  }

  useEffect(() => {
    loadTimesheets();
    loadUsers();
  }, [filterUser, filterStatus]);

  useEffect(() => {
    // Always load overview activity within timesheets view
    loadTeamActivity();
    if (activeTab === "projects") {
      loadProjects();
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

  // Group entries by project/job for user detail view
  function groupEntriesByProject(days: Record<string, TimeEntry[]>) {
    const projectMap = new Map<string, { name: string; process: string; entries: Record<string, number> }>();
    
    Object.entries(days).forEach(([dateKey, entries]) => {
      entries.forEach((entry) => {
        const projectId = entry.project?.id || `process_${entry.process}`;
        const projectName = entry.project?.title || entry.process.replace(/_/g, " ");
        
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            name: projectName,
            process: entry.process,
            entries: {},
          });
        }
        
        const project = projectMap.get(projectId)!;
        project.entries[dateKey] = (project.entries[dateKey] || 0) + entry.hours;
      });
    });
    
    return Array.from(projectMap.values());
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
    <div className="p-8 space-y-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl text-white">
              <Clock className="w-7 h-7" />
            </div>
            Timesheets & Team Activity
          </h1>
          <p className="text-slate-600 mt-2 text-sm">
            Review workshop hours, sign off timesheets, and monitor team activity
          </p>
        </div>
        {activeTab === "overview" && (
          <Button onClick={exportPayroll} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Payroll CSV
          </Button>
        )}
        {activeTab === "overview" && (
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
        <TabsList className="bg-white/80 border border-indigo-200/70 shadow-sm rounded-xl p-1">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="team-activity" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-blue-500 data-[state=active]:text-white">
            <Clock className="w-4 h-4 mr-2" />
            Team Activity
          </TabsTrigger>
          <TabsTrigger value="projects" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
            <Calendar className="w-4 h-4 mr-2" />
            Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {selectedUserId && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedUserId(null)} 
              className="mb-4 bg-white/80 border-indigo-200/70 shadow-sm hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-500 hover:text-white transition-all"
            >
              ← Back to Overview
            </Button>
          )}
          
          <div className="text-sm text-muted-foreground flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4" />
            {formatActivityDate(activityFrom)} – {formatActivityDate(activityTo)}
          </div>

          {activityLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading overview...</div>
          ) : selectedUserId ? (
            // User Detail View (Screenshot 1 style)
            (() => {
              const selectedUser = userActivity.find((ua) => ua.user.id === selectedUserId);
              if (!selectedUser) return <div>User not found</div>;

              const projects = groupEntriesByProject(selectedUser.days);
              const userTotal = Object.values(selectedUser.days).reduce(
                (sum, entries) => sum + getTotalHoursForDay(entries),
                0
              );

              return (
                <div className="space-y-4">
                  {/* User header */}
                  <Card className="p-6 bg-white/80 border-indigo-200/70 shadow-lg rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        {selectedUser.user.profilePictureUrl ? (
                          <img
                            src={selectedUser.user.profilePictureUrl}
                            alt={selectedUser.user.name || selectedUser.user.email}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-2xl font-bold"
                            style={{ backgroundColor: selectedUser.user.workshopColor || "#6b7280" }}
                          >
                            {(selectedUser.user.name || selectedUser.user.email)[0].toUpperCase()}
                          </div>
                        )}
                        {selectedUser.hasActiveTimer && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" title="Timer running" />
                        )}
                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                          <Upload className="w-6 h-6 text-white" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadProfilePicture(selectedUser.user.id, file);
                            }}
                          />
                        </label>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{selectedUser.user.name || selectedUser.user.email}</h2>
                        <p className="text-muted-foreground">{selectedUser.user.email}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-3xl font-bold text-blue-600">{userTotal.toFixed(1)} HOURS</div>
                      </div>
                    </div>
                  </Card>

                  {/* Projects/Jobs grid */}
                  <div className="overflow-x-auto bg-white/80 rounded-xl shadow-lg border border-indigo-200/70 backdrop-blur-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-border p-3 bg-muted text-left font-semibold sticky left-0 bg-muted z-10 min-w-[200px]">
                            DESCRIPTION / JOB NAME
                          </th>
                          {dateRange.map((date) => {
                            const dayName = date.toLocaleDateString("en-GB", { weekday: "short" });
                            return (
                              <th
                                key={date.toISOString()}
                                className={`border border-border p-3 text-center font-semibold min-w-[80px] ${
                                  isToday(date) ? "bg-primary/10" : "bg-muted"
                                }`}
                              >
                                <div className="text-xs">{dayName.charAt(0)}</div>
                              </th>
                            );
                          })}
                          <th className="border border-border p-3 bg-muted text-right font-semibold sticky right-0 bg-muted z-10">
                            TOTAL ↓
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((project, idx) => {
                          const projectTotal = Object.values(project.entries).reduce((sum, h) => sum + h, 0);

                          return (
                            <tr key={idx} className="hover:bg-muted/50">
                              <td className="border border-border p-3 sticky left-0 bg-background z-10">
                                <div className="font-medium">{project.name}</div>
                                <div className="text-xs text-muted-foreground italic">
                                  - {project.process.toLowerCase().replace(/_/g, " ")}
                                </div>
                              </td>
                              {dateRange.map((date) => {
                                const dateKey = date.toISOString().split("T")[0];
                                const hours = project.entries[dateKey] || 0;

                                const getColorClass = (hours: number) => {
                                  if (hours === 0) return "bg-background";
                                  if (hours < 3) return "bg-green-100 text-green-900";
                                  if (hours < 6) return "bg-green-200 text-green-900";
                                  if (hours <= 9) return "bg-green-300 text-green-900";
                                  return "bg-green-400 text-green-900";
                                };

                                return (
                                  <td
                                    key={dateKey}
                                    className={`border border-border p-3 text-center font-semibold ${getColorClass(
                                      hours
                                    )} ${isToday(date) ? "ring-2 ring-primary ring-inset" : ""}`}
                                  >
                                    {hours > 0 ? hours.toFixed(1) : ""}
                                  </td>
                                );
                              })}
                              <td className="border border-border p-3 text-right font-bold sticky right-0 bg-background z-10">
                                {projectTotal.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                        
                        {/* Non-assigned hours row */}
                        <tr className="bg-muted/30">
                          <td className="border border-border p-3 sticky left-0 bg-muted/30 z-10 font-medium">
                            Non-assigned hours
                          </td>
                          {dateRange.map((date) => {
                            const dateKey = date.toISOString().split("T")[0];
                            return (
                              <td key={dateKey} className="border border-border p-3 text-center">
                                0
                              </td>
                            );
                          })}
                          <td className="border border-border p-3 text-right sticky right-0 bg-muted/30 z-10">
                            0
                          </td>
                        </tr>

                        {/* Total row */}
                        <tr className="bg-muted font-bold">
                          <td className="border border-border p-3 sticky left-0 bg-muted z-10">TOTAL</td>
                          {dateRange.map((date) => {
                            const dateKey = date.toISOString().split("T")[0];
                            const dayTotal = projects.reduce((sum, p) => sum + (p.entries[dateKey] || 0), 0);

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
                            {userTotal.toFixed(1)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
          ) : (
            // Overview Grid (Screenshot 4 style)
            (
            <div className="overflow-x-auto bg-white/80 rounded-xl shadow-lg border border-indigo-200/70 backdrop-blur-sm">
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
                      <tr key={ua.user.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedUserId(ua.user.id)}>
                        <td className="border border-border p-3 sticky left-0 bg-background z-10">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              {ua.user.profilePictureUrl ? (
                                <img
                                  src={ua.user.profilePictureUrl}
                                  alt={ua.user.name || ua.user.email}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                  style={{ backgroundColor: ua.user.workshopColor || "#6b7280" }}
                                >
                                  {(ua.user.name || ua.user.email)[0].toUpperCase()}
                                </div>
                              )}
                              {ua.hasActiveTimer && (
                                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" title="Timer running" />
                              )}
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
            )
          )}
        </TabsContent>

        <TabsContent value="team-activity" className="space-y-6 mt-6">
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

        <TabsContent value="projects" className="space-y-6 mt-6">
          {selectedProjectId && projectDetail && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedProjectId(null);
                setProjectDetail(null);
              }}
              className="mb-4"
            >
              ← Back to Projects
            </Button>
          )}

          {projectsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading projects...</div>
          ) : selectedProjectId && projectDetail ? (
            // Project Detail View (Screenshot 3 style)
            <div className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{projectDetail.project.name}</h2>
                    <p className="text-muted-foreground">
                      {projectDetail.project.startDate &&
                        new Date(projectDetail.project.startDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                      -{" "}
                      {projectDetail.project.deliveryDate &&
                        new Date(projectDetail.project.deliveryDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">
                      {projectDetail.project.totalHours.toFixed(1)} HOURS
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="space-y-4">
                  {projectDetail.breakdown.map((item: any) => (
                    <div key={item.user.id} className="border-b border-border pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                            style={{ backgroundColor: item.user.workshopColor || "#6b7280" }}
                          >
                            {item.user.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-lg">{item.user.name}</div>
                            <div className="text-sm text-muted-foreground">{item.user.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-blue-600">{item.total.toFixed(1)}h</div>
                        </div>
                      </div>
                      <div className="ml-14 space-y-1">
                        {item.processes.map((proc: any) => (
                          <div
                            key={proc.process}
                            className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2"
                          >
                            <div className="text-muted-foreground italic">
                              - {proc.process.toLowerCase().replace(/_/g, " ")}
                            </div>
                            <div className="font-medium">{proc.hours.toFixed(1)}h</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {projectDetail.breakdown.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No time entries logged yet
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            // Projects List View
            (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold bg-muted">NAME</th>
                    <th className="text-center p-3 font-semibold bg-muted">STARTED</th>
                    <th className="text-center p-3 font-semibold bg-muted">FINISHED</th>
                    <th className="text-right p-3 font-semibold bg-muted">HRS</th>
                    <th className="text-center p-3 font-semibold bg-muted">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const formatProjectDate = (dateStr: string | null) => {
                      if (!dateStr) return "-";
                      return new Date(dateStr).toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      });
                    };

                    return (
                      <tr
                        key={project.id}
                        className="border-b border-border hover:bg-muted/50 cursor-pointer"
                        onClick={() => loadProjectDetail(project.id)}
                      >
                        <td className="p-3">
                          <div className="font-medium text-primary">{project.name}</div>
                        </td>
                        <td className="p-3 text-center text-sm">
                          {formatProjectDate(project.startDate)}
                        </td>
                        <td className="p-3 text-center text-sm">
                          {project.deliveryDate ? formatProjectDate(project.deliveryDate) : (
                            <span className="text-muted-foreground">Close This Job</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-semibold text-blue-600">
                          {project.totalHours.toFixed(1)}
                        </td>
                        <td className="p-3 text-center">
                          {project.status === "completed" ? (
                            <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-muted-foreground">
                        No active projects found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )
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
