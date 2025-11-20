"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { estimateDimensionsFromPhotoClient } from "@/lib/api/measurements";
import { cn } from "@/lib/utils";

const MIN_DIMENSION_MM = 300;
const MAX_DIMENSION_MM = 3000;

type PhotoMeasurementFieldProps = {
  value?: {
    widthMm?: number | null;
    heightMm?: number | null;
    measurementSource?: string | null;
    measurementConfidence?: number | null;
  };
  context?: {
    openingType?: string | null;
    floorLevel?: string | null;
    notes?: string | null;
  };
  disabled?: boolean;
  widthField?: string;
  heightField?: string;
  widthLabel?: string;
  heightLabel?: string;
  helperText?: string;
  className?: string;
  onChange: (patch: Record<string, any>) => void;
};

export function PhotoMeasurementField({
  value,
  context,
  disabled,
  widthField = "estimated_width_mm",
  heightField = "estimated_height_mm",
  widthLabel = "Estimated width (mm)",
  heightLabel = "Estimated height (mm)",
  helperText = "This size is an estimate for quoting only. Final measurements will be checked by our surveyor before manufacture.",
  className,
  onChange,
}: PhotoMeasurementFieldProps) {
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const widthMm = value?.widthMm ?? null;
  const heightMm = value?.heightMm ?? null;
  const measurementSource = value?.measurementSource ?? null;
  const measurementConfidence = value?.measurementConfidence ?? null;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectFile = useCallback((file: File | null) => {
    setError(null);
    setWarning(null);
    setStatusMessage(null);
    setCameraFile(file ?? null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  }, [previewUrl]);

  const clampDimension = (value: number): number => {
    const clamped = Math.max(MIN_DIMENSION_MM, Math.min(MAX_DIMENSION_MM, value));
    return Math.round(clamped / 10) * 10;
  };

  const handleManualDimension = useCallback(
    (field: string, raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        onChange({ [field]: null, measurement_source: "MANUAL" });
        return;
      }
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        setError("Enter a number in millimetres");
        return;
      }
      const valueMm = clampDimension(parsed);
      onChange({ [field]: valueMm, measurement_source: "MANUAL", measurement_confidence: null });
      setWarning(null);
      setError(null);
    },
    [onChange],
  );

  const handleEstimateFromPhoto = useCallback(async () => {
    if (!cameraFile) {
      setError("Select or take a photo first");
      return;
    }
    setIsEstimating(true);
    setError(null);
    setWarning(null);
    setStatusMessage(null);

    try {
      const response = await estimateDimensionsFromPhotoClient({
        file: cameraFile,
        openingType: context?.openingType,
        floorLevel: context?.floorLevel,
        notes: context?.notes,
      });

      if (!response.width_mm || !response.height_mm) {
        setWarning("We couldn't read enough reference points. Please type your best guess.");
      }

      onChange({
        [widthField]: response.width_mm ?? null,
        [heightField]: response.height_mm ?? null,
        measurement_source: "PHOTO_ESTIMATE",
        measurement_confidence: response.confidence ?? null,
      });

      if (response.confidence != null && response.confidence < 0.5) {
        setWarning("This looks like a rough estimate — please double-check the size.");
      }

      if (response.width_mm && response.height_mm) {
        setStatusMessage(
          `Estimated from photo: ${response.width_mm} x ${response.height_mm} mm. Please adjust if this looks wrong.`,
        );
      } else {
        setStatusMessage("Estimation complete. Adjust the values if needed.");
      }
    } catch (err: any) {
      setError(err?.message || "We couldn't estimate from the photo. Please enter your best guess.");
    } finally {
      setIsEstimating(false);
    }
  }, [cameraFile, context?.floorLevel, context?.notes, context?.openingType, onChange]);

  const helperMessage = useMemo(() => {
    if (!measurementSource || !widthMm || !heightMm) return null;
    const confidenceLabel = measurementConfidence != null ? ` • confidence ${Math.round(measurementConfidence * 100)}%` : "";
    if (measurementSource === "PHOTO_ESTIMATE") {
      return `Estimated from photo: ${widthMm} x ${heightMm} mm${confidenceLabel}. Please adjust if this looks wrong.`;
    }
    return `Using manual entry: ${widthMm} x ${heightMm} mm${confidenceLabel}.`;
  }, [measurementSource, widthMm, heightMm, measurementConfidence]);

  return (
    <div className={cn("mt-4 space-y-3 rounded-2xl border border-dashed border-muted bg-muted/10 p-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4" /> Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          onClick={() => galleryInputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" /> Upload from gallery
        </Button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        For best results, include a tape measure, A4 sheet of paper, or a known object in the photo next to the window/door.
      </p>

      {previewUrl && (
        <div className="flex items-center gap-3 rounded-xl border bg-background/60 p-3">
          <img src={previewUrl} alt="Selected reference" className="h-20 w-20 rounded-lg object-cover" />
          <div className="text-xs text-muted-foreground">
            Photo ready. Tap "Estimate from photo" to auto-fill width and height.
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">{widthLabel}</Label>
          <Input
            type="number"
            min={MIN_DIMENSION_MM}
            max={MAX_DIMENSION_MM}
            inputMode="numeric"
            disabled={disabled}
            value={widthMm ?? ""}
            placeholder="e.g. 1200"
            onChange={(event) => onChange({ [widthField]: event.target.value ? Number(event.target.value) : null })}
            onBlur={(event) => handleManualDimension(widthField, event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">{heightLabel}</Label>
          <Input
            type="number"
            min={MIN_DIMENSION_MM}
            max={MAX_DIMENSION_MM}
            inputMode="numeric"
            disabled={disabled}
            value={heightMm ?? ""}
            placeholder="e.g. 2100"
            onChange={(event) => onChange({ [heightField]: event.target.value ? Number(event.target.value) : null })}
            onBlur={(event) => handleManualDimension(heightField, event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{helperText}</p>
        <Button
          type="button"
          size="sm"
          className="gap-2"
          disabled={disabled || !cameraFile || isEstimating}
          onClick={handleEstimateFromPhoto}
        >
          {isEstimating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Estimating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Estimate from photo
            </>
          )}
        </Button>
      </div>

      {helperMessage && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {helperMessage}
        </p>
      )}

      {statusMessage && !helperMessage && (
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{statusMessage}</p>
      )}

      {warning && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
          <span>{warning}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
      )}
    </div>
  );
}
