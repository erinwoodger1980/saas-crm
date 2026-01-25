"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface ImageUploadButtonProps {
  label: string;
  onUpload?: (file: File) => void;
  variant?: "default" | "overlay";
}

export function ImageUploadButton({ label, onUpload, variant = "default" }: ImageUploadButtonProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Create a FormData object
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", label);

      // Upload to the backend
      const response = await fetch("/api/wealden/images/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      console.log("Upload successful:", result);
      
      if (onUpload) {
        onUpload(file);
      }

      // Refresh the page to show the new image
      window.location.reload();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id={`upload-${label.replace(/\s+/g, "-")}`}
        disabled={uploading}
      />
      <label htmlFor={`upload-${label.replace(/\s+/g, "-")}`} className="image-upload-control">
        <Button
          type="button"
          variant={variant === "overlay" ? "secondary" : "outline"}
          size="sm"
          className={`cursor-pointer ${
            variant === "overlay"
              ? "bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm border-0"
              : "border border-slate-300 hover:border-slate-400 bg-white/80"
          }`}
          disabled={uploading}
          asChild
        >
          <span>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </span>
        </Button>
      </label>
    </div>
  );
}
