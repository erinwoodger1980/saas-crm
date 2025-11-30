/**
 * Example Photos API
 * Admin interface for uploading and managing example photos
 * Public interface for browsing and selecting examples
 */

import express, { Request, Response } from "express";
import { prisma } from "../db";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import fs from "fs/promises";
import { z } from "zod";

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  dest: path.join(process.cwd(), "uploads/examples"),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"));
    }
  },
});

// Validation schemas
const createPhotoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  productType: z.string().optional(),
  widthMm: z.number().int().positive().optional(),
  heightMm: z.number().int().positive().optional(),
  thicknessMm: z.number().int().positive().optional(),
  timberSpecies: z.string().optional(),
  timberGrade: z.string().optional(),
  glassType: z.string().optional(),
  finishType: z.string().optional(),
  fireRating: z.string().optional(),
  priceGBP: z.number().positive().optional(),
  priceDate: z.string().optional(),
  supplierName: z.string().optional(),
  displayOrder: z.number().int().default(0),
});

// PUBLIC: Get example photos by tags/filters
router.get("/public/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { tags, productType, limit = "50" } = req.query;

    const where: any = {
      tenantId,
      isActive: true,
    };

    if (tags) {
      const tagArray = (tags as string).split(",").map((t) => t.trim());
      where.tags = { hasSome: tagArray };
    }

    if (productType) {
      where.productType = productType as string;
    }

    const photos = await prisma.examplePhoto.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { selectionCount: "desc" }, { createdAt: "desc" }],
      take: parseInt(limit as string),
      select: {
        id: true,
        imageUrl: true,
        thumbnailUrl: true,
        title: true,
        description: true,
        tags: true,
        productType: true,
        widthMm: true,
        heightMm: true,
        thicknessMm: true,
        timberSpecies: true,
        glassType: true,
        finishType: true,
        fireRating: true,
        priceGBP: true,
        viewCount: true,
      },
    });

    res.json(photos);
  } catch (err: any) {
    console.error("Failed to fetch example photos:", err);
    res.status(500).json({ error: "Failed to fetch examples" });
  }
});

// PUBLIC: Record photo view
router.post("/public/:photoId/view", async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;

    await prisma.examplePhoto.update({
      where: { id: photoId },
      data: { viewCount: { increment: 1 } },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to record view:", err);
    res.status(500).json({ error: "Failed to record view" });
  }
});

// PUBLIC: Record photo selection (when user picks an example)
router.post("/public/:photoId/select", async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;

    const photo = await prisma.examplePhoto.update({
      where: { id: photoId },
      data: { 
        selectionCount: { increment: 1 },
        viewCount: { increment: 1 },
      },
      select: {
        widthMm: true,
        heightMm: true,
        thicknessMm: true,
        timberSpecies: true,
        glassType: true,
        finishType: true,
        fireRating: true,
        productType: true,
        tags: true,
      },
    });

    // Get all questionnaire field answers for this photo
    const fieldAnswers = await prisma.examplePhotoFieldAnswer.findMany({
      where: { examplePhotoId: photoId },
      include: {
        field: {
          select: {
            key: true,
            label: true,
            type: true,
          },
        },
      },
    });

    // Build specifications object with legacy fields + all questionnaire answers
    const specifications: any = {
      // Legacy direct fields
      widthMm: photo.widthMm,
      heightMm: photo.heightMm,
      thicknessMm: photo.thicknessMm,
      timberSpecies: photo.timberSpecies,
      glassType: photo.glassType,
      finishType: photo.finishType,
      fireRating: photo.fireRating,
      productType: photo.productType,
      tags: photo.tags,
      // All questionnaire field answers
      questionnaireAnswers: fieldAnswers.reduce((acc, answer) => {
        acc[answer.fieldKey] = {
          value: answer.value,
          label: answer.field.label,
          type: answer.field.type,
        };
        return acc;
      }, {} as Record<string, any>),
    };

    // Return the specifications to pre-fill questionnaire
    res.json({ success: true, specifications });
  } catch (err: any) {
    console.error("Failed to record selection:", err);
    res.status(500).json({ error: "Failed to record selection" });
  }
});

