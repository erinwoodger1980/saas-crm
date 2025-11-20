import { Router } from "express";
import multer from "multer";
import {
  estimateDimensionsFromPhoto,
  PhotoMeasurementContext,
} from "../lib/vision/photoMeasurement";

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

export default router;
