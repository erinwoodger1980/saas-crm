"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings, Save } from "lucide-react";
import Link from "next/link";

interface FieldConfig {
  key: string;
  label: string;
  visible: boolean;
  editable: boolean;
}

interface ProcessConfig {
  code: string;
  name: string;
  projectFields: FieldConfig[];
  lineItemFields: FieldConfig[];
}

interface LayoutConfig {
  processes: ProcessConfig[];
  cncCalculations: {
    initialCncProgramUrl: string;
    finalCncTrimProgramUrl: string;
  };
  hideBlankFields: boolean;
  groupByCategory: boolean;
}

interface LineItemData {
  lineItem: any;
  project: any;
  layout: LayoutConfig | null;
}

export default function FireDoorLineItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lineItemId = params?.lineItemId as string;
  
  const [data, setData] = useState<LineItemData | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    if (lineItemId) {
      loadData();
    }
  }, [lineItemId]);

  useEffect(() => {
    // Check if process is specified in URL
    const processParam = searchParams.get("process");
    if (processParam && data?.layout?.processes) {
      const processExists = data.layout.processes.some(p => p.code === processParam);
      if (processExists) {
        setActiveTab(processParam);
      }
    } else if (data?.layout?.processes && data.layout.processes.length > 0 && !activeTab) {
      // Set first process as active if none selected
      setActiveTab(data.layout.processes[0].code);
    }
  }, [searchParams, data, activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      const result = await apiFetch<LineItemData>(
        `/fire-door-line-item-layout/${lineItemId}/data`
      );
      setData(result);
    } catch (e: any) {
      console.error("Failed to load line item data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function saveChanges() {
    if (!data || Object.keys(editedValues).length === 0) return;
    
    setSaving(true);
    try {
      await apiFetch(`/fire-door-schedule/line-items/${lineItemId}`, {
        method: "PATCH",
        json: editedValues,
      });
      
      // Reload data to get fresh values
      await loadData();
      setEditedValues({});
    } catch (e: any) {
      console.error("Failed to save changes:", e);
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(key: string, value: any) {
    setEditedValues(prev => ({
      ...prev,
      [key]: value,
    }));
  }

  function evaluateFormula(formula: string): string {
    if (!data?.lineItem || !formula) return "";
    
    try {
      // Replace ${lineItem.field} and ${project.field} with actual values
      let result = formula;
      
      // Replace lineItem fields
      const lineItemMatches = formula.match(/\$\{lineItem\.(\w+)\}/g);
      if (lineItemMatches) {
        lineItemMatches.forEach(match => {
          const field = match.replace("${lineItem.", "").replace("}", "");
          const value = data.lineItem[field] || "";
          result = result.replace(match, encodeURIComponent(String(value)));
        });
      }
      
      // Replace project fields
      const projectMatches = formula.match(/\$\{project\.(\w+)\}/g);
      if (projectMatches) {
        projectMatches.forEach(match => {
          const field = match.replace("${project.", "").replace("}", "");
          const value = data.project?.[field] || "";
          result = result.replace(match, encodeURIComponent(String(value)));
        });
      }
      
      return result;
    } catch (e) {
      console.error("Error evaluating formula:", e);
      return formula;
    }
  }

  function renderField(config: FieldConfig, value: any, source: "project" | "lineItem") {
    if (!config.visible) return null;
    
    const currentValue = editedValues[config.key] ?? value;
    const isBlank = currentValue === null || currentValue === undefined || currentValue === "";
    
    // Hide blank fields if configured
    if (data?.layout?.hideBlankFields && isBlank) return null;

    // Format the value for display
    const displayValue = isBlank ? "-" : 
      value instanceof Date ? new Date(value).toLocaleDateString() :
      typeof value === "number" ? value.toLocaleString() :
      String(value);

    return (
      <div key={`${source}-${config.key}`} className="space-y-1">
        <label className="text-sm font-medium text-muted-foreground">
          {config.label}
        </label>
        {config.editable && source === "lineItem" ? (
          typeof currentValue === "string" && currentValue.length > 50 ? (
            <Textarea
              value={currentValue}
              onChange={(e) => handleFieldChange(config.key, e.target.value)}
              className="min-h-[80px]"
            />
          ) : (
            <Input
              type={typeof currentValue === "number" ? "number" : "text"}
              value={currentValue}
              onChange={(e) => handleFieldChange(
                config.key,
                typeof currentValue === "number" ? parseFloat(e.target.value) : e.target.value
              )}
            />
          )
        ) : (
          <div className="text-sm p-2 bg-muted rounded">
            {displayValue}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading line item details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="text-center text-destructive">Failed to load line item data</div>
      </div>
    );
  }

  const { lineItem, project, layout } = data;
  const defaultLayout: LayoutConfig = {
    processes: [
      {
        code: "CORE",
        name: "Core Cutting",
        projectFields: [
          { key: "mjsNumber", label: "MJS Number", visible: true, editable: false },
          { key: "jobName", label: "Job Name", visible: true, editable: false },
        ],
        lineItemFields: [
          { key: "doorRef", label: "Door Ref", visible: true, editable: false },
          { key: "rating", label: "Fire Rating", visible: true, editable: false },
          { key: "masterWidth", label: "Master Width", visible: true, editable: false },
          { key: "doorHeight", label: "Door Height", visible: true, editable: false },
        ],
      },
    ],
    cncCalculations: {
      initialCncProgramUrl: "",
      finalCncTrimProgramUrl: "",
    },
    hideBlankFields: true,
    groupByCategory: true,
  };

  const activeLayout = layout || defaultLayout;
  const hasEdits = Object.keys(editedValues).length > 0;
  const processes = activeLayout.processes || [];

  function renderProcessTab(process: ProcessConfig) {
    return (
      <div className="space-y-6">
        {/* Project Information for this process */}
        {process.projectFields.some(f => f.visible) && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Project Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {process.projectFields.map((fieldConfig) =>
                renderField(fieldConfig, project?.[fieldConfig.key], "project")
              )}
            </div>
          </Card>
        )}

        {/* Line Item Details for this process */}
        {process.lineItemFields.some(f => f.visible) && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Line Item Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {process.lineItemFields.map((fieldConfig) =>
                renderField(fieldConfig, lineItem[fieldConfig.key], "lineItem")
              )}
            </div>
          </Card>
        )}

        {/* CNC Program URLs for CNC process */}
        {process.code === "CNC" && activeLayout.cncCalculations && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">CNC Programs</h2>
            <div className="space-y-4">
              {activeLayout.cncCalculations.initialCncProgramUrl && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    Initial CNC Program URL
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={evaluateFormula(activeLayout.cncCalculations.initialCncProgramUrl)}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const url = evaluateFormula(activeLayout.cncCalculations.initialCncProgramUrl);
                        if (url) window.open(url, "_blank");
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              )}
              {activeLayout.cncCalculations.finalCncTrimProgramUrl && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    Final CNC Trim Program URL
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={evaluateFormula(activeLayout.cncCalculations.finalCncTrimProgramUrl)}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const url = evaluateFormula(activeLayout.cncCalculations.finalCncTrimProgramUrl);
                        if (url) window.open(url, "_blank");
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold">
                  {lineItem.doorRef || lineItem.lajRef || "Line Item"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {project?.jobName || "Project"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/fire-door-line-item-layout/settings`}>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Layout
                </Button>
              </Link>
              {hasEdits && (
                <Button
                  onClick={saveChanges}
                  disabled={saving}
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {processes.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              {processes.map((process) => (
                <TabsTrigger key={process.code} value={process.code}>
                  {process.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {processes.map((process) => (
              <TabsContent key={process.code} value={process.code}>
                {renderProcessTab(process)}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card className="p-6">
            <p className="text-center text-muted-foreground">
              No processes configured. Please configure line item layout in settings.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
