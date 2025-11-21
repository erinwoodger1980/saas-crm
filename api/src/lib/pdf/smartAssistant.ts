/**
 * Smart PDF assistant layer
 * -------------------------
 * This module combines three signals to link questionnaire items with PDF rows:
 *   1. Questionnaire openings/specs (expected description + dimensions + qty).
 *   2. Annotated layout templates (column regions + optional images + bbox hints).
 *   3. Parsed PDF text/rows (either template-derived or heuristic parser output).
 *
 * Pipeline summary:
 *   parsePdfToRows()
 *     - Runs the layout template (when provided) against positioned PDF text to
 *       produce rich ParsedRow objects (description, quantities, coords, etc.).
 *     - Falls back to SupplierParseResult lines so we still have usable rows even
 *       without annotations.
 *   matchRowsToQuestionnaireItems()
 *     - Builds a scoring matrix between questionnaire openings and ParsedRows.
 *     - Uses fuzzy string similarity + dimension tolerance + quantity hints to
 *       compute confidence values.
 *     - Returns MatchedQuoteLine objects that can be persisted or rendered in the UI.
 *
 * TODO: plug in ML embeddings / LLM rewriters for better semantic similarity once
 *       the baseline heuristic pipeline is trusted in production.
 */

import type { SupplierParseResult } from "../../types/parse";
import { parseMoney, cleanText } from "./normalize";
import {
  extractRowsUsingTemplate,
  extractPositionedText,
  type LayoutTemplateRecord,
  type RawRow,
  type NormalizedBoundingBox,
} from "./layoutTemplates";
import {
  extractGlobalSpecsFromAnswers,
  normalizeLeadGlobalSpecs,
  type NormalizedGlobalSpecs,
} from "../globalSpecs";

/** Questionnaire line that we want to match against quote rows */
export interface QuestionnaireItemSpec {
  id: string;
  label?: string;
  description: string;
  widthMm?: number | null;
  heightMm?: number | null;
  thicknessMm?: number | null;
  quantity?: number | null;
  metadata?: Record<string, any> | null;
}

export type ParsedRowSource = "template" | "pdfjs" | "ocr";

export interface ParsedRow {
  id: string;
  source: ParsedRowSource;
  descriptionCandidate: string;
  rawText: string;
  page?: number;
  bbox?: NormalizedBoundingBox;
  imageRegion?: NormalizedBoundingBox;
  quantityCandidate?: number | null;
  unitPriceCandidate?: number | null;
  lineTotalCandidate?: number | null;
  codeCandidate?: string | null;
  widthCandidate?: number | null;
  heightCandidate?: number | null;
  thicknessCandidate?: number | null;
  currency?: string | null;
  tokens: string[];
  dimensionsText?: string;
  meta?: Record<string, any> | null;
}

export interface ParsedRowMatchMeta {
  descriptionScore: number;
  dimensionScore: number;
  quantityScore: number;
  notes: string[];
}

export type MatchStatus = "matched" | "ambiguous" | "unmatched";

export interface MatchedQuoteLine {
  questionnaireItemId: string;
  questionnaireLabel?: string;
  parsedRowId?: string | null;
  description: string;
  width_mm?: number | null;
  height_mm?: number | null;
  thickness_mm?: number | null;
  quantity?: number | null;
  unit_price?: number | null;
  line_total?: number | null;
  currency?: string | null;
  confidence_score: number;
  match_status: MatchStatus;
  row_page?: number | null;
  row_bbox?: NormalizedBoundingBox | null;
  image_bbox?: NormalizedBoundingBox | null;
  meta?: ParsedRowMatchMeta;
}

export interface ParsePdfToRowsParams {
  buffer: Buffer;
  template?: LayoutTemplateRecord | null;
  supplierLines?: SupplierParseResult["lines"];
  currency?: string | null;
}

export interface QuestionnaireLeadContext {
  id?: string | null;
  custom?: Record<string, any> | null;
  globalTimberSpec?: string | null;
  globalGlassSpec?: string | null;
  globalIronmongerySpec?: string | null;
  globalFinishSpec?: string | null;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "a",
  "an",
  "of",
  "for",
  "with",
  "mm",
  "door",
  "window",
  "unit",
  "set",
]);

