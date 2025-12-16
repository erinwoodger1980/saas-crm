"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import { Wand2, Save, ExternalLink, Loader2 } from "lucide-react";

const EXAMPLE_DESCRIPTION = `Entrance door E03. Timber outer frame. Top glazed zone 35% height with 2 columns and 3 rows of muntins. Bottom zone 65% height with two flat panels side by side, each with a single inset bolection line. Show 800mm width and 2025mm height dimensions.`;

export function DiagramSvgGenerator() {
  const { toast } = useToast();
  const [fileName, setFileName] = useState("");
  const [description, setDescription] = useState("");
  const [svg, setSvg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a description of the diagram",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setSvg(null);
    setSavedPath(null);

    try {
      const response = await apiFetch<{ svg: string }>("/ml/generate-product-svg", {
        method: "POST",
        json: {
          description,
          fileName: fileName || "diagram.svg",
        },
      });

      // Validate SVG
      if (!response.svg || !response.svg.trim().startsWith("<svg")) {
        throw new Error("Invalid SVG returned");
      }

      if (response.svg.includes("<script")) {
        throw new Error("SVG contains forbidden script tags");
      }

      if (!response.svg.includes('viewBox="0 0 140 170"')) {
        console.warn("SVG does not use standard viewBox");
      }

      setSvg(response.svg);
      toast({
        title: "Diagram generated",
        description: "Preview the diagram below. Click Save to add it to your project.",
      });
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message || "Could not generate SVG",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!svg || !fileName.trim()) {
      toast({
        title: "Cannot save",
        description: "Generate a diagram and provide a file name first",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const response = await apiFetch<{ path: string; publicPath: string }>("/ml/save-diagram-svg", {
        method: "POST",
        json: {
          fileName: fileName.endsWith(".svg") ? fileName : `${fileName}.svg`,
          svg,
        },
      });

      setSavedPath(response.publicPath);
      toast({
        title: "Diagram saved",
        description: `Saved to ${response.publicPath}`,
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Could not save SVG",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const canSave = svg !== null && fileName.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            File Name
            <span className="text-red-500 ml-1">*</span>
          </label>
          <Input
            placeholder="door-entrance-e03.svg"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            disabled={generating || saving}
          />
          <p className="text-xs text-slate-500 mt-1">
            Example: door-entrance-e03.svg
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
            <span className="text-red-500 ml-1">*</span>
          </label>
          <Textarea
            placeholder="Describe the diagram in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={generating || saving}
            rows={6}
            className="resize-none"
          />
          <details className="mt-2">
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
              Show example description
            </summary>
            <p className="text-xs text-slate-600 mt-2 p-3 bg-slate-50 rounded border">
              {EXAMPLE_DESCRIPTION}
            </p>
          </details>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating || saving || !description.trim()}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate SVG
              </>
            )}
          </Button>

          <Button
            onClick={handleSave}
            disabled={!canSave || saving}
            variant="default"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save to Project
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="border rounded-lg bg-white">
        <div className="border-b bg-slate-50 px-4 py-2">
          <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
        </div>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          {generating ? (
            <div className="text-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Generating diagram...</p>
            </div>
          ) : svg ? (
            <div
              className="max-w-full max-h-[500px] flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="text-center text-slate-400">
              <svg
                className="mx-auto h-16 w-16 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm">Generate a diagram to see a preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Success Message */}
      {savedPath && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900">Diagram saved successfully</h3>
              <p className="text-sm text-green-700 mt-1">
                Saved to: <code className="bg-white px-1 py-0.5 rounded">{savedPath}</code>
              </p>
              <a
                href={savedPath}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 mt-2 underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open SVG
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
