// Simple client-side heuristics for inferring opening dimensions and description from an image.
// No ML call yet; uses aspect ratio + sampled pixels for dominant color.

export interface ImageInferenceResult {
  widthMm?: number;
  heightMm?: number;
  description?: string;
  dominantColor?: string;
}

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

// Map aspect ratio to typical door/window canonical dimensions (mm)
function inferDimensionsFromAspect(w: number, h: number): { widthMm: number; heightMm: number } {
  const ratio = h > 0 ? w / h : 1;
  // External doors ~ 860-950mm wide, 1950-2150mm tall; windows vary widely.
  // Use ratio to decide if tall (door) or squarish (window/panel).
  if (ratio < 0.6) { // tall & narrow (portrait door)
    const width = 900; // mid typical
    const height = clamp(Math.round(width / ratio), 1950, 2200);
    return { widthMm: width, heightMm: height };
  } else if (ratio < 1.2) { // roughly square or modest portrait
    const width = 900;
    const height = clamp(Math.round(width / ratio), 1850, 2150);
    return { widthMm: width, heightMm: height };
  } else { // wide or landscape -> likely window or multi-panel
    const height = 1300; // mid window height
    const width = clamp(Math.round(height * ratio), 900, 2400);
    return { widthMm: width, heightMm: height };
  }
}

function sampleDominantColor(img: HTMLImageElement): string | undefined {
  try {
    const canvas = document.createElement('canvas');
    const size = 32; // downscale for speed
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i+1]; b += data[i+2]; count++;
    }
    r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
    return `rgb(${r},${g},${b})`;
  } catch { return undefined; }
}

function describeColor(rgb?: string): string | undefined {
  if (!rgb) return undefined;
  const m = rgb.match(/rgb\((\d+),(\d+),(\d+)\)/); if (!m) return undefined;
  const [_, rs, gs, bs] = m; const r = +rs, g = +gs, b = +bs;
  // crude hue buckets
  if (r > g * 1.2 && r > b * 1.2) return 'red';
  if (g > r * 1.1 && g > b * 1.1) return 'green';
  if (b > r * 1.1 && b > g * 1.1) return 'blue';
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r < 60 && g < 60 && b < 60) return 'dark';
  if (b > 140 && r > 140 && g < 110) return 'purple';
  if (r > 170 && g > 120 && b < 80) return 'orange';
  return 'neutral';
}

function buildDescription(baseLabel: string | undefined, colorWord: string | undefined, dims: {widthMm:number;heightMm:number}): string {
  const parts: string[] = [];
  if (colorWord && colorWord !== 'neutral' && colorWord !== 'dark') parts.push(colorWord);
  if (baseLabel) parts.push(baseLabel.replace(/[_-]+/g,' '));
  else parts.push('opening');
  parts.push(`${dims.widthMm}x${dims.heightMm}mm approx`);
  return parts.join(' ').replace(/\s+/g,' ').trim();
}

export async function inferFromImage(fileUrl: string, baseLabel?: string): Promise<ImageInferenceResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dims = inferDimensionsFromAspect(img.naturalWidth, img.naturalHeight);
      const rgb = sampleDominantColor(img);
      const colorWord = describeColor(rgb);
      const description = buildDescription(baseLabel, colorWord, dims);
      resolve({ widthMm: dims.widthMm, heightMm: dims.heightMm, description, dominantColor: rgb });
    };
    img.onerror = () => resolve({});
    img.src = fileUrl;
  });
}
