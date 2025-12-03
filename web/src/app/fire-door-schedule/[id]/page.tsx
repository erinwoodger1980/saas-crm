"use client";
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Trash2, Sparkles, FileCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import FireDoorSpreadsheet from "@/components/FireDoorSpreadsheet";

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

  useEffect(() => {
    if (!isNew && id) {
      loadProject();
    } else if (isNew) {
      setProject({ id: "new", jobLocation: "RED FOLDER", signOffStatus: "AWAITING SCHEDULE", overallProgress: 0 } as FireDoorProject);
    }
  }, [id, isNew]);

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
        await apiFetch(`/fire-door-schedule/${id}`, { method: "PATCH", json: project });
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
                <Button variant="outline" onClick={deleteProject} className="border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
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

      <div className="container mx-auto px-6 py-8 space-y-6">
        {!isNew && (
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
        )}

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
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            {selectedImportId ? (
              <FireDoorSpreadsheet importId={selectedImportId} />
            ) : (
              <div className="text-slate-600 text-sm">Select an import to view line items.</div>
            )}
          </div>
        )}
      </div>

      <Toaster />
    </div>
  );
}
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Sparkles,
  CheckCircle2,
  Truck,
  "use client";

  import { useState, useEffect } from "react";
  import { useRouter, useParams } from "next/navigation";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Textarea } from "@/components/ui/textarea";
  import { Checkbox } from "@/components/ui/checkbox";
  import { ArrowLeft, Save, Trash2, Sparkles, CheckCircle2, Truck, Wrench, FileCheck } from "lucide-react";
  import { apiFetch } from "@/lib/api";
  import { useToast } from "@/components/ui/use-toast";
  import { Toaster } from "@/components/ui/toaster";
  import FireDoorSpreadsheet from "@/components/FireDoorSpreadsheet";

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
    blanksChecked?: boolean;
    lippingsChecked?: boolean;
    facingsChecked?: boolean;
    glassChecked?: boolean;
    cassettesChecked?: boolean;
    timbersChecked?: boolean;
    ironmongeryChecked?: boolean;
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
          {percentage > 0 && (
            <span className="text-xs font-semibold text-white drop-shadow">{percentage}%</span>
          )}
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
    max
  }: { 
    value: any; 
    onChange: (val: any) => void;
    type?: "text" | "number" | "date" | "textarea";
    placeholder?: string;
    className?: string;
    min?: number;
    max?: number;
  }) {
    const [draft, setDraft] = useState(value || "");

    useEffect(() => {
      setDraft(value || "");
    }, [value]);

    const save = () => {
      onChange(draft);
    };

    if (type === "textarea") {
      return (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          placeholder={placeholder}
          className={`min-h-[60px] ${className}`}
          rows={2}
        />
      );
    }

    if (type === "date") {
      return (
        <Input
          type="date"
          value={value ? new Date(value).toISOString().split("T")[0] : ""}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
          className={className}
        />
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
          if (e.key === "Escape") setDraft(value || "");
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
    const [imports, setImports] = useState<Array<{id: string; sourceName: string; totalValue: number; currency: string; rowCount: number; createdAt: string}>>([]);
    const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
    const [netValueInput, setNetValueInput] = useState<string>("");

    useEffect(() => {
      if (!isNew && id) {
        loadProject();
      } else if (isNew) {
        setProject({
          id: "new",
          jobLocation: "RED FOLDER",
          signOffStatus: "AWAITING SCHEDULE",
          orderingStatus: "NOT IN BOM",
          blanksChecked: false,
          lippingsChecked: false,
          facingsChecked: false,
          glassChecked: false,
          cassettesChecked: false,
          timbersChecked: false,
          ironmongeryChecked: false,
          fscRequired: false,
          snaggingComplete: false,
          overallProgress: 0,
        } as FireDoorProject);
      }
    }, [id, isNew]);

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

    async function loadImportsForProject() {
      try {
        const data = await apiFetch<{ imports: any[] }>(`/fire-doors/imports/by-project/${id}`);
        const list = (data?.imports || []).map((imp) => ({
          ...imp,
          totalValue: Number(imp.totalValue || 0),
        }));
        setImports(list);
        if (list.length > 0) setSelectedImportId(list[0].id);
      } catch (error) {
        console.error("Error loading imports for project:", error);
      }
    }

    useEffect(() => {
      if (!isNew && id) {
        loadImportsForProject();
      }
    }, [id, isNew]);

    async function saveProject() {
      if (!project) return;

      setSaving(true);
      try {
        if (isNew) {
          const { id: _, ...createData } = project as any;
          const created = await apiFetch<FireDoorProject>("/fire-door-schedule", {
            method: "POST",
            json: createData,
          });
          toast({ title: "Success", description: "Project created successfully" });
          router.push(`/fire-door-schedule/${created.id}`);
        } else {
          await apiFetch(`/fire-door-schedule/${id}`, {
            method: "PATCH",
            json: project,
          });
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
        if (field.includes("Percent") || field.includes("Checked") || field.includes("Status")) {
          const progressFields = [
            "blanksCutPercent", "edgebandPercent", "calibratePercent", 
            "facingsPercent", "finalCncPercent", "finishPercent",
            "sandPercent", "sprayPercent", "cutPercent", "cncPercent", "buildPercent"
          ];
          const total = progressFields.reduce((sum, f) => sum + (updated[f] || 0), 0);
          updated.overallProgress = Math.round(total / progressFields.length);
        }
        return updated;
      });

      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      setAutoSaveTimeout(setTimeout(() => {
        if (!isNew) saveProject();
      }, 1000));
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
                <Button 
                  variant="ghost" 
                  onClick={() => router.push("/fire-door-schedule")}
                  className="hover:bg-white/50 px-3"
                >
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
                  <Button variant="outline" onClick={deleteProject} className="border-red-200 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
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

        <div className="container mx-auto px-6 py-8 space-y-6">
          {!isNew && (
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
                  <select
                    className="h-9 w-full border border-slate-300 rounded-md bg-white px-3"
                    value={selectedImportId || ""}
                    onChange={(e) => setSelectedImportId(e.target.value)}
                  >
                    {imports.map((imp) => (
                      <option key={imp.id} value={imp.id}>
                        {imp.sourceName} • {new Date(imp.createdAt).toLocaleDateString("en-GB")} • {imp.rowCount} items
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Calculated Import Total</label>
                  <Input readOnly value={(imports.find(i => i.id === selectedImportId)?.totalValue || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
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
          )}

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

          {/* Additional sections omitted for brevity; keep existing ones intact */}

          {!isNew && (
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
              {selectedImportId ? (
                <FireDoorSpreadsheet importId={selectedImportId} />
              ) : (
                <div className="text-slate-600 text-sm">Select an import to view line items.</div>
              )}
            </div>
          )}
        </div>

        <Toaster />
      </div>
    );
  }
                <label htmlFor="snaggingComplete" className="text-sm font-medium text-slate-700 cursor-pointer">
                  ✅ Snagging Complete
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Notes & Communication</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">📢 Communication Notes</label>
              <EditableCell
                type="textarea"
                value={project.communicationNotes}
                onChange={(v) => updateField("communicationNotes", v)}
                placeholder="External communication notes..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">🔒 Internal Notes</label>
              <EditableCell
                type="textarea"
                value={project.internalNotes}
                onChange={(v) => updateField("internalNotes", v)}
                placeholder="Internal team notes..."
              />
            </div>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}
