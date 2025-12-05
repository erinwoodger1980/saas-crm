"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, Plus, Save, Settings } from "lucide-react";

interface ProcessQRConfig {
  id: string;
  processName: string;
  displayFields: string[];
  instructions: string | null;
}

const AVAILABLE_FIELDS = [
  { value: "doorRef", label: "Door Reference" },
  { value: "lajRef", label: "LAJ Reference" },
  { value: "certification", label: "Certification" },
  { value: "doorsetType", label: "Doorset Type" },
  { value: "rating", label: "Fire Rating" },
  { value: "coreType", label: "Core Type" },
  { value: "masterWidth", label: "Master Width" },
  { value: "slaveWidth", label: "Slave Width" },
  { value: "doorHeight", label: "Door Height" },
  { value: "material", label: "Material" },
  { value: "doorFinish", label: "Door Finish" },
  { value: "handing", label: "Handing" },
  { value: "hingeType", label: "Hinge Type" },
  { value: "lockType", label: "Lock Type" },
  { value: "notes1", label: "Notes 1" },
  { value: "notes2", label: "Notes 2" },
];

const WORKSHOP_PROCESSES = [
  "Cutting",
  "Lipping",
  "Edging",
  "Facing",
  "Calibration",
  "Finishing",
  "Machining",
  "Glazing",
  "Assembly",
  "Packing",
];

export default function FireDoorQRManagementPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ProcessQRConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProcess, setEditingProcess] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    processName: string;
    displayFields: string[];
    instructions: string;
  }>({
    processName: "",
    displayFields: [],
    instructions: "",
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; configs: ProcessQRConfig[] }>(
        "/fire-door-qr/process-configs"
      );
      if (data.ok) {
        setConfigs(data.configs);
      }
    } catch (e: any) {
      toast({
        title: "Failed to load configs",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!editForm.processName) {
      toast({
        title: "Process name required",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = await apiFetch<{ ok: boolean; config: ProcessQRConfig }>(
        "/fire-door-qr/process-configs",
        {
          method: "POST",
          json: editForm,
        }
      );

      if (data.ok) {
        toast({
          title: "Configuration saved",
          description: `QR config for ${editForm.processName} has been updated`,
        });
        setEditingProcess(null);
        setEditForm({ processName: "", displayFields: [], instructions: "" });
        loadConfigs();
      }
    } catch (e: any) {
      toast({
        title: "Failed to save config",
        description: e.message,
        variant: "destructive",
      });
    }
  }

  function startEdit(config?: ProcessQRConfig) {
    if (config) {
      setEditForm({
        processName: config.processName,
        displayFields: config.displayFields,
        instructions: config.instructions || "",
      });
      setEditingProcess(config.processName);
    } else {
      setEditForm({ processName: "", displayFields: [], instructions: "" });
      setEditingProcess("new");
    }
  }

  function toggleField(field: string) {
    setEditForm((prev) => ({
      ...prev,
      displayFields: prev.displayFields.includes(field)
        ? prev.displayFields.filter((f) => f !== field)
        : [...prev.displayFields, field],
    }));
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <QrCode className="w-8 h-8" />
            Fire Door QR Code Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure what information to display when QR codes are scanned for each workshop process
          </p>
        </div>
        <Button onClick={() => startEdit()}>
          <Plus className="w-4 h-4 mr-2" />
          New Process Config
        </Button>
      </div>

      {loading ? (
        <div>Loading configurations...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Existing Configs */}
          {configs.map((config) => (
            <Card key={config.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{config.processName}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(config)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {config.displayFields.length} fields configured
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Displayed Fields:</div>
                  <div className="text-sm text-muted-foreground">
                    {config.displayFields.length > 0
                      ? config.displayFields
                          .map(
                            (f) =>
                              AVAILABLE_FIELDS.find((af) => af.value === f)
                                ?.label || f
                          )
                          .join(", ")
                      : "No fields selected"}
                  </div>
                  {config.instructions && (
                    <div className="mt-2">
                      <div className="text-sm font-medium">Instructions:</div>
                      <div className="text-sm text-muted-foreground">
                        {config.instructions}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Unconfigured Processes */}
          {WORKSHOP_PROCESSES.filter(
            (p) => !configs.find((c) => c.processName === p)
          ).map((process) => (
            <Card key={process} className="border-dashed">
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  {process}
                </CardTitle>
                <CardDescription>Not configured</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditForm({
                      processName: process,
                      displayFields: [],
                      instructions: "",
                    });
                    setEditingProcess("new");
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingProcess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingProcess === "new" ? "New" : "Edit"} Process Configuration
              </CardTitle>
              <CardDescription>
                Configure what information to show when this process QR code is
                scanned
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Process Name */}
              <div className="space-y-2">
                <Label>Process Name</Label>
                {editingProcess === "new" ? (
                  <select
                    className="w-full border rounded-md p-2"
                    value={editForm.processName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, processName: e.target.value })
                    }
                  >
                    <option value="">Select a process...</option>
                    {WORKSHOP_PROCESSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value={editForm.processName} disabled />
                )}
              </div>

              {/* Display Fields */}
              <div className="space-y-2">
                <Label>Fields to Display</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
                  {AVAILABLE_FIELDS.map((field) => (
                    <div
                      key={field.value}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={field.value}
                        checked={editForm.displayFields.includes(field.value)}
                        onCheckedChange={() => toggleField(field.value)}
                      />
                      <label
                        htmlFor={field.value}
                        className="text-sm cursor-pointer"
                      >
                        {field.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <Label>Instructions (shown to workshop staff)</Label>
                <Textarea
                  value={editForm.instructions}
                  onChange={(e) =>
                    setEditForm({ ...editForm, instructions: e.target.value })
                  }
                  placeholder="e.g., Check grain direction before cutting, ensure all measurements are verified..."
                  rows={4}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingProcess(null);
                    setEditForm({
                      processName: "",
                      displayFields: [],
                      instructions: "",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveConfig}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
