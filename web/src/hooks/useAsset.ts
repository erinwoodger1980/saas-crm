/**
 * Asset Cache Hook for GLTF Loading
 * Manages in-memory cache of loaded GLTF models
 * Converts base64 → Blob → ObjectURL for GLTFLoader
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import type { AssetRecord } from '@/types/asset';

interface CachedAsset {
  objectURL: string;
  blob: Blob;
  loadedAt: number;
}

// Global cache shared across all hook instances
const assetCache = new Map<string, CachedAsset>();

// Cleanup old object URLs on unmount or when cache grows too large
const MAX_CACHE_SIZE = 50;
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function cleanupCache() {
  const now = Date.now();
  const entries = Array.from(assetCache.entries());
  
  // Remove expired entries
  entries.forEach(([id, cached]) => {
    if (now - cached.loadedAt > CACHE_EXPIRY_MS) {
      URL.revokeObjectURL(cached.objectURL);
      assetCache.delete(id);
    }
  });
  
  // If still too large, remove oldest entries
  if (assetCache.size > MAX_CACHE_SIZE) {
    const sorted = entries.sort((a, b) => a[1].loadedAt - b[1].loadedAt);
    const toRemove = sorted.slice(0, assetCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([id, cached]) => {
      URL.revokeObjectURL(cached.objectURL);
      assetCache.delete(id);
    });
  }
}

export interface UseAssetResult {
  /** Object URL ready for GLTFLoader */
  objectURL: string | null;
  /** Loading state */
  loading: boolean;
  /** Error message if load failed */
  error: string | null;
}

/**
 * Hook to load and cache GLTF assets
 * Returns object URL ready for <primitive object={useGLTF(objectURL)} />
 */
export function useAsset(assetId: string | null | undefined): UseAssetResult {
  const [objectURL, setObjectURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadInitiated = useRef(false);

  useEffect(() => {
    if (!assetId) {
      setObjectURL(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cached = assetCache.get(assetId);
    if (cached) {
      setObjectURL(cached.objectURL);
      setLoading(false);
      setError(null);
      return;
    }

    // Guard against double-load in strict mode
    if (loadInitiated.current) return;
    loadInitiated.current = true;

    async function loadAsset() {
      setLoading(true);
      setError(null);

      try {
        // Fetch asset from API
        const asset = await apiFetch<AssetRecord>(`/assets/${assetId}`);

        // Convert base64 to Blob
        const binaryString = atob(asset.dataBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: asset.mimeType });

        // Create object URL
        const url = URL.createObjectURL(blob);

        // Cache it
        if (assetId) {
          assetCache.set(assetId, {
            objectURL: url,
            blob,
            loadedAt: Date.now(),
          });
        }

        setObjectURL(url);
        
        // Cleanup old cache entries
        cleanupCache();
      } catch (err: any) {
        console.error('[useAsset] Failed to load asset:', err);
        setError(err.message || 'Failed to load asset');
      } finally {
        setLoading(false);
        loadInitiated.current = false;
      }
    }

    loadAsset();
  }, [assetId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't revoke URLs immediately on unmount; cache handles cleanup
    };
  }, []);

  return { objectURL, loading, error };
}

/**
 * Manually preload assets
 * Useful for eager loading before rendering
 */
export function preloadAsset(assetId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // Check cache
    const cached = assetCache.get(assetId);
    if (cached) {
      resolve(cached.objectURL);
      return;
    }

    try {
      const asset = await apiFetch<AssetRecord>(`/assets/${assetId}`);
      const binaryString = atob(asset.dataBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: asset.mimeType });
      const url = URL.createObjectURL(blob);

      assetCache.set(assetId, {
        objectURL: url,
        blob,
        loadedAt: Date.now(),
      });

      cleanupCache();
      resolve(url);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clear entire asset cache
 * Useful for forced refresh
 */
export function clearAssetCache() {
  assetCache.forEach((cached) => {
    URL.revokeObjectURL(cached.objectURL);
  });
  assetCache.clear();
}
