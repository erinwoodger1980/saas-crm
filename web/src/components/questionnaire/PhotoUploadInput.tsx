"use client";
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE } from "@/lib/api";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

export interface QuestionnairePhoto {
  id: string;
  filename: string;
  caption?: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface PhotoUploadInputProps {
  answerId: string;
  existingPhotos?: QuestionnairePhoto[];
  onPhotosChange?: (photos: QuestionnairePhoto[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export default function PhotoUploadInput({
  answerId,
  existingPhotos = [],
  onPhotosChange,
  maxPhotos = 5,
  disabled = false,
}: PhotoUploadInputProps) {
  const [photos, setPhotos] = useState<QuestionnairePhoto[]>(existingPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updatePhotos = (newPhotos: QuestionnairePhoto[]) => {
    setPhotos(newPhotos);
    onPhotosChange?.(newPhotos);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadedPhotos: QuestionnairePhoto[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith("image/")) {
          setError(`File ${file.name} is not an image`);
          continue;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          setError(`File ${file.name} is too large (max 10MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append("photo", file);

        const response = await fetch(
          `${API_BASE}/questionnaire-photos/answer/${encodeURIComponent(answerId)}`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errorData.error || "Upload failed");
        }

        const data = await response.json();
        uploadedPhotos.push(data.photo);
        setUploadProgress(((i + 1) / files.length) * 100);
      }

      updatePhotos([...photos, ...uploadedPhotos]);
    } catch (err: any) {
      console.error("Photo upload failed:", err);
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;

    try {
      const response = await fetch(
        `${API_BASE}/questionnaire-photos/${encodeURIComponent(photoId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete photo");
      }

      updatePhotos(photos.filter((p) => p.id !== photoId));
    } catch (err: any) {
      console.error("Photo delete failed:", err);
      setError(err.message || "Failed to delete photo");
    }
  };

  const handleCaptionUpdate = async (photoId: string, caption: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/questionnaire-photos/${encodeURIComponent(photoId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ caption }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update caption");
      }

      const data = await response.json();
      updatePhotos(
        photos.map((p) =>
          p.id === photoId ? { ...p, caption: data.photo.caption } : p
        )
      );
    } catch (err: any) {
      console.error("Caption update failed:", err);
      setError(err.message || "Failed to update caption");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={disabled || uploading || photos.length >= maxPhotos}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading || photos.length >= maxPhotos}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading {uploadProgress.toFixed(0)}%
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo{photos.length < maxPhotos ? "s" : ""}
            </>
          )}
        </Button>
        <span className="text-xs text-slate-500">
          {photos.length} / {maxPhotos} photos
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {/* Photos Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onDelete={handleDelete}
              onCaptionUpdate={handleCaptionUpdate}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && !uploading && (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
          <ImageIcon className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No photos uploaded yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Click "Upload Photos" to add images
          </p>
        </div>
      )}
    </div>
  );
}

interface PhotoCardProps {
  photo: QuestionnairePhoto;
  onDelete: (id: string) => void;
  onCaptionUpdate: (id: string, caption: string) => void;
  disabled: boolean;
}

function PhotoCard({ photo, onDelete, onCaptionUpdate, disabled }: PhotoCardProps) {
  const [caption, setCaption] = useState(photo.caption || "");
  const [isEditingCaption, setIsEditingCaption] = useState(false);

  const handleCaptionSave = () => {
    onCaptionUpdate(photo.id, caption);
    setIsEditingCaption(false);
  };

  const handleCaptionCancel = () => {
    setCaption(photo.caption || "");
    setIsEditingCaption(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Image Preview */}
      <div className="relative bg-slate-100 aspect-video">
        <img
          src={`${API_BASE}/questionnaire-photos/${photo.id}`}
          alt={photo.caption || photo.filename}
          className="w-full h-full object-cover"
        />
        <button
          type="button"
          onClick={() => onDelete(photo.id)}
          disabled={disabled}
          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete photo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Photo Info */}
      <div className="p-3 space-y-2">
        <div className="text-xs text-slate-500">
          {photo.filename} • {formatFileSize(photo.sizeBytes)}
        </div>

        {/* Caption */}
        {isEditingCaption ? (
          <div className="space-y-1">
            <Input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              className="text-sm"
              disabled={disabled}
            />
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleCaptionSave}
                disabled={disabled}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCaptionCancel}
                disabled={disabled}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => !disabled && setIsEditingCaption(true)}
            className={`text-sm ${
              photo.caption ? "text-slate-700" : "text-slate-400 italic"
            } ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:text-slate-900"}`}
          >
            {photo.caption || "Click to add caption..."}
          </div>
        )}
      </div>
    </div>
  );
}
