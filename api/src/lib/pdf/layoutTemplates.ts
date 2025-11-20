import { prisma } from "../../db";
import type { SupplierParseResult } from "../../types/parse";
import { assessDescriptionQuality } from "./quality";

export type AnnotationLabel =
  | "joinery_image"
  | "description"
  | "qty"
  | "unit_cost"
  | "line_total"
  | "delivery_row"
  | "header_logo"
  | "ignore";

export interface LayoutTemplateAnnotation {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: AnnotationLabel;
  rowId?: string | null;
}

export interface LayoutTemplateRecord {
  id: string;
  name: string;
  supplierProfileId?: string | null;
  annotations: LayoutTemplateAnnotation[];
  pageCount?: number | null;
  pageSizes?: { width: number; height: number }[];
}

export interface PdfLayout {
  pages: { width: number; height: number }[];
  textBlocks: PositionedText[];
}

export interface RawRow {
  descriptionText: string;
  qtyText?: string | null;
  unitText?: string | null;
  totalText?: string | null;
  page: number;
  rowKey: string;
  isDelivery?: boolean;
  hasImage?: boolean;
}

export interface TemplateParseMeta {
  templateId: string;
  templateName?: string;
  supplierProfileId?: string | null;
  annotationCount: number;
  matchedAnnotations: number;
  matchedRows: number;
  method: "template" | "template_failed";
  reason?: string;
}

export interface TemplateParseOptions {
  currencyHint?: string;
  supplierHint?: string;
  minLines?: number;
}

export interface TemplateParseOutcome {
  result?: SupplierParseResult;
  meta: TemplateParseMeta;
}

