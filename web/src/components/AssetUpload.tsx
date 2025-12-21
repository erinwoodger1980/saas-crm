/**
 * Asset Upload Component
 * For GLB/GLTF file upload with base64 encoding and SHA-256 hashing
 */
'use client';

import { useState } from 'react';
import { Upload, X, Loader2, Box, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import type { AssetRecord, AssetTransform, DEFAULT_ASSET_TRANSFORM } from '@/types/asset';

interface AssetUploadProps {
  /** Current asset ID if already uploaded */
  assetId?: string | null;
  /** Current transform if set */
  transform?: AssetTransform;
  /** Callback when asset is uploaded/changed */
  onAssetChange: (assetId: string | null, transform?: AssetTransform) => void;
  /** Maximum file size in MB */
  maxSizeMB?: number;
}

export function AssetUpload({
  assetId,
  transform,
  onAssetChange,
  maxSizeMB = 10,
}: AssetUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Load asset details if assetId provided
  useState(() => {
    if (assetId && !asset) {
      apiFetch<AssetRecord>(`/assets/${assetId}`)
        .then(setAsset)
        .catch(() => setAsset(null));
    }
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!file.name.match(/\.(glb|gltf)$/i)) {
      setError('Invalid file type. Only .glb and .gltf files are supported.');
      return;
    }

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    setUploading(true);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert to base64
      const base64 = btoa(String.fromCharCode(...uint8Array));

      // Compute SHA-256 hash for deduplication
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Determine MIME type
      const mimeType = file.name.toLowerCase().endsWith('.glb')
        ? 'model/gltf-binary'
        : 'model/gltf+json';

      // Upload to API
      const newAsset = await apiFetch<AssetRecord>('/assets', {
        method: 'POST',
        json: {
          name: file.name,
          mimeType,
          sizeBytes: file.size,
          dataBase64: base64,
          hash,
          metadata: {
            originalFilename: file.name,
          },
        },
      });

      setAsset(newAsset);
      
      // Notify parent with default transform
      const defaultTransform: AssetTransform = {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      };
      onAssetChange(newAsset.id, transform || defaultTransform);
    } catch (err: any) {
      console.error('Asset upload error:', err);
      setError(err.message || 'Failed to upload asset');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setAsset(null);
    onAssetChange(null);
  };

  const handleTransformChange = (field: keyof AssetTransform, index: number, value: number) => {
    const currentTransform = transform || {
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };

    const updated = { ...currentTransform };
    updated[field] = [...updated[field]] as [number, number, number];
    updated[field][index] = value;

    onAssetChange(assetId || null, updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          3D Model (GLB/GLTF)
        </label>
        
        {!asset ? (
          <div className="relative">
            <input
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="sr-only"
              id="asset-upload"
            />
            <label
              htmlFor="asset-upload"
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
                uploading
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" />
                  <p className="text-sm text-slate-600">Uploading...</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-slate-400 mb-3" />
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-slate-500">
                    GLB or GLTF (max {maxSizeMB}MB)
                  </p>
                </>
              )}
            </label>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Box className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{asset.name}</p>
                  <p className="text-xs text-slate-500">
                    {asset.mimeType} • {(asset.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>

            {/* Transform Editor */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Transform</p>
              
              {/* Position */}
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Position (mm)</label>
                <div className="grid grid-cols-3 gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <input
                      key={axis}
                      type="number"
                      step="1"
                      value={transform?.position?.[i] ?? 0}
                      onChange={(e) => handleTransformChange('position', i, parseFloat(e.target.value) || 0)}
                      placeholder={axis}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                    />
                  ))}
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Rotation (deg)</label>
                <div className="grid grid-cols-3 gap-2">
                  {['RX', 'RY', 'RZ'].map((axis, i) => (
                    <input
                      key={axis}
                      type="number"
                      step="1"
                      value={((transform?.rotation?.[i] ?? 0) * 180 / Math.PI).toFixed(0)}
                      onChange={(e) => {
                        const degrees = parseFloat(e.target.value) || 0;
                        const radians = (degrees * Math.PI) / 180;
                        handleTransformChange('rotation', i, radians);
                      }}
                      placeholder={axis}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                    />
                  ))}
                </div>
              </div>

              {/* Scale */}
              <div>
                <label className="text-xs text-slate-600 mb-1 block">Scale</label>
                <div className="grid grid-cols-3 gap-2">
                  {['SX', 'SY', 'SZ'].map((axis, i) => (
                    <input
                      key={axis}
                      type="number"
                      step="0.1"
                      value={transform?.scale?.[i] ?? 1}
                      onChange={(e) => handleTransformChange('scale', i, parseFloat(e.target.value) || 1)}
                      placeholder={axis}
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-3">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
