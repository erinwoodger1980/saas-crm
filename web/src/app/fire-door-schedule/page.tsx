"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, Search, Filter, TrendingUp, Clock, CheckCircle2, 
  AlertCircle, Calendar, Package, Wrench, Truck, FileText,
  BarChart3, ArrowUpRight, Download, ArrowUpDown, ChevronUp, ChevronDown
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface FireDoorProject {
  id: string;
  mjsNumber?: string;
  jobName?: string;
  clientName?: string;
  dateReceived?: string; // Date Received in Red Folder
  dateRequired?: string;
  poNumber?: string;
  jobLocation?: string;
  signOffStatus?: string;
  scheduledBy?: string; // LAJ Scheduler
  dateSignedOff?: string;
  leadTimeWeeks?: number;
  approxWorkingDaysRemaining?: number;
  orderingStatus?: string;
  overallProgress?: number;
  approxDeliveryDate?: string;
  [key: string]: any;
}

interface Stats {
  totalProjects: number;
  byLocation: {
    redFolder: number;
    inProgress: number;
    complete: number;
  };
  bySignOff: {
    awaitingSignOff: number;
    signedOff: number;
  };
  production: {
    inProduction: number;
  };
}

export default function FireDoorSchedulePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<FireDoorProject[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  // Active tab (phase-based tabs)
  const [activeTab, setActiveTab] = useState<string>("PROJECT_OVERVIEW");
  // Location filter (cards trigger this: RED FOLDER / IN PROGRESS / COMPLETE / ALL)
  const [locationFilter, setLocationFilter] = useState<string>("ALL");
  const [showTable, setShowTable] = useState<boolean>(true); // consolidated table view toggle
  const [sortField, setSortField] = useState<string>("dateRequired");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingConfigField, setEditingConfigField] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Load persisted UI prefs
    try {
      const savedView = localStorage.getItem("fds:view");
      const savedActiveTab = localStorage.getItem("fds:activeTab");
      const savedLocation = localStorage.getItem("fds:location");
      const savedSortF = localStorage.getItem("fds:sortField");
      const savedSortD = localStorage.getItem("fds:sortDir") as "asc" | "desc" | null;
      if (savedView) setShowTable(savedView === "table");
      if (savedActiveTab) setActiveTab(savedActiveTab);
      if (savedLocation) setLocationFilter(savedLocation);
      if (savedSortF) setSortField(savedSortF);
      if (savedSortD === "asc" || savedSortD === "desc") setSortDir(savedSortD);
    } catch {}
  }, []);

  // Persist view + tab + sort
  useEffect(() => {
    try { localStorage.setItem("fds:view", showTable ? "table" : "cards"); } catch {}
  }, [showTable]);
  useEffect(() => {
    try { localStorage.setItem("fds:activeTab", activeTab); } catch {}
  }, [activeTab]);
  useEffect(() => {
    try { localStorage.setItem("fds:location", locationFilter); } catch {}
  }, [locationFilter]);
  useEffect(() => {
    try { localStorage.setItem("fds:sortField", sortField); localStorage.setItem("fds:sortDir", sortDir); } catch {}
  }, [sortField, sortDir]);

  async function loadData() {
    setLoading(true);
    try {
      const [projectsData, statsData] = await Promise.all([
        apiFetch<{ projects: FireDoorProject[] }>("/fire-door-schedule"),
        apiFetch<Stats>("/fire-door-schedule/stats/summary"),
      ]);
      setProjects(projectsData.projects);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading fire door schedule:", error);
    } finally {
      setLoading(false);
    }
  }

  // Apply search + tab filters
  const filteredProjects = projects
    // Location filter from stats cards
    .filter(project => {
      const loc = (project.jobLocation || "").toUpperCase();
      if (locationFilter === "ALL") return true;
      return loc === locationFilter;
    })
    .filter((project) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        !searchTerm ||
        project.mjsNumber?.toLowerCase().includes(searchLower) ||
        project.jobName?.toLowerCase().includes(searchLower) ||
        project.clientName?.toLowerCase().includes(searchLower) ||
        project.poNumber?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      let av: any = (a as any)[sortField];
      let bv: any = (b as any)[sortField];
      // Date parsing (only when explicit sort field is a date column)
      if (sortField === 'dateRequired') {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function getProgressColor(progress?: number): string {
    if (!progress) return "from-gray-400 to-gray-500";
    if (progress < 30) return "from-red-400 to-red-500";
    if (progress < 60) return "from-orange-400 to-orange-500";
    if (progress < 90) return "from-blue-400 to-blue-500";
    return "from-green-400 to-green-500";
  }

  const JOB_LOCATION_COLORS: Record<string, string> = {
    "ASSIGNED MJS": "bg-blue-100 text-blue-700",
    "RED FOLDER": "bg-orange-100 text-orange-700",
    "IN PROGRESS": "bg-cyan-100 text-cyan-700",
    "COMPLETE IN FACTORY": "bg-emerald-100 text-emerald-700",
    "COMPLETE & DELIVERED": "bg-green-100 text-green-700",
    "N/A": "bg-slate-100 text-slate-600",
    "NOT LOOKED AT": "bg-slate-100 text-slate-600",
    "NO JOB ASSIGNED": "bg-slate-100 text-slate-600",
    "JOB IN DISPUTE/ISSUES": "bg-red-100 text-red-700",
    "CANCELLED": "bg-red-100 text-red-700",
  };

  const SIGN_OFF_COLORS: Record<string, string> = {
    "AWAITING SCHEDULE": "bg-orange-100 text-orange-700",
    "WORKING ON SCHEDULE": "bg-blue-100 text-blue-700",
    "SCHEDULE SENT FOR SIGN OFF": "bg-cyan-100 text-cyan-700",
    "SCHEDULE SIGNED OFF": "bg-green-100 text-green-700",
    "NOT LOOKED AT": "bg-slate-100 text-slate-600",
  };

  function getStatusColor(status?: string): string {
    if (!status) return "bg-slate-100 text-slate-600";
    if (status.includes("COMPLETE") || status.includes("SIGNED OFF")) return "bg-green-100 text-green-700";
    if (status.includes("PROGRESS") || status.includes("WORKING")) return "bg-blue-100 text-blue-700";
    if (status.includes("AWAITING") || status.includes("RED FOLDER")) return "bg-orange-100 text-orange-700";
    return "bg-slate-100 text-slate-600";
  }

  // Tab definitions with labels and column sets
  const TAB_DEFINITIONS = {
    PROJECT_OVERVIEW: {
      label: 'Project Overview',
      columns: [
        'mjsNumber',
        'clientName',
        'jobName',
        'dateReceived',
        'jobLocation',
        'signOffStatus',
        'scheduledBy',
        'dateSignedOff',
        'leadTimeWeeks',
        'approxWorkingDaysRemaining',
      ]
    },
    DESIGN_SIGN_OFF: {
      label: 'Design & Sign Off',
      columns: ['mjsNumber', 'jobName', 'signOffStatus', 'scheduledBy', 'signOffDate', 'leadTimeWeeks', 'approxDeliveryDate']
    },
    BOM_MATERIALS: {
      label: 'BOM & Materials',
      columns: ['mjsNumber', 'jobName', 'orderingStatus', 'blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'ironmongeryStatus']
    },
    PRODUCTION_PROCESS: {
      label: 'Production Process',
      columns: ['mjsNumber', 'jobName', 'blanksCutPercent', 'edgebandPercent', 'calibratePercent', 'facingsPercent', 'sprayPercent', 'buildPercent', 'overallProgress']
    },
    DELIVERY_INSTALLATION: {
      label: 'Delivery & Installation',
      columns: ['mjsNumber', 'jobName', 'transportStatus', 'deliveryDate', 'installStart', 'installEnd', 'snaggingStatus', 'snaggingComplete']
    },
    NOTES_COMMUNICATION: {
      label: 'Notes & Communication',
      columns: ['mjsNumber', 'jobName', 'clientName', 'communicationNotes', 'internalNotes', 'paperworkComments', 'lastUpdatedBy', 'lastUpdatedAt']
    }
  };

  // Column field labels
  const COLUMN_LABELS: Record<string, string> = {
    mjsNumber: 'MJS',
    jobName: 'Job Description',
    clientName: 'Customer',
    poNumber: 'PO',
    dateReceived: 'Date Received in Red Folder',
    dateRequired: 'Required',
    jobLocation: 'Job Location',
    overallProgress: 'Progress',
    signOffStatus: 'Sign Off Status',
    scheduledBy: 'LAJ Scheduler',
    dateSignedOff: 'Date Signed Off',
    leadTimeWeeks: 'Lead Time in Weeks',
    approxDeliveryDate: 'Approx Delivery',
    approxWorkingDaysRemaining: 'Approx Working Days Remaining',
    orderingStatus: 'Ordering',
    blanksStatus: 'Blanks',
    lippingsStatus: 'Lippings',
    facingsStatus: 'Facings',
    glassStatus: 'Glass',
    ironmongeryStatus: 'Ironmongery',
    blanksCutPercent: 'Blanks Cut %',
    edgebandPercent: 'Edgeband %',
    calibratePercent: 'Calibrate %',
    facingsPercent: 'Facings %',
    sprayPercent: 'Spray %',
    buildPercent: 'Build %',
    transportStatus: 'Transport',
    deliveryDate: 'Delivery',
    installStart: 'Install Start',
    installEnd: 'Install End',
    snaggingStatus: 'Snagging',
    snaggingComplete: 'Snagging Done',
    communicationNotes: 'Communication',
    internalNotes: 'Internal Notes',
    paperworkComments: 'Paperwork Notes',
    lastUpdatedBy: 'Updated By',
    lastUpdatedAt: 'Updated At'
  };

  async function updateProject(projectId: string, patch: Partial<FireDoorProject>) {
    try {
      // Optimistic UI update
      setProjects((prev) => prev.map(p => p.id === projectId ? { ...p, ...patch } : p));
      await apiFetch(`/fire-door-schedule/${projectId}`, {
        method: 'PATCH',
        json: patch,
      });
    } catch (e) {
      console.error('Failed to update project', e);
      // Reload to re-sync if failed
      loadData();
    }
  }

  const [jobLocationOptions, setJobLocationOptions] = useState<string[]>([
    "ASSIGNED MJS",
    "RED FOLDER",
    "IN PROGRESS",
    "COMPLETE IN FACTORY",
    "COMPLETE & DELIVERED",
    "N/A",
    "NOT LOOKED AT",
    "NO JOB ASSIGNED",
    "JOB IN DISPUTE/ISSUES",
    "CANCELLED",
  ]);
  const [signOffOptions, setSignOffOptions] = useState<string[]>([
    "AWAITING SCHEDULE",
    "WORKING ON SCHEDULE",
    "SCHEDULE SENT FOR SIGN OFF",
    "SCHEDULE SIGNED OFF",
    "NOT LOOKED AT",
  ]);
  const orderingOptions = ["NOT IN BOM", "IN BOM TBC", "IN BOM", "STOCK", "ORDERED", "RECEIVED", "ORDERED CALL OFF", "MAKE IN HOUSE", "N/A"];
  const statusOptions = ["STOCK", "ORDERED", "RECEIVED", "N/A", "URGENT"];

  // Render cell based on field type
  function renderCell(project: FireDoorProject, field: string) {
    const value = project[field];

    // Date fields
    if (field === 'dateSignedOff') {
      return (
        <input
          type="date"
          className="bg-transparent outline-none text-sm"
          value={value ? new Date(value).toISOString().slice(0, 10) : ''}
          onChange={(e) => updateProject(project.id, { dateSignedOff: e.target.value })}
        />
      );
    }

    if (field === 'dateReceived') {
      return (
        <input
          type="date"
          className="bg-transparent outline-none text-sm"
          value={value ? new Date(value).toISOString().slice(0, 10) : ''}
          onChange={(e) => {
            const newDate = e.target.value;
            const leadWeeks = project.leadTimeWeeks || 0;
            let approxDeliveryDate: string | undefined = project.approxDeliveryDate;
            let approxWorkingDaysRemaining: number | undefined = project.approxWorkingDaysRemaining;
            if (newDate && leadWeeks > 0) {
              const base = new Date(newDate);
              base.setDate(base.getDate() + leadWeeks * 7);
              approxDeliveryDate = base.toISOString();
              const today = new Date();
              const diffMs = base.getTime() - today.getTime();
              const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
              const fullWeeks = Math.floor(diffDays / 7);
              const remainder = diffDays % 7;
              approxWorkingDaysRemaining = fullWeeks * 5 + Math.min(5, remainder);
            }
            updateProject(project.id, { dateReceived: newDate, approxDeliveryDate, approxWorkingDaysRemaining });
          }}
        />
      );
    }

    if (field.includes('date') || field.includes('Date')) {
      return (
        <input
          type="date"
          className="bg-transparent outline-none text-sm"
          value={value ? new Date(value).toISOString().slice(0, 10) : ''}
          onChange={(e) => updateProject(project.id, { [field]: e.target.value })}
        />
      );
    }

    // Progress/percentage fields
    if (field.includes('Percent') || field === 'overallProgress') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-slate-100 rounded overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor(value as number)}`}
              style={{ width: `${value || 0}%` }}
            />
          </div>
          <input
            type="number"
            min={0}
            max={100}
            value={value || 0}
            onChange={(e) => updateProject(project.id, { [field]: parseInt(e.target.value) || 0 })}
            className="w-14 bg-white/60 rounded px-1 py-0.5 text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      );
    }

    // Boolean fields
    if (field.includes('Checked') || field.includes('Complete') || field === 'snaggingComplete') {
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => updateProject(project.id, { [field]: e.target.checked })}
          className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-300"
        />
      );
    }

    // Status dropdowns
    if (field === 'jobLocation') {
      const colorClasses = JOB_LOCATION_COLORS[value as string] ?? "bg-slate-100 text-slate-600";
      return (
        <select
          value={value || ''}
          onChange={(e) => updateProject(project.id, { jobLocation: e.target.value })}
          className={`text-[11px] font-medium px-2 py-1 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-300 ${colorClasses}`}
        >
          <option value="">--</option>
          {jobLocationOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (field === 'signOffStatus') {
      const colorClasses = SIGN_OFF_COLORS[value as string] ?? "bg-slate-100 text-slate-600";
      return (
        <select
          value={value || ''}
          onChange={(e) => updateProject(project.id, { signOffStatus: e.target.value })}
          className={`text-[11px] font-medium px-2 py-1 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-300 ${colorClasses}`}
        >
          <option value="">--</option>
          {signOffOptions.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
      );
    }

    if (field === 'orderingStatus' || field.includes('Status')) {
      const options = field === 'orderingStatus' ? orderingOptions : statusOptions;
      return (
        <select
          value={value || ''}
          onChange={(e) => updateProject(project.id, { [field]: e.target.value })}
          className="text-[11px] font-medium px-2 py-1 rounded-full border bg-white/70 backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">--</option>
          {options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
      );
    }

    if (field === 'scheduledBy') {
      return (
        <select
          value={value || ''}
          onChange={(e) => updateProject(project.id, { scheduledBy: e.target.value })}
          className="text-sm px-2 py-1 rounded border bg-white/70 backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">--</option>
          {['DARREN', 'DAVE', 'STEVE', 'PAUL', 'DAN'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    // Number fields (non-percentage)
    if (field === 'leadTimeWeeks') {
      return (
        <input
          type="number"
          min={0}
          value={value || ''}
          placeholder="—"
          onChange={(e) => {
            const newWeeks = parseInt(e.target.value) || 0;
            let approxDeliveryDate: string | undefined = project.approxDeliveryDate;
            let approxWorkingDaysRemaining: number | undefined = project.approxWorkingDaysRemaining;
            if (project.dateReceived && newWeeks > 0) {
              const base = new Date(project.dateReceived);
              base.setDate(base.getDate() + newWeeks * 7);
              approxDeliveryDate = base.toISOString();
              const today = new Date();
              const diffMs = base.getTime() - today.getTime();
              const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
              const fullWeeks = Math.floor(diffDays / 7);
              const remainder = diffDays % 7;
              approxWorkingDaysRemaining = fullWeeks * 5 + Math.min(5, remainder);
            }
            updateProject(project.id, { leadTimeWeeks: newWeeks || null, approxDeliveryDate, approxWorkingDaysRemaining });
          }}
          className="bg-transparent outline-none w-20 text-sm border-b border-dashed border-slate-300 focus:border-blue-500"
        />
      );
    }

    if (field === 'approxWorkingDaysRemaining') {
      return <span className="text-sm">{value ?? '—'}</span>;
    }

    // Read-only timestamp
    if (field === 'lastUpdatedAt') {
      return <span className="text-xs text-slate-500">{value ? new Date(value).toLocaleString() : '—'}</span>;
    }

    // Text fields (default)
    return (
      <input
        className="bg-transparent outline-none w-full text-sm"
        value={value || ''}
        placeholder="—"
        onChange={(e) => updateProject(project.id, { [field]: e.target.value })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 w-full">
      <div className="mx-auto w-full px-6 py-8 space-y-6">
        {/* Glassmorphism Header */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Fire Door Schedule
              </h1>
              <p className="text-slate-600 mt-2">
                Manufacturing hub • Track from enquiry to delivery
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="bg-white/50 border-slate-200 hover:bg-white"
                onClick={() => router.push("/fire-doors/imports")}
              >
                <Download className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button
                variant="outline"
                className="bg-white/50 border-2 border-blue-500/30 text-blue-700 hover:bg-blue-50 hover:border-blue-500/50"
                onClick={() => {
                  // Navigate to the 144-column AG Grid page
                  if (projects.length > 0) {
                    const firstProject = projects[0];
                    router.push(`/fire-door-quotes/${firstProject.id}`);
                  } else {
                    router.push("/fire-door-quotes/new");
                  }
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                View Order
              </Button>
              <Button 
                onClick={() => router.push("/fire-door-schedule/new")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Beautiful Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Projects */}
            <div onClick={() => setLocationFilter('ALL')} className="group backdrop-blur-xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6 cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total Projects</p>
                  <h3 className="text-4xl font-bold text-slate-900">{stats.totalProjects}</h3>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    All fire door projects
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Red Folder */}
            <div onClick={() => setLocationFilter('RED FOLDER')} className="group backdrop-blur-xl bg-gradient-to-br from-orange-500/10 via-red-500/10 to-orange-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6 cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Red Folder</p>
                  <h3 className="text-4xl font-bold text-slate-900">{stats.byLocation.redFolder}</h3>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Awaiting sign-off
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/20 group-hover:bg-orange-500/30 transition-colors">
                  <FileText className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>

            {/* In Progress */}
            <div onClick={() => setLocationFilter('IN PROGRESS')} className="group backdrop-blur-xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6 cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">In Progress</p>
                  <h3 className="text-4xl font-bold text-slate-900">{stats.byLocation.inProgress}</h3>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    Active production
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors">
                  <Package className="w-6 h-6 text-cyan-600" />
                </div>
              </div>
            </div>

            {/* Complete */}
            <div onClick={() => setLocationFilter('COMPLETE')} className="group backdrop-blur-xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-green-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6 cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Complete</p>
                  <h3 className="text-4xl font-bold text-slate-900">{stats.byLocation.complete}</h3>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Ready for delivery
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                  <Truck className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by job name, MJS#, client, PO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 h-12 bg-white/50 border-slate-200 focus:bg-white transition-colors"
              />
            </div>
            <Button variant="outline" className="h-12 bg-white/50">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button
              variant="outline"
              className="h-12 bg-white/50"
              onClick={() => setShowTable((v) => !v)}
            >
              {showTable ? "Card View" : "Table View"}
            </Button>
          </div>
          {/* Tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(TAB_DEFINITIONS).map(([tabKey, tabDef]) => {
              const isActive = activeTab === tabKey;
              return (
                <Button
                  key={tabKey}
                  variant={isActive ? 'default' : 'outline'}
                  className={`text-sm ${isActive ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent' : 'bg-white/50'} backdrop-blur-sm`}
                  onClick={() => setActiveTab(tabKey)}
                >
                  {tabDef.label}
                </Button>
              );
            })}
          </div>
          {editingConfigField && (
            <div className="mt-4 p-3 rounded-xl border border-dashed border-slate-300 bg-white/70">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Edit options & colours for {COLUMN_LABELS[editingConfigField] || editingConfigField}
                </span>
                <button
                  onClick={() => setEditingConfigField(null)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                These changes apply immediately in this view. Later we can persist them per tenant.
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {(editingConfigField === 'jobLocation' ? jobLocationOptions : signOffOptions).map((opt, idx) => (
                  <div key={opt + idx} className="flex items-center gap-2 text-xs">
                    <input
                      className="flex-1 px-2 py-1 border rounded bg-white"
                      value={opt}
                      onChange={(e) => {
                        const next = [...(editingConfigField === 'jobLocation' ? jobLocationOptions : signOffOptions)];
                        next[idx] = e.target.value;
                        if (editingConfigField === 'jobLocation') setJobLocationOptions(next);
                        else setSignOffOptions(next);
                      }}
                    />
                    <input
                      type="color"
                      className="w-8 h-7 border rounded cursor-pointer"
                      onChange={(e) => {
                        try {
                          const hex = e.target.value;
                          const bg = `bg-[${hex}]`;
                          const classes = `${bg} text-white`;
                          if (editingConfigField === 'jobLocation') {
                            JOB_LOCATION_COLORS[opt] = classes;
                          } else {
                            SIGN_OFF_COLORS[opt] = classes;
                          }
                        } catch (err) {
                          console.error('Failed to apply colour override', err);
                        }
                      }}
                    />
                    <button
                      className="text-red-500 text-xs"
                      onClick={() => {
                        const next = (editingConfigField === 'jobLocation' ? jobLocationOptions : signOffOptions).filter((_, i) => i !== idx);
                        if (editingConfigField === 'jobLocation') setJobLocationOptions(next);
                        else setSignOffOptions(next);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="mt-2 text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                onClick={() => {
                  const next = [...(editingConfigField === 'jobLocation' ? jobLocationOptions : signOffOptions), 'NEW OPTION'];
                  if (editingConfigField === 'jobLocation') setJobLocationOptions(next);
                  else setSignOffOptions(next);
                }}
              >
                + Add option
              </button>
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-4">
            <span>Location Filter: <strong>{locationFilter}</strong></span>
            <span>Active Tab: <strong>{TAB_DEFINITIONS[activeTab as keyof typeof TAB_DEFINITIONS]?.label || activeTab}</strong></span>
          </div>
        </div>
        {/* Projects Listing (Table or Cards) */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg p-20 text-center">
            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No projects found</h3>
            <p className="text-slate-500">Create your first fire door project to get started</p>
          </div>
        ) : showTable ? (
          <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 text-xs uppercase tracking-wider select-none">
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs uppercase tracking-wider">Actions</span>
                    </th>
                    {TAB_DEFINITIONS[activeTab as keyof typeof TAB_DEFINITIONS].columns.map(field => (
                      <th
                        key={field}
                        className="px-4 py-3 text-left group"
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (field === 'jobLocation' || field === 'signOffStatus') {
                              setEditingConfigField(field);
                            } else {
                              toggleSort(field);
                            }
                          }}
                        >
                          {COLUMN_LABELS[field] || field}
                          {sortField === field ? (
                            sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      className="group hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/fire-door-quotes/${project.id}`);
                          }}
                          className="text-xs bg-white/80 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          View Order
                        </Button>
                      </td>
                      {TAB_DEFINITIONS[activeTab as keyof typeof TAB_DEFINITIONS].columns.map(field => (
                        <td
                          key={field}
                          className="px-4 py-3 text-slate-600 cursor-pointer"
                          onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                        >
                          <div onClick={(e) => e.stopPropagation()}>
                            {renderCell(project, field)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/fire-door-schedule/${project.id}`)}
                className="group backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg hover:shadow-2xl transition-all cursor-pointer overflow-hidden"
              >
                <div className="relative h-2 bg-slate-100">
                  <div
                    className={`h-full bg-gradient-to-r ${getProgressColor(project.overallProgress)} transition-all`}
                    style={{ width: `${project.overallProgress || 0}%` }}
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                        {project.jobName || "Untitled Project"}
                      </h3>
                      <p className="text-sm text-slate-500">MJS# {project.mjsNumber || "—"}</p>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.jobLocation)}`}>
                      {project.jobLocation || "Unknown"}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(project.signOffStatus)}`}>
                      {project.signOffStatus?.replace(/_/g, " ") || "No Status"}
                    </span>
                  </div>
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Due: {project.dateRequired ? new Date(project.dateRequired).toLocaleDateString() : "Not set"}</span>
                    </div>
                    {project.clientName && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="text-slate-400">•</span>
                        <span>{project.clientName}</span>
                      </div>
                    )}
                    {project.poNumber && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="text-slate-400">PO:</span>
                        <span>{project.poNumber}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Production Progress</span>
                      <span className="font-bold text-slate-900">{project.overallProgress || 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
