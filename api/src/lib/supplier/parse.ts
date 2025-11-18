import OpenAI from "openai";
import { z } from "zod";

import type { SupplierParseResult } from "../../types/parse";
import {
  extractStructuredText,
  type ExtractionSummary,
} from "../pdf/extract";
import {
  buildSupplierParse,
  type ParseMetadata,
} from "../pdf/parser";
import { runOcrFallback } from "../pdf/ocrFallback";
import {
  cleanText,
  combineWarnings,
  inferCurrency,
  summariseConfidence,
} from "../pdf/normalize";
import {
  loadSupplierPattern,
  saveSupplierPattern,
  type PatternCues,
} from "./patterns";
import { extractImagesForParse } from "../pdf/extractImages";

const STRUCTURE_TOOL = {
  type: "function" as const,
  name: "structure_supplier_quote",
  description: "Turn supplier quote table text into normalized JSON.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      currency: { type: "string" },
      supplier: { type: "string" },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            qty: { type: "number" },
            unit: { type: "string" },
            costUnit: { type: "number" },
            lineTotal: { type: "number" },
          },
          required: ["description"],
        },
      },
      detected_totals: {
        type: "object",
        properties: {
          subtotal: { type: "number" },
          delivery: { type: "number" },
          estimated_total: { type: "number" },
        },
      },
      confidence: { type: "number" },
      warnings: { type: "array", items: { type: "string" } },
    },
    required: ["currency", "lines"],
  },
};

const STRUCTURE_SCHEMA = z.object({
  currency: z.string().min(1),
  supplier: z.string().optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1),
        qty: z.number().optional(),
        unit: z.string().optional(),
        costUnit: z.number().optional(),
        lineTotal: z.number().optional(),
      }),
    )
    .min(1),
  detected_totals: z
    .object({
      subtotal: z.number().optional(),
      delivery: z.number().optional(),
      estimated_total: z.number().optional(),
    })
    .partial()
    .optional(),
  confidence: z.number().optional(),
  warnings: z.array(z.string()).optional(),
});

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const openaiClient =
  OPENAI_KEY && OPENAI_KEY.startsWith("sk-") ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

interface StageAResult {
  extraction: ExtractionSummary;
  metadata: ParseMetadata;
  parse: SupplierParseResult;
  cues: PatternCues;
  warnings: string[];
}

interface StageBResult {
  parse: SupplierParseResult;
  used: boolean;
  warnings: string[];
}

interface StageCResult {
  parse: SupplierParseResult;
  used: boolean;
  warnings: string[];
  llmConfidence?: number;
}

function unique<T>(values: Iterable<T>): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function deriveHeaderKeywords(extraction: ExtractionSummary): string[] {
  const keywords: string[] = [];
  for (const row of extraction.rows.slice(0, 5)) {
    const tokens = row.normalized.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (const token of tokens) {
      if (token.length < 3) continue;
      keywords.push(token);
    }
  }
  return unique(keywords).slice(0, 20);
}

function deriveColumnSplits(metadata: ParseMetadata): number[] {
  const columns: number[] = [];
  for (const region of metadata.lineRegions) {
    for (const cell of region.cells) {
      if (Number.isFinite(cell.startIndex)) {
        columns.push(cell.startIndex);
      }
    }
  }
  return unique(columns).sort((a, b) => a - b);
}

function deriveCommonUnits(parse: SupplierParseResult): string[] {
  const units = parse.lines
    .map((line) => cleanText(line.unit || ""))
    .filter((unit) => unit && unit.length <= 12);
  return unique(units);
}

function attachWarnings(
  parse: SupplierParseResult,
  warnings: Iterable<string>,
): SupplierParseResult {
  const existing = new Set(parse.warnings ?? []);
  for (const warning of warnings) {
    if (!warning) continue;
    existing.add(cleanText(warning));
  }
  return existing.size
    ? { ...parse, warnings: Array.from(existing).sort() }
    : { ...parse, warnings: undefined };
}

