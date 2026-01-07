"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Trash2, Sparkles, FileCheck, Upload, Info, Table, RotateCw, QrCode } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getApiBase } from "@/lib/api-base";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useCurrentUser } from "@/lib/use-current-user";
import FireDoorSpreadsheet from "@/components/FireDoorSpreadsheet";
import { ColoredSelect } from "@/components/ColoredSelect";
import { FireDoorBOM } from "@/components/FireDoorBOM";

const ironmongeryStatusOptions = [
  "Not in BOM",
  "In BOM TBC",
  "Ordered Call Off",
  "In BOM",
  "Stock",
  "Ordered",
  "N/A",
  "Received",
  "Received from TGS",
  "Received from Customer"
];

// Helper function to get inline styles from custom colors
function getCustomColorStyle(status: string | undefined, customColors: Record<string, {bg: string, text: string}>) {
  if (!status || !customColors[status]) return {};
  return {
    backgroundColor: customColors[status].bg,
    color: customColors[status].text,
  };
}

// Fallback Tailwind classes when custom colors not available
const MATERIAL_STATUS_COLORS: Record<string, string> = {
  "Not in BOM": "bg-slate-100 text-slate-600",
  "In BOM TBC": "bg-orange-100 text-orange-700",
  "Ordered Call Off": "bg-cyan-100 text-cyan-700",
  "In BOM": "bg-blue-100 text-blue-700",
  "Stock": "bg-emerald-100 text-emerald-700",
  "Ordered": "bg-purple-100 text-purple-700",
  "N/A": "bg-slate-100 text-slate-600",
  "Received": "bg-green-100 text-green-700",
  "Received from TGS": "bg-green-100 text-green-700",
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

interface FireDoorProject {
  id: string;
  mjsNumber?: string;
  jobName?: string;
  clientName?: string;
  poNumber?: string;
  laqNumber?: string;
  dateReceived?: Date | null;
  dateRequired?: Date | null;
  jobLocation?: string;
  signOffStatus?: string;
  signOffDate?: Date | null;
  scheduledBy?: string;
  leadTimeWeeks?: number | null;
  approxDeliveryDate?: Date | null;
  workingDaysRemaining?: number | null;
  paperworkComments?: string;
  doorPaperworkStatus?: string;
  finalCncSheetStatus?: string;
  finalChecksSheetStatus?: string;
  deliveryChecklistStatus?: string;
  framesPaperworkStatus?: string;
  deliveryNotes?: string;
  transportStatus?: string;
  doorSets?: number | null;
  leaves?: number | null;
  deliveryDate?: Date | null;
  installStart?: Date | null;
  installEnd?: Date | null;
  snaggingStatus?: string;
  snaggingComplete?: boolean;
  blanksCutPercent?: number | null;
  edgebandPercent?: number | null;
  calibratePercent?: number | null;
  facingsPercent?: number | null;
  finalCncPercent?: number | null;
  finishPercent?: number | null;
  sandPercent?: number | null;
  sprayPercent?: number | null;
  cutPercent?: number | null;
  cncPercent?: number | null;
  buildPercent?: number | null;
  overallProgress?: number;
  netValue?: number | null;
  // BOM & Materials fields
  blanksStatus?: string;
  blanksDateOrdered?: Date | null;
  blanksDateExpected?: Date | null;
  blanksDateReceived?: Date | null;
  lippingsStatus?: string;
  lippingsDateOrdered?: Date | null;
  lippingsDateExpected?: Date | null;
  lippingsDateReceived?: Date | null;
  facingsStatus?: string;
  facingsDateOrdered?: Date | null;
  facingsDateExpected?: Date | null;
  facingsDateReceived?: Date | null;
  glassStatus?: string;
  glassDateOrdered?: Date | null;
  glassDateExpected?: Date | null;
  glassDateReceived?: Date | null;
  cassettesStatus?: string;
  cassettesDateOrdered?: Date | null;
  cassettesDateExpected?: Date | null;
  cassettesDateReceived?: Date | null;
  timbersStatus?: string;
  timbersDateOrdered?: Date | null;
  timbersDateExpected?: Date | null;
  timbersDateReceived?: Date | null;
  ironmongeryStatus?: string;
  ironmongeryDateOrdered?: Date | null;
  ironmongeryDateExpected?: Date | null;
  ironmongeryDateReceived?: Date | null;
}

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const percentage = Math.min(100, Math.max(0, value || 0));
  const getColor = (val: number) => {
    if (val === 0) return "bg-gray-200";
    if (val < 30) return "bg-gradient-to-r from-red-400 to-red-500";
    if (val < 60) return "bg-gradient-to-r from-orange-400 to-orange-500";
    if (val < 90) return "bg-gradient-to-r from-blue-400 to-blue-500";
    return "bg-gradient-to-r from-green-400 to-green-500";
  };
  return (
    <div className={`relative h-8 bg-gray-100 rounded-lg overflow-hidden ${className}`}>
      <div className={`h-full ${getColor(percentage)} transition-all duration-500 flex items-center justify-end pr-2`} style={{ width: `${percentage}%` }}>
        {percentage > 0 && <span className="text-xs font-semibold text-white drop-shadow">{percentage}%</span>}
      </div>
      {percentage === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-gray-400">0%</span>
        </div>
      )}
    </div>
  );
}

