"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Upload, CheckCircle2, Loader2 } from "lucide-react";
import { optimizeImageFile, getRecommendedMaxEdge } from "../_lib/imageOptimizer";
import { useCurrentUser } from "@/lib/use-current-user";

interface ImageSlotProps {
  slotId: string;
  label: string;
  aspectRatio?: string;
  size?: "sm" | "md" | "lg" | "xl";
  overlayPosition?: "top-right" | "bottom-center";
  defaultImage?: string;
  /** Image context for optimization (default: 'default') */
  imageContext?: "hero" | "card" | "thumbnail" | "default";
  /** Hide upload controls for public visitors */
  allowUpload?: boolean;
}

const sizeClasses = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
};

type ProcessingState = "idle" | "optimizing" | "success" | "error";

function getSizesForContext(imageContext: ImageSlotProps["imageContext"], size: ImageSlotProps["size"]) {
  switch (imageContext) {
    case "thumbnail":
      return "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw";
    case "card":
      return "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";
    case "hero":
      // Most hero placements are full width on mobile, and either full/half width on desktop.
      return size === "xl" ? "100vw" : "(max-width: 1024px) 100vw, 50vw";
    default:
      return "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";
  }
}

function getQualityForContext(imageContext: ImageSlotProps["imageContext"]) {
  switch (imageContext) {
    case "thumbnail":
      return 55;
    case "card":
      return 65;
    case "hero":
      return 75;
    default:
      return 65;
  }
}

