/**
 * Door Pricing Engine
 * 
 * Converts door geometry/dimensions into material requirements, prices them
 * using tenant-specific material items, and calculates complete cost breakdown
 * with labour, overhead, and margin.
 * 
 * @module door-pricing-engine
 */

import type { PrismaClient } from "@prisma/client";

// ============================================================================
// SHARED TYPES (from door-costing-engine.ts)
// ============================================================================
// NOTE: These types are duplicated from frontend costing engine to avoid
// cross-compilation issues. In a production setup, extract to shared package.

type LeafConfiguration = "Single Leaf + Frame" | "Pair of Leaves + Frame" | "Leaf Only";

interface DoorCostingInput {
  quantity: number;
  leafConfiguration: LeafConfiguration;
  frameWidthMm: number;
  frameHeightMm: number;
  numberOfLeaves: number;
  masterLeafWidthMm?: number | null;
  coreType?: string | null;
  coreThicknessMm?: number | null;
  lippingMaterialSelected?: boolean | null;
  frameMaterial?: string | null;
  fireRating?: string | null;
  acousticRatingDb?: number | null;
  glassType?: string | null;
}

interface DerivedDimensions {
  coreSizeStatus?: string | null;
  coreWidthMm?: number | null;
  coreHeightMm?: number | null;
  lippingWidthMm?: number | null;
  leafHeightMm?: number | null;
  frameThicknessMm?: number | null;
}

interface ApertureAndGlassResult {
  totalGlassAreaM2?: number | null;
}

interface CostingWarnings {
  coreSizeStatus?: string | null;
  glassTypeRequired?: boolean | null;
  hasVisionPanels?: boolean | null;
}

interface DoorCostingContext {
  input: DoorCostingInput;
  dimensions: DerivedDimensions;
  apertures: ApertureAndGlassResult;
  warnings: CostingWarnings;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Units of measurement for material quantities.
 */
export type MaterialUsageUnit = "m" | "m2" | "m3" | "each";

/**
 * Material categories for door construction.
 */
export type MaterialCategory =
  | "door_blank"
  | "core"
  | "lipping"
  | "timber"
  | "glass"
  | "ironmongery"
  | "finish"
  | "other";

/**
 * Material requirement for a door line (pre-pricing).
 * 
 * Describes what materials are needed and in what quantities,
 * but doesn't yet have cost/price information.
 */
export interface MaterialRequirement {
  /** Material category for organization and lookup. */
  category: MaterialCategory;

  /** Human-readable description of this requirement. */
  description: string;

  /** Preferred material code for lookup (matches MaterialItem.code). */
  materialCode?: string;

  /** Quantity needed (already multiplied by door quantity). */
  quantity: number;

  /** Unit of measurement for this material. */
  unit: MaterialUsageUnit;

  /** Optional metadata to help resolve correct MaterialItem. */
  meta?: {
    fireRating?: string | null;
    acousticRatingDb?: number | null;
    thicknessMm?: number | null;
    coreType?: string | null;
    glassType?: string | null;
    frameMaterial?: string | null;
    packKey?: string | null; // For ironmongery pack selection
  };
}

/**
 * Material requirement with pricing information attached.
 * 
 * Extends MaterialRequirement with resolved costs and prices
 * from tenant's MaterialItem database.
 */
export interface PricedMaterialRequirement extends MaterialRequirement {
  /** Resolved MaterialItem ID (null if no match found). */
  materialItemId?: string | null;

  /** Cost per unit (0 if no material found). */
  costPerUnit: number;

  /** Sell price per unit (0 if no material found). */
  sellPerUnit: number;

  /** Total line cost (costPerUnit × quantity). */
  lineCost: number;

  /** Total line sell (sellPerUnit × quantity). */
  lineSell: number;
}

/**
 * Complete price breakdown for a door line.
 * 
 * Includes all material requirements with pricing, labour, overhead,
 * margin calculations, and final sell price.
 */
export interface DoorLinePriceBreakdown {
  /** Original costing context (geometry/dimensions). */
  context: DoorCostingContext;

  /** All material requirements with pricing. */
  materials: PricedMaterialRequirement[];

  /** Sum of all material line costs. */
  materialCostTotal: number;

  /** Sum of all material line sell prices. */
  materialSellTotal: number;

  /** Labour cost for this door line. */
  labourCost: number;

  /** Overhead cost (% of materials + labour). */
  overheadCost: number;

  /** Sell price before margin adjustment. */
  preMarginSell: number;

  /** Margin amount added. */
  marginAmount: number;

  /** Margin as percentage of final sell. */
  marginPercent: number;

