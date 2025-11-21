/**
 * Door Costing Engine - High-Level Orchestration
 * 
 * Combines dimensions and apertures calculators into a single unified API.
 * Provides complete door costing context with derived dimensions, glass/aperture
 * calculations, and validation warnings.
 * 
 * @module door-costing-engine
 */

import {
  type DoorCostingInput as DimensionsDoorCostingInput,
  type DimensionRules,
  type DerivedDimensions,
  calculateDerivedDimensions,
} from "./derived-dimensions";

import {
  type ApertureDoorCostingInput,
  type ApertureRules,
  type ApertureAndGlassResult,
  calculateAperturesAndGlass,
} from "./apertures-and-glass";

/**
 * Unified door costing input that combines all fields from both calculators.
 * 
 * This interface merges:
 * - DoorCostingInput from derived-dimensions (frame, leaf basics, core, lipping)
 * - ApertureDoorCostingInput from apertures-and-glass (vision panels, glass)
 */
export interface DoorCostingInput extends DimensionsDoorCostingInput {
  // Vision panel fields (from apertures module)
  certificationScheme: string | null;
  fireCertificationKey: string | null;
  visionPanelQtyLeaf1: number;
  visionPanelQtyLeaf2: number;
  leaf1Aperture1WidthSeeDetailMm: number | null;
  leaf1Aperture1HeightSeeDetailMm: number | null;
  leaf1Aperture2WidthSeeDetailMm: number | null;
  leaf1Aperture2HeightSeeDetailMm: number | null;
  leaf2Aperture1WidthSeeDetailMm?: number | null;
  leaf2Aperture1HeightSeeDetailMm?: number | null;
  leaf2Aperture2WidthSeeDetailMm?: number | null;
  leaf2Aperture2HeightSeeDetailMm?: number | null;
  glassType: string | null;
}

/**
 * Validation warnings and status flags for the door costing.
 * 
 * Aggregates critical checks from both dimensions and apertures calculations
 * to help UI display appropriate messages or block submission.
 */
export interface CostingWarnings {
  /**
   * Core size status from dimensions calculation.
   * - "OK": Standard core size available
   * - "CHECK_PRICE": Non-standard size, requires supplier pricing
   * - "NOT_APPLICABLE": Core sizing not relevant for this configuration
   * - "NONE": No core size determined
   */
  coreSizeStatus?: "OK" | "CHECK_PRICE" | "NOT_APPLICABLE" | "NONE";

  /**
   * Whether glass type must be specified.
   * True when vision panels are present but glass type is missing.
   */
  glassTypeRequired?: boolean;

  /**
   * Whether this door configuration includes vision panels.
   * True if either leaf has vision panel quantity > 0.
   */
  hasVisionPanels?: boolean;
}

/**
 * Complete door costing context.
 * 
 * Packages all calculation results into a single object for easy consumption
 * by UI, pricing engines, or export/reporting systems.
 */
export interface DoorCostingContext {
  /**
   * Original input specification.
   */
  input: DoorCostingInput;

  /**
   * Derived dimensions (frame, leaf, core, lipping, weights).
   */
  dimensions: DerivedDimensions;

  /**
   * Aperture and glass calculations (production sizes, glass cuts, areas).
   */
  apertures: ApertureAndGlassResult;

  /**
   * Aggregated warnings and validation flags.
   */
  warnings: CostingWarnings;
}

/**
 * Combined rules interface for both calculators.
 * 
 * Allows callers to provide lookup implementations for both
 * dimensions and apertures in a single object.
 */
export interface DoorCostingRules {
  /**
   * Rules for dimension calculations (gaps, offsets, lipping, frame caps).
   */
  dimensions: DimensionRules;

  /**
   * Rules for aperture calculations (fire cert offsets, glass clearances).
   */
  apertures: ApertureRules;
}