const DIMENSION_PATTERN = /(?:(?:w|width)[:\s]*)?(?<width>\d{2,4})(?:\s*(?:mm|millimetres|millimeters))?\s*[x×]\s*(?:(?:h|height)[:\s]*)?(?<height>\d{2,4})(?:\s*(?:mm|millimetres|millimeters))?(?:\s*[x×]\s*(?<thickness>\d{1,3}))/i;
const ALT_DIMENSION_PATTERN = /(?:(?:width|w)[:\s]*(?<width>\d{2,4}))[^\d]+(?:(?:height|h)[:\s]*(?<height>\d{2,4}))/i;
const CODE_PATTERN = /(?:item|ref|code)[:\s-]*([A-Za-z0-9\-_/]+)/i;
const DESCRIPTION_KEYS = [
  "opening_description",
  "item_description",
  "description",
  "summary",
  "notes",
];
const LABEL_KEYS = ["opening_label", "item_label", "label", "name", "title"];
const WIDTH_FIELD_KEYS = [
  "door_width_mm",
  "width_mm",
  "rough_width_mm",
  "approx_width_mm",
  "estimated_width_mm",
  "photo_width_mm",
  "width",
];
const HEIGHT_FIELD_KEYS = [
  "door_height_mm",
  "height_mm",
  "rough_height_mm",
  "approx_height_mm",
  "estimated_height_mm",
  "photo_height_mm",
  "height",
];
const THICKNESS_FIELD_KEYS = ["door_thickness_mm", "thickness_mm", "leaf_thickness_mm", "thickness"];
const QUANTITY_FIELD_KEYS = ["quantity", "qty", "item_qty", "units", "leaf_count", "leaves"];
const NOTES_FIELD_KEYS = ["notes", "additional_notes", "comments"];
const PRODUCT_TYPE_FIELD_KEYS = [
  "product_type",
  "opening_type",
  "door_type",
  "window_type",
  "item_type",
];
const FLOOR_LEVEL_FIELD_KEYS = ["floor_level", "installation_floor", "storey", "floor", "level"];
const COLOUR_FIELD_KEYS = ["colour", "color", "vision_color", "finish_color"];
const GLASS_FIELD_KEYS = ["glass", "glass_type", "glazing", "glazing_style", "vision_pattern"];
const MATERIAL_FIELD_KEYS = ["timber", "material", "base_material"];
const FINISH_FIELD_KEYS = ["finish", "coating", "paint_finish"];
const IRONMONGERY_FIELD_KEYS = ["ironmongery", "hardware", "ironmongery_finish"];

export function parseDimensionsFromText(text: string): {
  widthMm?: number;
  heightMm?: number;
  thicknessMm?: number;
} {
  const clean = text?.replace(/,/g, "").trim() || "";
  if (!clean) return {};

  const tryPattern = (pattern: RegExp) => {
    const match = clean.match(pattern);
    if (!match?.groups) return null;
    const width = normaliseDimension(match.groups.width);
    const height = normaliseDimension(match.groups.height);
    const thickness = match.groups.thickness ? normaliseDimension(match.groups.thickness) : null;
    return { widthMm: width ?? undefined, heightMm: height ?? undefined, thicknessMm: thickness ?? undefined };
  };

  return (
    tryPattern(DIMENSION_PATTERN) ||
    tryPattern(ALT_DIMENSION_PATTERN) ||
    {}
  );
}

function normaliseDimension(value?: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 100 && numeric < 5000) return Math.round(numeric);
  if (numeric <= 100) {
    // probably centimetres
    return Math.round(numeric * 10);
  }
  return Math.round(numeric);
}

