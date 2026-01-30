/**
 * Legacy structured-parser stage.
 *
 * Flow overview (pre-smart-matching era):
 * 1. `extractStructuredText()` turns a PDF stream into logical rows and cells.
 * 2. `buildSupplierParse()` walks those rows, skips headers/totals, and heuristically
 *    identifies description + numeric columns.
 * 3. For every viable row it infers qty/unit/line-total, accumulating delivery/subtotal hints
 *    and preserving per-row glyph/description quality so downstream stages (OCR/LLM) can decide
 *    whether to intervene.
 * 4. The resulting `SupplierParseResult` feeds later fallbacks (OCR, template, LLM) and now
 *    our smart questionnaire matcher augments it without changing this baseline behaviour.
 */
import type { SupplierParseResult } from "../../types/parse";
import type { ExtractionSummary, ExtractedRow } from "./extract";
import {
  cleanText,
  combineWarnings,
  inferCurrency,
  inferSupplier,
  looksLikeDelivery,
  parseMoney,
  stripTrailingPunctuation,
  summariseConfidence,
} from "./normalize";
import { assessDescriptionQuality } from "./quality";

export interface LineRegion {
  rowIndex: number;
  descriptionQuality: number;
  cells: ExtractedRow["cells"];
}

export interface ParseMetadata {
  glyphQuality: number;
  descriptionQuality: number;
  lineRegions: LineRegion[];
  lowConfidence: boolean;
  warnings?: string[];
}

function looksLikeHeader(line: string): boolean {
  const lower = line.toLowerCase();
  if (!/[0-9]/.test(line)) return false;
  return (
    /\bqty\b/.test(lower) ||
    /quantity/.test(lower) ||
    /unit\s*(price|cost)/.test(lower) ||
    (/total/.test(lower) && /description/.test(lower))
  );
}

function looksLikeHeaderLoose(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /\bqty\b/.test(lower) ||
    /quantity/.test(lower) ||
    /unit\s*(price|cost)/.test(lower) ||
    (/total/.test(lower) && /description/.test(lower))
  );
}

function isTermsSectionStart(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /terms\s*(and|&)\s*conditions/.test(lower) ||
    /conditions\s+of\s+(sale|business)/.test(lower) ||
    /terms\s+of\s+(sale|business)/.test(lower) ||
    /general\s+conditions?/.test(lower) ||
    /standard\s+conditions?/.test(lower) ||
    /\bt&c\b/.test(lower)
  );
}

function isTotalLine(lower: string): boolean {
  return /\bsubtotal\b/.test(lower) || /\btotal\b/.test(lower) || /\bgrand total\b/.test(lower);
}

function collapseCells(row: ExtractedRow): string[] {
  if (row.cells.length) {
    return row.cells.map((cell) => cell.normalized).filter(Boolean);
  }
  return row.normalized.split(/\s{2,}|\t+/).map((c) => cleanText(c)).filter(Boolean);
}