function EditableCell({
  value,
  onChange,
  type = "text",
  placeholder = "",
  className = "",
  min,
  max,
}: {
  value: any;
  onChange: (val: any) => void;
  type?: "text" | "number" | "date" | "textarea";
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const save = () => onChange(draft);
  if (type === "textarea") {
    return (
      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save} placeholder={placeholder} className={`min-h-[60px] ${className}`} rows={2} />
    );
  }
  if (type === "date") {
    return (
      <Input type="date" value={value ? new Date(value).toISOString().split("T")[0] : ""} onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)} className={className} />
    );
  }
  return (
    <Input
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setDraft(value ?? "");
      }}
      placeholder={placeholder}
      className={`h-9 ${className}`}
      min={min}
      max={max}
    />
  );
}

export default function FireDoorScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const isNew = id === "new";
  const { toast } = useToast();
  const { user } = useCurrentUser();

  const [project, setProject] = useState<FireDoorProject | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [imports, setImports] = useState<Array<{ id: string; sourceName: string; totalValue: number; currency: string; rowCount: number; createdAt: string }>>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [netValueInput, setNetValueInput] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [customColors, setCustomColors] = useState<Record<string, {bg: string, text: string}>>({});
  const [lineItemLayout, setLineItemLayout] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [loadingLineItems, setLoadingLineItems] = useState(false);
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(null);

  // Fetch custom colors from API
  useEffect(() => {
    const fetchColors = async () => {
      try {
        const res = await fetch("/api/fire-door-schedule/colors");
        if (res.ok) {
          const data = await res.json();
          if (data.colors && Object.keys(data.colors).length > 0) {
            setCustomColors(data.colors);
          }
        }
      } catch (error) {
        console.error("Error fetching colors:", error);
      }
    };
    
    if (user?.tenantId) {
      fetchColors();
    }
  }, [user?.tenantId]);

  useEffect(() => {
    if (!isNew && id) {
      loadProject();
      loadLineItemLayout();
      loadLineItems();
    } else if (isNew) {
      setProject({ id: "new", jobLocation: "RED FOLDER", signOffStatus: "AWAITING SCHEDULE", overallProgress: 0 } as FireDoorProject);
    }
  }, [id, isNew]);

  // Auto-refresh every 3 minutes to sync with schedule updates
  useEffect(() => {
    if (isNew) return;
    const interval = setInterval(() => {
      loadProject();
    }, 180000);
    return () => clearInterval(interval);
  }, [isNew, id]);

  async function loadProject() {
    try {
      const data = await apiFetch<FireDoorProject>(`/fire-door-schedule/${id}`);
      setProject(data);
      setNetValueInput(data?.netValue != null ? String(Number(data.netValue).toFixed(2)) : "");
    } catch (error) {
      console.error("Error loading project:", error);
      toast({ title: "Error", description: "Failed to load project", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function refreshProject() {
    setRefreshing(true);
    try {
      await loadProject();
      await loadLineItems();
      toast({ title: "Refreshed", description: "Project data updated" });
    } catch (error) {
      console.error("Error refreshing project:", error);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadLineItemLayout() {
    try {
      const data = await apiFetch<{ layout: any }>("/fire-door-line-item-layout");
      setLineItemLayout(data.layout);
    } catch (error) {
      console.error("Error loading line item layout:", error);
    }
  }

  async function loadLineItems() {
    if (!id || isNew) return;
    setLoadingLineItems(true);
    try {
      const data = await apiFetch<any[]>(`/fire-door-schedule/${id}/line-items`);
      setLineItems(data || []);
    } catch (error) {
      console.error("Error loading line items:", error);
      setLineItems([]);
    } finally {
      setLoadingLineItems(false);
    }
  }

  async function loadImportsForProject() {
    try {
      const data = await apiFetch<{ imports: any[] }>(`/fire-doors/imports/by-project/${id}`);
      const list = (data?.imports || []).map((imp) => ({ ...imp, totalValue: Number(imp.totalValue || 0) }));
      setImports(list);
      if (list.length > 0) setSelectedImportId(list[0].id);
    } catch (error) {
      console.error("Error loading imports for project:", error);
    }
  }

  useEffect(() => {
    if (!isNew && id) loadImportsForProject();
  }, [id, isNew]);

  async function saveProject() {
    if (!project) return;
    await saveProjectDirect(project);
  }

  async function saveProjectDirect(projectToSave: FireDoorProject) {
    if (!projectToSave) return;
    setSaving(true);
    try {
      if (isNew) {
        const { id: _, ...createData } = projectToSave as any;
        const created = await apiFetch<FireDoorProject>("/fire-door-schedule", { method: "POST", json: createData });
        toast({ title: "Success", description: "Project created successfully" });
        router.push(`/fire-door-schedule/${created.id}`);
      } else {
        // Convert Date objects to ISO strings and clean up data before sending
        const cleanData: any = { ...projectToSave };
        
        console.log('[saveProject] Sending data with paperwork fields:', {
          doorPaperworkStatus: cleanData.doorPaperworkStatus,
          finalCncSheetStatus: cleanData.finalCncSheetStatus,
          finalChecksSheetStatus: cleanData.finalChecksSheetStatus,
          deliveryChecklistStatus: cleanData.deliveryChecklistStatus,
          framesPaperworkStatus: cleanData.framesPaperworkStatus,
          ironmongeryStatus: cleanData.ironmongeryStatus,
        });
        
        // Convert Date objects to ISO strings or null
        const dateFields = [
          'dateReceived', 'dateRequired', 'signOffDate', 'approxDeliveryDate',
          'deliveryDate', 'installStart', 'installEnd',
          'blanksDateOrdered', 'blanksDateExpected', 'blanksDateReceived',
          'lippingsDateOrdered', 'lippingsDateExpected', 'lippingsDateReceived',
          'facingsDateOrdered', 'facingsDateExpected', 'facingsDateReceived',
          'glassDateOrdered', 'glassDateExpected', 'glassDateReceived',
          'cassettesDateOrdered', 'cassettesDateExpected', 'cassettesDateReceived',
          'timbersDateOrdered', 'timbersDateExpected', 'timbersDateReceived',
          'ironmongeryDateOrdered', 'ironmongeryDateExpected', 'ironmongeryDateReceived'
        ];
        
        for (const field of dateFields) {
          if (cleanData[field] !== undefined) {
            if (cleanData[field] instanceof Date) {
              cleanData[field] = cleanData[field].toISOString();
            } else if (cleanData[field] === '' || cleanData[field] === null) {
              cleanData[field] = null;
            }
          }
        }
        
        const response = await apiFetch<FireDoorProject>(`/fire-door-schedule/${id}`, { method: "PATCH", json: cleanData });
        setProject(response);
        toast({ title: "Saved", description: "Changes saved automatically" });
      }
    } catch (error) {
      console.error("Error saving project:", error);
      toast({ title: "Error", description: "Failed to save project", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function saveNetValueOverride() {
    if (!project) return;
    try {
      const value = netValueInput ? Number(netValueInput) : null;
      const updated = await apiFetch(`/fire-door-schedule/${id}`, { method: "PATCH", json: { netValue: value } });
      setProject(updated as any);
      toast({ title: "Saved", description: "Net value updated" });
    } catch (error) {
      console.error("Error updating net value:", error);
      toast({ title: "Error", description: "Failed to update net value", variant: "destructive" });
    }
  }

  async function deleteProject() {
    if (isNew || !id) return;
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await apiFetch(`/fire-door-schedule/${id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Project deleted successfully" });
      router.push("/fire-door-schedule");
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  }

  function updateField(field: string, value: any) {
    console.log(`[updateField] Updating ${field} to:`, value);
    const updatedProject = (() => {
      const prev = project;
      if (!prev) return null;
      const updated: any = { ...prev, [field]: value };
      const progressFields = [
        "blanksCutPercent",
        "edgebandPercent",
        "calibratePercent",
        "facingsPercent",
        "finalCncPercent",
        "finishPercent",
        "sandPercent",
        "sprayPercent",
        "cutPercent",
        "cncPercent",
        "buildPercent",
      ];
      const total = progressFields.reduce((sum, f) => sum + (Number(updated[f]) || 0), 0);
      updated.overallProgress = Math.round(total / progressFields.length);
      return updated;
    })();
    
    setProject(updatedProject);
    
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    setAutoSaveTimeout(setTimeout(() => { 
      console.log('[autosave] Triggering save after 800ms with project:', updatedProject);
      if (!isNew && updatedProject) saveProjectDirect(updatedProject); 
    }, 800));
  }

  async function handleCSVImport(file: File) {
    if (isNew || !id) {
      toast({ title: "Error", description: "Please save the project first before importing line items", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", id);
      
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/fire-doors/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }

      const result = await response.json();
      toast({ title: "Success", description: `Imported ${result.rowCount} line items successfully` });
      
      // Reload imports list
      await loadImportsForProject();
    } catch (error: any) {
      console.error("Error importing CSV:", error);
      toast({ title: "Error", description: error.message || "Failed to import CSV", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <p className="text-slate-600">Project not found</p>
      </div>
    );
  }

  const overallProgress = project.overallProgress || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-white/20 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push("/fire-door-schedule")} className="hover:bg-white/50 px-3">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {isNew ? "New Fire Door Project" : project.jobName || "Fire Door Project"}
                </h1>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-sm text-slate-600">MJS# {project.mjsNumber || "N/A"}</p>
                  {!isNew && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full">
                      <Sparkles className="w-3 h-3 text-white" />
                      <span className="text-xs font-semibold text-white">{overallProgress}% Complete</span>
                    </div>
                  )}
                  {saving && <span className="text-xs text-blue-600 animate-pulse">Saving...</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!isNew && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCSVImport(file);
                    }}
                  />
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/fire-doors?projectId=${id}`)}
                    className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  >
                    <Table className="w-4 h-4 mr-2" />
                    View Order Grid
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/fire-door-schedule/${id}/qr-print`)}
                    className="border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Print QR Labels
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="border-green-200 text-green-600 hover:bg-green-50"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Importing..." : "Import Line Items"}
                  </Button>
                  <Button variant="outline" onClick={deleteProject} className="border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
              <Button onClick={refreshProject} disabled={refreshing} variant="outline" className="hover:bg-blue-50">
                <RotateCw className="w-4 h-4 mr-2" />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Button onClick={saveProject} disabled={saving} className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Now"}
              </Button>
            </div>
          </div>
          {!isNew && (
            <div className="mt-4">
              <ProgressBar value={overallProgress} className="h-3" />
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {!isNew ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`grid w-full bg-white/60 backdrop-blur-sm ${lineItemLayout?.processes ? `grid-cols-${2 + lineItemLayout.processes.length}` : 'grid-cols-3'}`}>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Project Overview
              </TabsTrigger>
              <TabsTrigger value="bom" className="flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                BOM & Materials
              </TabsTrigger>
              {lineItemLayout?.processes && lineItemLayout.processes.map((process: any) => (
                <TabsTrigger key={process.code} value={`process-${process.code}`} className="flex items-center gap-2">
                  <Table className="w-4 h-4" />
                  {process.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Order Imports</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Select Import</label>
                    <select className="h-9 w-full border border-slate-300 rounded-md bg-white px-3" value={selectedImportId || ""} onChange={(e) => setSelectedImportId(e.target.value)}>
                      {imports.map((imp) => (
                        <option key={imp.id} value={imp.id}>
                          {imp.sourceName} • {new Date(imp.createdAt).toLocaleDateString("en-GB")} • {imp.rowCount} items
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Calculated Import Total</label>
                    <Input readOnly value={(imports.find((i) => i.id === selectedImportId)?.totalValue || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Net Value (Override)</label>
                      <Input value={netValueInput} onChange={(e) => setNetValueInput(e.target.value)} placeholder="e.g. 15000.00" />
                    </div>
                    <Button onClick={saveNetValueOverride}>Save</Button>
                  </div>
                </div>
              </div>

        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Project Overview</h2>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">MJS Number</label>
              <EditableCell value={project.mjsNumber} onChange={(v) => updateField("mjsNumber", v)} placeholder="e.g. 1234" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Job Name</label>
              <EditableCell value={project.jobName} onChange={(v) => updateField("jobName", v)} placeholder="Project name" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Client Name</label>
              <EditableCell value={project.clientName} onChange={(v) => updateField("clientName", v)} placeholder="Company name" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">PO Number</label>
              <EditableCell value={project.poNumber} onChange={(v) => updateField("poNumber", v)} placeholder="Purchase order" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">LAQ Number</label>
              <EditableCell value={project.laqNumber} onChange={(v) => updateField("laqNumber", v)} placeholder="LAQ reference" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date Received</label>
              <EditableCell type="date" value={project.dateReceived} onChange={(v) => updateField("dateReceived", v)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date Required</label>
              <EditableCell type="date" value={project.dateRequired} onChange={(v) => updateField("dateRequired", v)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Job Location</label>
              <ColoredSelect
                value={project.jobLocation || ""}
                onValueChange={(v) => updateField("jobLocation", v)}
                options={[
                  { value: "RED FOLDER", label: "🔴 Red Folder", className: "" },
                  { value: "IN PROGRESS", label: "⚙️ In Progress", className: "" },
                  { value: "COMPLETE", label: "✅ Complete", className: "" },
                ]}
                customColors={customColors}
              />
            </div>
          </div>
        </div>

        {!isNew && (
          <>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Production Progress</h2>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Blanks Cut</label>
                  {project.blanksCutPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.blanksCutPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.blanksCutPercent === null ? "" : (project.blanksCutPercent || 0)} onChange={(e) => updateField("blanksCutPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.blanksCutPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("blanksCutPercent", project.blanksCutPercent === null ? 0 : null)}>{project.blanksCutPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Edgeband</label>
                  {project.edgebandPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.edgebandPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.edgebandPercent === null ? "" : (project.edgebandPercent || 0)} onChange={(e) => updateField("edgebandPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.edgebandPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("edgebandPercent", project.edgebandPercent === null ? 0 : null)}>{project.edgebandPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Calibrate</label>
                  {project.calibratePercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.calibratePercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.calibratePercent === null ? "" : (project.calibratePercent || 0)} onChange={(e) => updateField("calibratePercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.calibratePercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("calibratePercent", project.calibratePercent === null ? 0 : null)}>{project.calibratePercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Facings</label>
                  {project.facingsPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.facingsPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.facingsPercent === null ? "" : (project.facingsPercent || 0)} onChange={(e) => updateField("facingsPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.facingsPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("facingsPercent", project.facingsPercent === null ? 0 : null)}>{project.facingsPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Final CNC</label>
                  {project.finalCncPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.finalCncPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.finalCncPercent === null ? "" : (project.finalCncPercent || 0)} onChange={(e) => updateField("finalCncPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.finalCncPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("finalCncPercent", project.finalCncPercent === null ? 0 : null)}>{project.finalCncPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Finish</label>
                  {project.finishPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.finishPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.finishPercent === null ? "" : (project.finishPercent || 0)} onChange={(e) => updateField("finishPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.finishPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("finishPercent", project.finishPercent === null ? 0 : null)}>{project.finishPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Sand</label>
                  {project.sandPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.sandPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.sandPercent === null ? "" : (project.sandPercent || 0)} onChange={(e) => updateField("sandPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.sandPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("sandPercent", project.sandPercent === null ? 0 : null)}>{project.sandPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Spray</label>
                  {project.sprayPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.sprayPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.sprayPercent === null ? "" : (project.sprayPercent || 0)} onChange={(e) => updateField("sprayPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.sprayPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("sprayPercent", project.sprayPercent === null ? 0 : null)}>{project.sprayPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Cut</label>
                  {project.cutPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.cutPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.cutPercent === null ? "" : (project.cutPercent || 0)} onChange={(e) => updateField("cutPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.cutPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("cutPercent", project.cutPercent === null ? 0 : null)}>{project.cutPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">CNC</label>
                  {project.cncPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.cncPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.cncPercent === null ? "" : (project.cncPercent || 0)} onChange={(e) => updateField("cncPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.cncPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("cncPercent", project.cncPercent === null ? 0 : null)}>{project.cncPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Build</label>
                  {project.buildPercent === null ? (
                    <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-slate-500">N/A</span>
                    </div>
                  ) : (
                    <ProgressBar value={project.buildPercent || 0} />
                  )}
                  <div className="mt-2 flex gap-2">
                    <Input type="number" min={0} max={100} value={project.buildPercent === null ? "" : (project.buildPercent || 0)} onChange={(e) => updateField("buildPercent", e.target.value === "" ? 0 : Number(e.target.value))} onFocus={(e) => e.target.select()} className="w-32" disabled={project.buildPercent === null} />
                    <Button variant="outline" size="sm" onClick={() => updateField("buildPercent", project.buildPercent === null ? 0 : null)}>{project.buildPercent === null ? "Enable" : "N/A"}</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">BOM & Materials</h2>
              </div>
              <div className="space-y-6">
                {[
                  { name: "Blanks", statusField: "blanksStatus", orderedField: "blanksDateOrdered", expectedField: "blanksDateExpected", receivedField: "blanksDateReceived" },
                  { name: "Lippings", statusField: "lippingsStatus", orderedField: "lippingsDateOrdered", expectedField: "lippingsDateExpected", receivedField: "lippingsDateReceived" },
                  { name: "Facings", statusField: "facingsStatus", orderedField: "facingsDateOrdered", expectedField: "facingsDateExpected", receivedField: "facingsDateReceived" },
                  { name: "Glass", statusField: "glassStatus", orderedField: "glassDateOrdered", expectedField: "glassDateExpected", receivedField: "glassDateReceived" },
                  { name: "Cassettes", statusField: "cassettesStatus", orderedField: "cassettesDateOrdered", expectedField: "cassettesDateExpected", receivedField: "cassettesDateReceived" },
                  { name: "Timbers", statusField: "timbersStatus", orderedField: "timbersDateOrdered", expectedField: "timbersDateExpected", receivedField: "timbersDateReceived" },
                  { name: "Ironmongery", statusField: "ironmongeryStatus", orderedField: "ironmongeryDateOrdered", expectedField: "ironmongeryDateExpected", receivedField: "ironmongeryDateReceived", options: ironmongeryStatusOptions },
                ].map((material) => (
                  <div key={material.name} className="border-b border-slate-200 pb-4 last:border-0">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">{material.name}</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Status</label>
                        <ColoredSelect
                          value={(project as any)[material.statusField] || ""}
                          onValueChange={(v) => updateField(material.statusField, v)}
                          options={(material.options || ["Not in BOM", "In BOM TBC", "Ordered Call Off", "In BOM", "Stock", "Ordered", "N/A", "Received"]).map((o: string) => ({
                            value: o,
                            label: o,
                            className: MATERIAL_STATUS_COLORS[o] || ""
                          }))}
                          placeholder="Select..."
                          customColors={customColors}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Ordered Date</label>
                        <EditableCell type="date" value={(project as any)[material.orderedField]} onChange={(v) => updateField(material.orderedField, v)} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Expected Date</label>
                        <EditableCell type="date" value={(project as any)[material.expectedField]} onChange={(v) => updateField(material.expectedField, v)} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Received Date</label>
                        <EditableCell type="date" value={(project as any)[material.receivedField]} onChange={(v) => updateField(material.receivedField, v)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Paperwork</h2>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Door Paperwork</label>
                  <ColoredSelect
                    value={(project as any).doorPaperworkStatus || ""}
                    onValueChange={(v) => updateField("doorPaperworkStatus", v)}
                    options={[
                      { value: "Not Started", label: "Not Started", className: PAPERWORK_STATUS_COLORS["Not Started"] },
                      { value: "Working On", label: "Working On", className: PAPERWORK_STATUS_COLORS["Working On"] },
                      { value: "Ready to Print", label: "Ready to Print", className: PAPERWORK_STATUS_COLORS["Ready to Print"] },
                      { value: "Part Complete", label: "Part Complete", className: PAPERWORK_STATUS_COLORS["Part Complete"] },
                      { value: "Printed in Office", label: "Printed in Office", className: PAPERWORK_STATUS_COLORS["Printed in Office"] },
                      { value: "In Factory", label: "In Factory", className: PAPERWORK_STATUS_COLORS["In Factory"] },
                      { value: "N/A", label: "N/A", className: PAPERWORK_STATUS_COLORS["N/A"] },
                    ]}
                    placeholder="Select..."
                    customColors={customColors}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Final CNC Sheet</label>
                  <ColoredSelect
                    value={(project as any).finalCncSheetStatus || ""}
                    onValueChange={(v) => updateField("finalCncSheetStatus", v)}
                    options={[
                      { value: "Not Started", label: "Not Started", className: PAPERWORK_STATUS_COLORS["Not Started"] },
                      { value: "Working On", label: "Working On", className: PAPERWORK_STATUS_COLORS["Working On"] },
                      { value: "Ready to Print", label: "Ready to Print", className: PAPERWORK_STATUS_COLORS["Ready to Print"] },
                      { value: "Part Complete", label: "Part Complete", className: PAPERWORK_STATUS_COLORS["Part Complete"] },
                      { value: "Printed in Office", label: "Printed in Office", className: PAPERWORK_STATUS_COLORS["Printed in Office"] },
                      { value: "In Factory", label: "In Factory", className: PAPERWORK_STATUS_COLORS["In Factory"] },
                      { value: "N/A", label: "N/A", className: PAPERWORK_STATUS_COLORS["N/A"] },
                    ]}
                    placeholder="Select..."
                    customColors={customColors}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Final Checks</label>
                  <ColoredSelect
                    value={(project as any).finalChecksSheetStatus || ""}
                    onValueChange={(v) => updateField("finalChecksSheetStatus", v)}
                    options={[
                      { value: "Not Started", label: "Not Started", className: PAPERWORK_STATUS_COLORS["Not Started"] },
                      { value: "Working On", label: "Working On", className: PAPERWORK_STATUS_COLORS["Working On"] },
                      { value: "Ready to Print", label: "Ready to Print", className: PAPERWORK_STATUS_COLORS["Ready to Print"] },
                      { value: "Part Complete", label: "Part Complete", className: PAPERWORK_STATUS_COLORS["Part Complete"] },
                      { value: "Printed in Office", label: "Printed in Office", className: PAPERWORK_STATUS_COLORS["Printed in Office"] },
                      { value: "In Factory", label: "In Factory", className: PAPERWORK_STATUS_COLORS["In Factory"] },
                      { value: "N/A", label: "N/A", className: PAPERWORK_STATUS_COLORS["N/A"] },
                    ]}
                    placeholder="Select..."
                    customColors={customColors}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Delivery Checklist</label>
                  <ColoredSelect
                    value={(project as any).deliveryChecklistStatus || ""}
                    onValueChange={(v) => updateField("deliveryChecklistStatus", v)}
                    options={[
                      { value: "Not Started", label: "Not Started", className: PAPERWORK_STATUS_COLORS["Not Started"] },
                      { value: "Working On", label: "Working On", className: PAPERWORK_STATUS_COLORS["Working On"] },
                      { value: "Ready to Print", label: "Ready to Print", className: PAPERWORK_STATUS_COLORS["Ready to Print"] },
                      { value: "Part Complete", label: "Part Complete", className: PAPERWORK_STATUS_COLORS["Part Complete"] },
                      { value: "Printed in Office", label: "Printed in Office", className: PAPERWORK_STATUS_COLORS["Printed in Office"] },
                      { value: "In Factory", label: "In Factory", className: PAPERWORK_STATUS_COLORS["In Factory"] },
                      { value: "N/A", label: "N/A", className: PAPERWORK_STATUS_COLORS["N/A"] },
                    ]}
                    placeholder="Select..."
                    customColors={customColors}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Frames Paperwork</label>
                  <ColoredSelect
                    value={(project as any).framesPaperworkStatus || ""}
                    onValueChange={(v) => updateField("framesPaperworkStatus", v)}
                    options={[
                      { value: "Not Started", label: "Not Started", className: PAPERWORK_STATUS_COLORS["Not Started"] },
                      { value: "Working On", label: "Working On", className: PAPERWORK_STATUS_COLORS["Working On"] },
                      { value: "Ready to Print", label: "Ready to Print", className: PAPERWORK_STATUS_COLORS["Ready to Print"] },
                      { value: "Part Complete", label: "Part Complete", className: PAPERWORK_STATUS_COLORS["Part Complete"] },
                      { value: "Printed in Office", label: "Printed in Office", className: PAPERWORK_STATUS_COLORS["Printed in Office"] },
                      { value: "In Factory", label: "In Factory", className: PAPERWORK_STATUS_COLORS["In Factory"] },
                      { value: "N/A", label: "N/A", className: PAPERWORK_STATUS_COLORS["N/A"] },
                    ]}
                    placeholder="Select..."
                    customColors={customColors}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Comments</label>
                <EditableCell type="textarea" value={project.paperworkComments} onChange={(v) => updateField("paperworkComments", v)} placeholder="Additional notes..." />
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Transport, Delivery & Installation</h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Transport Status</label>
                  <ColoredSelect
                    value={project.transportStatus || ""}
                    onValueChange={(v) => updateField("transportStatus", v)}
                    options={[
                      { value: "TBC", label: "TBC", className: TRANSPORT_STATUS_COLORS["TBC"] },
                      { value: "By Customer", label: "By Customer", className: TRANSPORT_STATUS_COLORS["By Customer"] },
                      { value: "By LAJ", label: "By LAJ", className: TRANSPORT_STATUS_COLORS["By LAJ"] },
                      { value: "Collect", label: "Collect", className: TRANSPORT_STATUS_COLORS["Collect"] },
                      { value: "Not Booked", label: "Not Booked", className: TRANSPORT_STATUS_COLORS["Not Booked"] },
                      { value: "Booked", label: "Booked", className: TRANSPORT_STATUS_COLORS["Booked"] },
                    ]}
                    placeholder="Select..."
                    customColors={customColors}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Door Sets</label>
                  <EditableCell type="number" value={project.doorSets} onChange={(v) => updateField("doorSets", v)} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Leaves</label>
                  <EditableCell type="number" value={project.leaves} onChange={(v) => updateField("leaves", v)} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Delivery Date</label>
                  <EditableCell type="date" value={project.deliveryDate} onChange={(v) => updateField("deliveryDate", v)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Install Start</label>
                  <EditableCell type="date" value={project.installStart} onChange={(v) => updateField("installStart", v)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Install End</label>
                  <EditableCell type="date" value={project.installEnd} onChange={(v) => updateField("installEnd", v)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Snagging Status</label>
                  <Select value={project.snaggingStatus || ""} onValueChange={(v) => updateField("snaggingStatus", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETE">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Delivery Notes</label>
                <EditableCell type="textarea" value={project.deliveryNotes} onChange={(v) => updateField("deliveryNotes", v)} placeholder="Special instructions..." />
              </div>
            </div>
          </>
        )}
            </TabsContent>

            <TabsContent value="bom" className="space-y-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Table className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Bill of Materials - Line Items</h2>
                  </div>
                </div>
                
                {loadingLineItems ? (
                  <div className="text-center py-8 text-slate-600">Loading line items...</div>
                ) : lineItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">No line items found for this project.</div>
                ) : (
                  <div className="space-y-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-300">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                              #
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                              Door Reference
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                              Location
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                              Width
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                              Height
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                              Fire Rating
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                              Line Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item: any, idx: number) => (
                            <tr 
                              key={item.id} 
                              onClick={() => setSelectedLineItemId(item.id === selectedLineItemId ? null : item.id)}
                              className={`border-b border-slate-200 hover:bg-blue-50 transition-colors cursor-pointer ${
                                item.id === selectedLineItemId ? 'bg-blue-100 hover:bg-blue-100' : 
                                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                              }`}
                            >
                              <td className="px-3 py-2 text-sm text-slate-700">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2 text-sm font-medium text-slate-800">
                                {item.doorRef || '—'}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700">
                                {item.location || '—'}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700">
                                {item.masterWidth != null ? `${item.masterWidth}mm` : '—'}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700">
                                {item.doorHeight != null ? `${item.doorHeight}mm` : '—'}
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700">
                                {item.fireRating || '—'}
                              </td>
                              <td className="px-3 py-2 text-sm font-medium text-slate-800">
                                {item.lineTotal != null ? `£${item.lineTotal.toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selectedLineItemId && (
                      <div className="pt-4 border-t border-slate-200">
                        <FireDoorBOM lineItemId={selectedLineItemId} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {lineItemLayout?.processes && lineItemLayout.processes.map((process: any) => (
              <TabsContent key={process.code} value={`process-${process.code}`} className="space-y-6">
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <Table className="w-5 h-5 text-white" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-800">{process.name} - Line Items</h2>
                    </div>
                  </div>
                  
                  {loadingLineItems ? (
                    <div className="text-center py-8 text-slate-600">Loading line items...</div>
                  ) : lineItems.length === 0 ? (
                    <div className="text-center py-8 text-slate-600">No line items found for this project.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b-2 border-slate-300">
                            {process.projectFields?.filter((f: any) => f.visible).map((field: any) => (
                              <th key={`proj-${field.key}`} className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                                {field.label}
                              </th>
                            ))}
                            {process.lineItemFields?.filter((f: any) => f.visible).map((field: any) => (
                              <th key={`item-${field.key}`} className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                                {field.label}
                              </th>
                            ))}
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 sticky top-0 bg-slate-100">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item: any, idx: number) => (
                            <tr key={item.id} className={`border-b border-slate-200 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                              {process.projectFields?.filter((f: any) => f.visible).map((field: any) => (
                                <td key={`proj-${field.key}`} className="px-3 py-2 text-sm text-slate-700">
                                  {project?.[field.key] != null ? String(project[field.key]) : '—'}
                                </td>
                              ))}
                              {process.lineItemFields?.filter((f: any) => f.visible).map((field: any) => (
                                <td key={`item-${field.key}`} className="px-3 py-2 text-sm text-slate-700">
                                  {item[field.key] != null ? String(item[field.key]) : '—'}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-sm">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/fire-door-line-item-layout/${item.id}?process=${process.code}`)}
                                    className="text-xs"
                                  >
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(`/fire-door-qr/${item.id}`, '_blank')}
                                    className="text-xs"
                                  >
                                    <QrCode className="w-3 h-3 mr-1" />
                                    QR
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Project Overview</h2>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">MJS Number</label>
                  <EditableCell value={project.mjsNumber} onChange={(v) => updateField("mjsNumber", v)} placeholder="e.g. 1234" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Job Name</label>
                  <EditableCell value={project.jobName} onChange={(v) => updateField("jobName", v)} placeholder="Project name" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Client Name</label>
                  <EditableCell value={project.clientName} onChange={(v) => updateField("clientName", v)} placeholder="Company name" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">PO Number</label>
                  <EditableCell value={project.poNumber} onChange={(v) => updateField("poNumber", v)} placeholder="Purchase order" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">LAQ Number</label>
                  <EditableCell value={project.laqNumber} onChange={(v) => updateField("laqNumber", v)} placeholder="LAQ reference" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date Received</label>
                  <EditableCell type="date" value={project.dateReceived} onChange={(v) => updateField("dateReceived", v)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date Required</label>
                  <EditableCell type="date" value={project.dateRequired} onChange={(v) => updateField("dateRequired", v)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Job Location</label>
                  <Select value={project.jobLocation || ""} onValueChange={(v) => updateField("jobLocation", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RED FOLDER">🔴 Red Folder</SelectItem>
                      <SelectItem value="IN PROGRESS">⚙️ In Progress</SelectItem>
                      <SelectItem value="COMPLETE">✅ Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Toaster />
    </div>
  );
}

