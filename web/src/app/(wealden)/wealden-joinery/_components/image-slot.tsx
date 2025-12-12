"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";

interface ImageSlotProps {
  slotId: string;
  label: string;
  aspectRatio?: string;
  size?: "sm" | "md" | "lg" | "xl";
  overlayPosition?: "top-right" | "bottom-center";
  defaultImage?: string;
}

const sizeClasses = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
};

export function ImageSlot({
  slotId,
  label,
  aspectRatio = "aspect-[4/3]",
  size = "md",
  overlayPosition = "top-right",
  defaultImage,
}: ImageSlotProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem(`wealden-image-${slotId}`);
    if (stored) {
      setImageUrl(stored);
    } else if (defaultImage) {
      setImageUrl(defaultImage);
    }
  }, [slotId, defaultImage]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
      alert("Please select a JPG, PNG, or WEBP image");
      return;
    }

    // Revoke old object URL if exists
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    // Create new object URL for immediate preview
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    // Convert to base64 for localStorage
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      
      // Check size (localStorage has ~5-10MB limit, be conservative)
      if (base64String.length > 1000000) {
        alert("Image too large. Please select a smaller image (< 1MB)");
        URL.revokeObjectURL(objectUrl);
        objectUrlRef.current = null;
        return;
      }

      // Save to localStorage
      try {
        localStorage.setItem(`wealden-image-${slotId}`, base64String);
        setImageUrl(base64String);
      } catch (err) {
        console.error("Failed to save image:", err);
        alert("Failed to save image. It may be too large.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const overlayClasses =
    overlayPosition === "top-right"
      ? "absolute top-4 right-4"
      : "absolute bottom-4 left-1/2 -translate-x-1/2";

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
    <div className={`image-slot relative ${aspectRatio} bg-slate-100 ${sizeClasses[size]} overflow-hidden group`}>
      {imageUrl ? (
        <div className="relative w-full h-full">
          <Image
            src={imageUrl}
            alt={label}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized={imageUrl.startsWith("data:")}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-200 flex items-center justify-center">
              <Upload className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            <p className="text-xs text-slate-400">Click to upload</p>
          </div>
        </div>
      )}

      {/* Upload control overlay */}
      <div className={overlayClasses}>
        <button
          onClick={handleClick}
          className="image-upload-control px-4 py-2 text-xs font-medium uppercase tracking-wider bg-white/90 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-105 border border-slate-200"
          type="button"
        >
          {imageUrl ? "Replace" : "Upload"}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Upload image for ${label}`}
      />
    </div>
  );
}
