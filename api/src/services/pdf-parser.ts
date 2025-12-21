/**
 * PDF Parsing Service
 * 
 * Uses pdfjs-dist to extract:
 * - Page images (for AI visual analysis)
 * - Text content (for metadata extraction)
 * - Page metadata (dimensions, rotation, etc.)
 * 
 * Returns structured data ready for AI analysis
 */

import * as pdfjsLib from 'pdfjs-dist';
// Note: canvas package needs to be installed: pnpm add canvas
// For production, consider using pdf-to-png or similar for server-side rendering
// @ts-ignore canvas types are not installed in this package; runtime dependency only
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createCanvas } = require('canvas') as typeof import('canvas');

// Configure PDF.js worker
// In production, host the worker file properly
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

export interface PDFPage {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  imageBase64: string; // PNG image as base64
  metadata: {
    scale: number;
    hasText: boolean;
    textLength: number;
  };
}

export interface PDFParseResult {
  pages: PDFPage[];
  metadata: {
    totalPages: number;
    pdfInfo: any;
    parseTimeMs: number;
  };
}

/**
 * Parse PDF from base64 data
 */
export async function parsePDF(base64Data: string): Promise<PDFParseResult> {
  const startTime = Date.now();

  try {
    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBuffer,
      verbosity: 0 // Suppress warnings
    });

    const pdfDocument = await loadingTask.promise;

    const totalPages = pdfDocument.numPages;
    const pages: PDFPage[] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const parsedPage = await parsePage(page, pageNum);
      pages.push(parsedPage);
    }

    const parseTimeMs = Date.now() - startTime;

    return {
      pages,
      metadata: {
        totalPages,
        pdfInfo: await pdfDocument.getMetadata(),
        parseTimeMs
      }
    };

  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse a single PDF page
 */
async function parsePage(page: any, pageNumber: number): Promise<PDFPage> {
  // Get page viewport
  const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality

  // Extract text content
  const textContent = await page.getTextContent();
  const text = textContent.items
    .map((item: any) => item.str)
    .join(' ')
    .trim();

  // Render page to canvas
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;

  // Convert canvas to base64 PNG
  const imageBase64 = canvas.toDataURL('image/png').split(',')[1];

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    rotation: viewport.rotation,
    text,
    imageBase64,
    metadata: {
      scale: 2.0,
      hasText: text.length > 0,
      textLength: text.length
    }
  };
}

/**
 * Detect page type from text content and layout
 */
export function detectPageType(page: PDFPage): string {
  const text = page.text.toLowerCase();

  // Common architectural drawing keywords
  const planKeywords = ['plan', 'floor plan', 'ground floor', 'first floor', 'layout'];
  const elevationKeywords = ['elevation', 'front elevation', 'rear elevation', 'side elevation'];
  const sectionKeywords = ['section', 'cross section', 'sectional'];
  const detailKeywords = ['detail', 'typical detail', 'construction detail'];

  if (planKeywords.some(kw => text.includes(kw))) {
    return 'plan';
  }
  if (elevationKeywords.some(kw => text.includes(kw))) {
    return 'elevation';
  }
  if (sectionKeywords.some(kw => text.includes(kw))) {
    return 'section';
  }
  if (detailKeywords.some(kw => text.includes(kw))) {
    return 'detail';
  }

  return 'unknown';
}

/**
 * Extract scale from text (e.g., "1:50", "1:100")
 */
export function extractScale(text: string): string | null {
  const scalePattern = /1:(\d+)/;
  const match = text.match(scalePattern);
  return match ? match[0] : null;
}

/**
 * Extract dimensions from text (e.g., "2400 x 1200")
 */
export function extractDimensions(text: string): Array<{ width: number; height: number }> {
  const dimensions: Array<{ width: number; height: number }> = [];
  
  // Pattern: number x number (with optional mm/cm units)
  const dimPattern = /(\d{3,4})\s*[xX×]\s*(\d{3,4})\s*(mm|cm)?/g;
  
  let match;
  while ((match = dimPattern.exec(text)) !== null) {
    const width = parseInt(match[1]);
    const height = parseInt(match[2]);
    const unit = match[3];

    // Convert cm to mm if needed
    const widthMm = unit === 'cm' ? width * 10 : width;
    const heightMm = unit === 'cm' ? height * 10 : height;

    dimensions.push({ width: widthMm, height: heightMm });
  }

  return dimensions;
}

/**
 * Batch parse multiple pages in parallel (with concurrency limit)
 */
export async function parsePDFPages(
  base64Data: string,
  pageNumbers: number[],
  concurrency: number = 3
): Promise<PDFPage[]> {
  const pdfBuffer = Buffer.from(base64Data, 'base64');
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBuffer,
    verbosity: 0
  });

  const pdfDocument = await loadingTask.promise;
  const pages: PDFPage[] = [];

  // Process pages in batches
  for (let i = 0; i < pageNumbers.length; i += concurrency) {
    const batch = pageNumbers.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async pageNum => {
        const page = await pdfDocument.getPage(pageNum);
        return parsePage(page, pageNum);
      })
    );
    pages.push(...batchResults);
  }

  return pages;
}
