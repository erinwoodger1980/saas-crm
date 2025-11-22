import { API_BASE } from '@/lib/api-base';
import * as exifr from 'exifr';

export interface AiImageInferenceResult {
  width_mm: number | null;
  height_mm: number | null;
  description: string | null;
  confidence: number | null;
}

export async function inferOpeningFromImage(file: File, ctx?: { openingType?: string }): Promise<AiImageInferenceResult | null> {
  try {
    const processed = await preprocessImage(file);
    const resp = await fetch(`${API_BASE}/public/vision/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageHeadBase64: processed.truncatedBase64,
        fileName: file.name,
        openingType: ctx?.openingType || null,
        aspectRatio: processed.aspectRatio,
        exif: processed.exif
      })
    });
    if (!resp.ok) throw new Error('AI inference failed');
    return await resp.json();
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

  // Resize to max 1600px longest side to reduce token usage
  let resizedDataUrl = base64;
  try {
    const img = await loadImage(base64);
    const maxSide = 1600;
    const { width, height } = img;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    let aspectRatio: number | null = null;
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

    // Extract minimal EXIF data
    let exifData: any = null;
    try {
      exifData = await exifr.parse(file, ['Orientation', 'FocalLength', 'Model']);
    } catch {}
    const exifSubset = exifData ? {
      orientation: exifData.Orientation || null,
      focalLength: exifData.FocalLength || null,
      model: exifData.Model || null,
    } : null;

    return {
      truncatedBase64: resizedDataUrl.slice(0, 12000),
      aspectRatio,
      exif: exifSubset,
    };
  } catch {
    return { truncatedBase64: base64.slice(0, 12000), aspectRatio: null, exif: null };
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
