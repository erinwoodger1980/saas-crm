import type { PDFDocumentProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import type { createWorker as CreateWorker } from "tesseract.js";
import { z } from "zod";
import OpenAI from "openai";
import { cleanText, inferCurrency, parseMoney, scoreAlphaNumericQuality, summariseConfidence } from "../pdf/normalize";
import type { SupplierParseResult } from "../../types/parse";
import { loadSupplierPattern, saveSupplierPattern, type PatternCues } from "./patterns";

const MAX_PAGES = Math.max(1, Number(process.env.PARSER_MAX_PAGES ?? 3));
const OCR_ENABLED = String(process.env.PARSER_OCR_ENABLED ?? "true").toLowerCase() !== "false";

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      })
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

interface LayoutItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
}

interface LayoutRow {
  index: number;
  y: number;
  items: LayoutItem[];
  text: string;
  numericColumns: Array<{ index: number; text: string; value: number | null; x: number; width: number }>;
  descriptionQuality: number;
}

interface StageAResult {
  layoutRows: LayoutRow[];
  parse: SupplierParseResult;
  layoutConfidence: number;
  warnings: string[];
  cues: PatternCues;
}

interface StageBResult {
  parse: SupplierParseResult;
  warnings: string[];
  used: boolean;
}

interface StageCResult {
  parse: SupplierParseResult;
  used: boolean;
  warnings: string[];
}

