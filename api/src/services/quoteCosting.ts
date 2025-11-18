// api/src/services/quoteCosting.ts
// Production-grade costing helper integrating questionnaire answers with quote pricing.
// Responsibilities:
// 1. buildCostingInput(responseId) → { [costingInputKey]: coercedValue }
//    - Loads answers + field metadata
//    - Ignores fields without costingInputKey
//    - Coerces values based on QuestionnaireFieldType
//    - Multi-tenant safe (validated upstream by calculateCostForQuote)
// 2. calculateCostForQuote(quoteId, tenantId)
//    - Verifies quote ownership
//    - Loads QuestionnaireResponse for quote
//    - Uses buildCostingInput(response.id)
//    - Passes costingInput into existing calculation pipeline (calculateCost)
//    - Persists pricing breakdown onto Quote.meta and updates totalGBP
//    - Returns structured result

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { calculateCost, buildCostingInputs, type CostingInput } from "../lib/questionnaire/costing";

// NOTE: This service now delegates extraction to lib/questionnaire/costing.ts
// The previous internal buildCostingInput(responseId) has been replaced by buildCostingInputs(quoteId, tenantId).
// Backwards compatibility: types aligned via CostingInput.

export interface CalculateCostForQuoteResult {
  quoteId: string;
  responseId: string | null;
  inputs: CostingInput;
  updated: boolean;
  estimatedCost: number | null;
  breakdown?: Record<string, number>;
  confidence?: number;
  warnings?: string[];
  missingRequired?: string[];
  message?: string;
}

// (Deprecated) buildCostingInput(responseId) kept as thin adapter for any legacy callers.
// Prefer using buildCostingInputs(quoteId, tenantId).
export async function buildCostingInput(responseId: string): Promise<CostingInput> {
  const response = await prisma.questionnaireResponse.findUnique({ where: { id: responseId } });
  if (!response) return {};
  return buildCostingInputs(response.quoteId!, response.tenantId);
}

/**
 * Core function to calculate costing for a quote and persist breakdown.
 * Throws on unauthorized access. Returns rich result object.
 */
export async function calculateCostForQuote(
  quoteId: string,
  tenantId: string,
  options?: { requiredKeys?: string[]; updateTotals?: boolean }
): Promise<CalculateCostForQuoteResult> {
  const requiredKeys = options?.requiredKeys || [];
  const updateTotals = options?.updateTotals !== false; // default true

  // 1. Verify quote ownership
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, tenantId } });
  if (!quote) {
    throw new Error("Quote not found or not owned by tenant");
  }

  // 2. Load questionnaire response (answers + fields)
  const response = await prisma.questionnaireResponse.findUnique({
    where: { quoteId },
    include: {
      answers: { include: { field: true } },
    },
  });
  if (!response) {
    return {
      quoteId,
      responseId: null,
      inputs: {},
      updated: false,
      estimatedCost: null,
      message: "No questionnaire response found",
    };
  }

  if (response.tenantId !== tenantId) {
    throw new Error("Unauthorized questionnaire response access");
  }

  // 3. Build costing inputs via unified helper (quote scoped)
  const inputs = await buildCostingInputs(quoteId, tenantId);
  if (!Object.keys(inputs).length) {
    return {
      quoteId,
      responseId: response.id,
      inputs,
      updated: false,
      estimatedCost: null,
      message: "No costing input mappings present",
    };
  }

  // 4. Validate required keys (if provided)
  const missingRequired = requiredKeys.filter((k) => {
    const v = inputs[k];
    return v === null || v === undefined || v === "";
  });
  if (missingRequired.length) {
    return {
      quoteId,
      responseId: response.id,
      inputs,
      updated: false,
      estimatedCost: null,
      missingRequired,
      message: `Missing required inputs: ${missingRequired.join(", ")}`,
    };
  }

  // 5. Run existing costing pipeline
  const result = await calculateCost(inputs, tenantId);
  const estimated = Number(result.estimatedCost || 0);

  // 6. Persist breakdown onto Quote.meta and totals
  const meta0: any = (quote.meta as any) || {};
  const nextMeta = {
    ...(meta0 || {}),
    lastCosting: {
      method: "questionnaire",
      calculatedAt: new Date().toISOString(),
      inputs,
      breakdown: result.breakdown || {},
      confidence: result.confidence ?? null,
      warnings: result.warnings || [],
    },
  } as any;

  const dataUpdate: any = { meta: nextMeta };
  if (updateTotals) {
    dataUpdate.totalGBP = new Prisma.Decimal(Number.isFinite(estimated) ? estimated : 0);
  }

  await prisma.quote.update({ where: { id: quote.id }, data: dataUpdate });

  return {
    quoteId,
    responseId: response.id,
    inputs,
    updated: true,
    estimatedCost: estimated,
    breakdown: result.breakdown,
    confidence: result.confidence,
    warnings: result.warnings,
  };
}
