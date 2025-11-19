/**
 * PDF Image Extraction with Bounding Box Detection
 * Extracts images from PDF files with spatial coordinates and maps them to quote lines
 * for use as per-line thumbnails in quote proposals.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import { FileKind } from "@prisma/client";
import { prisma } from "../../prisma";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedImage {
  fileId: string;
  page: number;
  indexOnPage: number;
  buffer: Buffer;
  mimeType: string;
  bbox?: BoundingBox;
  width?: number;
  height?: number;
  dataUrl?: string;  // base64 data URL
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
 * Extract raw image data from PDF buffer with enhanced metadata
 * Looks for PDF image XObject patterns and attempts to extract spatial information
 */
async function extractImagesFromBuffer(pdfBuffer: Buffer): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  
  try {
    // Convert buffer to string for pattern matching
    const pdfText = pdfBuffer.toString('binary');
    
    // Look for PDF image object patterns with potential bounding box info
    // PDF images are stored as XObject streams with /Image type
    // Format: /Type /XObject /Subtype /Image /Width X /Height Y ... stream...endstream
    const imageObjectRegex = /\/Type\s*\/XObject[\s\S]*?\/Subtype\s*\/Image[\s\S]*?(?:\/Width\s+(\d+))?[\s\S]*?(?:\/Height\s+(\d+))?[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g;
    
    let match;
    let imageIndex = 0;
    let currentPage = 1; // Estimate page based on image count (rough heuristic: ~3-5 images per page)
    let imagesOnPage = 0;
    
    while ((match = imageObjectRegex.exec(pdfText)) !== null && imageIndex < 50) {
      try {
        const width = match[1] ? parseInt(match[1], 10) : undefined;
        const height = match[2] ? parseInt(match[2], 10) : undefined;
        const streamData = match[3];
        
        // Try to detect image format from stream
        const isJPEG = streamData.startsWith('\xFF\xD8\xFF');
        const isPNG = streamData.startsWith('\x89PNG');
        
        if (isJPEG || isPNG) {
          const imageBuffer = Buffer.from(streamData, 'binary');
          
          // ENHANCED FILTERING: Skip logos, headers, and decorative images
          // 1. Skip very small images (icons, bullets, decorative elements)
          if (imageBuffer.length < 5000) {  // Increased from 1KB to 5KB
            continue;
          }
          
          // 2. Skip images that are too large (full-page backgrounds, headers)
          if (imageBuffer.length > 500000) {  // 500KB max
            continue;
          }
          
          // 3. Filter by dimensions - product images are typically square or portrait
          // Skip very wide/short images (likely headers or footers)
          if (width && height) {
            const aspectRatio = width / height;
            // Skip images with extreme aspect ratios (headers: wide, footers: wide)
            if (aspectRatio > 4 || aspectRatio < 0.25) {
              continue;
            }
            
            // Skip very small dimensions (likely logos or icons)
            if (width < 100 || height < 100) {
              continue;
            }
            
            // Skip very large dimensions (likely full-page backgrounds)
            if (width > 2000 || height > 2000) {
              continue;
            }
          }
          
          // Create base64 data URL for inline rendering
          const mimeType = isJPEG ? 'image/jpeg' : 'image/png';
          const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
          
          // Rough page estimation (update page number every 4 images)
          imagesOnPage++;
          if (imagesOnPage > 4) {
            currentPage++;
            imagesOnPage = 0;
          }
          
          // Estimate bounding box based on image dimensions (simplified)
          // In real PDFs, this would require parsing transformation matrices
          const bbox: BoundingBox | undefined = width && height ? {
            x: 50,  // Default left margin
            y: 100 + (imageIndex % 4) * 150,  // Rough vertical spacing
            width: Math.min(width, 500),
            height: Math.min(height, 400)
          } : undefined;
          
          images.push({
            fileId: '', // Will be set when saving
            page: currentPage,
            indexOnPage: imageIndex,
            buffer: imageBuffer,
            mimeType,
            width,
            height,
            bbox,
            dataUrl,
          });
          
          imageIndex++;
        }
      } catch (err) {
        console.warn('[extractImages] Failed to process image stream:', err);
      }
    }
    
    console.log(`[extractImages] Extracted ${images.length} images from PDF`);
  } catch (err: any) {
    console.error('[extractImages] Buffer extraction failed:', err);
  }
  
  return images;
}

