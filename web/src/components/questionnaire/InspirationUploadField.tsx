"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { analyzeInspirationFromPhotoClient, InspirationAnalysisResponse } from "@/lib/api/measurements";
import { cn } from "@/lib/utils";
import { AlertTriangle, Image as ImageIcon, Loader2, Palette, Sparkles, Trash2 } from "lucide-react";

type InspirationUploadFieldProps = {
  attributes?: InspirationAnalysisResponse["attributes"] | null;
  files: File[];
  disabled?: boolean;
  className?: string;
  onFilesChange: (files: FileList | null) => void;
  onResult: (result: InspirationAnalysisResponse) => void;
};

export function InspirationUploadField({
  attributes,
  files,
  disabled,
  className,
  onFilesChange,
  onResult,
}: InspirationUploadFieldProps) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firstFile = files?.[0] ?? null;

  useEffect(() => {
    if (!firstFile) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }
    const url = URL.createObjectURL(firstFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [firstFile]);

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setStatus(null);
    onFilesChange(event.target.files);
  };

  const handleRemoveFile = () => {
    setStatus(null);
    setError(null);
    onFilesChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!firstFile) {
      setError("Select an inspiration photo first");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setStatus(null);
    try {
      const result = await analyzeInspirationFromPhotoClient({ file: firstFile });
      onResult(result);
      const confidenceLabel =
        result.confidence != null ? `Confidence ${Math.round(result.confidence * 100)}%` : null;
      const desc = result.attributes.description || result.attributes.mood;
      setStatus([confidenceLabel, desc].filter(Boolean).join(" / "));
    } catch (err: any) {
      setError(err?.message || "We couldn't analyse that photo. Try another image.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const palette = attributes?.palette ?? [];
  const styleTags = attributes?.styleTags ?? [];
  const heroFeatures = attributes?.heroFeatures ?? [];

  return (
    <div className={cn("space-y-3 rounded-2xl border border-dashed border-indigo-200 bg-white/80 p-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">Inspiration photo</p>
          <p className="text-xs text-slate-500">We'll auto-tag the style and palette for your estimator.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" /> {firstFile ? "Replace" : "Upload"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleSelectFile}
        />
      </div>

      {firstFile ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-600">
          {previewUrl ? (
            <img src={previewUrl} alt="Inspiration preview" className="h-20 w-20 rounded-lg object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-800">{firstFile.name}</div>
            <div className="text-xs text-slate-500">{Math.round(firstFile.size / 1024)} KB</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-500 flex items-center justify-center"
            onClick={handleRemoveFile}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Add a mood photo, Pinterest screenshot, or example product you like.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          We convert it into style tags, palette and recommended specs for the estimator.
        </p>
        <Button
          type="button"
          size="sm"
          className="gap-2"
          disabled={disabled || !firstFile || isAnalyzing}
          onClick={handleAnalyze}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Analyse inspiration
            </>
          )}
        </Button>
      </div>

      {status ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{status}</p> : null}

      {attributes ? (
        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          {styleTags?.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Style tags</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {styleTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 shadow">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {palette?.length ? (
            <div>
              <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Palette className="h-3.5 w-3.5" /> Palette
              </div>
              <div className="mt-2 flex gap-2">
                {palette.map((colour, idx) => (
                  <div key={`${colour}-${idx}`} className="text-center">
                    <div className="h-10 w-10 rounded-full border border-slate-200" style={{ backgroundColor: colour }} />
                    <div className="mt-1 text-[10px] text-slate-500">{colour}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {heroFeatures?.length ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key features</div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-600">
                {heroFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {attributes.description ? (
            <p className="text-xs text-slate-600">{attributes.description}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