function parseQuantityText(text?: string | null): number | null {
  if (!text) return null;
  const match = text.replace(/[^0-9.]/g, "").trim();
  if (!match) return null;
  const value = Number(match);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function tokenize(text: string): string[] {
  return cleanText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

export function calculateDescriptionSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return Number((intersection / union).toFixed(3));
}

export function calculateDimensionSimilarity(
  expected: { widthMm?: number | null; heightMm?: number | null },
  candidate: { widthMm?: number | null; heightMm?: number | null },
  toleranceMm = 12,
): number {
  const values: number[] = [];
  const matches: number[] = [];

  if (expected.widthMm && candidate.widthMm) {
    values.push(expected.widthMm);
    matches.push(dimScore(expected.widthMm, candidate.widthMm, toleranceMm));
  }
  if (expected.heightMm && candidate.heightMm) {
    values.push(expected.heightMm);
    matches.push(dimScore(expected.heightMm, candidate.heightMm, toleranceMm));
  }

  if (!values.length) return 0;
  const average = matches.reduce((sum, value) => sum + value, 0) / matches.length;
  return Number(average.toFixed(3));
}

function dimScore(expected: number, candidate: number, tolerance: number): number {
  const delta = Math.abs(expected - candidate);
  if (delta === 0) return 1;
  if (delta > tolerance * 3) return 0;
  return Number(Math.max(0, 1 - delta / (tolerance * 3)).toFixed(3));
}

function deriveCodeCandidate(text: string): string | null {
  const match = text.match(CODE_PATTERN);
  return match ? match[1] : null;
}

function enrichWithDimensions(row: ParsedRow): ParsedRow {
  if (row.widthCandidate && row.heightCandidate) return row;
  const dims = parseDimensionsFromText(row.rawText || row.descriptionCandidate);
  return {
    ...row,
    widthCandidate: row.widthCandidate ?? dims.widthMm ?? undefined,
    heightCandidate: row.heightCandidate ?? dims.heightMm ?? undefined,
    thicknessCandidate: row.thicknessCandidate ?? dims.thicknessMm ?? undefined,
  };
}

export async function parsePdfToRows(params: ParsePdfToRowsParams): Promise<ParsedRow[]> {
  const { buffer, template, supplierLines = [], currency } = params;
  const rows: ParsedRow[] = [];

  if (template) {
    const layout = await extractPositionedText(buffer);
    const extraction = extractRowsUsingTemplate(layout, template);
    for (const row of extraction.rows) {
      rows.push(buildParsedRowFromTemplate(row, currency));
    }
  }

  if (!rows.length && supplierLines.length) {
    supplierLines.forEach((line, idx) => {
      rows.push(buildParsedRowFromSupplierLine(line, idx, currency));
    });
  }

  return rows.map(enrichWithDimensions);
}

export function questionnaireItemsFromLeadContext(
  lead: QuestionnaireLeadContext | null | undefined,
): QuestionnaireItemSpec[] {
  if (!lead) return [];
  const custom = (lead.custom ?? {}) as Record<string, any>;
  const items = Array.isArray(custom.items) ? custom.items : [];
  if (!items.length) return [];

  const normalizedSpecs = mergeGlobalSpecs(lead, custom);
  const results: QuestionnaireItemSpec[] = [];

  items.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const description =
      pickFirstString(raw, DESCRIPTION_KEYS) ||
      buildDescriptionFromItem(raw, normalizedSpecs) ||
      `Opening ${index + 1}`;
    const label = pickFirstString(raw, LABEL_KEYS) || `Opening ${index + 1}`;
    const id = String(
      raw.id ??
        raw.itemId ??
        raw.item_id ??
        raw.itemNumber ??
        raw.item_number ??
        `${lead.id || "lead"}-${index + 1}`,
    );

    const widthMm = pickNumeric(raw, WIDTH_FIELD_KEYS);
    const heightMm = pickNumeric(raw, HEIGHT_FIELD_KEYS);
    const thicknessMm = pickNumeric(raw, THICKNESS_FIELD_KEYS);
    const quantity = pickNumeric(raw, QUANTITY_FIELD_KEYS);

    const metadata = {
      notes: pickFirstString(raw, NOTES_FIELD_KEYS),
      openingType: pickFirstString(raw, PRODUCT_TYPE_FIELD_KEYS),
      floorLevel: pickFirstString(raw, FLOOR_LEVEL_FIELD_KEYS),
      measurementSource: pickFirstString(raw, ["measurement_source"]),
      measurementConfidence: pickNumeric(raw, ["measurement_confidence"]),
      globalSpecs: normalizedSpecs,
      itemNumber: raw.itemNumber ?? raw.item_number ?? index + 1,
    } as Record<string, any>;

    results.push({
      id,
      label,
      description,
      widthMm: widthMm ?? undefined,
      heightMm: heightMm ?? undefined,
      thicknessMm: thicknessMm ?? undefined,
      quantity: quantity ?? undefined,
      metadata,
    });
  });

  return results;
}

function mergeGlobalSpecs(
  lead: QuestionnaireLeadContext,
  customAnswers: Record<string, any>,
): NormalizedGlobalSpecs {
  const fromLead = normalizeLeadGlobalSpecs(lead);
  const fromAnswers = extractGlobalSpecsFromAnswers(customAnswers);
  return {
    timber: fromAnswers.timber || fromLead.timber,
    glass: fromAnswers.glass || fromLead.glass,
    ironmongery: fromAnswers.ironmongery || fromLead.ironmongery,
    finish: fromAnswers.finish || fromLead.finish,
  };
}

function pickFirstString(record: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function pickNumeric(record: Record<string, any>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record?.[key];
    const numeric = coerceNumeric(value);
    if (numeric != null) {
      return numeric;
    }
  }
  return null;
}