// ADMIN: Get all example photos for tenant
router.get("/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { includeInactive = "false" } = req.query;

    const where: any = { tenantId };
    if (includeInactive !== "true") {
      where.isActive = true;
    }

    const photos = await prisma.examplePhoto.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(photos);
  } catch (err: any) {
    console.error("Failed to fetch example photos:", err);
    res.status(500).json({ error: "Failed to fetch examples" });
  }
});

// ADMIN: Upload new example photo
router.post("/:tenantId/upload", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    // Parse and validate metadata
    const metadata = JSON.parse(req.body.metadata || "{}");
    const validated = createPhotoSchema.parse(metadata);
    
    // Parse questionnaire field answers if provided
    const fieldAnswers = metadata.fieldAnswers || {};

    // Generate thumbnail
    const thumbnailPath = file.path + "_thumb.jpg";
    await sharp(file.path)
      .resize(400, 300, { fit: "cover", position: "center" })
      .jpeg({ quality: 85 })
      .toFile(thumbnailPath);

    // In production, upload to S3/CloudStorage
    // For now, store local paths
    const imageUrl = `/uploads/examples/${path.basename(file.path)}`;
    const thumbnailUrl = `/uploads/examples/${path.basename(thumbnailPath)}`;

    // Get userId from auth (TODO: proper auth)
    const userId = (req as any).auth?.userId;

    const photo = await prisma.examplePhoto.create({
      data: {
        tenantId,
        imageUrl,
        thumbnailUrl,
        uploadedById: userId,
        ...validated,
        priceDate: validated.priceDate ? new Date(validated.priceDate) : undefined,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Save questionnaire field answers if provided
    if (Object.keys(fieldAnswers).length > 0) {
      // Get field IDs for the provided keys
      const fieldKeys = Object.keys(fieldAnswers);
      const fields = await prisma.questionnaireField.findMany({
        where: {
          tenantId,
          key: { in: fieldKeys },
        },
        select: { id: true, key: true },
      });

      const fieldMap = new Map(fields.map(f => [f.key, f.id]));

      // Create answer records
      const answerData = fieldKeys
        .filter(key => fieldMap.has(key) && fieldAnswers[key] != null)
        .map(key => ({
          examplePhotoId: photo.id,
          fieldId: fieldMap.get(key)!,
          fieldKey: key,
          value: String(fieldAnswers[key]),
        }));

      if (answerData.length > 0) {
        await prisma.examplePhotoFieldAnswer.createMany({
          data: answerData,
          skipDuplicates: true,
        });
      }
    }

    res.json(photo);
  } catch (err: any) {
    console.error("Failed to upload example photo:", err);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid metadata", details: err.errors });
    }
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

// ADMIN: Update example photo
router.patch("/:photoId", async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const { fieldAnswers, ...metadata } = req.body;
    const updates = createPhotoSchema.partial().parse(metadata);

    const photo = await prisma.examplePhoto.update({
      where: { id: photoId },
      data: {
        ...updates,
        priceDate: updates.priceDate ? new Date(updates.priceDate as any) : undefined,
      },
    });

    // Update field answers if provided
    if (fieldAnswers && typeof fieldAnswers === 'object') {
      const photoData = await prisma.examplePhoto.findUnique({
        where: { id: photoId },
        select: { tenantId: true },
      });

      if (photoData) {
        // Delete existing answers
        await prisma.examplePhotoFieldAnswer.deleteMany({
          where: { examplePhotoId: photoId },
        });

        // Create new answers
        const fieldKeys = Object.keys(fieldAnswers).filter(k => fieldAnswers[k] != null);
        
        if (fieldKeys.length > 0) {
          const fields = await prisma.questionnaireField.findMany({
            where: {
              tenantId: photoData.tenantId,
              key: { in: fieldKeys },
            },
            select: { id: true, key: true },
          });

          const fieldMap = new Map(fields.map(f => [f.key, f.id]));

          const answerData = fieldKeys
            .filter(key => fieldMap.has(key))
            .map(key => ({
              examplePhotoId: photo.id,
              fieldId: fieldMap.get(key)!,
              fieldKey: key,
              value: String(fieldAnswers[key]),
            }));

          if (answerData.length > 0) {
            await prisma.examplePhotoFieldAnswer.createMany({
              data: answerData,
            });
          }
        }
      }
    }

    res.json(photo);
  } catch (err: any) {
    console.error("Failed to update example photo:", err);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid data", details: err.errors });
    }
    res.status(500).json({ error: "Failed to update photo" });
  }
});