export function buildSupplierParse(extraction: ExtractionSummary): {
  result: SupplierParseResult;
  metadata: ParseMetadata;
} {
  const detectedTotals: SupplierParseResult["detected_totals"] = {};
  const parsedLines: SupplierParseResult["lines"] = [];
  const warnings: string[] = [];
  const lineRegions: LineRegion[] = [];
  let inTermsSection = false;
  let termsSectionSkipped = false;

  const seenDescriptions = new Set<string>();
  let descriptionQualityTotal = 0;
  let descriptionCount = 0;

  const rows = extraction.rows;
  rows.forEach((row, index) => {
    const normalized = row.normalized;
    if (!normalized) return;
    if (inTermsSection) {
      if (looksLikeHeaderLoose(normalized)) {
        inTermsSection = false;
      } else {
        return;
      }
    }
    if (isTermsSectionStart(normalized)) {
      inTermsSection = true;
      termsSectionSkipped = true;
      return;
    }
    if (inTermsSection) return;
    const lower = normalized.toLowerCase();

    if (looksLikeHeader(normalized)) return;

    const tokens = collapseCells(row);
    if (!tokens.length) return;

    const numericColumns = tokens
      .map((value, idx) => ({ index: idx, value, number: parseMoney(value) }))
      .filter((col) => col.number != null);

    if (!numericColumns.length) {
      if (isTotalLine(lower)) {
        const numbers = normalized.match(/[-+]?\d[\d,.]*\d|[-+]?\d+/g) ?? [];
        const parsed = numbers.map((value) => parseMoney(value)).filter((n): n is number => n != null);
        if (parsed.length) {
          const final = parsed[parsed.length - 1];
          if (/delivery/.test(lower)) detectedTotals.delivery = final;
          else if (/subtotal/.test(lower)) detectedTotals.subtotal = final;
          else if (/grand\s+total/.test(lower)) detectedTotals.estimated_total = final;
          else if (/total/.test(lower)) detectedTotals.estimated_total ??= final;
        }
      }
      return;
    }

    const lastNumeric = numericColumns[numericColumns.length - 1];
    const lineTotal = lastNumeric.number!;

    const firstNumericIdx = numericColumns[0].index;
    const descriptionParts = tokens.slice(0, firstNumericIdx);
    let description = descriptionParts.join(" ").trim();
    if (!description && firstNumericIdx > 0 && firstNumericIdx < row.cells.length) {
      description = row.cells
        .slice(0, firstNumericIdx)
        .map((cell) => cell.normalized)
        .join(" ")
        .trim();
    }
    if (!description) {
      description = cleanText(normalized.replace(lastNumeric.value, ""));
    }
    description = stripTrailingPunctuation(description);
    if (!description) return;

    const key = description.toLowerCase();
    if (seenDescriptions.has(key) && numericColumns.length <= 1) return;
    seenDescriptions.add(key);

    let qty: number | undefined;
    let costUnit: number | undefined;
    let unit: string | undefined;

    const priorNumerics = numericColumns.slice(0, -1);
    if (priorNumerics.length) {
      const reversed = [...priorNumerics].reverse();
      for (const col of reversed) {
        const value = col.number!;
        if (!costUnit && value <= lineTotal + 0.01) {
          costUnit = value;
          continue;
        }
        const asInt = Math.round(value);
        if (!qty && Math.abs(value - asInt) < 0.01 && asInt > 0 && asInt <= 1000) {
          qty = asInt;
          continue;
        }
      }
    }

    if (!qty) {
      for (const col of priorNumerics) {
        const value = col.number!;
        const asInt = Math.round(value);
        if (Math.abs(value - asInt) < 0.01 && asInt > 0 && asInt <= 1000) {
          qty = asInt;
          break;
        }
      }
    }

    if (!costUnit && qty && lineTotal) {
      const candidate = lineTotal / qty;
      if (Number.isFinite(candidate) && candidate > 0) {
        costUnit = Math.round(candidate * 100) / 100;
      }
    }

    if (!qty && costUnit && lineTotal) {
      const candidate = lineTotal / costUnit;
      if (Number.isFinite(candidate) && candidate > 0.25 && candidate <= 1000) {
        const rounded = Math.round(candidate * 100) / 100;
        qty = Math.abs(rounded - Math.round(rounded)) < 0.05 ? Math.round(rounded) : rounded;
      }
    }

    if (!costUnit && priorNumerics.length >= 1) {
      const candidate = priorNumerics[priorNumerics.length - 1].number!;
      if (candidate > 0) costUnit = candidate;
    }

    if (!unit && firstNumericIdx > 0 && tokens.length >= 3) {
      const maybeUnit = tokens[firstNumericIdx - 1];
      if (maybeUnit && maybeUnit.length <= 10 && !/[0-9]/.test(maybeUnit)) {
        unit = maybeUnit;
      }
    }

    const descriptionQuality = assessDescriptionQuality(description).score;
    descriptionQualityTotal += descriptionQuality;
    descriptionCount += 1;

    if (looksLikeDelivery(description)) {
      detectedTotals.delivery ??= lineTotal;
    }

    parsedLines.push({ description, qty, unit, costUnit, lineTotal });
    lineRegions.push({ rowIndex: index, descriptionQuality, cells: row.cells });
  });

  const productLines = parsedLines.filter((ln) => !looksLikeDelivery(ln.description));
  const deliveryLine = parsedLines.find((ln) => looksLikeDelivery(ln.description));

  if (!detectedTotals.delivery && deliveryLine?.lineTotal != null) {
    detectedTotals.delivery = deliveryLine.lineTotal;
  }

  const subtotalFromLines = productLines.reduce((acc, ln) => {
    const total = ln.lineTotal ?? (ln.costUnit ?? 0) * (ln.qty ?? 1);
    return acc + (Number.isFinite(total) ? total : 0);
  }, 0);

  if (!detectedTotals.subtotal && subtotalFromLines > 0) {
    detectedTotals.subtotal = Math.round(subtotalFromLines * 100) / 100;
  }

  const totalEstimate = (detectedTotals.subtotal ?? subtotalFromLines) + (detectedTotals.delivery ?? 0);
  if (!detectedTotals.estimated_total && totalEstimate > 0) {
    detectedTotals.estimated_total = Math.round(totalEstimate * 100) / 100;
  }

  if (parsedLines.length === 0) {
    warnings.push("No line items detected in structured parser stage");
  }
  if (termsSectionSkipped) {
    warnings.push("Terms/conditions section skipped");
  }

  const descriptionQuality = descriptionCount ? descriptionQualityTotal / descriptionCount : 0;
  // Robust quality score: treat <0.55 as likely garbled/unreliable.
  const lowConfidence = descriptionQuality < 0.55 || extraction.glyphQuality < 0.5;

  const supplier = inferSupplier(rows.map((row) => row.normalized));
  const currency = inferCurrency(extraction.rawText);

  const result: SupplierParseResult = {
    currency,
    supplier: supplier || undefined,
    lines: parsedLines,
    detected_totals: Object.keys(detectedTotals).length ? detectedTotals : undefined,
    confidence: summariseConfidence(parsedLines),
  };

  const metadata: ParseMetadata = {
    glyphQuality: extraction.glyphQuality,
    descriptionQuality,
    lineRegions,
    lowConfidence,
    warnings: warnings.length ? warnings : undefined,
  };

  const combinedWarnings = combineWarnings(extraction.warnings, metadata.warnings);
  if (combinedWarnings?.length) {
    result.warnings = combinedWarnings;
  }

  return { result, metadata };
}
