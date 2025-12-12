"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface ImageUploadButtonProps {
  label: string;
  onUpload?: (file: File) => void;
}

export function ImageUploadButton({ label, onUpload }: ImageUploadButtonProps) {
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
      const response = await fetch("/api/wealden/upload-image", {
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
      <label htmlFor={`upload-${label.replace(/\s+/g, "-")}`}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white/80"
          disabled={uploading}
          asChild
        >
          <span>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : `Upload ${label}`}
          </span>
        </Button>
      </label>
    </div>
  );
}