function coerceNumeric(value: any): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
  }
  if (typeof value === "string") {
    const match = value.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 1000 : null;
  }
  if (Array.isArray(value) && value.length) {
    return coerceNumeric(value[0]);
  }
  if (typeof value === "object") {
    const first = Object.values(value)[0];
    return coerceNumeric(first);
  }
  return null;
}

function buildDescriptionFromItem(item: Record<string, any>, specs: NormalizedGlobalSpecs): string {
  const timber = pickFirstString(item, MATERIAL_FIELD_KEYS) || specs.timber;
  const productType = pickFirstString(item, PRODUCT_TYPE_FIELD_KEYS);
  const colour = pickFirstString(item, COLOUR_FIELD_KEYS);
  const glass = pickFirstString(item, GLASS_FIELD_KEYS) || specs.glass;
  const ironmongery = pickFirstString(item, IRONMONGERY_FIELD_KEYS) || specs.ironmongery;
  const finish = pickFirstString(item, FINISH_FIELD_KEYS) || specs.finish;
  const segments: string[] = [];

  const leading = [timber, productType].filter(Boolean).join(" ").trim();
  if (leading) segments.push(capitalize(leading));
  if (colour) segments.push(colour);

  if (glass) {
    segments.push(glass.includes("with") ? glass : `${glass}`);
  }

  if (ironmongery) {
    const lower = ironmongery.toLowerCase();
    segments.push(lower.includes("ironmongery") ? ironmongery : `${ironmongery} ironmongery`);
  }

  if (finish) segments.push(finish);

  const description = segments.filter(Boolean).join(", ");
  if (description) return ensureSentence(description);
  const notes = pickFirstString(item, NOTES_FIELD_KEYS);
  return notes ? ensureSentence(notes) : "";
}