/**
 * Map extracted images to quote lines based on page and proximity
 * Enhanced heuristic: matches images to lines based on:
 * 1. Same page number
 * 2. Vertical proximity (bounding box overlap or distance)
 * 3. Sequential order as fallback
 * 
 * @param lines - Array of quote lines with optional page and bbox
 * @param images - Array of extracted images with page, bbox and index
 * @returns Map of lineId to imageFileId
 */
export function mapImagesToLines(
  lines: Array<{ id: string; page?: number | null; bbox?: BoundingBox | null }>,
  images: Array<{ fileId: string; page: number; indexOnPage: number; bbox?: BoundingBox }>
): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  // Group lines by page
  const linesByPage = new Map<number, Array<{ id: string; order: number; bbox?: BoundingBox | null }>>();
  lines.forEach((line, index) => {
    const page = line.page ?? 1; // Default to page 1 if not specified
    if (!linesByPage.has(page)) {
      linesByPage.set(page, []);
    }
    linesByPage.get(page)!.push({ id: line.id, order: index, bbox: line.bbox });
  });
  
  // Group images by page
  const imagesByPage = new Map<number, Array<{ fileId: string; indexOnPage: number; bbox?: BoundingBox }>>();
  images.forEach((img) => {
    if (!imagesByPage.has(img.page)) {
      imagesByPage.set(img.page, []);
    }
    imagesByPage.get(img.page)!.push({ fileId: img.fileId, indexOnPage: img.indexOnPage, bbox: img.bbox });
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
    
    // Try to match based on bounding box proximity if available
    const usedImages = new Set<number>();
    
    for (const line of sortedLines) {
      if (line.bbox) {
        // Find closest image by vertical distance
        let closestIdx = -1;
        let closestDistance = Infinity;
        
        for (let i = 0; i < sortedImages.length; i++) {
          if (usedImages.has(i)) continue;
          
          const img = sortedImages[i];
          if (img.bbox) {
            // Calculate vertical distance between line and image
            const lineCenterY = line.bbox.y + line.bbox.height / 2;
            const imgCenterY = img.bbox.y + img.bbox.height / 2;
            const distance = Math.abs(lineCenterY - imgCenterY);
            
            // Only consider images within reasonable vertical distance (same row, ~100px threshold)
            if (distance < 100 && distance < closestDistance) {
              closestDistance = distance;
              closestIdx = i;
            }
          }
        }
        
        if (closestIdx >= 0) {
          mapping[line.id] = sortedImages[closestIdx].fileId;
          usedImages.add(closestIdx);
          continue;
        }
      }
      
      // Fallback: assign images in order to remaining lines
      for (let i = 0; i < sortedImages.length; i++) {
        if (!usedImages.has(i)) {
          mapping[line.id] = sortedImages[i].fileId;
          usedImages.add(i);
          break;
        }
      }
    }
  }
  
  console.log(`[mapImagesToLines] Mapped ${Object.keys(mapping).length} images to lines`);
  return mapping;
}

/**
 * Extract images for direct use in parse results (without saving to database)
 * Returns images with base64 data URLs for immediate use in proposals
 * 
 * @param pdfBuffer - The PDF file buffer
 * @returns Array of extracted images with data URLs
 */
export async function extractImagesForParse(
  pdfBuffer: Buffer
): Promise<Array<{ index: number; page: number; bbox?: BoundingBox; dataUrl: string; width?: number; height?: number }>> {
  const images = await extractImagesFromBuffer(pdfBuffer);
  
  return images.map((img, index) => ({
    index,
    page: img.page,
    bbox: img.bbox,
    dataUrl: img.dataUrl || `data:${img.mimeType};base64,${img.buffer.toString('base64')}`,
    width: img.width,
    height: img.height,
  }));
}