function plainTextFallback(
  buffer: Buffer,
  supplierHint?: string,
  currency?: string,
): SupplierParseResult | null {
  const pdfSource = buffer.toString("utf8");
  const matches = Array.from(pdfSource.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g));
  if (!matches.length) return null;
  const lines = matches
    .map((match) => match[1].replace(/\\[rn]/g, " "))
    .map((line) => line.replace(/\s{2,}/g, (segment) => (segment.length >= 2 ? "  " : segment)))
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const parsedLines: SupplierParseResult["lines"] = [];
  const detectedTotals: SupplierParseResult["detected_totals"] = {};
  let fallbackSupplier = supplierHint?.trim();

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/supplier[:\s]/i.test(line)) {
      const cleaned = cleanText(line.replace(/supplier[:\s]*/i, "")).trim();
      if (cleaned) fallbackSupplier = cleaned;
      continue;
    }

    if (/total/i.test(lower) && !/delivery/i.test(lower)) {
      const numbers = line.match(/[-+]?\d[\d,.]*\d|[-+]?\d+/g);
      const value = numbers ? Number(numbers[numbers.length - 1]?.replace(/,/g, "")) : null;
      if (value != null && Number.isFinite(value)) {
        detectedTotals.estimated_total = Math.round(value * 100) / 100;
      }
      continue;
    }

    const tokens = line
      .split(/\s{2,}/)
      .map((token) => cleanText(token))
      .filter(Boolean);
    if (tokens.length < 2) continue;

    const numbers = tokens
      .map((token) => Number(token.replace(/,/g, "")))
      .map((value) => (Number.isFinite(value) ? value : null));

    if (!numbers.some((value) => value != null)) continue;

    const description = tokens[0];
    const numericValues = numbers.filter((value): value is number => value != null);
    const lineTotal = numericValues.length ? numericValues[numericValues.length - 1] : undefined;
    const prior = numericValues.slice(0, -1);

    let qty: number | undefined;
    let costUnit: number | undefined;

    if (prior.length) {
      const candidate = prior.find((value) => Number.isInteger(value) && value > 0 && value <= 1000);
      if (candidate != null) qty = candidate;
    }

    if (!costUnit && prior.length >= 1) {
      const candidate = prior[prior.length - 1];
      if (candidate != null && (!qty || Math.abs(candidate - qty) > 0.01)) {
        costUnit = candidate;
      }
    }

    if (!costUnit && qty && lineTotal) {
      const derived = lineTotal / qty;
      if (Number.isFinite(derived)) costUnit = Math.round(derived * 100) / 100;
    }

    parsedLines.push({ description, qty, costUnit, lineTotal });
  }

  if (!parsedLines.length) return null;

  return {
    currency: currency || "GBP",
    supplier: fallbackSupplier || undefined,
    lines: parsedLines,
    detected_totals: Object.keys(detectedTotals).length ? detectedTotals : undefined,
    warnings: ["Fallback plain-text parser used"],
  };
}

/**
 * Detect if a PDF is from Joinerysoft based on header text and structure
 */
function detectJoinerysoftPdf(extraction: ExtractionSummary): boolean {
  const headerText = extraction.rows.slice(0, 10).map(r => r.normalized.toLowerCase()).join(' ');
  
  // Look for Joinerysoft-specific markers
  const markers = [
    'joinerysoft',
    'joinery soft',
    'joinery-soft',
  ];
  
  return markers.some(marker => headerText.includes(marker));
}

/**
 * Process Joinerysoft PDF with special handling:
 * - Preserve original prices exactly as shown
 * - Extract images per line
 * - Enhance descriptions
 * - No ML recalculation or margin application
 */
function handleJoinerysoftPdf(
  extraction: ExtractionSummary,
  baseParse: SupplierParseResult
): SupplierParseResult {
  console.log('[parseSupplierPdf] Detected Joinerysoft PDF - preserving original prices');
  
  // Mark supplier explicitly
  baseParse.supplier = 'Joinerysoft';
  
  // Ensure we're not modifying prices
  // Lines already have costUnit and lineTotal from parsing
  // We just need to make sure they're not recalculated downstream
  baseParse.lines = baseParse.lines.map(line => ({
    ...line,
    // Add marker to prevent ML recalculation
    sellUnit: line.costUnit, // Use cost as sell price (no margin)
  }));
  
  // Add warning to indicate special handling
  const warnings = baseParse.warnings || [];
  warnings.push('Joinerysoft PDF detected: preserving original prices');
  
  return {
    ...baseParse,
    warnings: unique(warnings),
  };
}