function norm(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

async function loadPdf(buffer: Buffer): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

function normaliseTextItem(item: TextItem): LayoutItem {
  const [a, b, c, d, e, f] = item.transform;
  const fontHeight = Math.hypot(c, d);
  const width = (item.width * item.transform[0]) / 1000;
  return {
    text: cleanText(String(item.str || "")),
    x: e,
    y: f,
    width: Math.abs(width),
    height: Math.abs(fontHeight) || 10,
    fontName: item.fontName,
  };
}

function clusterRows(items: LayoutItem[]): LayoutRow[] {
  const filtered = items.filter((it) => it.text && it.text.trim());
  filtered.sort((a, b) => b.y - a.y);
  const rows: LayoutRow[] = [];
  let current: LayoutRow | null = null;
  const tolerance = 6;

  filtered.forEach((item) => {
    if (!current || Math.abs(current.y - item.y) > tolerance) {
      current = {
        index: rows.length,
        y: item.y,
        items: [item],
        text: item.text,
        numericColumns: [],
        descriptionQuality: 0,
      };
      rows.push(current);
    } else {
      current.items.push(item);
      current.text += ` ${item.text}`;
    }
  });

  rows.forEach((row) => {
    row.items.sort((a, b) => a.x - b.x);
    const numericColumns: LayoutRow["numericColumns"] = [];
    row.items.forEach((cell, index) => {
      const value = parseMoney(cell.text);
      if (value != null) {
        numericColumns.push({ index, text: cell.text, value, x: cell.x, width: cell.width });
      }
    });
    row.numericColumns = numericColumns;
    row.descriptionQuality = scoreAlphaNumericQuality(row.items.map((i) => i.text).join(" "));
  });

  return rows;
}

function buildStageAResult(rows: LayoutRow[], supplierHint?: string): StageAResult {
  const parsedLines: SupplierParseResult["lines"] = [];
  const totals: SupplierParseResult["detected_totals"] = {};
  const warnings: string[] = [];
  const cues: PatternCues = { supplier: supplierHint };
  const headerKeywords = new Set<string>();

  rows.forEach((row, rowIndex) => {
    const rowText = row.items.map((cell) => cell.text).join(" ").trim();
    if (!rowText) return;
    const lower = rowText.toLowerCase();

    if (rowIndex < 3) {
      rowText
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .forEach((word) => headerKeywords.add(word.toLowerCase()));
    }

    if (/\b(subtotal|total|grand total)\b/.test(lower)) {
      const numbers = row.numericColumns.length
        ? row.numericColumns.map((col) => col.value).filter((v): v is number => v != null)
        : (rowText.match(/[-+]?\d[\d,.]*\d|[-+]?\d+/g) || []).map((token) => parseMoney(token)).filter((n): n is number => n != null);
      if (numbers.length) {
        const final = numbers[numbers.length - 1];
        if (/delivery|shipping|freight/.test(lower)) totals.delivery = final;
        else if (/subtotal/.test(lower)) totals.subtotal = final;
        else totals.estimated_total = final;
      }
      return;
    }

    if (!row.numericColumns.length) return;

    const descriptionCells = row.items.filter((cell) => cell.x < row.numericColumns[0].x - 4);
    const description = cleanText(descriptionCells.map((cell) => cell.text).join(" "));
    if (!description) return;

    let qty: number | undefined;
    let costUnit: number | undefined;
    let lineTotal: number | undefined;
    let unit: string | undefined;

    const numericValues = row.numericColumns.map((col) => col.value);
    if (numericValues.length >= 1) {
      lineTotal = numericValues[numericValues.length - 1] ?? undefined;
    }

    if (numericValues.length >= 2) {
      const candidate = numericValues[numericValues.length - 2];
      if (candidate && lineTotal && candidate <= lineTotal + 0.01) {
        costUnit = candidate;
      }
    }

    if (numericValues.length >= 3) {
      const candidate = numericValues[numericValues.length - 3];
      if (candidate && Number.isInteger(candidate) && candidate > 0 && candidate < 1000) {
        qty = candidate;
      }
    }

    if (!qty && costUnit && lineTotal && costUnit > 0) {
      const implied = lineTotal / costUnit;
      if (Number.isFinite(implied) && implied > 0 && implied < 1000) {
        qty = Math.round(implied);
      }
    }

    if (!costUnit && qty && lineTotal) {
      costUnit = lineTotal / qty;
    }

    const maybeUnit = descriptionCells.length ? descriptionCells[descriptionCells.length - 1].text : "";
    if (maybeUnit && !/[0-9]/.test(maybeUnit) && maybeUnit.length <= 10) {
      unit = maybeUnit;
    }

    parsedLines.push({ description, qty, unit, costUnit, lineTotal });
  });

  const layoutConfidence = rows.length
    ? norm(
        rows.reduce((acc, row) => acc + row.descriptionQuality, 0) /
          Math.max(1, rows.filter((row) => row.numericColumns.length).length)
      )
    : 0;

  cues.headerKeywords = Array.from(headerKeywords);
  cues.columnXSplits = rows
    .flatMap((row) => row.numericColumns.map((col) => col.x))
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort((a, b) => a - b);

  const parse: SupplierParseResult = {
    currency: "GBP",
    lines: parsedLines,
    detected_totals: totals,
    confidence: layoutConfidence,
    warnings: warnings.length ? warnings : undefined,
    usedStages: ["pdfjs"],
  };

  return { layoutRows: rows, parse, layoutConfidence, warnings, cues };
}

async function runStageA(buffer: Buffer, supplierHint?: string): Promise<StageAResult> {
  const pdf = await loadPdf(buffer);
  const items: LayoutItem[] = [];
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
    content.items.forEach((item) => {
      const normalized = normaliseTextItem(item as TextItem);
      if (normalized.text) items.push(normalized);
    });
  }

  const rows = clusterRows(items);
  const stageA = buildStageAResult(rows, supplierHint);
  stageA.parse.currency = inferCurrency(items.map((it) => it.text).join(" "));
  return stageA;
}

