import fs from "fs/promises";
import path from "path";

export interface SupplierPattern {
  supplier: string;
  slug: string;
  headerKeywords?: string[];
  columnXSplits?: number[];
  commonUnits?: string[];
  regexes?: string[];
  updatedAt: string;
  usageCount: number;
}

export interface PatternCues {
  supplier?: string;
  headerKeywords?: string[];
  columnXSplits?: number[];
  commonUnits?: string[];
  regexes?: string[];
}

const BASE_DIR = path.join(process.cwd(), "api", "storage", "patterns");

function uniq(values: ReadonlyArray<string> | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

export function slugifySupplier(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

export async function loadSupplierPattern(supplierHint: string | undefined): Promise<SupplierPattern | null> {
  if (!supplierHint) return null;
  const slug = slugifySupplier(supplierHint);
  if (!slug) return null;
  const file = path.join(BASE_DIR, `${slug}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as SupplierPattern;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    console.warn(`[patterns] Failed to load pattern for ${supplierHint}:`, err);
    return null;
  }
}

export async function saveSupplierPattern(cues: PatternCues): Promise<SupplierPattern | null> {
  const supplier = cues.supplier?.trim();
  if (!supplier) return null;
  const slug = slugifySupplier(supplier);
  if (!slug) return null;

  const existing = await loadSupplierPattern(supplier);
  const pattern: SupplierPattern = {
    supplier,
    slug,
    headerKeywords: uniq([...(existing?.headerKeywords ?? []), ...(cues.headerKeywords ?? [])]),
    columnXSplits: cues.columnXSplits?.length ? Array.from(new Set([...(existing?.columnXSplits ?? []), ...cues.columnXSplits])).sort((a, b) => a - b) : existing?.columnXSplits,
    commonUnits: uniq([...(existing?.commonUnits ?? []), ...(cues.commonUnits ?? [])]),
    regexes: uniq([...(existing?.regexes ?? []), ...(cues.regexes ?? [])]),
    updatedAt: new Date().toISOString(),
    usageCount: (existing?.usageCount ?? 0) + 1,
  };

  const file = path.join(BASE_DIR, `${pattern.slug}.json`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(pattern, null, 2), "utf8");
  return pattern;
}
