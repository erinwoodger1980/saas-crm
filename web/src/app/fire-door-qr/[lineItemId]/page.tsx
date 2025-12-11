"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Upload, Settings, QrCode } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import QRCodeReact from "react-qr-code";

// Import the timer component
import WorkshopTimer from "@/components/workshop/WorkshopTimer";

interface ScanData {
  lineItemId: string;
  processName: string | null;
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
    initialCncProgramUrl?: string | null;
    finalCncTrimProgramUrl?: string | null;
  };
}

const STORAGE_KEY = "fire-door-qr-selected-process";

export default function WorkshopScanPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const lineItemId = params?.lineItemId as string;
  const queryProcess = searchParams?.get("process");
  const { toast } = useToast();

  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [processes, setProcesses] = useState<Array<{ code: string; name: string }>>([]);
  const [selectedProcess, setSelectedProcess] = useState<string>("");
  const [showProcessSelector, setShowProcessSelector] = useState(false);

  // Load selected process from localStorage on mount
  useEffect(() => {
    const savedProcess = localStorage.getItem(STORAGE_KEY);
    if (queryProcess) {
      setSelectedProcess(queryProcess);
      localStorage.setItem(STORAGE_KEY, queryProcess);
    } else if (savedProcess) {
      setSelectedProcess(savedProcess);
    } else {
      setShowProcessSelector(true);
    }
  }, [queryProcess]);

  useEffect(() => {
    if (lineItemId) {
      loadProjects();
      loadProcesses();
    }
  }, [lineItemId]);

  // Load scan data when process is selected
  useEffect(() => {
    if (lineItemId && selectedProcess && !showProcessSelector) {
      loadScanData();
    }
  }, [lineItemId, selectedProcess, showProcessSelector]);

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
      const url = selectedProcess 
        ? `/fire-door-qr/scan/${lineItemId}?process=${selectedProcess}`
        : `/fire-door-qr/scan/${lineItemId}`;
      
      const data = await apiFetch<{ ok: boolean; data: ScanData }>(url);
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

  function handleProcessSelection(process: string) {
    setSelectedProcess(process);
    localStorage.setItem(STORAGE_KEY, process);
    setShowProcessSelector(false);
  }

  function changeProcess() {
    setShowProcessSelector(true);
  }

  async function markComplete() {
    if (!scanData || !selectedProcess) return;
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

      // Mark process complete
      await apiFetch(`/fire-door-qr/scan/${lineItemId}?process=${selectedProcess}`, {
        method: "POST",
        body: JSON.stringify({
          completed: true,
          photos: photoUrls,
        }),
      });

      toast({
        title: "Success",
        description: `${selectedProcess} marked as complete`,
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

  // Show process selector if no process selected
  if (showProcessSelector) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full">
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Select Your Process</h1>
              <p className="text-muted-foreground">
                Choose the process you're working on. This will be remembered for future scans.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Process</label>
              <Select value={selectedProcess} onValueChange={handleProcessSelection}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select process..." />
                </SelectTrigger>
                <SelectContent>
                  {processes.map((p) => (
                    <SelectItem key={p.code} value={p.code} className="text-base py-3">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProcess && (
              <Button 
                onClick={() => setShowProcessSelector(false)} 
                className="w-full" 
                size="lg"
              >
                Continue with {processes.find(p => p.code === selectedProcess)?.name}
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
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

  const processName = processes.find(p => p.code === selectedProcess)?.name || selectedProcess;
  const isCncProcess = selectedProcess.toLowerCase().includes('cnc');

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
            <div className="flex items-center justify-between gap-2">
              <div className="text-lg font-semibold text-primary">
                {processName}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = `/fire-door-line-item-layout/${lineItemId}`}
                >
                  View Full Details
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={changeProcess}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Change Process
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Project: {scanData.projectName}
            </div>
          </div>
        </Card>

        {/* CNC Program QR Codes */}
        {isCncProcess && (scanData.lineItemData.initialCncProgramUrl || scanData.lineItemData.finalCncTrimProgramUrl) && (
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              CNC Program QR Codes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scanData.lineItemData.initialCncProgramUrl && (
                <div className="space-y-2">
                  <div className="font-medium text-sm text-center">Initial CNC Program</div>
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <QRCodeReact
                      value={scanData.lineItemData.initialCncProgramUrl}
                      size={200}
                      className="mx-auto"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-center break-all">
                    {scanData.lineItemData.initialCncProgramUrl}
                  </div>
                </div>
              )}
              {scanData.lineItemData.finalCncTrimProgramUrl && (
                <div className="space-y-2">
                  <div className="font-medium text-sm text-center">Final CNC Trim</div>
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <QRCodeReact
                      value={scanData.lineItemData.finalCncTrimProgramUrl}
                      size={200}
                      className="mx-auto"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-center break-all">
                    {scanData.lineItemData.finalCncTrimProgramUrl}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

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