async function runStageB(
  buffer: Buffer,
  stageA: StageAResult,
  supplierHint?: string
): Promise<StageBResult> {
  const warnings: string[] = [];
  if (!OCR_ENABLED) {
    warnings.push("OCR fallback disabled via PARSER_OCR_ENABLED");
    return { parse: stageA.parse, warnings, used: false };
  }

  let createWorker: typeof CreateWorker | null = null;
  try {
    ({ createWorker } = await import("tesseract.js"));
  } catch (err) {
    warnings.push("tesseract.js not available; skipped OCR fallback");
    return { parse: stageA.parse, warnings, used: false };
  }

  if (!createWorker) {
    warnings.push("tesseract.js worker unavailable");
    return { parse: stageA.parse, warnings, used: false };
  }

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await createWorker({ logger: () => {} });
  } catch (err: any) {
    warnings.push(`Failed to spawn OCR worker: ${err?.message || err}`);
    return { parse: stageA.parse, warnings, used: false };
  }
  try {
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
  } catch (err: any) {
    warnings.push(`Failed to initialise OCR worker: ${err?.message || err}`);
    await worker.terminate();
    return { parse: stageA.parse, warnings, used: false };
  }

  const pdf = await loadPdf(buffer);
  let page; try {
    page = await pdf.getPage(1);
  } catch (err: any) {
    warnings.push(`Failed to prepare page for OCR: ${err?.message || err}`);
    await worker.terminate();
    return { parse: stageA.parse, warnings, used: false };
  }

  const viewport = page.getViewport({ scale: 2 });
  const NodeCanvasFactory = (pdfjsLib as any).NodeCanvasFactory;
  if (!NodeCanvasFactory) {
    warnings.push("Node canvas factory unavailable; cannot OCR");
    await worker.terminate();
    return { parse: stageA.parse, warnings, used: false };
  }

  const canvasFactory = new NodeCanvasFactory();
  const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

  if (!context || typeof (canvas as any)?.toBuffer !== "function") {
    warnings.push("Canvas buffer API missing; skipping OCR stage");
    canvasFactory.destroy(canvas);
    await worker.terminate();
    return { parse: stageA.parse, warnings, used: false };
  }

  try {
    await page.render({
      canvasContext: context as any,
      viewport,
      canvasFactory,
    }).promise;
  } catch (err: any) {
    warnings.push(`Failed to render page for OCR: ${err?.message || err}`);
    canvasFactory.destroy(canvas);
    await worker.terminate();
    return { parse: stageA.parse, warnings, used: false };
  }

  const ocrLines = new Map<number, string>();
  const tenSeconds = Date.now() + 10000;

  for (const row of stageA.layoutRows) {
    if (Date.now() > tenSeconds) break;
    if (row.descriptionQuality > 0.6) continue;
    if (!row.numericColumns.length) continue;

    const x = Math.max(0, row.items[0]?.x - 10);
    const y = Math.max(0, viewport.height - row.y - 30);
    const width = Math.min(viewport.width - x, (row.numericColumns[0]?.x ?? viewport.width) - x + 20);
    const height = Math.min(viewport.height - y, Math.max(...row.items.map((it) => it.height)) + 24);
    let png: Buffer;
    const cropWidth = Math.max(1, Math.floor(width));
    const cropHeight = Math.max(1, Math.floor(height));
    try {
      const image = context.getImageData(x, y, cropWidth, cropHeight);
      const rowFactory = new NodeCanvasFactory();
      const { canvas: rowCanvas, context: rowCtx } = rowFactory.create(cropWidth, cropHeight);
      rowCtx.putImageData(image, 0, 0);
      png = rowCanvas.toBuffer("image/png");
      rowFactory.destroy(rowCanvas);
    } catch (err: any) {
      warnings.push(`Failed to extract image for OCR row ${row.index}: ${err?.message || err}`);
      continue;
    }

    try {
      const result = await worker.recognize(png);
      const text = cleanText(result?.data?.text || "");
      if (text) {
        ocrLines.set(row.index, text);
      }
    } catch (err: any) {
      warnings.push(`OCR failed for row ${row.index}: ${err?.message || err}`);
    }
  }

  await worker.terminate();
  canvasFactory.destroy(canvas);

  if (!ocrLines.size) {
    return { parse: stageA.parse, warnings, used: false };
  }

  const mergedLines = stageA.parse.lines.map((line, idx) => {
    const row = stageA.layoutRows[idx];
    const replacement = row ? ocrLines.get(row.index) : undefined;
    if (replacement && replacement.length > line.description.length * 0.75) {
      return { ...line, description: replacement };
    }
    return line;
  });

  const parse: SupplierParseResult = {
    ...stageA.parse,
    lines: mergedLines,
    warnings: stageA.parse.warnings,
    usedStages: stageA.parse.usedStages?.includes("ocr")
      ? stageA.parse.usedStages
      : [...(stageA.parse.usedStages ?? []), "ocr"],
  };

  return { parse, warnings, used: true };
}