  /** Final sell price including all costs and margin. */
  finalSellPrice: number;
}

/**
 * Pricing configuration for cost calculations.
 * 
 * Controls labour rates, overhead percentages, and target margins.
 * Can be customized per tenant or order type.
 */
export interface PricingConfig {
  /** Flat labour cost per door (regardless of complexity). */
  defaultLabourCostPerDoor: number;

  /** Overhead percentage applied to (materials + labour). */
  defaultOverheadPercentOnCost: number;

  /** Target gross margin as percentage of sell price. */
  targetMarginPercentOnSell: number;

  /** Default markup % for materials without explicit sell price. */
  defaultMaterialMarkupPercent?: number;
}

// ============================================================================
// MATERIAL REQUIREMENTS BUILDER (Pure Function)
// ============================================================================

/**
 * Build material requirements from door costing context.
 * 
 * Pure function that converts geometry/dimensions into a list of materials
 * needed to manufacture the door. Quantities are already multiplied by
 * door quantity from input.
 * 
 * Current implementation includes:
 * - Core sheets (if applicable)
 * - Lipping material
 * - Frame timber
 * - Glass (if vision panels present)
 * - Ironmongery pack
 * 
 * TODO: Add more granular breakdowns:
 * - Separate head/jamb/sill timber quantities
 * - Architectural finish requirements
 * - Seals and intumescent strips
 * - Hinges, locks, handles separately
 * 
 * @param context - Complete door costing context
 * @returns Array of material requirements (unpiced)
 */
export function buildMaterialRequirements(
  context: DoorCostingContext
): MaterialRequirement[] {
  const { input, dimensions, apertures } = context;
  const requirements: MaterialRequirement[] = [];
  const qty = input.quantity || 1;

  // ========================================================================
  // CORE SHEET
  // ========================================================================
  // Calculate core area needed (if core sizing is applicable)
  if (
    dimensions.coreSizeStatus !== "NOT_APPLICABLE" &&
    dimensions.coreWidthMm &&
    dimensions.coreHeightMm
  ) {
    const coreAreaM2 = (dimensions.coreWidthMm * dimensions.coreHeightMm) / 1_000_000;
    const totalCoreAreaM2 = coreAreaM2 * qty;

    requirements.push({
      category: "core",
      description: `${input.coreType || "Standard"} core sheet`,
      materialCode: input.coreType || undefined,
      quantity: totalCoreAreaM2,
      unit: "m2",
      meta: {
        coreType: input.coreType,
        thicknessMm: input.coreThicknessMm,
        fireRating: input.fireRating,
      },
    });
  }

  // ========================================================================
  // LIPPING
  // ========================================================================
  // Calculate lipping perimeter if lipping is selected
  if (input.lippingMaterialSelected && dimensions.lippingWidthMm && dimensions.lippingWidthMm > 0) {
    // Approximate perimeter: 2 × (width + height) for each leaf
    const masterLeafWidth = input.masterLeafWidthMm || 0;
    const leafHeight = dimensions.leafHeightMm || 0;

    if (masterLeafWidth > 0 && leafHeight > 0) {
      const perimeterPerLeafM = (2 * (masterLeafWidth + leafHeight)) / 1000;
      const totalPerimeterM = perimeterPerLeafM * input.numberOfLeaves * qty;

      requirements.push({
        category: "lipping",
        description: "Door lipping material",
        materialCode: "LIPPING",
        quantity: totalPerimeterM,
        unit: "m",
        meta: {
          thicknessMm: dimensions.lippingWidthMm,
        },
      });
    }
  }

  // ========================================================================
  // FRAME TIMBER
  // ========================================================================
  // Calculate frame timber volume if frame is present
  if (
    input.leafConfiguration !== "Leaf Only" &&
    input.frameWidthMm &&
    input.frameHeightMm &&
    dimensions.frameThicknessMm
  ) {
    // Approximate frame perimeter
    const framePerimeterM = (2 * (input.frameWidthMm + input.frameHeightMm)) / 1000;
    const frameCrossSectionM2 = (dimensions.frameThicknessMm * 100) / 1_000_000; // Assume 100mm depth
    const frameVolumeM3 = framePerimeterM * frameCrossSectionM2 * qty;

    requirements.push({
      category: "timber",
      description: `${input.frameMaterial || "Standard"} frame timber`,
      materialCode: input.frameMaterial || "FRAME_TIMBER",
      quantity: frameVolumeM3,
      unit: "m3",
      meta: {
        frameMaterial: input.frameMaterial,
        thicknessMm: dimensions.frameThicknessMm,
      },
    });
  }

  // ========================================================================
  // GLASS
  // ========================================================================
  // Add glass requirement if vision panels are present
  if (apertures.totalGlassAreaM2 && apertures.totalGlassAreaM2 > 0) {
    const totalGlassM2 = apertures.totalGlassAreaM2 * qty;

    requirements.push({
      category: "glass",
      description: `${input.glassType || "Standard"} door glass`,
      materialCode: input.glassType || undefined,
      quantity: totalGlassM2,
      unit: "m2",
      meta: {
        glassType: input.glassType,
        fireRating: input.fireRating,
        acousticRatingDb: input.acousticRatingDb,
      },
    });
  }

  // ========================================================================
  // IRONMONGERY PACK
  // ========================================================================
  // Standard ironmongery pack per door
  requirements.push({
    category: "ironmongery",
    description: "Ironmongery pack (hinges, locks, handles)",
    materialCode: "IRONMONGERY_PACK",
    quantity: qty,
    unit: "each",
    meta: {
      fireRating: input.fireRating,
    },
  });

  // ========================================================================
  // DOOR BLANK (if configured as complete door rather than leaf-only)
  // ========================================================================
  // Add door blank for complete door assembly if applicable
  if (input.leafConfiguration !== "Leaf Only") {
    requirements.push({
      category: "door_blank",
      description: `Complete door assembly (${input.leafConfiguration})`,
      materialCode: "DOOR_ASSEMBLY",
      quantity: qty,
      unit: "each",
      meta: {
        fireRating: input.fireRating,
        acousticRatingDb: input.acousticRatingDb,
      },
    });
  }

  return requirements;
}

// ============================================================================
// MATERIAL PRICING (Database Access)
// ============================================================================

/**
 * Price material requirements using tenant's material database.
 * 
 * For each requirement, attempts to find a matching MaterialItem by:
 * 1. Exact code match (if materialCode provided)
 * 2. Category + metadata match (fallback)
 * 
 * If no MaterialItem found, sets costs to 0 (flags for UI).
 * 
 * Multi-tenant safe: only queries materials for specified tenant.
 * 
 * @param tenantId - Tenant ID for material lookup
 * @param requirements - Unpiced material requirements
 * @param prisma - Prisma client instance
 * @returns Material requirements with pricing attached
 */
export async function priceMaterialRequirementsForTenant(
  tenantId: string,
  requirements: MaterialRequirement[],
  prisma: PrismaClient
): Promise<PricedMaterialRequirement[]> {
  const priced: PricedMaterialRequirement[] = [];
  const defaultMarkup = 0.3; // 30% default markup

  for (const req of requirements) {
    let materialItem = null;

    // Try to find MaterialItem by code first
    if (req.materialCode) {
      materialItem = await (prisma as any).materialItem.findFirst({
        where: {
          tenantId,
          code: req.materialCode,
          isActive: true,
        },
      });
    }

    // Fallback: try to find by category enum (MaterialItemCategory)
    if (!materialItem) {
      // Map our category strings to Prisma enum values
      const categoryMap: Record<string, string> = {
        door_blank: "DOOR_BLANK",
        core: "BOARD",
        lipping: "LIPPING",
        timber: "TIMBER",
        glass: "GLASS",
        ironmongery: "IRONMONGERY",
        finish: "FINISH",
        other: "OTHER",
      };
      
      const prismaCategory = categoryMap[req.category] || "OTHER";
      
      materialItem = await (prisma as any).materialItem.findFirst({
        where: {
          tenantId,
          isActive: true,
          category: prismaCategory as any,
        },
      });
    }

    // Calculate pricing
    let costPerUnit = 0;
    let sellPerUnit = 0;
    let materialItemId: string | null = null;

    if (materialItem) {
      materialItemId = materialItem.id;
      costPerUnit = Number(materialItem.cost);
      
      // Apply default markup to cost (MaterialItem doesn't have sellPrice field)
      sellPerUnit = costPerUnit * (1 + defaultMarkup);
    }

    // Calculate line totals
    const lineCost = costPerUnit * req.quantity;
    const lineSell = sellPerUnit * req.quantity;

    priced.push({
      ...req,
      materialItemId,
      costPerUnit,
      sellPerUnit,
      lineCost,
      lineSell,
    });
  }

  return priced;
}

// ============================================================================
// COMPLETE DOOR LINE PRICING (Orchestration)
// ============================================================================

/**
 * Calculate complete price breakdown for a door line.
 * 
 * Orchestrates the full pricing pipeline:
 * 1. Build material requirements from context
 * 2. Price materials using tenant's database
 * 3. Add labour costs
 * 4. Add overhead percentage
 * 5. Calculate margin and final sell price
 * 
 * Formula:
 * ```
 * Total Cost = Materials + Labour + Overhead
 * Final Sell = Total Cost / (1 - Target Margin %)
 * Margin Amount = Final Sell - Total Cost
 * ```
 * 
 * @param tenantId - Tenant ID for material pricing
 * @param context - Door costing context with geometry
 * @param prisma - Prisma client instance
 * @param config - Pricing configuration (labour, overhead, margin)
 * @returns Complete price breakdown with all calculations
 */
export async function priceDoorLine(
  tenantId: string,
  context: DoorCostingContext,
  prisma: PrismaClient,
  config: PricingConfig
): Promise<DoorLinePriceBreakdown> {
  // Step 1: Build material requirements
  const requirements = buildMaterialRequirements(context);

  // Step 2: Price materials
  const materials = await priceMaterialRequirementsForTenant(
    tenantId,
    requirements,
    prisma
  );

  // Step 3: Sum material costs
  const materialCostTotal = materials.reduce((sum, m) => sum + m.lineCost, 0);
  const materialSellTotal = materials.reduce((sum, m) => sum + m.lineSell, 0);

  // Step 4: Calculate labour
  const qty = context.input.quantity || 1;
  const labourCost = config.defaultLabourCostPerDoor * qty;

  // Step 5: Calculate overhead
  const overheadBase = materialCostTotal + labourCost;
  const overheadCost = overheadBase * (config.defaultOverheadPercentOnCost / 100);

  // Step 6: Calculate pre-margin sell
  const preMarginSell = materialSellTotal;

  // Step 7: Calculate final sell price with target margin
  const totalCost = materialCostTotal + labourCost + overheadCost;
  const targetMarginDecimal = config.targetMarginPercentOnSell / 100;
  
  // Final sell = cost / (1 - margin%)
  // This ensures margin% is accurate on final sell price
  const finalSellPrice = totalCost / (1 - targetMarginDecimal);
  
  const marginAmount = finalSellPrice - totalCost;
  const marginPercent = (marginAmount / finalSellPrice) * 100;

  return {
    context,
    materials,
    materialCostTotal,
    materialSellTotal,
    labourCost,
    overheadCost,
    preMarginSell,
    marginAmount,
    marginPercent,
    finalSellPrice,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create default pricing configuration.
 * 
 * Provides sensible defaults for UK joinery business:
 * - £50 labour per door
 * - 15% overhead on cost
 * - 25% target margin on sell
 * - 30% material markup if no sell price
 * 
 * @returns Default pricing config
 */
export function createDefaultPricingConfig(): PricingConfig {
  return {
    defaultLabourCostPerDoor: 50,
    defaultOverheadPercentOnCost: 15,
    targetMarginPercentOnSell: 25,
    defaultMaterialMarkupPercent: 30,
  };
}

/**
 * Check if all materials in breakdown have valid pricing.
 * 
 * Returns false if any material has missing MaterialItem (cost = 0).
 * Useful for validation before submitting quotes.
 * 
 * @param breakdown - Door line price breakdown
 * @returns True if all materials priced, false if any missing
 */
export function allMaterialsPriced(breakdown: DoorLinePriceBreakdown): boolean {
  return breakdown.materials.every((m) => m.materialItemId !== null);
}

/**
 * Get list of unpriced materials (missing MaterialItems).
 * 
 * Returns materials that couldn't be matched to tenant's database.
 * UI can use this to prompt user to add missing materials.
 * 
 * @param breakdown - Door line price breakdown
 * @returns Array of materials without pricing
 */
export function getUnpricedMaterials(
  breakdown: DoorLinePriceBreakdown
): PricedMaterialRequirement[] {
  return breakdown.materials.filter((m) => m.materialItemId === null);
}

/**
 * Format price breakdown as human-readable summary.
 * 
 * @param breakdown - Door line price breakdown
 * @returns Multi-line summary string
 */
export function formatPriceBreakdown(breakdown: DoorLinePriceBreakdown): string {
  const lines = [
    "=== Door Line Price Breakdown ===",
    `Quantity: ${breakdown.context.input.quantity}`,
    "",
    "Materials:",
    ...breakdown.materials.map(
      (m) =>
        `  ${m.description}: ${m.quantity.toFixed(2)} ${m.unit} @ £${m.sellPerUnit.toFixed(2)} = £${m.lineSell.toFixed(2)}`
    ),
    `Material Total: £${breakdown.materialSellTotal.toFixed(2)}`,
    "",
    `Labour: £${breakdown.labourCost.toFixed(2)}`,
    `Overhead: £${breakdown.overheadCost.toFixed(2)}`,
    `Margin (${breakdown.marginPercent.toFixed(1)}%): £${breakdown.marginAmount.toFixed(2)}`,
    "",
    `FINAL SELL PRICE: £${breakdown.finalSellPrice.toFixed(2)}`,
  ];

  return lines.join("\n");
}
