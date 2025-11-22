import { API_BASE } from '@/lib/api-base';

export interface AiImageInferenceResult {
  width_mm: number | null;
  height_mm: number | null;
  description: string | null;
  confidence: number | null;
}

export async function inferOpeningFromImage(file: File): Promise<AiImageInferenceResult | null> {
  try {
    const base64 = await toBase64(file);
    const resp = await fetch(`${API_BASE}/public/vision/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, fileName: file.name })
    });
    if (!resp.ok) throw new Error('AI inference failed');
    return await resp.json();
  } catch (e) {
    console.warn('[inferOpeningFromImage] failed', (e as any)?.message);
    return null;
  }
}

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
