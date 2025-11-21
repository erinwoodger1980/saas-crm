/**
 * ML Training Upload Routes
 * 
 * Simple text-only PDF parsing for ML training data collection.
 * No image extraction, no templates - just fast batch processing
 * for building pricing training datasets.
 */

import { Router, Response } from "express";
import multer from "multer";
import { extractStructuredText } from "../lib/pdf/extract";
import { buildSupplierParse } from "../lib/pdf/parser";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * POST /ml/training/upload-quote
 * 
 * Upload a quote PDF for ML training data extraction.
 * Uses simple text parsing - no images, no templates.
 * Fast processing suitable for batch uploads.
 */
router.post("/upload-quote", upload.single("pdf"), async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "No PDF file provided",
      });
    }

    const { supplierName, quoteDate, notes } = req.body || {};
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    console.log("[ML Training Upload] Processing quote:", {
      filename: req.file.originalname,
      size: `${(req.file.size / 1024).toFixed(1)}KB`,
      supplier: supplierName || "Unknown",
      tenantId,
    });

    // Extract structured text from PDF
    const extraction = await extractStructuredText(req.file.buffer);
    
    // Parse into line items and totals
    const { result, metadata } = buildSupplierParse(extraction);

    // Extract training data (no images)
    const trainingItems = result.lines.map((line, idx) => {
      // Try to extract dimensions from description
      const dimensionMatch = line.description.match(/(\d+)\s*(?:mm|x)\s*(\d+)/i);
      const width = dimensionMatch ? parseInt(dimensionMatch[1]) : null;
      const height = dimensionMatch ? parseInt(dimensionMatch[2]) : null;

      // Try to extract material mentions
      const description = line.description.toLowerCase();
      const material = 
        description.includes('accoya') ? 'Accoya' :
        description.includes('oak') ? 'Oak' :
        description.includes('sapele') ? 'Sapele' :
        description.includes('softwood') ? 'Softwood' :
        description.includes('aluminium') || description.includes('aluminum') ? 'Aluminium' :
        null;

      return {
        itemNumber: idx + 1,
        description: line.description,
        qty: line.qty || 1,
        dimensions: width && height ? { widthMm: width, heightMm: height } : null,
        material,
        unitCost: line.costUnit,
        lineTotal: line.lineTotal,
      };
    });

    const trainingData = {
      source: "manual_upload",
      filename: req.file.originalname,
      supplier: supplierName || extraction.rawText.split('\n')[0]?.trim().substring(0, 100) || "Unknown",
      quoteDate: quoteDate || null,
      currency: result.currency || "GBP",
      items: trainingItems,
      totals: {
        subtotal: result.detected_totals?.subtotal,
        delivery: result.detected_totals?.delivery,
        total: result.detected_totals?.estimated_total,
      },
      metadata: {
        parsingQuality: {
          glyphQuality: metadata.glyphQuality,
          descriptionQuality: metadata.descriptionQuality,
          lowConfidence: metadata.lowConfidence,
        },
        extractedLines: result.lines.length,
        notes: notes || null,
      },
    };

    console.log("[ML Training Upload] Extracted training data:", {
      items: trainingItems.length,
      total: trainingData.totals.total,
      quality: metadata.lowConfidence ? "Low" : "Good",
    });

    // Return the extracted data
    // Later: save to database or forward to ML service
    res.json({
      ok: true,
      data: trainingData,
      message: `Successfully extracted ${trainingItems.length} items from ${req.file.originalname}`,
    });

  } catch (error: any) {
    console.error("[ML Training Upload] Error:", {
      error: error?.message,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    });
    
    res.status(500).json({
      ok: false,
      error: "Failed to process PDF",
      detail: error?.message,
    });
  }
});

/**
 * POST /ml/training/batch-upload
 * 
 * Upload multiple quote PDFs at once for batch processing.
 * Processes each file and returns aggregated results.
 */
router.post("/batch-upload", upload.array("pdfs", 20), async (req: any, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No PDF files provided",
      });
    }

    console.log("[ML Training Batch Upload] Processing", files.length, "files");

    const results = await Promise.allSettled(
      files.map(async (file) => {
        const extraction = await extractStructuredText(file.buffer);
        const { result, metadata } = buildSupplierParse(extraction);
        
        return {
          filename: file.originalname,
          itemCount: result.lines.length,
          total: result.detected_totals?.estimated_total,
          quality: metadata.lowConfidence ? "low" : "good",
        };
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    res.json({
      ok: true,
      processed: files.length,
      successful,
      failed,
      results: results.map((r, idx) => ({
        filename: files[idx].originalname,
        status: r.status,
        data: r.status === "fulfilled" ? r.value : null,
        error: r.status === "rejected" ? r.reason?.message : null,
      })),
    });

  } catch (error: any) {
    console.error("[ML Training Batch Upload] Error:", error?.message);
    res.status(500).json({
      ok: false,
      error: "Batch upload failed",
      detail: error?.message,
    });
  }
});

export default router;
