/**
 * ML Project Actuals Integration
 * Automatically captures real project costs from opportunities, POs, and timesheets
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
}

/**
 * POST /ml-actuals/capture/:opportunityId
 * Capture completed project actuals from opportunity + POs + timesheets
 */
router.post("/capture/:opportunityId", requireAuth, async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const opportunityId = String(req.params.opportunityId);
  const { completedAt, notes } = req.body || {};

  try {
    // 1. Load opportunity with quote and questionnaire
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId },
      include: {
        lead: {
          include: {
            Quote: {
              take: 1,
              orderBy: { createdAt: "desc" },
              include: { lines: true }
            }
          }
        }
      }
    });

    if (!opportunity) {
      return res.status(404).json({ error: "opportunity_not_found" });
    }

    // 2. Get questionnaire answers from quote meta
    const quote = opportunity.lead?.Quote?.[0];
    const questionnaireAnswers = (quote?.meta as any)?.questionnaireAnswers || {};
    
    if (Object.keys(questionnaireAnswers).length === 0) {
      return res.status(400).json({ 
        error: "no_questionnaire_data",
        message: "No questionnaire answers found in quote"
      });
    }

    // 3. Calculate material costs from purchase orders
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        notes: { contains: opportunityId } // POs should reference opportunity ID
      },
      include: {
        lines: true
      }
    });

    const materialCostActual = purchaseOrders.reduce((sum, po) => {
      return sum + Number(po.totalAmount || 0);
    }, 0);

    // 4. Calculate labor costs from time entries
    const timeEntries = await (prisma as any).timeEntry.findMany({
      where: {
        tenantId,
        projectId: opportunityId
      },
      include: {
        user: {
          select: {
            workshopHoursPerDay: true
          }
        }
      }
    });

    const laborHoursActual = timeEntries.reduce((sum: number, entry: any) => {
      return sum + Number(entry.hours || 0);
    }, 0);

    // Calculate labor cost (assume £35/hour average if no user rate)
    const laborCostActual = timeEntries.reduce((sum: number, entry: any) => {
      const hours = Number(entry.hours || 0);
      const hourlyRate = 35; // Default rate - could be pulled from user settings
      return sum + (hours * hourlyRate);
    }, 0);

    // 5. Get client estimate and order value
    const clientEstimate = Number(quote?.totalGBP || opportunity.valueGBP || 0);
    const clientOrderValue = Number(opportunity.valueGBP || quote?.totalGBP || 0);

    // Get supplier quote cost from quote lines
    const supplierQuoteCost = quote?.lines?.reduce((sum, line) => {
      const supplierUnit = Number((line.meta as any)?.supplierUnit || line.unitPrice || 0);
      const qty = Number(line.qty || 1);
      return sum + (supplierUnit * qty);
    }, 0) || 0;

    // 6. Call ML service to save project actuals
    const ML_URL = process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000";
    
    const mlResponse = await fetch(`${ML_URL}/save-project-actuals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        quoteId: quote?.id,
        leadId: opportunity.leadId,
        questionnaireAnswers,
        supplierQuoteCost: supplierQuoteCost || null,
        clientEstimate: clientEstimate || null,
        clientOrderValue,
        materialCostActual: materialCostActual || null,
        laborHoursActual: laborHoursActual || null,
        laborCostActual: laborCostActual || null,
        otherCostsActual: null, // Could add transport, subcontractors
        completedAt: completedAt || new Date().toISOString(),
        notes: notes || `Auto-captured from opportunity ${opportunityId}`
      })
    });

    if (!mlResponse.ok) {
      throw new Error(`ML service error: ${mlResponse.statusText}`);
    }

    const mlResult = await mlResponse.json();

    return res.json({
      ok: true,
      message: "Project actuals captured successfully",
      data: {
        opportunityId,
        clientOrderValue,
        materialCostActual,
        laborHoursActual,
        laborCostActual,
        supplierQuoteCost,
        metrics: mlResult.metrics,
        purchaseOrdersFound: purchaseOrders.length,
        timeEntriesFound: timeEntries.length
      }
    });

  } catch (e: any) {
    console.error("[ml-actuals/capture] failed:", e);
    return res.status(500).json({ 
      error: "capture_failed",
      message: e?.message || "Failed to capture project actuals"
    });
  }
});

/**
 * POST /ml-actuals/capture-from-po/:purchaseOrderId
 * Update material costs when PO is received
 */
router.post("/capture-from-po/:purchaseOrderId", requireAuth, async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const purchaseOrderId = String(req.params.purchaseOrderId);

  try {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      include: { lines: true }
    });

    if (!po) {
      return res.status(404).json({ error: "purchase_order_not_found" });
    }

    // Extract opportunity ID from PO notes if linked
    const opportunityId = (po.notes || "").match(/opp_[a-zA-Z0-9]+|clz[a-zA-Z0-9]+/)?.[0];
    
    if (!opportunityId) {
      return res.json({
        ok: true,
        message: "PO not linked to opportunity, skipping ML update"
      });
    }

    // Trigger full actuals capture for the opportunity
    return res.redirect(307, `/ml-actuals/capture/${opportunityId}`);

  } catch (e: any) {
    console.error("[ml-actuals/capture-from-po] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /ml-actuals/summary/:opportunityId
 * Get current actuals summary without saving to ML
 */
router.get("/summary/:opportunityId", requireAuth, async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const opportunityId = String(req.params.opportunityId);

  try {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId },
      include: {
        lead: {
          include: {
            Quote: {
              take: 1,
              orderBy: { createdAt: "desc" }
            }
          }
        }
      }
    });

    if (!opportunity) {
      return res.status(404).json({ error: "opportunity_not_found" });
    }

    const quote = opportunity.lead?.Quote?.[0];

    // Calculate material costs
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        notes: { contains: opportunityId }
      }
    });

    const materialCost = purchaseOrders.reduce((sum, po) => {
      return sum + Number(po.totalAmount || 0);
    }, 0);

    // Calculate labor
    const timeEntries = await (prisma as any).timeEntry.findMany({
      where: {
        tenantId,
        projectId: opportunityId
      }
    });

    const laborHours = timeEntries.reduce((sum: number, entry: any) => {
      return sum + Number(entry.hours || 0);
    }, 0);

    const laborCost = laborHours * 35; // £35/hour default

    const totalCost = materialCost + laborCost;
    const orderValue = Number(opportunity.valueGBP || 0);
    const grossProfit = orderValue - totalCost;
    const gpPercent = orderValue > 0 ? (grossProfit / orderValue) * 100 : 0;

    return res.json({
      ok: true,
      opportunityId,
      orderValue,
      materialCost,
      laborHours,
      laborCost,
      totalCost,
      grossProfit,
      gpPercent: Math.round(gpPercent * 10) / 10,
      targetGP: 40,
      hitTarget: gpPercent >= 40,
      purchaseOrdersCount: purchaseOrders.length,
      timeEntriesCount: timeEntries.length,
      hasQuote: !!quote
    });

  } catch (e: any) {
    console.error("[ml-actuals/summary] failed:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
