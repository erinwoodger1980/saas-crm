import { API_BASE } from '@/lib/api-base';
import * as exifr from 'exifr';

export interface AiImageInferenceResult {
  width_mm: number | null;
  height_mm: number | null;
  description: string | null;
  confidence: number | null;
  cached?: boolean;
}

export async function inferOpeningFromImage(file: File, ctx?: { openingType?: string }): Promise<AiImageInferenceResult | null> {
  try {
    const processed = await preprocessImage(file);
    // Hash the truncated base64 head (mirrors server cache hash)
    const encoder = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-1', encoder.encode(processed.truncatedBase64));
    const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');

    // Client-side cache (in-memory for session). Avoid network if already resolved.
    const g: any = globalThis as any;
    if (!g.__clientVisionCache) g.__clientVisionCache = new Map<string, AiImageInferenceResult>();
    const existing = g.__clientVisionCache.get(hash);
    if (existing) return existing;

    const resp = await fetch(`${API_BASE}/public/vision/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageHeadBase64: processed.truncatedBase64,
        fileName: file.name,
        openingType: ctx?.openingType || null,
        aspectRatio: processed.aspectRatio,
        exif: processed.exif,
        headHash: hash,
      })
    });
    if (!resp.ok) throw new Error('AI inference failed');
    const json = await resp.json();
    g.__clientVisionCache.set(hash, json);
    return json;
  } catch (e) {
    console.warn('[inferOpeningFromImage] failed', (e as any)?.message);
    return null;
  }
}

interface PreprocessResult {
  truncatedBase64: string;
  aspectRatio: number | null;
  exif: Record<string, any> | null;
}

async function preprocessImage(file: File): Promise<PreprocessResult> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  let resizedDataUrl = base64;
  let aspectRatio: number | null = null;
  try {
    const img = await loadImage(base64);
    const maxSide = 1600;
    const { width, height } = img;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    if (scale < 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx2 = canvas.getContext('2d');
      if (ctx2) ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
      resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      aspectRatio = canvas.width / canvas.height;
    } else {
      aspectRatio = width / height;
    }
  } catch {
    // keep original base64, aspectRatio stays null
  }

  let exifSubset: Record<string, any> | null = null;
  try {
    const exifData: any = await exifr.parse(file, ['Orientation', 'FocalLength', 'Model']);
    exifSubset = exifData ? {
      orientation: exifData.Orientation || null,
      focalLength: exifData.FocalLength || null,
      model: exifData.Model || null,
    } : null;
  } catch {}

  return {
    truncatedBase64: resizedDataUrl.slice(0, 12000),
    aspectRatio,
    exif: exifSubset,
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