function runStageA(
  buffer: Buffer,
  supplierHint?: string,
  patternName?: string,
): StageAResult {
  const extraction = extractStructuredText(buffer);
  const { result, metadata } = buildSupplierParse(extraction);

  const supplier = result.supplier || supplierHint || patternName || undefined;
  const currency = result.currency || inferCurrency(extraction.rawText) || "GBP";

  let baseParse: SupplierParseResult = {
    ...result,
    supplier,
    currency,
    lines: result.lines.map((line) => ({ ...line })),
  };

  if (!baseParse.lines.length) {
    const fallback = plainTextFallback(buffer, supplier, currency);
    if (fallback) {
      baseParse.lines = fallback.lines;
      baseParse.detected_totals = fallback.detected_totals;
      baseParse.supplier = fallback.supplier ?? baseParse.supplier;
      baseParse.currency = fallback.currency ?? baseParse.currency;
      baseParse.warnings = unique([...(baseParse.warnings ?? []), ...(fallback.warnings ?? [])]);
    }
  }

  // Check if this is a Joinerysoft PDF and apply special handling
  const isJoinerysoft = detectJoinerysoftPdf(extraction);
  if (isJoinerysoft) {
    baseParse = handleJoinerysoftPdf(extraction, baseParse);
  }

  const cues: PatternCues = {
    supplier: baseParse.supplier || supplier,
    headerKeywords: deriveHeaderKeywords(extraction),
    columnXSplits: deriveColumnSplits(metadata),
    commonUnits: deriveCommonUnits(baseParse),
  };

  const warnings =
    combineWarnings(extraction.warnings, metadata.warnings, baseParse.warnings) ?? [];

  const parseWithWarnings = attachWarnings(baseParse, warnings);

  return {
    extraction,
    metadata,
    parse: parseWithWarnings,
    cues,
    warnings,
  };
}

async function runStageB(
  buffer: Buffer,
  stageA: StageAResult,
): Promise<StageBResult> {
  const shouldAttempt =
    stageA.parse.lines.length === 0 || stageA.metadata.lowConfidence || stageA.metadata.descriptionQuality < 0.5;

  if (!shouldAttempt) {
    return { parse: stageA.parse, used: false, warnings: [] };
  }

  const fallback = await runOcrFallback(buffer, stageA.extraction);
  if (!fallback) {
    return { parse: stageA.parse, used: false, warnings: [] };
  }

  const warnings = fallback.warnings ?? [];
  if (!fallback.replacements.length) {
    return { parse: attachWarnings(stageA.parse, warnings), used: false, warnings };
  }

  const replacements = new Map<number, string>();
  for (const entry of fallback.replacements) {
    replacements.set(entry.rowIndex, cleanText(entry.description));
  }

  const updatedLines = stageA.parse.lines.map((line, index) => {
    const region = stageA.metadata.lineRegions[index];
    if (!region) return line;
    const replacement = replacements.get(region.rowIndex);
    if (!replacement) return line;
    return { ...line, description: replacement };
  });

  const mergedParse: SupplierParseResult = attachWarnings(
    { ...stageA.parse, lines: updatedLines },
    warnings,
  );

  return { parse: mergedParse, used: true, warnings };
}

function formatLinesForLlm(parse: SupplierParseResult): string {
  const headers = ["Description", "Qty", "Unit", "Cost", "Line Total"];
  const rows = parse.lines.map((line) => {
    const cells = [
      line.description,
      line.qty != null ? String(line.qty) : "",
      line.unit ?? "",
      line.costUnit != null ? line.costUnit.toFixed(2) : "",
      line.lineTotal != null ? line.lineTotal.toFixed(2) : "",
    ];
    return cells.join(" | ");
  });

  if (parse.detected_totals) {
    const totals: string[] = [];
    if (parse.detected_totals.subtotal != null) {
      totals.push(`Subtotal | | | | ${parse.detected_totals.subtotal.toFixed(2)}`);
    }
    if (parse.detected_totals.delivery != null) {
      totals.push(`Delivery | | | | ${parse.detected_totals.delivery.toFixed(2)}`);
    }
    if (parse.detected_totals.estimated_total != null) {
      totals.push(`Estimated Total | | | | ${parse.detected_totals.estimated_total.toFixed(2)}`);
    }
    rows.push(...totals);
  }

  return [headers.join(" | "), ...rows].join("\n");
}

function buildFewShotExamples(): string {
  return [
    "Table:\nDescription | Qty | Unit | Cost | Line Total\nOak Door | 1 | Each | 4321.86 | 4321.86\nDelivery | 1 | Each | 990.01 | 990.01\nEstimated Total | | | | 5311.87",
    "JSON:\n{\n  \"currency\": \"GBP\",\n  \"supplier\": \"Example Supplier\",\n  \"lines\": [\n    {\n      \"description\": \"Oak Door\",\n      \"qty\": 1,\n      \"unit\": \"Each\",\n      \"costUnit\": 4321.86,\n      \"lineTotal\": 4321.86\n    },\n    {\n      \"description\": \"Delivery\",\n      \"qty\": 1,\n      \"unit\": \"Each\",\n      \"costUnit\": 990.01,\n      \"lineTotal\": 990.01\n    }\n  ],\n  \"detected_totals\": {\n    \"estimated_total\": 5311.87\n  },\n  \"confidence\": 0.9\n}"
  ].join("\n\n");
}

