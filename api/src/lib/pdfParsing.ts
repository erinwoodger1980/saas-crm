/**
 * Shared Intelligent PDF Parser
 * 
 * Used across all PDF parsing pipelines:
 * - Supplier quotes
 * - JoinerySoft / estimating software exports
 * - ML training ingestion of historic PDFs
 * 
 * Provides consistent text extraction, line item detection, and 
 * intelligent joinery image attachment.
 */

import * as crypto from 'crypto';
import { _is_gibberish } from 'ml/pdf_parser';
import { loadPdfLayoutTemplate } from './pdf/layoutTemplates';
import {
  matchRowsToQuestionnaireItems,
  parsePdfToRows,
  type QuestionnaireItemSpec,
  type MatchedQuoteLine,
  type ParsedRow,
} from './pdf/smartAssistant';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PdfTextBlock = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
};

export type PdfImageBlock = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: Uint8Array;
  hash: string;
};

export type ParsedLineLike = {
  description: string;
  qty: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  meta: {
    dimensions?: string;
    area?: string;
    type?: string;
    finish?: string;
    glass?: string;
    wood?: string;
    productType?: string;
    imageRef?: {
      page: number;
      hash: string;
      dataUrl?: string;
      bbox?: any;
    };
    [key: string]: any;
  };
};

export type PdfLayout = {
  pages: { width: number; height: number }[];
  textBlocks: PdfTextBlock[];
  images: PdfImageBlock[];
};

// ============================================================================
// REGEX PATTERNS FOR JOINERY DETECTION
// ============================================================================

const PATTERNS = {
  // Dimensions: 1200x800mm, 1200 x 800mm, etc.
  dimensions: /\b(\d{3,4})\s*[xX×]\s*(\d{3,4})\s*mm\b/i,
  
  // Area: 2.5m², 2.5 m2, etc.
  area: /\b(\d+(?:\.\d+)?)\s*m[²2]\b/i,
  
  // Money: £1,234.56, £1234, etc.
  money: /£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
  
  // Joinery keywords
  keywords: /\b(door|window|bifold|bi-fold|sash|frame|casement|sliding|french|patio|entrance|internal|external|fire door|glazed|solid|panel)\b/i,
  
  // Wood types
  wood: /\b(oak|pine|hardwood|softwood|mahogany|walnut|ash|maple|cherry|timber)\b/i,
  
  // Finishes
  finish: /\b(painted|stained|varnished|lacquered|oiled|waxed|natural|primed|factory finished|site finished)\b/i,
  
  // Glass types
  glass: /\b(single glazed|double glazed|triple glazed|toughened|laminated|obscure|clear|frosted|georgian|lead)\b/i,
  
  // Product types
  productType: /\b(door|window|bifold|sash|frame|skylight|rooflight|conservatory)\b/i,
  
  // Quantity patterns
  qty: /^(\d+)\s+(?:x\s+|nr\.?\s+|no\.?\s+)?/i,
};

// ============================================================================
// PDF LAYOUT EXTRACTION
// ============================================================================

/**
 * Extract text blocks and images from a PDF buffer with layout information.
 * Uses existing extraction infrastructure from lib/pdf/extract.ts
 */
