import OpenAI from "openai";
import { z } from "zod";
import path from "path";
import { pathToFileURL } from "url";

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
import { explainShouldUseOcr } from "./ocrDecisionGate";
import {
  cleanText,
  combineWarnings,
  inferCurrency,
  summariseConfidence,
} from "../pdf/normalize";
import { assessDescriptionQuality } from "../pdf/quality";
import {
  loadSupplierPattern,
  saveSupplierPattern,
  type PatternCues,
} from "./patterns";
import { callMlWithUpload, normaliseMlPayload } from "../ml";

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

function parseLineItemsFromTextLines(
  lines: string[],
  supplierHint?: string,
  currency?: string,
): SupplierParseResult | null {
  const cleanedLines = (lines || [])
    .map((l) => cleanText(String(l || "")).replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  if (!cleanedLines.length) return null;

  const parsedLines: SupplierParseResult["lines"] = [];
  const detectedTotals: SupplierParseResult["detected_totals"] = {};
  let supplier = supplierHint?.trim();

  const tryFixLeadingQtyConcatenation = (first: string, second: string): string => {
    // Common extraction glitch for some PDFs: "2798.52 1 2798.52" becomes "2798.5212798.52".
    // When we split by decimals we see: first=2798.52, second=12798.52. Recover by stripping
    // the leading qty digit when it matches this pattern.
    if (!first || !second) return second;
    if (second.length === first.length + 1 && second.startsWith("1") && second.endsWith(first)) {
      return first;
    }
    return second;
  };

  const parseLangvaldaPriceRow = (text: string) => {
    const line = String(text || "");
    const dimMatch = line.match(/\b\d{3,4}\s*[xX]\s*\d{3,4}\s*mm\b/);
    const areaMatch = line.match(/\b\d+(?:\.\d+)?\s*m(?:2|\u00B2)(?=\s|$)/i);
    if (!dimMatch || !areaMatch) return null;

    // Remove the area token before extracting price decimals, so we don't treat 3.10m² as money.
    const withoutArea = line.replace(areaMatch[0], " ");
    // Some PDFs concatenate tokens (e.g. "2798.52 1 2798.52" => "2798.5212798.52").
    // Avoid word-boundary matching here.
    const decimals = withoutArea.match(/\d{1,6}\.\d{2}/g) || [];
    if (decimals.length < 2) return null;

    const unitRaw = decimals[0];
    const totalRaw = tryFixLeadingQtyConcatenation(unitRaw, decimals[decimals.length - 1]);

    const unit = Number(unitRaw.replace(/,/g, ""));
    const total = Number(totalRaw.replace(/,/g, ""));
    if (!Number.isFinite(unit) || !Number.isFinite(total) || unit <= 0 || total <= 0) return null;

    const ratio = unit > 0 ? total / unit : 1;
    const qtyRounded = Math.round(ratio);
    const qty = Number.isFinite(ratio) && qtyRounded >= 1 && qtyRounded <= 999 && Math.abs(ratio - qtyRounded) < 0.02
      ? qtyRounded
      : 1;

    return {
      dimensions: cleanText(dimMatch[0]).replace(/\s+/g, ""),
      area: cleanText(areaMatch[0]).replace(/\s+/g, ""),
      costUnit: unit,
      lineTotal: total,
      qty,
    };
  };

  // Treat either explicit currency amounts, OR bare-decimal amounts as money.
  // Some supplier PDFs use columns like "Price, GBP" but the numeric cells contain no £ symbol.
  // Avoid interpreting areas/dimensions (e.g. 3.10m², 1730x1790mm) as money.
  const moneyTokenRe = /(?:[£€$]\s*)?\b\d[\d,]*\.\d{2}\b(?!\s*(?:m2|m\u00B2|mm|cm|kg)\b)/i;
  const moneyTokenReGlobal = new RegExp(moneyTokenRe.source, "g");
  const getMoneyTokens = (text: string): string[] => text.match(moneyTokenReGlobal) || [];
  const hasMoneyToken = (text: string): boolean => moneyTokenRe.test(text);

  const isHeaderOrMeta = (text: string): boolean => {
    if (!text) return true;
    const lower = text.toLowerCase();
    if (/\bquotation\b|\bquote\b|\binvoice\b/i.test(text)) return true;
    if (/\bpage\b\s*\d+\s*(of\s*\d+)?/i.test(text)) return true;
    if (/\bcarried\s+forward\b|\bbrought\s+forward\b/i.test(text)) return true;
    if (/\bitem\b\s*description\b\s*qty\b|\bunit\b\s*total\b/i.test(lower)) return true;
    if (/^\s*dear\b/i.test(lower)) return true;
    if (/\bthank you\b/i.test(lower)) return true;
    if (/\bvalidity\b/i.test(lower)) return true;
    if (/\bdate\s+of\s+quotation\b/i.test(lower)) return true;
    if (/^\s*notes?\s*:/i.test(text)) return true;
    if (/\byours\s+(sincerely|faithfully)\b/i.test(lower)) return true;
    if (/\bkind\s+regards\b/i.test(lower)) return true;
    return false;
  };

  const isLikelyDetailLine = (text: string): boolean => {
    const t = String(text || "").trim();
    if (!t) return false;
    if (isHeaderOrMeta(t)) return false;
    if (/^\s*[£€$]\s*\d/.test(t)) return false;
    if (/\btotal\s+weight\b/i.test(t)) return false;
    if (/\bvat\b/i.test(t)) return false;
    if (/\bkg\b/i.test(t) && !/[A-Za-z]{3,}/.test(t)) return false;
    // Keep spec-like lines.
    if (/:/.test(t)) return true;
    if (/\b(mm|cm|m)\b/i.test(t)) return true;
    if (/(timber|softwood|hardwood|glazed|glass|planitherm|argon|u-?value|fittings|hinge|handle|lock|finish|ral)/i.test(t)) return true;
    // Otherwise: require meaningful words.
    return /[A-Za-z]{4,}/.test(t);
  };

  const isCandidateDescriptionLine = (text: string): boolean => {
    const t = String(text || "").trim();
    if (!t) return false;
    if (isHeaderOrMeta(t)) return false;
    if (hasMoneyToken(t)) return false;
    if (/\bsubtotal\b|\bsub total\b|\btotal\b|\bgrand total\b/i.test(t)) return false;
    if (/\bvat\b/i.test(t)) return false;
    return /[A-Za-z]{3,}/.test(t);
  };

  for (let i = 0; i < cleanedLines.length; i += 1) {
    const line = cleanedLines[i];
    const lower = line.toLowerCase();
    if (!supplier && /\bfit47\b/i.test(line)) supplier = "Fit47";
    if (!supplier && /\blangvalda\b/i.test(line)) supplier = "Langvalda";
    if (!supplier && /\bfenstercraft\b/i.test(line)) supplier = "Fenstercraft";

    // Skip obvious headers.
    if (isHeaderOrMeta(line)) continue;

    // Special-case: Langvalda/Fenstercraft style rows like:
    // "1730x1790mm 3.10m² 2798.52 1 2798.52" (often without £, and sometimes the "1" is concatenated).
    // If detected, attach the nearest preceding WG* line as the description.
    const langRow = parseLangvaldaPriceRow(line);
    if (langRow) {
      let descIndex: number | null = null;
      for (let off = 1; off <= 18; off += 1) {
        const idx = i - off;
        if (idx < 0) break;
        const candidate = cleanedLines[idx];
        if (!candidate) continue;
        if (/^wg\d+\b/i.test(candidate)) {
          descIndex = idx;
          break;
        }
        if (/^l\d+\b/i.test(candidate) && idx + 1 < cleanedLines.length && /^wg\d+\b/i.test(cleanedLines[idx + 1] || "")) {
          descIndex = idx + 1;
          break;
        }
        if (/^l\d+\s*:\s*wg\d+\b/i.test(candidate)) {
          descIndex = idx;
          break;
        }
      }

      const descBase = descIndex != null ? cleanText(cleanedLines[descIndex]).trim() : "Joinery item";

      const detailLines: string[] = [];
      const detailStart = descIndex != null ? descIndex + 1 : Math.max(0, i - 12);
      for (let j = detailStart; j < i; j += 1) {
        const t = cleanedLines[j];
        if (!t) continue;
        if (isHeaderOrMeta(t)) continue;
        if (/^price\b/i.test(t)) continue;
        if (/^\d+\s*[xX]\s*\d+\s*mm\b/i.test(t)) continue;
        if (/\bpcs\b|\btotal\b|\bgbp\b/i.test(t)) continue;
        if (/^\d+\./.test(t) || /(wood:|finish:|glass:|fittings:|ventilation:)/i.test(t)) {
          detailLines.push(t);
        }
      }

      const details = detailLines
        .map((l) => cleanText(l).replace(/\s{2,}/g, " ").trim())
        .filter(Boolean)
        .slice(0, 18);

      const desc = `${descBase} (${langRow.dimensions}, ${langRow.area})${details.length ? ` — ${details.join(" ")}` : ""}`
        .replace(/\s{2,}/g, " ")
        .trim();

      parsedLines.push({
        description: desc,
        qty: langRow.qty,
        costUnit: langRow.costUnit,
        lineTotal: langRow.lineTotal,
        rawText: [descBase, ...details, line].join("\n"),
        meta: { sourceLine: line, detailLines: details, dimensions: langRow.dimensions, area: langRow.area } as any,
      });
      continue;
    }

    // Totals.
    if (/\btotal\s+weight\b/i.test(lower)) continue;
    if (/\bvat\b/i.test(lower)) continue;
    if (/\bsubtotal\b|\bsub total\b|\btotal\b|\bgrand total\b/i.test(lower)) {
      const monies = getMoneyTokens(line);
      const last = monies.length ? monies[monies.length - 1] : null;
      const value = last ? Number(last.replace(/[£€$,\s]/g, "")) : null;
      if (value != null && Number.isFinite(value)) {
        if (/\bsubtotal\b|\bsub total\b/i.test(lower)) detectedTotals.subtotal = value;
        else detectedTotals.estimated_total = value;
      }
      continue;
    }

    const monies = getMoneyTokens(line);
    if (!monies.length) continue;

    const hasAlpha = /[A-Za-z]/.test(line);

    // Some PDFs split the row so the qty + money appears alone (no description), followed by the
    // product header on the next line. Attach the priced row to a nearby description line.
    if (!hasAlpha) {
      // Avoid converting subtotal-like money-only lines into fake items.
      // Common pattern: a single currency amount followed by VAT/Total sections.
      if (monies.length === 1) {
        const lookahead = cleanedLines
          .slice(i + 1, Math.min(cleanedLines.length, i + 6))
          .join(" ")
          .toLowerCase();
        if (/\bvat\b|\btotal\b|\bsubtotal\b|\bsub\s+total\b|\btotal\s+weight\b/.test(lookahead)) {
          continue;
        }
      }

      const lineTotalRaw = monies[monies.length - 1];
      const costUnitRaw = monies.length >= 2 ? monies[monies.length - 2] : undefined;
      const lineTotal = Number(lineTotalRaw.replace(/[£€$,\s]/g, ""));
      const costUnit = costUnitRaw ? Number(costUnitRaw.replace(/[£€$,\s]/g, "")) : undefined;

      const firstMoney = monies[0];
      const beforeMoney = firstMoney ? line.slice(0, Math.max(0, line.indexOf(firstMoney))) : line;
      const qtyMatches = beforeMoney.match(/\b\d+(?:\.\d+)?\b/g) || [];
      const qtyCandidate = qtyMatches.length ? Number(qtyMatches[qtyMatches.length - 1]) : undefined;
      const qty = qtyCandidate != null && Number.isFinite(qtyCandidate) && qtyCandidate > 0 && qtyCandidate <= 999
        ? qtyCandidate
        : undefined;

      const window = 6;
      let descIndex: number | null = null;
      for (let off = 1; off <= window; off += 1) {
        const idx = i + off;
        if (idx >= cleanedLines.length) break;
        const candidate = cleanedLines[idx];
        if (isCandidateDescriptionLine(candidate)) {
          descIndex = idx;
          break;
        }
      }
      if (descIndex == null) {
        for (let off = 1; off <= window; off += 1) {
          const idx = i - off;
          if (idx < 0) break;
          const candidate = cleanedLines[idx];
          if (isCandidateDescriptionLine(candidate)) {
            descIndex = idx;
            break;
          }
        }
      }

      if (descIndex == null) continue;

      let desc = cleanText(cleanedLines[descIndex]).replace(/\s{2,}/g, " ").trim();
      if (!desc) continue;

      const detailLines: string[] = [];
      let j = descIndex + 1;
      const maxDetailLines = 14;
      while (j < cleanedLines.length && detailLines.length < maxDetailLines) {
        const next = cleanedLines[j];
        if (!next) {
          j += 1;
          continue;
        }
        if (isHeaderOrMeta(next)) break;
        if (hasMoneyToken(next)) break;
        if (/\bsubtotal\b|\bsub total\b|\btotal\b|\bgrand total\b/i.test(next.toLowerCase())) break;
        if (/\bcarried\s+forward\b|\bbrought\s+forward\b/i.test(next)) break;

        if (isLikelyDetailLine(next)) detailLines.push(next);
        j += 1;
      }

      if (detailLines.length) {
        desc = `${desc} — ${detailLines.join(" ")}`.replace(/\s{2,}/g, " ").trim();
      }

      const rawText = [line, cleanedLines[descIndex], ...detailLines].join("\n");

      parsedLines.push({
        description: desc,
        ...(qty != null ? { qty } : {}),
        ...(Number.isFinite(costUnit) ? { costUnit } : {}),
        ...(Number.isFinite(lineTotal) ? { lineTotal } : {}),
        ...(rawText ? { rawText } : {}),
        meta: { sourceLine: cleanedLines[descIndex], priceLine: line, detailLines } as any,
      });

      // Skip consumed range (desc + details). We also skip any intervening lines between price and desc.
      if (j > i) i = j - 1;
      continue;
    }

    // Require some alpha characters to avoid capturing pure numeric rows.
    const lineTotalRaw = monies[monies.length - 1];
    const costUnitRaw = monies.length >= 2 ? monies[monies.length - 2] : undefined;
    const lineTotal = Number(lineTotalRaw.replace(/[£€$,\s]/g, ""));
    const costUnit = costUnitRaw ? Number(costUnitRaw.replace(/[£€$,\s]/g, "")) : undefined;

    // Qty: take the last number immediately before the first money token.
    const firstMoney = getMoneyTokens(line)[0];
    const beforeMoney = firstMoney ? line.slice(0, Math.max(0, line.indexOf(firstMoney))) : line;
    const qtyMatches = beforeMoney.match(/\b\d+(?:\.\d+)?\b/g) || [];
    const qtyCandidate = qtyMatches.length ? Number(qtyMatches[qtyMatches.length - 1]) : undefined;
    const qty = qtyCandidate != null && Number.isFinite(qtyCandidate) && qtyCandidate > 0 && qtyCandidate <= 999
      ? qtyCandidate
      : undefined;

    // Collect detail/spec lines that follow this line item (often multi-line specs without prices).
    const detailLines: string[] = [];
    let j = i + 1;
    const maxDetailLines = 14;
    while (j < cleanedLines.length && detailLines.length < maxDetailLines) {
      const next = cleanedLines[j];
      if (!next) {
        j += 1;
        continue;
      }
      if (isHeaderOrMeta(next)) break;
      // Stop if we hit another priced row (likely next item) or totals.
      if (hasMoneyToken(next)) break;
      if (/\bsubtotal\b|\bsub total\b|\btotal\b|\bgrand total\b/i.test(next.toLowerCase())) break;
      if (/\bcarried\s+forward\b|\bbrought\s+forward\b/i.test(next)) break;

      if (isLikelyDetailLine(next)) detailLines.push(next);
      j += 1;
    }

    // Description: strip trailing money tokens, collapse whitespace.
    let desc = cleanText(line.replace(moneyTokenReGlobal, " ").replace(/\s{2,}/g, " ").trim());

    // Drop trailing repeated qty token (common when qty is a column).
    if (qty != null) {
      desc = desc.replace(new RegExp(`\\b${qty}\\b\\s*$`), "").trim();
    }

    if (!desc) continue;

    const details = detailLines
      .map((l) => cleanText(l).replace(/\s{2,}/g, " ").trim())
      .filter(Boolean);

    if (details.length) {
      desc = `${desc} — ${details.join(" ")}`.replace(/\s{2,}/g, " ").trim();
    }

    const rawText = [line, ...details].join("\n");

    parsedLines.push({
      description: desc,
      ...(qty != null ? { qty } : {}),
      ...(Number.isFinite(costUnit) ? { costUnit } : {}),
      ...(Number.isFinite(lineTotal) ? { lineTotal } : {}),
      ...(rawText ? { rawText } : {}),
      ...(details.length
        ? { meta: { sourceLine: line, detailLines: details } as any }
        : { meta: { sourceLine: line } as any }),
    });

    // Skip any consumed detail lines.
    if (j > i + 1) i = j - 1;
  }

  if (!parsedLines.length) return null;

  return {
    supplier,
    currency: currency || "GBP",
    lines: parsedLines,
    detected_totals: Object.keys(detectedTotals).length ? detectedTotals : undefined,
    warnings: ["Recovered line items from pdfjs text"],
  };
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

function assessLineQuality(lines: SupplierParseResult["lines"]): {
  avgScore: number;
  gibberishRate: number;
  scoredCount: number;
} {
  let scored = 0;
  let scoreSum = 0;
  let gibberish = 0;
  for (const line of lines || []) {
    const desc = String((line as any)?.description || "").trim();
    if (!desc) continue;
    const q = assessDescriptionQuality(desc);
    scored += 1;
    scoreSum += q.score;
    if (q.gibberish || q.score < 0.55) gibberish += 1;
  }
  return {
    scoredCount: scored,
    avgScore: scored ? scoreSum / scored : 0,
    gibberishRate: scored ? gibberish / scored : 0,
  };
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

  // If Stage A produces nothing, try a simple Tj-based plain-text fallback.
  // This is also useful for some PDFs where the structured extraction is unusable.
  const stageAFallback = plainTextFallback(buffer, supplier, currency);
  if (!baseParse.lines.length && stageAFallback?.lines?.length) {
    baseParse.lines = stageAFallback.lines;
    baseParse.detected_totals = stageAFallback.detected_totals;
    baseParse.supplier = stageAFallback.supplier ?? baseParse.supplier;
    baseParse.currency = stageAFallback.currency ?? baseParse.currency;
    baseParse.warnings = unique([...(baseParse.warnings ?? []), ...(stageAFallback.warnings ?? [])]);
  }

  // Check if this is a Joinerysoft PDF and apply special handling
  const isJoinerysoft = detectJoinerysoftPdf(extraction);
  if (isJoinerysoft) {
    baseParse = handleJoinerysoftPdf(extraction, baseParse);
  }

  // If Stage A returned lines but they look like gibberish, prefer the plain-text
  // fallback when it yields higher-quality descriptions. This is critical when
  // OCR is disabled (deterministic mode) so we don't persist/display garbage.
  if (baseParse.lines.length && stageAFallback?.lines?.length) {
    const baseQ = assessLineQuality(baseParse.lines);
    const fbQ = assessLineQuality(stageAFallback.lines);

    const baseLooksBad = baseQ.gibberishRate >= 0.3 || (baseQ.scoredCount >= 3 && baseQ.avgScore < 0.55);
    const fallbackLooksBetter =
      fbQ.scoredCount >= 2 &&
      (fbQ.gibberishRate + 0.15 < baseQ.gibberishRate || fbQ.avgScore > baseQ.avgScore + 0.1);

    if (baseLooksBad && fallbackLooksBetter) {
      baseParse = {
        ...baseParse,
        lines: stageAFallback.lines,
        detected_totals: stageAFallback.detected_totals ?? baseParse.detected_totals,
        supplier: stageAFallback.supplier ?? baseParse.supplier,
        currency: stageAFallback.currency ?? baseParse.currency,
        warnings: unique([
          ...(baseParse.warnings ?? []),
          ...(stageAFallback.warnings ?? []),
          "Fallback plain-text parser used (gibberish detected)",
        ]),
      };
    }
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
  options?: { ocrEnabled?: boolean; ocrAutoWhenNoText?: boolean },
): Promise<StageBResult> {
  const stageStartedAt = Date.now();

  const extractRawTextByPageForGate = async (): Promise<string[]> => {
    try {
      // pdfjs-dist v4 ships ESM entrypoints. Use dynamic import so this file can remain CJS.
      const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

      const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const standardFontDataUrl = (() => {
        try {
          const pkgPath = require.resolve("pdfjs-dist/package.json");
          return pathToFileURL(path.join(path.dirname(pkgPath), "standard_fonts/")).href;
        } catch {
          return undefined;
        }
      })();

      const loadingTask = pdfjsLib.getDocument({
        data,
        ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
      });
      const doc = await loadingTask.promise;
      const pages: string[] = [];
      const pageCount = Math.max(0, Math.min(2, Number(doc?.numPages || 0)));
      for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
        const page = await doc.getPage(pageNum);
        const tc = await page.getTextContent();

        // Build line breaks by grouping items with similar Y coordinates.
        const groups = new Map<number, { x: number; str: string }[]>();
        for (const it of tc?.items || []) {
          const s = String((it as any)?.str || "").trim();
          if (!s) continue;
          const t = (it as any)?.transform;
          const x = Array.isArray(t) && typeof t[4] === "number" ? t[4] : 0;
          const yRaw = Array.isArray(t) && typeof t[5] === "number" ? t[5] : 0;
          const y = Math.round(yRaw);
          const bucket = groups.get(y) || [];
          bucket.push({ x, str: s });
          groups.set(y, bucket);
        }

        const ys = Array.from(groups.keys()).sort((a, b) => b - a);
        const lines: string[] = [];
        for (const y of ys) {
          const parts = groups.get(y) || [];
          parts.sort((a, b) => a.x - b.x);
          const line = parts.map((p) => p.str).join(" ").replace(/\s{2,}/g, " ").trim();
          if (!line) continue;
          lines.push(line);
        }

        pages.push(lines.join("\n"));
      }
      try {
        await doc.destroy();
      } catch {}
      return pages;
    } catch {
      return [];
    }
  };

  // OCR decision gate: only OCR when extracted text is not usable.
  // We use a lightweight page-text sample for scoring where possible; otherwise we fall back to
  // the extraction summary text.
  const rawTextByPage: string[] = await extractRawTextByPageForGate();
  const gate = explainShouldUseOcr(stageA.extraction, rawTextByPage);

  const configuredOcrEnabled = (() => {
    if (typeof options?.ocrEnabled === "boolean") return options.ocrEnabled;
    return String(process.env.PARSER_OCR_ENABLED ?? "true").toLowerCase() !== "false";
  })();

  // Backwards-compatible option name: ocrAutoWhenNoText now means "auto-enable OCR when text is unusable".
  const autoEnableOcr = !!options?.ocrAutoWhenNoText && gate.useOcr;
  const wantsOcr = configuredOcrEnabled || autoEnableOcr;
  const ocrEnabled = wantsOcr && gate.useOcr;

  const autoWarning = autoEnableOcr && !configuredOcrEnabled
    ? "OCR auto-enabled (text extraction not usable)"
    : null;
  const gibberishLineRate = (() => {
    const lines = stageA.parse.lines || [];
    if (!lines.length) return 0;
    let gibberish = 0;
    for (const line of lines) {
      const desc = String((line as any)?.description || "");
      if (!desc) continue;
      const q = assessDescriptionQuality(desc);
      if (q.gibberish || q.score < 0.55) gibberish += 1;
    }
    return gibberish / lines.length;
  })();

  const shouldAttempt =
    stageA.parse.lines.length === 0 ||
    stageA.metadata.lowConfidence ||
    stageA.metadata.descriptionQuality < 0.55 ||
    gibberishLineRate >= 0.3;

  if (!shouldAttempt) {
    return { parse: stageA.parse, used: false, warnings: [] };
  }

  console.log("[runStageB] OCR gate", {
    shouldAttempt,
    configuredOcrEnabled,
    autoEnableOcr,
    ocrEnabled,
    gate,
  });

  // If Stage A found no line items but pdfjs indicates usable text, try a lightweight
  // deterministic recovery from the extracted pdfjs text (no OCR).
  if (!ocrEnabled && stageA.parse.lines.length === 0 && !gate.useOcr && rawTextByPage.length) {
    const recovered = parseLineItemsFromTextLines(
      rawTextByPage.join("\n").split(/\r?\n+/g),
      stageA.parse.supplier,
      stageA.parse.currency,
    );
    if (recovered?.lines?.length) {
      const warnings = unique([...(stageA.warnings ?? []), ...(recovered.warnings ?? [])]);
      return {
        parse: attachWarnings(
          {
            ...recovered,
            supplier: recovered.supplier || stageA.parse.supplier,
            currency: recovered.currency || stageA.parse.currency,
          },
          warnings,
        ),
        used: false,
        warnings,
      };
    }
  }

  // Fast-fail mode: do not attempt OCR when it isn't needed (text usable) or explicitly disabled.
  if (!ocrEnabled) {
    const warning = gate.useOcr
      ? "OCR disabled; parser could not recover text from PDF"
      : "OCR skipped; extracted text looks usable";
    return {
      parse: attachWarnings(stageA.parse, autoWarning ? [warning, autoWarning] : [warning]),
      used: false,
      warnings: autoWarning ? [warning, autoWarning] : [warning],
    };
  }

  console.log("[runStageB] starting OCR recovery", {
    lines: stageA.parse.lines.length,
    lowConfidence: !!stageA.metadata.lowConfidence,
    descriptionQuality: stageA.metadata.descriptionQuality,
    gibberishLineRate,
    autoEnabled: autoEnableOcr,
  });

  // Prefer a real OCR-backed parse via the ML parser when available.
  // This is the most reliable way to recover text from PDFs with broken/garbled text layers.
  if (ocrEnabled) {
    try {
      const filename = `${cleanText(stageA.parse.supplier || "quote") || "quote"}.pdf`;
      const ml = await callMlWithUpload({
        buffer,
        filename,
        timeoutMs: 25000,
        headers: {
          "X-OCR-Enabled": "true",
          // We do our own LLM structuring in Stage C; keep ML deterministic here.
          "X-LLM-Enabled": "false",
        },
      });

      if (ml.ok) {
        const parsed = normaliseMlPayload(ml.data);
        if (parsed?.lines?.length) {
          const warnings = [
            ...(autoWarning ? [autoWarning] : []),
            `OCR fallback used: ML parser (${ml.tookMs}ms)`,
            ...(parsed.warnings ?? []),
          ];
          console.log("[runStageB] done (ML OCR)", {
            tookMs: Date.now() - stageStartedAt,
            lines: parsed.lines.length,
          });
          return { parse: attachWarnings(parsed, warnings), used: true, warnings };
        }
      } else {
        // Important: if ML_URL is missing/misconfigured, callMlWithUpload returns ok:false
        // and we'd otherwise silently fall through to local OCR (which may be slower/less reliable).
        console.warn("[runStageB] ML fallback returned non-OK:", {
          status: ml.status,
          error: ml.error,
          tookMs: ml.tookMs,
        });
      }
    } catch (err: any) {
      // Non-fatal: fall back to local replacement strategy.
      console.warn("[runStageB] ML OCR fallback failed:", err?.message || err);
    }
  }

  // Local OCR is memory-heavy (Chromium render + image processing). On small production instances
  // this can crash the whole API. Only allow it when explicitly enabled.
  const localOcrEnabled = String(
    process.env.PARSER_LOCAL_OCR_ENABLED ?? (process.env.NODE_ENV === "production" ? "false" : "true"),
  ).toLowerCase() === "true";

  if (!localOcrEnabled) {
    const warning =
      "OCR recovery requires ML_URL (ML OCR) or enabling PARSER_LOCAL_OCR_ENABLED; local OCR is disabled";
    return {
      parse: attachWarnings(stageA.parse, autoWarning ? [warning, autoWarning] : [warning]),
      used: false,
      warnings: autoWarning ? [warning, autoWarning] : [warning],
    };
  }

  const fallback = await runOcrFallback(buffer, stageA.extraction);
  if (!fallback) {
    // If we got here, Stage A looked unreliable. Surface a warning so it's visible in UI/debug.
    const warning = "OCR fallback unavailable (parser could not recover text)";
    return {
      parse: attachWarnings(stageA.parse, autoWarning ? [warning, autoWarning] : [warning]),
      used: false,
      warnings: autoWarning ? [warning, autoWarning] : [warning],
    };
  }

  // If OCR produced a full parse (from page-image OCR), prefer that.
  if (fallback.parse?.lines?.length) {
    const warnings = [
      ...(autoWarning ? [autoWarning] : []),
      ...((fallback.warnings ?? fallback.parse.warnings ?? []) as string[]),
    ];
    console.log("[runStageB] done (local OCR)", {
      tookMs: Date.now() - stageStartedAt,
      lines: fallback.parse.lines.length,
    });
    return { parse: attachWarnings(fallback.parse, warnings), used: true, warnings };
  }

  const warnings = [
    ...(autoWarning ? [autoWarning] : []),
    ...((fallback.warnings ?? []) as string[]),
  ];
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

  console.log("[runStageB] done (replacements)", {
    tookMs: Date.now() - stageStartedAt,
    replacements: fallback.replacements.length,
  });

  return { parse: mergedParse, used: true, warnings };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
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
  const stageStartedAt = Date.now();
  if (!base.lines.length) {
    return { parse: base, used: false, warnings: ["LLM structuring skipped: no lines available"] };
  }

  const isProd = process.env.NODE_ENV === "production";
  if (!openaiClient) {
    const warning = isProd 
      ? "OPENAI_API_KEY is required in production for supplier quote structuring"
      : "OpenAI API key missing; structuring stage skipped";
    
    if (isProd) {
      console.error(`[runStageC] ${warning}`);
    }
    
    return {
      parse: base,
      used: false,
      warnings: [warning],
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
    const timeoutMs = (() => {
      const raw = Number(process.env.PARSER_LLM_TIMEOUT_MS);
      if (Number.isFinite(raw) && raw > 0) return raw;
      return 25_000;
    })();

    const response = await withTimeout(
      openaiClient.responses.create({
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
      }),
      timeoutMs,
      "llm_timeout",
    );

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
    console.warn("[runStageC] failed", { tookMs: Date.now() - stageStartedAt, message });
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
  options?: {
    supplierHint?: string;
    currencyHint?: string;
    supplierProfileId?: string | null;
    // Allow callers (e.g. own-quote flow) to run deterministic-only parsing.
    ocrEnabled?: boolean;
    // When ocrEnabled is false, allow OCR only when the PDF has no text layer.
    ocrAutoWhenNoText?: boolean;
    llmEnabled?: boolean;
    // Allow callers to explicitly skip layout-template parsing.
    templateEnabled?: boolean;
  },
): Promise<SupplierParseResult> {
  const supplierHint = options?.supplierHint;
  const currencyHint = options?.currencyHint || "GBP";
  const llmEnabled = options?.llmEnabled ?? true;
  // NOTE: Layout-template parsing (PdfLayoutTemplate/PdfLayoutAnnotation) has been retired.
  // We keep the option fields for backward compatibility with existing callers,
  // but intentionally do not load or apply templates.

  const pattern = await loadSupplierPattern(supplierHint);
  const stageA = runStageA(buffer, supplierHint, pattern?.supplier);

  type StageName = "pdfjs" | "ocr" | "llm";
  const usedStages = new Set<StageName>();
  usedStages.add("pdfjs");

  let workingParse = { ...stageA.parse, currency: stageA.parse.currency || currencyHint };
  const collectedWarnings = new Set(stageA.warnings);

  const stageB = await runStageB(buffer, stageA, {
    ocrEnabled: options?.ocrEnabled,
    ocrAutoWhenNoText: options?.ocrAutoWhenNoText,
  });
  if (stageB.used) usedStages.add("ocr");
  stageB.warnings.forEach((warning) => collectedWarnings.add(warning));
  workingParse = stageB.parse;

  const patternSummary = summarisePattern(pattern || stageA.cues);
  const stageC = llmEnabled
    ? await runStageC(workingParse, {
        supplierHint: supplierHint || workingParse.supplier || pattern?.supplier,
        currencyHint,
        patternSummary,
      })
    : undefined;

  if (stageC?.used) usedStages.add("llm");
  stageC?.warnings?.forEach((warning) => collectedWarnings.add(warning));
  if (stageC?.parse) workingParse = stageC.parse;

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

  // Text-only enrichment (no image extraction/rendering).
  // We intentionally avoid extracting images from PDFs because it is unreliable and slow.
  try {
    const fullText = String(stageA.extraction?.rawText || "");
    if (fullText) {
      workingParse.lines = workingParse.lines.map((line) => {
        const description = String(line.description || "");
        const lineText = String((line as any).rawText || description).toLowerCase();
        const productIdMatch = description.match(/\b(fd\d+|ref[:\s]*[\w-]+|item[:\s]*[\w-]+)\b/i);
        const productData = extractProductDataFromText(lineText, fullText, productIdMatch?.[0]);

        return {
          ...line,
          productType: productData.type,
          wood: productData.wood,
          finish: productData.finish,
          glass: productData.glass,
          dimensions: productData.dimensions,
          area: productData.area,
        };
      });
    }
  } catch (err: any) {
    console.warn("[parseSupplierPdf] Text enrichment failed:", err);
    collectedWarnings.add(`Text enrichment failed: ${err?.message || String(err)}`);
    workingParse = attachWarnings(workingParse, collectedWarnings);
  }

  return workingParse;
}

/**
 * Extract structured product data from supplier quote text
 * Looks for: Type, Wood, Finish, Glass, Dimensions, Area
 */
function extractProductDataFromText(
  lineText: string,
  fullText: string,
  productId?: string
): {
  type?: string;
  wood?: string;
  finish?: string;
  glass?: string;
  dimensions?: string;
  area?: string;
} {
  const data: any = {};
  
  // Combine line and full text for searching
  const searchText = `${lineText}\n${fullText}`;
  
  // Extract Type (e.g., "BRIO bifolding door, without decoration")
  const typeMatch = searchText.match(/type[:\s]+([\w\s,]+?)(?:\n|wood|finish|glass|dimensions|$)/i);
  if (typeMatch) {
    data.type = typeMatch[1].trim().substring(0, 100); // Limit length
  }
  
  // Extract Wood (e.g., "Accoya", "Oak", "Pine")
  const woodMatch = searchText.match(/wood[:\s]+([\w\s]+?)(?:\n|finish|glass|dimensions|$)/i);
  if (woodMatch) {
    data.wood = woodMatch[1].trim().substring(0, 50);
  }
  
  // Extract Finish (e.g., "White paint RAL 9016", "Natural oil")
  const finishMatch = searchText.match(/finish[:\s]+([\w\s]+?(?:ral\s*\d+)?)(?:\n|glass|dimensions|$)/i);
  if (finishMatch) {
    data.finish = finishMatch[1].trim().substring(0, 50);
  }
  
  // Extract Glass (e.g., "4GR -16Ar- 4GR Sel", "Double glazed")
  const glassMatch = searchText.match(/glass[:\s]+([\w\s\-]+?)(?:\n|dimensions|fittings|$)/i);
  if (glassMatch) {
    data.glass = glassMatch[1].trim().substring(0, 50);
  }
  
  // Extract Dimensions (e.g., "2475x2058mm", "2.4m x 2.0m")
  const dimMatch = searchText.match(/(\d{3,4}\s*[x×]\s*\d{3,4}\s*mm|\d+\.?\d*\s*[mx]\s*[x×]\s*\d+\.?\d*\s*m)/i);
  if (dimMatch) {
    data.dimensions = dimMatch[1].trim();
  }
  
  // Extract Area (e.g., "5.09m²", "5.09 m2")
  const areaMatch = searchText.match(/(\d+\.?\d*\s*m[²2])/i);
  if (areaMatch) {
    data.area = areaMatch[1].trim();
  }
  
  return data;
}
