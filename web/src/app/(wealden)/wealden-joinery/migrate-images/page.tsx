"use client";

import { useState } from "react";
import { Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface MigrationResult {
  slotId: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export default function MigrateImagesPage() {
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const scanLocalStorage = () => {
    setIsScanning(true);
    const foundImages: MigrationResult[] = [];

    // Scan localStorage for wealden-image-* keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("wealden-image-")) {
        const slotId = key.replace("wealden-image-", "");
        foundImages.push({
          slotId,
          status: "pending",
        });
      }
    }

    setResults(foundImages);
    setIsScanning(false);
  };

  const migrateImages = async () => {
    if (results.length === 0) return;

    setIsMigrating(true);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      // Update status to uploading
      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "uploading" } : r
        )
      );

      try {
        // Get image from localStorage
        const base64Data = localStorage.getItem(`wealden-image-${result.slotId}`);
        if (!base64Data) {
          throw new Error("Image not found in localStorage");
        }

        // Convert base64 to blob
        const response = await fetch(base64Data);
        const blob = await response.blob();

        // Create FormData
        const formData = new FormData();
        formData.append("file", blob, `${result.slotId}.jpg`);
        formData.append("slotId", result.slotId);

        // Upload to server
        const uploadResponse = await fetch("/api/wealden/images/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        // Update status to success
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "success" } : r
          )
        );

        // Optional: Remove from localStorage after successful upload
        // localStorage.removeItem(`wealden-image-${result.slotId}`);
      } catch (error) {
        console.error(`Failed to migrate ${result.slotId}:`, error);
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "error",
                  error: error instanceof Error ? error.message : "Unknown error",
                }
              : r
          )
        );
      }
    }

    setIsMigrating(false);
  };

  const getStatusIcon = (status: MigrationResult["status"]) => {
    switch (status) {
      case "pending":
        return <Upload className="w-4 h-4 text-slate-400" />;
      case "uploading":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Migrate Images to Server
          </h1>
          <p className="text-slate-600 mb-8">
            This tool will find all images stored in your browser's localStorage and
            upload them to the server so they're accessible from all devices.
          </p>

          <div className="space-y-4">
            <button
              onClick={scanLocalStorage}
              disabled={isScanning || isMigrating}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isScanning ? "Scanning..." : "Scan localStorage"}
            </button>

            {results.length > 0 && (
              <>
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-slate-900">
                      Found {results.length} image{results.length !== 1 ? "s" : ""}
                    </h2>
                    <button
                      onClick={migrateImages}
                      disabled={isMigrating}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isMigrating ? "Migrating..." : "Migrate All to Server"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {results.map((result, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(result.status)}
                          <span className="font-mono text-sm text-slate-700">
                            {result.slotId}
                          </span>
                        </div>
                        {result.error && (
                          <span className="text-xs text-red-600">{result.error}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {isMigrating && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Uploading images to server... Please don't close this page.
                      </p>
                    </div>
                  )}

                  {!isMigrating && results.every((r) => r.status === "success") && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 font-medium">
                        ✓ All images migrated successfully! You can now access them from
                        any device.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