function buildFewShotExample(): string {
  return [
    "Supplier: Example Supplies Ltd",
    "Description | Qty | Unit | Unit Cost | Line Total",
    "Bespoke Component | 1 | each | 4321.86 | 4321.86",
    "Delivery | 1 | each | 990.01 | 990.01",
    "Estimated Total | | | | 5311.87",
  ].join("\n");
}

function composePrompt(
  stage: StageAResult,
  ocr: StageBResult | null,
  supplierHint?: string,
  pattern?: Awaited<ReturnType<typeof loadSupplierPattern>>
): string {
  const rows = (ocr?.parse ?? stage.parse).lines
    .map((line, idx) => {
      const qty = line.qty != null ? `qty=${line.qty}` : "";
      const unit = line.unit ? `unit=${line.unit}` : "";
      const cost = line.costUnit != null ? `unit_cost=${line.costUnit}` : "";
      const total = line.lineTotal != null ? `line_total=${line.lineTotal}` : "";
      const details = [qty, unit, cost, total].filter(Boolean).join(" ");
      return `${idx + 1}. ${line.description}${details ? ` (${details})` : ""}`;
    })
    .join("\n");

  const totals = stage.parse.detected_totals;
  const totalsLines = [
    totals?.subtotal != null ? `subtotal=${totals.subtotal}` : null,
    totals?.delivery != null ? `delivery=${totals.delivery}` : null,
    totals?.estimated_total != null ? `estimated_total=${totals.estimated_total}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const hints: string[] = [];
  if (supplierHint) hints.push(`Supplier hint: ${supplierHint}`);
  if (pattern?.headerKeywords?.length) hints.push(`Header keywords: ${pattern.headerKeywords.join(", ")}`);
  if (pattern?.columnXSplits?.length) hints.push(`Column x splits: ${pattern.columnXSplits.join(", ")}`);
  if (pattern?.commonUnits?.length) hints.push(`Common units: ${pattern.commonUnits.join(", ")}`);
  if (pattern?.regexes?.length) hints.push(`Regexes: ${pattern.regexes.join(", ")}`);

  return [
    "You are structuring supplier quotes into JSON.",
    "Extract numbers faithfully (GBP).",
    hints.length ? hints.join("\n") : null,
    "Table rows:",
    rows,
    totalsLines ? `Detected totals: ${totalsLines}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function runStageC(
  stageA: StageAResult,
  stageB: StageBResult | null,
  supplierHint?: string,
  pattern?: Awaited<ReturnType<typeof loadSupplierPattern>>
): Promise<StageCResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for LLM structuring stage");
  }

  const prompt = composePrompt(stageA, stageB, supplierHint, pattern);

  const response = await openaiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content:
          "You turn supplier quote text into structured JSON. Always output GBP numbers as decimals. Preserve delivery lines.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Example UK supplier quote:\n" + buildFewShotExample() },
          { type: "text", text: "Now structure this quote:\n" + prompt },
        ],
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "structure_supplier_quote",
          description: "Turn supplier quote table text into normalized JSON.",
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
        },
      },
    ],
  });

  const toolCall = response.output?.find((part) => part.type === "tool_call");
  if (!toolCall || toolCall.type !== "tool_call" || toolCall.function.name !== "structure_supplier_quote") {
    throw new Error("OpenAI response did not return structured data");
  }

  const args = toolCall.function.arguments;
  const parsed = STRUCTURE_SCHEMA.safeParse(typeof args === "string" ? JSON.parse(args) : args);
  if (!parsed.success) {
    throw new Error(`OpenAI response validation failed: ${parsed.error.message}`);
  }

  const data = parsed.data;
  const parse: SupplierParseResult = {
    currency: data.currency || stageA.parse.currency,
    supplier: data.supplier || supplierHint,
    lines: data.lines,
    detected_totals: data.detected_totals,
    confidence: data.confidence,
    warnings: data.warnings,
    usedStages: stageB?.parse.usedStages
      ? Array.from(new Set([...(stageB.parse.usedStages ?? []), "llm"]))
      : Array.from(new Set([...(stageA.parse.usedStages ?? []), "llm"])),
  };

  return { parse, used: true, warnings: data.warnings ?? [] };
}