// ADMIN: Replace a photo image (upload new image, regenerate thumbnail, update URLs)
router.post("/:photoId/replace-image", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No image file provided" });

    const existing = await prisma.examplePhoto.findUnique({
      where: { id: photoId },
      select: { imageUrl: true, thumbnailUrl: true },
    });
    if (!existing) return res.status(404).json({ error: "Photo not found" });

    // Generate thumbnail for new image
    const thumbPath = file.path + "_thumb.jpg";
    await sharp(file.path)
      .resize(400, 300, { fit: "cover", position: "center" })
      .jpeg({ quality: 85 })
      .toFile(thumbPath);

    const newImageUrl = `/uploads/examples/${path.basename(file.path)}`;
    const newThumbUrl = `/uploads/examples/${path.basename(thumbPath)}`;

    // Archive old files
    if (existing.imageUrl) {
      try {
        const oldImagePath = path.join(process.cwd(), existing.imageUrl.replace(/^\//, ""));
        await fs.rename(oldImagePath, oldImagePath + "_replaced");
      } catch (e) {
        console.warn("Archive old image failed", e);
      }
    }
    if (existing.thumbnailUrl) {
      try {
        const oldThumbPath = path.join(process.cwd(), existing.thumbnailUrl.replace(/^\//, ""));
        await fs.rename(oldThumbPath, oldThumbPath + "_replaced");
      } catch (e) {
        console.warn("Archive old thumbnail failed", e);
      }
    }

    const updated = await prisma.examplePhoto.update({
      where: { id: photoId },
      data: { imageUrl: newImageUrl, thumbnailUrl: newThumbUrl },
    });

    res.json({ success: true, photo: updated });
  } catch (err: any) {
    console.error("Failed to replace image", err);
    res.status(500).json({ error: "Failed to replace image" });
  }
});

// ADMIN: Delete example photo
router.delete("/:photoId", async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;

    const photo = await prisma.examplePhoto.findUnique({
      where: { id: photoId },
      select: { imageUrl: true, thumbnailUrl: true },
    });

    if (photo) {
      // Delete files
      try {
        const imagePath = path.join(process.cwd(), photo.imageUrl.replace(/^\//, ""));
        await fs.unlink(imagePath);
        if (photo.thumbnailUrl) {
          const thumbPath = path.join(process.cwd(), photo.thumbnailUrl.replace(/^\//, ""));
          await fs.unlink(thumbPath);
        }
      } catch (fileErr) {
        console.warn("Failed to delete image files:", fileErr);
      }
    }

    await prisma.examplePhoto.delete({
      where: { id: photoId },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete example photo:", err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// ADMIN: Reorder photos
router.post("/reorder", async (req: Request, res: Response) => {
  try {
    const { photoIds } = req.body;

    if (!Array.isArray(photoIds)) {
      return res.status(400).json({ error: "photoIds must be an array" });
    }

    // Update display order for each photo
    await Promise.all(
      photoIds.map((id, index) =>
        prisma.examplePhoto.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to reorder photos:", err);
    res.status(500).json({ error: "Failed to reorder" });
  }
});

// ADMIN: Get field answers for a photo
router.get("/:photoId/field-answers", async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;

    const answers = await prisma.examplePhotoFieldAnswer.findMany({
      where: { examplePhotoId: photoId },
      include: {
        field: {
          select: {
            key: true,
            label: true,
            type: true,
            options: true,
          },
        },
      },
      orderBy: {
        field: {
          sortOrder: "asc",
        },
      },
    });

    const formattedAnswers = answers.reduce((acc: Record<string, any>, answer: any) => {
      acc[answer.fieldKey] = {
        value: answer.value,
        field: answer.field,
      };
      return acc;
    }, {} as Record<string, any>);

    res.json(formattedAnswers);
  } catch (err: any) {
    console.error("Failed to get field answers:", err);
    res.status(500).json({ error: "Failed to get field answers" });
  }
});

// ADMIN: AI-enhance a photo
router.post("/:photoId/enhance", async (req: Request, res: Response) => {
  try {
    const { photoId } = req.params;
    const { type = "professional", removeBackground = false } = req.body;

    const photo = await prisma.examplePhoto.findUnique({
      where: { id: photoId },
      select: { imageUrl: true, thumbnailUrl: true },
    });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Import enhancement functions
    const { enhancePhoto, basicEnhancement, isAIEnhancementAvailable } = await import("../lib/photo-enhancement");

    const imagePath = path.join(process.cwd(), photo.imageUrl.replace(/^\//, ""));
    
    let enhancedPath: string;
    let usingAI = false;

    // Try AI enhancement if available
    if (isAIEnhancementAvailable()) {
      try {
        enhancedPath = await enhancePhoto(imagePath, { 
          type: type as any,
          removeBackground,
          scale: 2,
        });
        usingAI = true;
      } catch (aiError) {
        console.error("AI enhancement failed, falling back to basic:", aiError);
        enhancedPath = await basicEnhancement(imagePath);
      }
    } else {
      // Fallback to basic Sharp enhancement
      enhancedPath = await basicEnhancement(imagePath);
    }

    // Generate new thumbnail from enhanced image
    const thumbnailPath = enhancedPath + "_thumb.jpg";
    await sharp(enhancedPath)
      .resize(400, 300, { fit: "cover", position: "center" })
      .jpeg({ quality: 85 })
      .toFile(thumbnailPath);

    // Update database with new URLs
    const enhancedUrl = `/uploads/examples/${path.basename(enhancedPath)}`;
    const thumbnailUrl = `/uploads/examples/${path.basename(thumbnailPath)}`;

    // Archive old images (rename with _old suffix)
    try {
      const oldImagePath = path.join(process.cwd(), photo.imageUrl.replace(/^\//, ""));
      await fs.rename(oldImagePath, oldImagePath + "_old");
      
      if (photo.thumbnailUrl) {
        const oldThumbPath = path.join(process.cwd(), photo.thumbnailUrl.replace(/^\//, ""));
        await fs.rename(oldThumbPath, oldThumbPath + "_old");
      }
    } catch (archiveErr) {
      console.error("Failed to archive old images:", archiveErr);
    }

    const updated = await prisma.examplePhoto.update({
      where: { id: photoId },
      data: {
        imageUrl: enhancedUrl,
        thumbnailUrl: thumbnailUrl,
      },
    });

    res.json({ 
      success: true, 
      photo: updated,
      enhanced: true,
      method: usingAI ? "AI" : "basic",
    });
  } catch (err: any) {
    console.error("Failed to enhance photo:", err);
    res.status(500).json({ error: "Failed to enhance photo", details: err.message });
  }
});

// ADMIN: Get analytics
router.get("/:tenantId/analytics", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const photos = await prisma.examplePhoto.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        title: true,
        tags: true,
        viewCount: true,
        selectionCount: true,
      },
      orderBy: { selectionCount: "desc" },
    });

    const totalViews = photos.reduce((sum, p) => sum + p.viewCount, 0);
    const totalSelections = photos.reduce((sum, p) => sum + p.selectionCount, 0);

    const tagStats: Record<string, { views: number; selections: number }> = {};
    photos.forEach((p) => {
      p.tags.forEach((tag) => {
        if (!tagStats[tag]) {
          tagStats[tag] = { views: 0, selections: 0 };
        }
        tagStats[tag].views += p.viewCount;
        tagStats[tag].selections += p.selectionCount;
      });
    });

    res.json({
      totalPhotos: photos.length,
      totalViews,
      totalSelections,
      averageViewsPerPhoto: photos.length > 0 ? totalViews / photos.length : 0,
      conversionRate: totalViews > 0 ? (totalSelections / totalViews) * 100 : 0,
      topPhotos: photos.slice(0, 10),
      tagStats,
    });
  } catch (err: any) {
    console.error("Failed to get analytics:", err);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

export default router;
