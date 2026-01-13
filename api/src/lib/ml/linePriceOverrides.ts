import crypto from "crypto";

function stableJsonStringify(value: any): string {
  const seen = new WeakSet<object>();
  const walk = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    if (seen.has(v)) return null;
    seen.add(v);
    const out: any = {};
    for (const key of Object.keys(v).sort()) {
      const next = walk(v[key]);
      if (next !== undefined) out[key] = next;
    }
    return out;
  };
  return JSON.stringify(walk(value));
}

function normString(v: any): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.toLowerCase();
}

function normInt(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded <= 0 || rounded > 20000) return null;
  return rounded;
}

export type LinePriceFeatures = {
  productType?: string;
  widthMm?: number;
  heightMm?: number;
  timber?: string;
  finish?: string;
  glazing?: string;
  ironmongery?: string;
};

export function normaliseLinePriceFeatures(input: any): LinePriceFeatures {
  const src = input && typeof input === "object" ? input : {};

  const features: LinePriceFeatures = {};

  const productType = normString(src.productType ?? src.product_type ?? src.type);
  if (productType) features.productType = productType;

  const widthMm = normInt(src.widthMm ?? src.width_mm ?? src.width);
  const heightMm = normInt(src.heightMm ?? src.height_mm ?? src.height);
  if (widthMm != null) features.widthMm = widthMm;
  if (heightMm != null) features.heightMm = heightMm;

  const timber = normString(src.timber ?? src.timberSpecies ?? src.timber_type ?? src.wood ?? src.material);
  const finish = normString(src.finish ?? src.finishType ?? src.coating ?? src.paint);
  const glazing = normString(src.glazing ?? src.glass ?? src.glassType);
  const ironmongery = normString(src.ironmongery ?? src.hardwareType ?? src.hardware);

  if (timber) features.timber = timber;
  if (finish) features.finish = finish;
  if (glazing) features.glazing = glazing;
  if (ironmongery) features.ironmongery = ironmongery;

  return features;
}

export function linePriceFeatureHash(tenantId: string, features: LinePriceFeatures): string {
  const payload = { tenantId, features };
  return crypto.createHash("sha256").update(stableJsonStringify(payload)).digest("hex");
}

export function linePriceSpecHash(tenantId: string, features: LinePriceFeatures): string {
  // Same as feature hash, but intentionally excludes dimensions so we can
  // match "same answers except width/height" and scale the price parametrically.
  const payload = {
    tenantId,
    features: {
      productType: features.productType ?? undefined,
      timber: features.timber ?? undefined,
      finish: features.finish ?? undefined,
      glazing: features.glazing ?? undefined,
      ironmongery: features.ironmongery ?? undefined,
    },
  };
  return crypto.createHash("sha256").update(stableJsonStringify(payload)).digest("hex");
}

export function isUsableLinePriceFeatures(features: LinePriceFeatures): boolean {
  // Minimum signal: type + dimensions OR type + at least one spec.
  const hasType = !!features.productType;
  const hasDims = features.widthMm != null && features.heightMm != null;
  const hasSpec = !!(features.timber || features.finish || features.glazing || features.ironmongery);
  return hasType && (hasDims || hasSpec);
}

export function scaleUnitNetGBPByArea(opts: {
  baseUnitNetGBP: number;
  baseWidthMm: number;
  baseHeightMm: number;
  widthMm: number;
  heightMm: number;
  minScale?: number;
  maxScale?: number;
}): { unitNetGBP: number; scale: number } | null {
  const baseUnit = Number(opts.baseUnitNetGBP);
  const baseW = Number(opts.baseWidthMm);
  const baseH = Number(opts.baseHeightMm);
  const inW = Number(opts.widthMm);
  const inH = Number(opts.heightMm);
  if (!(Number.isFinite(baseUnit) && baseUnit > 0)) return null;
  if (!(Number.isFinite(baseW) && baseW > 0 && Number.isFinite(baseH) && baseH > 0)) return null;
  if (!(Number.isFinite(inW) && inW > 0 && Number.isFinite(inH) && inH > 0)) return null;

  const baseArea = baseW * baseH;
  const inArea = inW * inH;
  if (!(Number.isFinite(baseArea) && baseArea > 0 && Number.isFinite(inArea) && inArea > 0)) return null;

  let scale = inArea / baseArea;
  if (!Number.isFinite(scale) || scale <= 0) return null;

  const minScale = Number.isFinite(Number(opts.minScale)) ? Number(opts.minScale) : 0.4;
  const maxScale = Number.isFinite(Number(opts.maxScale)) ? Number(opts.maxScale) : 3.0;
  scale = Math.max(minScale, Math.min(maxScale, scale));

  return { unitNetGBP: baseUnit * scale, scale };
}