function combineConfidence(stageA: StageAResult, stageB: StageBResult | null, stageC: StageCResult | null): number {
  const layout = stageA.layoutConfidence;
  const ocr = stageB?.used ? 0.65 : 0;
  const llm = stageC?.parse.confidence ?? 0.7;
  const base = stageC?.parse.lines?.length ? summariseConfidence(stageC.parse.lines) : summariseConfidence(stageA.parse.lines);
  return norm((layout * 0.35 + llm * 0.45 + ocr * 0.2 + base * 0.3) / 1.3);
}

export interface ParseSupplierOptions {
  supplierHint?: string;
  currencyHint?: string;
}

export async function parseSupplierPdf(
  buffer: Buffer,
  options: ParseSupplierOptions = {}
): Promise<SupplierParseResult> {
  if (!buffer?.length) {
    throw new Error("parseSupplierPdf received empty buffer");
  }

  const pattern = await loadSupplierPattern(options.supplierHint);
  const stageA = await runStageA(buffer, options.supplierHint);

  let stageB: StageBResult | null = null;
  if (stageA.layoutConfidence < 0.55 || stageA.parse.lines.length === 0) {
    stageB = await runStageB(buffer, stageA, options.supplierHint);
  }

  let stageC: StageCResult | null = null;
  try {
    stageC = await runStageC(stageA, stageB, options.supplierHint, pattern);
  } catch (err: any) {
    const warning = `LLM structuring failed: ${err?.message || err}`;
    const warnings = new Set<string>([
      ...(stageB?.parse.warnings ?? []),
      ...(stageA.parse.warnings ?? []),
      warning,
    ]);
    const fallback = stageB?.parse ?? stageA.parse;
    fallback.warnings = Array.from(warnings);
    fallback.usedStages = Array.from(new Set([...(fallback.usedStages ?? []), "llm"]));
    stageC = { parse: fallback, used: false, warnings: Array.from(warnings) };
  }

  const parse = stageC.parse;
  parse.currency = options.currencyHint || parse.currency || stageA.parse.currency;
  parse.usedStages = Array.from(new Set(["pdfjs", ...(stageB?.used ? ["ocr"] : []), ...(stageC?.used ? ["llm"] : [])]));
  parse.confidence = combineConfidence(stageA, stageB, stageC);

  const warningSet = new Set<string>([
    ...stageA.warnings,
    ...(stageB?.warnings ?? []),
    ...(stageC?.warnings ?? []),
  ]);
  if (warningSet.size) {
    parse.warnings = Array.from(warningSet);
  }

  const cues: PatternCues = {
    supplier: parse.supplier || options.supplierHint,
    headerKeywords: stageA.cues.headerKeywords,
    columnXSplits: stageA.cues.columnXSplits,
    commonUnits: parse.lines.map((ln) => ln.unit).filter(Boolean) as string[],
    regexes: parse.lines
      .map((ln) => ln.description)
      .filter(Boolean)
      .map((desc) => desc.replace(/[^A-Za-z0-9\s]/g, " ").trim())
      .filter((desc) => desc.length >= 4),
  };

  saveSupplierPattern(cues).catch((err) => {
    console.warn("[patterns] Failed to persist pattern cues", err);
  });

  return parse;
}
