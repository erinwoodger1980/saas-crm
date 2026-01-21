"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, Search, Filter, TrendingUp, Clock, CheckCircle2, 
  AlertCircle, Calendar, Package, Wrench, Truck, FileText,
  BarChart3, ArrowUpRight, Download, ArrowUpDown, ChevronUp, ChevronDown, PoundSterling
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import ProductionLogModal from "@/components/ProductionLogModal";
import { ColumnConfigModal } from "@/components/ColumnConfigModal";

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
  signOffDate?: string; // Backend field name
  leadTimeWeeks?: number;
  calculatedCompletionDate?: string;
  workingDaysRemaining?: number; // Backend field name
  orderingStatus?: string;
  overallProgress?: number;
  approxDeliveryDate?: string;
  // New fields for Client Portal tab
  clientOrderNo?: string;
  typeOfJob?: string;
  laqNumber?: string;
  deliveryDate?: string;
  lajClientComments?: string;
  clientComments?: string;
  factoryFitIronmongeryReleased?: string;
  qrCodes?: boolean;
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
  };
}

interface FireDoorScheduleProps {
  isCustomerPortal?: boolean;
  clientAccountId?: string;
}

export default function FireDoorSchedulePage({ isCustomerPortal = false, clientAccountId }: FireDoorScheduleProps = {}) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<FireDoorProject[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  // Active tab (phase-based tabs) - default to CLIENT_PORTAL for customer portal
  const [activeTab, setActiveTab] = useState<string>(isCustomerPortal ? "CLIENT_PORTAL" : "PROJECT_OVERVIEW");
  // Location filter (multi-select checkboxes) - exclude COMPLETE & DELIVERED by default
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [showTable, setShowTable] = useState<boolean>(true); // consolidated table view toggle
  const [sortField, setSortField] = useState<string>("mjsNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingConfigField, setEditingConfigField] = useState<string | null>(null);
  const [customColors, setCustomColors] = useState<Record<string, {bg: string, text: string}>>({});
  const colorsLoadedRef = useRef(false); // Track if colors have been loaded from API
  const initialColorsRef = useRef<string>(""); // Track initial colors JSON to detect real changes
  const columnConfigLoadedRef = useRef(false); // Track if column config has been loaded from API
  const initialColumnConfigRef = useRef<string>(""); // Track initial column config JSON to detect real changes
  const [frozenColumns, setFrozenColumns] = useState<string[]>(['mjsNumber']); // Default freeze MJS column
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showColumnFreezeModal, setShowColumnFreezeModal] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [tabColumnConfigs, setTabColumnConfigs] = useState<Record<string, any[]>>({});
  const headerRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const headerRowRef = useRef<HTMLTableRowElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(0);
  const ACTIONS_WIDTH = 140; // Actions column width for frozen column calculations
  const [userIsInteracting, setUserIsInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Dropdown options state - must be declared before useEffect hooks that reference them
  const [jobLocationOptions, setJobLocationOptions] = useState<string[]>([
    "ASSIGNED MJS",
    "RED FOLDER",
    "IN PROGRESS",
    "COMPLETE IN FACTORY",
    "COMPLETE & DELIVERED",
    "N/A",
    "NOT LOOKED AT",
    "NO JOB ASSIGNED",
    "JOB IN DISPUTE / ISSUES",
    "CANCELLED",
  ]);
  const [signOffOptions, setSignOffOptions] = useState<string[]>([
    "AWAITING SCHEDULE",
    "WORKING ON SCHEDULE",
    "SCHEDULE SENT FOR SIGN OFF",
    "SCHEDULE SIGNED OFF",
    "NOT LOOKED AT",
  ]);
  const [scheduledByOptions, setScheduledByOptions] = useState<string[]>(["DAVE", "DARREN", "OFFICE"]);
  const [materialStatusOptions, setMaterialStatusOptions] = useState<string[]>(["Not in BOM", "In BOM TBC", "Ordered Call Off", "In BOM", "Stock", "Ordered", "N/A", "Received"]);
  const [ironmongeryStatusOptions, setIronmongeryStatusOptions] = useState<string[]>(["Not in BOM", "In BOM TBC", "Ordered Call Off", "In BOM", "Stock", "Ordered", "N/A", "Received", "Received from TGS", "Received from Customer"]);
  const [paperworkStatusOptions, setPaperworkStatusOptions] = useState<string[]>(["Not Started", "Working On", "Ready to Print", "Part Complete", "Printed in Office", "In Factory", "N/A"]);
  const [transportOptions, setTransportOptions] = useState<string[]>(["TBC", "By Customer", "By LAJ", "Collect", "Not Booked", "Booked"]);
  
  // Color maps for dropdowns (consistent per choice)
  const MATERIAL_STATUS_COLORS: Record<string, string> = {
    "Not in BOM": "bg-slate-100 text-slate-600",
    "In BOM TBC": "bg-orange-100 text-orange-700",
    "Ordered Call Off": "bg-cyan-100 text-cyan-700",
    "In BOM": "bg-blue-100 text-blue-700",
    "Stock": "bg-emerald-100 text-emerald-700",
    "Ordered": "bg-purple-100 text-purple-700",
    "N/A": "bg-slate-100 text-slate-600",
    "Received": "bg-green-100 text-green-700",
    "Received from TBS": "bg-green-100 text-green-700",
    "Received from Customer": "bg-green-100 text-green-700",
  };
  const PAPERWORK_STATUS_COLORS: Record<string, string> = {
    "Not Started": "bg-slate-100 text-slate-600",
    "Working On": "bg-blue-100 text-blue-700",
    "Ready to Print": "bg-cyan-100 text-cyan-700",
    "Part Complete": "bg-orange-100 text-orange-700",
    "Printed in Office": "bg-emerald-100 text-emerald-700",
    "In Factory": "bg-emerald-100 text-emerald-700",
    "N/A": "bg-slate-100 text-slate-600",
  };
  const TRANSPORT_STATUS_COLORS: Record<string, string> = {
    "TBC": "bg-slate-100 text-slate-600",
    "By Customer": "bg-blue-100 text-blue-700",
    "By LAJ": "bg-purple-100 text-purple-700",
    "Collect": "bg-cyan-100 text-cyan-700",
    "Not Booked": "bg-orange-100 text-orange-700",
    "Booked": "bg-green-100 text-green-700",
  };
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  
  // Production logging state
  const [productionModal, setProductionModal] = useState<{
    show: boolean;
    projectId: string;
    projectName: string;
    process: string;
    processLabel: string;
    currentPercent: number;
  } | null>(null);
  const [monthlyValue, setMonthlyValue] = useState<{
    totalManufacturingValue: string;
    logCount: number;
    projectCount: number;
  } | null>(null);

  // Fetch custom colors from API
  useEffect(() => {
    const fetchColors = async () => {
      try {
        console.log("[COLORS] Fetching colors from API...");
        const data = await apiFetch<{ colors: Record<string, {bg: string, text: string}> }>("/fire-door-schedule/colors");
        console.log("[COLORS] Fetched data:", data);
        
        if (data.colors && Object.keys(data.colors).length > 0) {
          console.log("[COLORS] Setting custom colors from API:", data.colors);
          setCustomColors(data.colors);
          initialColorsRef.current = JSON.stringify(data.colors); // Store initial state
          colorsLoadedRef.current = true; // Mark as loaded from API
        } else {
          console.log("[COLORS] No colors in database, using defaults");
          // Set default colors if none saved in database
          if (user?.tenantId === "cmi58fkzm0000it43i4h78pej") {
            // LAJ Joinery specific default colors
            const lajColors: Record<string, {bg: string, text: string}> = {
              "In BOM": { bg: "#fde047", text: "#854d0e" },
              "In BOM TBC": { bg: "#fde047", text: "#854d0e" },
              "Ordered": { bg: "#fb923c", text: "#7c2d12" },
              "Received": { bg: "#86efac", text: "#14532d" },
              "Stock": { bg: "#86efac", text: "#14532d" },
              "Received from TGS": { bg: "#86efac", text: "#14532d" },
              "Received from Customer": { bg: "#86efac", text: "#14532d" },
              "In Factory": { bg: "#86efac", text: "#14532d" },
              "Printed in Office": { bg: "#86efac", text: "#14532d" },
              "Booked": { bg: "#86efac", text: "#14532d" },
            };
            console.log("[COLORS] Setting LAJ default colors");
            setCustomColors(lajColors);
            initialColorsRef.current = JSON.stringify(lajColors); // Store initial state
            colorsLoadedRef.current = true; // Mark as loaded
          } else {
            // Generic default colors for other tenants
            const defaultColors: Record<string, {bg: string, text: string}> = {
              "In BOM": { bg: "#fde047", text: "#854d0e" },
              "Ordered": { bg: "#fb923c", text: "#7c2d12" },
              "Received": { bg: "#86efac", text: "#14532d" },
              "Stock": { bg: "#86efac", text: "#14532d" },
              "In Factory": { bg: "#86efac", text: "#14532d" },
              "Booked": { bg: "#86efac", text: "#14532d" },
            };
            console.log("[COLORS] Setting generic default colors");
            setCustomColors(defaultColors);
            initialColorsRef.current = JSON.stringify(defaultColors); // Store initial state
            colorsLoadedRef.current = true; // Mark as loaded
          }
        }
      } catch (error) {
        console.error("[COLORS] Error fetching colors:", error);
      }
    };
    
    if (user?.tenantId) {
      console.log("[COLORS] User tenant ID:", user.tenantId);
      fetchColors();
    } else {
      console.log("[COLORS] No user or tenant ID, skipping color fetch");
    }
  }, [user?.tenantId]);

  // Fetch custom column config from API
  useEffect(() => {
    const fetchColumnConfig = async () => {
      try {
        console.log("[COLUMN CONFIG] Fetching column config from API...");
        const data = await apiFetch<{ columnConfig: Record<string, any[]> }>("/fire-door-schedule/column-config");
        console.log("[COLUMN CONFIG] Fetched data:", data);
        
        if (data.columnConfig && Object.keys(data.columnConfig).length > 0) {
          console.log("[COLUMN CONFIG] Setting custom column config from API:", data.columnConfig);
          setTabColumnConfigs(data.columnConfig);
          initialColumnConfigRef.current = JSON.stringify(data.columnConfig); // Store initial state
          columnConfigLoadedRef.current = true; // Mark as loaded from API
        } else {
          console.log("[COLUMN CONFIG] No column config in database, using defaults");
          columnConfigLoadedRef.current = true; // Mark as loaded
        }
      } catch (error) {
        console.error("[COLUMN CONFIG] Error fetching column config:", error);
        columnConfigLoadedRef.current = true; // Mark as loaded even on error to allow saving
      }
    };
    
    if (user?.tenantId) {
      console.log("[COLUMN CONFIG] User tenant ID:", user.tenantId);
      fetchColumnConfig();
    } else {
      console.log("[COLUMN CONFIG] No user or tenant ID, skipping column config fetch");
    }
  }, [user?.tenantId]);

  useEffect(() => {
    loadData();
    // Load persisted UI prefs
    try {
      const savedView = localStorage.getItem("fds:view");
      const savedActiveTab = localStorage.getItem("fds:activeTab");
      const savedLocations = localStorage.getItem("fds:selectedLocations");
      const savedSortF = localStorage.getItem("fds:sortField");
      const savedSortD = localStorage.getItem("fds:sortDir") as "asc" | "desc" | null;
      const savedFrozenColumns = localStorage.getItem("fds:frozenColumns");
      const savedColumnFilters = localStorage.getItem("fds:columnFilters");
      // Note: tabColumnConfigs now loaded from API, not localStorage
      if (savedView) setShowTable(savedView === "table");
      if (savedActiveTab) setActiveTab(savedActiveTab);
      if (savedFrozenColumns) {
        try {
          setFrozenColumns(JSON.parse(savedFrozenColumns));
        } catch {}
      }
      if (savedColumnFilters) {
        try {
          setColumnFilters(JSON.parse(savedColumnFilters));
        } catch {}
      }
      
      // Initialize selectedLocations with defaults if not saved or empty
      // Default: all locations except "COMPLETE & DELIVERED"
      const defaultLocations = [
        "ASSIGNED MJS",
        "RED FOLDER",
        "IN PROGRESS",
        "COMPLETE IN FACTORY",
        "N/A",
        "NOT LOOKED AT",
        "NO JOB ASSIGNED",
        "JOB IN DISPUTE / ISSUES",
        "CANCELLED",
      ];
      
      if (savedLocations) {
        try {
          const parsed = JSON.parse(savedLocations);
          // Validate that parsed is a valid array with recognized locations
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Saved state is valid, use it
            setSelectedLocations(parsed);
          } else {
            // If saved but empty, use defaults
            setSelectedLocations(defaultLocations);
          }
        } catch {
          // If parse fails, use defaults
          setSelectedLocations(defaultLocations);
        }
      } else {
        // If not saved at all, use defaults
        setSelectedLocations(defaultLocations);
      }
      
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
    try { 
      // Save selected locations
      localStorage.setItem("fds:selectedLocations", JSON.stringify(selectedLocations)); 
    } catch {}
  }, [selectedLocations]);
  useEffect(() => {
    try { localStorage.setItem("fds:sortField", sortField); localStorage.setItem("fds:sortDir", sortDir); } catch {}
  }, [sortField, sortDir]);
  
  // Save customColors to database via API whenever they change (but not on initial load)
  useEffect(() => {
    // Only save if colors have been loaded and actually changed
    if (user?.tenantId && Object.keys(customColors).length > 0 && colorsLoadedRef.current) {
      const currentColorsStr = JSON.stringify(customColors);
      // Only save if colors have actually changed from initial state
      if (currentColorsStr !== initialColorsRef.current) {
        const saveColors = async () => {
          try {
            console.log("[COLORS] Saving colors to API:", customColors);
            console.log("[COLORS] Initial colors:", initialColorsRef.current);
            console.log("[COLORS] Current colors:", currentColorsStr);
            
            const response = await apiFetch("/fire-door-schedule/colors", {
              method: "POST",
              json: { colors: customColors },
            });
            
            console.log("[COLORS] Save response:", response);
            console.log("[COLORS] Colors saved successfully");
            // Update initial ref to prevent re-saving the same data
            initialColorsRef.current = currentColorsStr;
          } catch (error) {
            console.error("[COLORS] Error saving colors:", error);
          }
        };
        // Debounce the save to avoid too many requests
        const timeoutId = setTimeout(saveColors, 500);
        return () => clearTimeout(timeoutId);
      } else {
        console.log("[COLORS] No change detected, skipping save");
      }
    } else {
      if (!colorsLoadedRef.current) {
        console.log("[COLORS] Colors not yet loaded from API, skipping save");
      }
    }
  }, [customColors, user?.tenantId]);
  useEffect(() => {
    try { localStorage.setItem("fds:frozenColumns", JSON.stringify(frozenColumns)); } catch {}
  }, [frozenColumns]);
  useEffect(() => {
    try { localStorage.setItem("fds:columnFilters", JSON.stringify(columnFilters)); } catch {}
  }, [columnFilters]);
  // Save column config to API (tenant-wide, not per-user)
  useEffect(() => {
    // Only save if column config has been loaded and actually changed
    if (user?.tenantId && Object.keys(tabColumnConfigs).length > 0 && columnConfigLoadedRef.current) {
      const currentConfigStr = JSON.stringify(tabColumnConfigs);
      // Only save if config has actually changed from initial state
      if (currentConfigStr !== initialColumnConfigRef.current) {
        const saveColumnConfig = async () => {
          try {
            console.log("[COLUMN CONFIG] Saving column config to API:", tabColumnConfigs);
            
            const response = await apiFetch("/fire-door-schedule/column-config", {
              method: "POST",
              json: { columnConfig: tabColumnConfigs },
            });
            
            console.log("[COLUMN CONFIG] Save response:", response);
            console.log("[COLUMN CONFIG] Column config saved successfully");
            // Update initial ref to prevent re-saving the same data
            initialColumnConfigRef.current = currentConfigStr;
          } catch (error) {
            console.error("[COLUMN CONFIG] Error saving column config:", error);
          }
        };
        // Debounce the save to avoid too many requests
        const timeoutId = setTimeout(saveColumnConfig, 500);
        return () => clearTimeout(timeoutId);
      } else {
        console.log("[COLUMN CONFIG] No change detected, skipping save");
      }
    } else {
      if (!columnConfigLoadedRef.current) {
        console.log("[COLUMN CONFIG] Column config not yet loaded from API, skipping save");
      }
    }
  }, [tabColumnConfigs, user?.tenantId]);

  // Load dropdown options from localStorage
  useEffect(() => {
    const savedJobLocations = localStorage.getItem("fds:jobLocationOptions");
    const savedSignOff = localStorage.getItem("fds:signOffOptions");
    const savedScheduledBy = localStorage.getItem("fds:scheduledByOptions");
    const savedMaterialStatus = localStorage.getItem("fds:materialStatusOptions");
    const savedIronmongeryStatus = localStorage.getItem("fds:ironmongeryStatusOptions");
    const savedPaperworkStatus = localStorage.getItem("fds:paperworkStatusOptions");
    const savedTransport = localStorage.getItem("fds:transportOptions");

    if (savedJobLocations) setJobLocationOptions(JSON.parse(savedJobLocations));
    if (savedSignOff) setSignOffOptions(JSON.parse(savedSignOff));
    if (savedScheduledBy) setScheduledByOptions(JSON.parse(savedScheduledBy));
    if (savedMaterialStatus) setMaterialStatusOptions(JSON.parse(savedMaterialStatus));
    if (savedIronmongeryStatus) setIronmongeryStatusOptions(JSON.parse(savedIronmongeryStatus));
    if (savedPaperworkStatus) setPaperworkStatusOptions(JSON.parse(savedPaperworkStatus));
    if (savedTransport) setTransportOptions(JSON.parse(savedTransport));
  }, []);

  // Save dropdown options to localStorage
  useEffect(() => {
    try { localStorage.setItem("fds:jobLocationOptions", JSON.stringify(jobLocationOptions)); } catch {}
  }, [jobLocationOptions]);
  useEffect(() => {
    try { localStorage.setItem("fds:signOffOptions", JSON.stringify(signOffOptions)); } catch {}
  }, [signOffOptions]);
  useEffect(() => {
    try { localStorage.setItem("fds:scheduledByOptions", JSON.stringify(scheduledByOptions)); } catch {}
  }, [scheduledByOptions]);
  useEffect(() => {
    try { localStorage.setItem("fds:materialStatusOptions", JSON.stringify(materialStatusOptions)); } catch {}
  }, [materialStatusOptions]);
  useEffect(() => {
    try { localStorage.setItem("fds:ironmongeryStatusOptions", JSON.stringify(ironmongeryStatusOptions)); } catch {}
  }, [ironmongeryStatusOptions]);
  useEffect(() => {
    try { localStorage.setItem("fds:paperworkStatusOptions", JSON.stringify(paperworkStatusOptions)); } catch {}
  }, [paperworkStatusOptions]);
  useEffect(() => {
    try { localStorage.setItem("fds:transportOptions", JSON.stringify(transportOptions)); } catch {}
  }, [transportOptions]);

  async function loadData() {
    // Save current scroll position before loading
    const scrollEl = (window as any).__fdsTableScrollEl;
    if (scrollEl) {
      scrollPositionRef.current = {
        x: scrollEl.scrollLeft,
        y: scrollEl.scrollTop
      };
    }

    setLoading(true);
    try {
      const now = new Date();
      
      // Build query params for client filter
      const queryParams = clientAccountId ? `?clientAccountId=${clientAccountId}` : '';
      
      // Load projects and stats (critical)
      const [projectsData, statsData] = await Promise.all([
        apiFetch<{ projects: FireDoorProject[] }>(`/fire-door-schedule${queryParams}`),
        apiFetch<Stats>(`/fire-door-schedule/stats/summary${queryParams}`),
      ]);
      
      setProjects(projectsData.projects);
      setStats(statsData);
      
      // Load monthly value (optional - don't fail if it errors) - skip for customer portal
      if (!isCustomerPortal) {
        try {
          const monthlyData = await apiFetch<any>(`/fire-door-production/stats/monthly-value?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
          setMonthlyValue(monthlyData);
        } catch (monthlyError) {
          console.warn("Failed to load monthly value (non-critical):", monthlyError);
          setMonthlyValue({ totalManufacturingValue: '0', logCount: 0, projectCount: 0 });
        }
      }
    } catch (error) {
      console.error("Error loading fire door schedule:", error);
    } finally {
      setLoading(false);
    }
  }

  // Removed dynamic left offsets; use stable constant-based offsets as before

  // Measure header row height to position filter row exactly beneath
  useEffect(() => {
    function measureHeaderHeight() {
      const h = headerRowRef.current?.offsetHeight ?? 0;
      setHeaderHeight(h);
    }
    const id = requestAnimationFrame(measureHeaderHeight);
    window.addEventListener("resize", measureHeaderHeight);
    window.addEventListener("load", measureHeaderHeight);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measureHeaderHeight);
      window.removeEventListener("load", measureHeaderHeight);
    };
  }, [activeTab, frozenColumns]);

  // Using stable constant-based left offsets for frozen columns

  // Track user interaction to pause auto-refresh
  useEffect(() => {
    const handleUserInteraction = () => {
      setUserIsInteracting(true);
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      // Reset interaction flag after 30 seconds of no activity
      interactionTimeoutRef.current = setTimeout(() => {
        setUserIsInteracting(false);
      }, 30000);
    };

    // Listen for any user interaction
    window.addEventListener('focus', handleUserInteraction);
    window.addEventListener('input', handleUserInteraction);
    window.addEventListener('change', handleUserInteraction);
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('mousedown', handleUserInteraction);
    window.addEventListener('mousemove', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);
    window.addEventListener('scroll', handleUserInteraction);

    return () => {
      window.removeEventListener('focus', handleUserInteraction);
      window.removeEventListener('input', handleUserInteraction);
      window.removeEventListener('change', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('mousemove', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

  // Restore scroll position after data loads
  useEffect(() => {
    if (!loading && scrollPositionRef.current) {
      const scrollEl = (window as any).__fdsTableScrollEl;
      if (scrollEl) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
          scrollEl.scrollLeft = scrollPositionRef.current.x;
          scrollEl.scrollTop = scrollPositionRef.current.y;
        });
      }
    }
  }, [loading]);

  // Auto-refresh schedule data every 3 minutes (only when user is not interacting)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!userIsInteracting) {
        loadData();
      }
    }, 180000);
    return () => clearInterval(interval);
  }, [userIsInteracting]);

  // Apply search + tab filters + column filters
  const filteredProjects = projects
    .filter((project) => {
      const searchLower = searchTerm.toLowerCase();
      const isSearchMatch = (
        project.mjsNumber?.toLowerCase().includes(searchLower) ||
        project.jobName?.toLowerCase().includes(searchLower) ||
        project.clientName?.toLowerCase().includes(searchLower) ||
        project.poNumber?.toLowerCase().includes(searchLower)
      );
      
      // Apply search filter
      if (searchTerm && !isSearchMatch) {
        return false;
      }
      
      // Apply location filter if any locations are selected
      if (selectedLocations.length > 0) {
        const loc = (project.jobLocation || "").trim().toUpperCase();
        // Convert selected locations to uppercase for comparison
        const upperSelectedLocations = selectedLocations.map(l => l.toUpperCase());
        if (!upperSelectedLocations.includes(loc)) {
          return false;
        }
      }
      
      // Apply column filters
      for (const [field, filterValue] of Object.entries(columnFilters)) {
        if (!filterValue) continue;
        const projectValue = String(project[field] || '').toLowerCase();
        const filterLower = filterValue.toLowerCase();
        if (!projectValue.includes(filterLower)) {
          return false;
        }
      }
      
      return true;
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



  // Helper to get hex color from Tailwind class
  function getColorHex(colorClass: string): string {
    const colorMap: Record<string, string> = {
      'blue-100': '3b82f6', 'orange-100': 'f97316', 'cyan-100': '06b6d4',
      'emerald-100': '10b981', 'green-100': '22c55e', 'red-100': 'ef4444',
      'slate-100': '64748b'
    };
    const match = colorClass.match(/bg-(\w+-\d+)/);
    return match ? (colorMap[match[1]] || '3b82f6') : '3b82f6';
  }

  // Helper to calculate brightness of hex color
  function getBrightness(hex: string): number {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  // Map Tailwind background classes to hex colors
  const TAILWIND_BG_TO_HEX: Record<string, string> = {
    'bg-slate-100': '#f1f5f9',
    'bg-orange-100': '#ffedd5',
    'bg-cyan-100': '#cffafe',
    'bg-blue-100': '#dbeafe',
    'bg-emerald-100': '#d1fae5',
    'bg-purple-100': '#f3e8ff',
    'bg-green-100': '#dcfce7',
  };

  // Get default color for an option based on the field being edited
  function getDefaultColorForOption(fieldName: string, optionValue: string): string {
    let colorMap: Record<string, string> = {};
    
    if (['blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'cassettesStatus', 'timbersStatus', 'ironmongeryStatus'].includes(fieldName)) {
      colorMap = MATERIAL_STATUS_COLORS;
    } else if (['doorPaperworkStatus', 'finalCncSheetStatus', 'finalChecksSheetStatus', 'deliveryChecklistStatus', 'framesPaperworkStatus'].includes(fieldName)) {
      colorMap = PAPERWORK_STATUS_COLORS;
    } else if (fieldName === 'transportStatus') {
      colorMap = TRANSPORT_STATUS_COLORS;
    }
    
    const tailwindClasses = colorMap[optionValue];
    if (!tailwindClasses) return '#ffffff';
    
    // Extract bg-* class and convert to hex
    const bgClass = tailwindClasses.split(' ').find(c => c.startsWith('bg-'));
    return bgClass ? (TAILWIND_BG_TO_HEX[bgClass] || '#ffffff') : '#ffffff';
  }

  // Get BOM status color for a specific status value
  function getBOMStatusColor(status: string | undefined): string {
    if (!status) return '#e2e8f0'; // slate-200
    const customColor = customColors[status];
    if (customColor) return customColor.bg;
    
    const tailwindClasses = MATERIAL_STATUS_COLORS[status];
    if (!tailwindClasses) return '#e2e8f0';
    
    const bgClass = tailwindClasses.split(' ').find(c => c.startsWith('bg-'));
    return bgClass ? (TAILWIND_BG_TO_HEX[bgClass] || '#e2e8f0') : '#e2e8f0';
  }

  // Calculate BOM completion percentage
  function calculateBOMPercent(project: FireDoorProject): number {
    const statuses = [
      project.blanksStatus,
      project.lippingsStatus,
      project.facingsStatus,
      project.glassStatus,
      project.cassettesStatus,
      project.timbersStatus,
      project.ironmongeryStatus
    ];
    const completed = statuses.filter(s => s === 'Received' || s === 'N/A' || s === 'Stock').length;
    return Math.round((completed / statuses.length) * 100);
  }

  // Calculate Paperwork completion percentage
  function calculatePaperworkPercent(project: FireDoorProject): number {
    const statuses = [
      project.doorPaperworkStatus,
      project.finalCncSheetStatus,
      project.finalChecksSheetStatus,
      project.deliveryChecklistStatus,
      project.framesPaperworkStatus
    ];
    const completed = statuses.filter(s => s === 'Printed in Office' || s === 'In Factory' || s === 'N/A').length;
    return Math.round((completed / statuses.length) * 100);
  }

  // Calculate Production completion percentage
  function calculateProductionPercent(project: FireDoorProject): number {
    const allProcesses = [
      project.blanksCutPercent,
      project.edgebandPercent,
      project.calibratePercent,
      project.facingsPercent,
      project.finalCncPercent,
      project.finishPercent,
      project.sandPercent,
      project.sprayPercent,
      project.cutPercent,
      project.cncPercent,
      project.buildPercent
    ];
    // Filter out N/A processes (null values) and only include applicable processes
    const applicableProcesses = allProcesses.filter(p => p !== null);
    if (applicableProcesses.length === 0) return 0;
    const avg = applicableProcesses.reduce((a, b) => a + (b || 0), 0) / applicableProcesses.length;
    return Math.round(avg);
  }

  // Tab definitions with labels and column sets
  const PRODUCTION_COLUMNS = [
    'mjsNumber',
    'clientName',
    'jobName',
    'blanksCutPercent',
    'edgebandPercent',
    'calibratePercent',
    'facingsPercent',
    'finalCncPercent',
    'finishPercent',
    'sandPercent',
    'sprayPercent',
    'cutPercent',
    'cncPercent',
    'buildPercent',
    'overallProgress',
    'transportStatus',
    'doorSets',
    'leaves',
    'deliveryNotes'
  ];
  const TAB_DEFINITIONS = {
    CLIENT_PORTAL: {
      label: 'Client Portal',
      columns: [
        'mjsNumber',
        'jobLocation',
        'clientOrderNo',
        'jobName',
        'scheduledBy',
        'typeOfJob',
        'laqNumber',
        'dateReceived',
        'signOffDate',
        'poNumber',
        'netValue',
        'dateRequired',
        'calculatedCompletionDate',
        'deliveryDate',
        'lajClientComments',
        'clientComments',
        'factoryFitIronmongeryReleased',
        'transportStatus',
        'qrCodes'
      ]
    },
    PROGRESS: {
      label: 'Progress',
      columns: [
        'mjsNumber',
        'clientName',
        'jobName',
        'dateReceived',
        'jobLocation',
        'signOffStatus',
        'scheduledBy',
        'signOffDate',
        'workingDaysRemaining',
        'bomPercent',
        'paperworkPercent',
        'productionPercent'
      ]
    },
    PROJECT_OVERVIEW: {
      label: 'Project Overview',
      columns: [
        'mjsNumber',
        'clientName',
        'jobName',
        'netValue',
        'dateReceived',
        'jobLocation',
        'signOffStatus',
        'scheduledBy',
        'signOffDate',
        'leadTimeWeeks',
        'calculatedCompletionDate',
        'workingDaysRemaining',
      ]
    },
    BOM_OVERVIEW: {
      label: 'BOM Overview',
      columns: [
        'mjsNumber',
        'clientName',
        'jobName',
        'blanksStatus',
        'lippingsStatus',
        'facingsStatus',
        'glassStatus',
        'cassettesStatus',
        'timbersStatus',
        'ironmongeryStatus',
        'bomPercent'
      ]
    },
    BOM_MATERIALS: {
      label: 'BOM & Materials',
      columns: [
        'mjsNumber',
        'clientName',
        'jobName',
        'blanksStatus',
        'blanksDateOrdered',
        'blanksDateExpected',
        'blanksDateReceived',
        'lippingsStatus',
        'lippingsDateOrdered',
        'lippingsDateExpected',
        'lippingsDateReceived',
        'facingsStatus',
        'facingsDateOrdered',
        'facingsDateExpected',
        'facingsDateReceived',
        'glassStatus',
        'glassDateOrdered',
        'glassDateExpected',
        'glassDateReceived',
        'cassettesStatus',
        'cassettesDateOrdered',
        'cassettesDateExpected',
        'cassettesDateReceived',
        'timbersStatus',
        'timbersDateOrdered',
        'timbersDateExpected',
        'timbersDateReceived',
        'ironmongeryStatus',
        'ironmongeryDateOrdered',
        'ironmongeryDateExpected',
        'ironmongeryDateReceived',
        'bomNotes'
      ]
    },
    PAPERWORK: {
      label: 'Paperwork',
      columns: [
        'mjsNumber',
        'clientName',
        'jobName',
        'doorPaperworkStatus',
        'finalChecksSheetStatus',
        'deliveryChecklistStatus',
        'framesPaperworkStatus',
        'paperworkComments'
      ]
    },
    PRODUCTION: {
      label: 'Production',
      columns: PRODUCTION_COLUMNS
    },
    SNAPSHOT: {
      label: 'Snapshot',
      columns: PRODUCTION_COLUMNS
    },
    ALL: {
      label: 'All',
      columns: [
        'mjsNumber',
        'clientName',
        'jobName',
        'netValue',
        'dateReceived',
        'jobLocation',
        'signOffStatus',
        'scheduledBy',
        'signOffDate',
        'leadTimeWeeks',
        'calculatedCompletionDate',
        'workingDaysRemaining',
        'blanksStatus',
        'blanksDateOrdered',
        'blanksDateExpected',
        'blanksDateReceived',
        'lippingsStatus',
        'lippingsDateOrdered',
        'lippingsDateExpected',
        'lippingsDateReceived',
        'facingsStatus',
        'facingsDateOrdered',
        'facingsDateExpected',
        'facingsDateReceived',
        'glassStatus',
        'glassDateOrdered',
        'glassDateExpected',
        'glassDateReceived',
        'cassettesStatus',
        'cassettesDateOrdered',
        'cassettesDateExpected',
        'cassettesDateReceived',
        'timbersStatus',
        'timbersDateOrdered',
        'timbersDateExpected',
        'timbersDateReceived',
        'ironmongeryStatus',
        'ironmongeryDateOrdered',
        'ironmongeryDateExpected',
        'ironmongeryDateReceived',
        'doorPaperworkStatus',
        'finalCncSheetStatus',
        'finalChecksSheetStatus',
        'deliveryChecklistStatus',
        'framesPaperworkStatus',
        'paperworkComments',
        'blanksCutPercent',
        'edgebandPercent',
        'calibratePercent',
        'facingsPercent',
        'finalCncPercent',
        'finishPercent',
        'sandPercent',
        'sprayPercent',
        'cutPercent',
        'cncPercent',
        'buildPercent',
        'overallProgress',
        'transportStatus',
        'doorSets',
        'leaves',
        'deliveryNotes'
      ]
    }
  };

  // Column field labels
  const COLUMN_LABELS: Record<string, string> = {
    mjsNumber: 'MJS',
    jobName: 'Job Description',
    clientOrderNo: 'Client Order No',
    typeOfJob: 'Type of Job',
    laqNumber: 'LAQ Number',
    lajClientComments: 'LAJ Client Comments',
    clientComments: 'Client Comments',
    factoryFitIronmongeryReleased: 'Factory Fit Ironmongery Released',
    qrCodes: 'QR Codes',
    deliveryDate: 'Delivery Date',
    clientName: 'Customer',
    netValue: 'Net Value',
    poNumber: 'PO',
    dateReceived: 'Date Received in Red Folder',
    dateRequired: 'Required',
    jobLocation: 'Job Location',
    overallProgress: 'Progress',
    signOffStatus: 'Sign Off Status',
    scheduledBy: 'LAJ Scheduler',
    signOffDate: 'Date Signed Off',
    leadTimeWeeks: 'Lead Time in Weeks',
    calculatedCompletionDate: 'Calc Completion Date',
    approxDeliveryDate: 'Approx Delivery',
    workingDaysRemaining: 'Approx Working Days Remaining',
    bomPercent: 'BOM Progress',
    paperworkPercent: 'Paperwork Progress',
    productionPercent: 'Production Progress',
    blanksStatus: 'Blanks Status',
    blanksDateOrdered: 'Blanks Date',
    blanksDateExpected: 'Blanks Date Expected',
    blanksDateReceived: 'Blanks Date Received',
    lippingsStatus: 'Lippings Status',
    lippingsDateOrdered: 'Lippings Date',
    lippingsDateExpected: 'Lippings Date Expected',
    lippingsDateReceived: 'Lippings Date Received',
    facingsStatus: 'Facings Status',
    facingsDateOrdered: 'Facings Date',
    facingsDateExpected: 'Facings Date Expected',
    facingsDateReceived: 'Facings Date Received',
    glassStatus: 'Glass Status',
    glassDateOrdered: 'Glass Date',
    glassDateExpected: 'Glass Date Expected',
    glassDateReceived: 'Glass Date Received',
    cassettesStatus: 'Cassettes Status',
    cassettesDateOrdered: 'Cassettes Date',
    cassettesDateExpected: 'Cassettes Date Expected',
    cassettesDateReceived: 'Cassettes Date Received',
    timbersStatus: 'Timbers Status',
    timbersDateOrdered: 'Timbers Date',
    timbersDateExpected: 'Timbers Date Expected',
    timbersDateReceived: 'Timbers Date Received',
    ironmongeryStatus: 'Ironmongery Status',
    ironmongeryDateOrdered: 'Ironmongery Date',
    ironmongeryDateExpected: 'Ironmongery Date Expected',
    ironmongeryDateReceived: 'Ironmongery Date Received',
    doorPaperworkStatus: 'Door Paperwork',
    finalCncSheetStatus: 'Final CNC Sheet',
    finalChecksSheetStatus: 'Final Checks Sheet',
    deliveryChecklistStatus: 'Delivery Checklist',
    framesPaperworkStatus: 'Frames Paperwork',
    paperworkComments: 'Paperwork Comments',
    blanksCutPercent: 'Blanks Cut %',
    edgebandPercent: 'Edgeband %',
    calibratePercent: 'Calibrate %',
    facingsPercent: 'Facings %',
    finalCncPercent: 'Final CNC %',
    finishPercent: 'Finish %',
    sandPercent: 'Sand %',
    sprayPercent: 'Spray %',
    cutPercent: 'Cut %',
    cncPercent: 'CNC %',
    buildPercent: 'Build %',
    transportStatus: 'Transport',
    doorSets: 'Door Sets',
    leaves: 'Leaves',
    deliveryNotes: 'Delivery Notes',
    installStart: 'Install Start',
    installEnd: 'Install End',
    snaggingStatus: 'Snagging',
    snaggingComplete: 'Snagging Done',
    communicationNotes: 'Communication',
    internalNotes: 'Internal Notes',
    bomNotes: 'Notes',
    lastUpdatedBy: 'Updated By',
    lastUpdatedAt: 'Updated At',
    approxDate: 'Approx Date'
  };

  // Calculate column width based on field type and configuration
  const getColumnWidth = (field: string): number => {
    // First check the current tab's configuration
    const tabConfig = tabColumnConfigs[activeTab];
    if (tabConfig && tabConfig.length > 0) {
      const colConfig = tabConfig.find(c => c.field === field);
      if (colConfig && colConfig.width) {
        console.log('[COLUMN WIDTH] Using configured width for', field, ':', colConfig.width);
        return colConfig.width;
      }
    }
    
    // Then check ALL tab configuration (as fallback to preserve old settings)
    const allTabConfig = tabColumnConfigs['ALL'];
    if (allTabConfig && allTabConfig.length > 0) {
      const colConfig = allTabConfig.find(c => c.field === field);
      if (colConfig && colConfig.width) {
        console.log('[COLUMN WIDTH] Using ALL tab configured width for', field, ':', colConfig.width);
        return colConfig.width;
      }
    }
    
    // Finally fallback to default widths based on field type
    // Special case for bomNotes - wider default
    if (field === 'bomNotes') {
      return 200;
    }
    // Narrow columns for status/select fields
    if (['blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'cassettesStatus', 'timbersStatus', 'ironmongeryStatus', 'doorPaperworkStatus', 'finalCncSheetStatus', 'finalChecksSheetStatus', 'deliveryChecklistStatus', 'framesPaperworkStatus', 'transportStatus', 'jobLocation', 'signOffStatus', 'scheduledBy', 'snaggingStatus', 'snaggingComplete'].includes(field)) {
      return 85;
    }
    // Small columns for numbers and short fields
    if (['mjsNumber', 'poNumber', 'leadTimeWeeks', 'doorSets', 'leaves', 'overallProgress', 'bomPercent', 'paperworkPercent', 'productionPercent', 'blanksCutPercent', 'edgebandPercent', 'calibratePercent', 'facingsPercent', 'finalCncPercent', 'finishPercent', 'sandPercent', 'sprayPercent', 'cutPercent', 'cncPercent', 'buildPercent', 'netValue'].includes(field)) {
      return 75;
    }
    // Medium columns for dates
    if (field.includes('Date')) {
      return 90;
    }
    // Regular columns for other text
    return 120;
  };

  // Get visible columns for current tab
  function getVisibleColumns(): string[] {
    const tabConfig = tabColumnConfigs[activeTab];
    if (tabConfig && tabConfig.length > 0) {
      return tabConfig.filter(c => c.visible).map(c => c.field);
    }
    // Default to tab definition
    return TAB_DEFINITIONS[activeTab as keyof typeof TAB_DEFINITIONS]?.columns || [];
  }

  // Handle save column config
  function handleSaveColumnConfig(newConfig: any[]) {
    console.log('[COLUMN CONFIG] Saving config for tab:', activeTab, newConfig);
    setTabColumnConfigs({
      ...tabColumnConfigs,
      [activeTab]: newConfig
    });
    setShowColumnConfig(false);
  }

  // Get available fields for column config modal (all fields from ALL tab)
  const allAvailableFields = TAB_DEFINITIONS.ALL.columns.map(field => ({
    field,
    label: COLUMN_LABELS[field] || field,
    type: 'text'
  }));

  // Get current column config for the modal
  function getCurrentColumnConfig() {
    const tabConfig = tabColumnConfigs[activeTab];
    console.log('[COLUMN CONFIG] Getting config for tab:', activeTab, 'Existing config:', tabConfig);
    if (tabConfig && tabConfig.length > 0) {
      console.log('[COLUMN CONFIG] Using existing config');
      return tabConfig;
    }
    // Build from tab defaults
    const defaultCols = TAB_DEFINITIONS[activeTab as keyof typeof TAB_DEFINITIONS]?.columns || [];
    console.log('[COLUMN CONFIG] Building from defaults, columns:', defaultCols.length);
    return defaultCols.map(field => ({
      field,
      label: COLUMN_LABELS[field] || field,
      visible: true,
      width: 150, // Default width - will be customized by user
      frozen: false
    }));
  }

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
      // Show error toast but keep optimistic update
      // User can refresh manually if needed
    }
  }

  // Render cell based on field type
  function renderCell(project: FireDoorProject, field: string) {
    // Handle calculated approxDate field
    if (field === 'approxDate') {
      if (project.signOffDate && project.leadTimeWeeks) {
        const signOffDate = new Date(project.signOffDate);
        const daysToAdd = project.leadTimeWeeks * 7;
        const approxDate = new Date(signOffDate);
        approxDate.setDate(approxDate.getDate() + daysToAdd);
        return (
          <div className="text-[11px] font-medium px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            {approxDate.toLocaleDateString('en-GB')}
          </div>
        );
      }
      return <div className="text-[11px] text-slate-400 px-3 py-1.5">—</div>;
    }
    
    // Handle calculated completion date field
    if (field === 'calculatedCompletionDate') {
      if (project.calculatedCompletionDate) {
        const completionDate = new Date(project.calculatedCompletionDate);
        return (
          <div className="text-[11px] font-medium px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            {completionDate.toLocaleDateString('en-GB')}
          </div>
        );
      }
      return <div className="text-[11px] text-slate-400 px-3 py-1.5">—</div>;
    }
    
    const value = project[field];

    // Date fields
    if (field === 'signOffDate') {
      return (
        <input
          type="date"
          disabled={isCustomerPortal}
          className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
          value={value ? new Date(value).toISOString().slice(0, 10) : ''}
          onChange={(e) => {
            const dateValue = e.target.value ? new Date(e.target.value).toISOString() : undefined;
            const updates: any = { signOffDate: dateValue };
            
            // Calculate completion date if we have both signOffDate and leadTimeWeeks
            if (dateValue && project.leadTimeWeeks) {
              const signOffDate = new Date(dateValue);
              const weeksToAdd = project.leadTimeWeeks * 7;
              const completionDate = new Date(signOffDate);
              completionDate.setDate(completionDate.getDate() + weeksToAdd);
              updates.calculatedCompletionDate = completionDate.toISOString();
            } else {
              updates.calculatedCompletionDate = undefined;
            }
            
            updateProject(project.id, updates);
          }}
        />
      );
    }

    if (field === 'dateReceived') {
      return (
        <input
          type="date"
          disabled={isCustomerPortal}
          className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
          value={value ? new Date(value).toISOString().slice(0, 10) : ''}
          onChange={(e) => {
            const newDate = e.target.value;
            const dateValue = newDate ? new Date(newDate).toISOString() : undefined;
            const leadWeeks = project.leadTimeWeeks || 0;
            let approxDeliveryDate: string | undefined = project.approxDeliveryDate;
            let workingDaysRemaining: number | undefined = project.workingDaysRemaining;
            if (newDate && leadWeeks > 0) {
              const base = new Date(newDate);
              base.setDate(base.getDate() + leadWeeks * 7);
              approxDeliveryDate = base.toISOString();
              const today = new Date();
              const diffMs = base.getTime() - today.getTime();
              const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
              const fullWeeks = Math.floor(diffDays / 7);
              const remainder = diffDays % 7;
              workingDaysRemaining = fullWeeks * 5 + Math.min(5, remainder);
            }
            updateProject(project.id, { dateReceived: dateValue, approxDeliveryDate, workingDaysRemaining });
          }}
        />
      );
    }

    if (field.includes('date') || field.includes('Date')) {
      return (
        <input
          type="date"
          disabled={isCustomerPortal}
          className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
          value={value ? new Date(value).toISOString().slice(0, 10) : ''}
          onChange={(e) => {
            const dateValue = e.target.value ? new Date(e.target.value).toISOString() : undefined;
            updateProject(project.id, { [field]: dateValue });
          }}
        />
      );
    }

    // Progress/percentage fields with production logging
    if (field.includes('Percent') && field !== 'overallProgress') {
      const processMap: Record<string, string> = {
        blanksCutPercent: 'blanksCut',
        edgebandPercent: 'edgeband',
        calibratePercent: 'calibrate',
        facingsPercent: 'facings',
        finalCncPercent: 'finalCnc',
        finishPercent: 'finish',
        sandPercent: 'sand',
        sprayPercent: 'spray',
        cutPercent: 'cut',
        cncPercent: 'cnc',
        buildPercent: 'build',
      };
      const processKey = processMap[field];
      
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (processKey) {
                setProductionModal({
                  show: true,
                  projectId: project.id,
                  projectName: project.jobName || `MJS ${project.mjsNumber}`,
                  process: processKey,
                  processLabel: COLUMN_LABELS[field] || field,
                  currentPercent: (value as number) || 0,
                });
              }
            }}
            className="relative group"
          >
            <div className="w-20 h-2 bg-slate-100 rounded overflow-hidden cursor-pointer group-hover:ring-2 group-hover:ring-blue-400 transition-all">
              <div
                className={`h-full bg-gradient-to-r ${getProgressColor(value as number)} group-hover:opacity-80 transition-all`}
                style={{ width: `${value || 0}%` }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-3 h-3 text-blue-600 drop-shadow-lg" />
            </div>
          </button>
          <span className="text-xs font-semibold text-slate-700 w-10">{value || 0}%</span>
        </div>
      );
    }

    if (field === 'overallProgress') {
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
            disabled={isCustomerPortal}
            value={value || 0}
            onChange={(e) => updateProject(project.id, { [field]: parseInt(e.target.value) || 0 })}
            className="w-14 bg-white/60 rounded px-1 py-0.5 text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        </div>
      );
    }

    // Net value field
    if (field === 'netValue') {
      return (
        <div className="flex items-center gap-1">
          <span className="text-slate-500">£</span>
          <input
            type="number"
            min={0}
            step={0.01}
            disabled={isCustomerPortal}
            value={value || ''}
            placeholder="0.00"
            onChange={(e) => updateProject(project.id, { netValue: parseFloat(e.target.value) || null })}
            className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
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
          disabled={isCustomerPortal}
          onChange={(e) => updateProject(project.id, { [field]: e.target.checked })}
          className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed"
        />
      );
    }

    // Calculated percentage dials for Progress tab
    if (field === 'bomPercent') {
      const percent = calculateBOMPercent(project);
      return (
        <div className="flex items-center justify-center">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="#e2e8f0" strokeWidth="6" fill="none" />
              <circle 
                cx="32" 
                cy="32" 
                r="28" 
                stroke={percent === 100 ? '#10b981' : percent >= 50 ? '#3b82f6' : '#f59e0b'} 
                strokeWidth="6" 
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - percent / 100)}`}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{percent}%</div>
          </div>
        </div>
      );
    }

    if (field === 'paperworkPercent') {
      const percent = calculatePaperworkPercent(project);
      return (
        <div className="flex items-center justify-center">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="#e2e8f0" strokeWidth="6" fill="none" />
              <circle 
                cx="32" 
                cy="32" 
                r="28" 
                stroke={percent === 100 ? '#10b981' : percent >= 50 ? '#3b82f6' : '#f59e0b'} 
                strokeWidth="6" 
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - percent / 100)}`}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{percent}%</div>
          </div>
        </div>
      );
    }

    if (field === 'productionPercent') {
      const percent = calculateProductionPercent(project);
      return (
        <div className="flex items-center justify-center">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="#e2e8f0" strokeWidth="6" fill="none" />
              <circle 
                cx="32" 
                cy="32" 
                r="28" 
                stroke={percent === 100 ? '#10b981' : percent >= 50 ? '#3b82f6' : '#f59e0b'} 
                strokeWidth="6" 
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - percent / 100)}`}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{percent}%</div>
          </div>
        </div>
      );
    }

    // Status dropdowns
    if (field === 'jobLocation') {
      const customColor = customColors[value as string];
      const colorClasses = customColor ? '' : (JOB_LOCATION_COLORS[value as string] ?? "bg-slate-100 text-slate-600");
      return (
        <select
          value={value || ''}
          disabled={isCustomerPortal}
          onChange={(e) => updateProject(project.id, { jobLocation: e.target.value })}
          className={`text-[11px] font-medium px-2 py-1 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed ${colorClasses}`}
          style={customColor ? { backgroundColor: customColor.bg, color: customColor.text } : undefined}
        >
          <option value="">--</option>
          {jobLocationOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (field === 'signOffStatus') {
      const customColor = customColors[value as string];
      const colorClasses = customColor ? '' : (SIGN_OFF_COLORS[value as string] ?? "bg-slate-100 text-slate-600");
      return (
        <select
          value={value || ''}
          disabled={isCustomerPortal}
          onChange={(e) => updateProject(project.id, { signOffStatus: e.target.value })}
          className={`text-[11px] font-medium px-2 py-1 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed ${colorClasses}`}
          style={customColor ? { backgroundColor: customColor.bg, color: customColor.text } : undefined}
        >
          <option value="">--</option>
          {signOffOptions.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
        </select>
      );
    }

    if (field === 'scheduledBy') {
      return (
        <select
          value={value || ''}
          onChange={(e) => updateProject(project.id, { scheduledBy: e.target.value })}
          className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 cursor-pointer"
        >
          <option value="">--</option>
          {scheduledByOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    // Material status fields
    if (field === 'ironmongeryStatus') {
      const customColor = customColors[value as string];
      const defaultColor = MATERIAL_STATUS_COLORS[value as string];
      const colorClasses = customColor ? '' : (defaultColor ? defaultColor : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50");
      return (
        <select
          value={value || ''}
          disabled={isCustomerPortal}
          onChange={(e) => {
            const newValue = e.target.value;
            const updates: any = { [field]: newValue };
            
            // Always update date ordered field when status changes to any value
            if (newValue) {
              updates.ironmongeryDateOrdered = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            }
            
            // Auto-populate date received when status changes to Received
            if (newValue === 'Received' || newValue === 'Received from TGS' || newValue === 'Received from Customer') {
              updates.ironmongeryDateReceived = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            }
            
            updateProject(project.id, updates);
          }}
          className={`text-[11px] font-medium px-3 py-1.5 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-300 ${colorClasses}`}
          style={customColor ? { backgroundColor: customColor.bg, color: customColor.text, borderColor: customColor.bg } : undefined}
        >
          <option value="">--</option>
          {ironmongeryStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (['blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'cassettesStatus', 'timbersStatus'].includes(field)) {
      const customColor = customColors[value as string];
      const defaultColor = MATERIAL_STATUS_COLORS[value as string];
      const colorClasses = customColor ? '' : (defaultColor ? defaultColor : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50");
      return (
        <select
          value={value || ''}
          disabled={isCustomerPortal}
          onChange={(e) => {
            const newValue = e.target.value;
            const updates: any = { [field]: newValue };
            
            // Always update date ordered field when status changes to any value
            if (newValue) {
              const dateOrderedField = field.replace('Status', 'DateOrdered');
              updates[dateOrderedField] = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            }
            
            // Auto-populate date received when status changes to Received
            if (newValue === 'Received') {
              const dateReceivedField = field.replace('Status', 'DateReceived');
              updates[dateReceivedField] = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            }
            
            updateProject(project.id, updates);
          }}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-300 ${colorClasses}`}
          style={customColor ? { backgroundColor: customColor.bg, color: customColor.text, borderColor: customColor.bg } : undefined}
        >
          <option value="">--</option>
          {materialStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    // Paperwork status fields
    if (['doorPaperworkStatus', 'finalCncSheetStatus', 'finalChecksSheetStatus', 'deliveryChecklistStatus', 'framesPaperworkStatus'].includes(field)) {
      const customColor = customColors[value as string];
      const defaultColor = PAPERWORK_STATUS_COLORS[value as string];
      const colorClasses = customColor ? '' : (defaultColor ? defaultColor : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50");
      return (
        <select
          value={value || ''}
          disabled={isCustomerPortal}
          onChange={(e) => updateProject(project.id, { [field]: e.target.value })}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed ${colorClasses}`}
          style={customColor ? { backgroundColor: customColor.bg, color: customColor.text, borderColor: customColor.bg } : undefined}
        >
          <option value="">--</option>
          {paperworkStatusOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    // Transport status
    if (field === 'transportStatus') {
      const customColor = customColors[value as string];
      const defaultColor = TRANSPORT_STATUS_COLORS[value as string];
      const colorClasses = customColor ? '' : (defaultColor ? defaultColor : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50");
      return (
        <select
          value={value || ''}
          disabled={isCustomerPortal}
          onChange={(e) => updateProject(project.id, { [field]: e.target.value })}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed ${colorClasses}`}
          style={customColor ? { backgroundColor: customColor.bg, color: customColor.text, borderColor: customColor.bg } : undefined}
        >
          <option value="">--</option>
          {transportOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    if (field === 'scheduledBy') {
      return (
        <select
          value={value || ''}
          onChange={(e) => updateProject(project.id, { scheduledBy: e.target.value })}
          className="text-sm px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 cursor-pointer"
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
          disabled={isCustomerPortal}
          value={value || ''}
          placeholder="—"
          onChange={(e) => {
            const newWeeks = parseInt(e.target.value) || 0;
            let approxDeliveryDate: string | undefined = project.approxDeliveryDate;
            let workingDaysRemaining: number | undefined = project.workingDaysRemaining;
            let calculatedCompletionDate: string | undefined = undefined;
            
            if (project.dateReceived && newWeeks > 0) {
              const base = new Date(project.dateReceived);
              base.setDate(base.getDate() + newWeeks * 7);
              approxDeliveryDate = base.toISOString();
              const today = new Date();
              const diffMs = base.getTime() - today.getTime();
              const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
              const fullWeeks = Math.floor(diffDays / 7);
              const remainder = diffDays % 7;
              workingDaysRemaining = fullWeeks * 5 + Math.min(5, remainder);
            } else if (newWeeks === 0) {
              approxDeliveryDate = undefined;
              workingDaysRemaining = undefined;
            }
            
            // Calculate completion date if we have both signOffDate and leadTimeWeeks
            if (project.signOffDate && newWeeks > 0) {
              const signOffDate = new Date(project.signOffDate);
              const weeksToAdd = newWeeks * 7;
              const completionDate = new Date(signOffDate);
              completionDate.setDate(completionDate.getDate() + weeksToAdd);
              calculatedCompletionDate = completionDate.toISOString();
            }
            
            updateProject(project.id, { leadTimeWeeks: newWeeks || undefined, approxDeliveryDate, workingDaysRemaining, calculatedCompletionDate });
          }}
          className="bg-white border border-slate-200 rounded px-2 py-1 w-20 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-300"
        />
      );
    }

    if (field === 'workingDaysRemaining') {
      return <span className="text-sm font-semibold">{value ?? '—'}</span>;
    }

    // Number fields for door sets and leaves
    if (field === 'doorSets' || field === 'leaves') {
      return (
        <input
          type="number"
          min={0}
          disabled={isCustomerPortal}
          value={value || ''}
          placeholder="—"
          onChange={(e) => updateProject(project.id, { [field]: parseInt(e.target.value) || null })}
          className="bg-transparent outline-none w-20 text-sm font-semibold border-b border-dashed border-slate-300 focus:border-blue-500 disabled:cursor-not-allowed"
        />
      );
    }

    // Textarea for comments/notes
    if (field === 'paperworkComments' || field === 'deliveryNotes' || field === 'bomNotes' || field === 'lajClientComments' || field === 'clientComments') {
      // clientComments is the only field editable by customers
      const isEditable = isCustomerPortal ? field === 'clientComments' : true;
      return (
        <textarea
          className="bg-transparent outline-none w-full text-sm font-semibold border border-slate-200 rounded px-2 py-1 focus:border-blue-500 resize-none disabled:cursor-not-allowed disabled:bg-slate-50"
          rows={2}
          disabled={!isEditable}
          value={value || ''}
          placeholder="—"
          title={value || ''}
          onChange={(e) => updateProject(project.id, { [field]: e.target.value })}
        />
      );
    }

    // QR Codes checkbox
    if (field === 'qrCodes') {
      return (
        <input
          type="checkbox"
          disabled={isCustomerPortal}
          checked={value === true}
          onChange={(e) => updateProject(project.id, { [field]: e.target.checked })}
          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
        />
      );
    }

    // New text fields for Client Portal
    if (['clientOrderNo', 'typeOfJob', 'laqNumber', 'factoryFitIronmongeryReleased'].includes(field)) {
      return (
        <input
          className="bg-transparent outline-none w-full text-sm font-semibold border-b border-dashed border-slate-300 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          value={value || ''}
          disabled={isCustomerPortal}
          placeholder="—"
          onChange={(e) => updateProject(project.id, { [field]: e.target.value })}
        />
      );
    }

    // Delivery Date field
    if (field === 'deliveryDate') {
      return (
        <input
          type="date"
          disabled={isCustomerPortal}
          className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
          value={value ? new Date(value).toISOString().slice(0, 10) : ''}
          onChange={(e) => {
            const dateValue = e.target.value ? new Date(e.target.value).toISOString() : undefined;
            updateProject(project.id, { [field]: dateValue });
          }}
        />
      );
    }

    // Read-only timestamp
    if (field === 'lastUpdatedAt') {
      return <span className="text-xs text-slate-500">{value ? new Date(value).toLocaleString() : '—'}</span>;
    }

    // Job name with text wrapping
    if (field === 'jobName') {
      return (
        <textarea
          className="bg-transparent outline-none w-full text-sm font-semibold resize-none min-h-[40px] disabled:cursor-not-allowed disabled:bg-slate-50"
          value={value || ''}
          disabled={isCustomerPortal}
          placeholder="—"
          rows={2}
          title={value || ''}
          onChange={(e) => updateProject(project.id, { [field]: e.target.value })}
        />
      );
    }

    // Text fields (default)
    return (
      <input
        className="bg-transparent outline-none w-full text-sm font-semibold disabled:cursor-not-allowed"
        value={value || ''}
        disabled={isCustomerPortal}
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
              {!isCustomerPortal && (
                <>
                  <Button 
                    onClick={() => router.push("/fire-door-schedule/new")}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Beautiful Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Current Projects */}
            <div onClick={() => setSelectedLocations(jobLocationOptions.filter(loc => loc !== 'CANCELLED' && loc !== 'COMPLETE & DELIVERED'))} className="group backdrop-blur-xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6 cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total Current Projects</p>
                  <h3 className="text-4xl font-bold text-slate-900">{stats.totalProjects}</h3>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Active fire door projects
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Red Folder */}
            <div onClick={() => setSelectedLocations(['RED FOLDER'])} className="group backdrop-blur-xl bg-gradient-to-br from-orange-500/10 via-red-500/10 to-orange-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6 cursor-pointer">
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
            <div onClick={() => setSelectedLocations(['IN PROGRESS'])} className="group backdrop-blur-xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6 cursor-pointer">
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

            {/* Complete in Factory */}
            <div onClick={() => setSelectedLocations(['COMPLETE IN FACTORY'])} className="group backdrop-blur-xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-green-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6 cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Complete in Factory</p>
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

            {/* Monthly Manufacturing Value */}
            {monthlyValue && (
              <div className="group backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-emerald-500/10 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">Monthly Value</p>
                    <h3 className="text-3xl font-bold text-slate-900">
                      £{parseFloat(monthlyValue.totalManufacturingValue).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <PoundSterling className="w-3 h-3" />
                      {monthlyValue.projectCount} projects, {monthlyValue.logCount} logs
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </div>
            )}
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
            <Button 
              variant="outline" 
              className="h-12 bg-white/50"
              onClick={() => setShowFiltersModal(!showFiltersModal)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button
              variant="outline"
              className="h-12 bg-white/50 border-green-300 text-green-700 hover:bg-green-50"
              onClick={async () => {
                if (!confirm("This will create/update WON opportunities for all fire door projects. Continue?")) return;
                try {
                  const result = await apiFetch<any>("/fire-door-schedule/sync-to-opportunities", { method: "POST" });
                  alert(`Sync complete!\nCreated: ${result.summary.created}\nUpdated: ${result.summary.updated}\nSkipped: ${result.summary.skipped}\n\nYou can now set dates in the Opportunities tab.`);
                  loadData(); // Reload to show any changes
                } catch (error: any) {
                  alert(`Sync failed: ${error.message || "Unknown error"}`);
                }
              }}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Sync to Opportunities
            </Button>
            <Button
              variant="outline"
              className="h-12 bg-white/50"
              onClick={() => setShowTable((v) => !v)}
            >
              {showTable ? "Card View" : "Table View"}
            </Button>
            {showTable && !isCustomerPortal && (
              <>
                <Button
                  variant="outline"
                  className="h-12 bg-white/50"
                  onClick={() => setShowColumnConfig(true)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Customize Columns
                </Button>
                <Button
                  variant="outline"
                  className="h-12 bg-white/50"
                  onClick={() => setShowColumnFreezeModal(!showColumnFreezeModal)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Freeze Columns
                </Button>
              </>
            )}
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
          {showColumnFreezeModal && (
            <div className="mt-4 p-4 rounded-xl border border-slate-300 bg-white shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">Freeze Columns</h3>
                <button
                  onClick={() => setShowColumnFreezeModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Select columns to freeze (stick to the left when scrolling). They will appear in the order you select them.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                {getVisibleColumns().map(field => {
                  const isChecked = frozenColumns.includes(field);
                  return (
                    <label key={field} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFrozenColumns([...frozenColumns, field]);
                          } else {
                            setFrozenColumns(frozenColumns.filter(f => f !== field));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-xs">{COLUMN_LABELS[field] || field}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFrozenColumns([])}
                >
                  Clear All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFrozenColumns(['mjsNumber', 'clientName', 'jobName'])}
                >
                  Reset to Default
                </Button>
              </div>
            </div>
          )}
          {showFiltersModal && (
            <div className="mt-4 p-4 rounded-xl border border-slate-300 bg-white shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">Location Filters</h3>
                <button
                  onClick={() => setShowFiltersModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Job Location</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-md bg-slate-50">
                    {jobLocationOptions.map(opt => {
                      const isChecked = selectedLocations.includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLocations([...selectedLocations, opt]);
                              } else {
                                setSelectedLocations(selectedLocations.filter(l => l !== opt));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedLocations(jobLocationOptions);
                    }}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedLocations([]);
                    }}
                  >
                    Clear All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const defaultLocations = jobLocationOptions;
                      setSelectedLocations(defaultLocations);
                      setSearchTerm("");
                    }}
                  >
                    Reset to Default
                  </Button>
                </div>
              </div>
            </div>
          )}
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
                {(() => {
                  let currentOptions: string[] = [];
                  let currentSetter: (opts: string[]) => void = () => {};
                  // Show color picker for ALL dropdown fields
                  const showColorPicker = true;
                  
                  if (editingConfigField === 'jobLocation') { currentOptions = jobLocationOptions; currentSetter = setJobLocationOptions; }
                  else if (editingConfigField === 'signOffStatus') { currentOptions = signOffOptions; currentSetter = setSignOffOptions; }
                  else if (editingConfigField === 'scheduledBy') { currentOptions = scheduledByOptions; currentSetter = setScheduledByOptions; }
                  else if (editingConfigField === 'ironmongeryStatus') { currentOptions = ironmongeryStatusOptions; currentSetter = setIronmongeryStatusOptions; }
                  else if (['blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'cassettesStatus', 'timbersStatus'].includes(editingConfigField || '')) { currentOptions = materialStatusOptions; currentSetter = setMaterialStatusOptions; }
                  else if (['doorPaperworkStatus', 'finalCncSheetStatus', 'finalChecksSheetStatus', 'deliveryChecklistStatus', 'framesPaperworkStatus'].includes(editingConfigField || '')) { currentOptions = paperworkStatusOptions; currentSetter = setPaperworkStatusOptions; }
                  else if (editingConfigField === 'transportStatus') { currentOptions = transportOptions; currentSetter = setTransportOptions; }
                  
                  return currentOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <input
                        className="flex-1 px-2 py-1 border rounded bg-white"
                        value={opt}
                        onChange={(e) => {
                          const oldValue = opt;
                          const newValue = e.target.value;
                          const next = [...currentOptions];
                          next[idx] = newValue;
                          currentSetter(next);
                          
                          // If this option had a custom color, rename the key
                          if (showColorPicker && customColors[oldValue]) {
                            const updatedColors = { ...customColors };
                            updatedColors[newValue] = updatedColors[oldValue];
                            delete updatedColors[oldValue];
                            setCustomColors(updatedColors);
                          }
                        }}
                      />
                      {showColorPicker && (
                        <input
                          type="color"
                          className="w-8 h-7 border rounded cursor-pointer"
                          value={customColors[opt]?.bg || getDefaultColorForOption(editingConfigField || '', opt)}
                          onChange={(e) => {
                            const hex = e.target.value;
                            const brightness = getBrightness(hex);
                            const textColor = brightness > 128 ? '#1f2937' : '#ffffff';
                            
                            setCustomColors({
                              ...customColors,
                              [opt]: { bg: hex, text: textColor }
                            });
                          }}
                        />
                      )}
                      <button
                        className="text-red-500 text-xs"
                        onClick={() => {
                          const next = currentOptions.filter((_, i) => i !== idx);
                          currentSetter(next);
                          
                          // Remove custom color for this option
                          if (showColorPicker && customColors[opt]) {
                            const updatedColors = { ...customColors };
                            delete updatedColors[opt];
                            setCustomColors(updatedColors);
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ));
                })()}
              </div>
              <button
                className="mt-2 text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                onClick={() => {
                  if (editingConfigField === 'jobLocation') setJobLocationOptions([...jobLocationOptions, 'NEW OPTION']);
                  else if (editingConfigField === 'signOffStatus') setSignOffOptions([...signOffOptions, 'NEW OPTION']);
                  else if (editingConfigField === 'scheduledBy') setScheduledByOptions([...scheduledByOptions, 'NEW OPTION']);
                  else if (editingConfigField === 'ironmongeryStatus') setIronmongeryStatusOptions([...ironmongeryStatusOptions, 'NEW OPTION']);
                  else if (['blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'cassettesStatus', 'timbersStatus'].includes(editingConfigField || '')) setMaterialStatusOptions([...materialStatusOptions, 'NEW OPTION']);
                  else if (['doorPaperworkStatus', 'finalCncSheetStatus', 'finalChecksSheetStatus', 'deliveryChecklistStatus', 'framesPaperworkStatus'].includes(editingConfigField || '')) setPaperworkStatusOptions([...paperworkStatusOptions, 'NEW OPTION']);
                  else if (editingConfigField === 'transportStatus') setTransportOptions([...transportOptions, 'NEW OPTION']);
                }}
              >
                + Add option
              </button>
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-4 items-center">
            <span>Location Filter: <strong>{selectedLocations.length === 0 ? 'None' : selectedLocations.length === jobLocationOptions.length ? 'All' : selectedLocations.join(', ')}</strong></span>
            <span>Active Tab: <strong>{TAB_DEFINITIONS[activeTab as keyof typeof TAB_DEFINITIONS]?.label || activeTab}</strong></span>
            {Object.keys(columnFilters).length > 0 && (
              <>
                <span>Column Filters: <strong className="text-blue-600">{Object.keys(columnFilters).length} active</strong></span>
                <button
                  onClick={() => setColumnFilters({})}
                  className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  Clear All Column Filters
                </button>
              </>
            )}
            {frozenColumns.length > 0 && (
              <span>Frozen Columns: <strong className="text-purple-600">{frozenColumns.length}</strong></span>
            )}
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
              <div
                className="relative z-0 overflow-y-auto max-h-[calc(100vh-260px)]"
                ref={(el) => {
                  // attach to ref to sync with bottom scroller
                  // store on window for simple linkage without adding more state
                  if (el) {
                    // @ts-ignore
                    window.__fdsTableScrollEl = el;
                  }
                }}
              >
              <table className="min-w-full text-sm border-separate">
                <thead>
                  <tr ref={headerRowRef} className="bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 text-xs uppercase tracking-wider select-none">
                    {/* Sticky header cells at top of scroll container */}
                    {!isCustomerPortal && (
                      <th className="sticky top-0 left-0 px-4 py-3 text-left z-[200] bg-white bg-clip-padding border-r border-slate-200 w-[140px] min-w-[140px] max-w-[140px]">
                        <span className="text-xs uppercase tracking-wider">Actions</span>
                      </th>
                    )}
                    {getVisibleColumns().map((field, index) => {
                      const isFrozen = frozenColumns.includes(field);
                      const frozenIndex = frozenColumns.indexOf(field);
                      const fieldWidth = getColumnWidth(field);
                      const leftOffset = frozenIndex >= 0 ? (isCustomerPortal ? 0 : ACTIONS_WIDTH) + (frozenColumns.slice(0, frozenIndex).reduce((sum, col) => sum + getColumnWidth(col), 0)) : undefined;
                      const isLastFrozen = isFrozen && frozenIndex === frozenColumns.length - 1;
                      return (
                      <th
                        key={field}
                        className={`px-4 py-3 text-left group sticky top-0 ${isFrozen ? `z-[210] bg-white bg-clip-padding` : 'z-[190] bg-white'} ${isLastFrozen ? 'border-r border-slate-200' : ''}`}
                        style={isFrozen && leftOffset !== undefined ? { left: `${leftOffset}px`, width: `${fieldWidth}px`, minWidth: `${fieldWidth}px`, maxWidth: `${fieldWidth}px` } : { width: `${fieldWidth}px`, minWidth: `${fieldWidth}px`, maxWidth: `${fieldWidth}px` }}
                        ref={(el) => { headerRefs.current[field] = el }}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className={`inline-flex items-center gap-1 text-left whitespace-normal text-xs leading-snug ${
                              (field === 'jobLocation' || field === 'signOffStatus') 
                                ? 'px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 font-semibold shadow-sm transition-colors' 
                                : ['scheduledBy', 'blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'cassettesStatus', 'timbersStatus', 'ironmongeryStatus', 'doorPaperworkStatus', 'finalCncSheetStatus', 'finalChecksSheetStatus', 'deliveryChecklistStatus', 'framesPaperworkStatus', 'transportStatus'].includes(field)
                                ? 'hover:text-blue-600'
                                : 'hover:text-blue-600'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const configFields = ['jobLocation', 'signOffStatus', 'scheduledBy', 'blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'cassettesStatus', 'timbersStatus', 'ironmongeryStatus', 'doorPaperworkStatus', 'finalCncSheetStatus', 'finalChecksSheetStatus', 'deliveryChecklistStatus', 'framesPaperworkStatus', 'transportStatus'];
                              if (configFields.includes(field)) {
                                setEditingConfigField(field);
                              } else {
                                toggleSort(field);
                              }
                            }}
                          >
                            {COLUMN_LABELS[field] || field}
                            {['jobLocation', 'signOffStatus'].includes(field) && <Filter className="w-3 h-3 ml-1" />}
                            {['scheduledBy', 'blanksStatus', 'lippingsStatus', 'facingsStatus', 'glassStatus', 'cassettesStatus', 'timbersStatus', 'ironmongeryStatus', 'doorPaperworkStatus', 'finalCncSheetStatus', 'finalChecksSheetStatus', 'deliveryChecklistStatus', 'framesPaperworkStatus', 'transportStatus'].includes(field) && <Filter className="w-3 h-3 ml-1 opacity-40" />}
                            {sortField === field ? (
                              sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60" />
                            )}
                          </button>
                        </div>
                      </th>
                    )})}
                  </tr>
                  {/* Filter Row */}
                  <tr className="bg-white border-b border-slate-200">
                    {/* Filter row sticks directly under header using combined offset */}
                    <th
                      className="sticky left-0 px-4 py-2 z-[200] bg-white bg-clip-padding border-r border-slate-200 w-[140px] min-w-[140px] max-w-[140px]"
                      style={{ top: `${headerHeight}px` }}
                    >
                      <button
                        onClick={() => setColumnFilters({})}
                        className="text-xs text-blue-600 hover:text-blue-800 font-normal"
                        title="Clear all filters"
                      >
                        Clear
                      </button>
                    </th>
                    {getVisibleColumns().map((field) => {
                      const isFrozen = frozenColumns.includes(field);
                      const frozenIndex = frozenColumns.indexOf(field);
                      const fieldWidth = getColumnWidth(field);
                      const leftOffset = frozenIndex >= 0 ? (isCustomerPortal ? 0 : ACTIONS_WIDTH) + (frozenColumns.slice(0, frozenIndex).reduce((sum, col) => sum + getColumnWidth(col), 0)) : undefined;
                      const isLastFrozen = isFrozen && frozenIndex === frozenColumns.length - 1;
                      return (
                        <th
                          key={field}
                          className={`px-4 py-2 sticky ${isFrozen ? `z-[200] bg-white bg-clip-padding shadow-[inset_-1px_0_0_rgba(15,23,42,0.06)]` : 'z-[90] bg-white'} ${isLastFrozen ? 'border-r border-slate-200' : ''}`}
                            style={isFrozen && leftOffset !== undefined ? { left: `${leftOffset}px`, top: `${headerHeight}px`, width: `${fieldWidth}px`, minWidth: `${fieldWidth}px`, maxWidth: `${fieldWidth}px` } : { top: `${headerHeight}px`, width: `${fieldWidth}px`, minWidth: `${fieldWidth}px`, maxWidth: `${fieldWidth}px` }}
                        >
                          <Input
                            placeholder="Filter..."
                            value={columnFilters[field] || ''}
                            onChange={(e) => {
                              const newFilters = { ...columnFilters };
                              if (e.target.value) {
                                newFilters[field] = e.target.value;
                              } else {
                                delete newFilters[field];
                              }
                              setColumnFilters(newFilters);
                            }}
                            className="h-7 text-xs bg-white border-slate-200"
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      className="group hover:bg-blue-50/40 transition-colors border-b border-slate-100"
                    >
                      {!isCustomerPortal && (
                        <td className="sticky left-0 px-4 py-3 z-[50] bg-white bg-clip-padding border-r border-slate-200 shadow-[inset_-1px_0_0_rgba(15,23,42,0.06)] w-[140px] min-w-[140px] max-w-[140px]">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/fire-door-schedule/${project.id}`);
                            }}
                            className="text-xs bg-white/80 border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-500"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            View Order
                          </Button>
                        </td>
                      )}
                      {getVisibleColumns().map((field) => {
                        const isFrozen = frozenColumns.includes(field);
                        const frozenIndex = frozenColumns.indexOf(field);
                        const fieldWidth = getColumnWidth(field);
                        const leftOffset = frozenIndex >= 0 ? (isCustomerPortal ? 0 : ACTIONS_WIDTH) + (frozenColumns.slice(0, frozenIndex).reduce((sum, col) => sum + getColumnWidth(col), 0)) : undefined;
                        const isLastFrozen = isFrozen && frozenIndex === frozenColumns.length - 1;
                        return (
                        <td
                          key={field}
                          className={`px-4 py-3 text-slate-700 font-semibold ${isFrozen ? `sticky z-[50] bg-white bg-clip-padding shadow-[inset_-1px_0_0_rgba(15,23,42,0.06)]` : 'z-0 group-hover:bg-blue-50/40'} ${isLastFrozen ? 'border-r border-slate-200' : ''}`}
                          style={isFrozen && leftOffset !== undefined ? { left: `${leftOffset}px`, width: `${fieldWidth}px`, minWidth: `${fieldWidth}px`, maxWidth: `${fieldWidth}px` } : { width: `${fieldWidth}px`, minWidth: `${fieldWidth}px`, maxWidth: `${fieldWidth}px` }}
                        >
                          <div className="relative z-40">
                            {renderCell(project, field)}
                          </div>
                        </td>
                      )})}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            {/* Persistent bottom scroll bar - removed, using single horizontal scroll on outer div */}
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
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-semibold text-slate-500 mr-0.5">BOM:</span>
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBOMStatusColor(project.blanksStatus) }} title={`Blanks: ${project.blanksStatus || 'Not set'}`} />
                          <span className="text-[8px] font-medium text-slate-400 mt-0.5">B</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBOMStatusColor(project.lippingsStatus) }} title={`Lippings: ${project.lippingsStatus || 'Not set'}`} />
                          <span className="text-[8px] font-medium text-slate-400 mt-0.5">L</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBOMStatusColor(project.facingsStatus) }} title={`Facings: ${project.facingsStatus || 'Not set'}`} />
                          <span className="text-[8px] font-medium text-slate-400 mt-0.5">F</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBOMStatusColor(project.glassStatus) }} title={`Glass: ${project.glassStatus || 'Not set'}`} />
                          <span className="text-[8px] font-medium text-slate-400 mt-0.5">G</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBOMStatusColor(project.cassettesStatus) }} title={`Cassettes: ${project.cassettesStatus || 'Not set'}`} />
                          <span className="text-[8px] font-medium text-slate-400 mt-0.5">C</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBOMStatusColor(project.timbersStatus) }} title={`Timbers: ${project.timbersStatus || 'Not set'}`} />
                          <span className="text-[8px] font-medium text-slate-400 mt-0.5">T</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBOMStatusColor(project.ironmongeryStatus) }} title={`Ironmongery: ${project.ironmongeryStatus || 'Not set'}`} />
                          <span className="text-[8px] font-medium text-slate-400 mt-0.5">I</span>
                        </div>
                      </div>
                    </div>
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

      {/* Production Log Modal */}
      {productionModal && (
        <ProductionLogModal
          projectId={productionModal.projectId}
          projectName={productionModal.projectName}
          process={productionModal.process}
          processLabel={productionModal.processLabel}
          currentPercent={productionModal.currentPercent}
          onClose={() => setProductionModal(null)}
          onSuccess={() => {
            loadData();
            setProductionModal(null);
          }}
        />
      )}

      {/* Column Config Modal */}
      <ColumnConfigModal
        open={showColumnConfig}
        onClose={() => setShowColumnConfig(false)}
        availableFields={allAvailableFields}
        currentConfig={getCurrentColumnConfig()}
        onSave={handleSaveColumnConfig}
        tabName={TAB_DEFINITIONS[activeTab as keyof typeof TAB_DEFINITIONS]?.label}
      />
    </div>
  );
}
