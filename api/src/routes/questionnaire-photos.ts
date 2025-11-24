// api/src/routes/questionnaire-photos.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../prisma";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "questionnaire-photos");
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err: any) {
      cb(err, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."));
    }
  },
});

/**
 * POST /questionnaire-photos/answer/:answerId
 * Upload a photo for a specific questionnaire answer
 * Body: multipart/form-data with 'photo' field and optional 'caption'
 */
router.post("/answer/:answerId", requireAuth, upload.single("photo"), async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const answerId = String(req.params.answerId);
    const caption = req.body.caption || null;

    if (!req.file) {
      return res.status(400).json({ error: "photo file required" });
    }

    // Verify answer exists and belongs to tenant
    const answer = await prisma.questionnaireAnswer.findFirst({
      where: { id: answerId },
      include: {
        response: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!answer || answer.response.tenantId !== tenantId) {
      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: "answer not found" });
    }

    // Create photo record
    const photo = await prisma.questionnairePhoto.create({
      data: {
        tenantId,
        answerId,
        filename: req.file.originalname,
        storagePath: req.file.path,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        caption,
        metadata: {
          uploadedBy: req.auth.userId || null,
          originalFilename: req.file.originalname,
        },
      },
    });

    return res.json({
      ok: true,
      photo: {
        id: photo.id,
        filename: photo.filename,
        caption: photo.caption,
        sizeBytes: photo.sizeBytes,
        mimeType: photo.mimeType,
        createdAt: photo.createdAt,
      },
    });
  } catch (e: any) {
    console.error("[POST /questionnaire-photos/answer/:answerId] failed:", e?.message || e);
    
    // Clean up uploaded file on error
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /questionnaire-photos/answer/:answerId
 * Get all photos for a specific answer
 */
router.get("/answer/:answerId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const answerId = String(req.params.answerId);

    // Verify answer belongs to tenant
    const answer = await prisma.questionnaireAnswer.findFirst({
      where: { id: answerId },
      include: {
        response: true,
      },
    });

    if (!answer || answer.response.tenantId !== tenantId) {
      return res.status(404).json({ error: "answer not found" });
    }

    const photos = await prisma.questionnairePhoto.findMany({
      where: {
        tenantId,
        answerId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        filename: true,
        caption: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ photos });
  } catch (e: any) {
    console.error("[GET /questionnaire-photos/answer/:answerId] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /questionnaire-photos/:id
 * Get photo file by ID
 */
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);

    const photo = await prisma.questionnairePhoto.findFirst({
      where: { id, tenantId },
    });

    if (!photo) {
      return res.status(404).json({ error: "photo not found" });
    }

    // Check if file exists
    try {
      await fs.access(photo.storagePath);
    } catch {
      return res.status(404).json({ error: "photo file not found on disk" });
    }

    // Set appropriate headers
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Content-Length", photo.sizeBytes);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(photo.filename)}"`
    );

    // Stream the file
    const fileStream = require("fs").createReadStream(photo.storagePath);
    fileStream.pipe(res);
  } catch (e: any) {
    console.error("[GET /questionnaire-photos/:id] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /questionnaire-photos/:id
 * Update photo caption
 * Body: { caption: string }
 */
router.patch("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const { caption } = req.body;

    const photo = await prisma.questionnairePhoto.findFirst({
      where: { id, tenantId },
    });

    if (!photo) {
      return res.status(404).json({ error: "photo not found" });
    }

    const updated = await prisma.questionnairePhoto.update({
      where: { id },
      data: { caption: caption || null },
    });

    return res.json({
      ok: true,
      photo: {
        id: updated.id,
        caption: updated.caption,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (e: any) {
    console.error("[PATCH /questionnaire-photos/:id] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * DELETE /questionnaire-photos/:id
 * Delete a photo (both database record and file)
 */
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);

    const photo = await prisma.questionnairePhoto.findFirst({
      where: { id, tenantId },
    });

    if (!photo) {
      return res.status(404).json({ error: "photo not found" });
    }

    // Delete database record first
    await prisma.questionnairePhoto.delete({
      where: { id },
    });

    // Try to delete file (don't fail if it doesn't exist)
    await fs.unlink(photo.storagePath).catch((err) => {
      console.warn(`Failed to delete photo file ${photo.storagePath}:`, err.message);
    });

    return res.json({ ok: true, deleted: true });
  } catch (e: any) {
    console.error("[DELETE /questionnaire-photos/:id] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /questionnaire-photos/response/:responseId
 * Get all photos for all answers in a questionnaire response
 */
router.get("/response/:responseId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const responseId = String(req.params.responseId);

    // Verify response belongs to tenant
    const response = await prisma.questionnaireResponse.findFirst({
      where: { id: responseId, tenantId },
    });

    if (!response) {
      return res.status(404).json({ error: "response not found" });
    }

    // Get all photos for all answers in this response
    const photos = await prisma.questionnairePhoto.findMany({
      where: {
        tenantId,
        answer: {
          responseId,
        },
      },
      include: {
        answer: {
          include: {
            field: {
              select: {
                id: true,
                key: true,
                label: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.json({
      photos: photos.map((p) => ({
        id: p.id,
        answerId: p.answerId,
        fieldId: p.answer.fieldId,
        fieldKey: p.answer.field.key,
        fieldLabel: p.answer.field.label,
        filename: p.filename,
        caption: p.caption,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        createdAt: p.createdAt,
      })),
    });
  } catch (e: any) {
    console.error("[GET /questionnaire-photos/response/:responseId] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
