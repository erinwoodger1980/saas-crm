"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";

interface TenantImageImportProps {
  tenantSlug: string;
  website: string;
}

interface ImportResult {
  success: boolean;
  imagesImported: number;
  manifestPath: string;
  outputDir: string;
  message?: string;
  error?: string;
}

export function TenantImageImport({ tenantSlug, website }: TenantImageImportProps) {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [limit, setLimit] = useState(12);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  async function runImport() {
    if (!website?.trim()) {
      toast({
        title: "Website required",
        description: "Please add your website URL in the Company Profile section first",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setLastResult(null);

    try {
      const result = await apiFetch<ImportResult>("/tenant/images/import", {
        method: "POST",
        json: {
          slug: tenantSlug,
          url: website,
          limit,
        },
      });

      setLastResult(result);

      if (result.success) {
        toast({
          title: "Images imported successfully",
          description: `${result.imagesImported} high-quality images imported from your website`,
        });
      } else {
        toast({
          title: "Import failed",
          description: result.error || "Could not import images from website",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Import failed",
        description: e?.message || "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white/70 p-4">
        <p className="text-sm text-slate-600 mb-4">
          Import images from your website to use in landing pages. The system will:
        </p>
        <ul className="text-sm text-slate-600 space-y-2 mb-4 ml-4">
          <li>✅ Check robots.txt compliance</li>
          <li>✅ Scan your website for high-quality images (≥800×600)</li>
          <li>✅ Remove duplicates using perceptual hashing</li>
          <li>✅ Optimize images (JPG + WebP formats)</li>
          <li>✅ Generate responsive image variants (1600w, 800w)</li>
        </ul>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Website URL
            </label>
            <input
              type="text"
              className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
              value={website}
              disabled
              placeholder="Set in Company Profile"
            />
          </div>

          <div className="w-32">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Image Limit
            </label>
            <input
              type="number"
              min="1"
              max="50"
              className="w-full rounded-2xl border bg-white/95 px-4 py-2 text-sm"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 12)}
            />
          </div>

          <Button onClick={runImport} disabled={importing || !website}>
            {importing ? "Importing..." : "Import Images"}
          </Button>
        </div>
      </div>

      {lastResult && (
        <div
          className={`rounded-xl border p-4 ${
            lastResult.success
              ? "bg-green-50/70 border-green-200"
              : "bg-red-50/70 border-red-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">{lastResult.success ? "✅" : "❌"}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800 mb-1">
                {lastResult.success ? "Import Successful" : "Import Failed"}
              </div>
              {lastResult.success ? (
                <>
                  <p className="text-sm text-slate-600 mb-2">
                    Imported {lastResult.imagesImported} images
                  </p>
                  <div className="text-xs text-slate-500">
                    <div>Manifest: {lastResult.manifestPath}</div>
                    <div>Images: {lastResult.outputDir}</div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  {lastResult.error || lastResult.message || "Unknown error"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-blue-50/70 border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <div className="text-xl">💡</div>
          <div className="flex-1 text-sm text-slate-600">
            <strong>Pro tip:</strong> After importing, your images will be available at{" "}
            <code className="bg-white px-2 py-1 rounded text-xs">
              /tenants/{tenantSlug}/
            </code>{" "}
            and can be used in custom landing pages. The system respects robots.txt and only
            downloads publicly accessible images.
          </div>
        </div>
      </div>
    </div>
  );
}