function mergeLines(
  base: SupplierParseResult,
  llmLines: SupplierParseResult["lines"],
): SupplierParseResult["lines"] {
  const index = new Map<string, SupplierParseResult["lines"][number]>();
  for (const line of base.lines) {
    index.set(cleanText(line.description).toLowerCase(), line);
  }
  return llmLines.map((line) => {
    const key = cleanText(line.description).toLowerCase();
    const fallback = index.get(key);
    return {
      description: line.description,
      qty: line.qty ?? fallback?.qty,
      unit: line.unit ?? fallback?.unit,
      costUnit: line.costUnit ?? fallback?.costUnit,
      lineTotal: line.lineTotal ?? fallback?.lineTotal ?? (fallback?.costUnit && fallback?.qty
        ? Math.round(fallback.costUnit * fallback.qty * 100) / 100
        : undefined),
    };
  });
}

async function runStageC(
  base: SupplierParseResult,
  options: {
    supplierHint?: string;
    currencyHint?: string;
    patternSummary?: string;
  },
): Promise<StageCResult> {
  if (!base.lines.length) {
    return { parse: base, used: false, warnings: ["LLM structuring skipped: no lines available"] };
  }

  if (!openaiClient) {
    return {
      parse: base,
      used: false,
      warnings: ["OpenAI API key missing or placeholder; structuring stage skipped"],
    };
  }

  const tableText = formatLinesForLlm(base);
  const hints: string[] = [];
  if (options.currencyHint) hints.push(`Currency hint: ${options.currencyHint}`);
  if (options.supplierHint) hints.push(`Supplier hint: ${options.supplierHint}`);
  if (options.patternSummary) hints.push(`Pattern hints: ${options.patternSummary}`);

  const userPrompt = [
    "You will receive supplier quote table text extracted from a PDF.",
    "Return structured JSON by calling the provided function.",
    "Ensure numeric fields remain numeric and currency stays consistent (GBP preferred).",
    "Keep delivery lines labelled clearly.",
    buildFewShotExamples(),
    hints.join("\n"),
    "Actual table:",
    tableText,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await openaiClient.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You convert supplier quotes into structured data. Always answer by calling the provided function.",
            },
          ],
        },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] },
      ],
      tools: [STRUCTURE_TOOL],
      tool_choice: { type: "function", name: STRUCTURE_TOOL.name },
    });

    const toolCall = response.output?.find((item) => item.type === "function_call");

    if (!toolCall || toolCall.type !== "function_call") {
      throw new Error("LLM response missing tool call");
    }

    const parsedArgs = JSON.parse(toolCall.arguments ?? "{}");
    const validated = STRUCTURE_SCHEMA.safeParse(parsedArgs);
    if (!validated.success) {
      throw new Error(validated.error.message);
    }

    const llm = validated.data;
    const mergedLines = mergeLines(base, llm.lines);
    const detectedTotals = {
      ...base.detected_totals,
      ...llm.detected_totals,
    };

    const finalParse: SupplierParseResult = {
      ...base,
      currency: llm.currency || options.currencyHint || base.currency || "GBP",
      supplier: llm.supplier || options.supplierHint || base.supplier,
      lines: mergedLines,
      detected_totals: Object.keys(detectedTotals).length ? detectedTotals : undefined,
      warnings: llm.warnings?.length ? unique(llm.warnings) : base.warnings,
    };

    return {
      parse: finalParse,
      used: true,
      warnings: llm.warnings ?? [],
      llmConfidence: llm.confidence,
    };
  } catch (error: any) {
    const message = error?.message || String(error);
    return {
      parse: attachWarnings(base, [
        `OpenAI structuring failed: ${message}. Falling back to structured parser output.`,
      ]),
      used: false,
      warnings: [`OpenAI structuring failed: ${message}`],
    };
  }
}

function summarisePattern(pattern?: { headerKeywords?: string[]; commonUnits?: string[] }): string | undefined {
  if (!pattern) return undefined;
  const segments: string[] = [];
  if (pattern.headerKeywords?.length) {
    segments.push(`Header keywords: ${pattern.headerKeywords.slice(0, 5).join(", ")}`);
  }
  if (pattern.commonUnits?.length) {
    segments.push(`Units: ${pattern.commonUnits.slice(0, 5).join(", ")}`);
  }
  return segments.length ? segments.join(" | ") : undefined;
}

