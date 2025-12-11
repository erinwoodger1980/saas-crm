"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

interface FieldConfig {
  key: string;
  label: string;
  visible: boolean;
  editable: boolean;
}

interface LayoutConfig {
  projectFields: FieldConfig[];
  lineItemFields: FieldConfig[];
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
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Basic Info");

  useEffect(() => {
    loadLayout();
  }, []);

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

  function toggleProjectField(key: string, property: "visible" | "editable") {
    if (!layout) return;
    
    setLayout({
      ...layout,
      projectFields: layout.projectFields.map(f =>
        f.key === key ? { ...f, [property]: !f[property] } : f
      ),
    });
  }

  function toggleLineItemField(key: string, property: "visible" | "editable") {
    if (!layout) return;
    
    setLayout({
      ...layout,
      lineItemFields: layout.lineItemFields.map(f =>
        f.key === key ? { ...f, [property]: !f[property] } : f
      ),
    });
  }

  function addLineItemField(fieldDef: typeof ALL_LINE_ITEM_FIELDS[0]) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      lineItemFields: [
        ...layout.lineItemFields,
        { key: fieldDef.key, label: fieldDef.label, visible: true, editable: false },
      ],
    });
  }

  function removeLineItemField(key: string) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      lineItemFields: layout.lineItemFields.filter(f => f.key !== key),
    });
  }

  function addProjectField(fieldDef: typeof ALL_PROJECT_FIELDS[0]) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      projectFields: [
        ...layout.projectFields,
        { key: fieldDef.key, label: fieldDef.label, visible: true, editable: false },
      ],
    });
  }

  function removeProjectField(key: string) {
    if (!layout) return;
    
    setLayout({
      ...layout,
      projectFields: layout.projectFields.filter(f => f.key !== key),
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
  const availableLineItemFields = ALL_LINE_ITEM_FIELDS.filter(
    f => !layout.lineItemFields.some(lf => lf.key === f.key)
  );
  const availableProjectFields = ALL_PROJECT_FIELDS.filter(
    f => !layout.projectFields.some(pf => pf.key === f.key)
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

        {/* Project Fields */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Project Fields</h2>
          </div>
          
          <div className="space-y-2 mb-4">
            {layout.projectFields.map((field) => (
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
                      id={`${field.key}-visible`}
                      checked={field.visible}
                      onCheckedChange={() => toggleProjectField(field.key, "visible")}
                    />
                    <Label htmlFor={`${field.key}-visible`} className="text-sm">
                      Visible
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeProjectField(field.key)}
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
                    onClick={() => addProjectField(field)}
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
            <h2 className="text-lg font-semibold">Line Item Fields</h2>
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
            {layout.lineItemFields
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
                        id={`${field.key}-visible`}
                        checked={field.visible}
                        onCheckedChange={() => toggleLineItemField(field.key, "visible")}
                      />
                      <Label htmlFor={`${field.key}-visible`} className="text-sm">
                        Visible
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${field.key}-editable`}
                        checked={field.editable}
                        onCheckedChange={() => toggleLineItemField(field.key, "editable")}
                      />
                      <Label htmlFor={`${field.key}-editable`} className="text-sm">
                        Editable
                      </Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLineItemField(field.key)}
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
                      onClick={() => addLineItemField(field)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {field.label}
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
