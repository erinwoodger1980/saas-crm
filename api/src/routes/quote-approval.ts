/**
 * Quote Approval Workflow API
 * Endpoints for reviewing and approving ML-generated quotes
 */

import express, { Request, Response } from "express";
import { prisma } from "../db";
import { z } from "zod";

const router = express.Router();

// Get quotes pending approval for a tenant
router.get("/:tenantId/pending", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = "50", offset = "0" } = req.query;

    const quotes = await prisma.quote.findMany({
      where: {
        tenantId,
        approvalStatus: "pending",
      },
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
          },
        },
        questionnaireResponse: {
          include: {
            answers: {
              include: {
                field: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.quote.count({
      where: {
        tenantId,
        approvalStatus: "pending",
      },
    });

    res.json({ quotes, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (err: any) {
    console.error("Failed to fetch pending quotes:", err);
    res.status(500).json({ error: "Failed to fetch pending quotes" });
  }
});

// Approve a quote with final price
const approveSchema = z.object({
  approvedPrice: z.number().positive(),
  userId: z.string(),
  notes: z.string().optional(),
});

router.post("/:quoteId/approve", async (req: Request, res: Response) => {
  try {
    const { quoteId } = req.params;
    const body = approveSchema.parse(req.body);

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { mlEstimatedPrice: true, tenantId: true },
    });

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }

    // Calculate variance
    let priceVariancePercent = null;
    if (quote.mlEstimatedPrice) {
      const mlPrice = parseFloat(quote.mlEstimatedPrice.toString());
      const variance = ((body.approvedPrice - mlPrice) / mlPrice) * 100;
      priceVariancePercent = variance;
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        approvalStatus: "approved",
        approvedPrice: body.approvedPrice,
        approvedById: body.userId,
        approvedAt: new Date(),
        priceVariancePercent,
        totalGBP: body.approvedPrice,
        trainingNotes: body.notes,
      },
      include: {
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Failed to approve quote:", err);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request body", details: err.errors });
    }
    res.status(500).json({ error: "Failed to approve quote" });
  }
});

// Reject a quote (needs manual quoting)
const rejectSchema = z.object({
  userId: z.string(),
  reason: z.string().optional(),
});

router.post("/:quoteId/reject", async (req: Request, res: Response) => {
  try {
    const { quoteId } = req.params;
    const body = rejectSchema.parse(req.body);

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        approvalStatus: "rejected",
        approvedById: body.userId,
        approvedAt: new Date(),
        trainingNotes: body.reason || "Rejected - requires manual quoting",
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Failed to reject quote:", err);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request body", details: err.errors });
    }
    res.status(500).json({ error: "Failed to reject quote" });
  }
});

// Get ML accuracy metrics for a tenant
router.get("/:tenantId/metrics", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { days = "30" } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Get recent approved quotes with variance data
    const approvedQuotes = await prisma.quote.findMany({
      where: {
        tenantId,
        approvalStatus: "approved",
        approvedAt: {
          gte: startDate,
        },
        priceVariancePercent: {
          not: null,
        },
      },
      select: {
        mlEstimatedPrice: true,
        approvedPrice: true,
        priceVariancePercent: true,
        mlConfidence: true,
        approvedAt: true,
      },
      orderBy: {
        approvedAt: "desc",
      },
    });

    if (approvedQuotes.length === 0) {
      return res.json({
        totalQuotes: 0,
        accurateWithin10Pct: 0,
        accurateWithin20Pct: 0,
        averageVariancePct: 0,
        medianVariancePct: 0,
        confidenceAvg: 0,
        trustScore: 0,
        message: "Not enough data yet. Keep approving quotes to build trust metrics.",
      });
    }

    const variances = approvedQuotes
      .map((q) => Math.abs(parseFloat(q.priceVariancePercent?.toString() || "0")))
      .sort((a, b) => a - b);

    const within10 = variances.filter((v) => v <= 10).length;
    const within20 = variances.filter((v) => v <= 20).length;
    const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
    const medianVariance = variances[Math.floor(variances.length / 2)];
    const avgConfidence =
      approvedQuotes.reduce((sum, q) => sum + parseFloat(q.mlConfidence?.toString() || "0"), 0) / approvedQuotes.length;

    // Trust score: percentage of quotes within 10% variance
    const trustScore = (within10 / approvedQuotes.length) * 100;

    res.json({
      totalQuotes: approvedQuotes.length,
      accurateWithin10Pct: within10,
      accurateWithin20Pct: within20,
      accurateWithin10PctPercent: (within10 / approvedQuotes.length) * 100,
      accurateWithin20PctPercent: (within20 / approvedQuotes.length) * 100,
      averageVariancePct: avgVariance,
      medianVariancePct: medianVariance,
      confidenceAvg: avgConfidence,
      trustScore,
      period: {
        start: startDate,
        end: new Date(),
        days: parseInt(days as string),
      },
    });
  } catch (err: any) {
    console.error("Failed to fetch metrics:", err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// Mark quote as training example
router.post("/:quoteId/mark-training", async (req: Request, res: Response) => {
  try {
    const { quoteId } = req.params;
    const { isTrainingExample = true, notes } = req.body;

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        isTrainingExample,
        trainingNotes: notes,
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Failed to mark as training:", err);
    res.status(500).json({ error: "Failed to mark as training example" });
  }
});

export default router;
