"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

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
    [fieldKey: string]: string; // field key -> formula
  };
  hideBlankFields: boolean;
  groupByCategory: boolean;
}

// All available line item fields
const ALL_LINE_ITEM_FIELDS = [
  { key: "doorRef", label: "Door Ref", category: "Basic Info" },
  { key: "lajRef", label: "LAJ Ref", category: "Basic Info" },
  { key: "rating", label: "Fire Rating", category: "Basic Info" },
  { key: "doorsetType", label: "Doorset Type", category: "Basic Info" },
  { key: "certification", label: "Certification", category: "Basic Info" },
  { key: "itemType", label: "Item Type", category: "Basic Info" },
  { key: "code", label: "Code", category: "Basic Info" },
  { key: "location", label: "Location", category: "Basic Info" },
  
  { key: "masterWidth", label: "Master Width", category: "Dimensions" },
  { key: "slaveWidth", label: "Slave Width", category: "Dimensions" },
  { key: "doorHeight", label: "Door Height", category: "Dimensions" },
  { key: "leafThickness", label: "Leaf Thickness", category: "Dimensions" },
  { key: "masterLeafWidth", label: "Master Leaf Width", category: "Dimensions" },
  { key: "slaveLeafWidth", label: "Slave Leaf Width", category: "Dimensions" },
  { key: "leafHeight", label: "Leaf Height", category: "Dimensions" },
  
  { key: "core", label: "Core", category: "Core Specifications" },
  { key: "coreType", label: "Core Type", category: "Core Specifications" },
  { key: "top", label: "Top", category: "Core Specifications" },
  { key: "btm", label: "Bottom", category: "Core Specifications" },
  { key: "hinge", label: "Hinge", category: "Core Specifications" },
  { key: "me", label: "ME", category: "Core Specifications" },
  { key: "daExposed", label: "DA Exposed", category: "Core Specifications" },
  { key: "trim", label: "Trim", category: "Core Specifications" },
  { key: "safeHinge", label: "Safe Hinge", category: "Core Specifications" },
  { key: "pf", label: "PF", category: "Core Specifications" },
  { key: "extra", label: "Extra", category: "Core Specifications" },
  
  { key: "material", label: "Material", category: "Materials" },
  { key: "materialFacing", label: "Material Facing", category: "Materials" },
  { key: "doorFacing", label: "Door Facing", category: "Materials" },
  { key: "lippingFinish", label: "Lipping Finish", category: "Materials" },
  
  { key: "qtyOfHinges", label: "Qty of Hinges", category: "Ironmongery" },
  { key: "hingeType", label: "Hinge Type", category: "Ironmongery" },
  { key: "lockType", label: "Lock Type", category: "Ironmongery" },
  { key: "lockHeight", label: "Lock Height", category: "Ironmongery" },
  { key: "spindlePrep", label: "Spindle Prep", category: "Ironmongery" },
  { key: "cylinderPrep", label: "Cylinder Prep", category: "Ironmongery" },
  { key: "flushBolt", label: "Flush Bolt", category: "Ironmongery" },
  { key: "flushBoltQty", label: "Flush Bolt Qty", category: "Ironmongery" },
  { key: "closerOrFloorSpring", label: "Closer/Floor Spring", category: "Ironmongery" },
  { key: "ironmongeryPackRef", label: "Ironmongery Pack Ref", category: "Ironmongery" },
  
  { key: "doorFinish", label: "Door Finish", category: "Finish" },
  { key: "doorFinishFinal", label: "Door Finish Final", category: "Finish" },
  { key: "doorFinishSide1", label: "Door Finish Side 1", category: "Finish" },
  { key: "doorFinishSide2", label: "Door Finish Side 2", category: "Finish" },
  { key: "internalColour", label: "Internal Colour", category: "Finish" },
  { key: "externalColour", label: "External Colour", category: "Finish" },
  { key: "frameFinish", label: "Frame Finish", category: "Finish" },
  
  { key: "vpType", label: "Vision Panel Type", category: "Glazing" },
  { key: "visionPanelMaster", label: "Vision Panel Master", category: "Glazing" },
  { key: "visionPanelSlave", label: "Vision Panel Slave", category: "Glazing" },
  { key: "beadType", label: "Bead Type", category: "Glazing" },
  { key: "vpPosition", label: "Vision Panel Position", category: "Glazing" },
  { key: "glassType", label: "Glass Type", category: "Glazing" },
  { key: "glazingSystem", label: "Glazing System", category: "Glazing" },
  { key: "vpSize", label: "Vision Panel Size", category: "Glazing" },
  
  { key: "notes1", label: "Notes 1", category: "Notes" },
  { key: "notes2", label: "Notes 2", category: "Notes" },
  { key: "additionNote1", label: "Additional Note 1", category: "Notes" },
  
  { key: "initialCncProgramUrl", label: "Initial CNC Program URL", category: "CNC" },
  { key: "finalCncTrimProgramUrl", label: "Final CNC Trim Program URL", category: "CNC" },
  
  // Calculated fields
  { key: "cncBlankWidth", label: "CNC Blank Width", category: "Calculated" },
  { key: "cncBlankHeight", label: "CNC Blank Height", category: "Calculated" },
  { key: "cncTrimWidth", label: "CNC Trim Width", category: "Calculated" },
  { key: "cncTrimHeight", label: "CNC Trim Height", category: "Calculated" },
  { key: "totalLinearMeters", label: "Total Linear Meters", category: "Calculated" },
  { key: "totalSquareMeters", label: "Total Square Meters", category: "Calculated" },
  { key: "lippingLinearMeters", label: "Lipping Linear Meters", category: "Calculated" },
  { key: "facingSquareMeters", label: "Facing Square Meters", category: "Calculated" },
  { key: "fullReference", label: "Full Reference", category: "Calculated" },
  { key: "calculatedField1", label: "Custom Calculation 1", category: "Calculated" },
  { key: "calculatedField2", label: "Custom Calculation 2", category: "Calculated" },
  { key: "calculatedField3", label: "Custom Calculation 3", category: "Calculated" },
  { key: "calculatedField4", label: "Custom Calculation 4", category: "Calculated" },
  { key: "calculatedField5", label: "Custom Calculation 5", category: "Calculated" },
];