/**
 * Calculate complete door costing context.
 * 
 * This is the primary entry point for the costing engine. It orchestrates
 * all dimension and aperture calculations, then packages results with
 * validation warnings.
 * 
 * Process:
 * 1. Calculate derived dimensions (frame, leaf, core, lipping, weights)
 * 2. Enrich input with calculated dimensions for apertures calculator
 * 3. Calculate apertures and glass (production sizes, glass cuts, areas)
 * 4. Build validation warnings (core size status, glass type checks)
 * 5. Package everything into DoorCostingContext
 * 
 * @param input - Complete door specification
 * @param rules - Combined rules for both calculators
 * @returns Complete costing context with all calculations and warnings
 * 
 * @example
 * ```typescript
 * const rules = {
 *   dimensions: new SampleDimensionRules(),
 *   apertures: new SampleApertureRules(),
 * };
 * 
 * const context = calculateDoorCostingContext(doorSpec, rules);
 * 
 * console.log(context.dimensions.leafHeightMm);
 * console.log(context.apertures.totalGlassAreaM2);
 * if (context.warnings.glassTypeRequired) {
 *   alert("Please select a glass type");
 * }
 * ```
 */
export function calculateDoorCostingContext(
  input: DoorCostingInput,
  rules: DoorCostingRules
): DoorCostingContext {
  // Calculate derived dimensions
  const dimensions = calculateDerivedDimensions(input, rules.dimensions);

  // Enrich input with calculated dimensions for apertures calculator
  // The apertures module needs slaveLeafWidthMm and leafHeightMm which are outputs
  // from the dimensions calculator
  const enrichedInput: ApertureDoorCostingInput = {
    ...input,
    slaveLeafWidthMm: dimensions.slaveLeafWidthMm,
    leafHeightMm: dimensions.leafHeightMm,
  };

  // Calculate apertures and glass
  const apertures = calculateAperturesAndGlass(enrichedInput, rules.apertures);

  // Build warnings object
  const warnings = buildCostingWarnings(input, dimensions, apertures);

  // Package complete context
  return {
    input,
    dimensions,
    apertures,
    warnings,
  };
}

/**
 * Build validation warnings from calculation results.
 * 
 * Aggregates critical status checks and validation flags to help
 * downstream code (UI, pricing, etc.) respond appropriately.
 * 
 * @param input - Original door specification
 * @param dimensions - Derived dimensions result
 * @param apertures - Apertures and glass result
 * @returns Validation warnings object
 */
function buildCostingWarnings(
  input: DoorCostingInput,
  dimensions: DerivedDimensions,
  apertures: ApertureAndGlassResult
): CostingWarnings {
  const warnings: CostingWarnings = {};

  // Core size status from dimensions
  if (dimensions.coreSizeStatus) {
    warnings.coreSizeStatus = dimensions.coreSizeStatus;
  }

  // Vision panel presence check
  const totalVPQty = (input.visionPanelQtyLeaf1 || 0) + (input.visionPanelQtyLeaf2 || 0);
  warnings.hasVisionPanels = totalVPQty > 0;

  // Glass type required check
  // True if: has vision panels AND (apertures flagged it OR glassType is empty)
  if (warnings.hasVisionPanels) {
    const glassTypeEmpty = !input.glassType || input.glassType.trim() === "";
    const aperturesFlag = apertures.tempGlassCheckMessage === "Glass Type Required";
    warnings.glassTypeRequired = glassTypeEmpty || aperturesFlag;
  } else {
    warnings.glassTypeRequired = false;
  }

  return warnings;
}

/**
 * Helper to check if context has any blocking warnings.
 * 
 * Returns true if there are warnings that should prevent order submission
 * (e.g., missing glass type when vision panels present, non-standard core size).
 * 
 * @param context - Door costing context
 * @returns True if there are blocking warnings
 */
export function hasBlockingWarnings(context: DoorCostingContext): boolean {
  const { warnings } = context;

  // Glass type required is blocking
  if (warnings.glassTypeRequired) {
    return true;
  }

  // CHECK_PRICE status is informational, not blocking
  // (user should be aware but can proceed)
  // Uncomment next line if you want it to block:
  // if (warnings.coreSizeStatus === "CHECK_PRICE") return true;

  return false;
}

/**
 * Helper to get human-readable warning messages.
 * 
 * Converts validation flags into user-friendly messages for display.
 * 
 * @param context - Door costing context
 * @returns Array of warning messages
 */
export function getWarningMessages(context: DoorCostingContext): string[] {
  const messages: string[] = [];
  const { warnings } = context;

  if (warnings.glassTypeRequired) {
    messages.push("Glass type must be specified for vision panels");
  }

  if (warnings.coreSizeStatus === "CHECK_PRICE") {
    messages.push("Non-standard core size - pricing confirmation required");
  }

  if (warnings.coreSizeStatus === "NOT_APPLICABLE") {
    messages.push("Core sizing not applicable for this configuration");
  }

  return messages;
}
