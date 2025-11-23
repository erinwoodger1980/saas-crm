/**
 * ML Training Example Submission Endpoint
 * Handles submission of questionnaire + actual price for ML training
 */

import express, { Request, Response } from "express";
import { prisma } from "../db";
import multer from "multer";
import path from "path";
import fs from "fs/promises";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), "uploads/training"),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

router.post(
  "/training-example",
  upload.fields([
    { name: "photo_0", maxCount: 1 },
    { name: "photo_1", maxCount: 1 },
    { name: "photo_2", maxCount: 1 },
    { name: "photo_3", maxCount: 1 },
    { name: "photo_4", maxCount: 1 },
    { name: "supplierQuote", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const { answers, actualPrice, mlEstimatedPrice, mlConfidence, variance } = req.body;
      
      if (!answers || !actualPrice) {
        return res.status(400).json({ error: "Missing required fields: answers, actualPrice" });
      }

      const parsedAnswers = typeof answers === "string" ? JSON.parse(answers) : answers;
      const actualPriceNum = parseFloat(actualPrice);
      const mlPriceNum = mlEstimatedPrice ? parseFloat(mlEstimatedPrice) : null;
      const mlConfNum = mlConfidence ? parseFloat(mlConfidence) : null;
      const varianceNum = variance ? parseFloat(variance) : null;

      // Get tenant ID from auth context (for now, use demo)
      const tenantId = "demo-tenant-id"; // TODO: Get from auth

      // Get or create questionnaire
      let questionnaire = await prisma.questionnaire.findFirst({
        where: { tenantId, isActive: true },
      });

      if (!questionnaire) {
        questionnaire = await prisma.questionnaire.create({
          data: {
            tenantId,
            name: "Standard Questionnaire",
            isActive: true,
          },
        });
      }

      // Create quote for this training example
      const quote = await prisma.quote.create({
        data: {
          tenantId,
          title: `Training Example - ${new Date().toISOString().split("T")[0]}`,
          status: "DRAFT",
          currency: "GBP",
          totalGBP: actualPriceNum,
          mlEstimatedPrice: mlPriceNum,
          mlConfidence: mlConfNum,
          approvalStatus: "approved",
          approvedPrice: actualPriceNum,
          priceVariancePercent: varianceNum,
          isTrainingExample: true,
          trainingNotes: `Training example submitted via ML training interface. Variance: ${varianceNum?.toFixed(1)}%`,
        },
      });

      // Create questionnaire response
      const response = await prisma.questionnaireResponse.create({
        data: {
          tenantId,
          questionnaireId: questionnaire.id,
          quoteId: quote.id,
          completedAt: new Date(),
        },
      });

      // Get field IDs by key
      const fields = await prisma.questionnaireField.findMany({
        where: {
          tenantId,
          isStandard: true,
          isActive: true,
        },
      });

      const fieldsByKey = new Map(fields.map((f) => [f.key, f.id]));

      // Save answers
      for (const [key, value] of Object.entries(parsedAnswers)) {
        const fieldId = fieldsByKey.get(key);
        if (fieldId) {
          await prisma.questionnaireAnswer.create({
            data: {
              responseId: response.id,
              fieldId,
              value: String(value),
            },
          });
        }
      }

      // Handle uploaded files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const uploadedPaths: string[] = [];

      if (files) {
        for (const [fieldname, fileArray] of Object.entries(files)) {
          for (const file of fileArray) {
            const kind = fieldname.startsWith("photo") ? "LINE_IMAGE" : "SUPPLIER_QUOTE";
            
            await prisma.uploadedFile.create({
              data: {
                tenantId,
                quoteId: quote.id,
                kind,
                name: file.originalname,
                path: file.path,
                mimeType: file.mimetype,
                sizeBytes: file.size,
              },
            });

            uploadedPaths.push(file.path);
          }
        }
      }

      // If PDF quote uploaded, trigger parsing for additional training data
      const supplierQuoteFile = files?.supplierQuote?.[0];
      if (supplierQuoteFile) {
        // Queue for background parsing
        // This will extract line items and match them to questionnaire answers
        console.log(`[ML Training] Queuing supplier quote for parsing: ${supplierQuoteFile.path}`);
        // TODO: Implement background job queue
      }

      res.json({
        success: true,
        quoteId: quote.id,
        responseId: response.id,
        answersCount: Object.keys(parsedAnswers).length,
        filesUploaded: uploadedPaths.length,
        variance: varianceNum,
        message: "Training example submitted successfully",
      });
    } catch (err: any) {
      console.error("Failed to submit training example:", err);
      res.status(500).json({ error: "Failed to submit training example", details: err.message });
    }
  }
);

export default router;