const ALL_PROJECT_FIELDS = [
  { key: "mjsNumber", label: "MJS Number" },
  { key: "jobName", label: "Job Name" },
  { key: "clientName", label: "Client Name" },
  { key: "dateReceived", label: "Date Received" },
  { key: "dateRequired", label: "Date Required" },
  { key: "poNumber", label: "PO Number" },
  { key: "blanksStatus", label: "Blanks Status" },
  { key: "lippingsStatus", label: "Lippings Status" },
  { key: "facingsStatus", label: "Facings Status" },
  { key: "glassStatus", label: "Glass Status" },
  { key: "cassettesStatus", label: "Cassettes Status" },
  { key: "timbersStatus", label: "Timbers Status" },
  { key: "ironmongeryStatus", label: "Ironmongery Status" },
];

export default function FireDoorLineItemLayoutSettings() {
  const router = useRouter();
  const { toast } = useToast();
  const [layout, setLayout] = useState<LayoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    "Basic Info": true,
    "Calculated": true,
  });
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Basic Info");
  const [selectedProcess, setSelectedProcess] = useState<string>("");

  useEffect(() => {
    loadLayout();
  }, []);

  useEffect(() => {
    if (layout?.processes && layout.processes.length > 0 && !selectedProcess) {
      setSelectedProcess(layout.processes[0].code);
    }
  }, [layout, selectedProcess]);

  async function loadLayout() {
    setLoading(true);
    try {
      const data = await apiFetch<{ layout: LayoutConfig }>("/fire-door-line-item-layout");
      setLayout(data.layout);
    } catch (e: any) {
      console.error("Failed to load layout:", e);
      toast({
        title: "Error",
        description: "Failed to load layout configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveLayout() {
    if (!layout) return;
    
    setSaving(true);
    try {
      await apiFetch("/fire-door-line-item-layout", {
        method: "POST",
        json: { layout },
      });
      
      toast({
        title: "Success",
        description: "Layout configuration saved",
      });
    } catch (e: any) {
      console.error("Failed to save layout:", e);
      toast({
        title: "Error",
        description: "Failed to save layout configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleProjectField(processCode: string, key: string, property: "visible" | "editable") {
    if (!layout) return;
    
    setLayout({
      ...layout,
      processes: layout.processes.map(p =>
        p.code === processCode
          ? {
              ...p,
              projectFields: p.projectFields.map(f =>
                f.key === key ? { ...f, [property]: !f[property] } : f
              ),
            }
          : p
      ),
    });
  }

  function toggleLineItemField(processCode: string, key: string, property: "visible" | "editable") {
    if (!layout) return;
    
    setLayout({
      ...layout,
      processes: layout.processes.map(p =>
        p.code === processCode
          ? {
              ...p,
              lineItemFields: p.lineItemFields.map(f =>
                f.key === key ? { ...f, [property]: !f[property] } : f
              ),
            }
          : p
      ),
    });
  }

  function updateCncCalculation(field: "initialCncProgramUrl" | "finalCncTrimProgramUrl", value: string) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      cncCalculations: {
        ...layout.cncCalculations,
        [field]: value,
      },
    });
  }

  function updateFieldCalculation(fieldKey: string, formula: string) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      fieldCalculations: {
        ...layout.fieldCalculations,
        [fieldKey]: formula,
      },
    });
  }

  function addProcess() {
    if (!layout) return;
    
    const newCode = `PROCESS${layout.processes.length + 1}`;
    setLayout({
      ...layout,
      processes: [
        ...layout.processes,
        {
          code: newCode,
          name: `Process ${layout.processes.length + 1}`,
          projectFields: [],
          lineItemFields: [],
        },
      ],
    });
    setSelectedProcess(newCode);
  }

  function removeProcess(code: string) {
    if (!layout) return;
    
    const newProcesses = layout.processes.filter(p => p.code !== code);
    setLayout({
      ...layout,
      processes: newProcesses,
    });
    
    if (selectedProcess === code && newProcesses.length > 0) {
      setSelectedProcess(newProcesses[0].code);
    }
  }

  function updateProcessName(code: string, name: string) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      processes: layout.processes.map(p =>
        p.code === code ? { ...p, name } : p
      ),
    });
  }

  function addLineItemField(processCode: string, fieldDef: typeof ALL_LINE_ITEM_FIELDS[0]) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      processes: layout.processes.map(p =>
        p.code === processCode
          ? {
              ...p,
              lineItemFields: [
                ...p.lineItemFields,
                { key: fieldDef.key, label: fieldDef.label, visible: true, editable: false },
              ],
            }
          : p
      ),
    });
  }

  function removeLineItemField(processCode: string, key: string) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      processes: layout.processes.map(p =>
        p.code === processCode
          ? {
              ...p,
              lineItemFields: p.lineItemFields.filter(f => f.key !== key),
            }
          : p
      ),
    });
  }

  function addProjectField(processCode: string, fieldDef: typeof ALL_PROJECT_FIELDS[0]) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      processes: layout.processes.map(p =>
        p.code === processCode
          ? {
              ...p,
              projectFields: [
                ...p.projectFields,
                { key: fieldDef.key, label: fieldDef.label, visible: true, editable: false },
              ],
            }
          : p
      ),
    });
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading layout configuration...</div>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="p-8">
        <div className="text-center text-destructive">Failed to load layout configuration</div>
      </div>
    );
  }

  const categories = Array.from(new Set(ALL_LINE_ITEM_FIELDS.map(f => f.category)));
  
  // Get current process's fields
  const currentProcess = layout.processes?.find(p => p.code === selectedProcess);
  const currentProcessFields = currentProcess?.lineItemFields || [];
  const currentProjectFields = currentProcess?.projectFields || [];
  
  const availableLineItemFields = ALL_LINE_ITEM_FIELDS.filter(
    f => !currentProcessFields.some(lf => lf.key === f.key)
  );
  const availableProjectFields = ALL_PROJECT_FIELDS.filter(
    f => !currentProjectFields.some(pf => pf.key === f.key)
  );

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
              <h1 className="text-xl font-bold">Line Item Layout Configuration</h1>
            </div>
            <Button onClick={saveLayout} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* CNC Program URL Calculations */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">CNC Program URL Calculations</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="initialCnc" className="mb-2 block">
                Initial CNC Program URL
              </Label>
              <Input
                id="initialCnc"
                value={layout.cncCalculations?.initialCncProgramUrl || ""}
                onChange={(e) => updateCncCalculation("initialCncProgramUrl", e.target.value)}
                placeholder="https://cnc.example.com/program/${lineItem.doorRef}"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 py-0.5 rounded">{'${lineItem.fieldName}'}</code> or{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{'${project.fieldName}'}</code> for dynamic values
              </p>
            </div>
            <div>
              <Label htmlFor="finalCnc" className="mb-2 block">
                Final CNC Trim Program URL
              </Label>
              <Input
                id="finalCnc"
                value={layout.cncCalculations?.finalCncTrimProgramUrl || ""}
                onChange={(e) => updateCncCalculation("finalCncTrimProgramUrl", e.target.value)}
                placeholder="https://cnc.example.com/trim/${lineItem.doorRef}"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  {'https://cnc.example.com/program?door=${lineItem.doorRef}&width=${lineItem.masterWidth}'}
                </code>
              </p>
            </div>
          </div>
        </Card>

        {/* Field Calculations */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Field Calculations</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const customFieldCount = ALL_LINE_ITEM_FIELDS.filter(f => 
                    f.key.startsWith('calculatedField')
                  ).length;
                  const newFieldKey = `calculatedField${customFieldCount + 1}`;
                  const newFieldLabel = `Custom Calculation ${customFieldCount + 1}`;
                  
                  // Add to ALL_LINE_ITEM_FIELDS dynamically
                  ALL_LINE_ITEM_FIELDS.push({
                    key: newFieldKey,
                    label: newFieldLabel,
                    category: "Calculated"
                  });
                  
                  // Force re-render
                  setLayout({ ...layout! });
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Calculated Field
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Group fields by category */}
            {Object.entries(
              ALL_LINE_ITEM_FIELDS.reduce((acc, field) => {
                if (!acc[field.category]) acc[field.category] = [];
                acc[field.category].push(field);
                return acc;
              }, {} as { [key: string]: typeof ALL_LINE_ITEM_FIELDS })
            ).map(([category, fields]) => (
              <div key={category} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedCategories({
                    ...expandedCategories,
                    [category]: !expandedCategories[category]
                  })}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{category}</span>
                    <span className="text-xs text-muted-foreground">
                      ({fields.filter(f => layout?.fieldCalculations?.[f.key]).length}/{fields.length} configured)
                    </span>
                  </div>
                  {expandedCategories[category] ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                
                {expandedCategories[category] && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={`calc-${field.key}`} className="flex items-center gap-2">
                            <span className="text-sm">{field.label}</span>
                            {layout?.fieldCalculations?.[field.key] && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                Active
                              </span>
                            )}
                          </Label>
                          <Input
                            id={`calc-${field.key}`}
                            value={layout?.fieldCalculations?.[field.key] || ""}
                            onChange={(e) => updateFieldCalculation(field.key, e.target.value)}
                            placeholder="e.g., ${lineItem.masterWidth} - 6"
                            className="font-mono text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Formula Examples */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Formula Examples:</h3>
            <div className="space-y-2">
              <div className="text-xs">
                <strong>Math Operations:</strong>
                <ul className="ml-4 mt-1 space-y-1 text-muted-foreground">
                  <li><code className="bg-white px-1 py-0.5 rounded">{'${lineItem.masterWidth} - 6'}</code> - Subtract constant</li>
                  <li><code className="bg-white px-1 py-0.5 rounded">{'${lineItem.doorHeight} - (${lineItem.top} + ${lineItem.btm})'}</code> - Complex calculation</li>
                  <li><code className="bg-white px-1 py-0.5 rounded">{'${lineItem.masterWidth} * 2 + ${lineItem.slaveWidth}'}</code> - Multiple operations</li>
                </ul>
              </div>
              <div className="text-xs">
                <strong>String Concatenation:</strong>
                <ul className="ml-4 mt-1 space-y-1 text-muted-foreground">
                  <li><code className="bg-white px-1 py-0.5 rounded">{'${project.mjsNumber}-${lineItem.doorRef}'}</code> - Join with dash</li>
                </ul>
              </div>
              <div className="text-xs">
                <strong>Lookup Tables:</strong>
                <ul className="ml-4 mt-1 space-y-1 text-muted-foreground">
                  <li><code className="bg-white px-1 py-0.5 rounded">{'LOOKUP(FireCertificationRule, rating=${lineItem.rating}, certification)'}</code> - Get certification from rating</li>
                  <li><code className="bg-white px-1 py-0.5 rounded">{'LOOKUP(WeightLookup, width=${lineItem.masterWidth}, weight)'}</code> - Get weight from dimensions</li>
                  <li><code className="bg-white px-1 py-0.5 rounded">{'LOOKUP(PricingTable, material=${lineItem.material}&rating=${lineItem.rating}, price)'}</code> - Multi-condition lookup</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Global Options */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Display Options</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="hideBlank">Hide blank fields</Label>
              <Switch
                id="hideBlank"
                checked={layout.hideBlankFields}
                onCheckedChange={(checked) =>
                  setLayout({ ...layout, hideBlankFields: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="groupByCategory">Group fields by category</Label>
              <Switch
                id="groupByCategory"
                checked={layout.groupByCategory}
                onCheckedChange={(checked) =>
                  setLayout({ ...layout, groupByCategory: checked })
                }
              />
            </div>
          </div>
        </Card>

        {/* Process Management */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Process Configuration</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="flex-shrink-0">Current Process:</Label>
              <div className="flex gap-2 flex-1">
                {layout.processes?.map((process) => (
                  <Button
                    key={process.code}
                    variant={selectedProcess === process.code ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedProcess(process.code)}
                  >
                    {process.name}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addProcess}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Process
                </Button>
              </div>
            </div>
            
            {currentProcess && (
              <div className="flex gap-2 items-center pt-2 border-t">
                <Label htmlFor="processName">Process Name:</Label>
                <Input
                  id="processName"
                  value={currentProcess.name}
                  onChange={(e) => updateProcessName(currentProcess.code, e.target.value)}
                  className="max-w-xs"
                />
                {layout.processes && layout.processes.length > 1 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeProcess(currentProcess.code)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Process
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {!currentProcess && (
          <Card className="p-6">
            <p className="text-center text-muted-foreground">
              No process selected. Please add a process to configure fields.
            </p>
          </Card>
        )}

        {currentProcess && (
          <>
            {/* Project Fields */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Project Fields for {currentProcess.name}</h2>
              </div>
              
              <div className="space-y-2 mb-4">
                {currentProjectFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="font-medium">{field.label}</span>
                      <span className="text-xs text-muted-foreground">({field.key})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`${currentProcess.code}-${field.key}-visible`}
                          checked={field.visible}
                          onCheckedChange={() => toggleProjectField(currentProcess.code, field.key, "visible")}
                        />
                        <Label htmlFor={`${currentProcess.code}-${field.key}-visible`} className="text-sm">
                          Visible
                        </Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLayout({
                            ...layout,
                            processes: layout.processes.map(p =>
                              p.code === currentProcess.code
                                ? { ...p, projectFields: p.projectFields.filter(f => f.key !== field.key) }
                                : p
                            ),
                          });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {availableProjectFields.length > 0 && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 block">Add Project Field</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableProjectFields.map((field) => (
                      <Button
                        key={field.key}
                        variant="outline"
                        size="sm"
                        onClick={() => addProjectField(currentProcess.code, field)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {field.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Line Item Fields */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Line Item Fields for {currentProcess.name}</h2>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
              
              <div className="space-y-2 mb-4">
                {currentProcessFields
                  .filter(field => {
                    const fieldDef = ALL_LINE_ITEM_FIELDS.find(f => f.key === field.key);
                    return !selectedCategory || fieldDef?.category === selectedCategory;
                  })
                  .map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="font-medium">{field.label}</span>
                        <span className="text-xs text-muted-foreground">({field.key})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${currentProcess.code}-${field.key}-visible`}
                            checked={field.visible}
                            onCheckedChange={() => toggleLineItemField(currentProcess.code, field.key, "visible")}
                          />
                          <Label htmlFor={`${currentProcess.code}-${field.key}-visible`} className="text-sm">
                            Visible
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${currentProcess.code}-${field.key}-editable`}
                            checked={field.editable}
                            onCheckedChange={() => toggleLineItemField(currentProcess.code, field.key, "editable")}
                          />
                          <Label htmlFor={`${currentProcess.code}-${field.key}-editable`} className="text-sm">
                            Editable
                          </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItemField(currentProcess.code, field.key)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>

              {availableLineItemFields.filter(f => f.category === selectedCategory).length > 0 && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 block">
                    Add {selectedCategory} Field
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {availableLineItemFields
                      .filter(f => f.category === selectedCategory)
                      .map((field) => (
                        <Button
                          key={field.key}
                          variant="outline"
                          size="sm"
                          onClick={() => addLineItemField(currentProcess.code, field)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {field.label}
                        </Button>
                      ))}
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
