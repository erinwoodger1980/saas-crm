
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import MaterialLinkDialog from "@/components/workshop/MaterialLinkDialog";
import MaterialReceivedDialog from "@/components/workshop/MaterialReceivedDialog";
import MaterialOrderDialog from "@/components/workshop/MaterialOrderDialog";
import { GroupProjectsModal } from "@/app/workshop/GroupProjectsModal";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskModal } from "@/components/tasks/TaskModal";
// Type definitions for QuickLogModal
interface QuickLogUser {
  id: string;
  name: string | null;
  email: string;
}
interface QuickLogProject {
  id: string;
  name: string;
}
interface QuickLogSaveInput {
  projectId?: string | null;
  userId: string;
  process: string; // Will be constrained via UI from PROCESSES
  hours: string; // kept as string until converted on save
  notes?: string;
  date: string; // ISO date yyyy-mm-dd
  markComplete?: boolean;
  completionComments?: string;
}
interface QuickLogModalProps {
  users: QuickLogUser[];
  projects: QuickLogProject[];
  processes: Array<{ code: string; name: string; isGeneric?: boolean }>;
  onSave: (data: QuickLogSaveInput) => void | Promise<void>;
  onClose: () => void;
}
// Quick log modal for staff to log hours for today
function QuickLogModal({ users, projects, processes, onSave, onClose }: QuickLogModalProps) {
  const [form, setForm] = useState<{ projectId: string; userId: string; process: string; hours: string; notes: string; markComplete: boolean; completionComments: string }>({ 
    projectId: '', userId: '', process: '', hours: '', notes: '', markComplete: false, completionComments: '' 
  });
  const today = new Date().toISOString().slice(0, 10);
  
  // Check if selected process is a generic category (doesn't require a project)
  const selectedProc = processes.find((p: any) => p.code === form.process);
  const isGenericCategory = selectedProc?.isGeneric || false;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <Card className="p-6 max-w-md w-full m-4 bg-white shadow-2xl border" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Log Hours for Today</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">User</label>
            <Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map((u: QuickLogUser) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Process/Category</label>
            <Select value={form.process} onValueChange={v => setForm(f => ({ ...f, process: v, projectId: '' }))}>
              <SelectTrigger><SelectValue placeholder="Select process or category" /></SelectTrigger>
              <SelectContent>
                {processes.map((p) => (
                  <SelectItem key={p.code} value={p.code}>{p.name} {p.isGeneric && "⭐"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isGenericCategory && (
            <div>
              <label className="text-sm font-medium mb-1 block">Project</label>
              <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p: QuickLogProject) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">Hours</label>
            <Input type="number" min="0" step="0.01" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <Input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          
          {!isGenericCategory && form.projectId && (
            <div className="space-y-2 pt-2 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.markComplete}
                  onChange={e => setForm(f => ({ ...f, markComplete: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Mark this process as complete</span>
              </label>
              
              {form.markComplete && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Completion Comments (optional)</label>
                  <textarea
                    value={form.completionComments}
                    onChange={e => setForm(f => ({ ...f, completionComments: e.target.value }))}
                    placeholder="Add completion notes..."
                    className="w-full border rounded-md p-2 min-h-[60px] text-sm"
                  />
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => onSave({ 
                projectId: isGenericCategory ? null : (form.projectId || null),
                userId: form.userId,
                process: form.process,
                hours: form.hours,
                notes: form.notes,
                date: today,
                ...(form.markComplete && { markComplete: true, completionComments: form.completionComments })
              } as any)} 
              disabled={!form.userId || !form.process || !form.hours || (!isGenericCategory && !form.projectId)}
            >
              Log Hours
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

import { apiFetch, ensureDemoAuth, API_BASE } from "@/lib/api";

import { useCurrentUser } from "@/lib/use-current-user";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid } from "lucide-react";
import WorkshopSwimlaneTimeline from "./WorkshopSwimlaneTimeline";
import { CustomizableGrid } from "@/components/CustomizableGrid";
import { ColumnConfigModal } from "@/components/ColumnConfigModal";
import DropdownOptionsEditor from "@/components/DropdownOptionsEditor";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import CalendarWeekView from "./CalendarWeekView";
import CalendarYearView from "./CalendarYearView";
import WorkshopTimer, { WorkshopTimerHandle } from "@/components/workshop/WorkshopTimer";
import { useTaskNotifications } from "@/hooks/useTaskNotifications";
import { NotificationPrompt, NotificationToggle } from "@/components/notifications/NotificationPrompt";
import QRScannerModal from "@/components/workshop/QRScannerModal";
import MyTimesheetView from "@/components/workshop/MyTimesheetView";

// Workshop processes are sourced from settings via `/workshop-processes`
interface ProcDef { id: string; code: string; name: string; sortOrder?: number; isGeneric?: boolean }

type UserLite = { id: string; name: string | null; email: string; workshopHoursPerDay?: number | null; workshopColor?: string | null };

type Plan = {
  id: string;
  process: string;
  plannedWeek: number;
  assignedUser: { id: string; name: string | null } | null;
  notes?: string | null;
};

type ProcessAssignment = {
  id: string;
  processCode: string;
  processName: string;
  sortOrder?: number;
  required: boolean;
  estimatedHours?: number | null;
  isColorKey?: boolean; // True if this process determines project color
  assignmentGroup?: string | null; // Group for batch assignment
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  completedAt?: string | null; // Date when process was completed
};

type Project = {
  id: string;
  name: string;
  number?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  parentOpportunityId?: string | null;
  groupMembers?: Project[]; // Only populated for grouped schedule display items
  valueGBP?: string | number | null;
  contractValue?: string | number | null;
  wonAt?: string | null;
  startDate?: string | null;
  deliveryDate?: string | null;
  installationStartDate?: string | null;
  installationEndDate?: string | null;
  weeks: number;
  processPlans: Plan[];
  processAssignments?: ProcessAssignment[]; // New process assignments
  totalHoursByProcess: Record<string, number>;
  totalProjectHours: number;
  expectedHours?: number | string | null;
  actualHours?: number | string | null;
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

type ScheduleResponse = { ok: boolean; weeks: number; projects: Project[] };

type UsersResponse = { ok: boolean; items: UserLite[] };

type NewPlan = { projectId: string; process: string; plannedWeek: number | ""; assignedUserId?: string | "" };

type LogForm = { projectId: string; process: string; userId: string | ""; date: string; hours: string; notes?: string };

type Holiday = {
  id: string;
  userId: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  notes?: string | null;
  user?: { id: string; name: string | null; email: string };
};

type HolidaysResponse = { ok: boolean; items: Holiday[] };

function formatProcess(p: string) {
  return p.replace(/_/g, " ");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function getProjectDisplayName(proj: Project): string {
  if (proj.number) {
    return `${proj.number} - ${proj.name}`;
  }
  return proj.name;
}

function parseNumberish(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function collapseGroupedScheduleProjects(raw: Project[]): Project[] {
  const byGroup: Record<string, Project[]> = {};
  const ungrouped: Project[] = [];

  for (const p of raw) {
    const gid = typeof p.groupId === "string" && p.groupId.trim() ? p.groupId.trim() : null;
    if (!gid) {
      ungrouped.push(p);
      continue;
    }
    (byGroup[gid] ||= []).push(p);
  }

  const grouped: Project[] = Object.entries(byGroup).map(([groupId, members]) => {
    const groupName =
      members.map((m) => (typeof m.groupName === "string" ? m.groupName.trim() : "")).find((n) => n) ||
      "Group";

    const numbers = members
      .map((m) => (typeof m.number === "string" ? m.number.trim() : ""))
      .filter(Boolean);
    const first = numbers[0] || null;
    const moreCount = Math.max(0, numbers.length - 1);
    const numberLabel = first ? (moreCount > 0 ? `${first} +${moreCount}` : first) : null;

    const toDate = (iso?: string | null) => {
      if (!iso) return null;
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const toIso = (d: Date | null) => (d ? d.toISOString() : null);

    const starts = members.map((m) => toDate(m.startDate)).filter(Boolean) as Date[];
    const ends = members.map((m) => toDate(m.deliveryDate)).filter(Boolean) as Date[];
    const instStarts = members.map((m) => toDate(m.installationStartDate)).filter(Boolean) as Date[];
    const instEnds = members.map((m) => toDate(m.installationEndDate)).filter(Boolean) as Date[];

    const minDate = (arr: Date[]) => (arr.length ? new Date(Math.min(...arr.map((d) => d.getTime()))) : null);
    const maxDate = (arr: Date[]) => (arr.length ? new Date(Math.max(...arr.map((d) => d.getTime()))) : null);

    const startDate = toIso(minDate(starts));
    const deliveryDate = toIso(maxDate(ends));
    const installationStartDate = toIso(minDate(instStarts));
    const installationEndDate = toIso(maxDate(instEnds));

    const processAssignments = members.flatMap((m) => m.processAssignments || []);
    const processPlans = members.flatMap((m) => m.processPlans || []);

    return {
      id: `group:${groupId}`,
      name: groupName,
      number: numberLabel,
      groupId,
      groupName,
      groupMembers: members,
      valueGBP: members.reduce((s, m) => s + parseNumberish(m.valueGBP), 0),
      contractValue: members.reduce((s, m) => s + parseNumberish(m.contractValue), 0),
      wonAt: members.map((m) => m.wonAt).filter(Boolean)[0] || null,
      startDate,
      deliveryDate,
      installationStartDate,
      installationEndDate,
      weeks: members[0]?.weeks ?? 4,
      processPlans,
      processAssignments,
      totalHoursByProcess: {},
      totalProjectHours: members.reduce((s, m) => s + parseNumberish(m.totalProjectHours), 0),
    };
  });

  return [...ungrouped, ...grouped];
}

// Calculate project rows for stacking (to avoid overlaps in calendar view)
function calculateProjectRows(projects: Project[], monthStart: Date, monthEnd: Date): Project[][] {
  const projectRows: Project[][] = [];
  projects.forEach(proj => {
    if (!proj.startDate || !proj.deliveryDate) return;
    
    const projStart = new Date(proj.startDate);
    const projEnd = new Date(proj.deliveryDate);
    
    // Only include projects that overlap with the given date range
    if (projEnd < monthStart || projStart > monthEnd) return;
    
    // Find first row where this project doesn't overlap with existing projects
    let rowIndex = 0;
    while (rowIndex < projectRows.length) {
      const hasOverlap = projectRows[rowIndex].some(existingProj => {
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
  
  return projectRows;
}

function getUserColor(userId: string, users: UserLite[]): string {
  const user = users.find(u => u.id === userId);
  return user?.workshopColor || '#60a5fa'; // Default to blue
}

function getProjectColor(proj: Project, users: UserLite[]): string {
  // Find the color key process (e.g., Assembly)
  const colorKeyAssignment = (proj.processAssignments || []).find(pa => pa.isColorKey);
  
  // If there's a color key process with an assigned user, use that user's color
  if (colorKeyAssignment?.assignedUser) {
    return getUserColor(colorKeyAssignment.assignedUser.id, users);
  }
  
  // Fallback: use first assigned user's color
  const firstAssignment = (proj.processAssignments || []).find(pa => pa.assignedUser);
  if (firstAssignment?.assignedUser) {
    return getUserColor(firstAssignment.assignedUser.id, users);
  }
  
  // No assignments: default blue
  return '#60a5fa';
}

type MaterialStatus = 'not-applicable' | 'not-ordered' | 'ordered' | 'received';

function getMaterialStatus(orderedAt?: string | null, receivedAt?: string | null, notApplicable?: boolean): MaterialStatus {
  if (notApplicable) return 'not-applicable';
  if (receivedAt) return 'received';
  if (orderedAt) return 'ordered';
  return 'not-ordered';
}

function getMaterialColor(status: MaterialStatus): string {
  switch (status) {
    case 'not-applicable': return '#6b7280'; // Grey
    case 'received': return '#22c55e'; // Green
    case 'ordered': return '#f59e0b'; // Amber
    case 'not-ordered': return '#ef4444'; // Red
  }
}

export default function WorkshopPage() {
  const { user } = useCurrentUser();
  const isWorkshopOnly = user?.role === 'workshop';
  const timerRef = useRef<WorkshopTimerHandle>(null);
  
  // Task notifications
  const { permission, requestPermission, isEnabled } = useTaskNotifications(user?.id ? Number(user.id) : null);
  
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'tasks' | 'grid' | 'timesheet' | 'timber'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('workshop-view-mode');
      if (saved && ['calendar', 'timeline', 'tasks', 'grid', 'timber'].includes(saved)) {
        return saved as 'calendar' | 'timeline' | 'tasks' | 'grid' | 'timber';
      }
    }
    return 'calendar';
  });
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month' | 'year'>('month'); // New state for calendar sub-views
  const [showValues, setShowValues] = useState(false); // Toggle between workshop view (false) and management view (true)

  type TimberMaterialLite = { id: string; name: string; code?: string; category?: string; unit?: string; unitCost?: any; currency?: string; thickness?: any; width?: any };
  type TimberUsageTotalsLite = { totalMillimeters: number; totalMeters: number; totalCost: number; currency: string };
  type TimberUsageLogLite = {
    id: string;
    materialId: string;
    lengthMm: number;
    quantity: number;
    usedAt: string;
    notes?: string | null;
    material?: { id: string; name: string; code?: string };
    user?: { id: string; name: string | null; email: string };
  };

  const [timberMaterials, setTimberMaterials] = useState<TimberMaterialLite[]>([]);
  const [timberMaterialsLoading, setTimberMaterialsLoading] = useState(false);

  const [timberViewProjectId, setTimberViewProjectId] = useState<string>('');
  const [timberViewTotals, setTimberViewTotals] = useState<TimberUsageTotalsLite | null>(null);
  const [timberViewLogs, setTimberViewLogs] = useState<TimberUsageLogLite[]>([]);
  const [timberViewLoading, setTimberViewLoading] = useState(false);
  const [timberViewError, setTimberViewError] = useState<string | null>(null);
  const [timberUsageForm, setTimberUsageForm] = useState({
    materialId: '',
    meters: '',
    quantity: '1',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const ensureTimberMaterialsLoaded = async () => {
    if (timberMaterialsLoading) return;
    if (timberMaterials.length > 0) return;
    setTimberMaterialsLoading(true);
    try {
      const r = await apiFetch<{ ok: boolean; items: TimberMaterialLite[] }>("/workshop/timber/materials");
      if (r?.ok && Array.isArray(r.items)) {
        setTimberMaterials(r.items);
      }
    } catch (e) {
      // non-fatal; UI will show an empty list
    } finally {
      setTimberMaterialsLoading(false);
    }
  };

  const refreshTimberUsageForProject = async (opportunityId: string) => {
    if (!opportunityId) return;
    setTimberViewLoading(true);
    setTimberViewError(null);
    try {
      const r = await apiFetch<any>(`/workshop/timber/usage?opportunityId=${encodeURIComponent(opportunityId)}`);
      if (!r?.ok) {
        setTimberViewTotals(null);
        setTimberViewLogs([]);
        setTimberViewError('Failed to load timber usage');
        return;
      }
      setTimberViewTotals(r.totals ?? null);
      setTimberViewLogs(Array.isArray(r.logs) ? r.logs : []);
    } catch (e: any) {
      setTimberViewTotals(null);
      setTimberViewLogs([]);
      setTimberViewError(e?.message || 'Failed to load timber usage');
    } finally {
      setTimberViewLoading(false);
    }
  };

  const [projectTimberLoading, setProjectTimberLoading] = useState(false);
  const [projectTimberError, setProjectTimberError] = useState<string | null>(null);
  const [projectTimberTotals, setProjectTimberTotals] = useState<TimberUsageTotalsLite | null>(null);
  const [projectTimberLogs, setProjectTimberLogs] = useState<TimberUsageLogLite[]>([]);
  const [projectTimberFormOpen, setProjectTimberFormOpen] = useState(false);
  const [projectTimberForm, setProjectTimberForm] = useState({
    materialId: '',
    meters: '',
    quantity: '1',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const refreshProjectTimberUsage = async (opportunityId: string) => {
    if (!opportunityId) return;
    setProjectTimberLoading(true);
    setProjectTimberError(null);
    try {
      const r = await apiFetch<any>(`/workshop/timber/usage?opportunityId=${encodeURIComponent(opportunityId)}`);
      if (!r?.ok) {
        setProjectTimberTotals(null);
        setProjectTimberLogs([]);
        setProjectTimberError('Failed to load timber usage');
        return;
      }
      setProjectTimberTotals(r.totals ?? null);
      setProjectTimberLogs(Array.isArray(r.logs) ? r.logs : []);
    } catch (e: any) {
      setProjectTimberTotals(null);
      setProjectTimberLogs([]);
      setProjectTimberError(e?.message || 'Failed to load timber usage');
    } finally {
      setProjectTimberLoading(false);
    }
  };
  
  // Grid view state
  const { toast } = useToast();
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [columnConfig, setColumnConfig] = useState<any[]>([]);
  const [customColors, setCustomColors] = useState<Record<string, { bg: string; text: string }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('workshop-grid-custom-colors');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('workshop-grid-dropdown-options');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [timelineViewFilter, setTimelineViewFilter] = useState<'both' | 'manufacturing' | 'installation'>('both'); // Filter for timeline bars
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(4);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [adding, setAdding] = useState<Record<string, NewPlan>>({});
  const [loggingFor, setLoggingFor] = useState<Record<string, LogForm | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [editingDates, setEditingDates] = useState<Record<string, { startDate: string; deliveryDate: string; value: string; expectedHours?: string; actualHours?: string }>>({});
  const [draggingProject, setDraggingProject] = useState<string | null>(null);
  const [showHoursModal, setShowHoursModal] = useState<{ projectId: string; projectName: string } | null>(null);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayRequestForm, setHolidayRequestForm] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  });

  const scheduleProjects = useMemo(() => collapseGroupedScheduleProjects(projects), [projects]);
  const [showProjectDetails, setShowProjectDetails] = useState<string | null>(null);

  useEffect(() => {
    if (!isWorkshopOnly) return;
    if (!showProjectDetails) return;
    const p =
      scheduleProjects.find((x) => x.id === showProjectDetails) ||
      projects.find((x) => x.id === showProjectDetails);
    if (!p) return;
    if (Array.isArray((p as any).groupMembers) && (p as any).groupMembers.length > 0) return;
    ensureTimberMaterialsLoaded().catch(() => {});
    refreshProjectTimberUsage(showProjectDetails).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProjectDetails, isWorkshopOnly]);

  const [showProjectSwap, setShowProjectSwap] = useState(false);
  const [swapForm, setSwapForm] = useState({ projectId: '', process: '', notes: '', search: '' });
  const [showUserColors, setShowUserColors] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [processDefs, setProcessDefs] = useState<ProcDef[]>([]);
  const [hoursForm, setHoursForm] = useState<{ process: string; userId: string; hours: string; date: string }>({
    process: "",
    userId: "",
    hours: "",
    date: new Date().toISOString().split('T')[0]
  });
  
  // Workshop tasks state
  const [workshopTasks, setWorkshopTasks] = useState<any[]>([]);
  const [tasksFilter, setTasksFilter] = useState<'open' | 'in_progress' | 'all'>('open');
  const [showMaterialLink, setShowMaterialLink] = useState<{taskId: string; taskTitle: string} | null>(null);
  const [showMaterialOrder, setShowMaterialOrder] = useState<{taskId: string; taskTitle: string; materialType: string; opportunityId: string} | null>(null);
  const [myTasksCount, setMyTasksCount] = useState(0);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [groupProjectsOpen, setGroupProjectsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tenantId = (user as any)?.tenantId as string | undefined;
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return (workshopTasks || []).find((t: any) => t?.id === selectedTaskId) ?? null;
  }, [selectedTaskId, workshopTasks]);

  async function loadWorkshopTasks() {
    if (!user?.id) return;
    try {
      const statusParam = tasksFilter === 'all' ? 'open,in_progress,done' : tasksFilter === 'open' ? 'open' : 'in_progress';
      const response = await apiFetch<{ ok: boolean; tasks: any[] }>(`/tasks/workshop?status=${statusParam}`);
      if (response.ok) {
        setWorkshopTasks(response.tasks || []);
      }
    } catch (e) {
      console.error("Failed to load workshop tasks:", e);
    }
  }

  async function loadMyTasksCount() {
    if (!user?.id) return;
    try {
      const response = await apiFetch<{ items: any[] }>(`/tasks/workshop?status=NOT_STARTED,IN_PROGRESS&assignedToUserId=${user.id}`);
      setMyTasksCount(response.items?.length || 0);
    } catch (e) {
      console.error("Failed to load tasks count:", e);
    }
  }

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      // In local dev, try to ensure a demo session; in prod, rely on existing auth
      if (typeof window !== "undefined") {
        const host = window.location.hostname;
        if (host === "localhost" || host === "127.0.0.1") {
          try { await ensureDemoAuth(); } catch {}
        }
      }

      // Build holidays query range (~5 months around current month)
      const rangeStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 2, 1);
      const rangeEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 3, 0);
      const from = rangeStart.toISOString().split('T')[0];
      const to = rangeEnd.toISOString().split('T')[0];

      setHolidayError(null);
      const [schedR, usersR, holsR] = await Promise.allSettled([
        apiFetch<ScheduleResponse>("/workshop/schedule?weeks=4"),
        apiFetch<UsersResponse>("/workshop/users"),
        apiFetch<HolidaysResponse>(`/workshop/holidays?from=${from}&to=${to}`),
      ]);

      // Schedule load is critical; if it fails we set loadError
      if (schedR.status === 'fulfilled' && (schedR.value as any)?.ok) {
        setWeeks((schedR.value as any).weeks);
        // Defensive: deduplicate projects that may be returned twice by upstream queries
        const raw = ((schedR.value as any).projects || []) as Project[];
        // 1) Dedupe by id (primary key)
        const byId = new Map<string, Project>();
        for (const p of raw) byId.set(p.id, p);
        let deduped = Array.from(byId.values());
        // 2) Secondary safety: if two different ids share same name + identical dates, keep first
        const seenKey = new Set<string>();
        deduped = deduped.filter(p => {
          const key = `${(p.name || '').trim().toLowerCase()}|${p.startDate || ''}|${p.deliveryDate || ''}`;
          if (seenKey.has(key)) return false;
          seenKey.add(key);
          return true;
        });
        setProjects(deduped);
      } else if (schedR.status === 'rejected') {
        const msg = (schedR.reason?.message || 'Failed to load schedule').toString();
        setLoadError(msg);
      }

      // Users load – non-fatal
      if (usersR.status === 'fulfilled' && (usersR.value as any)?.ok) {
        setUsers((usersR.value as any).items);
      }

      // Holidays load – non-fatal; show separate warning
      if (holsR.status === 'fulfilled' && (holsR.value as any)?.ok) {
        setHolidays((holsR.value as any).items);
        if ((holsR.value as any).warn) {
          setHolidayError((holsR.value as any).warn);
        }
      } else if (holsR.status === 'rejected') {
        setHolidayError((holsR.reason?.message || 'Failed to load holidays').toString());
      }
    } catch (e) {
      console.error("Failed to load workshop:", e);
      const msg = (e as any)?.message || (e as any)?.toString?.() || "load_failed";
      setLoadError(String(msg));
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }

  useEffect(() => {
    loadAll();
    loadWorkshopTasks();
    loadMyTasksCount();
    (async () => {
      try {
        const r = await apiFetch<ProcDef[]>("/workshop-processes");
        if (Array.isArray(r)) {
          setProcessDefs(r.sort((a: ProcDef, b: ProcDef) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)));
        }
      } catch (e) {
        console.warn("Failed to load workshop processes", e);
      }
    })();
  }, []);
  
  // Reload tasks when filter changes
  useEffect(() => {
    if (user?.id) {
      loadWorkshopTasks();
      loadMyTasksCount();
    }
  }, [tasksFilter, user?.id]);

  // Auto-refresh in fullscreen mode every 5 minutes
  useEffect(() => {
    if (!isFullscreen) return;
    
    const interval = setInterval(() => {
      loadAll();
      loadMyTasksCount();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [isFullscreen]);

  function initAdd(projectId: string) {
    setAdding((prev) => ({
      ...prev,
      [projectId]: { projectId, process: "", plannedWeek: 1, assignedUserId: "" },
    }));
  }

  function cancelAdd(projectId: string) {
    setAdding((prev) => ({ ...prev, [projectId]: undefined as any }));
  }

  async function saveAdd(projectId: string) {
    const data = adding[projectId];
    if (!data || !data.projectId || !data.process || !data.plannedWeek) return;
    try {
      await apiFetch("/workshop/plan", {
        method: "POST",
        json: {
          projectId: data.projectId,
          process: data.process,
          plannedWeek: Number(data.plannedWeek),
          assignedUserId: data.assignedUserId || undefined,
        },
      });
      cancelAdd(projectId);
      await loadAll();
    } catch (e) {
      console.error("Failed to save plan", e);
    }
  }

  function startLog(projectId: string) {
    setLoggingFor((prev) => ({
      ...prev,
      [projectId]: { projectId, process: "", userId: "", date: new Date().toISOString().slice(0, 10), hours: "1" },
    }));
  }

  function cancelLog(projectId: string) {
    setLoggingFor((prev) => ({ ...prev, [projectId]: null }));
  }

  async function saveLog(projectId: string) {
    const form = loggingFor[projectId];
    if (!form || !form.process || !form.userId || !form.date || !form.hours) return;
    try {
      await apiFetch("/workshop/time", {
        method: "POST",
        json: {
          projectId: form.projectId,
          process: form.process,
          userId: form.userId,
          date: form.date,
          hours: Number(form.hours),
          notes: form.notes || undefined,
        },
      });
      cancelLog(projectId);
      await loadAll();
    } catch (e) {
      console.error("Failed to log time", e);
    }
  }

  async function updateProjectDates(projectId: string) {
    const data = editingDates[projectId];
    if (!data) return;
    
    try {
      await apiFetch(`/workshop/project/${projectId}`, {
        method: "PATCH",
        json: {
          startDate: data.startDate || null,
          deliveryDate: data.deliveryDate || null,
          valueGBP: data.value ? Number(data.value) : null,
        },
      });
      setEditingDates(prev => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      await loadAll();
    } catch (e) {
      console.error("Failed to update project dates", e);
    }
  }

  function startEditingDates(proj: Project) {
    setEditingDates(prev => ({
      ...prev,
      [proj.id]: {
        startDate: proj.startDate || '',
        deliveryDate: proj.deliveryDate || '',
        value: proj.valueGBP?.toString() || '',
      }
    }));
  }

  function cancelEditingDates(projectId: string) {
    setEditingDates(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  }

  // Drag and drop handlers
  function handleDragStart(projectId: string) {
    setDraggingProject(projectId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(date: Date) {
    if (!draggingProject) return;
    
    const proj = projects.find(p => p.id === draggingProject);
    if (!proj || !proj.startDate || !proj.deliveryDate) return;
    
    // Calculate duration
    const oldStart = new Date(proj.startDate);
    const oldEnd = new Date(proj.deliveryDate);
    const duration = oldEnd.getTime() - oldStart.getTime();
    
    // Set new dates
    const newStart = date;
    const newEnd = new Date(newStart.getTime() + duration);
    
    try {
      await apiFetch(`/workshop/project/${draggingProject}`, {
        method: "PATCH",
        json: {
          startDate: newStart.toISOString().split('T')[0],
          deliveryDate: newEnd.toISOString().split('T')[0],
        },
      });
      await loadAll();
    } catch (e) {
      console.error("Failed to update project dates", e);
    } finally {
      setDraggingProject(null);
    }
  }

  // Fullscreen toggle for workshop display
  function toggleFullscreen() {
    if (!isFullscreen) {
      // Enter fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
      // Hide app shell by adding class to body
      document.body.classList.add('workshop-display-mode');
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
      // Show app shell again
      document.body.classList.remove('workshop-display-mode');
    }
  }

  // Listen for fullscreen changes (e.g., user presses ESC)
  useEffect(() => {
    function handleFullscreenChange() {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).msFullscreenElement);
      setIsFullscreen(isCurrentlyFullscreen);
      
      // Sync body class with fullscreen state
      if (isCurrentlyFullscreen) {
        document.body.classList.add('workshop-display-mode');
      } else {
        document.body.classList.remove('workshop-display-mode');
      }
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      // Clean up class when component unmounts
      document.body.classList.remove('workshop-display-mode');
    };
  }, []);

  // Hours tracking
  function openHoursModal(projectId: string, projectName: string) {
    setShowHoursModal({ projectId, projectName });
    setHoursForm({
      process: "",
      userId: "",
      hours: "",
      date: new Date().toISOString().split('T')[0]
    });
  }

  function closeHoursModal() {
    setShowHoursModal(null);
  }

  async function saveHours() {
    if (!showHoursModal || !hoursForm.process || !hoursForm.userId || !hoursForm.hours) return;
    
    try {
      await apiFetch("/workshop/time", {
        method: "POST",
        json: {
          projectId: showHoursModal.projectId,
          process: hoursForm.process,
          userId: hoursForm.userId,
          date: hoursForm.date,
          hours: Number(hoursForm.hours),
        },
      });
      closeHoursModal();
      await loadAll();
    } catch (e: any) {
      alert('Failed to log hours: ' + (e?.message || 'Unknown error'));
      console.error("Failed to log hours", e);
    }
  }

  // Handle QR code scan success
  function handleQRScanSuccess(qrUrl: string) {
    setShowQRScanner(false);
    
    // Extract the URL path and navigate to it
    try {
      const url = new URL(qrUrl);
      window.location.href = url.pathname;
    } catch (e) {
      // If it's just a path, navigate directly
      if (qrUrl.startsWith('/')) {
        window.location.href = qrUrl;
      } else {
        toast({
          variant: "destructive",
          title: "Invalid QR Code",
          description: "Could not parse QR code URL",
        });
      }
    }
  }

  const weeksArray = Array.from({ length: weeks }, (_, i) => i + 1);

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    
    // Convert to Monday-start (0=Monday, 6=Sunday)
    const mondayBasedOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < mondayBasedOffset; i++) {
      days.push(null);
    }
    
    // Add actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // Get ISO week number (1-53) for a given date
  function getISOWeek(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Get the start date for a given weekNum (1-4 representing weeks within the current month view)
  function getWeekStartDate(weekNum: number): Date {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstDayOfWeek = monthStart.getDay();
    // Convert to Monday-based: if Sunday (0), go back 6 days; otherwise go back (day - 1) days
    const mondayBasedOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const firstMonday = new Date(monthStart);
    firstMonday.setDate(monthStart.getDate() - mondayBasedOffset);
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + ((weekNum - 1) * 7));
    return weekStart;
  }

  // Calculate all weeks shown in the current calendar view
  const getVisibleWeeks = () => {
    const daysArray = getDaysInMonth(currentMonth);
    const validDays = daysArray.filter(d => d !== null) as Date[];
    if (validDays.length === 0) return [];
    
    // Get first and last days of the calendar view
    const firstDay = validDays[0];
    const lastDay = validDays[validDays.length - 1];
    
    // Calculate week starts for entire range
    const weeks: { weekNum: number; isoWeek: number; startDate: Date; endDate: Date }[] = [];
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstDayOfWeek = monthStart.getDay();
    // Convert to Monday-based offset
    const mondayBasedOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const firstMonday = new Date(monthStart);
    firstMonday.setDate(monthStart.getDate() - mondayBasedOffset);
    
    let currentWeekStart = new Date(firstMonday);
    let weekNum = 1;
    
    // Generate weeks until we're past the last day
    while (currentWeekStart <= lastDay) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);
      
      weeks.push({
        weekNum,
        isoWeek: getISOWeek(currentWeekStart),
        startDate: new Date(currentWeekStart),
        endDate: weekEnd,
      });
      
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      weekNum++;
    }
    
    return weeks;
  };

  const visibleWeeks = getVisibleWeeks();

  const getProjectsForWeek = (weekNumber: number) => {
    return projects.filter(proj => 
      proj.processPlans.some(plan => plan.plannedWeek === weekNumber)
    );
  };

  // Capacity planning helpers
  const isWeekday = (d: Date) => {
    const day = d.getDay();
    return day !== 0 && day !== 6; // Mon-Fri
  };

  const eachDay = (start: Date, end: Date) => {
    const days: Date[] = [];
    const cur = new Date(start);
    cur.setHours(0,0,0,0);
    const last = new Date(end);
    last.setHours(0,0,0,0);
    while (cur <= last) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  };

  const countWeekdaysInRange = (start: Date, end: Date) => eachDay(start, end).filter(isWeekday).length;

  const dayInHoliday = (d: Date, h: Holiday) => {
    const sd = new Date(h.startDate.split('T')[0]);
    const ed = new Date(h.endDate.split('T')[0]);
    sd.setHours(0,0,0,0);
    ed.setHours(0,0,0,0);
    const dc = new Date(d);
    dc.setHours(0,0,0,0);
    return dc >= sd && dc <= ed;
  };

  const getWeekCapacity = (weekNumber: number) => {
    // Week 1 = first week of current month
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstDayOfWeek = monthStart.getDay();
    const firstSunday = new Date(monthStart);
    firstSunday.setDate(monthStart.getDate() - firstDayOfWeek);
    
    const weekStart = new Date(firstSunday);
    weekStart.setDate(firstSunday.getDate() + ((weekNumber - 1) * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const days = eachDay(weekStart, weekEnd).filter(isWeekday);
    // For each user, count working weekdays not covered by a holiday
    let totalHrs = 0;
    for (const u of users) {
      const userHoursPerDay = u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8;
      const userHols = holidays.filter(h => h.userId === u.id);
      const workingDays = days.filter(d => !userHols.some(h => dayInHoliday(d, h))).length;
      totalHrs += workingDays * userHoursPerDay;
    }
    return totalHrs;
  };

  const getProjectExpectedHours = (proj: Project) => {
    if (proj.expectedHours != null && proj.expectedHours !== "") return Number(proj.expectedHours) || 0;
    if (proj.totalProjectHours != null) return Number(proj.totalProjectHours) || 0;
    return 0;
  };

  const getWeekDemand = (weekNumber: number) => {
    // Week 1 = first week of current month
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstDayOfWeek = monthStart.getDay();
    const firstSunday = new Date(monthStart);
    firstSunday.setDate(monthStart.getDate() - firstDayOfWeek);
    
    const weekStart = new Date(firstSunday);
    weekStart.setDate(firstSunday.getDate() + ((weekNumber - 1) * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    let total = 0;
    for (const proj of projects) {
      if (!proj.startDate || !proj.deliveryDate) continue;
      const ps = new Date(proj.startDate);
      const pe = new Date(proj.deliveryDate);
      const overlapStart = new Date(Math.max(ps.getTime(), weekStart.getTime()));
      const overlapEnd = new Date(Math.min(pe.getTime(), weekEnd.getTime()));
      if (overlapStart > overlapEnd) continue;
      const projDays = Math.max(1, countWeekdaysInRange(ps, pe));
      const overlapDays = countWeekdaysInRange(overlapStart, overlapEnd);
      const expected = getProjectExpectedHours(proj);
      if (projDays > 0 && expected > 0) {
        total += expected * (overlapDays / projDays);
      }
    }
    return Math.round(total);
  };

  // Calculate proportional value for a date range
  const getProportionalValue = (proj: Project, rangeStart: Date, rangeEnd: Date) => {
    if (!proj.startDate || !proj.deliveryDate || !proj.valueGBP) return 0;
    
    const projectStart = new Date(proj.startDate);
    projectStart.setHours(0, 0, 0, 0);
    const projectEnd = new Date(proj.deliveryDate);
    projectEnd.setHours(23, 59, 59, 999);
    const value = Number(proj.valueGBP) || 0;
    
    if (value === 0) return 0;
    
    // Calculate overlap between project dates and range
    const overlapStart = new Date(Math.max(projectStart.getTime(), rangeStart.getTime()));
    const overlapEnd = new Date(Math.min(projectEnd.getTime(), rangeEnd.getTime()));
    
    // No overlap if range doesn't intersect with project
    if (overlapStart > overlapEnd) return 0;
    
    // Calculate days (use full 24h periods)
    const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalProjectDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const proportionalValue = (value * overlapDays) / totalProjectDays;
    return proportionalValue;
  };

  const getWeekTotal = (weekNumber: number) => {
    // Week 1 = first week of current month, Week 2 = second week, etc.
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    
    // Find the Sunday of the week containing the 1st of the month
    const firstDayOfWeek = monthStart.getDay(); // 0 = Sunday
    const firstSunday = new Date(monthStart);
    firstSunday.setDate(monthStart.getDate() - firstDayOfWeek);
    
    // Calculate week start based on weekNumber (1-based)
    const weekStart = new Date(firstSunday);
    weekStart.setDate(firstSunday.getDate() + ((weekNumber - 1) * 7));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    let total = 0;
    for (const proj of projects) {
      const projValue = getProportionalValue(proj, weekStart, weekEnd);
      total += projValue;
    }
    
    return total;
  };

  const getMonthTotal = () => {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    return projects.reduce((sum, proj) => {
      return sum + getProportionalValue(proj, monthStart, monthEnd);
    }, 0);
  };

  const getProjectsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return projects.filter(proj => {
      if (!proj.startDate || !proj.deliveryDate) return false;
      const start = proj.startDate.split('T')[0];
      const end = proj.deliveryDate.split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  // Calculate project progress percentage
  const getProjectProgress = (proj: Project) => {
    if (!proj.startDate || !proj.deliveryDate) return 0;
    
    const now = new Date();
    const start = new Date(proj.startDate);
    const end = new Date(proj.deliveryDate);
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    return Math.round((elapsed / total) * 100);
  };

  // Get color based on progress
  const getProgressColor = (progress: number) => {
    if (progress === 0) return 'bg-slate-100 text-slate-800';
    if (progress < 25) return 'bg-green-100 text-green-800';
    if (progress < 50) return 'bg-green-200 text-green-900';
    if (progress < 75) return 'bg-green-300 text-green-900';
    if (progress < 100) return 'bg-green-400 text-green-950';
    return 'bg-green-500 text-white';
  };

  // Month navigation
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setCurrentWeek(new Date());
    setCurrentYear(new Date().getFullYear());
  };

  // Week navigation
  const previousWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() - 7);
    setCurrentWeek(newWeek);
  };

  const nextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + 7);
    setCurrentWeek(newWeek);
  };

  // Year navigation
  const previousYear = () => {
    setCurrentYear(currentYear - 1);
  };

  const nextYear = () => {
    setCurrentYear(currentYear + 1);
  };

  // Month click from year view - switch to month view for that month
  const handleMonthClick = (year: number, month: number) => {
    setCurrentMonth(new Date(year, month - 1, 1));
    setCalendarViewMode('month');
  };

  // Grid view helper functions
  const calculateProcessPercentage = (project: Project, processCode: string): number => {
    const assignments = project.processAssignments || [];
    const processAssignment = assignments.find(pa => pa.processCode === processCode);
    if (!processAssignment) return 0;
    
    const totalHours = project.totalHoursByProcess?.[processCode] || 0;
    const estimatedHours = processAssignment.estimatedHours || 0;
    
    if (estimatedHours === 0) return 0;
    return Math.round((totalHours / estimatedHours) * 100);
  };

  const getAvailableGridFields = () => {
    const baseFields = [
      { field: 'name', label: 'Project Name', type: 'text' },
      { field: 'valueGBP', label: 'Value (£)', type: 'number' },
      { field: 'startDate', label: 'Start Date', type: 'date' },
      { field: 'deliveryDate', label: 'Delivery Date', type: 'date' },
      { field: 'installationStartDate', label: 'Installation Start', type: 'date' },
      { field: 'installationEndDate', label: 'Installation End', type: 'date' },
      { field: 'expectedHours', label: 'Expected Hours', type: 'number' },
      { field: 'actualHours', label: 'Actual Hours', type: 'number' },
      { field: 'totalProjectHours', label: 'Total Hours', type: 'number' },
      { field: 'timberOrderedAt', label: 'Timber Ordered', type: 'date' },
      { field: 'timberExpectedAt', label: 'Timber Expected', type: 'date' },
      { field: 'timberReceivedAt', label: 'Timber Received', type: 'date' },
      { field: 'glassOrderedAt', label: 'Glass Ordered', type: 'date' },
      { field: 'glassExpectedAt', label: 'Glass Expected', type: 'date' },
      { field: 'glassReceivedAt', label: 'Glass Received', type: 'date' },
      { field: 'ironmongeryOrderedAt', label: 'Ironmongery Ordered', type: 'date' },
      { field: 'ironmongeryExpectedAt', label: 'Ironmongery Expected', type: 'date' },
      { field: 'ironmongeryReceivedAt', label: 'Ironmongery Received', type: 'date' },
      { field: 'paintOrderedAt', label: 'Paint Ordered', type: 'date' },
      { field: 'paintExpectedAt', label: 'Paint Expected', type: 'date' },
      { field: 'paintReceivedAt', label: 'Paint Received', type: 'date' },
    ];

    // Add process percentage columns
    const processFields = processDefs.map(proc => ({
      field: `${proc.code}_percentage`,
      label: `${proc.name} %`,
      type: 'progress',
    }));

    return [...baseFields, ...processFields];
  };

  const getDefaultDropdownOptions = (field: string): string[] => {
    // Return empty array as default - no dropdowns in workshop grid by default
    return [];
  };

  // Load column config for grid view
  useEffect(() => {
    if (viewMode === 'grid' && typeof window !== 'undefined') {
      const saved = localStorage.getItem('workshop-grid-column-config');
      if (saved) {
        try {
          setColumnConfig(JSON.parse(saved));
        } catch {
          // Set default config
          setColumnConfig([
            { field: 'name', label: 'Project Name', visible: true, frozen: true, width: 250 },
            { field: 'valueGBP', label: 'Value (£)', visible: true, frozen: false, width: 120, type: 'number' },
            { field: 'startDate', label: 'Start Date', visible: true, frozen: false, width: 150, type: 'date' },
            { field: 'deliveryDate', label: 'Delivery Date', visible: true, frozen: false, width: 150, type: 'date' },
            { field: 'totalProjectHours', label: 'Total Hours', visible: true, frozen: false, width: 120, type: 'number' },
            ...processDefs.map(proc => ({
              field: `${proc.code}_percentage`,
              label: `${proc.name} %`,
              visible: true,
              frozen: false,
              width: 150,
              type: 'progress',
            })),
          ]);
        }
      } else {
        // Set default config
        setColumnConfig([
          { field: 'name', label: 'Project Name', visible: true, frozen: true, width: 250 },
          { field: 'valueGBP', label: 'Value (£)', visible: true, frozen: false, width: 120, type: 'number' },
          { field: 'startDate', label: 'Start Date', visible: true, frozen: false, width: 150, type: 'date' },
          { field: 'deliveryDate', label: 'Delivery Date', visible: true, frozen: false, width: 150, type: 'date' },
          { field: 'totalProjectHours', label: 'Total Hours', visible: true, frozen: false, width: 120, type: 'number' },
          ...processDefs.map(proc => ({
            field: `${proc.code}_percentage`,
            label: `${proc.name} %`,
            visible: true,
            frozen: false,
            width: 150,
            type: 'progress',
          })),
        ]);
      }
    }
  }, [viewMode, processDefs]);

  if (loading) return (
    <div className="p-2">
      <h1 className="text-2xl font-semibold mb-2">Workshop</h1>
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );

  return (
    <div className={`space-y-6 ${isWorkshopOnly ? 'p-4' : ''} ${isFullscreen ? 'p-8 bg-slate-50 min-h-screen' : ''}`}>
      <NotificationPrompt 
        onEnable={requestPermission}
        permission={permission}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workshop</h1>
          {isFullscreen && (
            <div className="text-xs text-muted-foreground mt-1">
              Last updated: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {' • '}Auto-refreshes every 5 minutes
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <NotificationToggle 
            permission={permission}
            onEnable={requestPermission}
          />
          <span className="text-sm text-muted-foreground">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
          
          {/* View Mode Toggle */}
          {!isWorkshopOnly && (
            <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
              <Button 
                variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => {
                  setViewMode('calendar');
                  if (typeof window !== 'undefined') localStorage.setItem('workshop-view-mode', 'calendar');
                }}
                className="h-8"
              >
                <CalendarIcon className="w-4 h-4 mr-1" />
                Calendar
              </Button>
              <Button 
                variant={viewMode === 'timeline' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => {
                  setViewMode('timeline');
                  if (typeof window !== 'undefined') localStorage.setItem('workshop-view-mode', 'timeline');
                }}
                className="h-8"
              >
                Timeline
              </Button>
              <Button 
                variant={viewMode === 'grid' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => {
                  setViewMode('grid');
                  if (typeof window !== 'undefined') localStorage.setItem('workshop-view-mode', 'grid');
                }}
                className="h-8"
              >
                <LayoutGrid className="w-4 h-4 mr-1" />
                Grid
              </Button>
            </div>
          )}
          
          {/* Quick Actions Dropdown */}
          {!isWorkshopOnly && (
            <Select onValueChange={(value) => {
              if (value === 'timesheets') window.location.href = '/timesheets';
              else if (value === 'quicklog') setShowQuickLog(true);
              else if (value === 'holidays') setShowHolidayModal(true);
              else if (value === 'usercolors') setShowUserColors(true);
              else if (value === 'groupprojects') setGroupProjectsOpen(true);
            }}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quicklog">📝 Quick Log Hours</SelectItem>
                <SelectItem value="timesheets">📋 View Timesheets</SelectItem>
                <SelectItem value="holidays">🏖️ Holidays</SelectItem>
                <SelectItem value="usercolors">🎨 User Colors</SelectItem>
                <SelectItem value="groupprojects">📦 Group Projects</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          {/* Display Options Dropdown */}
          {!isWorkshopOnly && (
            <Select onValueChange={(value) => {
              if (value === 'workshop') setShowValues(false);
              else if (value === 'values') setShowValues(true);
              else if (value === 'fullscreen') toggleFullscreen();
            }} value={showValues ? 'values' : 'workshop'}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workshop">🔧 Workshop View</SelectItem>
                <SelectItem value="values">£ Values View</SelectItem>
                <SelectItem value="fullscreen">{isFullscreen ? '↙️ Exit Display' : '📺 Display Mode'}</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Direct Group Projects button */}
          {!isWorkshopOnly && (
            <Button
              onClick={() => setGroupProjectsOpen(true)}
              className="bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 text-white h-9"
            >
              📦 Group Projects
            </Button>
          )}
          
          {/* Timeline Filter (only shown in timeline view) */}
          {!isWorkshopOnly && viewMode === 'timeline' && (
            <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
              <Button 
                variant={timelineViewFilter === 'both' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setTimelineViewFilter('both')}
                className="h-8 px-2"
                title="Show both"
              >
                Both
              </Button>
              <Button 
                variant={timelineViewFilter === 'manufacturing' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setTimelineViewFilter('manufacturing')}
                className="h-8 px-2"
                title="Manufacturing only"
              >
                🏭
              </Button>
              <Button 
                variant={timelineViewFilter === 'installation' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setTimelineViewFilter('installation')}
                className="h-8 px-2"
                title="Installation only"
              >
                🔧
              </Button>
            </div>
          )}
          
          <Button variant="outline" size="sm" onClick={loadAll} className="h-9">
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Timer Widget - Mobile optimized */}
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex justify-center gap-3 flex-wrap">
          <Button 
            variant={viewMode === 'calendar' ? 'default' : 'outline'} 
            size="lg"
            onClick={() => setViewMode('calendar')}
            className="font-bold"
          >
            📅 Schedule
          </Button>
          <Button 
            variant={viewMode === 'tasks' ? 'default' : 'outline'} 
            size="lg"
            onClick={() => setViewMode('tasks')}
            className="font-bold relative"
          >
            📋 My Tasks
            {myTasksCount > 0 && (
              <Badge variant="destructive" className="ml-2 px-2 py-0.5 text-xs">
                {myTasksCount}
              </Badge>
            )}
          </Button>
          <Button 
            variant={viewMode === 'timesheet' ? 'default' : 'outline'} 
            size="lg"
            onClick={() => setViewMode('timesheet')}
            className="font-bold"
          >
            📊 My Timesheet
          </Button>
          {isWorkshopOnly && (
            <Button
              variant={viewMode === 'timber' ? 'default' : 'outline'}
              size="lg"
              onClick={async () => {
                setViewMode('timber');
                await ensureTimberMaterialsLoaded();
              }}
              className="font-bold"
            >
              🪵 Timber
            </Button>
          )}
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setShowQRScanner(true)}
            className="font-bold"
          >
            📷 QR Code
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setShowHolidayModal(true)}
            className="font-bold"
          >
            🏖️ Holidays
          </Button>
        </div>
        <WorkshopTimer
          ref={timerRef}
          projects={projects.map(p => ({
            id: p.id,
            title: (p.groupId && p.groupName) ? p.groupName : p.name,
          }))}
          processes={processDefs.map(p => ({ code: p.code, name: p.name, isGeneric: p.isGeneric }))}
          onTimerChange={loadAll}
          currentUser={user}
        />
      </div>

      {/* Connection/Config hints when nothing is visible */}
      {projects.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
          {loadError ? (
            <div>
              <div className="font-semibold">Couldn’t load the workshop schedule.</div>
              <div className="text-amber-800/90">{loadError}</div>
            </div>
          ) : (
            <div>
              <div className="font-semibold">No projects yet.</div>
              <div>Mark a lead as Won to create a project automatically, or backfill existing Won leads.</div>
            </div>
          )}
          {holidayError && (
            <div className="text-amber-800/80">Holidays couldn’t be loaded: {holidayError}</div>
          )}
          {(!API_BASE && typeof window !== "undefined") ? (
            <div className="text-amber-800/80">
              Tip: API base isn’t configured for the browser. Either set NEXT_PUBLIC_API_BASE, or set API_ORIGIN for server rewrites.
            </div>
          ) : null}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                setBackfillBusy(true);
                try {
                  await apiFetch("/workshop/backfill", { method: "POST" });
                  await loadAll();
                } catch (e) {
                          alert((e as any)?.message || "Backfill failed");
                } finally {
                  setBackfillBusy(false);
                }
              }}
              disabled={backfillBusy}
            >
              {backfillBusy ? "Backfilling…" : "Backfill Won leads → Projects"}
            </Button>
          </div>
        </div>
      )}

      {/* Calendar View with Week/Month/Year Tabs */}
      {viewMode === 'calendar' && projects.length > 0 && (
        <div className="space-y-4">
          {/* Calendar View Mode Tabs */}
          <Tabs value={calendarViewMode} onValueChange={(v) => setCalendarViewMode(v as 'week' | 'month' | 'year')}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>

            {/* Week View */}
            <TabsContent value="week" className="mt-4">
              <CalendarWeekView
                currentWeek={currentWeek}
                projects={scheduleProjects}
                users={users}
                holidays={holidays}
                showValues={showValues}
                timelineViewFilter={timelineViewFilter}
                onPreviousWeek={previousWeek}
                onNextWeek={nextWeek}
                onToday={goToToday}
                onProjectClick={setShowProjectDetails}
                onDragStart={(projectId) => {
                  const p = scheduleProjects.find(x => x.id === projectId);
                  if (p?.groupMembers && p.groupMembers.length > 0) return;
                  handleDragStart(projectId);
                }}
                onProjectDrop={(projectId, date) => {
                  // Reuse existing drop logic
                  if (draggingProject) handleDrop(date);
                }}
              />
            </TabsContent>

            {/* Month View */}
            <TabsContent value="month" className="mt-4">
              <div className="space-y-4">
                {/* Month Navigation with Total */}
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="outline" size="sm" onClick={previousMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h2 className="text-xl font-semibold">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={goToToday}>
                        Today
                      </Button>
                      <Button variant="outline" size="sm" onClick={nextMonth}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
            {showValues && !isWorkshopOnly && (
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Month Total Value</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(getMonthTotal())}
                </div>
              </div>
            )}
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-lg border overflow-hidden relative">
            {/* Calendar header - days of week */}
            <div className="grid grid-cols-7 border-b bg-slate-50">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="p-2 text-center text-xs font-semibold text-slate-600 border-r last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar body - days with date numbers only */}
            {(() => {
              // Calculate required height based on number of project rows
              const daysArray = getDaysInMonth(currentMonth);
              const validDays = daysArray.filter(d => d !== null) as Date[];
              const monthStart = validDays.length > 0 ? validDays[0] : new Date();
              const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
              const projectRows = calculateProjectRows(scheduleProjects, monthStart, monthEnd);
              
              // Calculate weeks in month
              const weeksInMonth = Math.ceil(daysArray.length / 7);

              // Keep day numbers visible and stack overlapping projects within each week row.
              // Each overlap row uses a consistent block height (mfg + install + gap).
              const headerOffset = 32;
              const stackBlockHeight = 52;
              const maxStacks = Math.max(1, projectRows.length);
              const rowHeight = Math.max(128, headerOffset + maxStacks * stackBlockHeight + 8);
              const minHeight = Math.max(600, weeksInMonth * rowHeight);
              
              return (
                <div className="grid grid-cols-7 relative" style={{ minHeight: `${minHeight}px`, gridAutoRows: `${rowHeight}px` }}>
                  {daysArray.map((date, idx) => {
                const isToday = date && 
                  date.getDate() === new Date().getDate() &&
                  date.getMonth() === new Date().getMonth() &&
                  date.getFullYear() === new Date().getFullYear();
                
                const isWeekend = date && (date.getDay() === 0 || date.getDay() === 6);
                
                return (
                  <div
                    key={idx}
                    className={`min-h-32 border-r border-b last:border-r-0 p-2 relative ${
                      !date ? 'bg-slate-50' : 
                      isWeekend ? 'bg-slate-100' :
                      isToday ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                    }`}
                    style={{ zIndex: 1 }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (date) handleDrop(date);
                    }}
                  >
                    {date && (
                      <div
                        className={`relative z-20 inline-flex min-w-6 justify-center rounded bg-white/80 px-1 text-sm font-medium ${isToday ? 'text-blue-600' : 'text-slate-700'}`}
                      >
                        {date.getDate()}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Project bars overlay - absolute positioned to span across days */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
                {(() => {
                  const headerOffset = 32;
                  const stackBlockHeight = 52;
                  const daysArray = getDaysInMonth(currentMonth);
                  const validDays = daysArray.filter(d => d !== null) as Date[];
                  if (validDays.length === 0) return null;
                  
                  const monthStart = validDays[0];
                  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                  const firstDayOffset = daysArray.findIndex(d => d !== null);
                  
                  // Group projects by row to avoid overlaps
                  const projectRows = calculateProjectRows(scheduleProjects, monthStart, monthEnd);
                  const maxStacks = Math.max(1, projectRows.length);
                  const rowHeight = Math.max(128, headerOffset + maxStacks * stackBlockHeight + 8);
                  
                  return (
                    <>
                      {/* Manufacturing overlays */}
                      {(timelineViewFilter === 'both' || timelineViewFilter === 'manufacturing') && projectRows.map((row, rowIdx) =>
                        row.flatMap((proj) => {
                          const projStart = new Date(proj.startDate!);
                          const projEnd = new Date(proj.deliveryDate!);

                          const visibleStart = projStart < monthStart ? monthStart : projStart;
                          const visibleEnd = projEnd > monthEnd ? monthEnd : projEnd;

                          const daysSinceMonthStart = Math.floor((visibleStart.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
                          const duration = Math.floor((visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                          const startCol = firstDayOffset + daysSinceMonthStart;
                          const startRow = Math.floor(startCol / 7);
                          const startDayOfWeek = startCol % 7;

                          const segments: Array<{row: number, col: number, span: number}> = [];
                          let remainingDays = duration;
                          let currentRow = startRow;
                          let currentCol = startDayOfWeek;

                          while (remainingDays > 0) {
                            const daysToEndOfWeek = 7 - currentCol;
                            const segmentDays = Math.min(remainingDays, daysToEndOfWeek);
                            segments.push({ row: currentRow, col: currentCol, span: segmentDays });
                            remainingDays -= segmentDays;
                            currentRow++;
                            currentCol = 0;
                          }

                          const progress = getProjectProgress(proj);
                          const projectColor = getProjectColor(proj, users);

                          return segments.map((segment, segIdx) => {
                            const assignedUsers = (proj.processAssignments || [])
                              .filter(pa => pa.assignedUser)
                              .map(pa => pa.assignedUser!.name || pa.assignedUser!.email.split('@')[0])
                              .filter((name, idx, arr) => arr.indexOf(name) === idx);

                            const usersSummary = assignedUsers.length > 0
                              ? ` | Assigned: ${assignedUsers.join(', ')}`
                              : '';

                            const background = projectColor.startsWith('linear-gradient')
                              ? projectColor
                              : `linear-gradient(90deg, #22c55e ${progress}%, ${projectColor} ${progress}%)`;

                            const timberStatus = getMaterialStatus(proj.timberOrderedAt, proj.timberReceivedAt, proj.timberNotApplicable);
                            const glassStatus = getMaterialStatus(proj.glassOrderedAt, proj.glassReceivedAt, proj.glassNotApplicable);
                            const ironmongeryStatus = getMaterialStatus(proj.ironmongeryOrderedAt, proj.ironmongeryReceivedAt, proj.ironmongeryNotApplicable);
                            const paintStatus = getMaterialStatus(proj.paintOrderedAt, proj.paintReceivedAt, proj.paintNotApplicable);

                            return (
                              <div
                                key={`${proj.id}-mfg-${rowIdx}-${segIdx}`}
                                className="absolute rounded text-xs font-medium text-white cursor-pointer hover:opacity-90 pointer-events-auto flex items-stretch gap-1"
                                style={{
                                  top: `${segment.row * rowHeight + headerOffset + rowIdx * stackBlockHeight}px`,
                                  left: `${(segment.col / 7) * 100}%`,
                                  width: `${(segment.span / 7) * 100}%`,
                                }}
                                draggable={!(proj.groupMembers && proj.groupMembers.length > 0)}
                                onDragStart={() => {
                                  if (!(proj.groupMembers && proj.groupMembers.length > 0)) {
                                    handleDragStart(proj.id);
                                  }
                                }}
                                onClick={() => setShowProjectDetails(proj.id)}
                                title={`${getProjectDisplayName(proj)} (${progress}% complete)${usersSummary}`}
                              >
                                {segIdx === 0 && (
                                  <div className="flex gap-0.5 shrink-0 items-center pl-1 pr-0.5 py-1 bg-white rounded-l">
                                    <div className="flex flex-col items-center">
                                      <div className="text-[8px] font-bold leading-none mb-0.5 text-gray-700">T</div>
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getMaterialColor(timberStatus) }} title="Timber" />
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="text-[8px] font-bold leading-none mb-0.5 text-gray-700">G</div>
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getMaterialColor(glassStatus) }} title="Glass" />
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="text-[8px] font-bold leading-none mb-0.5 text-gray-700">I</div>
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getMaterialColor(ironmongeryStatus) }} title="Ironmongery" />
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="text-[8px] font-bold leading-none mb-0.5 text-gray-700">P</div>
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getMaterialColor(paintStatus) }} title="Paint" />
                                    </div>
                                  </div>
                                )}
                                <div className={`flex items-center gap-1 px-2 py-1 flex-1 ${segIdx === 0 ? 'rounded-r' : 'rounded'}`} style={{ background }}>
                                  <div className="truncate flex-1">{getProjectDisplayName(proj)}</div>
                                  {assignedUsers.length > 0 && (
                                    <div className="text-[10px] opacity-90 truncate shrink-0">
                                      👤 {assignedUsers.slice(0, 2).join(', ')}
                                      {assignedUsers.length > 2 && ` +${assignedUsers.length - 2}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })
                      )}

                      {/* Installation overlays */}
                      {(timelineViewFilter === 'both' || timelineViewFilter === 'installation') && projectRows.map((row, rowIdx) =>
                        row.flatMap((proj) => {
                          if (!proj.installationStartDate || !proj.installationEndDate) return [];
                          const instStart = new Date(proj.installationStartDate);
                          const instEnd = new Date(proj.installationEndDate);

                          if (instEnd < monthStart || instStart > monthEnd) return [];

                          const visibleStart = instStart < monthStart ? monthStart : instStart;
                          const visibleEnd = instEnd > monthEnd ? monthEnd : instEnd;

                          const daysSinceMonthStart = Math.floor((visibleStart.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
                          const duration = Math.floor((visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                          const startCol = firstDayOffset + daysSinceMonthStart;
                          const startRow = Math.floor(startCol / 7);
                          const startDayOfWeek = startCol % 7;

                          const segments: Array<{row: number, col: number, span: number}> = [];
                          let remainingDays = duration;
                          let currentRow = startRow;
                          let currentCol = startDayOfWeek;

                          while (remainingDays > 0) {
                            const daysToEndOfWeek = 7 - currentCol;
                            const segmentDays = Math.min(remainingDays, daysToEndOfWeek);
                            segments.push({ row: currentRow, col: currentCol, span: segmentDays });
                            remainingDays -= segmentDays;
                            currentRow++;
                            currentCol = 0;
                          }

                          return segments.map((segment, segIdx) => (
                            <div
                              key={`${proj.id}-inst-${rowIdx}-${segIdx}`}
                              className="absolute rounded text-[10px] font-medium text-white pointer-events-auto"
                              style={{
                                top: `${segment.row * rowHeight + headerOffset + rowIdx * stackBlockHeight + 24}px`,
                                left: `${(segment.col / 7) * 100}%`,
                                width: `${(segment.span / 7) * 100}%`,
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                                border: '2px dashed rgba(255,255,255,0.7)'
                              }}
                              onClick={() => setShowProjectDetails(proj.id)}
                              title={`${getProjectDisplayName(proj)} – Installation`}
                            >
                              <div className="flex items-center gap-1 px-2 py-0.5">
                                <span>🔧</span>
                                <span className="truncate">Install</span>
                              </div>
                            </div>
                          ));
                        })
                      )}
                    </>
                  );
                })()}
              </div>
                </div>
              );
            })()}
          </div>

          {/* Week Summary below calendar - Removed per request */}
              </div>
            </TabsContent>

            {/* Year View */}
            <TabsContent value="year" className="mt-4">
              <CalendarYearView
                currentYear={currentYear}
                projects={scheduleProjects}
                users={users}
                holidays={holidays}
                showValues={showValues}
                onPreviousYear={previousYear}
                onNextYear={nextYear}
                onToday={goToToday}
                onMonthClick={handleMonthClick}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Timeline (Swimlane) View */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {/* Navigation Controls */}
          <div className="flex items-center justify-between bg-white rounded-lg border p-4 shadow-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous Month
            </Button>
            
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToToday}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                Today
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
              className="flex items-center gap-2"
            >
              Next Month
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <WorkshopSwimlaneTimeline
            projects={scheduleProjects as any}
            users={users as any}
            visibleWeeks={visibleWeeks}
            onProjectClick={(id: string) => setShowProjectDetails(id)}
          />
        </div>
      )}

      {/* Tasks View */}
      {viewMode === 'tasks' && (
        <div className="space-y-4">
          {/* Filter Controls */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Workshop Tasks</h2>
              <div className="flex gap-2">
                <Button
                  variant={tasksFilter === 'open' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTasksFilter('open')}
                >
                  Open
                </Button>
                <Button
                  variant={tasksFilter === 'in_progress' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTasksFilter('in_progress')}
                >
                  In Progress
                </Button>
                <Button
                  variant={tasksFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTasksFilter('all')}
                >
                  All
                </Button>
              </div>
            </div>
          </Card>

          {/* Tasks List */}
          <div className="space-y-3">
            {workshopTasks.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <p>No tasks found for the selected filter.</p>
              </Card>
            ) : (
              workshopTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  compact={true}
                  onComplete={async () => {
                    // Check if task has linked material
                    const materialType = task.meta?.linkedMaterialType;
                    const opportunityId = task.meta?.linkedOpportunityId;
                    
                    if (materialType && opportunityId) {
                      // Show material order dialog to collect dates
                      setShowMaterialOrder({
                        taskId: task.id,
                        taskTitle: task.title,
                        materialType,
                        opportunityId
                      });
                    } else {
                      // Just mark done without material prompt
                      try {
                        await apiFetch(`/tasks/${task.id}/complete`, {
                          method: 'POST',
                        });
                        await loadWorkshopTasks();
                        await loadAll();
                      } catch (e: any) {
                        alert('Failed to complete task: ' + (e?.message || 'Unknown error'));
                      }
                    }
                  }}
                  onEdit={() => {
                    setSelectedTaskId(task.id);
                  }}
                  onChecklistToggle={async (itemId) => {
                    try {
                      await apiFetch(`/tasks/${task.id}/checklist/${itemId}/toggle`, {
                        method: 'POST',
                      });
                      await loadWorkshopTasks();
                    } catch (e: any) {
                      console.error('Failed to toggle checklist item:', e);
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Timber logging (Workshop users) */}
      {viewMode === 'timber' && isWorkshopOnly && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="space-y-3">
              <div className="font-semibold">Timber totals</div>
              <div className="max-w-md">
                <Select
                  value={timberViewProjectId}
                  onValueChange={async (v) => {
                    setTimberViewProjectId(v);
                    if (v) await refreshTimberUsageForProject(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {getProjectDisplayName(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {timberViewProjectId ? (
                <div className="text-sm text-muted-foreground">
                  {timberViewLoading ? (
                    'Loading…'
                  ) : timberViewError ? (
                    timberViewError
                  ) : timberViewTotals ? (
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <span className="font-medium text-foreground">Total:</span> {Number(timberViewTotals.totalMeters || 0).toFixed(2)} m
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Cost:</span> {formatCurrency(Number(timberViewTotals.totalCost || 0))}
                      </div>
                    </div>
                  ) : (
                    'No timber usage logged yet'
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select a project to view totals and log usage.</div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="space-y-3">
              <div className="font-semibold">Log timber used</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Material</label>
                  <Select value={timberUsageForm.materialId} onValueChange={(v) => setTimberUsageForm((prev) => ({ ...prev, materialId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder={timberMaterialsLoading ? 'Loading…' : 'Select material'} />
                    </SelectTrigger>
                    <SelectContent>
                      {timberMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.code ? `${m.code} — ` : ''}{m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Meters used</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 4.2"
                    value={timberUsageForm.meters}
                    onChange={(e) => setTimberUsageForm((prev) => ({ ...prev, meters: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={timberUsageForm.quantity}
                    onChange={(e) => setTimberUsageForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={timberUsageForm.date}
                    onChange={(e) => setTimberUsageForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                <Textarea
                  placeholder="Optional notes"
                  value={timberUsageForm.notes}
                  onChange={(e) => setTimberUsageForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={!timberViewProjectId || !timberUsageForm.materialId || !timberUsageForm.meters}
                  onClick={async () => {
                    const meters = Number(timberUsageForm.meters);
                    const quantity = Number(timberUsageForm.quantity || '1');
                    if (!timberViewProjectId) return;
                    if (!Number.isFinite(meters) || meters <= 0) return;
                    if (!Number.isFinite(quantity) || quantity <= 0) return;
                    await apiFetch('/workshop/timber/usage', {
                      method: 'POST',
                      json: {
                        opportunityId: timberViewProjectId,
                        materialId: timberUsageForm.materialId,
                        lengthMm: Math.round(meters * 1000),
                        quantity,
                        usedAt: timberUsageForm.date ? new Date(`${timberUsageForm.date}T12:00:00.000Z`).toISOString() : undefined,
                        notes: timberUsageForm.notes || undefined,
                      },
                    });
                    setTimberUsageForm((prev) => ({ ...prev, meters: '', quantity: '1', notes: '' }));
                    await refreshTimberUsageForProject(timberViewProjectId);
                  }}
                >
                  Log timber
                </Button>
                <Button
                  variant="outline"
                  disabled={!timberViewProjectId}
                  onClick={async () => {
                    if (!timberViewProjectId) return;
                    await refreshTimberUsageForProject(timberViewProjectId);
                  }}
                >
                  Refresh
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          {/* Grid Header with Column Config Button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Projects Grid</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumnConfig(true)}
            >
              ⚙️ Configure Columns
            </Button>
          </div>

          {/* CustomizableGrid */}
          {projects.length > 0 ? (
            <CustomizableGrid
              data={projects.map(p => ({
                id: p.id,
                name: p.name,
                valueGBP: p.valueGBP,
                startDate: p.startDate,
                deliveryDate: p.deliveryDate,
                installationStartDate: p.installationStartDate,
                installationEndDate: p.installationEndDate,
                expectedHours: p.expectedHours,
                actualHours: p.actualHours,
                totalProjectHours: p.totalProjectHours,
                timberOrderedAt: p.timberOrderedAt,
                timberExpectedAt: p.timberExpectedAt,
                timberReceivedAt: p.timberReceivedAt,
                timberNotApplicable: p.timberNotApplicable,
                glassOrderedAt: p.glassOrderedAt,
                glassExpectedAt: p.glassExpectedAt,
                glassReceivedAt: p.glassReceivedAt,
                glassNotApplicable: p.glassNotApplicable,
                ironmongeryOrderedAt: p.ironmongeryOrderedAt,
                ironmongeryExpectedAt: p.ironmongeryExpectedAt,
                ironmongeryReceivedAt: p.ironmongeryReceivedAt,
                ironmongeryNotApplicable: p.ironmongeryNotApplicable,
                paintOrderedAt: p.paintOrderedAt,
                paintExpectedAt: p.paintExpectedAt,
                paintReceivedAt: p.paintReceivedAt,
                paintNotApplicable: p.paintNotApplicable,
                ...Object.fromEntries(
                  processDefs.map(proc => [
                    `${proc.code}_percentage`,
                    calculateProcessPercentage(p, proc.code)
                  ])
                ),
              }))}
              columns={columnConfig.filter((col) => col.visible)}
              onRowClick={(project) => setShowProjectDetails(project.id)}
              onCellChange={async (projectId, field, value) => {
                try {
                  // Update via API
                  await apiFetch(`/workshop/projects/${projectId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [field]: value }),
                  });
                  await loadAll();
                  toast({
                    title: "Project updated",
                    description: "Changes saved successfully",
                  });
                } catch (e: any) {
                  toast({
                    title: "Update failed",
                    description: e?.message || "Failed to update project",
                    variant: "destructive",
                  });
                }
              }}
              rowIdField="id"
              onEditColumnOptions={(field) => setEditingField(field)}
              customColors={customColors}
              customDropdownOptions={dropdownOptions}
            />
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              <p>No projects found. Mark a lead as Won to create a project.</p>
            </Card>
          )}
        </div>
      )}

      {/* My Timesheet View */}
      {viewMode === 'timesheet' && user && (
        <MyTimesheetView 
          userId={user.id} 
          userName={user.name || user.email}
        />
      )}

      {/* Column Configuration Modal */}
      {showColumnConfig && (
        <ColumnConfigModal
          open={showColumnConfig}
          availableFields={getAvailableGridFields()}
          currentConfig={columnConfig}
          onSave={(newConfig) => {
            setColumnConfig(newConfig);
            if (typeof window !== 'undefined') {
              localStorage.setItem('workshop-grid-column-config', JSON.stringify(newConfig));
            }
            setShowColumnConfig(false);
          }}
          onClose={() => setShowColumnConfig(false)}
        />
      )}

      {/* Dropdown Options Editor Modal */}
      {editingField && (
        <DropdownOptionsEditor
          isOpen={true}
          fieldName={editingField}
          fieldLabel={getAvailableGridFields().find(f => f.field === editingField)?.label || editingField}
          currentOptions={dropdownOptions[editingField] || getDefaultDropdownOptions(editingField)}
          currentColors={customColors}
          onSave={(options, colors) => {
            const newDropdownOptions = { ...dropdownOptions, [editingField]: options };
            const newCustomColors = { ...customColors, ...colors };
            setDropdownOptions(newDropdownOptions);
            setCustomColors(newCustomColors);
            if (typeof window !== 'undefined') {
              localStorage.setItem('workshop-grid-dropdown-options', JSON.stringify(newDropdownOptions));
              localStorage.setItem('workshop-grid-custom-colors', JSON.stringify(newCustomColors));
            }
            setEditingField(null);
          }}
          onClose={() => setEditingField(null)}
        />
      )}

      {/* Hours Tracking Modal */}
      {showQuickLog && (
        <QuickLogModal
          users={users}
          projects={projects.map(p => ({ id: p.id, name: p.name }))}
          processes={processDefs as any}
          onSave={async (form: QuickLogSaveInput) => {
            try {
              await apiFetch('/workshop/time', {
                method: 'POST',
                json: {
                  projectId: form.projectId,
                  userId: form.userId,
                  process: form.process,
                  date: form.date,
                  hours: Number(form.hours),
                  notes: form.notes,
                  markComplete: form.markComplete,
                  completionComments: form.completionComments,
                },
              });
              setShowQuickLog(false);
              await loadAll();
            } catch (e: any) {
              alert('Failed to log hours: ' + (e?.message || 'Unknown error'));
              console.error(e);
            }
          }}
          onClose={() => setShowQuickLog(false)}
        />
      )}
      {/* Material Link Dialog */}
      {showMaterialLink && (
        <MaterialLinkDialog
          taskId={showMaterialLink.taskId}
          taskTitle={showMaterialLink.taskTitle}
          projects={projects.map(p => ({ id: p.id, name: p.name }))}
          onLink={async (materialType, opportunityId) => {
            try {
              await apiFetch(`/tasks/${showMaterialLink.taskId}/link-material`, {
                method: 'PATCH',
                json: { materialType, opportunityId }
              });
              setShowMaterialLink(null);
              await loadWorkshopTasks();
            } catch (e: any) {
              alert('Failed to link material: ' + (e?.message || 'Unknown error'));
            }
          }}
          onCancel={() => setShowMaterialLink(null)}
        />
      )}

      {/* Material Order Dialog */}
      {showMaterialOrder && (
        <MaterialOrderDialog
          taskTitle={showMaterialOrder.taskTitle}
          materialType={showMaterialOrder.materialType}
          onSave={async (dates) => {
            try {
              // Mark task as complete
              await apiFetch(`/tasks/${showMaterialOrder.taskId}/complete`, {
                method: 'POST',
              });
              
              // Update material dates
              const materialType = showMaterialOrder.materialType.toLowerCase();
              const updates: any = {};
              if (dates.orderedDate) updates[`${materialType}OrderedAt`] = dates.orderedDate;
              if (dates.expectedDate) updates[`${materialType}ExpectedAt`] = dates.expectedDate;
              if (dates.receivedDate) updates[`${materialType}ReceivedAt`] = dates.receivedDate;
              
              await apiFetch(`/workshop/project/${showMaterialOrder.opportunityId}/materials`, {
                method: 'PATCH',
                json: updates
              });
              
              setShowMaterialOrder(null);
              await loadWorkshopTasks();
              await loadAll();
            } catch (e: any) {
              alert('Failed to update: ' + (e?.message || 'Unknown error'));
            }
          }}
          onCancel={() => setShowMaterialOrder(null)}
        />
      )}

      {/* Holiday Management Modal */}
      {showHolidayModal && (
        <HolidayModal
          users={users}
          holidays={holidays}
          onAdd={async (payload) => {
            try {
              await apiFetch('/workshop/holidays', { method: 'POST', json: payload });
              await loadAll();
            } catch (e: any) {
              alert('Failed to add holiday: ' + (e?.message || 'Unknown error'));
              console.error(e);
            }
          }}
          onDelete={async (id) => {
            try {
              await apiFetch(`/workshop/holidays/${id}`, { method: 'DELETE' });
              await loadAll();
            } catch (e: any) {
              alert('Failed to delete holiday: ' + (e?.message || 'Unknown error'));
              console.error(e);
            }
          }}
          onClose={() => setShowHolidayModal(false)}
        />
      )}

      {/* Group Projects Modal */}
      <GroupProjectsModal
        open={groupProjectsOpen}
        onOpenChange={setGroupProjectsOpen}
        opportunities={projects.map(p => ({
          id: p.id,
          title: p.name,
          valueGBP: typeof p.valueGBP === 'number' ? p.valueGBP : (p.valueGBP ? Number(p.valueGBP) : null),
          stage: p.wonAt ? 'WON' : 'OPEN',
          client: null,
        }))}
        onGroupCreated={() => {
          loadAll();
        }}
      />

      {/* Task Modal for editing */}
      {selectedTaskId && tenantId && user?.id && selectedTask && (
        <TaskModal
          open={true}
          onClose={() => {
            setSelectedTaskId(null);
            loadWorkshopTasks();
          }}
          task={selectedTask as any}
          tenantId={tenantId}
          userId={user.id}
          onChanged={async () => {
            await loadWorkshopTasks();
          }}
        />
      )}

      {showHoursModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={closeHoursModal}
        >
          <Card 
            className="p-6 max-w-md w-full m-4 bg-white shadow-2xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">
              Log Hours - {showHoursModal.projectName}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Process</label>
                <Select 
                  value={hoursForm.process} 
                  onValueChange={(v) => setHoursForm(prev => ({ ...prev, process: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select process" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const proj = projects.find(p => p.id === showHoursModal?.projectId);
                      const completedCodes = new Set(
                        (proj?.processAssignments || [])
                          .filter(pa => pa.completedAt)
                          .map(pa => pa.processCode)
                      );
                      return processDefs.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {completedCodes.has(p.code) && '✓ '}{p.name}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">User</label>
                <Select 
                  value={hoursForm.userId} 
                  onValueChange={(v) => setHoursForm(prev => ({ ...prev, userId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Date</label>
                <Input
                  type="date"
                  value={hoursForm.date}
                  onChange={(e) => setHoursForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Hours</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 8 or 7.5"
                  value={hoursForm.hours}
                  onChange={(e) => setHoursForm(prev => ({ ...prev, hours: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={saveHours}
                  disabled={!hoursForm.process || !hoursForm.userId || !hoursForm.hours}
                >
                  Log Hours
                </Button>
                <Button variant="ghost" onClick={closeHoursModal}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Project Details Modal */}
      {showProjectDetails && (() => {
        const project = scheduleProjects.find(p => p.id === showProjectDetails) || projects.find(p => p.id === showProjectDetails);
        if (!project) return null;

        const isGroup = Array.isArray(project.groupMembers) && project.groupMembers.length > 0;
        if (isGroup) {
          const members = project.groupMembers || [];
          return (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={() => setShowProjectDetails(null)}
            >
              <Card
                className="p-6 max-w-2xl w-full m-4 bg-white shadow-2xl border max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-semibold mb-2">{getProjectDisplayName(project)}</h2>
                <div className="text-sm text-gray-600 mb-4">
                  {members.length} order{members.length === 1 ? "" : "s"} in this group
                </div>

                <div className="space-y-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="w-full text-left rounded border px-3 py-2 hover:bg-slate-50"
                      onClick={() => setShowProjectDetails(m.id)}
                      title={getProjectDisplayName(m)}
                    >
                      <div className="text-sm font-semibold text-slate-900 truncate">{getProjectDisplayName(m)}</div>
                      <div className="text-xs text-slate-500">
                        Mfg: {m.startDate ? new Date(m.startDate).toLocaleDateString("en-GB") : "Not set"}
                        {" "}→{" "}
                        {m.deliveryDate ? new Date(m.deliveryDate).toLocaleDateString("en-GB") : "Not set"}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-4">
                  <Button variant="ghost" onClick={() => setShowProjectDetails(null)}>
                    Close
                  </Button>
                </div>
              </Card>
            </div>
          );
        }
        
        const progress = getProjectProgress(project);
        const totalEstimated = (project.processAssignments || [])
          .reduce((sum: number, pa) => sum + Number(pa.estimatedHours || 0), 0);
        const totalLogged = Number(project.totalProjectHours || 0);
        
        return (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowProjectDetails(null)}
          >
            <Card 
              className="p-6 max-w-2xl w-full m-4 bg-white shadow-2xl border max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-4">{getProjectDisplayName(project)}</h2>
              
              <div className="space-y-4">
                {/* Project Overview */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                  {showValues && !isWorkshopOnly && (
                    <div>
                      <span className="text-sm text-gray-600">Value:</span>
                      <span className="ml-2 font-semibold">
                        {formatCurrency(typeof project.valueGBP === 'string' 
                          ? parseFloat(project.valueGBP) 
                          : (project.valueGBP || 0)
                        )}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-gray-600">Progress:</span>
                    <span className="ml-2 font-semibold">{progress}%</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Total Hours:</span>
                    <span className="ml-2 font-semibold">{project.totalProjectHours || 0}h</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Mfg Start:</span>
                    <span className="ml-2">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Completion:</span>
                    <span className="ml-2">{project.deliveryDate ? new Date(project.deliveryDate).toLocaleDateString() : 'Not set'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Install Start:</span>
                    <span className="ml-2">{project.installationStartDate ? new Date(project.installationStartDate).toLocaleDateString() : 'Not set'}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Install End:</span>
                    <span className="ml-2">{project.installationEndDate ? new Date(project.installationEndDate).toLocaleDateString() : 'Not set'}</span>
                  </div>
                </div>
                
                {/* Time Tracking Summary */}
                <div className="p-4 bg-blue-50 rounded">
                  <h3 className="font-semibold mb-2">Time Tracking</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Estimated Hours: <span className="font-semibold">{totalEstimated.toFixed(1)}h</span></div>
                    <div>Logged Hours: <span className="font-semibold">{totalLogged.toFixed(1)}h</span></div>
                  </div>
                  {totalEstimated > 0 && (
                    <div className="mt-2 text-sm">
                      <span className={totalLogged > totalEstimated ? 'text-red-600 font-semibold' : 'text-green-600'}>
                        {totalLogged > totalEstimated 
                          ? `Over by ${(totalLogged - totalEstimated).toFixed(1)}h`
                          : `${(totalEstimated - totalLogged).toFixed(1)}h remaining`
                        }
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Material Tracking */}
                <div>
                  <h3 className="font-semibold mb-2">Material Status</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Timber */}
                    <div className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex flex-col items-center">
                          <div className="text-[10px] font-bold leading-none mb-0.5">T</div>
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: getMaterialColor(getMaterialStatus(project.timberOrderedAt, project.timberReceivedAt, project.timberNotApplicable)) }}
                          />
                        </div>
                        <span className="font-medium">Timber</span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        {project.timberNotApplicable ? (
                          <div className="font-medium text-gray-500">N/A</div>
                        ) : (
                          <>
                            <div>Ordered: {project.timberOrderedAt ? new Date(project.timberOrderedAt).toLocaleDateString() : 'Not ordered'}</div>
                            <div>Expected: {project.timberExpectedAt ? new Date(project.timberExpectedAt).toLocaleDateString() : '-'}</div>
                            <div>Received: {project.timberReceivedAt ? new Date(project.timberReceivedAt).toLocaleDateString() : '-'}</div>
                            {workshopTasks.some(t => t.meta?.linkedMaterialType === 'timber' && t.meta?.linkedOpportunityId === project.id) && (
                              <div className="text-blue-600 font-medium">🔗 Linked to task</div>
                            )}

                            {isWorkshopOnly && (
                              <div className="mt-3 border-t pt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-semibold text-gray-700">Usage</div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        setProjectTimberFormOpen((v) => !v);
                                        await ensureTimberMaterialsLoaded();
                                        await refreshProjectTimberUsage(project.id);
                                      }}
                                    >
                                      {projectTimberFormOpen ? 'Hide' : 'Log timber'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        await refreshProjectTimberUsage(project.id);
                                      }}
                                    >
                                      Refresh
                                    </Button>
                                  </div>
                                </div>

                                {projectTimberLoading ? (
                                  <div className="text-xs text-muted-foreground">Loading…</div>
                                ) : projectTimberError ? (
                                  <div className="text-xs text-red-600">{projectTimberError}</div>
                                ) : projectTimberTotals ? (
                                  <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                                    <div><span className="font-medium text-foreground">Total:</span> {Number(projectTimberTotals.totalMeters || 0).toFixed(2)} m</div>
                                    <div><span className="font-medium text-foreground">Cost:</span> {formatCurrency(Number(projectTimberTotals.totalCost || 0))}</div>
                                  </div>
                                ) : null}

                                {projectTimberFormOpen && (
                                  <div className="space-y-2">
                                    <div className="grid gap-2">
                                      <div>
                                        <label className="text-xs font-medium mb-1 block">Material</label>
                                        <Select value={projectTimberForm.materialId} onValueChange={(v) => setProjectTimberForm((prev) => ({ ...prev, materialId: v }))}>
                                          <SelectTrigger className="h-8">
                                            <SelectValue placeholder={timberMaterialsLoading ? 'Loading…' : 'Select material'} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {timberMaterials.map((m) => (
                                              <SelectItem key={m.id} value={m.id}>
                                                {m.code ? `${m.code} — ` : ''}{m.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-xs font-medium mb-1 block">Meters</label>
                                          <Input
                                            className="h-8"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="e.g. 2.5"
                                            value={projectTimberForm.meters}
                                            onChange={(e) => setProjectTimberForm((prev) => ({ ...prev, meters: e.target.value }))}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs font-medium mb-1 block">Qty</label>
                                          <Input
                                            className="h-8"
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={projectTimberForm.quantity}
                                            onChange={(e) => setProjectTimberForm((prev) => ({ ...prev, quantity: e.target.value }))}
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium mb-1 block">Date</label>
                                        <Input
                                          className="h-8"
                                          type="date"
                                          value={projectTimberForm.date}
                                          onChange={(e) => setProjectTimberForm((prev) => ({ ...prev, date: e.target.value }))}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium mb-1 block">Notes</label>
                                        <Input
                                          className="h-8"
                                          placeholder="Optional"
                                          value={projectTimberForm.notes}
                                          onChange={(e) => setProjectTimberForm((prev) => ({ ...prev, notes: e.target.value }))}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        disabled={!projectTimberForm.materialId || !projectTimberForm.meters}
                                        onClick={async () => {
                                          const meters = Number(projectTimberForm.meters);
                                          const quantity = Number(projectTimberForm.quantity || '1');
                                          if (!Number.isFinite(meters) || meters <= 0) return;
                                          if (!Number.isFinite(quantity) || quantity <= 0) return;
                                          await apiFetch('/workshop/timber/usage', {
                                            method: 'POST',
                                            json: {
                                              opportunityId: project.id,
                                              materialId: projectTimberForm.materialId,
                                              lengthMm: Math.round(meters * 1000),
                                              quantity,
                                              usedAt: projectTimberForm.date ? new Date(`${projectTimberForm.date}T12:00:00.000Z`).toISOString() : undefined,
                                              notes: projectTimberForm.notes || undefined,
                                            },
                                          });
                                          setProjectTimberForm((prev) => ({ ...prev, meters: '', quantity: '1', notes: '' }));
                                          await refreshProjectTimberUsage(project.id);
                                        }}
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {Array.isArray(projectTimberLogs) && projectTimberLogs.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] text-gray-500">Recent logs</div>
                                    {projectTimberLogs.slice(0, 5).map((l: any) => (
                                      <div key={l.id} className="flex items-center justify-between text-[11px] text-gray-600">
                                        <div className="truncate pr-2">
                                          {(l.material?.name || 'Material')} — {((Number(l.lengthMm || 0) * Number(l.quantity || 0)) / 1000).toFixed(2)} m
                                          {' '}({new Date(l.usedAt || l.createdAt || Date.now()).toLocaleDateString('en-GB')})
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2"
                                          onClick={async () => {
                                            await apiFetch(`/workshop/timber/usage/${encodeURIComponent(l.id)}`, { method: 'DELETE' });
                                            await refreshProjectTimberUsage(project.id);
                                          }}
                                        >
                                          Delete
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Glass */}
                    <div className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex flex-col items-center">
                          <div className="text-[10px] font-bold leading-none mb-0.5">G</div>
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: getMaterialColor(getMaterialStatus(project.glassOrderedAt, project.glassReceivedAt, project.glassNotApplicable)) }}
                          />
                        </div>
                        <span className="font-medium">Glass</span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        {project.glassNotApplicable ? (
                          <div className="font-medium text-gray-500">N/A</div>
                        ) : (
                          <>
                            <div>Ordered: {project.glassOrderedAt ? new Date(project.glassOrderedAt).toLocaleDateString() : 'Not ordered'}</div>
                            <div>Expected: {project.glassExpectedAt ? new Date(project.glassExpectedAt).toLocaleDateString() : '-'}</div>
                            <div>Received: {project.glassReceivedAt ? new Date(project.glassReceivedAt).toLocaleDateString() : '-'}</div>
                            {workshopTasks.some(t => t.meta?.linkedMaterialType === 'glass' && t.meta?.linkedOpportunityId === project.id) && (
                              <div className="text-blue-600 font-medium">🔗 Linked to task</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Ironmongery */}
                    <div className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex flex-col items-center">
                          <div className="text-[10px] font-bold leading-none mb-0.5">I</div>
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: getMaterialColor(getMaterialStatus(project.ironmongeryOrderedAt, project.ironmongeryReceivedAt, project.ironmongeryNotApplicable)) }}
                          />
                        </div>
                        <span className="font-medium">Ironmongery</span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        {project.ironmongeryNotApplicable ? (
                          <div className="font-medium text-gray-500">N/A</div>
                        ) : (
                          <>
                            <div>Ordered: {project.ironmongeryOrderedAt ? new Date(project.ironmongeryOrderedAt).toLocaleDateString() : 'Not ordered'}</div>
                            <div>Expected: {project.ironmongeryExpectedAt ? new Date(project.ironmongeryExpectedAt).toLocaleDateString() : '-'}</div>
                            <div>Received: {project.ironmongeryReceivedAt ? new Date(project.ironmongeryReceivedAt).toLocaleDateString() : '-'}</div>
                            {workshopTasks.some(t => t.meta?.linkedMaterialType === 'ironmongery' && t.meta?.linkedOpportunityId === project.id) && (
                              <div className="text-blue-600 font-medium">🔗 Linked to task</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Paint */}
                    <div className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex flex-col items-center">
                          <div className="text-[10px] font-bold leading-none mb-0.5">P</div>
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: getMaterialColor(getMaterialStatus(project.paintOrderedAt, project.paintReceivedAt, project.paintNotApplicable)) }}
                          />
                        </div>
                        <span className="font-medium">Paint</span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        {project.paintNotApplicable ? (
                          <div className="font-medium text-gray-500">N/A</div>
                        ) : (
                          <>
                            <div>Ordered: {project.paintOrderedAt ? new Date(project.paintOrderedAt).toLocaleDateString() : 'Not ordered'}</div>
                            <div>Expected: {project.paintExpectedAt ? new Date(project.paintExpectedAt).toLocaleDateString() : '-'}</div>
                            <div>Received: {project.paintReceivedAt ? new Date(project.paintReceivedAt).toLocaleDateString() : '-'}</div>
                            {workshopTasks.some(t => t.meta?.linkedMaterialType === 'paint' && t.meta?.linkedOpportunityId === project.id) && (
                              <div className="text-blue-600 font-medium">🔗 Linked to task</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Process Assignments */}
                <div>
                  <h3 className="font-semibold mb-2">Process Assignments</h3>
                  {project.processAssignments && project.processAssignments.length > 0 ? (
                    <div className="space-y-2">
                      {[...project.processAssignments]
                        .sort((a, b) => {
                          // Sort by sortOrder first, then by name
                          const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
                          if (orderDiff !== 0) return orderDiff;
                          return (a.processName || '').localeCompare(b.processName || '');
                        })
                        .map((pa) => {
                        const processTime = Number(project.totalHoursByProcess?.[pa.processCode] || 0);
                        
                        return (
                          <div key={pa.id} className="p-3 border rounded flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium">{pa.processName}</div>
                                {pa.completedAt && (
                                  <Badge variant="default" className="bg-green-600">
                                    ✓ Completed {new Date(pa.completedAt).toLocaleDateString()}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                {pa.assignedUser 
                                  ? (pa.assignedUser.name || pa.assignedUser.email)
                                  : 'Unassigned'
                                }
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-semibold">{processTime.toFixed(1)}h logged</div>
                              {pa.estimatedHours && (
                                <div className="text-gray-600">of {pa.estimatedHours}h estimated</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No process assignments yet</p>
                  )}
                </div>
                
                {/* Quick Actions */}
                <div className="space-y-4 pt-4 border-t">
                  {!showProjectSwap && (
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          setShowProjectDetails(null);
                          openHoursModal(project.id, project.name);
                        }}
                      >
                        Log Hours
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowProjectDetails(null);
                          // Scroll to the WorkshopTimer component and open it with this project
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setTimeout(() => {
                            timerRef.current?.openWithProject(project.id);
                          }, 300);
                        }}
                      >
                        Start Timer
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await apiFetch("/workshop/timer/stop", { method: "POST" });
                            await loadAll();
                          } catch (e: any) {
                            alert("Failed to stop timer: " + (e?.message || "Unknown error"));
                          }
                        }}
                      >
                        Stop & Log
                      </Button>
                      <Button
                        onClick={() => {
                          setShowProjectSwap(true);
                          setSwapForm({ projectId: project.id, process: processDefs[0]?.code || '', notes: '', search: '' });
                        }}
                      >
                        Swap
                      </Button>
                      <Button variant="ghost" onClick={() => setShowProjectDetails(null)}>
                        Close
                      </Button>
                    </div>
                  )}

                  {showProjectSwap && (() => {
                    const selectedProc = processDefs.find(p => p.code === swapForm.process);
                    const isGeneric = selectedProc?.isGeneric || false;
                    
                    return (
                      <div className="space-y-3 p-4 border rounded bg-slate-50">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Swap to New Project & Process</h3>
                          <Button variant="ghost" size="sm" onClick={() => setShowProjectSwap(false)}>
                            Cancel
                          </Button>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">Process</label>
                          <Select value={swapForm.process} onValueChange={(v) => setSwapForm(f => ({ ...f, process: v, projectId: '' }))}>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Select process" />
                            </SelectTrigger>
                            <SelectContent>
                              {processDefs.map((p) => (
                                <SelectItem key={p.code} value={p.code}>
                                  {p.name} {p.isGeneric && "⭐"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {!isGeneric && (
                          <>
                            <Input
                              value={swapForm.search}
                              onChange={(e) => setSwapForm(f => ({ ...f, search: e.target.value }))}
                              placeholder="Search projects..."
                              className="h-10"
                            />

                            <div>
                              <label className="text-sm font-medium mb-1 block">Project</label>
                              <Select value={swapForm.projectId} onValueChange={(v) => setSwapForm(f => ({ ...f, projectId: v }))}>
                                <SelectTrigger className="h-12">
                                  <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projects
                                    .filter((p) =>
                                      swapForm.search
                                        ? p.name.toLowerCase().includes(swapForm.search.toLowerCase())
                                        : true
                                    )
                                    .map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}

                        <div>
                          <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                          <Input
                            value={swapForm.notes}
                            onChange={(e) => setSwapForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Add a note..."
                            className="h-12"
                          />
                        </div>

                        <Button
                          onClick={async () => {
                            if (!swapForm.process) return;
                            if (!isGeneric && !swapForm.projectId) return;
                            
                            try {
                              await apiFetch("/workshop/timer/stop", { method: "POST" });
                              
                              const payload: any = { process: swapForm.process, notes: swapForm.notes || undefined };
                              if (!isGeneric) {
                                payload.projectId = swapForm.projectId;
                              }
                              
                              await apiFetch("/workshop/timer/start", {
                                method: "POST",
                                json: payload,
                              });
                              setShowProjectSwap(false);
                              setSwapForm({ projectId: '', process: '', notes: '', search: '' });
                              await loadAll();
                              alert("Timer swapped successfully");
                            } catch (e: any) {
                              alert("Failed to swap timer: " + (e?.message || "Unknown error"));
                          }
                        }}
                        disabled={!swapForm.process || (!isGeneric && !swapForm.projectId)}
                        className="w-full"
                      >
                        Swap & Start New Timer
                      </Button>
                    </div>
                    );
                  })()}
                </div>
              </div>
            </Card>
          </div>
        );
      })()}
      
      {/* User Colors Modal */}
      {showUserColors && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowUserColors(false)}
        >
          <Card 
            className="p-6 max-w-md w-full m-4 bg-white shadow-2xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">User Schedule Colors</h2>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-2 border rounded">
                  <input
                    type="color"
                    value={user.workshopColor || '#60a5fa'}
                    onChange={async (e) => {
                      const newColor = e.target.value;
                      try {
                        await apiFetch(`/workshop/users/${user.id}/color`, {
                          method: 'PATCH',
                          json: { color: newColor }
                        });
                        // Update local state
                        setUsers(prev => prev.map(u => 
                          u.id === user.id ? { ...u, workshopColor: newColor } : u
                        ));
                      } catch (err) {
                        console.error('Failed to update color:', err);
                        alert('Failed to update color. Please try again.');
                      }
                    }}
                    className="w-12 h-12 cursor-pointer rounded border"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{user.name || user.email}</div>
                    <div className="text-xs text-gray-500">{user.workshopColor || 'Default blue'}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2 pt-4 border-t mt-4">
              <Button variant="ghost" onClick={() => setShowUserColors(false)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal
          onClose={() => setShowQRScanner(false)}
          onScanSuccess={handleQRScanSuccess}
        />
      )}

      {/* Holiday Request Modal */}
      <Dialog open={showHolidayModal} onOpenChange={setShowHolidayModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Holiday</DialogTitle>
            <DialogDescription>
              Request time off for approval by an administrator
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Date</label>
              <Input
                type="date"
                value={holidayRequestForm.startDate}
                onChange={(e) => setHolidayRequestForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Date</label>
              <Input
                type="date"
                value={holidayRequestForm.endDate}
                onChange={(e) => setHolidayRequestForm(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reason (optional)</label>
              <Textarea
                value={holidayRequestForm.reason}
                onChange={(e) => setHolidayRequestForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Brief reason for holiday request..."
              />
            </div>
            {holidayError && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                {holidayError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowHolidayModal(false);
              setHolidayRequestForm({ startDate: '', endDate: '', reason: '' });
              setHolidayError(null);
            }}>
              Cancel
            </Button>
            <Button onClick={async () => {
              if (!holidayRequestForm.startDate || !holidayRequestForm.endDate) {
                setHolidayError('Please select both start and end dates');
                return;
              }
              if (new Date(holidayRequestForm.endDate) < new Date(holidayRequestForm.startDate)) {
                setHolidayError('End date must be after start date');
                return;
              }
              try {
                await apiFetch('/workshop/holiday-requests', {
                  method: 'POST',
                  json: {
                    startDate: holidayRequestForm.startDate,
                    endDate: holidayRequestForm.endDate,
                    reason: holidayRequestForm.reason || null,
                  },
                });
                toast({
                  title: "Holiday request submitted",
                  description: "Your request has been sent for approval",
                });
                setShowHolidayModal(false);
                setHolidayRequestForm({ startDate: '', endDate: '', reason: '' });
                setHolidayError(null);
              } catch (e: any) {
                setHolidayError(e?.message || 'Failed to submit holiday request');
              }
            }}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Holiday management modal
interface HolidayModalProps {
  users: UserLite[];
  holidays: Holiday[];
  onAdd: (payload: { userId: string; startDate: string; endDate: string; notes?: string }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onClose: () => void;
}

function HolidayModal({ users, holidays, onAdd, onDelete, onClose }: HolidayModalProps) {
  const [form, setForm] = useState<{ userId: string; startDate: string; endDate: string; notes?: string }>({ userId: '', startDate: '', endDate: '', notes: '' });
  // Group holidays by user for quick view
  const byUser = users.map(u => ({
    user: u,
    items: holidays.filter(h => h.userId === u.id)
  }));

  const submit = async () => {
    if (!form.userId || !form.startDate || !form.endDate) return;
    await onAdd({ userId: form.userId, startDate: form.startDate, endDate: form.endDate, notes: form.notes });
    setForm({ userId: '', startDate: '', endDate: '', notes: '' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <Card className="p-6 max-w-3xl w-full m-4 bg-white shadow-2xl border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Manage Holidays</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {/* Add form */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">User</label>
            <Select value={form.userId} onValueChange={(v) => setForm(f => ({ ...f, userId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Start</label>
            <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End</label>
            <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Input type="text" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="mb-6">
          <Button onClick={submit} disabled={!form.userId || !form.startDate || !form.endDate}>Add Holiday</Button>
        </div>

        {/* List */}
        <div className="space-y-3 max-h-[50vh] overflow-auto pr-2">
          {byUser.map(group => (
            <div key={group.user.id} className="border rounded p-3">
              <div className="font-medium mb-2">{group.user.name || group.user.email}</div>
              {group.items.length === 0 ? (
                <div className="text-xs text-muted-foreground">No holidays</div>
              ) : (
                <div className="space-y-2">
                  {group.items.map(h => (
                    <div key={h.id} className="flex items-center justify-between text-sm">
                      <div>
                        {new Date(h.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(h.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {h.notes ? <span className="text-xs text-muted-foreground ml-2">{h.notes}</span> : null}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(h.id)}>Delete</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
