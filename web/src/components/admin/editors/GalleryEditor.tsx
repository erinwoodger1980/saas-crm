'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2, ArrowUp, ArrowDown, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface GalleryImage {
  id?: string;
  url: string;
  altText: string;
  order?: number;
}

interface GalleryEditorProps {
  images: GalleryImage[];
  onImagesChange: (_: GalleryImage[]) => void;
  tenantId: string;
}

export default function GalleryEditor({ images, onImagesChange, tenantId }: GalleryEditorProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      acceptedFiles.forEach((file) => formData.append('images', file));

      // Use relative /api path (rewritten to API origin) and rely on HttpOnly auth cookie rather than Bearer localStorage token.
      const res = await fetch(`/api/admin/landing-tenants/${tenantId}/images`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Gallery upload failed', res.status, text);
        alert(`Upload failed (${res.status}).`);
        return;
      }
      const uploadedImages = await res.json();
      if (Array.isArray(uploadedImages)) {
        onImagesChange([...images, ...uploadedImages]);
      } else if (uploadedImages?.images) {
        onImagesChange([...images, ...uploadedImages.images]);
      } else {
        onImagesChange([...images]); // no change but avoid silent failure
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [images, onImagesChange, tenantId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif']
    },
    multiple: true,
  });

  const handleDelete = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    onImagesChange(newImages);
  };

  const handleMoveDown = (index: number) => {
    if (index === images.length - 1) return;
    const newImages = [...images];
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    onImagesChange(newImages);
  };

  const handleAltTextChange = (index: number, altText: string) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], altText };
    onImagesChange(newImages);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Image Gallery</h2>
        <p className="text-sm text-gray-600 mt-1">
          Upload before/after photos and project images
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={48} className="mx-auto text-gray-400 mb-4" />
        {uploading ? (
          <div>
            <p className="text-gray-600 font-medium">Uploading...</p>
            <div className="w-32 h-2 bg-gray-200 rounded-full mx-auto mt-2">
              <div className="h-full bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          </div>
        ) : isDragActive ? (
          <p className="text-gray-600 font-medium">Drop images here...</p>
        ) : (
          <div>
            <p className="text-gray-600 font-medium mb-1">
              Drag & drop images here, or click to select
            </p>
            <p className="text-sm text-gray-500">PNG, JPG, WEBP up to 10MB</p>
          </div>
        )}
      </div>

      {/* Image List */}
      {images.length > 0 && (
        <div className="mt-6 space-y-4">
          {images.map((image, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              {/* Thumbnail */}
              <div className="w-24 h-24 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
                {image.url ? (
                  <Image
                    src={image.url}
                    alt={image.altText || 'Project image'}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={32} className="text-gray-400" />
                  </div>
                )}
              </div>

              {/* Alt Text */}
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Alt Text (for SEO)
                </label>
                <input
                  type="text"
                  value={image.altText}
                  onChange={(e) => handleAltTextChange(index, e.target.value)}
                  placeholder="Custom kitchen installation in Maidstone"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-2 text-gray-600 hover:bg-gray-200 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === images.length - 1}
                  className="p-2 text-gray-600 hover:bg-gray-200 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ArrowDown size={18} />
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && !uploading && (
        <div className="mt-6 text-center py-8 border-t border-gray-200">
          <ImageIcon size={48} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">No images uploaded yet</p>
        </div>
      )}

      {/* Hint about auto-persist behavior */}
      <div className="mt-6 text-xs text-gray-500 border-t pt-4">
        <p>
          Images are now auto-saved as soon as they finish uploading. You can still reorder or edit alt text
          and then click <span className="font-semibold">Save Draft</span> or <span className="font-semibold">Publish</span> to update other content.
        </p>
      </div>
    </div>
  );
}
