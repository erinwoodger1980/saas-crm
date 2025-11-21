import { Router } from "express";
import multer from "multer";
import {
  estimateDimensionsFromPhoto,
  PhotoMeasurementContext,
} from "../lib/vision/photoMeasurement";
import {
  analyzeInspirationPhoto,
  InspirationAnalysisContext,
} from "../lib/vision/inspirationAnalysis";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image uploads are supported for measurement"));
    }
  },
});

router.post("/from-photo", upload.single("photo"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "photo_required", message: "Upload a photo to estimate size" });
    }

    let context: PhotoMeasurementContext | undefined;
    if (req.body?.context) {
      try {
        context = JSON.parse(req.body.context);
      } catch (err) {
        console.warn("[measurements] Failed to parse context payload", err);
      }
    } else if (req.body) {
      const { openingType, floorLevel, notes } = req.body;
      if (openingType || floorLevel || notes) {
        context = { openingType, floorLevel, notes };
      }
    }

    const result = await estimateDimensionsFromPhoto({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      context,
    });

    return res.json({
      width_mm: result.widthMm,
      height_mm: result.heightMm,
      confidence: result.confidence,
      attributes: result.attributes,
    });
  } catch (error: any) {
    const message = error?.message || "Failed to estimate dimensions";
    console.error("[POST /measurements/from-photo]", message);
    if (/openai/i.test(message)) {
      return res.status(503).json({ error: "vision_unavailable", message });
    }
    if (/measurement.*buffer/i.test(message)) {
      return res.status(400).json({ error: "invalid_photo", message });
    }
    return res.status(500).json({ error: "measurement_failed", message });
  }
});

router.post("/inspiration/from-photo", upload.single("photo"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "photo_required", message: "Upload an inspiration photo" });
    }

    let context: InspirationAnalysisContext | undefined;
    if (req.body?.context) {
      try {
        context = JSON.parse(req.body.context);
      } catch (err) {
        console.warn("[measurements] Failed to parse inspiration context", err);
      }
    } else if (req.body) {
      const { desiredProduct, projectNotes, keywords } = req.body;
      if (desiredProduct || projectNotes || keywords) {
        context = {
          desiredProduct,
          projectNotes,
          keywords: Array.isArray(keywords) ? keywords : typeof keywords === "string" ? keywords.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        };
      }
    }

    const result = await analyzeInspirationPhoto({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      context,
    });

    return res.json({
      confidence: result.confidence,
      attributes: result.attributes,
    });
  } catch (error: any) {
    const message = error?.message || "Failed to analyse inspiration photo";
    console.error("[POST /measurements/inspiration/from-photo]", message);
    if (/openai/i.test(message)) {
      return res.status(503).json({ error: "vision_unavailable", message });
    }
    if (/inspiration.*buffer/i.test(message)) {
      return res.status(400).json({ error: "invalid_photo", message });
    }
    return res.status(500).json({ error: "inspiration_failed", message });
  }
});

export default router;