export function ImageSlot({
  slotId,
  label,
  aspectRatio = "aspect-[4/3]",
  size = "md",
  overlayPosition = "top-right",
  defaultImage,
  imageContext = "default",
  allowUpload = true,
}: ImageSlotProps) {
  const { user } = useCurrentUser();
  const role = String(user?.role || "").toLowerCase();
  const canEditImages = Boolean(user?.id) && (!role || ["admin", "owner", "editor"].includes(role));
  const showUpload = allowUpload && canEditImages;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const sizes = getSizesForContext(imageContext, size);
  const quality = getQualityForContext(imageContext);

  // Load from server on mount
  useEffect(() => {
    setIsClient(true);
    const localImage = localStorage.getItem(`wealden-image-${slotId}`);
    if (localImage) {
      setImageUrl(localImage);
    }
    
    // Fetch existing image from server
    const fetchUrl = `/api/wealden/images/${encodeURIComponent(slotId)}`;
    console.log(`[ImageSlot ${slotId}] Fetching from: ${fetchUrl}`);
    
    fetch(fetchUrl)
      .then((res) => {
        console.log(`[ImageSlot ${slotId}] Fetch status:`, res.status, res.statusText);
        return res.json();
      })
      .then((data) => {
        console.log(`[ImageSlot ${slotId}] Server response:`, data);
        if (data.image?.imageUrl) {
          console.log(`[ImageSlot ${slotId}] ✅ Image found on server`);
          setImageUrl(data.image.imageUrl);
          localStorage.setItem(`wealden-image-${slotId}`, data.image.imageUrl);
        } else if (defaultImage) {
          console.log(`[ImageSlot ${slotId}] Using default image`);
          setImageUrl(defaultImage);
        } else {
          console.log(`[ImageSlot ${slotId}] No image found on server or default`);
          // Keep any localStorage image already set, if present
        }
      })
      .catch((err) => {
        console.error(`[ImageSlot ${slotId}] ❌ Failed to fetch from server:`, err);
        if (!localImage && defaultImage) {
          setImageUrl(defaultImage);
        }
      });
  }, [slotId, defaultImage]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp|heic)$/i)) {
      alert("Please select a JPG, PNG, WEBP, or HEIC image");
      setProcessingState("error");
      setTimeout(() => setProcessingState("idle"), 2000);
      return;
    }

    // Revoke old object URL if exists
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    // Show optimizing state
    setProcessingState("optimizing");

    try {
      // Optimize the image
      const maxEdgePx = getRecommendedMaxEdge(imageContext);
      const optimized = await optimizeImageFile(file, { maxEdgePx });

      console.log(
        `[ImageSlot ${slotId}] Optimized: ${(optimized.originalSize / 1024).toFixed(1)}KB → ${(optimized.optimizedSize / 1024).toFixed(1)}KB`
      );

      // Upload optimized file to server
      const formData = new FormData();
      formData.append("file", optimized.file);
      formData.append("slotId", slotId);

      try {
        const response = await fetch("/api/wealden/images/upload", {
          method: "POST",
          body: formData,
        });

        console.log(`[ImageSlot ${slotId}] Upload response status:`, response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ImageSlot ${slotId}] Upload failed:`, errorText);
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[ImageSlot ${slotId}] Upload response data:`, data);
        
        if (data.ok && data.imageUrl) {
          // Data URLs don't need cache busting
          setImageUrl(data.imageUrl);
          setProcessingState("success");
          
          // Clear success state after 2 seconds
          setTimeout(() => setProcessingState("idle"), 2000);
        } else {
          throw new Error("Upload response missing imageUrl");
        }
      } catch (err) {
        console.error(`[ImageSlot ${slotId}] Failed to upload image:`, err);
        
        // Fallback: show the optimized image as base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setImageUrl(base64String);
          console.warn(`[ImageSlot ${slotId}] Using base64 fallback due to upload failure`);
        };
        reader.readAsDataURL(optimized.file);
        
        alert("Failed to upload to server. Image shown locally only - use migration tool to upload.");
        setProcessingState("error");
        setTimeout(() => setProcessingState("idle"), 2000);
      }
    } catch (error) {
      console.error("Image optimization failed:", error);
      alert(error instanceof Error ? error.message : "Failed to process image");
      setProcessingState("error");
      setTimeout(() => setProcessingState("idle"), 2000);
    }

    // Reset file input to allow re-uploading the same file
    e.target.value = "";
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    // Prevent any parent click handlers (like navigation)
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const overlayClasses =
    overlayPosition === "top-right"
      ? "absolute top-4 right-4 z-10"
      : "absolute bottom-4 left-1/2 -translate-x-1/2 z-10";

  // Render button content based on state
  const renderButtonContent = () => {
    switch (processingState) {
      case "optimizing":
        return (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Optimizing...</span>
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle2 className="w-3 h-3" />
            <span>Optimized ✓</span>
          </>
        );
      case "error":
        return <span>Error</span>;
      default:
        return (
          <>
            <Upload className="w-3 h-3" />
            <span>{imageUrl ? "Replace" : "Upload"}</span>
          </>
        );
    }
  };

  if (!isClient) {
    // SSR fallback
    return (
      <div className={`image-slot relative ${aspectRatio} bg-slate-100 ${sizeClasses[size]} overflow-hidden`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-200 flex items-center justify-center">
              <Upload className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`image-slot relative ${aspectRatio} bg-slate-100 ${sizeClasses[size]} overflow-hidden group${showUpload ? " cursor-pointer" : ""}`}
      onClick={showUpload ? handleButtonClick : undefined}
      role={showUpload ? "button" : undefined}
      tabIndex={showUpload ? 0 : undefined}
      onKeyDown={
        showUpload
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                handleButtonClick(event as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
    >
      {imageUrl ? (
        <div className="relative w-full h-full">
          {imageUrl.startsWith('data:') ? (
            // Use regular img tag for data URLs (Next.js Image doesn't handle them well)
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            // Use Next.js Image for regular URLs
            <Image
              src={imageUrl}
              alt={label}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              // Optimize local/public images for faster loads; keep unoptimized for remote URLs
              unoptimized={!imageUrl.startsWith("/")}
              sizes={sizes}
              quality={quality}
              priority={imageContext === "hero" && /hero/i.test(slotId)}
            />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-200 flex items-center justify-center">
              <Upload className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            {showUpload ? <p className="text-xs text-slate-400">Click to upload</p> : null}
          </div>
        </div>
      )}

      {showUpload ? (
        <>
          {/* Upload control overlay - positioned absolutely with z-index to prevent navigation */}
          <div className={overlayClasses}>
            <button
              onClick={handleButtonClick}
              className="image-upload-control px-4 py-2 text-xs font-medium uppercase tracking-wider bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-105 border border-slate-200 flex items-center gap-2"
              type="button"
              disabled={processingState === "optimizing"}
            >
              {renderButtonContent()}
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
            onChange={handleFileChange}
            className="hidden"
            aria-label={`Upload image for ${label}`}
          />
        </>
      ) : null}
    </div>
  );
}
