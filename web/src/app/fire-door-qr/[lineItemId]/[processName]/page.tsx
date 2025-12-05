"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Upload, Play, Square, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Import the timer component
import WorkshopTimer, { WorkshopTimerHandle } from "@/components/workshop/WorkshopTimer";

interface ScanData {
  lineItemId: string;
  processName: string;
  doorRef: string | null;
  lajRef: string | null;
  projectName: string;
  config: {
    fieldsToShow: string[];
    customInstructions: string | null;
  };
  lineItemData: {
    rating?: string;
    doorsetType?: string;
    finish?: string;
    width?: number;
    height?: number;
    thickness?: number;
    lockType?: string;
    hingeQty?: number;
    hingeSide?: string;
    glazingType?: string;
    notes?: string;
  };
}

export default function WorkshopScanPage() {
  const params = useParams();
  const lineItemId = params?.lineItemId as string;
  const processName = params?.processName as string;
  const { toast } = useToast();

  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [processes, setProcesses] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    if (lineItemId && processName) {
      loadScanData();
      loadProjects();
      loadProcesses();
    }
  }, [lineItemId, processName]);

  async function loadProjects() {
    try {
      const data = await apiFetch<{ ok: boolean; opportunities: any[] }>("/opportunities?status=WON");
      if (data.ok) {
        setProjects(
          data.opportunities.map((opp: any) => ({
            id: opp.id,
            title: opp.lead?.name || "Untitled",
          }))
        );
      }
    } catch (e: any) {
      console.error("Failed to load projects:", e);
    }
  }

  async function loadProcesses() {
    try {
      const data = await apiFetch<{ ok: boolean; processes: any[] }>("/workshop/processes");
      if (data.ok) {
        setProcesses(
          data.processes.map((p: any) => ({
            code: p.code,
            name: p.name,
          }))
        );
      }
    } catch (e: any) {
      console.error("Failed to load processes:", e);
    }
  }

  async function loadScanData() {
    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; data: ScanData }>(
        `/fire-door-qr/scan/${lineItemId}/${processName}`
      );
      if (data.ok) {
        setScanData(data.data);
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to load scan data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function markComplete() {
    if (!scanData) return;
    setMarking(true);
    try {
      // Upload photos if any
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("file", photo);
        const uploadResult = await apiFetch<{ ok: boolean; url: string }>(
          "/upload",
          {
            method: "POST",
            body: formData,
          }
        );
        if (uploadResult.ok) {
          photoUrls.push(uploadResult.url);
        }
      }

      // Mark process complete (this would update the line item or process assignment)
      await apiFetch(`/fire-door-qr/scan/${lineItemId}/${processName}`, {
        method: "POST",
        body: JSON.stringify({
          completed: true,
          photos: photoUrls,
        }),
      });

      toast({
        title: "Success",
        description: `${processName} marked as complete`,
      });

      // Refresh data
      loadScanData();
      setPhotos([]);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to mark complete",
        variant: "destructive",
      });
    } finally {
      setMarking(false);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setPhotos([...photos, ...Array.from(e.target.files)]);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!scanData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-xl font-semibold">Scan data not found</div>
          <div className="text-muted-foreground">
            This QR code may be invalid or expired
          </div>
        </div>
      </div>
    );
  }

  const fieldLabels: Record<string, string> = {
    rating: "Fire Rating",
    doorsetType: "Doorset Type",
    finish: "Finish",
    width: "Width (mm)",
    height: "Height (mm)",
    thickness: "Thickness (mm)",
    lockType: "Lock Type",
    hingeQty: "Hinge Quantity",
    hingeSide: "Hinge Side",
    glazingType: "Glazing Type",
    notes: "Notes",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Timer Tracker at top */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <WorkshopTimer projects={projects} processes={processes} />
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Header */}
        <Card className="p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              {scanData.doorRef || scanData.lajRef || "Door"}
            </h1>
            <div className="text-lg font-semibold text-primary">
              {scanData.processName}
            </div>
            <div className="text-sm text-muted-foreground">
              Project: {scanData.projectName}
            </div>
          </div>
        </Card>

        {/* Custom Instructions */}
        {scanData.config.customInstructions && (
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="font-semibold mb-2">Instructions</div>
            <div className="whitespace-pre-wrap">
              {scanData.config.customInstructions}
            </div>
          </Card>
        )}

        {/* Door Specifications */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Door Specifications</h2>
          <div className="grid grid-cols-1 gap-3">
            {scanData.config.fieldsToShow.map((field) => {
              const value = scanData.lineItemData[field as keyof typeof scanData.lineItemData];
              if (!value) return null;
              return (
                <div key={field} className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-sm">{fieldLabels[field] || field}</span>
                  <span className="text-sm">{value}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Photo Upload */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Photos (Optional)</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
              <div className="flex flex-col items-center">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  Tap to upload photos
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>
            {photos.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {photos.length} photo(s) selected
              </div>
            )}
          </div>
        </Card>

        {/* Mark Complete Button */}
        <Button
          onClick={markComplete}
          disabled={marking}
          size="lg"
          className="w-full"
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          {marking ? "Marking Complete..." : "Mark Process Complete"}
        </Button>
      </div>
    </div>
  );
}
