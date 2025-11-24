"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

interface FireDoorProject {
  id: string;
  [key: string]: any;
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
      });
    }
  }, [id, isNew]);

  async function loadProject() {
    try {
      const data = await apiFetch<FireDoorProject>(`/fire-door-schedule/${id}`);
      setProject(data);
    } catch (error) {
      console.error("Error loading project:", error);
      toast({ title: "Error", description: "Failed to load project", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function saveProject() {
    if (!project) return;

    setSaving(true);
    try {
      if (isNew) {
        const { id: _, ...createData } = project;
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
        toast({ title: "Success", description: "Project updated successfully" });
      }
    } catch (error) {
      console.error("Error saving project:", error);
      toast({ title: "Error", description: "Failed to save project", variant: "destructive" });
    } finally {
      setSaving(false);
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
    setProject((prev) => (prev ? { ...prev, [field]: value } : null));
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p>Loading...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-8">
        <p>Project not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/fire-door-schedule")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isNew ? "New Project" : project.jobName || "Fire Door Project"}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? "Create a new fire door project" : `MJS# ${project.mjsNumber || "N/A"}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="destructive" onClick={deleteProject}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          <Button onClick={saveProject} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Form Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="design">Design & Sign-Off</TabsTrigger>
          <TabsTrigger value="bom">BOM & Ordering</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="paperwork">Paperwork</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
              <CardDescription>Basic project information and client details</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>MJS Number</Label>
                <Input
                  value={project.mjsNumber || ""}
                  onChange={(e) => updateField("mjsNumber", e.target.value)}
                  placeholder="e.g. mjs1936"
                />
              </div>
              <div className="space-y-2">
                <Label>Job Name</Label>
                <Input
                  value={project.jobName || ""}
                  onChange={(e) => updateField("jobName", e.target.value)}
                  placeholder="Project name"
                />
              </div>
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  value={project.clientName || ""}
                  onChange={(e) => updateField("clientName", e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-2">
                <Label>PO Number</Label>
                <Input
                  value={project.poNumber || ""}
                  onChange={(e) => updateField("poNumber", e.target.value)}
                  placeholder="Purchase order number"
                />
              </div>
              <div className="space-y-2">
                <Label>LAQ Number</Label>
                <Input
                  value={project.laqNumber || ""}
                  onChange={(e) => updateField("laqNumber", e.target.value)}
                  placeholder="LAQ reference"
                />
              </div>
              <div className="space-y-2">
                <Label>Date Received</Label>
                <Input
                  type="date"
                  value={project.dateReceived ? new Date(project.dateReceived).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateField("dateReceived", e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date Required</Label>
                <Input
                  type="date"
                  value={project.dateRequired ? new Date(project.dateRequired).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateField("dateRequired", e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Job Location</Label>
                <Select value={project.jobLocation || ""} onValueChange={(v) => updateField("jobLocation", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RED FOLDER">Red Folder</SelectItem>
                    <SelectItem value="IN PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETE">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Design & Sign-Off Tab */}
        <TabsContent value="design">
          <Card>
            <CardHeader>
              <CardTitle>Design & Sign-Off</CardTitle>
              <CardDescription>Schedule approval and design workflow</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Sign Off Status</Label>
                <Select value={project.signOffStatus || ""} onValueChange={(v) => updateField("signOffStatus", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AWAITING SCHEDULE">Awaiting Schedule</SelectItem>
                    <SelectItem value="NOT LOOKED AT">Not Looked At</SelectItem>
                    <SelectItem value="WORKING ON SCHEDULE">Working on Schedule</SelectItem>
                    <SelectItem value="SCHEDULE SENT FOR SIGN OFF">Schedule Sent for Sign Off</SelectItem>
                    <SelectItem value="SCHEDULE SIGNED OFF">Schedule Signed Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sign Off Date</Label>
                <Input
                  type="date"
                  value={project.signOffDate ? new Date(project.signOffDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateField("signOffDate", e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Scheduled By</Label>
                <Select value={project.scheduledBy || ""} onValueChange={(v) => updateField("scheduledBy", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DARREN">Darren</SelectItem>
                    <SelectItem value="DAVE">Dave</SelectItem>
                    <SelectItem value="STEVE">Steve</SelectItem>
                    <SelectItem value="PAUL">Paul</SelectItem>
                    <SelectItem value="DAN">Dan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lead Time (weeks)</Label>
                <Input
                  type="number"
                  value={project.leadTimeWeeks || ""}
                  onChange={(e) => updateField("leadTimeWeeks", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Approx Delivery Date</Label>
                <Input
                  type="date"
                  value={project.approxDeliveryDate ? new Date(project.approxDeliveryDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateField("approxDeliveryDate", e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Working Days Remaining</Label>
                <Input
                  type="number"
                  value={project.workingDaysRemaining || ""}
                  onChange={(e) => updateField("workingDaysRemaining", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOM & Ordering Tab */}
        <TabsContent value="bom">
          <Card>
            <CardHeader>
              <CardTitle>BOM & Ordering</CardTitle>
              <CardDescription>Materials procurement and BOM verification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Ordering Status</Label>
                <Select value={project.orderingStatus || ""} onValueChange={(v) => updateField("orderingStatus", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT IN BOM">Not in BOM</SelectItem>
                    <SelectItem value="IN BOM TBC">In BOM TBC</SelectItem>
                    <SelectItem value="IN BOM">In BOM</SelectItem>
                    <SelectItem value="STOCK">Stock</SelectItem>
                    <SelectItem value="ORDERED">Ordered</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="ORDERED CALL OFF">Ordered Call Off</SelectItem>
                    <SelectItem value="MAKE IN HOUSE">Make In House</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {["blanks", "lippings", "facings", "glass", "cassettes", "timbers", "ironmongery"].map((material) => (
                  <div key={material} className="space-y-3 p-4 border rounded-lg">
                    <Label className="capitalize">{material}</Label>
                    <Input
                      placeholder="Status"
                      value={project[`${material}Status`] || ""}
                      onChange={(e) => updateField(`${material}Status`, e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${material}Checked`}
                        checked={project[`${material}Checked`] || false}
                        onCheckedChange={(checked) => updateField(`${material}Checked`, checked)}
                      />
                      <Label htmlFor={`${material}Checked`} className="text-sm font-normal">
                        BOM Checked
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production">
          <Card>
            <CardHeader>
              <CardTitle>Production & QA</CardTitle>
              <CardDescription>Manufacturing progress tracking</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-6">
              {[
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
                "overallProgress",
              ].map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field.replace("Percent", "").replace(/([A-Z])/g, " $1").trim()} (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={project[field] || ""}
                    onChange={(e) => updateField(field, e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Paperwork Tab */}
        <TabsContent value="paperwork">
          <Card>
            <CardHeader>
              <CardTitle>Paperwork & Certification</CardTitle>
              <CardDescription>Documentation and compliance tracking</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Paperwork Status</Label>
                <Select value={project.paperworkStatus || ""} onValueChange={(v) => updateField("paperworkStatus", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="N/A">N/A</SelectItem>
                    <SelectItem value="WORKING ON SCHEDULE">Working on Schedule</SelectItem>
                    <SelectItem value="READY TO PRINT IN OFFICE">Ready to Print</SelectItem>
                    <SelectItem value="PRINTED IN OFFICE">Printed in Office</SelectItem>
                    <SelectItem value="TAKEN OUT TO FACTORY">Taken to Factory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Door Paperwork</Label>
                <Input
                  value={project.doorPaperworkStatus || ""}
                  onChange={(e) => updateField("doorPaperworkStatus", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Final CNC Sheet</Label>
                <Input
                  value={project.finalCncSheetStatus || ""}
                  onChange={(e) => updateField("finalCncSheetStatus", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Final Checks Sheet</Label>
                <Input
                  value={project.finalChecksSheetStatus || ""}
                  onChange={(e) => updateField("finalChecksSheetStatus", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Checklist</Label>
                <Input
                  value={project.deliveryChecklistStatus || ""}
                  onChange={(e) => updateField("deliveryChecklistStatus", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Frames Paperwork</Label>
                <Input
                  value={project.framesPaperworkStatus || ""}
                  onChange={(e) => updateField("framesPaperworkStatus", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Certification Required</Label>
                <Input
                  value={project.certificationRequired || ""}
                  onChange={(e) => updateField("certificationRequired", e.target.value)}
                  placeholder="e.g. Q Mark"
                />
              </div>
              <div className="space-y-2 flex items-center gap-2 pt-8">
                <Checkbox
                  id="fscRequired"
                  checked={project.fscRequired || false}
                  onCheckedChange={(checked) => updateField("fscRequired", checked)}
                />
                <Label htmlFor="fscRequired">FSC Certification Required</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle>Delivery & Installation</CardTitle>
              <CardDescription>Logistics and site work tracking</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Transport Status</Label>
                <Input
                  value={project.transportStatus || ""}
                  onChange={(e) => updateField("transportStatus", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Date</Label>
                <Input
                  type="date"
                  value={project.deliveryDate ? new Date(project.deliveryDate).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateField("deliveryDate", e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Install Start</Label>
                <Input
                  type="date"
                  value={project.installStart ? new Date(project.installStart).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateField("installStart", e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Install End</Label>
                <Input
                  type="date"
                  value={project.installEnd ? new Date(project.installEnd).toISOString().split("T")[0] : ""}
                  onChange={(e) => updateField("installEnd", e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Snagging Status</Label>
                <Input
                  value={project.snaggingStatus || ""}
                  onChange={(e) => updateField("snaggingStatus", e.target.value)}
                />
              </div>
              <div className="space-y-2 flex items-center gap-2 pt-8">
                <Checkbox
                  id="snaggingComplete"
                  checked={project.snaggingComplete || false}
                  onCheckedChange={(checked) => updateField("snaggingComplete", checked)}
                />
                <Label htmlFor="snaggingComplete">Snagging Complete</Label>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Snagging Notes</Label>
                <Textarea
                  value={project.snaggingNotes || ""}
                  onChange={(e) => updateField("snaggingNotes", e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Communication & Notes</CardTitle>
              <CardDescription>Internal and external communication notes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Communication Notes</Label>
                <Textarea
                  value={project.communicationNotes || ""}
                  onChange={(e) => updateField("communicationNotes", e.target.value)}
                  rows={4}
                  placeholder="External communication notes"
                />
              </div>
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea
                  value={project.internalNotes || ""}
                  onChange={(e) => updateField("internalNotes", e.target.value)}
                  rows={4}
                  placeholder="Internal team notes"
                />
              </div>
              <div className="space-y-2">
                <Label>Paperwork Comments</Label>
                <Textarea
                  value={project.paperworkComments || ""}
                  onChange={(e) => updateField("paperworkComments", e.target.value)}
                  rows={4}
                  placeholder="Notes about paperwork"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Toaster />
    </div>
  );
}
