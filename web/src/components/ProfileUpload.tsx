/**
 * Profile Upload Component
 * For SVG/DXF profile upload with preview for component extrusion
 */
'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import type { ProfileRecord } from '@/types/asset';

interface ProfileUploadProps {
  /** Current profile ID if already uploaded */
  profileId?: string | null;
  /** Current profile data for preview */
  profileData?: ProfileRecord | null;
  /** Callback when profile is uploaded/changed */
  onProfileChange: (profileId: string | null, profileData?: ProfileRecord) => void;
  /** Maximum file size in MB */
  maxSizeMB?: number;
  /** Show current profile assignment from AI */
  currentProfileName?: string | null;
}

export function ProfileUpload({
  profileId,
  profileData,
  onProfileChange,
  maxSizeMB = 10,
  currentProfileName,
}: ProfileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<ProfileRecord | null>(profileData || null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!file.name.match(/\.(svg|dxf)$/i)) {
      setError('Only SVG and DXF files are supported');
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    setUploading(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        if (!base64Data) {
          setError('Failed to encode file');
          setUploading(false);
          return;
        }

        // Compute SHA-256 hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base64Data));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Upload to backend
        try {
          const newProfile = await apiFetch<ProfileRecord>('/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              mimeType: file.type || `application/${file.name.endsWith('.svg') ? 'svg+xml' : 'vnd.dxf'}`,
              sizeBytes: file.size,
              dataBase64: base64Data,
              hash,
              metadata: {
                originalFilename: file.name,
              },
            }),
          });

          setProfile(newProfile);
          onProfileChange(newProfile.id, newProfile);
          setError(null);
        } catch (uploadError: any) {
          setError(uploadError.message || 'Failed to upload profile');
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      if (fileInputRef.current) {
        fileInputRef.current.files = files;
        handleFileSelect({
          target: { files } as any,
        } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const handleRemove = async () => {
    if (!profile) return;
    if (!confirm('Remove this profile?')) return;

    try {
      await apiFetch(`/profiles/${profile.id}`, { method: 'DELETE' });
      setProfile(null);
      onProfileChange(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to remove profile');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-semibold text-slate-900 block mb-2">
          Component Profile (SVG/DXF)
        </label>
        <p className="text-xs text-slate-600 mb-3">
          Upload a 2D profile that will be extruded to create this component's geometry
        </p>
      </div>

      {/* Current AI Assignment Info */}
      {currentProfileName && !profile && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <div className="flex gap-2">
            <Eye className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-blue-900">AI Assigned Profile: {currentProfileName}</p>
              <p className="text-blue-700 mt-1">
                OpenAI has automatically assigned a profile to this component based on its type and characteristics. 
                You can override this by uploading your own profile.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Profile Preview */}
      {profile && (
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{profile.name}</p>
                <p className="text-xs text-slate-500">
                  {(profile.sizeBytes / 1024).toFixed(1)} KB • {profile.mimeType.split('/')[1]?.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {profile.dataBase64 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                  className="gap-1"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {showPreview ? 'Hide' : 'View'}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRemove}
                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>

          {/* Profile Preview Display */}
          {showPreview && profile.dataBase64 && (
            <div className="mt-3 border-t pt-3">
              <ProfilePreview
                dataBase64={profile.dataBase64}
                mimeType={profile.mimeType}
                name={profile.name}
              />
            </div>
          )}
        </div>
      )}

      {/* Upload Area */}
      {!profile && (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.dxf"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />

          {uploading ? (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-medium text-slate-900">Uploading profile...</p>
            </>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-900">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-slate-600 mt-1">
                SVG or DXF (max {maxSizeMB}MB)
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Profile Preview Component
 * Renders SVG or simple DXF preview
 */
function ProfilePreview({
  dataBase64,
  mimeType,
  name,
}: {
  dataBase64: string;
  mimeType: string;
  name: string;
}) {
  if (mimeType.includes('svg')) {
    return (
      <div className="bg-white rounded border border-slate-200 p-3 max-h-64 overflow-auto">
        <svg
          srcSet={`data:${mimeType};base64,${dataBase64}`}
          className="max-w-full max-h-64 mx-auto"
          viewBox="0 0 200 200"
        />
      </div>
    );
  }

  if (mimeType.includes('dxf')) {
    // For DXF files, show a placeholder with instructions
    return (
      <div className="bg-white rounded border border-slate-200 p-4 text-center">
        <div className="text-xs text-slate-600 space-y-2">
          <p className="font-medium">DXF Profile Loaded</p>
          <p>
            DXF preview is not supported in the browser. Your DXF file has been uploaded and will be 
            processed on the server when generating the 3D model.
          </p>
          <p className="text-slate-500">
            File: {name} ({(dataBase64.length / 1024 / 1.33).toFixed(1)} KB decoded)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded border border-slate-200 p-3 text-center text-xs text-slate-600">
      Profile uploaded - preview not available for this format
    </div>
  );
}
