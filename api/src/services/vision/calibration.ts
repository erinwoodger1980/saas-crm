export function calibrateConfidence(openingType: string | undefined, width?: number | null, height?: number | null, base?: number | null): number {
  let c = typeof base === 'number' && base >= 0 ? base : 0.35;
  const w = width || 0; const h = height || 0;
  // Canonical ranges
  if (openingType === 'external_door') {
    const inRange = w >= 820 && w <= 950 && h >= 1900 && h <= 2150;
    c += inRange ? 0.15 : -0.1;
  } else if (openingType === 'internal_door') {
    const inRange = w >= 700 && w <= 830 && h >= 1900 && h <= 2050;
    c += inRange ? 0.12 : -0.08;
  } else if (openingType === 'window') {
    if (w < 300 || h < 300) c -= 0.15; else c += 0.05;
  } else if (openingType === 'bifold' || openingType === 'french_doors' || openingType === 'patio_doors') {
    if (w > 1600 && h > 1800) c += 0.08; else c -= 0.05;
  }
  // Penalize extreme improbable sizes
  if (w && (w < 400 || w > 3500)) c -= 0.1;
  if (h && (h < 400 || h > 3500)) c -= 0.1;
  // Clamp
  if (c < 0.15) c = 0.15;
  if (c > 0.95) c = 0.95;
  return +c.toFixed(3);
}

export function combineConfidence(primary: number, secondary?: number | null): number {
  if (secondary == null) return primary;
  // Weighted blend (primary 70%)
  const blended = primary * 0.7 + secondary * 0.3;
  return +blended.toFixed(3);
}
