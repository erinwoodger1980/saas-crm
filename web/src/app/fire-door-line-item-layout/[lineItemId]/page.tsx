"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Settings, Save } from "lucide-react";
import Link from "next/link";

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

interface LineItemData {
  lineItem: any;
  project: any;
  layout: LayoutConfig | null;
}

export default function FireDoorLineItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lineItemId = params?.lineItemId as string;
  
  const [data, setData] = useState<LineItemData | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lineItemId) {
      loadData();
    }
  }, [lineItemId]);

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
    projectFields: [
      { key: "mjsNumber", label: "MJS Number", visible: true, editable: false },
      { key: "jobName", label: "Job Name", visible: true, editable: false },
      { key: "clientName", label: "Client", visible: true, editable: false },
      { key: "dateRequired", label: "Date Required", visible: true, editable: false },
    ],
    lineItemFields: [
      { key: "doorRef", label: "Door Ref", visible: true, editable: false },
      { key: "rating", label: "Fire Rating", visible: true, editable: false },
      { key: "doorsetType", label: "Doorset Type", visible: true, editable: false },
      { key: "masterWidth", label: "Master Width", visible: true, editable: false },
      { key: "doorHeight", label: "Door Height", visible: true, editable: false },
      { key: "material", label: "Material", visible: true, editable: false },
      { key: "notes1", label: "Notes", visible: true, editable: true },
    ],
    hideBlankFields: true,
    groupByCategory: true,
  };

  const activeLayout = layout || defaultLayout;
  const hasEdits = Object.keys(editedValues).length > 0;

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
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Project Information */}
        {activeLayout.projectFields.some(f => f.visible) && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Project Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeLayout.projectFields.map(field =>
                renderField(field, project?.[field.key], "project")
              )}
            </div>
          </Card>
        )}

        {/* Line Item Details */}
        {activeLayout.lineItemFields.some(f => f.visible) && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Line Item Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeLayout.lineItemFields.map(field =>
                renderField(field, lineItem[field.key], "lineItem")
              )}
            </div>
          </Card>
        )}

        {/* Additional Categories (if grouping is enabled) */}
        {activeLayout.groupByCategory && (
          <>
            {/* Core Specifications */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Core Specifications</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: "core", label: "Core", visible: true, editable: false },
                  { key: "coreType", label: "Core Type", visible: true, editable: false },
                  { key: "top", label: "Top", visible: true, editable: false },
                  { key: "btm", label: "Bottom", visible: true, editable: false },
                  { key: "hinge", label: "Hinge", visible: true, editable: false },
                  { key: "me", label: "ME", visible: true, editable: false },
                ].map(field =>
                  renderField(field as FieldConfig, lineItem[field.key], "lineItem")
                )}
              </div>
            </Card>

            {/* Ironmongery */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Ironmongery</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: "qtyOfHinges", label: "Qty of Hinges", visible: true, editable: false },
                  { key: "hingeType", label: "Hinge Type", visible: true, editable: false },
                  { key: "lockType", label: "Lock Type", visible: true, editable: false },
                  { key: "lockHeight", label: "Lock Height", visible: true, editable: false },
                  { key: "flushBolt", label: "Flush Bolt", visible: true, editable: false },
                ].map(field =>
                  renderField(field as FieldConfig, lineItem[field.key], "lineItem")
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
