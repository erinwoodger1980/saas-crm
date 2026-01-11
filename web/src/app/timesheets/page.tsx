"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useCurrentUser } from "@/lib/use-current-user";
import { Clock, Check, X, Download, Calendar, Users, ChevronLeft, ChevronRight, Upload, Edit, Trash2, Plus } from "lucide-react";

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
    firstName?: string | null;
    lastName?: string | null;
    emailFooter?: string | null;
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
  firstName?: string | null;
  lastName?: string | null;
  emailFooter?: string | null;
};

type TimeEntry = {
  id: string;
  process: string;
  hours: number;
  notes: string | null;
  project: { id: string; title: string } | null;
  startedAt?: string | null;
  endedAt?: string | null;
};

type UserActivity = {
  user: {
    id: string;
    name: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    emailFooter?: string | null;
    workshopColor: string | null;
    profilePictureUrl?: string | null;
  };
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

export function TimesheetsManagement({ redirectAdminsToSettings = false }: { redirectAdminsToSettings?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useCurrentUser();
  const canAmendTime = ["owner", "admin"].includes(String(currentUser?.role || "").toLowerCase());

  function toLocalDateTimeInputValue(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function fromLocalDateTimeInputValue(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  useEffect(() => {
    if (redirectAdminsToSettings && canAmendTime) {
      router.replace("/settings/holidays?tab=time-tracking");
    }
  }, [redirectAdminsToSettings, canAmendTime, router]);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [signOffDialog, setSignOffDialog] = useState<{ open: boolean; timesheetId: string | null }>({
    open: false,
    timesheetId: null,
  });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; timesheetId: string | null; notes: string }>({
    open: false,
    timesheetId: null,
    notes: "",
  });

  const [editEntryDialog, setEditEntryDialog] = useState<{
    open: boolean;
    entryId: string | null;
    userId: string | null;
    userLabel: string;
    dateKey: string;
    projectTitle: string | null;
    process: string;
    hours: string;
    notes: string;
    startedAt: string;
    endedAt: string;
  }>({
    open: false,
    entryId: null,
    userId: null,
    userLabel: "",
    dateKey: "",
    projectTitle: null,
    process: "",
    hours: "",
    notes: "",
    startedAt: "",
    endedAt: "",
  });

  const [deleteEntryDialog, setDeleteEntryDialog] = useState<{
    open: boolean;
    entryId: string | null;
    userLabel: string;
    dateKey: string;
    projectTitle: string | null;
    process: string;
    hours: number | null;
  }>({
    open: false,
    entryId: null,
    userLabel: "",
    dateKey: "",
    projectTitle: null,
    process: "",
    hours: null,
  });

  const [addHoursDialog, setAddHoursDialog] = useState<{
    open: boolean;
    userId: string | null;
    userLabel: string;
    dateKey: string;
    projectId: string;
    process: string;
    hours: string;
    notes: string;
    startedAt: string;
    endedAt: string;
  }>({
    open: false,
    userId: null,
    userLabel: "",
    dateKey: "",
    projectId: "",
    process: "ADMIN",
    hours: "",
    notes: "",
    startedAt: "",
    endedAt: "",
  });

  // Team activity state
  const [activityLoading, setActivityLoading] = useState(false);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [activeTimers, setActiveTimers] = useState<Record<string, boolean>>({});
  const [showAddUserPicker, setShowAddUserPicker] = useState(false);
  const [selectedUserForAdd, setSelectedUserForAdd] = useState<{ id: string; name: string } | null>(null);
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

  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<any>(null);
  const [addHoursProjectSearch, setAddHoursProjectSearch] = useState("");
  const [showCompletedProjects, setShowCompletedProjects] = useState(false);

  function getUserDisplayName(user: { name?: string | null; email?: string | null; firstName?: string | null; lastName?: string | null; emailFooter?: string | null }) {
    const footer = user.emailFooter?.trim();
    if (footer) return footer;
    const first = user.firstName?.trim();
    const last = user.lastName?.trim();
    if (first || last) return [first, last].filter(Boolean).join(" ");
    if (user.name?.trim()) return user.name;
    if (user.email?.trim()) return user.email.split("@")[0];
    return "Unnamed";
  }

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

  function signOff(timesheetId: string) {
    setSignOffDialog({ open: true, timesheetId });
  }

  async function confirmSignOff() {
    const timesheetId = signOffDialog.timesheetId;
    if (!timesheetId) return;

    try {
      const data = await apiFetch<{ ok: boolean }>(`/timesheets/${timesheetId}/sign-off`, { method: "POST" });
      if (data.ok) {
        toast({ title: "Timesheet signed off" });
        setSignOffDialog({ open: false, timesheetId: null });
        loadTimesheets();
      }
    } catch (e: any) {
      toast({ title: "Failed to sign off", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  function reject(timesheetId: string) {
    setRejectDialog({ open: true, timesheetId, notes: "" });
  }

  async function confirmReject() {
    const timesheetId = rejectDialog.timesheetId;
    const notes = (rejectDialog.notes || "").trim();
    if (!timesheetId) return;
    if (!notes) {
      toast({ title: "Reason required", description: "Enter a reason for rejection.", variant: "destructive" });
      return;
    }

    try {
      const data = await apiFetch<{ ok: boolean }>(`/timesheets/${timesheetId}/reject`, {
        method: "POST",
        json: { notes },
      });

      if (data.ok) {
        toast({ title: "Timesheet rejected" });
        setRejectDialog({ open: false, timesheetId: null, notes: "" });
        loadTimesheets();
      }
    } catch (e: any) {
      toast({ title: "Failed to reject", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  async function exportPayroll() {
    try {
      window.open("/api/timesheets/export/payroll", "_blank");
    } catch (e: any) {
      toast({ title: "Failed to export", description: e?.message || "Unknown error", variant: "destructive" });
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
      toast({ title: "Failed to upload", description: e?.message || "Unknown error", variant: "destructive" });
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

  function formatHours(decimalHours: number): string {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    if (hours === 0 && minutes === 0) return "0m";
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  function openEditEntryDialog(userId: string, userLabel: string, dateKey: string, entry: TimeEntry) {
    setEditEntryDialog({
      open: true,
      entryId: entry.id,
      userId,
      userLabel,
      dateKey,
      projectTitle: entry.project?.title ?? null,
      process: entry.process,
      hours: String(entry.hours ?? ""),
      notes: entry.notes ?? "",
      startedAt: entry.startedAt ? toLocalDateTimeInputValue(entry.startedAt) : "",
      endedAt: entry.endedAt ? toLocalDateTimeInputValue(entry.endedAt) : "",
    });
  }

  function openDeleteEntryDialog(userLabel: string, dateKey: string, entry: TimeEntry) {
    setDeleteEntryDialog({
      open: true,
      entryId: entry.id,
      userLabel,
      dateKey,
      projectTitle: entry.project?.title ?? null,
      process: entry.process,
      hours: typeof entry.hours === "number" ? entry.hours : null,
    });
  }

  async function confirmEditEntry() {
    if (!editEntryDialog.entryId) return;
    const hoursNum = Number(editEntryDialog.hours);
    if (!Number.isFinite(hoursNum)) {
      toast({ title: "Invalid hours", description: "Enter a valid number.", variant: "destructive" });
      return;
    }

    const startedAtIso = editEntryDialog.startedAt ? fromLocalDateTimeInputValue(editEntryDialog.startedAt) : null;
    const endedAtIso = editEntryDialog.endedAt ? fromLocalDateTimeInputValue(editEntryDialog.endedAt) : null;
    if (editEntryDialog.startedAt && !startedAtIso) {
      toast({ title: "Invalid start time", description: "Enter a valid start date/time.", variant: "destructive" });
      return;
    }
    if (editEntryDialog.endedAt && !endedAtIso) {
      toast({ title: "Invalid end time", description: "Enter a valid end date/time.", variant: "destructive" });
      return;
    }
    if (startedAtIso && endedAtIso && new Date(endedAtIso) < new Date(startedAtIso)) {
      toast({ title: "Invalid time range", description: "End time must be after start time.", variant: "destructive" });
      return;
    }

    try {
      await apiFetch<{ ok: boolean; entry: any }>(`/workshop/time/${editEntryDialog.entryId}`, {
        method: "PATCH",
        json: {
          hours: hoursNum,
          notes: editEntryDialog.notes?.trim() ? editEntryDialog.notes.trim() : null,
        },
            startedAt: startedAtIso,
            endedAt: endedAtIso,
      });

      toast({ title: "Time entry updated" });
      setEditEntryDialog({ open: false, entryId: null, userId: null, userLabel: "", dateKey: "", projectTitle: null, process: "", hours: "", notes: "", startedAt: "", endedAt: "" });
      await loadTeamActivity();
      await loadTimesheets();
    } catch (e: any) {
      toast({ title: "Failed to update entry", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  async function confirmDeleteEntry() {
    if (!deleteEntryDialog.entryId) return;

    try {
      await apiFetch<{ ok: boolean }>(`/workshop/time/${deleteEntryDialog.entryId}`, {
        method: "DELETE",
      });

      toast({ title: "Time entry deleted" });
      setDeleteEntryDialog({
        open: false,
        entryId: null,
        userLabel: "",
        dateKey: "",
        projectTitle: null,
        process: "",
        hours: null,
      });
      await loadTeamActivity();
      await loadTimesheets();
    } catch (e: any) {
      toast({
        title: "Failed to delete entry",
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function openAddHoursDialog(userId: string, userLabel: string, dateKey: string) {
    if (projects.length === 0 && !projectsLoading) {
      // Lazy-load projects so the admin can optionally attach to a job
      loadProjects();
    }
    setAddHoursProjectSearch("");
    setAddHoursDialog({
      open: true,
      userId,
      userLabel,
      dateKey,
      projectId: "",
      process: "ADMIN",
      hours: "",
      notes: "",
      startedAt: "",
      endedAt: "",
    });
  }

  async function confirmAddHours() {
    if (!addHoursDialog.userId) return;
    const hoursNum = Number(addHoursDialog.hours);
    if (!Number.isFinite(hoursNum)) {
      toast({ title: "Invalid hours", description: "Enter a valid number.", variant: "destructive" });
      return;
    }
    if (!addHoursDialog.dateKey) {
      toast({ title: "Invalid date", description: "Choose a date.", variant: "destructive" });
      return;
    }
    if (!addHoursDialog.process?.trim()) {
      toast({ title: "Invalid process", description: "Enter a process code.", variant: "destructive" });
      return;
    }

    const startedAtIso = addHoursDialog.startedAt ? fromLocalDateTimeInputValue(addHoursDialog.startedAt) : null;
    const endedAtIso = addHoursDialog.endedAt ? fromLocalDateTimeInputValue(addHoursDialog.endedAt) : null;
    if (addHoursDialog.startedAt && !startedAtIso) {
      toast({ title: "Invalid start time", description: "Enter a valid start date/time.", variant: "destructive" });
      return;
    }
    if (addHoursDialog.endedAt && !endedAtIso) {
      toast({ title: "Invalid end time", description: "Enter a valid end date/time.", variant: "destructive" });
      return;
    }
    if (startedAtIso && endedAtIso && new Date(endedAtIso) < new Date(startedAtIso)) {
      toast({ title: "Invalid time range", description: "End time must be after start time.", variant: "destructive" });
      return;
    }

    try {
      await apiFetch<{ ok: boolean; entry: any }>("/workshop/time", {
        method: "POST",
        json: {
          userId: addHoursDialog.userId,
          date: addHoursDialog.dateKey,
          hours: hoursNum,
          notes: addHoursDialog.notes?.trim() ? addHoursDialog.notes.trim() : null,
          process: addHoursDialog.process.trim(),
          projectId: addHoursDialog.projectId ? addHoursDialog.projectId : null,
          startedAt: startedAtIso,
          endedAt: endedAtIso,
        },
      });

      toast({ title: "Hours added" });
      setAddHoursDialog({ open: false, userId: null, userLabel: "", dateKey: "", projectId: "", process: "ADMIN", hours: "", notes: "", startedAt: "", endedAt: "" });
      await loadTeamActivity();
      await loadTimesheets();
    } catch (e: any) {
      toast({ title: "Failed to add hours", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  async function startTimerForUser(userId: string) {
    try {
      await apiFetch<{ ok: boolean; timer: any; warning?: string }>("/workshop/timer/start", {
        method: "POST",
        json: { userId, process: "ADMIN" },
      });
      toast({ title: "Timer started", description: "Started ADMIN timer." });
      await loadTeamActivity();
    } catch (e: any) {
      toast({ title: "Failed to start timer", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  async function stopTimerForUser(userId: string) {
    try {
      await apiFetch<{ ok: boolean; timeEntry: any; hours: any }>("/workshop/timer/stop", {
        method: "POST",
        json: { userId },
      });
      toast({ title: "Timer stopped" });
      await loadTeamActivity();
      await loadTimesheets();
    } catch (e: any) {
      toast({ title: "Failed to stop timer", description: e?.message || "Unknown error", variant: "destructive" });
    }
  }

  // Group entries by project/job for user detail view
  function groupEntriesByProject(days: Record<string, TimeEntry[]>) {
    const projectMap = new Map<string, { name: string; process: string; entries: Record<string, number> }>();
    
    Object.entries(days).forEach(([dateKey, entries]) => {
      entries.forEach((entry) => {
        const baseId = entry.project?.id || "unassigned";
        const compositeId = `${baseId}__${entry.process}`;
        const projectName = entry.project?.title || "Unassigned Project";
        
        if (!projectMap.has(compositeId)) {
          projectMap.set(compositeId, {
            name: projectName,
            process: entry.process,
            entries: {},
          });
        }
        
        const project = projectMap.get(compositeId)!;
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
    <>
      <Dialog
        open={editEntryDialog.open}
        onOpenChange={(open) =>
          setEditEntryDialog((prev) => ({
            ...prev,
            open,
            entryId: open ? prev.entryId : null,
            userId: open ? prev.userId : null,
          }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Time log</DialogTitle>
            <DialogDescription>
              {editEntryDialog.userLabel}
              {editEntryDialog.dateKey ? ` • ${editEntryDialog.dateKey}` : ""}
              {editEntryDialog.projectTitle ? ` • ${editEntryDialog.projectTitle}` : ""}
              {editEntryDialog.process ? ` • ${editEntryDialog.process}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Start</label>
                <input
                  type="datetime-local"
                  value={editEntryDialog.startedAt}
                  onChange={(e) => setEditEntryDialog((prev) => ({ ...prev, startedAt: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">End</label>
                <input
                  type="datetime-local"
                  value={editEntryDialog.endedAt}
                  onChange={(e) => setEditEntryDialog((prev) => ({ ...prev, endedAt: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 bg-background"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hours</label>
              <input
                type="number"
                step="0.1"
                value={editEntryDialog.hours}
                onChange={(e) => setEditEntryDialog((prev) => ({ ...prev, hours: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Textarea
                value={editEntryDialog.notes}
                onChange={(e) => setEditEntryDialog((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditEntryDialog({ open: false, entryId: null, userId: null, userLabel: "", dateKey: "", projectTitle: null, process: "", hours: "", notes: "", startedAt: "", endedAt: "" })}
            >
              Cancel
            </Button>
            {canAmendTime && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (!editEntryDialog.entryId) return;
                  setDeleteEntryDialog({
                    open: true,
                    entryId: editEntryDialog.entryId,
                    userLabel: editEntryDialog.userLabel,
                    dateKey: editEntryDialog.dateKey,
                    projectTitle: editEntryDialog.projectTitle,
                    process: editEntryDialog.process,
                    hours: Number(editEntryDialog.hours) || null,
                  });
                }}
              >
                Delete
              </Button>
            )}
            {canAmendTime && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (!editEntryDialog.userId) return;
                  openAddHoursDialog(editEntryDialog.userId, editEntryDialog.userLabel, editEntryDialog.dateKey);
                }}
              >
                Add
              </Button>
            )}
            <Button onClick={confirmEditEntry}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addHoursDialog.open}
        onOpenChange={(open) =>
          setAddHoursDialog((prev) => ({
            ...prev,
            open,
            userId: open ? prev.userId : null,
          }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add hours</DialogTitle>
            <DialogDescription>
              {addHoursDialog.userLabel}
              {addHoursDialog.dateKey ? ` • ${addHoursDialog.dateKey}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Date</label>
              <input
                type="date"
                value={addHoursDialog.dateKey}
                onChange={(e) => setAddHoursDialog((prev) => ({ ...prev, dateKey: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Start (optional)</label>
                <input
                  type="datetime-local"
                  value={addHoursDialog.startedAt}
                  onChange={(e) => setAddHoursDialog((prev) => ({ ...prev, startedAt: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">End (optional)</label>
                <input
                  type="datetime-local"
                  value={addHoursDialog.endedAt}
                  onChange={(e) => setAddHoursDialog((prev) => ({ ...prev, endedAt: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 bg-background"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Project (optional)</label>
              <Select value={addHoursDialog.projectId || "none"} onValueChange={(v) => setAddHoursDialog((prev) => ({ ...prev, projectId: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  <div className="sticky top-0 bg-background z-10 p-2 border-b">
                    <input
                      value={addHoursProjectSearch}
                      onChange={(e) => setAddHoursProjectSearch(e.target.value)}
                      placeholder="Type to search projects…"
                      className="w-full border border-border rounded-md px-3 py-2 bg-background"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {projectsLoading ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">Loading projects…</div>
                    ) : (() => {
                      const q = addHoursProjectSearch.trim().toLowerCase();
                      const filtered = q
                        ? projects.filter((p) => (p.name || "").toLowerCase().includes(q))
                        : projects;
                      if (filtered.length === 0) {
                        return <div className="px-2 py-3 text-sm text-muted-foreground">No projects found</div>;
                      }
                      return filtered.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ));
                    })()}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Process</label>
              <input
                value={addHoursDialog.process}
                onChange={(e) => setAddHoursDialog((prev) => ({ ...prev, process: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 bg-background"
                placeholder="e.g. ADMIN"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hours</label>
              <input
                type="number"
                step="0.1"
                value={addHoursDialog.hours}
                onChange={(e) => setAddHoursDialog((prev) => ({ ...prev, hours: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Textarea
                value={addHoursDialog.notes}
                onChange={(e) => setAddHoursDialog((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddHoursDialog({ open: false, userId: null, userLabel: "", dateKey: "", projectId: "", process: "ADMIN", hours: "", notes: "" })}
            >
              Cancel
            </Button>
            <Button onClick={confirmAddHours}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={signOffDialog.open}
        onOpenChange={(open) =>
          setSignOffDialog((prev) => ({ open, timesheetId: open ? prev.timesheetId : null }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign off timesheet?</DialogTitle>
            <DialogDescription>This will mark the timesheet as signed off.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOffDialog({ open: false, timesheetId: null })}>
              Cancel
            </Button>
            <Button onClick={confirmSignOff}>Sign Off</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          setRejectDialog((prev) => ({ ...prev, open, timesheetId: open ? prev.timesheetId : null }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject timesheet</DialogTitle>
            <DialogDescription>Add a reason so the team member knows what to fix.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={rejectDialog.notes}
              onChange={(e) => setRejectDialog((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Reason for rejection"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, timesheetId: null, notes: "" })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteEntryDialog.open}
        onOpenChange={(open) =>
          setDeleteEntryDialog((prev) => ({ ...prev, open, entryId: open ? prev.entryId : null }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete time entry</DialogTitle>
            <DialogDescription>This will permanently delete the selected time entry.</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <strong>User:</strong> {deleteEntryDialog.userLabel}
            </div>
            <div>
              <strong>Date:</strong> {deleteEntryDialog.dateKey}
            </div>
            <div>
              <strong>Project/Process:</strong> {deleteEntryDialog.projectTitle ?? deleteEntryDialog.process}
            </div>
            {typeof deleteEntryDialog.hours === "number" && (
              <div>
                <strong>Hours:</strong> {deleteEntryDialog.hours}h
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteEntryDialog({
                  open: false,
                  entryId: null,
                  userLabel: "",
                  dateKey: "",
                  projectTitle: null,
                  process: "",
                  hours: null,
                })
              }
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteEntry}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddUserPicker} onOpenChange={setShowAddUserPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select user to add hours for</DialogTitle>
            <DialogDescription>Choose which team member to log time for</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {userActivity.map((ua) => (
              <button
                key={ua.user.id}
                onClick={() => {
                  setSelectedUserForAdd({ id: ua.user.id, name: getUserDisplayName(ua.user) });
                  setShowAddUserPicker(false);
                  // Open the add hours dialog for this user
                  const today = new Date().toISOString().split("T")[0];
                  openAddHoursDialog(ua.user.id, getUserDisplayName(ua.user), today);
                }}
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: ua.user.workshopColor || "#6b7280" }}
                >
                  {getUserDisplayName(ua.user)[0]?.toUpperCase() || "?"}
                </div>
                <span className="font-medium">{getUserDisplayName(ua.user)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
                            alt={getUserDisplayName(selectedUser.user)}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-2xl font-bold"
                            style={{ backgroundColor: selectedUser.user.workshopColor || "#6b7280" }}
                          >
                            {getUserDisplayName(selectedUser.user)[0]?.toUpperCase() || "?"}
                          </div>
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
                        <h2 className="text-2xl font-bold">{getUserDisplayName(selectedUser.user)}</h2>
                        <p className="text-muted-foreground">{selectedUser.user.email}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-3xl font-bold text-blue-600">{formatHours(userTotal)}</div>
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
                                    {hours > 0 ? formatHours(hours) : ""}
                                  </td>
                                );
                              })}
                              <td className="border border-border p-3 text-right font-bold sticky right-0 bg-background z-10">
                                {formatHours(projectTotal)}
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
                                {dayTotal > 0 ? formatHours(dayTotal) : ""}
                              </td>
                            );
                          })}
                          <td className="border border-border p-3 text-right sticky right-0 bg-muted z-10">
                            {formatHours(userTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Time logs */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Time logs</h3>
                    <div className="space-y-3">
                      {dateRange.map((date) => {
                        const dateKey = date.toISOString().split("T")[0];
                        const entries = selectedUser.days[dateKey] || [];
                        if (entries.length === 0) return null;
                        return (
                          <div key={dateKey} className="space-y-2">
                            <div className="text-xs font-semibold text-slate-600 py-1">
                              {new Date(dateKey + "T00:00:00").toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                              })}
                            </div>
                            {entries.map((entry) => (
                              <Card
                                key={entry.id}
                                className="p-3 bg-white border-l-4 border-l-blue-500 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => openEditEntryDialog(selectedUser.user.id, getUserDisplayName(selectedUser.user), dateKey, entry)}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{entry.project?.title || "Unassigned Project"}</div>
                                    <div className="text-xs text-muted-foreground">{entry.process}</div>
                                    {(entry.startedAt || entry.endedAt) && (
                                      <div className="text-xs text-slate-600 mt-1">
                                        {entry.startedAt ? new Date(entry.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                        {" – "}
                                        {entry.endedAt ? new Date(entry.endedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                      </div>
                                    )}
                                    {entry.notes && <div className="text-xs text-slate-600 mt-1">{entry.notes}</div>}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="font-semibold text-blue-600 min-w-[45px] text-right">{formatHours(entry.hours)}</span>
                                    {canAmendTime && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openEditEntryDialog(selectedUser.user.id, getUserDisplayName(selectedUser.user), dateKey, entry);
                                          }}
                                          className="h-7 w-7 p-0"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openDeleteEntryDialog(getUserDisplayName(selectedUser.user), dateKey, entry);
                                          }}
                                          className="h-7 w-7 p-0"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        );
                      })}
                      {Object.values(selectedUser.days).flat().length === 0 && (
                        <div className="text-sm text-muted-foreground italic py-2">No entries logged</div>
                      )}
                    </div>
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
                                  alt={getUserDisplayName(ua.user)}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                  style={{ backgroundColor: ua.user.workshopColor || "#6b7280" }}
                                >
                                  {getUserDisplayName(ua.user)[0]?.toUpperCase() || "?"}
                                </div>
                              )}
                              {(ua.hasActiveTimer || activeTimers[ua.user.id]) && (
                                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" title="Timer running" />
                              )}
                            </div>
                            <span className="font-medium">{getUserDisplayName(ua.user)}</span>
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
                              {dayHours > 0 ? formatHours(dayHours) : ""}
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
          {/* Team Activity - Itemized Entries with Edit Capability */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Team Activity - Time Entries</h3>
            {canAmendTime && (
              <Button
                size="sm"
                onClick={() => {
                  // If no user activity, we still show the prompt
                  if (userActivity.length === 0) {
                    toast({ title: "Select a user", description: "No users with logged time in this period." });
                    return;
                  }
                  // Show a simple prompt-style selection or use first user
                  // For now, we'll just show all users and let them pick
                  setShowAddUserPicker(true);
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Entry
              </Button>
            )}
          </div>
          {activityLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading team activity...</div>
          ) : userActivity.length === 0 ? (
            <Card className="p-12 text-center">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No activity recorded</p>
              <p className="text-sm text-muted-foreground mt-2">
                Time entries will appear here as users log their hours
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {userActivity.map((ua) => (
                <div key={ua.user.id} className="space-y-3">
                  {/* User header */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                    <div className="relative">
                      {ua.user.profilePictureUrl ? (
                        <img
                          src={ua.user.profilePictureUrl}
                          alt={getUserDisplayName(ua.user)}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: ua.user.workshopColor || "#6b7280" }}
                        >
                          {getUserDisplayName(ua.user)[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                      {(ua.hasActiveTimer || activeTimers[ua.user.id]) && (
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <span className="font-semibold">{getUserDisplayName(ua.user)}</span>
                    <span className="ml-auto text-sm text-muted-foreground">
                      {formatHours(Object.values(ua.days).reduce((sum, entries) => sum + getTotalHoursForDay(entries), 0))}
                    </span>
                  </div>

                  {/* Itemized entries for this user */}
                  <div className="pl-4 space-y-2">
                    {Object.entries(ua.days).map(([dateKey, entries]) => (
                      <div key={dateKey} className="space-y-2">
                        {entries.length > 0 && (
                          <div className="text-xs font-semibold text-slate-600 py-1">
                            {new Date(dateKey + "T00:00:00").toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                            })}
                          </div>
                        )}
                        {entries.map((entry) => (
                          <Card
                            key={entry.id}
                            className="p-3 bg-white border-l-4 border-l-blue-500 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => openEditEntryDialog(ua.user.id, getUserDisplayName(ua.user), dateKey, entry)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{entry.project?.title || "Unassigned Project"}</div>
                                <div className="text-xs text-muted-foreground">{entry.process}</div>
                                {(entry.startedAt || entry.endedAt) && (
                                  <div className="text-xs text-slate-600 mt-1">
                                    {entry.startedAt ? new Date(entry.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                    {" – "}
                                    {entry.endedAt ? new Date(entry.endedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                  </div>
                                )}
                                {entry.notes && <div className="text-xs text-slate-600 mt-1">{entry.notes}</div>}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="font-semibold text-blue-600 min-w-[45px] text-right">{formatHours(entry.hours)}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditEntryDialog(ua.user.id, getUserDisplayName(ua.user), dateKey, entry);
                                  }}
                                  className="h-7 w-7 p-0"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteEntryDialog({
                                      open: true,
                                      entryId: entry.id,
                                      userLabel: getUserDisplayName(ua.user),
                                      dateKey,
                                      projectTitle: entry.project?.title || null,
                                      process: entry.process,
                                      hours: entry.hours,
                                    });
                                  }}
                                  className="h-7 w-7 p-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ))}
                    {Object.values(ua.days).flat().length === 0 && (
                      <div className="text-sm text-muted-foreground italic py-2">No entries logged</div>
                    )}
                  </div>
                </div>
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
                      {formatHours(projectDetail.project.totalHours)}
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
                          <div className="text-xl font-bold text-blue-600">{formatHours(item.total)}</div>
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
                            <div className="font-medium">{formatHours(proc.hours)}</div>
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
            <div className="space-y-4">
              {/* Filter Toggle */}
              <div className="flex items-center justify-between bg-white/80 border border-indigo-200/70 rounded-lg p-4 shadow-sm">
                <div>
                  <h3 className="font-semibold">Project Status</h3>
                  <p className="text-sm text-muted-foreground">Filter projects by completion status</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant={!showCompletedProjects ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowCompletedProjects(false)}
                  >
                    Current Projects
                  </Button>
                  <Button
                    variant={showCompletedProjects ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowCompletedProjects(true)}
                  >
                    Completed Projects
                  </Button>
                </div>
              </div>

              {/* Projects Table */}
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
                  {projects.filter(p => 
                    showCompletedProjects ? p.status === "completed" : p.status !== "completed"
                  ).map((project) => {
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
                        No {showCompletedProjects ? "completed" : "active"} projects found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                    {getUserDisplayName(user)}
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
                    {getUserDisplayName(ts.user)[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{getUserDisplayName(ts.user)}</h3>
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

      </Tabs>
      </div>
    </>
  );
}

export default function TimesheetsPage() {
  return <TimesheetsManagement redirectAdminsToSettings />;
}
