"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Trash2, Sparkles, FileCheck, Upload, Info, Table, RotateCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getApiBase } from "@/lib/api-base";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import FireDoorSpreadsheet from "@/components/FireDoorSpreadsheet";

const ironmongeryStatusOptions = [
  "Not in BOM",
  "In BOM TBC",
  "Ordered Call Off",
  "In BOM",
  "Stock",
  "Ordered",
  "N/A",
  "Received",
  "Received from TBS",
  "Received from Customer"
];

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
  deliveryNotes?: string;
  transportStatus?: string;
  doorSets?: number | null;
  leaves?: number | null;
  deliveryDate?: Date | null;
  installStart?: Date | null;
  installEnd?: Date | null;
  snaggingStatus?: string;
  snaggingComplete?: boolean;
  blanksCutPercent?: number;
  edgebandPercent?: number;
  calibratePercent?: number;
  facingsPercent?: number;
  finalCncPercent?: number;
  finishPercent?: number;
  sandPercent?: number;
  sprayPercent?: number;
  cutPercent?: number;
  cncPercent?: number;
  buildPercent?: number;
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

  useEffect(() => {
    if (!isNew && id) {
      loadProject();
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
      toast({ title: "Refreshed", description: "Project data updated" });
    } catch (error) {
      console.error("Error refreshing project:", error);
    } finally {
      setRefreshing(false);
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
    setSaving(true);
    try {
      if (isNew) {
        const { id: _, ...createData } = project as any;
        const created = await apiFetch<FireDoorProject>("/fire-door-schedule", { method: "POST", json: createData });
        toast({ title: "Success", description: "Project created successfully" });
        router.push(`/fire-door-schedule/${created.id}`);
      } else {
        // Convert Date objects to ISO strings and clean up data before sending
        const cleanData: any = { ...project };
        
        // Convert Date objects to ISO strings or null
        const dateFields = [
          'dateReceived', 'dateRequired', 'signOffDate', 'approxDeliveryDate',
          'deliveryDate', 'installStart', 'installEnd',
          'blanksOrdered', 'blanksReceived', 'blanksChecked',
          'lippingsOrdered', 'lippingsReceived', 'lippingsChecked',
          'facingsOrdered', 'facingsReceived', 'facingsChecked',
          'glassOrdered', 'glassReceived', 'glassChecked',
          'cassettesOrdered', 'cassettesReceived', 'cassettesChecked',
          'timbersOrdered', 'timbersReceived', 'timbersChecked',
          'ironmongeryOrdered', 'ironmongeryReceived', 'ironmongeryChecked'
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
        
        await apiFetch(`/fire-door-schedule/${id}`, { method: "PATCH", json: cleanData });
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
    setProject((prev) => {
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
    });
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    setAutoSaveTimeout(setTimeout(() => { if (!isNew) saveProject(); }, 800));
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
            <TabsList className="grid w-full max-w-3xl grid-cols-3 bg-white/60 backdrop-blur-sm">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Project Overview
              </TabsTrigger>
              <TabsTrigger value="bom" className="flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                BOM & Materials
              </TabsTrigger>
              <TabsTrigger value="lineitems" className="flex items-center gap-2">
                <Table className="w-4 h-4" />
                Line Items
              </TabsTrigger>
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
                  <ProgressBar value={project.blanksCutPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.blanksCutPercent || 0} onChange={(e) => updateField("blanksCutPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Edgeband</label>
                  <ProgressBar value={project.edgebandPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.edgebandPercent || 0} onChange={(e) => updateField("edgebandPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Calibrate</label>
                  <ProgressBar value={project.calibratePercent || 0} />
                  <Input type="number" min={0} max={100} value={project.calibratePercent || 0} onChange={(e) => updateField("calibratePercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Facings</label>
                  <ProgressBar value={project.facingsPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.facingsPercent || 0} onChange={(e) => updateField("facingsPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Final CNC</label>
                  <ProgressBar value={project.finalCncPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.finalCncPercent || 0} onChange={(e) => updateField("finalCncPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Finish</label>
                  <ProgressBar value={project.finishPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.finishPercent || 0} onChange={(e) => updateField("finishPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Sand</label>
                  <ProgressBar value={project.sandPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.sandPercent || 0} onChange={(e) => updateField("sandPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Spray</label>
                  <ProgressBar value={project.sprayPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.sprayPercent || 0} onChange={(e) => updateField("sprayPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Cut</label>
                  <ProgressBar value={project.cutPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.cutPercent || 0} onChange={(e) => updateField("cutPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">CNC</label>
                  <ProgressBar value={project.cncPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.cncPercent || 0} onChange={(e) => updateField("cncPercent", Number(e.target.value))} className="mt-2 w-32" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-2 block">Build</label>
                  <ProgressBar value={project.buildPercent || 0} />
                  <Input type="number" min={0} max={100} value={project.buildPercent || 0} onChange={(e) => updateField("buildPercent", Number(e.target.value))} className="mt-2 w-32" />
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
                        <Select value={(project as any)[material.statusField] || ""} onValueChange={(v) => updateField(material.statusField, v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(material.options || ["Not in BOM", "In BOM TBC", "Ordered Call Off", "In BOM", "Stock", "Ordered", "N/A", "Received"]).map((o: string) => (
                              <SelectItem key={o} value={o}>{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  <Select value={(project as any).doorPaperwork || ""} onValueChange={(v) => updateField("doorPaperwork", v)}>
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
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Final CNC Sheet</label>
                  <Select value={(project as any).finalCncSheet || ""} onValueChange={(v) => updateField("finalCncSheet", v)}>
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
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Final Checks</label>
                  <Select value={(project as any).finalChecks || ""} onValueChange={(v) => updateField("finalChecks", v)}>
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
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Delivery Checklist</label>
                  <Select value={(project as any).deliveryChecklist || ""} onValueChange={(v) => updateField("deliveryChecklist", v)}>
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
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Frames Paperwork</label>
                  <Select value={(project as any).framesPaperwork || ""} onValueChange={(v) => updateField("framesPaperwork", v)}>
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
                  <Select value={project.transportStatus || ""} onValueChange={(v) => updateField("transportStatus", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOT_SCHEDULED">Not Scheduled</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                      <SelectItem value="DELIVERED">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
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

            <TabsContent value="lineitems" className="space-y-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Table className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Fire Door Line Items (144 Columns)</h2>
                </div>
                {selectedImportId ? (
                  <FireDoorSpreadsheet importId={selectedImportId} />
                ) : (
                  <div className="text-slate-600 text-sm">Select an import in the Project Overview tab to view line items.</div>
                )}
              </div>
            </TabsContent>
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