export async function extractPdfLayout(buffer: Buffer | ArrayBuffer): Promise<PdfLayout> {
  try {
    // Import existing extraction utilities
    const { extractStructuredText } = await import('./pdf/extract');
    const { extractImagesForParse } = await import('./pdf/extractImages');
    
    // Convert ArrayBuffer to Buffer if needed
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    
    // Extract structured text using existing infrastructure
    const extraction = extractStructuredText(buf);
    
    // Extract images (if available)
    let pdfImages: PdfImageBlock[] = [];
    try {
      const extractedImages = await extractImagesForParse(buf);
      
      // Convert extracted images to PdfImageBlock format
      pdfImages = extractedImages.map((img) => {
        // Decode base64 dataUrl to get image data
        const dataUrlMatch = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        const imageData = dataUrlMatch ? Buffer.from(dataUrlMatch[2], 'base64') : Buffer.from([]);
        
        return {
          page: img.page || 0,
          x: img.bbox?.x || 0,
          y: img.bbox?.y || 0,
          width: img.width || img.bbox?.width || 0,
          height: img.height || img.bbox?.height || 0,
          data: new Uint8Array(imageData),
          hash: hashImageData(imageData),
        };
      });
    } catch (imgError) {
      console.warn('[extractPdfLayout] Image extraction failed, continuing without images:', imgError);
    }
    
    // Convert rows to text blocks with approximate layout
    const textBlocks: PdfTextBlock[] = extraction.rows.map((row, index) => ({
      page: 0, // Basic implementation assumes single page
      x: 0,
      y: index * 20, // Approximate vertical spacing
      width: 600, // Approximate page width
      height: 18,
      text: row.normalized || row.text,
    }));
    
    return {
      pages: [{ width: 612, height: 792 }], // A4 dimensions in points
      textBlocks,
      images: pdfImages,
    };
  } catch (error) {
    console.error('[extractPdfLayout] Failed:', error);
    throw new Error(`PDF layout extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Hash image data for duplicate detection.
 */
function hashImageData(data: Buffer | Uint8Array): string {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// ============================================================================
// LINE ITEM DETECTION FROM TEXT
// ============================================================================

/**
 * Build line items from text blocks by detecting joinery-related content.
 */
export function buildLineItemsFromText(
  textBlocks: PdfTextBlock[],
  options?: { joineryOnly?: boolean }
): ParsedLineLike[] {
  const lines: ParsedLineLike[] = [];
  
  // Group text blocks by page and vertical proximity
  const groupedByPage = groupTextBlocksByPage(textBlocks);
  
  for (const [page, blocks] of Object.entries(groupedByPage)) {
    const itemBlocks = groupIntoItemBlocks(blocks);
    
    for (const itemBlock of itemBlocks) {
      const line = parseItemBlock(itemBlock);
      
      // If joineryOnly option is true, filter out non-joinery items
      if (options?.joineryOnly && !isJoineryLine(line)) {
        continue;
      }
      
      lines.push(line);
    }
  }
  
  return lines;
}

/**
 * Group text blocks by page number.
 */
function groupTextBlocksByPage(blocks: PdfTextBlock[]): Record<number, PdfTextBlock[]> {
  const grouped: Record<number, PdfTextBlock[]> = {};
  
  for (const block of blocks) {
    if (!grouped[block.page]) {
      grouped[block.page] = [];
    }
    grouped[block.page].push(block);
  }
  
  // Sort each page's blocks by vertical position (y), then horizontal (x)
  for (const page in grouped) {
    grouped[page].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) < 10) { // Same line (within 10px)
        return a.x - b.x;
      }
      return yDiff;
    });
  }
  
  return grouped;
}

/**
 * Group text blocks into logical "item blocks" (clusters of related text).
 */
function groupIntoItemBlocks(blocks: PdfTextBlock[]): PdfTextBlock[][] {
  const items: PdfTextBlock[][] = [];
  let currentItem: PdfTextBlock[] = [];
  let lastY = -Infinity;
  
  for (const block of blocks) {
    // If this block is far below the last one (>20px), start a new item
    if (block.y - lastY > 20 && currentItem.length > 0) {
      items.push(currentItem);
      currentItem = [];
    }
    
    currentItem.push(block);
    lastY = block.y;
  }
  
  if (currentItem.length > 0) {
    items.push(currentItem);
  }
  
  return items;
}

/**
 * Parse a group of text blocks into a single line item.
 */
function parseItemBlock(blocks: PdfTextBlock[]): ParsedLineLike {
  const combinedText = blocks.map(b => b.text).join(' ').trim();
  
  // Extract structured data
  const dimensions = extractDimensions(combinedText);
  const area = extractArea(combinedText);
  const prices = extractPrices(combinedText);
  const qty = extractQuantity(combinedText);
  const type = extractType(combinedText);
  const wood = extractWood(combinedText);
  const finish = extractFinish(combinedText);
  const glass = extractGlass(combinedText);
  const productType = extractProductType(combinedText);
  
  // Build description (remove extracted quantities and prices for cleaner description)
  let description = combinedText;
  if (qty !== null) {
    description = description.replace(PATTERNS.qty, '').trim();
  }
  
  return {
    description,
    qty,
    unitPrice: prices.unit,
    totalPrice: prices.total,
    meta: {
      dimensions,
      area,
      type,
      wood,
      finish,
      glass,
      productType,
    },
  };
}

/**
 * Check if a line appears to be joinery-related.
 */
function isJoineryLine(line: ParsedLineLike): boolean {
  const text = line.description.toLowerCase();
  
  // Must match at least one joinery keyword
  if (!PATTERNS.keywords.test(text)) {
    return false;
  }
  
  // And should have dimensions or area or product type
  return !!(
    line.meta.dimensions ||
    line.meta.area ||
    line.meta.productType
  );
}

// ============================================================================
// EXTRACTION HELPERS
// ============================================================================

function extractDimensions(text: string): string | undefined {
  const match = text.match(PATTERNS.dimensions);
  if (match) {
    return `${match[1]}x${match[2]}mm`;
  }
  return undefined;
}

function extractArea(text: string): string | undefined {
  const match = text.match(PATTERNS.area);
  if (match) {
    return `${match[1]}m²`;
  }
  return undefined;
}

function extractPrices(text: string): { unit: number | null; total: number | null } {
  const matches = Array.from(text.matchAll(PATTERNS.money));
  
  if (matches.length === 0) {
    return { unit: null, total: null };
  }
  
  // Parse prices
  const prices = matches.map(m => {
    const priceStr = m[1].replace(/,/g, '');
    return parseFloat(priceStr);
  });
  
  // If only one price, assume it's unit price
  if (prices.length === 1) {
    return { unit: prices[0], total: null };
  }
  
  // If two prices, first is usually unit, second is total
  return { unit: prices[0], total: prices[1] };
}

function extractQuantity(text: string): number | null {
  const match = text.match(PATTERNS.qty);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function extractType(text: string): string | undefined {
  const match = text.match(PATTERNS.keywords);
  return match?.[1];
}

function extractWood(text: string): string | undefined {
  const match = text.match(PATTERNS.wood);
  return match?.[1];
}

function extractFinish(text: string): string | undefined {
  const match = text.match(PATTERNS.finish);
  return match?.[1];
}

function extractGlass(text: string): string | undefined {
  const match = text.match(PATTERNS.glass);
  return match?.[0]; // Return full match for glass descriptions
}

function extractProductType(text: string): string | undefined {
  const match = text.match(PATTERNS.productType);
  return match?.[1];
}

// ============================================================================
// IMAGE CLASSIFICATION AND FILTERING
// ============================================================================

/**
 * Filter images to only those likely to be joinery elevations/products.
 * Removes logos, badges, headers, footers, and duplicate images.
 */
export function classifyAndFilterImages(
  images: PdfImageBlock[],
  pages: { width: number; height: number }[]
): PdfImageBlock[] {
  const filtered: PdfImageBlock[] = [];
  const hashCounts = new Map<string, number>();
  
  // Count occurrences of each image hash
  for (const img of images) {
    hashCounts.set(img.hash, (hashCounts.get(img.hash) || 0) + 1);
  }
  
  for (const img of images) {
    // Skip if this hash appears too many times (likely a logo)
    const count = hashCounts.get(img.hash) || 0;
    if (count > 3) {
      continue;
    }
    
    // Get page dimensions
    const page = pages[img.page];
    if (!page) continue;
    
    const topMargin = page.height * 0.15; // Top 15%
    const bottomMargin = page.height * 0.85; // Bottom 15%
    
    // Skip header/footer images
    if (img.y < topMargin || img.y > bottomMargin) {
      continue;
    }
    
    // Skip tiny images (likely icons or badges)
    if (img.width < 60 && img.height < 60) {
      continue;
    }
    
    // Skip very wide but short images (likely decorative borders)
    const aspectRatio = img.width / img.height;
    if (aspectRatio > 10 || aspectRatio < 0.1) {
      continue;
    }
    
    filtered.push(img);
  }
  
  return filtered;
}

/**
 * Generate a hash for an image based on its dimensions and content.
 */
export function hashImage(image: PdfImageBlock): string {
  const hashInput = `${image.width}x${image.height}-${image.data.slice(0, 100).toString()}`;
  return crypto.createHash('md5').update(hashInput).digest('hex');
}

// ============================================================================
// IMAGE-TO-LINE ATTACHMENT
// ============================================================================

/**
 * Attach joinery images to their corresponding line items based on proximity.
 */
export function attachImagesToLines(
  lines: ParsedLineLike[],
  joineryImages: PdfImageBlock[]
): ParsedLineLike[] {
  // For each image, find the closest joinery line on the same page
  for (const img of joineryImages) {
    let closestLine: ParsedLineLike | null = null;
    let closestDistance = Infinity;
    
    for (const line of lines) {
      // Only attach to lines that look like products
      if (!line.meta.dimensions && !line.meta.productType) {
        continue;
      }
      
      // Calculate vertical distance (simplified - assumes line page info)
      // In real implementation, would need page info from text blocks
      const distance = Math.abs(img.y - 0); // Placeholder
      
      if (distance < closestDistance && distance < 100) { // Within 100px
        closestDistance = distance;
        closestLine = line;
      }
    }
    
    // Attach image reference to the closest line
    if (closestLine) {
      closestLine.meta.imageRef = {
        page: img.page,
        hash: img.hash,
      };
    }
  }
  
  return lines;
}

// ============================================================================
// FALLBACK PLAIN TEXT PARSING
// ============================================================================

/**
 * Fallback parser for when PDF layout extraction fails.
 * Parses plain text line by line.
 */
export function parseFromPlainText(text: string): ParsedLineLike[] {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const items: ParsedLineLike[] = [];
  
  for (const line of lines) {
    // Skip very short lines (likely not item lines)
    if (line.trim().length < 10) {
      continue;
    }
    
    // Parse as a simple item
    const item = parseItemBlock([{
      page: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      text: line,
    }]);
    
    items.push(item);
  }
  
  return items;
}

// ============================================================================
// UNIFIED PARSING ENTRY POINT
// ============================================================================

/**
 * Line item types for classification
 */
export type LineKind = "joinery" | "delivery" | "hardware" | "other";

/**
 * Unified parsed quote line
 */
export interface ParsedQuoteLine {
  id: string;
  kind: LineKind;
  description: string;
  qty: number | null;
  unitCost: number | null;
  lineCost: number | null;
  currency: string; // Made non-optional
  meta: {
    dimensions?: string;
    area?: string;
    type?: string;
    system?: string;
    finish?: string;
    wood?: string;
    glass?: string;
    notes?: string;
    imageRef?: {
      page: number;
      hash: string;
      dataUrl?: string;
      bbox?: { x: number; y: number; width: number; height: number };
    };
    rawText?: string;
    productId?: string;
    [key: string]: any;
  };
}

/**
 * Complete parsed quote result
 */
export interface ParsedQuote {
  source: "supplier" | "user_quote" | "historic";
  supplierName?: string;
  currency?: string;
  jobRef?: string;
  lines: ParsedQuoteLine[];
  confidence?: number;
  warnings?: string[];
  rawLayoutDebug?: any;
  images?: Array<{
    page: number;
    index: number;
    hash: string;
    dataUrl?: string;
    bbox?: { x: number; y: number; width: number; height: number };
    classification: "joinery_elevation" | "logo" | "badge" | "icon" | "unknown";
  }>;
  smartAssistant?: {
    rows: ParsedRow[];
    matches: MatchedQuoteLine[];
    questionnaireItemCount: number;
    templateId?: string | null;
  };
}

/**
 * Options for PDF parsing
 */
export interface ParseOptions {
  source: "supplier" | "user_quote" | "historic";
  currencyFallback?: string;
  supplierHint?: string;
  profile?: string | null;
  debug?: boolean;
  questionnaireItems?: QuestionnaireItemSpec[];
  smartAssistant?: {
    enabled?: boolean;
    items?: QuestionnaireItemSpec[];
    minConfidence?: number;
    dimensionToleranceMm?: number;
  };
}

/**
 * Classify a line item by its description
 */
function classifyLineKind(description: string, meta: any): LineKind {
  const text = `${description} ${meta.rawText || ""}`.toLowerCase();

  // Delivery indicators
  if (
    /\b(delivery|shipping|freight|carriage|transport)\b/.test(text) &&
    !/\bno delivery\b/.test(text)
  ) {
    return "delivery";
  }

  // Hardware indicators
  if (
    /\b(hinge|lock|handle|hardware|fitting|cylinder|threshold|ironmongery)\b/.test(text)
  ) {
    return "hardware";
  }

  // Joinery indicators
  if (
    meta.dimensions ||
    meta.area ||
    meta.productType ||
    PATTERNS.keywords.test(text)
  ) {
    return "joinery";
  }

  return "other";
}

/**
 * UNIFIED PDF PARSING ENTRY POINT
 * 
 * Parse any quote PDF into structured line items with images.
 * This is the SINGLE entry point for all PDF parsing in the app.
 * 
 * @param buffer - PDF file buffer
 * @param options - Parsing options (source, currency, supplier hints)
 * @returns ParsedQuote with structured lines, images, and metadata
 */
export async function parseQuotePdf(
  buffer: Buffer,
  options: ParseOptions
): Promise<ParsedQuote> {
  const {
    source,
    currencyFallback = "GBP",
    supplierHint,
    debug = false,
  } = options;

  const warnings: string[] = [];

  try {
    const { parseSupplierPdf } = await import('./supplier/parse');

    if (debug) console.log("[parseQuotePdf] Parsing with supplier parser...");
    const supplierResult = await parseSupplierPdf(buffer, {
      supplierHint,
      currencyHint: currencyFallback,
      supplierProfileId: options.profile ?? undefined,
    });

    if (supplierResult.warnings) {
      warnings.push(...supplierResult.warnings);
    }

    if (debug) console.log("[parseQuotePdf] Converting to unified format...");
    const resolvedCurrency = supplierResult.currency || currencyFallback;

    const questionnaireItems =
      options.smartAssistant?.items ?? options.questionnaireItems ?? [];
    const smartAssistantEnabled =
      (options.smartAssistant?.enabled ?? true) && questionnaireItems.length > 0;
    let smartAssistantPayload: ParsedQuote["smartAssistant"] | undefined;

    const lines: ParsedQuoteLine[] = supplierResult.lines
      .map((line: any) => {
        const description: string = String(line.description || "");
        const meta: {
          dimensions?: string;
          area?: string;
          type?: string;
          finish?: string;
          glass?: string;
          wood?: string;
          productType?: string;
          productId?: any;
          rawText?: any;
          imageRef?: {
            page: number;
            hash: string;
            dataUrl?: string;
            bbox?: any;
          };
        } = {
          dimensions: line.dimensions,
          area: line.area,
          type: line.type || line.productType,
          wood: line.wood,
          finish: line.finish,
          glass: line.glass,
          productId: line.productId,
          rawText: line.rawText,
        };

        if (line.imageDataUrl) {
          meta.imageRef = {
            page: line.page || 1,
            hash: line.imageIndex ? `img-${line.imageIndex}` : crypto.randomBytes(6).toString('hex'),
            dataUrl: line.imageDataUrl,
            bbox: line.bbox,
          };
        }

        const kind = classifyLineKind(description, meta);

        if (!description.trim() || _is_gibberish(description)) {
          warnings.push(`Invalid description detected: ${description}`);
          return null;
        }

        return {
          id: crypto.randomBytes(8).toString("hex"),
          kind,
          description,
          qty: line.qty ?? null,
          unitCost: line.costUnit ?? null,
          lineCost: line.lineTotal ?? null,
          currency: resolvedCurrency,
          meta,
        };
      })
      .filter((line): line is ParsedQuoteLine => line !== null);

    const images: ParsedQuote['images'] = [];
    for (const line of lines) {
      if (line.meta.imageRef) {
        images.push({
          page: line.meta.imageRef.page,
          index: parseInt(line.meta.imageRef.hash.replace('img-', '')) || 0,
          hash: line.meta.imageRef.hash,
          dataUrl: line.meta.imageRef.dataUrl,
          bbox: line.meta.imageRef.bbox,
          classification: "unknown",
        });
      }
    }

    if (smartAssistantEnabled) {
      try {
        const template = options.profile ? await loadPdfLayoutTemplate(options.profile) : null;
        const parsedRows = await parsePdfToRows({
          buffer,
          template,
          supplierLines: supplierResult.lines,
          currency: resolvedCurrency,
        });
        const matches = matchRowsToQuestionnaireItems(parsedRows, questionnaireItems, {
          dimensionToleranceMm: options.smartAssistant?.dimensionToleranceMm,
          minConfidence: options.smartAssistant?.minConfidence,
        });
        smartAssistantPayload = {
          rows: parsedRows,
          matches,
          questionnaireItemCount: questionnaireItems.length,
          templateId: template?.id ?? null,
        };
      } catch (assistantError: any) {
        const message = assistantError?.message || String(assistantError);
        warnings.push(`[smart-assistant] ${message}`);
        if (debug) console.warn("[parseQuotePdf] smart assistant failed:", message);
      }
    }

    const parsedQuote: ParsedQuote = {
      source,
      lines,
      images,
      warnings,
    };
    if (smartAssistantPayload) {
      parsedQuote.smartAssistant = smartAssistantPayload;
    }
    return parsedQuote;
  } catch (error) {
    console.error("[parseQuotePdf] Error during parsing:", error);
    throw error;
  }
}

/**
 * Convert ParsedQuoteLine to database format
 */
export function convertToDbFormat(
  line: ParsedQuoteLine,
  options: {
    quoteId: string;
    tenantId: string;
    order?: number;
  }
) {
  return {
    id: crypto.randomBytes(16).toString("hex"),
    quoteId: options.quoteId,
    tenantId: options.tenantId,
    order: options.order ?? 0,
    kind: line.kind.toUpperCase(),
    description: line.description,
    qty: line.qty,
    costUnit: line.unitCost,
    costTotal: line.lineCost,
    sellUnit: line.unitCost, // Will be adjusted with markup downstream
    sellTotal: line.lineCost, // Will be adjusted with markup downstream
    currency: line.currency || "GBP",
    meta: JSON.stringify(line.meta),
  };
}

/**
 * Extract joinery lines with images for proposal rendering
 */
export function extractJoineryLinesWithImages(
  parsedQuote: ParsedQuote
): Array<ParsedQuoteLine & { imageDataUrl: string }> {
  return parsedQuote.lines
    .filter(
      (line): line is ParsedQuoteLine & { meta: { imageRef: NonNullable<ParsedQuoteLine['meta']['imageRef']> } } =>
        line.kind === "joinery" && !!line.meta.imageRef?.dataUrl
    )
    .map((line) => ({
      ...line,
      imageDataUrl: line.meta.imageRef!.dataUrl!,
    }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export const pdfParsing = {
  extractPdfLayout,
  buildLineItemsFromText,
  classifyAndFilterImages,
  attachImagesToLines,
  hashImage,
  parseFromPlainText,
  parseQuotePdf,
  convertToDbFormat,
  extractJoineryLinesWithImages,
};
