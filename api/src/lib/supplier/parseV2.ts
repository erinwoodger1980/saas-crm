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
    const supplierLines = convertToSupplierFormat(linesWithImages);

    // STAGE 6: Detect supplier name if not provided
    const detectedSupplier = options?.supplier || detectSupplierFromLayout(layout.textBlocks);

    // STAGE 7: Infer currency if not provided
    const detectedCurrency = options?.currency || inferCurrencyFromText(layout.textBlocks);

    // STAGE 8: Calculate totals
    const detectedTotals = calculateTotals(supplierLines);

    // Build final result
    const result: SupplierParseResult = {
      supplier: detectedSupplier,
      currency: detectedCurrency,
      lines: supplierLines,
      detected_totals: detectedTotals,
      confidence: calculateConfidence(supplierLines),
      usedStages: ['pdfjs'], // Mark as pdfjs-based extraction
      warnings: [],
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
function convertToSupplierFormat(lines: ParsedLineLike[]) {
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
      
      // Additional metadata from joinery detection
      dimensions: line.meta.dimensions,
      area: line.meta.area,
      type: line.meta.type,
      wood: line.meta.wood,
      finish: line.meta.finish,
      glass: line.meta.glass,
      productType: line.meta.productType,
      
      // Image reference (hash for lookup)
      imageHash: line.meta.imageRef?.hash,
      imagePage: line.meta.imageRef?.page,
    };
  });
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
