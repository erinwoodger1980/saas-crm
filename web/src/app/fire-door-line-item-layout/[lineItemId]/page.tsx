"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings, Save, Calculator } from "lucide-react";
import Link from "next/link";
import QRCodeReact from "react-qr-code";

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
  fieldCalculations?: {
    [fieldKey: string]: string;
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

  async function evaluateLookup(tableName: string, conditions: string, returnField: string): Promise<string> {
    try {
      // Parse conditions (e.g., "rating=${lineItem.rating}&type=${lineItem.doorsetType}")
      let conditionStr = conditions;
      
      // Replace line item fields
      const lineItemMatches = conditions.match(/\$\{lineItem\.(\w+)\}/g);
      if (lineItemMatches) {
        lineItemMatches.forEach(match => {
          const field = match.replace("${lineItem.", "").replace("}", "");
          const value = data!.lineItem[field] || "";
          conditionStr = conditionStr.replace(match, String(value));
        });
      }
      
      // Replace project fields
      const projectMatches = conditions.match(/\$\{project\.(\w+)\}/g);
      if (projectMatches) {
        projectMatches.forEach(match => {
          const field = match.replace("${project.", "").replace("}", "");
          const value = data!.project?.[field] || "";
          conditionStr = conditionStr.replace(match, String(value));
        });
      }
      
      // Call API to perform lookup
      const response = await apiFetch(`/api/lookup/${tableName}?${conditionStr}&returnField=${returnField}`);
      return response.value || "";
    } catch (e) {
      console.error("Error performing lookup:", e);
      throw new Error(`Lookup failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  function evaluateFormula(formula: string): string {
    if (!data?.lineItem || !formula) return "";
    
    try {
      // Replace ${lineItem.field} and ${project.field} with actual values
      let result = formula;
      
      // Check for LOOKUP function - this will be handled asynchronously
      if (formula.includes('LOOKUP(')) {
        // LOOKUP formulas need async evaluation - return placeholder
        return "[LOOKUP - Loading...]";
      }
      
      // Replace lineItem fields
      const lineItemMatches = formula.match(/\$\{lineItem\.(\w+)\}/g);
      if (lineItemMatches) {
        lineItemMatches.forEach(match => {
          const field = match.replace("${lineItem.", "").replace("}", "");
          const value = data.lineItem[field] || "";
          // For URL encoding (CNC URLs), encode the value
          if (formula.includes('http') || formula.includes('cnc')) {
            result = result.replace(match, encodeURIComponent(String(value)));
          } else {
            // For calculations, use raw value
            result = result.replace(match, String(value));
          }
        });
      }
      
      // Replace project fields
      const projectMatches = formula.match(/\$\{project\.(\w+)\}/g);
      if (projectMatches) {
        projectMatches.forEach(match => {
          const field = match.replace("${project.", "").replace("}", "");
          const value = data.project?.[field] || "";
          // For URL encoding (CNC URLs), encode the value
          if (formula.includes('http') || formula.includes('cnc')) {
            result = result.replace(match, encodeURIComponent(String(value)));
          } else {
            // For calculations, use raw value
            result = result.replace(match, String(value));
          }
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

    // Handle CNC URL fields with QR codes - get formula from layout configuration
    if (config.key === 'initialCncProgramUrl' || config.key === 'finalCncTrimProgramUrl') {
      const formula = data?.layout?.cncCalculations?.[config.key as 'initialCncProgramUrl' | 'finalCncTrimProgramUrl'];
      const evaluatedUrl = formula ? evaluateFormula(formula) : '';
      
      return (
        <div key={`${source}-${config.key}`} className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {config.label}
          </label>
          {evaluatedUrl ? (
            <>
              <div className="bg-white p-4 rounded border inline-block">
                <QRCodeReact value={evaluatedUrl} size={200} />
              </div>
              <div className="flex gap-2">
                <Input 
                  value={evaluatedUrl} 
                  readOnly 
                  className="text-xs font-mono"
                />
                <Button
                  size="sm"
                  onClick={() => window.open(evaluatedUrl, '_blank')}
                >
                  Open
                </Button>
              </div>
            </>
          ) : (
            <div className="text-sm p-2 bg-muted rounded text-muted-foreground">
              No URL configured
            </div>
          )}
        </div>
      );
    }

    // Check for calculated field formulas
    const fieldFormula = data?.layout?.fieldCalculations?.[config.key];
    let calculatedValue = null;
    let calculationError = null;
    
    if (fieldFormula && source === "lineItem") {
      try {
        // Evaluate the formula
        const evaluated = evaluateFormula(fieldFormula);
        // Try to evaluate as math expression
        try {
          // Simple eval for math (could be enhanced with a proper expression parser)
          const result = Function('"use strict"; return (' + evaluated + ')')();
          calculatedValue = result;
        } catch {
          // If it's not a math expression, use as-is (could be string concatenation)
          calculatedValue = evaluated;
        }
      } catch (error) {
        calculationError = error instanceof Error ? error.message : "Calculation error";
      }
    }

    // Format the value for display
    const displayValue = calculatedValue !== null ? String(calculatedValue) :
      isBlank ? "-" : 
      value instanceof Date ? new Date(value).toLocaleDateString() :
      typeof value === "number" ? value.toLocaleString() :
      String(value);

    return (
      <div key={`${source}-${config.key}`} className="space-y-1">
        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {config.label}
          {calculatedValue !== null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
              <Calculator className="w-3 h-3 mr-1" />
              Calculated
            </span>
          )}
        </label>
        {calculationError ? (
          <div className="text-sm p-2 bg-red-50 border border-red-200 text-red-700 rounded">
            Error: {calculationError}
          </div>
        ) : calculatedValue !== null ? (
          <div className="space-y-2">
            <div className="text-sm p-2 bg-blue-50 border border-blue-200 rounded font-semibold">
              {displayValue}
            </div>
            <div className="text-xs text-muted-foreground font-mono bg-muted p-1 rounded">
              Formula: {fieldFormula}
            </div>
          </div>
        ) : config.editable && source === "lineItem" ? (
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