function capitalize(input: string): string {
  if (!input) return "";
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function ensureSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

function buildParsedRowFromTemplate(row: RawRow, currency?: string | null): ParsedRow {
  const dimsFromDescription = parseDimensionsFromText(row.descriptionText);
  const dimsFromTotals = parseDimensionsFromText(`${row.qtyText ?? ""} ${row.unitText ?? ""}`);
  const quantity = parseQuantityText(row.qtyText);
  const unitPrice = parseMoney(row.unitText ?? undefined);
  const total = parseMoney(row.totalText ?? undefined);
  const rawText = [row.descriptionText, row.qtyText, row.unitText, row.totalText]
    .filter(Boolean)
    .join(" | ");

  return {
    id: row.rowKey,
    source: "template",
    descriptionCandidate: row.descriptionText,
    rawText,
    page: row.page,
    bbox: row.bbox,
    imageRegion: row.hasImage ? row.regions?.joinery_image : undefined,
    quantityCandidate: quantity,
    unitPriceCandidate: unitPrice,
    lineTotalCandidate: total,
    widthCandidate: dimsFromDescription.widthMm ?? dimsFromTotals.widthMm,
    heightCandidate: dimsFromDescription.heightMm ?? dimsFromTotals.heightMm,
    thicknessCandidate: dimsFromDescription.thicknessMm ?? dimsFromTotals.thicknessMm,
    currency: currency ?? null,
    codeCandidate: deriveCodeCandidate(row.descriptionText),
    tokens: tokenize(row.descriptionText),
    dimensionsText: buildDimensionSnippet(row),
    meta: {
      isDelivery: row.isDelivery ?? false,
      templateRegions: row.regions,
    },
  };
}

function buildDimensionSnippet(row: RawRow): string | undefined {
  const description = row.descriptionText || "";
  const numericBits = description.match(/\d{2,4}/g);
  if (!numericBits?.length) return undefined;
  const dims = numericBits.slice(0, 3).join(" x ");
  return `${dims} mm`;
}

function buildParsedRowFromSupplierLine(
  line: SupplierParseResult["lines"][number],
  index: number,
  currency?: string | null,
): ParsedRow {
  const rawText = [line.description, line.qty, line.costUnit, line.lineTotal]
    .map((segment) => (segment == null ? "" : String(segment)))
    .filter(Boolean)
    .join(" | ");
  const dims = parseDimensionsFromText(line.description);

  return {
    id: `fallback-${index}`,
    source: "pdfjs",
    descriptionCandidate: line.description,
    rawText,
    page: line.page,
    quantityCandidate: line.qty ?? null,
    unitPriceCandidate: line.costUnit ?? null,
    lineTotalCandidate: line.lineTotal ?? null,
    widthCandidate: dims.widthMm ?? undefined,
    heightCandidate: dims.heightMm ?? undefined,
    thicknessCandidate: dims.thicknessMm ?? undefined,
    currency: currency ?? null,
    codeCandidate: deriveCodeCandidate(line.description),
    tokens: tokenize(line.description),
    meta: line.meta ?? null,
  };
}

export interface MatchOptions {
  dimensionToleranceMm?: number;
  minConfidence?: number;
}

export function matchRowsToQuestionnaireItems(
  rows: ParsedRow[],
  questionnaireItems: QuestionnaireItemSpec[],
  options: MatchOptions = {},
): MatchedQuoteLine[] {
  const usedRowIds = new Set<string>();
  const matches: MatchedQuoteLine[] = [];
  const tolerance = options.dimensionToleranceMm ?? 12;
  const minConfidence = options.minConfidence ?? 0.3;

  questionnaireItems.forEach((item, index) => {
    const expectedDims = {
      widthMm: item.widthMm ?? undefined,
      heightMm: item.heightMm ?? undefined,
    };
    let bestMatch: { row: ParsedRow; score: number; meta: ParsedRowMatchMeta } | null = null;

    for (const row of rows) {
      if (usedRowIds.has(row.id)) continue;
      const descriptionScore = calculateDescriptionSimilarity(item.description, row.descriptionCandidate);
      const dimensionScore = calculateDimensionSimilarity(expectedDims, {
        widthMm: row.widthCandidate ?? null,
        heightMm: row.heightCandidate ?? null,
      }, tolerance);
      const quantityScore = scoreQuantity(item.quantity, row.quantityCandidate);
      const confidence = 0.6 * descriptionScore + 0.3 * dimensionScore + 0.1 * quantityScore;
      if (!bestMatch || confidence > bestMatch.score) {
        bestMatch = {
          row,
          score: confidence,
          meta: {
            descriptionScore,
            dimensionScore,
            quantityScore,
            notes: buildMatchNotes({ descriptionScore, dimensionScore, quantityScore }),
          },
        };
      }
    }

    if (bestMatch && bestMatch.score >= minConfidence) {
      usedRowIds.add(bestMatch.row.id);
      matches.push({
        questionnaireItemId: item.id,
        questionnaireLabel: item.label,
        parsedRowId: bestMatch.row.id,
        description: bestMatch.row.descriptionCandidate,
        width_mm: bestMatch.row.widthCandidate ?? item.widthMm ?? null,
        height_mm: bestMatch.row.heightCandidate ?? item.heightMm ?? null,
        thickness_mm: bestMatch.row.thicknessCandidate ?? item.thicknessMm ?? null,
        quantity: bestMatch.row.quantityCandidate ?? item.quantity ?? null,
        unit_price: bestMatch.row.unitPriceCandidate ?? null,
        line_total: bestMatch.row.lineTotalCandidate ?? null,
        currency: bestMatch.row.currency ?? null,
        confidence_score: Number(bestMatch.score.toFixed(3)),
        match_status: bestMatch.score >= 0.75 ? "matched" : "ambiguous",
        row_page: bestMatch.row.page ?? null,
        row_bbox: bestMatch.row.bbox ?? null,
        image_bbox: bestMatch.row.imageRegion ?? null,
        meta: bestMatch.meta,
      });
    } else {
      matches.push({
        questionnaireItemId: item.id,
        questionnaireLabel: item.label,
        parsedRowId: null,
        description: item.description,
        width_mm: item.widthMm ?? null,
        height_mm: item.heightMm ?? null,
        thickness_mm: item.thicknessMm ?? null,
        quantity: item.quantity ?? null,
        unit_price: null,
        line_total: null,
        currency: null,
        confidence_score: 0,
        match_status: "unmatched",
        row_page: null,
        row_bbox: null,
        image_bbox: null,
      });
    }
  });

  return matches;
}

function scoreQuantity(expected?: number | null, candidate?: number | null): number {
  if (!expected || !candidate) return 0;
  const delta = Math.abs(expected - candidate);
  if (delta === 0) return 1;
  if (delta > 5) return 0;
  return Number(Math.max(0, 1 - delta / 5).toFixed(3));
}

function buildMatchNotes(meta: Omit<ParsedRowMatchMeta, "notes">): string[] {
  const notes: string[] = [];
  if (meta.descriptionScore >= 0.8) notes.push("description tokens aligned");
  if (meta.dimensionScore >= 0.8) notes.push("dimensions within tolerance");
  if (meta.quantityScore >= 0.8) notes.push("quantity matches");
  if (!notes.length && meta.descriptionScore > 0.4) notes.push("moderate description similarity");
  return notes;
}
