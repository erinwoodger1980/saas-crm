import { Router } from "express";
import { prisma } from "../prisma";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Upload image
router.post("/images/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const { slotId } = req.body;

    console.log("[Wealden API] Upload request:", { filename: file?.originalname, slotId });

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    if (!slotId) {
      return res.status(400).json({ error: "No slotId provided" });
    }

    // Convert to base64 data URL
    const mimeType = file.mimetype;
    const base64Data = file.buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    console.log("[Wealden API] Saving to database:", {
      slotId,
      filename: file.originalname,
      size: file.size,
      mimeType,
    });

    // Save or update in database
    const image = await prisma.wealdenImage.upsert({
      where: { slotId },
      update: {
        imageUrl: dataUrl,
        filename: file.originalname,
        mimeType,
        fileSize: file.size,
      },
      create: {
        slotId,
        imageUrl: dataUrl,
        filename: file.originalname,
        mimeType,
        fileSize: file.size,
      },
    });

    console.log("[Wealden API] Saved successfully:", image.id);

    return res.json({
      ok: true,
      imageUrl: dataUrl,
      slotId,
      filename: file.originalname,
    });
  } catch (error) {
    console.error("[Wealden API] Upload error:", error);
    return res.status(500).json({
      error: "Failed to upload file",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get image by slotId
router.get("/images/:slotId", async (req, res) => {
  try {
    const { slotId } = req.params;

    const image = await prisma.wealdenImage.findUnique({
      where: { slotId },
    });

    if (image) {
      return res.json({
        image: {
          imageUrl: image.imageUrl,
          slotId: image.slotId,
          filename: image.filename,
        },
      });
    }

    return res.json({ image: null });
  } catch (error) {
    console.error("[Wealden API] Fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch image" });
  }
});

export default router;
