// api/src/lib/questionnaire/costing.ts
/**
 * Costing Helper for Questionnaire-driven quotes
 * Extracts costing inputs from questionnaire answers using costingInputKey mappings
 */

import { prisma } from "../../prisma";
import { QuestionnaireFieldType } from "@prisma/client";

export interface CostingInput {
  [key: string]: string | number | boolean | null;
}

/**
 * Build a typed costing input object from questionnaire answers
 * @param quoteId - Quote ID to fetch answers for
 * @param tenantId - Tenant ID for security validation
 * @returns Object with costingInputKey -> typed value mappings
 */
export async function buildCostingInputs(
  quoteId: string,
  tenantId: string
): Promise<CostingInput> {
  // Fetch response with answers and field definitions
  const response = await prisma.questionnaireResponse.findUnique({
    where: { quoteId },
    include: {
      answers: {
        include: {
          field: true,
        },
      },
    },
  });

  if (!response) {
    return {};
  }

  // Verify tenant ownership
  if (response.tenantId !== tenantId) {
    throw new Error("Unauthorized: quote does not belong to tenant");
  }

  const inputs: CostingInput = {};

  for (const answer of response.answers) {
    const { field, value } = answer as any;
    if (!field?.costingInputKey) continue;
    const typedValue = convertValue(value, field.type as QuestionnaireFieldType);
    inputs[field.costingInputKey] = typedValue;
  }

  return inputs;
}

/**
 * Convert string value to appropriate type based on field type
 */
function convertValue(
  value: any,
  fieldType: QuestionnaireFieldType
): string | number | boolean | null {
  if (value === null || value === undefined || value === "") return null;
  // If value is an object/array from JSON, attempt primitive extraction
  if (typeof value === "object") {
    // Simple heuristic: if single-key object with primitive, unwrap.
    const keys = Object.keys(value);
    if (keys.length === 1 && typeof (value as any)[keys[0]] !== "object") {
      value = (value as any)[keys[0]];
    } else {
      // Preserve object for TEXT/TEXTAREA only later by JSON.stringify
    }
  }

  switch (fieldType) {
    case "NUMBER": {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    }
    case "BOOLEAN": {
      if (typeof value === "boolean") return value;
      const lower = String(value).toLowerCase();
      if (["true", "1", "yes", "y"].includes(lower)) return true;
      if (["false", "0", "no", "n"].includes(lower)) return false;
      return null;
    }
    case "DATE": {
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    case "SELECT": {
      if (Array.isArray(value)) return value.map(v => String(v)).join(",");
      return String(value);
    }
    case "TEXT":
    case "TEXTAREA": {
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    default: {
      return String(value);
    }
  }
}

/**
 * Get all costing input keys defined for a tenant
 * Useful for documentation and validation
 */
export async function getCostingInputKeys(tenantId: string): Promise<string[]> {
  const fields = await prisma.questionnaireField.findMany({
    where: {
      tenantId,
      isActive: true,
      costingInputKey: { not: null },
    },
    select: {
      costingInputKey: true,
    },
  });

  return fields
    .map((f) => f.costingInputKey)
    .filter((key): key is string => key != null);
}

/**
 * Validate that required costing inputs are present
 * @param inputs - Costing inputs object
 * @param requiredKeys - Array of required costing input keys
 * @returns Array of missing keys (empty if all present)
 */
export function validateCostingInputs(
  inputs: CostingInput,
  requiredKeys: string[]
): string[] {
  const missing: string[] = [];

  for (const key of requiredKeys) {
    const value = inputs[key];
    if (value === null || value === undefined || value === "") {
      missing.push(key);
    }
  }

  return missing;
}

/**
 * Example costing engine interface
 * Replace with your actual costing logic
 */
export interface CostingResult {
  estimatedCost: number;
  breakdown?: Record<string, number>;
  confidence?: number;
  warnings?: string[];
}

/**
 * Example: Calculate cost from costing inputs
 * This is a placeholder - implement your actual costing logic here
 */
export async function calculateCost(
  inputs: CostingInput,
  tenantId: string
): Promise<CostingResult> {
  // Example: Simple door costing based on dimensions
  const height = Number(inputs.door_height_mm) || 0;
  const width = Number(inputs.door_width_mm) || 0;
  const quantity = Number(inputs.quantity) || 1;

  if (height <= 0 || width <= 0) {
    return {
      estimatedCost: 0,
      warnings: ["Missing or invalid dimensions"],
      confidence: 0,
    };
  }

  // Example calculation: £500 base + £0.001 per mm² × quantity
  const areaSquareMm = height * width;
  const basePrice = 500;
  const areaPrice = areaSquareMm * 0.001;
  const totalPerUnit = basePrice + areaPrice;
  const estimatedCost = totalPerUnit * quantity;

  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    breakdown: {
      base: basePrice * quantity,
      area: areaPrice * quantity,
    },
    confidence: 0.85,
  };
}