type PositionedText = {
  pageIndex: number;
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const DEFAULT_MIN_LINES = 1;

const SUPPORTED_LABELS: Record<AnnotationLabel, boolean> = {
  joinery_image: true,
  description: true,
  qty: true,
  unit_cost: true,
  line_total: true,
  delivery_row: true,
  header_logo: false,
  ignore: false,
};

export type RowAnnotationsMap = Record<string, LayoutTemplateAnnotation[]>;

function shouldFallbackPdfTemplateQuery(err: any): boolean {
  if (!err) return false;
  const msg = (err?.message || String(err || "")) as string;
  if (!msg) return false;
  return /createdByUserId/i.test(msg) && /does not exist|Unknown column/i.test(msg);
}

export async function loadPdfLayoutTemplate(profileId: string | null | undefined): Promise<LayoutTemplateRecord | null> {
  if (!profileId) return null;
  try {
    const record = await prisma.pdfLayoutTemplate.findFirst({
      where: { supplierProfileId: profileId },
      orderBy: { updatedAt: "desc" },
      include: {
        annotations: {
          orderBy: [{ page: "asc" }, { y: "asc" }, { x: "asc" }],
        },
      },
    });
    if (!record) return null;

    const annotations = normaliseAnnotations(record.annotations);
    if (!annotations.length) return null;

    const pageSizes = extractPageSizes(record.meta);

    return {
      id: record.id,
      name: record.name,
      supplierProfileId: record.supplierProfileId ?? undefined,
      annotations,
      pageCount: record.pageCount ?? undefined,
      pageSizes,
    };
  } catch (err: any) {
    if (!shouldFallbackPdfTemplateQuery(err)) throw err;
    console.warn("[pdfTemplate] Schema mismatch detected, loading template via legacy fallback:", err?.message || err);
    return await loadPdfLayoutTemplateFallback(profileId);
  }
}

async function loadPdfLayoutTemplateFallback(profileId: string): Promise<LayoutTemplateRecord | null> {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT "id", "name", "supplierProfileId", "pageCount", "meta", "updatedAt" FROM "PdfLayoutTemplate" WHERE "supplierProfileId" = $1 ORDER BY "updatedAt" DESC LIMIT 1`,
    profileId,
  );
  const record = rows[0];
  if (!record) return null;

  const annotations = await prisma.pdfLayoutAnnotation.findMany({
    where: { templateId: record.id },
    orderBy: [{ page: "asc" }, { y: "asc" }, { x: "asc" }],
  });
  const normalised = normaliseAnnotations(annotations);
  if (!normalised.length) return null;

  const pageSizes = extractPageSizes(record.meta);

  return {
    id: record.id,
    name: record.name,
    supplierProfileId: record.supplierProfileId ?? undefined,
    annotations: normalised,
    pageCount: record.pageCount ?? undefined,
    pageSizes,
  };
}

export function groupAnnotationsByRow(annotations: LayoutTemplateAnnotation[]): RowAnnotationsMap {
  const map: RowAnnotationsMap = {};
  for (const annotation of annotations) {
    if (!SUPPORTED_LABELS[annotation.label]) continue;
    const page = annotation.page ?? 1;
    const bucket = annotation.rowId?.trim()
      ? annotation.rowId.trim()
      : `auto-${page}-${Math.round((annotation.y + annotation.height / 2) * 1000)}`;
    const key = `${page}:${bucket}`;
    if (!map[key]) map[key] = [];
    map[key].push(annotation);
  }

  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      const ay = a.y + a.height / 2;
      const by = b.y + b.height / 2;
      if (Math.abs(ay - by) > 0.01) return ay - by;
      const ax = a.x + a.width / 2;
      const bx = b.x + b.width / 2;
      return ax - bx;
    });
  }

  return map;
}

export function collectTextInRegions(
  layout: PdfLayout,
  pageIndex: number,
  rowAnnotations: LayoutTemplateAnnotation[],
  label: AnnotationLabel,
): string {
  const blocks = layout.textBlocks.filter((block) => block.pageIndex === pageIndex);
  if (!blocks.length) return "";
  const annotations = rowAnnotations.filter((ann) => ann.label === label);
  if (!annotations.length) return "";

  const parts: string[] = [];
  for (const ann of annotations) {
    const { text } = collectTextForAnnotation(blocks, ann);
    if (text) parts.push(text);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function extractRowsUsingTemplate(
  layout: PdfLayout,
  template: LayoutTemplateRecord,
): { rows: RawRow[]; matchedAnnotations: number } {
  const map = groupAnnotationsByRow(template.annotations);
  const rows: RawRow[] = [];
  let matchedAnnotations = 0;

  for (const [rowKey, annotations] of Object.entries(map)) {
    if (!annotations.length) continue;
    const first = annotations[0];
    const pageIndex = Math.max(0, (first.page ?? 1) - 1);
    const blocks = layout.textBlocks.filter((block) => block.pageIndex === pageIndex);
    if (!blocks.length) continue;

    const descriptionParts: string[] = [];
    let qtyText: string | null = null;
    let unitText: string | null = null;
    let totalText: string | null = null;
    let isDelivery = false;
    let hasImage = false;

    for (const annotation of annotations) {
      if (!SUPPORTED_LABELS[annotation.label]) continue;

      if (annotation.label === "joinery_image") {
        hasImage = true;
        continue;
      }

      if (annotation.label === "delivery_row") {
        isDelivery = true;
      }

      const { text, matched } = collectTextForAnnotation(blocks, annotation);
      if (matched) matchedAnnotations += 1;

      if (!text) continue;

      switch (annotation.label) {
        case "description":
          descriptionParts.push(text);
          break;
        case "qty":
          qtyText = qtyText ?? text;
          break;
        case "unit_cost":
          unitText = unitText ?? text;
          break;
        case "line_total":
          totalText = totalText ?? text;
          break;
        case "delivery_row":
          descriptionParts.push(text);
          break;
        default:
          break;
      }
    }

    const description = descriptionParts.join(" ").replace(/\s+/g, " ").trim();
    if (!description && !qtyText && !unitText && !totalText) {
      continue;
    }

    rows.push({
      descriptionText: description,
      qtyText: qtyText ?? null,
      unitText: unitText ?? null,
      totalText: totalText ?? null,
      page: first.page ?? 1,
      rowKey,
      isDelivery,
      hasImage,
    });
  }

  return { rows, matchedAnnotations };
}

function applyDescriptionQualityGate<T extends { description: string; meta?: Record<string, any> }>(
  lines: T[],
  sampleLimit = 5,
): { lines: T[]; rejected: number; samples: string[] } {
  const kept: T[] = [];
  let rejected = 0;
  const samples: string[] = [];

  for (const line of lines) {
    const assessment = assessDescriptionQuality(line.description);
    line.meta = {
      ...(line.meta || {}),
      descriptionQuality: assessment.score,
      descriptionQualityReasons: assessment.reasons,
    };

    if (assessment.gibberish) {
      rejected += 1;
      if (samples.length < sampleLimit) {
        samples.push(line.description.slice(0, 140));
      }
      continue;
    }

    kept.push(line);
  }

  return { lines: kept, rejected, samples };
}

export async function parsePdfWithTemplate(
  buffer: Buffer,
  template: LayoutTemplateRecord,
  options: TemplateParseOptions = {}
): Promise<TemplateParseOutcome> {
  const annotations = Array.isArray(template.annotations)
    ? template.annotations.filter((ann) => ann && typeof ann.x === "number" && typeof ann.y === "number")
    : [];

  const baseMeta: TemplateParseMeta = {
    templateId: template.id,
    templateName: template.name,
    supplierProfileId: template.supplierProfileId ?? undefined,
    annotationCount: annotations.length,
    matchedAnnotations: 0,
    matchedRows: 0,
    method: "template_failed",
    reason: undefined,
  };

  if (!annotations.length) {
    return {
      meta: {
        ...baseMeta,
        reason: "no_annotations",
      },
    };
  }

  const layout = await extractPositionedText(buffer);
  if (!layout.textBlocks.length) {
    return {
      meta: {
        ...baseMeta,
        reason: "no_text_blocks",
      },
    };
  }

  const extraction = extractRowsUsingTemplate(
    layout,
    {
      ...template,
      annotations,
    }
  );

  const extractedLines = extraction.rows
    .map((row) => convertRowToLine(row))
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  const qualityGate = applyDescriptionQualityGate(extractedLines);
  const lines = qualityGate.lines;

  const meta: TemplateParseMeta = {
    ...baseMeta,
    matchedAnnotations: extraction.matchedAnnotations,
    matchedRows: lines.length,
    method: lines.length >= (options.minLines ?? DEFAULT_MIN_LINES) ? "template" : "template_failed",
    reason:
      lines.length > 0
        ? undefined
        : qualityGate.rejected > 0 && extractedLines.length > 0
        ? "quality_rejected"
        : "no_rows_extracted",
  };

  if (meta.method !== "template") {
    return { meta };
  }

  const detectedTotals = computeTotals(lines);
  const warnings: string[] = [];
  if (qualityGate.rejected) {
    warnings.push(`Discarded ${qualityGate.rejected} low-quality OCR rows`);
  }
  const hasMissingPrices = lines.some((line) => line.costUnit == null && line.lineTotal == null);
  if (hasMissingPrices) {
    warnings.push("Template matched rows but some prices were missing");
  }

  const descriptionQualityMeta =
    qualityGate.rejected || qualityGate.samples.length
      ? {
          method: "template",
          rejected: qualityGate.rejected,
          kept: lines.length,
          samples: qualityGate.samples.length ? qualityGate.samples : undefined,
        }
      : undefined;

  const supplierResult: SupplierParseResult = {
    currency: options.currencyHint || "GBP",
    supplier: options.supplierHint,
    lines: lines.map((line) => ({
      ...line,
      meta: {
        ...(line.meta || {}),
        templateRowId: (line.meta as any)?.templateRowId,
        templateMatched: true,
      },
    })),
    detected_totals: detectedTotals,
    confidence: computeConfidence(lines),
    warnings: warnings.length ? warnings : undefined,
    usedStages: ["template"],
    meta: {
      template: meta,
        ...(descriptionQualityMeta ? { descriptionQuality: descriptionQualityMeta } : {}),
    },
  };

  return { result: supplierResult, meta };
}

async function extractPositionedText(buffer: Buffer): Promise<PdfLayout> {
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.js");
  const loadingTask = pdfjsLib.getDocument({ data: buffer, useWorker: false });
  const doc = await loadingTask.promise;
  const textBlocks: PositionedText[] = [];
  const pages: { width: number; height: number }[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      pages[pageNumber - 1] = { width: viewport.width, height: viewport.height };
      const content = await page.getTextContent();
      const items = content.items as any[];

      for (const item of items) {
        const rawText = typeof item.str === "string" ? item.str : "";
        const text = rawText.replace(/\s+/g, " ").trim();
        if (!text) continue;

        const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const x = transform[4];
        const y = transform[5];
        const width = (item.width ?? Math.hypot(transform[0], transform[2])) || 0;
        const height = Math.hypot(transform[1], transform[3]) || (item.height ?? 0);

        const left = clamp(x / viewport.width);
        const top = clamp(1 - y / viewport.height);
        const normWidth = clamp(width / viewport.width);
        const normHeight = clamp(height / viewport.height);

        textBlocks.push({
          pageIndex: pageNumber - 1,
          text,
          left,
          top,
          right: clamp(left + normWidth),
          bottom: clamp(top + normHeight),
        });
      }

      page.cleanup?.();
    }
  } finally {
    await doc.destroy();
  }

  return { pages, textBlocks: sortTextBlocks(textBlocks) };
}

function convertRowToLine(row: RawRow) {
  const description = row.descriptionText.replace(/\s+/g, " ").trim();
  if (!description) return null;

  const qty = parseQuantity(row.qtyText || undefined);
  const costUnit = parseMoney(row.unitText || undefined);
  const lineTotal = parseMoney(row.totalText || undefined);

  return {
    description,
    qty: qty ?? undefined,
    unit: undefined,
    costUnit: costUnit ?? undefined,
    lineTotal: lineTotal ?? undefined,
    meta: {
      templateRowId: row.rowKey,
      templateIsDelivery: row.isDelivery ?? false,
      templateHasImage: row.hasImage ?? false,
    },
  };
}

function computeTotals(lines: SupplierParseResult["lines"]): SupplierParseResult["detected_totals"] {
  let subtotal = 0;
  let delivery = 0;

  for (const line of lines) {
    const total = line.lineTotal ?? ((line.costUnit ?? 0) * (line.qty ?? 1));
    const numeric = Number.isFinite(total) ? Number(total) : 0;
    const isDelivery = Boolean((line.meta as any)?.templateIsDelivery);
    if (isDelivery) {
      delivery += numeric;
    } else {
      subtotal += numeric;
    }
  }

  const detected: SupplierParseResult["detected_totals"] = {};
  if (subtotal > 0) detected.subtotal = roundCurrency(subtotal);
  if (delivery > 0) detected.delivery = roundCurrency(delivery);
  if (subtotal + delivery > 0) detected.estimated_total = roundCurrency(subtotal + delivery);
  return Object.keys(detected).length ? detected : undefined;
}

function computeConfidence(lines: SupplierParseResult["lines"]): number {
  if (!lines.length) return 0;
  let score = 0;
  for (const line of lines) {
    if (line.qty != null && line.costUnit != null && line.lineTotal != null) {
      score += 1;
    } else if (line.lineTotal != null && (line.qty != null || line.costUnit != null)) {
      score += 0.75;
    } else if (line.lineTotal != null) {
      score += 0.5;
    } else if (line.costUnit != null) {
      score += 0.35;
    }
  }
  return Math.min(1, Number((score / lines.length).toFixed(2)));
}

function parseQuantity(text?: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function parseMoney(text?: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9,.-]/g, "");
  if (!cleaned) return null;
  const normalized = normalizeNumeric(cleaned);
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function normalizeNumeric(value: string): string | null {
  if (!value) return null;
  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  if (hasComma && hasDot) {
    return value.replace(/,/g, "");
  }
  if (hasComma && !hasDot) {
    const segments = value.split(",");
    if (segments[segments.length - 1]?.length === 2) {
      return value.replace(/,/g, ".");
    }
    return value.replace(/,/g, "");
  }
  return value;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function normaliseAnnotations(raw: any): LayoutTemplateAnnotation[] {
  if (!raw) return [];
  let list: any[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  } else if (typeof raw === "object") {
    list = [raw];
  }

  const annotations: LayoutTemplateAnnotation[] = [];
  list.forEach((entry, idx) => {
    if (!entry || typeof entry !== "object") return;
    const label = normaliseAnnotationLabel((entry as any).label);
    if (!label) return;
    const page = Number((entry as any).page ?? 1);
    const x = Number((entry as any).x);
    const y = Number((entry as any).y);
    const width = Number((entry as any).width);
    const height = Number((entry as any).height);
    if (!Number.isFinite(page) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    const id = typeof (entry as any).id === "string" && (entry as any).id ? (entry as any).id : `ann-${idx}`;
    const rowId =
      typeof (entry as any).rowId === "string" && (entry as any).rowId ? (entry as any).rowId : undefined;

    const normalised: LayoutTemplateAnnotation = {
      id,
      page: page || 1,
      x: clamp(x),
      y: clamp(y),
      width: clamp(width),
      height: clamp(height),
      label,
    };
    if (rowId) {
      normalised.rowId = rowId;
    }
    annotations.push(normalised);
  });

  return annotations;
}

function normaliseAnnotationLabel(label: unknown): AnnotationLabel | null {
  if (typeof label !== "string") return null;
  const trimmed = label.trim().toLowerCase().replace(/\s+/g, "_");
  if (SUPPORTED_LABELS[trimmed as AnnotationLabel]) {
    return trimmed as AnnotationLabel;
  }
  return null;
}

function extractPageSizes(meta: unknown): { width: number; height: number }[] | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const sizes = (meta as any).pageSizes;
  if (!Array.isArray(sizes)) return undefined;
  const parsed = sizes
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const width = Number((entry as any).width);
      const height = Number((entry as any).height);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
      return { width, height };
    })
    .filter((value): value is { width: number; height: number } => Boolean(value));
  return parsed.length ? parsed : undefined;
}

function collectTextForAnnotation(
  blocks: PositionedText[],
  annotation: LayoutTemplateAnnotation,
): { text: string; matched: boolean } {
  const minX = annotation.x;
  const maxX = annotation.x + annotation.width;
  const minY = annotation.y;
  const maxY = annotation.y + annotation.height;
  const tolerance = 0.005;

  const matchedBlocks = blocks
    .filter((block) => {
      const centerX = (block.left + block.right) / 2;
      const centerY = (block.top + block.bottom) / 2;
      return (
        centerX >= minX - tolerance &&
        centerX <= maxX + tolerance &&
        centerY >= minY - tolerance &&
        centerY <= maxY + tolerance
      );
    })
    .sort((a, b) => {
      if (Math.abs(a.top - b.top) > 0.005) return a.top - b.top;
      return a.left - b.left;
    });

  const text = matchedBlocks.map((block) => block.text).join(" ").replace(/\s+/g, " ").trim();
  return { text, matched: matchedBlocks.length > 0 };
}

function sortTextBlocks(blocks: PositionedText[]): PositionedText[] {
  return blocks.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    if (Math.abs(a.top - b.top) > 0.005) return a.top - b.top;
    return a.left - b.left;
  });
}
