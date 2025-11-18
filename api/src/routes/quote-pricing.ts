// api/src/routes/quote-pricing.ts
/**
 * Example integration of questionnaire system with quote pricing
 * This shows how to use costing inputs to calculate and apply pricing
 */
import { Router } from "express";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import {
  buildCostingInputs,
  calculateCost,
  validateCostingInputs,
  type CostingInput,
} from "../lib/questionnaire/costing";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/**
 * POST /quotes/:id/calculate-from-questionnaire
 * Calculate quote pricing from questionnaire answers using costing inputs
 */
router.post("/:id/calculate-from-questionnaire", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const quoteId = String(req.params.id);

    // Verify quote ownership
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });
    if (!quote) {
      return res.status(404).json({ error: "quote not found" });
    }

    // Build costing inputs from questionnaire answers
    const inputs = await buildCostingInputs(quoteId, tenantId);

    // Check if we have any costing inputs
    if (Object.keys(inputs).length === 0) {
      return res.status(400).json({
        error: "no_costing_inputs",
        message: "No questionnaire answers with costing mappings found",
      });
    }

    // Define required inputs for your costing engine
    // Customize this based on your business logic
    const requiredKeys = ["door_height_mm", "door_width_mm", "quantity"];
    const missing = validateCostingInputs(inputs, requiredKeys);

    if (missing.length > 0) {
      return res.status(400).json({
        error: "missing_required_inputs",
        missing,
        message: `Please provide: ${missing.join(", ")}`,
      });
    }

    // Run costing calculation
    const result = await calculateCost(inputs, tenantId);

    // Update quote with calculated price
    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        totalGBP: new Prisma.Decimal(result.estimatedCost),
        meta: {
          ...((quote.meta as any) || {}),
          lastPricing: {
            method: "questionnaire",
            calculatedAt: new Date().toISOString(),
            inputs,
            breakdown: result.breakdown,
            confidence: result.confidence,
            warnings: result.warnings,
          },
        } as any,
      },
    });

    return res.json({
      ok: true,
      estimatedCost: result.estimatedCost,
      breakdown: result.breakdown,
      confidence: result.confidence,
      warnings: result.warnings,
      inputs: inputs,
    });
  } catch (e: any) {
    console.error("[POST /quotes/:id/calculate-from-questionnaire] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error", detail: e?.message });
  }
});

/**
 * GET /quotes/:id/costing-inputs
 * Get costing inputs extracted from questionnaire (for debugging/preview)
 */
router.get("/:id/costing-inputs", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const quoteId = String(req.params.id);

    // Verify quote ownership
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });
    if (!quote) {
      return res.status(404).json({ error: "quote not found" });
    }

    const inputs = await buildCostingInputs(quoteId, tenantId);

    return res.json({
      inputs,
      count: Object.keys(inputs).length,
    });
  } catch (e: any) {
    console.error("[GET /quotes/:id/costing-inputs] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /quotes/:id/price
 * Enhanced pricing endpoint that supports both ML and questionnaire-based pricing
 * Body: { method: "ml" | "questionnaire", ...other options }
 */
router.post("/:id/price", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const quoteId = String(req.params.id);
    const { method = "ml" } = req.body;

    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: { lines: true },
    });
    if (!quote) {
      return res.status(404).json({ error: "quote not found" });
    }

    if (method === "questionnaire") {
      // Use questionnaire-based costing
      const inputs = await buildCostingInputs(quoteId, tenantId);
      
      if (Object.keys(inputs).length === 0) {
        return res.status(400).json({
          error: "no_questionnaire_data",
          message: "Complete the questionnaire first",
        });
      }

      const result = await calculateCost(inputs, tenantId);

      // Apply pricing to quote lines (example: single line with total)
      if (quote.lines.length === 0) {
        await prisma.quoteLine.create({
          data: {
            quoteId: quote.id,
            description: "Bespoke joinery per specification",
            qty: Number(inputs.quantity || 1),
            unitPrice: new Prisma.Decimal(
              result.estimatedCost / Number(inputs.quantity || 1)
            ),
            currency: quote.currency || "GBP",
            deliveryShareGBP: new Prisma.Decimal(0),
            lineTotalGBP: new Prisma.Decimal(result.estimatedCost),
            meta: {
              pricingMethod: "questionnaire",
              costingInputs: inputs,
              breakdown: result.breakdown,
            },
          },
        });
      }

      await prisma.quote.update({
        where: { id: quote.id },
        data: { totalGBP: new Prisma.Decimal(result.estimatedCost) },
      });

      return res.json({
        ok: true,
        method: "questionnaire",
        total: result.estimatedCost,
        breakdown: result.breakdown,
        confidence: result.confidence,
      });
    } else {
      // Use ML-based pricing (existing logic)
      // ... existing ML pricing code ...
      return res.status(501).json({ error: "ml_pricing_not_implemented_in_this_example" });
    }
  } catch (e: any) {
    console.error("[POST /quotes/:id/price] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
