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

  applyMeasurementFallbacks(inputs);

  // Auto-compute project/item area (m²) if dimensions & quantity present and area missing
  if (inputs.area_m2 == null) {
    const height = toNumber(inputs.door_height_mm);
    const width = toNumber(inputs.door_width_mm);
    const qty = toNumber(inputs.quantity) || 1;
    if (height != null && width != null && height > 0 && width > 0) {
      const areaSquareMm = height * width * qty;
      const areaM2 = areaSquareMm / 1_000_000; // mm² → m²
      // Round to 3 decimals for stability
      inputs.area_m2 = Math.round(areaM2 * 1000) / 1000;
    }
  }

  // Normalize ironmongery level input (store canonical lowercase)
  if (typeof inputs.ironmongery_level === "string") {
    inputs.ironmongery_level = inputs.ironmongery_level.toLowerCase();
  }

  return inputs;
}

const WIDTH_FALLBACK_KEYS = ["estimated_width_mm", "photo_width_mm", "rough_width_mm"];
const HEIGHT_FALLBACK_KEYS = ["estimated_height_mm", "photo_height_mm", "rough_height_mm"];

function applyMeasurementFallbacks(inputs: CostingInput) {
  ensureMeasurementKey(inputs, "door_width_mm", WIDTH_FALLBACK_KEYS);
  ensureMeasurementKey(inputs, "door_height_mm", HEIGHT_FALLBACK_KEYS);
}

function ensureMeasurementKey(inputs: CostingInput, primaryKey: string, fallbackKeys: string[]) {
  if (toNumber(inputs[primaryKey]) != null) return;
  for (const key of fallbackKeys) {
    const candidate = toNumber(inputs[key]);
    if (candidate != null) {
      inputs[primaryKey] = candidate;
      return;
    }
  }
}

function toNumber(value: any): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

  // Compute area (mm²) & m²
  const areaSquareMm = height * width;
  const areaM2 = areaSquareMm / 1_000_000;

  // Base pricing components (placeholder logic)
  const basePrice = 500; // fixed engineering + handling baseline
  const areaPrice = areaSquareMm * 0.001; // dimensional scaling factor

  // Ironmongery level multiplier (affects complexity & fitting time)
  const iron = String(inputs.ironmongery_level || "").toLowerCase();
  const ironFactor = iron === "heritage" ? 1.2 : iron === "enhanced" ? 1.12 : 1.0;

  // Materials grade lightweight multiplier (optional future extension)
  const grade = String(inputs.materials_grade || "").toLowerCase();
  const gradeFactor = grade === "premium" ? 1.15 : grade === "basic" ? 0.92 : 1.0;

  const totalPerUnitRaw = basePrice + areaPrice;
  const totalPerUnit = totalPerUnitRaw * ironFactor * gradeFactor;
  const estimatedCost = totalPerUnit * quantity;

  return {
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    breakdown: {
      base: Math.round(basePrice * quantity * 100) / 100,
      area_component_mm2: Math.round(areaPrice * quantity * 100) / 100,
      area_m2: Math.round(areaM2 * quantity * 1000) / 1000,
      ironmongery_factor: ironFactor,
      materials_grade_factor: gradeFactor,
    },
    confidence: 0.85,
  };
}
