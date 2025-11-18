/**
 * PDF Image Extraction
 * Extracts images from PDF files and saves them as UploadedFile records
 * for use as per-line thumbnails in quote proposals.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import { FileKind } from "@prisma/client";
import { prisma } from "../../prisma";

export interface ExtractedImage {
  fileId: string;
  page: number;
  indexOnPage: number;
  buffer: Buffer;
  mimeType: string;
}

export interface ImageExtractionResult {
  images: ExtractedImage[];
  warnings: string[];
}

/**
 * Extract images from a PDF buffer and save them as UploadedFile records
 * 
 * @param pdfBuffer - The PDF file buffer
 * @param tenantId - Tenant ID for the files
 * @param quoteId - Quote ID to associate files with
 * @param uploadDir - Directory to save image files
 * @returns Array of created UploadedFile records with page and index metadata
 */
export async function extractAndSaveImagesFromPdf(
  pdfBuffer: Buffer,
  tenantId: string,
  quoteId: string,
  uploadDir: string
): Promise<Array<{ fileId: string; page: number; indexOnPage: number }>> {
  const warnings: string[] = [];
  const savedImages: Array<{ fileId: string; page: number; indexOnPage: number }> = [];

  try {
    // Parse PDF to get basic structure
    const pdfData = await pdfParse(pdfBuffer);
    
    // pdf-parse doesn't extract images directly, but we can try to extract them
    // using a more manual approach with the PDF buffer
    const images = await extractImagesFromBuffer(pdfBuffer);
    
    if (images.length === 0) {
      console.log('[extractImages] No images found in PDF');
      return [];
    }

    console.log(`[extractImages] Found ${images.length} images in PDF`);

    // Ensure upload directory exists
    await fs.promises.mkdir(uploadDir, { recursive: true });

    // Save each image
    for (const img of images) {
      try {
        // Generate unique filename
        const hash = crypto.randomBytes(8).toString("hex");
        const ext = img.mimeType === "image/png" ? "png" : "jpg";
        const filename = `line-image-${hash}.${ext}`;
        const filepath = path.join(uploadDir, filename);

        // Save image file
        await fs.promises.writeFile(filepath, img.buffer);

        // Create UploadedFile record
        const uploadedFile = await prisma.uploadedFile.create({
          data: {
            tenantId,
            quoteId,
            kind: "LINE_IMAGE" as FileKind,
            name: filename,
            path: filepath,
            mimeType: img.mimeType,
            sizeBytes: img.buffer.length,
          },
        });

        savedImages.push({
          fileId: uploadedFile.id,
          page: img.page,
          indexOnPage: img.indexOnPage,
        });

        console.log(`[extractImages] Saved image: ${filename} (page ${img.page}, index ${img.indexOnPage})`);
      } catch (err: any) {
        warnings.push(`Failed to save image: ${err.message}`);
        console.warn('[extractImages] Failed to save image:', err);
      }
    }

    return savedImages;
  } catch (err: any) {
    console.error('[extractImages] Failed to extract images:', err);
    warnings.push(`Image extraction failed: ${err.message}`);
    return [];
  }
}

/**
 * Extract raw image data from PDF buffer
 * This is a simplified extraction that looks for common PDF image patterns
 */
async function extractImagesFromBuffer(pdfBuffer: Buffer): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  
  try {
    // Convert buffer to string for pattern matching
    const pdfText = pdfBuffer.toString('binary');
    
    // Look for PDF image object patterns
    // PDF images are typically stored as XObject streams with /Image type
    const imageObjectRegex = /\/Type\s*\/XObject[\s\S]*?\/Subtype\s*\/Image[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g;
    
    let match;
    let imageIndex = 0;
    let currentPage = 1; // Simplified: we don't track exact page, just count images
    
    while ((match = imageObjectRegex.exec(pdfText)) !== null && imageIndex < 20) {
      try {
        const streamData = match[1];
        
        // Try to detect image format from stream
        const isJPEG = streamData.startsWith('\xFF\xD8\xFF');
        const isPNG = streamData.startsWith('\x89PNG');
        
        if (isJPEG || isPNG) {
          const imageBuffer = Buffer.from(streamData, 'binary');
          
          // Skip very small images (likely icons or decorative elements)
          if (imageBuffer.length < 1024) {
            continue;
          }
          
          images.push({
            fileId: '', // Will be set when saving
            page: currentPage,
            indexOnPage: imageIndex,
            buffer: imageBuffer,
            mimeType: isJPEG ? 'image/jpeg' : 'image/png',
          });
          
          imageIndex++;
        }
      } catch (err) {
        console.warn('[extractImages] Failed to process image stream:', err);
      }
    }
  } catch (err: any) {
    console.error('[extractImages] Buffer extraction failed:', err);
  }
  
  return images;
}

/**
 * Map extracted images to quote lines based on page and order
 * Simple heuristic: assign images to lines on the same page in order
 * 
 * @param lines - Array of quote lines with optional page numbers
 * @param images - Array of extracted images with page and index
 * @returns Map of lineId to imageFileId
 */
export function mapImagesToLines(
  lines: Array<{ id: string; page?: number | null }>,
  images: Array<{ fileId: string; page: number; indexOnPage: number }>
): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Group lines by page
  const linesByPage = new Map<number, Array<{ id: string; order: number }>>();
  lines.forEach((line, index) => {
    const page = line.page ?? 1; // Default to page 1 if not specified
    if (!linesByPage.has(page)) {
      linesByPage.set(page, []);
    }
    linesByPage.get(page)!.push({ id: line.id, order: index });
  });
  
  // Group images by page
  const imagesByPage = new Map<number, Array<{ fileId: string; indexOnPage: number }>>();
  images.forEach((img) => {
    if (!imagesByPage.has(img.page)) {
      imagesByPage.set(img.page, []);
    }
    imagesByPage.get(img.page)!.push({ fileId: img.fileId, indexOnPage: img.indexOnPage });
  });
  
  // Map images to lines page by page
  for (const [page, pageLines] of linesByPage.entries()) {
    const pageImages = imagesByPage.get(page);
    if (!pageImages || pageImages.length === 0) {
      continue;
    }
    
    // Sort lines and images by their order/index
    const sortedLines = [...pageLines].sort((a, b) => a.order - b.order);
    const sortedImages = [...pageImages].sort((a, b) => a.indexOnPage - b.indexOnPage);
    
    // Assign one image per line (if available)
    for (let i = 0; i < sortedLines.length && i < sortedImages.length; i++) {
      mapping[sortedLines[i].id] = sortedImages[i].fileId;
    }
  }
  
  console.log(`[mapImagesToLines] Mapped ${Object.keys(mapping).length} images to lines`);
  return mapping;
}
