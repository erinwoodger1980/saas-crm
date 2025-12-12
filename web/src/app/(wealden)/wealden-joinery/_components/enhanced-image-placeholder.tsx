"use client";

import Image from "next/image";
import { ImageUploadButton } from "./image-upload-button";

interface EnhancedImagePlaceholderProps {
  label: string;
  aspectRatio?: string;
  imageUrl?: string;
  overlayPosition?: "top-right" | "bottom-center";
  size?: "sm" | "md" | "lg" | "xl";
}

/**
 * Enhanced image placeholder with cohesive design system
 * - All images wrapped in .image-slot
 * - Upload controls have .image-upload-control class
 * - Calm, minimal aesthetic matching premium joinery brand
 */
export function EnhancedImagePlaceholder({ 
  label, 
  aspectRatio = "aspect-[4/3]", 
  imageUrl,
  overlayPosition = "top-right",
  size = "md"
}: EnhancedImagePlaceholderProps) {
  const sizeClasses = {
    sm: "rounded-lg",
    md: "rounded-xl",
    lg: "rounded-2xl",
    xl: "rounded-3xl"
  };

  const overlayPositionClasses = {
    "top-right": "top-4 right-4",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2"
  };

  if (imageUrl) {
    return (
      <div className={`image-slot relative ${aspectRatio} overflow-hidden ${sizeClasses[size]} bg-slate-50`}>
        <Image
          src={imageUrl}
          alt={label}
          fill
          className="object-cover transition-transform duration-700 hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className={`image-upload-control absolute ${overlayPositionClasses[overlayPosition]} z-10`}>
          <ImageUploadButton label={label} variant="overlay" />
        </div>
      </div>
    );
  }

  return (
    <div className={`image-slot relative ${aspectRatio} overflow-hidden ${sizeClasses[size]} bg-slate-50 border border-slate-200`}>
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 text-center p-6">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {label}
          </p>
          <div className="image-upload-control">
            <ImageUploadButton label={label} variant="default" />
          </div>
        </div>
      </div>
    </div>
  );
}