function computeConfidence(
  base: SupplierParseResult,
  stageA: StageAResult,
  stageC?: StageCResult,
): number {
  const signals: number[] = [];
  if (Number.isFinite(stageA.metadata.descriptionQuality)) {
    signals.push(Math.max(0, Math.min(1, stageA.metadata.descriptionQuality)));
  }
  if (Number.isFinite(stageA.metadata.glyphQuality)) {
    signals.push(Math.max(0, Math.min(1, stageA.metadata.glyphQuality)));
  }
  const lineScore = summariseConfidence(base.lines);
  if (Number.isFinite(lineScore)) signals.push(lineScore);
  if (stageC?.llmConfidence != null && Number.isFinite(stageC.llmConfidence)) {
    signals.push(Math.max(0, Math.min(1, stageC.llmConfidence)));
  }
  if (!signals.length) return base.confidence ?? 0.4;
  const avg = signals.reduce((acc, value) => acc + value, 0) / signals.length;
  return Math.round(avg * 100) / 100;
}

export async function parseSupplierPdf(
  buffer: Buffer,
  options?: { supplierHint?: string; currencyHint?: string },
): Promise<SupplierParseResult> {
  const supplierHint = options?.supplierHint;
  const currencyHint = options?.currencyHint || "GBP";

  const pattern = await loadSupplierPattern(supplierHint);
  const stageA = runStageA(buffer, supplierHint, pattern?.supplier);

  type StageName = "pdfjs" | "ocr" | "llm";
  const usedStages = new Set<StageName>();
  usedStages.add("pdfjs");

  let workingParse = { ...stageA.parse, currency: stageA.parse.currency || currencyHint };
  const collectedWarnings = new Set(stageA.warnings);

  const stageB = await runStageB(buffer, stageA);
  if (stageB.used) usedStages.add("ocr");
  stageB.warnings.forEach((warning) => collectedWarnings.add(warning));
  workingParse = stageB.parse;

  const patternSummary = summarisePattern(pattern || stageA.cues);
  const stageC = await runStageC(workingParse, {
    supplierHint: supplierHint || workingParse.supplier || pattern?.supplier,
    currencyHint,
    patternSummary,
  });
  if (stageC.used) usedStages.add("llm");
  stageC.warnings.forEach((warning) => collectedWarnings.add(warning));
  workingParse = stageC.parse;

  workingParse.currency = workingParse.currency || currencyHint;
  workingParse.usedStages = Array.from(usedStages);
  workingParse.confidence = computeConfidence(workingParse, stageA, stageC);
  workingParse = attachWarnings(workingParse, collectedWarnings);

  const cues: PatternCues = {
    supplier: workingParse.supplier || supplierHint || pattern?.supplier,
    headerKeywords: stageA.cues.headerKeywords,
    columnXSplits: stageA.cues.columnXSplits,
    commonUnits: unique([
      ...(stageA.cues.commonUnits ?? []),
      ...(workingParse.lines
        .map((line) => cleanText(line.unit || ""))
        .filter((unit) => unit && unit.length <= 12)),
    ]),
  };

  await saveSupplierPattern(cues);

  // Extract images from PDF and map to lines
  try {
    const extractedImages = await extractImagesForParse(buffer);
    
    if (extractedImages.length > 0) {
      console.log(`[parseSupplierPdf] Extracted ${extractedImages.length} images`);
      
      // Store images in the result
      workingParse.images = extractedImages;
      
      // Map images to lines based on page and proximity
      // For each line, find the closest image on the same page
      workingParse.lines = workingParse.lines.map((line, lineIndex) => {
        // Estimate line page based on position (rough heuristic)
        const estimatedPage = Math.floor(lineIndex / 10) + 1;
        const linePage = line.page || estimatedPage;
        
        // Find images on the same page
        const pageImages = extractedImages.filter(img => img.page === linePage);
        
        if (pageImages.length === 0) {
          return line;
        }
        
        // Simple mapping: assign first available image on page to line
        // More sophisticated matching would use bbox proximity
        const imageIndex = lineIndex % pageImages.length;
        const matchedImage = pageImages[imageIndex];
        
        if (matchedImage) {
          return {
            ...line,
            page: linePage,
            imageIndex: matchedImage.index,
            imageDataUrl: matchedImage.dataUrl,
            bbox: matchedImage.bbox,
          };
        }
        
        return { ...line, page: linePage };
      });
      
      console.log(`[parseSupplierPdf] Mapped images to ${workingParse.lines.filter(l => l.imageDataUrl).length} lines`);
    }
  } catch (err: any) {
    console.warn('[parseSupplierPdf] Image extraction failed:', err);
    collectedWarnings.add(`Image extraction failed: ${err.message}`);
    workingParse = attachWarnings(workingParse, collectedWarnings);
  }

  return workingParse;
}
