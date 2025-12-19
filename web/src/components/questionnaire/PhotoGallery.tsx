"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE } from "@/lib/api";
import { X, Eye, Trash2, Image as ImageIcon, Pencil } from "lucide-react";

export interface QuestionnairePhoto {
  id: string;
  filename: string;
  caption?: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

interface PhotoGalleryProps {
  photos: QuestionnairePhoto[];
  onDelete?: (photoId: string) => void;
  onUpdate?: (photoId: string, updates: { caption?: string }) => void;
  readonly?: boolean;
  showCaptions?: boolean;
}

export default function PhotoGallery({
  photos,
  onDelete,
  onUpdate,
  readonly = false,
  showCaptions = true,
}: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<QuestionnairePhoto | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<QuestionnairePhoto | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    setDeleting(photoId);
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

      onDelete?.(photoId);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete photo");
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdateCaption = async () => {
    if (!editingPhoto) return;

    try {
      const response = await fetch(
        `${API_BASE}/questionnaire-photos/${encodeURIComponent(editingPhoto.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: editCaption }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update caption");
      }

      onUpdate?.(editingPhoto.id, { caption: editCaption });
      setEditingPhoto(null);
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update caption");
    }
  };

  const getPhotoUrl = (photo: QuestionnairePhoto) => {
    return `${API_BASE}/questionnaire-photos/${encodeURIComponent(photo.id)}/file`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-gray-50">
        <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">No photos uploaded yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="relative group border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Photo thumbnail */}
            <div className="aspect-square relative bg-gray-100">
              <img
                src={getPhotoUrl(photo)}
                alt={photo.caption || photo.filename}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedPhoto(photo)}
                  title="View full size"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                
                {!readonly && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingPhoto(photo);
                        setEditCaption(photo.caption || "");
                      }}
                      title="Edit caption"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(photo.id)}
                      disabled={deleting === photo.id}
                      title="Delete photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Photo info */}
            {showCaptions && (
              <div className="p-2">
                <p className="text-xs text-gray-600 truncate" title={photo.filename}>
                  {photo.filename}
                </p>
                {photo.caption && (
                  <p className="text-sm font-medium truncate mt-1" title={photo.caption}>
                    {photo.caption}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {formatFileSize(photo.sizeBytes)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Full size viewer dialog */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedPhoto.caption || selectedPhoto.filename}</DialogTitle>
            </DialogHeader>
            
            <div className="relative">
              <img
                src={getPhotoUrl(selectedPhoto)}
                alt={selectedPhoto.caption || selectedPhoto.filename}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Filename:</span>
                <span className="font-medium">{selectedPhoto.filename}</span>
              </div>
              <div className="flex justify-between">
                <span>Size:</span>
                <span className="font-medium">{formatFileSize(selectedPhoto.sizeBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>Uploaded:</span>
                <span className="font-medium">{formatDate(selectedPhoto.createdAt)}</span>
              </div>
              {selectedPhoto.caption && (
                <div className="flex justify-between">
                  <span>Caption:</span>
                  <span className="font-medium">{selectedPhoto.caption}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {!readonly && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedPhoto(null);
                      setEditingPhoto(selectedPhoto);
                      setEditCaption(selectedPhoto.caption || "");
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Caption
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDelete(selectedPhoto.id);
                      setSelectedPhoto(null);
                    }}
                    disabled={deleting === selectedPhoto.id}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </>
              )}
              <Button onClick={() => setSelectedPhoto(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit caption dialog */}
      {editingPhoto && (
        <Dialog open={!!editingPhoto} onOpenChange={() => setEditingPhoto(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Caption</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <img
                  src={getPhotoUrl(editingPhoto)}
                  alt={editingPhoto.filename}
                  className="w-full h-48 object-cover rounded"
                />
              </div>

              <div>
                <Label htmlFor="caption">Caption</Label>
                <Textarea
                  id="caption"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="Add a caption..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingPhoto(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateCaption}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
