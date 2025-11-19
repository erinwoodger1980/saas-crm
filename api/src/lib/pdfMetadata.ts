/**
 * PDF Metadata Extraction
 * 
 * Lightweight utilities for extracting metadata from PDFs
 * without full parsing (for auto-detection purposes)
 */

import * as pdfParse from 'pdf-parse';

/**
 * Extract text from the first page of a PDF
 * Used for quote source auto-detection
 */
export async function extractFirstPageText(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer, {
      max: 1, // Only parse first page
    });
    return data.text || '';
  } catch (error) {
    console.error('[extractFirstPageText] Failed:', error);
    return '';
  }
}

/**
 * Extract basic PDF metadata (page count, etc.)
 */
export async function extractPdfMetadata(buffer: Buffer): Promise<{
  pageCount: number;
  title?: string;
  author?: string;
  creator?: string;
}> {
  try {
    const data = await pdfParse(buffer);
    return {
      pageCount: data.numpages,
      title: data.info?.Title,
      author: data.info?.Author,
      creator: data.info?.Creator,
    };
  } catch (error) {
    console.error('[extractPdfMetadata] Failed:', error);
    return { pageCount: 0 };
  }
}
