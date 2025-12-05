"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, CheckCircle2, AlertTriangle, Info } from "lucide-react";

interface DoorItemData {
  id: string;
  doorRef: string | null;
  rating: string | null;
  doorsetType: string | null;
  finish: string | null;
  location: string | null;
  installationDate: Date | null;
  lastMaintenanceDate: Date | null;
  nextMaintenanceDate: Date | null;
  maintenanceNotes: string | null;
  fittingInstructions: string | null;
  installerNotes: string | null;
  project: {
    name: string;
  };
  client: {
    name: string;
    address: string | null;
  } | null;
  maintenanceHistory: Array<{
    id: string;
    performedAt: Date;
    performedByName: string;
    findings: string | null;
    actionsTaken: string | null;
    photos: string[];
    nextDueDate: Date | null;
  }>;
}

export default function FireDoorMaintenancePage() {
  const params = useParams();
  const doorItemId = params?.doorItemId as string;

  const [doorData, setDoorData] = useState<DoorItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form fields
  const [performedBy, setPerformedBy] = useState("");
  const [findings, setFindings] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    if (doorItemId) {
      loadDoorData();
    }
  }, [doorItemId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  async function loadDoorData() {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/fire-door-qr/scan/maintenance/${doorItemId}`
      );
      const data = await response.json();
      if (data.ok) {
        setDoorData(data.data);
      } else {
        setToast({ message: data.message || "Failed to load door data", type: "error" });
      }
    } catch (e: any) {
      setToast({ message: e.message || "Failed to load door data", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!performedBy.trim()) {
      setToast({ message: "Please enter your name", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      // Upload photos first
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("file", photo);
        const uploadResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/upload`,
          {
            method: "POST",
            body: formData,
          }
        );
        const uploadResult = await uploadResponse.json();
        if (uploadResult.ok) {
          photoUrls.push(uploadResult.url);
        }
      }

      // Submit maintenance record
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/fire-door-qr/maintenance/${doorItemId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            performedByName: performedBy,
            findings: findings || null,
            actionsTaken: actionsTaken || null,
            photos: photoUrls,
            nextDueDate: nextDueDate || null,
          }),
        }
      );

      const result = await response.json();
      if (result.ok) {
        setToast({ message: "Maintenance record saved successfully", type: "success" });
        setShowForm(false);
        // Reset form
        setPerformedBy("");
        setFindings("");
        setActionsTaken("");
        setNextDueDate("");
        setPhotos([]);
        // Reload data
        loadDoorData();
      } else {
        setToast({ message: result.message || "Failed to save maintenance record", type: "error" });
      }
    } catch (e: any) {
      setToast({ message: e.message || "Failed to save maintenance record", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setPhotos([...photos, ...Array.from(e.target.files)]);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div>Loading...</div>
      </div>
    );
  }

  if (!doorData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto" />
          <div className="text-xl font-semibold">Door not found</div>
          <div className="text-muted-foreground">
            This QR code may be invalid or expired
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          toast.type === "success" ? "bg-green-500" : "bg-red-500"
        } text-white max-w-md`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">Fire Door Maintenance</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        {/* Door Info */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">{doorData.doorRef || "Fire Door"}</h2>
              <div className="text-sm text-muted-foreground">{doorData.project.name}</div>
            </div>
            {doorData.client && (
              <div>
                <div className="font-semibold">Client</div>
                <div className="text-sm">{doorData.client.name}</div>
                {doorData.client.address && (
                  <div className="text-sm text-muted-foreground">{doorData.client.address}</div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {doorData.rating && (
                <div>
                  <span className="font-medium">Rating:</span> {doorData.rating}
                </div>
              )}
              {doorData.doorsetType && (
                <div>
                  <span className="font-medium">Type:</span> {doorData.doorsetType}
                </div>
              )}
              {doorData.location && (
                <div>
                  <span className="font-medium">Location:</span> {doorData.location}
                </div>
              )}
              {doorData.installationDate && (
                <div>
                  <span className="font-medium">Installed:</span>{" "}
                  {new Date(doorData.installationDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Maintenance Schedule */}
        {(doorData.lastMaintenanceDate || doorData.nextMaintenanceDate) && (
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Maintenance Schedule</h3>
            <div className="space-y-2 text-sm">
              {doorData.lastMaintenanceDate && (
                <div>
                  <span className="font-medium">Last Maintenance:</span>{" "}
                  {new Date(doorData.lastMaintenanceDate).toLocaleDateString()}
                </div>
              )}
              {doorData.nextMaintenanceDate && (
                <div>
                  <span className="font-medium">Next Due:</span>{" "}
                  {new Date(doorData.nextMaintenanceDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Fitting Instructions */}
        {doorData.fittingInstructions && (
          <Card className="p-6 bg-blue-50 border-blue-200">
            <h3 className="font-semibold mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Fitting Instructions
            </h3>
            <div className="text-sm whitespace-pre-wrap">{doorData.fittingInstructions}</div>
          </Card>
        )}

        {/* Maintenance History */}
        {doorData.maintenanceHistory.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Maintenance History</h3>
            <div className="space-y-4">
              {doorData.maintenanceHistory.map((record) => (
                <div key={record.id} className="border-b pb-4 last:border-b-0">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">{record.performedByName}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(record.performedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {record.findings && (
                    <div className="text-sm mb-2">
                      <span className="font-medium">Findings:</span> {record.findings}
                    </div>
                  )}
                  {record.actionsTaken && (
                    <div className="text-sm mb-2">
                      <span className="font-medium">Actions:</span> {record.actionsTaken}
                    </div>
                  )}
                  {record.photos.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {record.photos.length} photo(s) attached
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Add Maintenance Record */}
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} size="lg" className="w-full">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Add Maintenance Record
          </Button>
        ) : (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">New Maintenance Record</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Findings</label>
                <Textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Any issues or observations"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Actions Taken</label>
                <Textarea
                  value={actionsTaken}
                  onChange={(e) => setActionsTaken(e.target.value)}
                  placeholder="Work performed or repairs made"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Next Due Date</label>
                <Input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Photos</label>
                <label className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                  <div className="flex flex-col items-center">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Tap to upload photos</span>
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
                  <div className="text-sm text-muted-foreground mt-2">
                    {photos.length} photo(s) selected
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving..." : "Save Record"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
