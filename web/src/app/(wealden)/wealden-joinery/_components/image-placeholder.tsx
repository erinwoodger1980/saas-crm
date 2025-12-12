"use client";

import Image from "next/image";
import { ImageUploadButton } from "./image-upload-button";

interface ImagePlaceholderProps {
  label: string;
  aspectRatio?: string;
  imageUrl?: string;
}

export function ImagePlaceholder({ label, aspectRatio = "aspect-[4/3]", imageUrl }: ImagePlaceholderProps) {
  if (imageUrl) {
    return (
      <div className={`relative ${aspectRatio} overflow-hidden rounded-lg bg-slate-100`}>
        <Image
          src={imageUrl}
          alt={label}
          fill
          className="object-cover"
        />
        <div className="absolute top-4 right-4 z-10">
          <ImageUploadButton label={label} />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${aspectRatio} overflow-hidden rounded-lg bg-slate-100 border-2 border-dashed border-slate-300`}>
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center p-6">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <ImageUploadButton label={label} />
        </div>
      </div>
    </div>
  );
}
