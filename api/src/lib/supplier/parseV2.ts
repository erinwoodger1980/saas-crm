/**
 * Example: Refactored Supplier Parser using Shared PDF Parser
 * 
 * This is a proof-of-concept showing how to integrate the shared
 * PDF parser into the existing supplier quote parsing workflow.
 * 
 * To enable:
 * 1. Set USE_SHARED_PARSER=true in environment
 * 2. Import and use parseSupplierPdfV2() instead of parseSupplierPdf()
 * 3. Test with sample PDFs
 * 4. Roll out gradually
 */

import type { SupplierParseResult } from "../../types/parse";
import {
  extractPdfLayout,
  buildLineItemsFromText,
  classifyAndFilterImages,
  attachImagesToLines,
  type ParsedLineLike,
  type PdfImageBlock,
} from "../pdfParsing";
import { cleanText, parseMoney } from "../pdf/normalize";

/**
 * V2 supplier parser using shared intelligent PDF extraction.
 * This provides:
 * - Consistent line item detection across all PDFs
 * - Joinery-specific metadata extraction (dimensions, wood, finish, glass)
 * - Intelligent image filtering and attachment
 * - Better handling of complex layouts
 */
export async function parseSupplierPdfV2(
  buffer: Buffer,
  options?: {
    supplier?: string;
    currency?: string;
    saveImages?: boolean;
    tenantId?: string;
    quoteId?: string;
  }
): Promise<SupplierParseResult> {
  console.log('[parseSupplierPdfV2] Starting shared parser pipeline...');

  try {
    // STAGE 1: Extract PDF layout with text blocks and images
    console.log('[parseSupplierPdfV2] Extracting PDF layout...');
    const layout = await extractPdfLayout(buffer);
    console.log(`[parseSupplierPdfV2] Found ${layout.textBlocks.length} text blocks, ${layout.images.length} images`);

    // STAGE 2: Build line items from text using joinery heuristics
    console.log('[parseSupplierPdfV2] Building line items...');
    const genericLines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
    console.log(`[parseSupplierPdfV2] Detected ${genericLines.length} joinery line items`);

    // STAGE 3: Filter and classify images
    console.log('[parseSupplierPdfV2] Filtering images...');
    const joineryImages = classifyAndFilterImages(layout.images, layout.pages);
    console.log(`[parseSupplierPdfV2] Filtered to ${joineryImages.length} joinery images (removed ${layout.images.length - joineryImages.length} logos/headers)`);

    // STAGE 4: Attach images to lines
    console.log('[parseSupplierPdfV2] Attaching images to lines...');
    const linesWithImages = attachImagesToLines(genericLines, joineryImages);
    const linesWithImageCount = linesWithImages.filter(l => l.meta.imageRef).length;
    console.log(`[parseSupplierPdfV2] Attached images to ${linesWithImageCount} lines`);

    // STAGE 5: Convert to SupplierParseResult format
    let supplierLines = convertToSupplierFormat(linesWithImages);

    // STAGE 6: Detect supplier name if not provided
    const detectedSupplier = options?.supplier || detectSupplierFromLayout(layout.textBlocks);

    // STAGE 7: Infer currency if not provided
    const detectedCurrency = options?.currency || inferCurrencyFromText(layout.textBlocks);

    // STAGE 8: Calculate totals
    const detectedTotals = detectTotalsFromTextBlocks(layout.textBlocks, supplierLines);

    const guardrailWarnings = new Set<string>();
    supplierLines = applyPostParseGuardrails(supplierLines, detectedTotals, guardrailWarnings);

    // Build final result
    const result: SupplierParseResult = {
      supplier: detectedSupplier,
      currency: detectedCurrency,
      lines: supplierLines,
      detected_totals: detectedTotals,
      confidence: calculateConfidence(supplierLines),
      usedStages: ['pdfjs'], // Mark as pdfjs-based extraction
      warnings: guardrailWarnings.size ? Array.from(guardrailWarnings) : [],
    };

    console.log('[parseSupplierPdfV2] ✅ Parsing complete');
    console.log(`[parseSupplierPdfV2] Summary: ${supplierLines.length} lines, ${linesWithImageCount} with images, confidence: ${result.confidence}`);

    return result;

  } catch (error) {
    console.error('[parseSupplierPdfV2] ❌ Parsing failed:', error);
    
    // Return minimal valid result on failure
    return {
      supplier: options?.supplier || 'Unknown',
      currency: options?.currency || 'GBP',
      lines: [],
      detected_totals: {},
      confidence: 0,
      error: `Shared parser failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      warnings: ['Parser pipeline failed'],
    };
  }
}

/**
 * Convert generic ParsedLineLike to SupplierParseResult line format.
 */
function convertToSupplierFormat(lines: ParsedLineLike[]): SupplierParseResult["lines"] {
  return lines.map((line) => {
    // Extract unit from product type or default to 'item'
    let unit = 'item';
    if (line.meta.productType) {
      unit = line.meta.productType;
    } else if (line.meta.area) {
      unit = 'm²';
    }

    return {
      description: line.description,
      qty: line.qty || undefined,
      unit,
      costUnit: line.unitPrice || undefined,
      lineTotal: line.totalPrice || undefined,
      meta: {
        ...(line.meta || {}),
        dimensions: line.meta.dimensions,
        area: line.meta.area,
        type: line.meta.type,
        wood: line.meta.wood,
        finish: line.meta.finish,
        glass: line.meta.glass,
        productType: line.meta.productType,
        imageHash: line.meta.imageRef?.hash,
        imagePage: line.meta.imageRef?.page,
      },
    };
  });
}

function normaliseDescriptionKey(text: string): string {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function tokenizeDescription(text: string): Set<string> {
  const key = normaliseDescriptionKey(text);
  return new Set(key.split(" ").filter(Boolean));
}

function isLikelySummaryDuplicate(shortDesc: string, longDesc: string): boolean {
  const shortKey = normaliseDescriptionKey(shortDesc);
  const longKey = normaliseDescriptionKey(longDesc);
  if (!shortKey || !longKey) return false;
  if (longKey.length <= shortKey.length + 5) return false;
  if (longKey.includes(shortKey) && shortKey.length <= 30) return true;

  const shortTokens = tokenizeDescription(shortDesc);
  const longTokens = tokenizeDescription(longDesc);
  if (!shortTokens.size || !longTokens.size) return false;

  let overlap = 0;
  for (const token of shortTokens) {
    if (longTokens.has(token)) overlap += 1;
  }
  const overlapRatio = overlap / Math.max(1, shortTokens.size);
  return overlapRatio >= 0.8 && longTokens.size >= shortTokens.size + 1;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isTermsLine(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /terms\s*(and|&)\s*conditions/.test(lower) ||
    /conditions\s+of\s+(sale|business)/.test(lower) ||
    /terms\s+of\s+(sale|business)/.test(lower) ||
    /general\s+conditions?/.test(lower) ||
    /standard\s+conditions?/.test(lower) ||
    /\bt&c\b/.test(lower)
  );
}

function normaliseLinePricing(
  lines: SupplierParseResult["lines"],
  warnings: Set<string>,
): SupplierParseResult["lines"] {
  let adjustedUnitFromTotal = 0;
  let adjustedTotalFromUnit = 0;
  let filledLineTotal = 0;
  let filledUnitFromTotal = 0;

  const next = lines.map((line) => {
    const qty = line.qty;
    let costUnit = line.costUnit;
    let lineTotal = line.lineTotal;

    if (qty != null && qty > 1) {
      if (lineTotal != null && costUnit != null) {
        const expectedFromUnit = costUnit * qty;
        const ratio = lineTotal > 0 ? expectedFromUnit / lineTotal : 1;
        const costLooksLikeTotal = Math.abs(costUnit - lineTotal) <= Math.max(1, lineTotal * 0.05);
        if (costLooksLikeTotal) {
          const computedTotal = roundMoney(costUnit * qty);
          if (Number.isFinite(computedTotal) && computedTotal > 0) {
            lineTotal = computedTotal;
            adjustedTotalFromUnit += 1;
          }
        } else if (ratio > 1.2 || ratio < 0.8) {
          costUnit = roundMoney(lineTotal / qty);
          adjustedUnitFromTotal += 1;
        }
      } else if (lineTotal != null && costUnit == null) {
        costUnit = roundMoney(lineTotal / qty);
        filledUnitFromTotal += 1;
      } else if (lineTotal == null && costUnit != null) {
        lineTotal = roundMoney(costUnit * qty);
        filledLineTotal += 1;
      }
    }

    return {
      ...line,
      ...(Number.isFinite(costUnit as number) ? { costUnit } : {}),
      ...(Number.isFinite(lineTotal as number) ? { lineTotal } : {}),
    };
  });

  if (adjustedUnitFromTotal > 0) {
    warnings.add(`Adjusted ${adjustedUnitFromTotal} unit price(s) using line totals for qty > 1`);
  }
  if (adjustedTotalFromUnit > 0) {
    warnings.add(`Adjusted ${adjustedTotalFromUnit} line total(s) using unit price × qty`);
  }
  if (filledUnitFromTotal > 0) {
    warnings.add(`Filled ${filledUnitFromTotal} missing unit price(s) from line totals`);
  }
  if (filledLineTotal > 0) {
    warnings.add(`Filled ${filledLineTotal} missing line total(s) from qty × unit price`);
  }

  return next;
}

function dedupeSummaryLines(
  lines: SupplierParseResult["lines"],
  warnings: Set<string>,
): SupplierParseResult["lines"] {
  const byKey = new Map<string, number[]>();
  const keyFor = (line: SupplierParseResult["lines"][number]) => {
    const qty = line.qty != null ? String(line.qty) : "";
    const costUnit = line.costUnit != null ? String(roundMoney(line.costUnit)) : "";
    const lineTotal = line.lineTotal != null ? String(roundMoney(line.lineTotal)) : "";
    return `${qty}|${costUnit}|${lineTotal}`;
  };

  lines.forEach((line, index) => {
    const key = keyFor(line);
    const bucket = byKey.get(key) ?? [];
    bucket.push(index);
    byKey.set(key, bucket);
  });

  const removed = new Set<number>();
  for (const indexes of byKey.values()) {
    if (indexes.length < 2) continue;
    const sorted = [...indexes].sort((a, b) => {
      const lenA = (lines[a]?.description || "").length;
      const lenB = (lines[b]?.description || "").length;
      return lenB - lenA;
    });

    const kept: number[] = [];
    for (const idx of sorted) {
      if (removed.has(idx)) continue;
      const candidate = lines[idx];
      if (!candidate?.description) continue;

      let isDuplicate = false;
      for (const keptIdx of kept) {
        const keptLine = lines[keptIdx];
        if (!keptLine?.description) continue;
        const shortDesc = candidate.description.length <= keptLine.description.length
          ? candidate.description
          : keptLine.description;
        const longDesc = candidate.description.length <= keptLine.description.length
          ? keptLine.description
          : candidate.description;
        if (isLikelySummaryDuplicate(shortDesc, longDesc)) {
          if (candidate.description.length < keptLine.description.length) {
            removed.add(idx);
          } else {
            removed.add(keptIdx);
          }
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) kept.push(idx);
    }
  }

  if (removed.size > 0) {
    warnings.add(`Removed ${removed.size} duplicate summary line(s) (summary + detailed list detected)`);
  }

  return lines.filter((_, index) => !removed.has(index));
}

function detectTotalsFromTextBlocks(
  textBlocks: Array<{ text: string }>,
  lines: SupplierParseResult["lines"],
): SupplierParseResult["detected_totals"] {
  const detected: SupplierParseResult["detected_totals"] = {};
  const text = textBlocks.map((b) => b.text).join("\n");

  const findTotal = (pattern: RegExp): number | null => {
    const match = text.match(pattern);
    if (!match) return null;
    const value = parseMoney(match[1] || match[0]);
    return value != null && Number.isFinite(value) ? value : null;
  };

  detected.subtotal = findTotal(/sub\s*total[^\d£€$]*([£€$]?\s*[-+]?\d[\d,]*\.?\d{0,2})/i) ?? undefined;
  detected.delivery = findTotal(/delivery[^\d£€$]*([£€$]?\s*[-+]?\d[\d,]*\.?\d{0,2})/i) ?? undefined;
  detected.estimated_total =
    findTotal(/total\s+incl[^\d£€$]*([£€$]?\s*[-+]?\d[\d,]*\.?\d{0,2})/i) ??
    findTotal(/grand\s+total[^\d£€$]*([£€$]?\s*[-+]?\d[\d,]*\.?\d{0,2})/i) ??
    findTotal(/total[^\d£€$]*([£€$]?\s*[-+]?\d[\d,]*\.?\d{0,2})/i) ??
    undefined;

  const hasAny = detected.subtotal != null || detected.delivery != null || detected.estimated_total != null;
  if (!hasAny) {
    return calculateTotals(lines);
  }

  return detected;
}

function applyPostParseGuardrails(
  lines: SupplierParseResult["lines"],
  detectedTotals: SupplierParseResult["detected_totals"],
  warnings: Set<string>,
): SupplierParseResult["lines"] {
  let working = lines.filter((line) => !isTermsLine(String(line.description || "")));
  if (working.length !== lines.length) {
    warnings.add("Terms/conditions section skipped");
  }

  working = normaliseLinePricing(working, warnings);
  working = dedupeSummaryLines(working, warnings);

  const expectedTotal =
    (typeof detectedTotals?.subtotal === "number" && Number.isFinite(detectedTotals.subtotal)
      ? detectedTotals.subtotal
      : null) ??
    (typeof detectedTotals?.estimated_total === "number" && Number.isFinite(detectedTotals.estimated_total)
      ? detectedTotals.estimated_total
      : null);

  if (expectedTotal != null) {
    const sumLineTotals = working
      .map((l) => {
        const total =
          typeof l.lineTotal === "number" && Number.isFinite(l.lineTotal)
            ? l.lineTotal
            : (typeof l.costUnit === "number" && Number.isFinite(l.costUnit) && typeof l.qty === "number" && Number.isFinite(l.qty)
              ? l.costUnit * l.qty
              : 0);
        return Number.isFinite(total) ? total : 0;
      })
      .reduce((acc, v) => acc + v, 0);

    if (sumLineTotals > 0) {
      const diff = Math.abs(sumLineTotals - expectedTotal);
      const threshold = Math.max(5, expectedTotal * 0.02);
      if (diff > threshold) {
        warnings.add(
          `Totals check: sum of line totals (${sumLineTotals.toFixed(2)}) differs from detected total (${expectedTotal.toFixed(2)}) by ${diff.toFixed(2)}`,
        );
      }
    }
  }

  return working;
}

/**
 * Attempt to detect supplier name from PDF text blocks.
 */
function detectSupplierFromLayout(textBlocks: Array<{ text: string }>): string {
  // Look in first 10 text blocks for supplier indicators
  const headerBlocks = textBlocks.slice(0, 10);
  
  for (const block of headerBlocks) {
    const text = block.text.toLowerCase();
    
    // Common patterns
    if (text.includes('supplier:')) {
      return block.text.split(':')[1]?.trim() || 'Unknown';
    }
    
    if (text.includes('from:')) {
      return block.text.split(':')[1]?.trim() || 'Unknown';
    }
    
    // Check if block contains "Ltd", "Limited", "& Co" etc
    if (/\b(ltd|limited|plc|llc|inc|& co)\b/i.test(text)) {
      // Clean up and return
      return block.text.replace(/\b(quote|quotation|estimate|invoice)\b/gi, '').trim();
    }
  }
  
  return 'Unknown';
}

/**
 * Infer currency from text content.
 */
function inferCurrencyFromText(textBlocks: Array<{ text: string }>): string {
  const allText = textBlocks.map(b => b.text).join(' ');
  
  if (allText.includes('£') || /\bgbp\b/i.test(allText)) return 'GBP';
  if (allText.includes('€') || /\beur\b/i.test(allText)) return 'EUR';
  if (allText.includes('$') || /\busd\b/i.test(allText)) return 'USD';
  
  return 'GBP'; // Default for UK joinery
}

/**
 * Calculate totals from line items.
 */
function calculateTotals(lines: Array<{ lineTotal?: number }>): {
  subtotal?: number;
  delivery?: number;
  estimated_total?: number;
} {
  let subtotal = 0;
  let hasAnyTotal = false;
  
  for (const line of lines) {
    if (line.lineTotal != null && Number.isFinite(line.lineTotal)) {
      subtotal += line.lineTotal;
      hasAnyTotal = true;
    }
  }
  
  if (!hasAnyTotal) {
    return {};
  }
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    estimated_total: Math.round(subtotal * 100) / 100,
  };
}

/**
 * Calculate overall confidence score.
 */
function calculateConfidence(lines: Array<{ costUnit?: number; lineTotal?: number }>): number {
  if (lines.length === 0) return 0;
  
  let priceCount = 0;
  for (const line of lines) {
    if (line.costUnit != null || line.lineTotal != null) {
      priceCount++;
    }
  }
  
  // Base confidence on proportion of lines with prices
  const priceRatio = priceCount / lines.length;
  
  // Scale to 0-1 range
  return Math.round(Math.min(priceRatio, 1) * 100) / 100;
}

// ============================================================================
// MIGRATION HELPER: Feature Flag Toggle
// ============================================================================

/**
 * Wrapper that uses old or new parser based on environment variable.
 * This allows gradual rollout and A/B testing.
 */
export async function parseSupplierPdf(
  buffer: Buffer,
  options?: {
    supplier?: string;
    currency?: string;
  }
): Promise<SupplierParseResult> {
  const useSharedParser = process.env.USE_SHARED_PARSER === 'true';
  
  if (useSharedParser) {
    console.log('[parseSupplierPdf] 🆕 Using shared parser (v2)');
    return parseSupplierPdfV2(buffer, options);
  } else {
    console.log('[parseSupplierPdf] ⚠️  Using legacy parser (v1)');
    // Import and use original parser
    const { parseSupplierPdf: legacyParser } = await import('./parse');
    return legacyParser(buffer, {
      supplierHint: options?.supplier,
      currencyHint: options?.currency,
    });
  }
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Compare old vs new parser results for testing.
 */
export async function compareParserResults(buffer: Buffer) {
  console.log('\n=== PARSER COMPARISON ===\n');
  
  // Run both parsers
  const [v1Result, v2Result] = await Promise.all([
    (async () => {
      const { parseSupplierPdf: legacyParser } = await import('./parse');
      return legacyParser(buffer);
    })(),
    parseSupplierPdfV2(buffer),
  ]);
  
  // Compare
  console.log(`V1 Lines: ${v1Result.lines.length}`);
  console.log(`V2 Lines: ${v2Result.lines.length}`);
  console.log(`V1 Confidence: ${v1Result.confidence}`);
  console.log(`V2 Confidence: ${v2Result.confidence}`);
  console.log(`V1 Supplier: ${v1Result.supplier}`);
  console.log(`V2 Supplier: ${v2Result.supplier}`);
  
  // Count lines with images (only v2)
  const v2ImagesCount = v2Result.lines.filter((l: any) => l.imageHash).length;
  console.log(`V2 Lines with images: ${v2ImagesCount}`);
  
  return {
    v1: v1Result,
    v2: v2Result,
    comparison: {
      lineDiff: v2Result.lines.length - v1Result.lines.length,
      confidenceDiff: (v2Result.confidence || 0) - (v1Result.confidence || 0),
      v2HasImages: v2ImagesCount > 0,
    },
  };
}
