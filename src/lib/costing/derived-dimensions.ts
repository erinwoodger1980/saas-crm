/**
 * Door Costing Dimension Calculator
 * 
 * This module implements the dimension/geometry logic from the Excel "Cost Sheet"
 * as pure TypeScript functions. It focuses on derived dimensions (S/O, O/F, frame,
 * leaf, core sizing) and does NOT handle pricing.
 */

export type LeafConfiguration = "Leaf Only" | "Single" | "Leaf & a Half" | "Double";

/**
 * Input data for door costing calculations.
 * Represents a single line from the Import/Cost Sheet.
 */
export interface DoorCostingInput {
  // Basic doorset info
  doorsetType: string | null;              // "Doorset" / "Leaf" / "Frame" / "Leaf Only"
  frameWidthMm: number | null;             // S/O Width (structural opening)
  frameHeightMm: number | null;            // S/O Height
  wallThicknessMm: number | null;          // S/O Wall Thickness
  frameMaterial: string | null;            // Frame Material (MDF, Softwood, etc.)
  frameType: string | null;                // Used for gap/offset lookups
  leafConfiguration: LeafConfiguration;    // Leaf Configuration
  numberOfLeaves: number;                  // Number of Leaves (inc solid overpanels)
  quantity: number;                        // Overall quantity of this line

  // Sidelights & fanlights
  numberOfSidelight1: number;
  sidelight1WidthMm: number | null;
  numberOfSidelight2: number;
  sidelight2WidthMm: number | null;
  fanlightQty: number;                     // Fanlight / Overpanel Qty
  fanlightHeightMm: number | null;         // Fanlight / Overpanel Height

  // Jamb & head data
  liningThicknessJambsMm: number | null;   // Lining Thickness - Jambs
  liningThicknessHeadsMm: number | null;   // Lining Thickness - Heads
  doorUndercutMm: number | null;           // Door Undercut

  // Leaf sizes
  masterLeafWidthMm: number | null;        // M Leaf Width
  masterLeafAreaM2: number | null;         // Master Leaf Area
  slaveLeafAreaM2: number | null;          // Slave Leaf Area

  // Fire & acoustic ratings
  fireRating: string | null;               // FD30, FD60, FD90, FD120, FD60S, etc.
  acousticRatingDb: number | null;         // Acoustic Rating dB

  // Core & lipping
  coreType: string | null;                 // Core Type
  coreThicknessMm: number | null;          // Core Thickness2
  lippingMaterialSelected: boolean;        // Based on "Lipping Material 2" (0 = no lipping)

  // Leaf weight (pre-looked-up from Weights table)
  leafWeightPerM2Kg: number | null;        // From Weights table (Table19)
}

/**
 * Rules/lookup interface for dimension calculations.
 * Wraps lookups from "Leaf Sizing By Frame Type" and other tables.
 */
export interface DimensionRules {
  // Lookups from Leaf Sizing By Frame Type table
  getSoOffsetWidth(frameType: string | null, config: LeafConfiguration): number | null;
  getSoOffsetHeight(frameType: string | null, config: LeafConfiguration): number | null;
  getTotalGapWidth(frameType: string | null, config: LeafConfiguration): number | null;
  getTotalGapHeight(frameType: string | null, config: LeafConfiguration): number | null;

  // Constants for lipping calculations
  lippingExtraWidthFor54CoreMm: number;   // Excel uses 58mm for 54mm core
  lippingDefaultWidthMm: number;          // Excel uses 48mm otherwise

  // Frame thickness caps
  maxFrameThicknessStdMm: number;         // 150mm cap for MDF/Softwood/Hardwood etc.
  maxFrameThicknessEngineeredMm: number;  // 235mm cap for Engineered softwood
}

export type CoreSizeStatus = "OK" | "CHECK_PRICE" | "NOT_APPLICABLE" | "NONE";

/**
 * Calculated/derived dimensions output.
 * All dimensions in millimeters, weights in kilograms.
 */
export interface DerivedDimensions {
  // Opening dimensions
  soWidthMm: number | null;                   // S/O Width (structural opening)
  soHeightMm: number | null;                  // S/O Height
  openingWidthMm: number | null;              // O/F Width (doorset opening)
  openingHeightMm: number | null;             // O/F Height (doorset opening)

  // Extension linings
  extensionVisibleWidthMm: number | null;     // Extension Lining Width (Visible size)
  extensionActualWidthMm: number | null;      // Extension Lining Width (Actual size inc lip)

  // Frame & leaf dimensions
  frameThicknessMm: number | null;            // Frame Thickness
  leafHeightMm: number | null;                // Leaf Height
  masterLeafWidthMm: number | null;           // M Leaf Width
  slaveLeafWidthMm: number | null;            // S Leaf Width
  leafThicknessMm: number | null;             // Leaf Thickness

  // Core sizing
  coreWidthMm: number | null;                 // Core Width
  coreHeightMm: number | null;                // Core Height
  coreSizeStatus: CoreSizeStatus;             // OK / CHECK_PRICE / NOT_APPLICABLE / NONE

  // Lipping
  lippingWidthMm: number | null;              // Lipping Width

  // Weights
  leafWeightPerM2Kg: number | null;           // From input (echoed back)
  masterLeafWeightKg: number | null;          // Master Leaf Weight
  slaveLeafWeightKg: number | null;           // Slave Leaf Weight
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

interface CoreSizingResult {
  value: number | null;
  status: CoreSizeStatus;
}

// Standard timber frame materials that use 150mm max thickness
const TIMBER_FRAME_MATERIALS = new Set([
  "mdf",
  "softwood",
  "hardwood",
  "oak",
  "ash",
  "maple",
  "sapele",
  "walnut",
  "beech",
  "steel",
  "stainless steel",
  "stainless_steel",
]);

// Engineered softwood uses 235mm max thickness
const ENGINEERED_SOFTWOOD_ALIAS = new Set([
  "engineered_softwood",
  "engineered softwood",
]);

// Fire ratings requiring 60mm leaf thickness
const FIRE_RATINGS_60MM = new Set(["fd90", "fd120", "fd90s", "fd120s"]);

// Fire ratings requiring 54mm leaf thickness
const FIRE_RATINGS_54MM = new Set(["fd60", "fd60s"]);

/**
 * Main calculation function that computes all derived dimensions.
 * Pure function with no side effects - deterministic output for given inputs.
 * 
 * @param input - Door specification input data
 * @param rules - Dimension rules for lookups (gaps, offsets, constants)
 * @returns Calculated derived dimensions
 */
export function calculateDerivedDimensions(
  input: DoorCostingInput,
  rules: DimensionRules
): DerivedDimensions {
  // Step 1: Determine S/O dimensions (structural opening)
  // If "leaf only", S/O is not applicable
  const isLeafOnly = input.doorsetType?.toLowerCase().trim() === "leaf only" ||
                     input.leafConfiguration === "Leaf Only";
  const soWidthMm = !isLeafOnly ? normalizeNumber(input.frameWidthMm) : null;
  const soHeightMm = !isLeafOnly ? normalizeNumber(input.frameHeightMm) : null;

  // Step 2: Compute opening dimensions (O/F = over frame)
  const openingWidthMm = computeOpeningWidth({
    soWidthMm,
    frameType: input.frameType,
    configuration: input.leafConfiguration,
    rules,
    sidelight1Qty: input.numberOfSidelight1,
    sidelight1WidthMm: input.sidelight1WidthMm,
    sidelight2Qty: input.numberOfSidelight2,
    sidelight2WidthMm: input.sidelight2WidthMm,
  });

  const openingHeightMm = computeOpeningHeight({
    soHeightMm,
    frameType: input.frameType,
    configuration: input.leafConfiguration,
    rules,
    fanlightQty: input.fanlightQty,
    fanlightHeightMm: input.fanlightHeightMm,
  });

  // Step 3: Compute frame thickness
  const frameThicknessMm = computeFrameThickness(
    input.wallThicknessMm,
    input.frameMaterial,
    rules
  );

  // Step 4: Compute extension lining dimensions
  const extensionVisibleWidthMm = computeExtensionVisible(
    input.wallThicknessMm,
    frameThicknessMm
  );

  const extensionActualWidthMm =
    extensionVisibleWidthMm == null ? null : extensionVisibleWidthMm + 10;

  // Step 5: Compute leaf height
  const leafHeightMm = computeLeafHeight({
    openingHeightMm,
    frameType: input.frameType,
    configuration: input.leafConfiguration,
    rules,
    doorUndercutMm: input.doorUndercutMm,
    liningThicknessHeadsMm: input.liningThicknessHeadsMm,
  });

  // Step 6: Compute slave leaf width
  const slaveLeafWidthMm = computeSlaveLeafWidth({
    configuration: input.leafConfiguration,
    openingWidthMm,
    frameType: input.frameType,
    rules,
    liningThicknessMm: input.liningThicknessJambsMm,
    masterLeafWidthMm: input.masterLeafWidthMm,
  });

  // Step 7: Compute leaf thickness (based on fire/acoustic ratings)
  const leafThicknessMm = computeLeafThickness({
    quantity: input.quantity,
    fireRating: input.fireRating,
    acousticRatingDb: input.acousticRatingDb,
  });

  // Step 8: Compute core dimensions
  const coreWidthResult = computeCoreWidth({
    quantity: input.quantity,
    coreType: input.coreType,
    masterLeafWidthMm: input.masterLeafWidthMm,
  });

  const coreHeightResult = computeCoreHeight({
    quantity: input.quantity,
    coreType: input.coreType,
    widthResult: coreWidthResult,
    leafHeightMm,
  });

  // Step 9: Compute lipping width
  const lippingWidthMm = computeLippingWidth({
    quantity: input.quantity,
    lippingMaterialSelected: input.lippingMaterialSelected,
    coreThicknessMm: input.coreThicknessMm,
    rules,
  });

  // Step 10: Compute leaf weights
  const leafWeightPerM2Kg = input.quantity > 0 ? normalizeNumber(input.leafWeightPerM2Kg) : null;
  const masterLeafWeightKg = computeLeafWeight(
    leafWeightPerM2Kg,
    input.masterLeafAreaM2
  );
  const slaveLeafWeightKg = computeLeafWeight(
    leafWeightPerM2Kg,
    input.slaveLeafAreaM2
  );

  // Determine overall core size status
  const coreSizeStatus = determineCoreSizeStatus(coreWidthResult, coreHeightResult);

  return {
    soWidthMm,
    soHeightMm,
    openingWidthMm,
    openingHeightMm,
    extensionVisibleWidthMm,
    extensionActualWidthMm,
    frameThicknessMm,
    leafHeightMm,
    masterLeafWidthMm: input.masterLeafWidthMm, // Echo back input
    slaveLeafWidthMm,
    leafThicknessMm,
    coreWidthMm: coreWidthResult.value,
    coreHeightMm: coreHeightResult.value,
    coreSizeStatus,
    lippingWidthMm,
    leafWeightPerM2Kg,
    masterLeafWeightKg,
    slaveLeafWeightKg,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compute O/F Width (doorset opening width).
 * 
 * Excel logic:
 * IF LEN(S/O Width) > 0 THEN
 *   O/F width = S/O width
 *               - S/O offset width
 *               - (Number of Sidelight 1 * Sidelight 1 Width
 *                  + Number of Sidelight 2 * Sidelight 2 Width)
 * ELSE ""
 */
export function computeOpeningWidth(params: {
  soWidthMm: number | null;
  frameType: string | null;
  configuration: LeafConfiguration;
  rules: DimensionRules;
  sidelight1Qty: number;
  sidelight1WidthMm: number | null;
  sidelight2Qty: number;
  sidelight2WidthMm: number | null;
}): number | null {
  const { soWidthMm, frameType, configuration, rules } = params;
  if (soWidthMm == null) return null;
  
  const offset = rules.getSoOffsetWidth(frameType, configuration) ?? 0;
  const sidelightContribution = 
    safeMultiply(params.sidelight1Qty, params.sidelight1WidthMm) +
    safeMultiply(params.sidelight2Qty, params.sidelight2WidthMm);
  
  return soWidthMm - offset - sidelightContribution;
}

/**
 * Compute O/F Height (doorset opening height).
 * 
 * Excel logic:
 * IF LEN(S/O Height) > 0 THEN
 *   O/F height = S/O height
 *                - S/O offset height
 *                - (Fanlight / Overpanel Qty * Fanlight / Overpanel Height)
 * ELSE ""
 */
export function computeOpeningHeight(params: {
  soHeightMm: number | null;
  frameType: string | null;
  configuration: LeafConfiguration;
  rules: DimensionRules;
  fanlightQty: number;
  fanlightHeightMm: number | null;
}): number | null {
  const { soHeightMm, frameType, configuration, rules } = params;
  if (soHeightMm == null) return null;
  
  const offset = rules.getSoOffsetHeight(frameType, configuration) ?? 0;
  const fanlightContribution = safeMultiply(params.fanlightQty, params.fanlightHeightMm);
  
  return soHeightMm - offset - fanlightContribution;
}

/**
 * Compute Frame Thickness.
 * 
 * Excel logic:
 * - If Frame Material is one of timber materials → MIN(S/O Wall Thickness, 150)
 * - Else if Frame Material = "Engineered_Softwood" → MIN(S/O Wall Thickness, 235)
 * - Else → ""
 */
export function computeFrameThickness(
  wallThicknessMm: number | null,
  frameMaterial: string | null,
  rules: DimensionRules
): number | null {
  const wall = normalizeNumber(wallThicknessMm);
  if (wall == null || !frameMaterial) return null;
  
  const normalizedMaterial = frameMaterial.trim().toLowerCase();
  if (TIMBER_FRAME_MATERIALS.has(normalizedMaterial)) {
    return Math.min(wall, rules.maxFrameThicknessStdMm);
  }
  if (ENGINEERED_SOFTWOOD_ALIAS.has(normalizedMaterial)) {
    return Math.min(wall, rules.maxFrameThicknessEngineeredMm);
  }
  return null;
}

/**
 * Compute Extension Lining Width (Visible size).
 * 
 * Excel logic:
 * IF S/O Wall Thickness = Frame Thickness THEN ""
 * ELSE (S/O Wall Thickness - Frame Thickness)
 */
function computeExtensionVisible(
  wallThicknessMm: number | null,
  frameThicknessMm: number | null
): number | null {
  const wall = normalizeNumber(wallThicknessMm);
  const frame = normalizeNumber(frameThicknessMm);
  if (wall == null || frame == null) return null;
  
  const diff = wall - frame;
  return Math.abs(diff) < 0.0001 ? null : diff;
}

/**
 * Compute Leaf Height.
 * 
 * Excel logic:
 * IF LEN(O/F Height) > 0 THEN
 *   Leaf height = O/F height
 *                 - Total Gap Height (lookup by frameType + config)
 *                 - Door Undercut
 *                 - Lining Thickness - Heads
 * ELSE ""
 */
export function computeLeafHeight(params: {
  openingHeightMm: number | null;
  frameType: string | null;
  configuration: LeafConfiguration;
  rules: DimensionRules;
  doorUndercutMm: number | null;
  liningThicknessHeadsMm: number | null;
}): number | null {
  const { openingHeightMm, frameType, configuration, rules } = params;
  if (openingHeightMm == null) return null;
  
  const totalGapHeight = rules.getTotalGapHeight(frameType, configuration) ?? 0;
  const doorUndercut = normalizeNumber(params.doorUndercutMm) ?? 0;
  const liningThicknessHeads = normalizeNumber(params.liningThicknessHeadsMm) ?? 0;
  
  return openingHeightMm - totalGapHeight - doorUndercut - liningThicknessHeads;
}

/**
 * Compute S Leaf Width (slave leaf width).
 * 
 * Excel logic:
 * IF Leaf Configuration = "Leaf Only" → null (user input)
 * ELSE IF Leaf Configuration = "Single" → 0 (no slave leaf)
 * ELSE IF Leaf Configuration = "Leaf & a Half"
 *   → S Leaf Width = openingWidth - Total Gap Width - 2 * Lining Thickness - Master Leaf Width
 * ELSE IF Leaf Configuration = "Double"
 *   → S Leaf Width = (openingWidth - Total Gap Width - 2 * Lining Thickness) / 2
 * ELSE → ""
 */
export function computeSlaveLeafWidth(params: {
  configuration: LeafConfiguration;
  openingWidthMm: number | null;
  frameType: string | null;
  rules: DimensionRules;
  liningThicknessMm: number | null;
  masterLeafWidthMm: number | null;
}): number | null {
  const { configuration } = params;
  if (configuration === "Leaf Only") return null;
  if (configuration === "Single") return 0;

  const openingWidth = normalizeNumber(params.openingWidthMm);
  const liningThickness = normalizeNumber(params.liningThicknessMm);
  if (openingWidth == null || liningThickness == null) return null;
  
  const totalGapWidth = params.rules.getTotalGapWidth(params.frameType, configuration) ?? 0;

  if (configuration === "Leaf & a Half") {
    const masterWidth = normalizeNumber(params.masterLeafWidthMm);
    if (masterWidth == null) return null;
    return openingWidth - totalGapWidth - 2 * liningThickness - masterWidth;
  }

  if (configuration === "Double") {
    return (openingWidth - totalGapWidth - 2 * liningThickness) / 2;
  }

  return null;
}

/**
 * Compute Leaf Thickness.
 * 
 * Excel logic:
 * IF Quantity = 0 → ""
 * ELSE
 *   IF FireRating in { "FD90","FD120","FD90S","FD120S" } → 60
 *   ELSE IF FireRating in { "FD60","FD60S" } OR AcousticRating > 33 → 54
 *   ELSE → 44
 */
export function computeLeafThickness(params: {
  quantity: number;
  fireRating: string | null;
  acousticRatingDb: number | null;
}): number | null {
  if (params.quantity <= 0) return null;
  
  const fire = params.fireRating?.trim().toLowerCase() ?? "";
  if (FIRE_RATINGS_60MM.has(fire)) return 60;
  if (FIRE_RATINGS_54MM.has(fire) || (params.acousticRatingDb ?? 0) > 33) return 54;
  return 44;
}

/**
 * Compute Core Width.
 * 
 * Excel logic:
 * IF quantity > 0 AND coreType exists THEN
 *   IF master leaf width > 1220 → "CHECK PRICE"
 *   ELSE IF master leaf width > 930 → 1220
 *   ELSE IF master leaf width > 0 → 915
 *   ELSE ""
 * ELSE ""
 */
export function computeCoreWidth(params: {
  quantity: number;
  coreType: string | null;
  masterLeafWidthMm: number | null;
}): CoreSizingResult {
  if (params.quantity <= 0) return { value: null, status: "NONE" };
  if (!params.coreType) return { value: null, status: "NOT_APPLICABLE" };

  const masterWidth = normalizeNumber(params.masterLeafWidthMm);
  if (masterWidth == null || masterWidth <= 0) {
    return { value: null, status: "NONE" };
  }

  if (masterWidth > 1220) {
    return { value: null, status: "CHECK_PRICE" };
  }
  if (masterWidth > 930) {
    return { value: 1220, status: "OK" };
  }
  if (masterWidth > 0) {
    return { value: 915, status: "OK" };
  }
  return { value: null, status: "NONE" };
}

/**
 * Compute Core Height.
 * 
 * Excel logic:
 * IF quantity > 0 AND coreWidth not "N/A" THEN
 *   IF leaf height > 2440 → "CHECK PRICE"
 *   ELSE IF coreWidth = 1220 → 2440
 *   ELSE IF leaf height > 2140 → 2440
 *   ELSE IF leaf height > 1 → 2135
 *   ELSE ""
 * ELSE ""
 */
export function computeCoreHeight(params: {
  quantity: number;
  coreType: string | null;
  widthResult: CoreSizingResult;
  leafHeightMm: number | null;
}): CoreSizingResult {
  if (params.quantity <= 0) return { value: null, status: "NONE" };
  if (!params.coreType) return { value: null, status: "NOT_APPLICABLE" };

  if (params.widthResult.status === "NOT_APPLICABLE") {
    return { value: null, status: "NOT_APPLICABLE" };
  }
  if (params.widthResult.status === "CHECK_PRICE") {
    return { value: null, status: "CHECK_PRICE" };
  }

  const height = normalizeNumber(params.leafHeightMm);
  if (height == null || height <= 0) {
    return { value: null, status: "NONE" };
  }
  if (height > 2440) {
    return { value: null, status: "CHECK_PRICE" };
  }

  if (params.widthResult.value === 1220) {
    return { value: 2440, status: "OK" };
  }
  if (height > 2140) {
    return { value: 2440, status: "OK" };
  }
  if (height > 1) {
    return { value: 2135, status: "OK" };
  }
  return { value: null, status: "NONE" };
}

/**
 * Compute Lipping Width.
 * 
 * Excel logic:
 * IF quantity > 0 THEN
 *   IF Lipping Material 2 = 0 → lipping width = 0
 *   ELSE IF Core Thickness2 = 54 → 58mm
 *   ELSE → 48mm
 * ELSE ""
 */
export function computeLippingWidth(params: {
  quantity: number;
  lippingMaterialSelected: boolean;
  coreThicknessMm: number | null;
  rules: DimensionRules;
}): number | null {
  if (params.quantity <= 0) return null;
  if (!params.lippingMaterialSelected) return 0;
  
  return normalizeNumber(params.coreThicknessMm) === 54 
    ? params.rules.lippingExtraWidthFor54CoreMm 
    : params.rules.lippingDefaultWidthMm;
}

/**
 * Compute Leaf Weight.
 * 
 * Excel logic:
 * Master Leaf Weight = leafWeightPerM2Kg * Master Leaf Area
 * Slave Leaf Weight  = leafWeightPerM2Kg * Slave Leaf Area
 */
function computeLeafWeight(
  leafWeightPerM2Kg: number | null,
  leafAreaM2: number | null
): number | null {
  const density = normalizeNumber(leafWeightPerM2Kg);
  const area = normalizeNumber(leafAreaM2);
  if (density == null || area == null) return null;
  return density * area;
}

/**
 * Determine overall core size status from width and height results.
 */
function determineCoreSizeStatus(
  widthResult: CoreSizingResult,
  heightResult: CoreSizingResult
): CoreSizeStatus {
  // If either needs price check, overall status is CHECK_PRICE
  if (widthResult.status === "CHECK_PRICE" || heightResult.status === "CHECK_PRICE") {
    return "CHECK_PRICE";
  }
  // If both are not applicable, overall is NOT_APPLICABLE
  if (widthResult.status === "NOT_APPLICABLE" && heightResult.status === "NOT_APPLICABLE") {
    return "NOT_APPLICABLE";
  }
  // If either is not applicable (but not both), still NOT_APPLICABLE
  if (widthResult.status === "NOT_APPLICABLE" || heightResult.status === "NOT_APPLICABLE") {
    return "NOT_APPLICABLE";
  }
  // If both are OK, overall is OK
  if (widthResult.status === "OK" && heightResult.status === "OK") {
    return "OK";
  }
  // Otherwise NONE
  return "NONE";
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely multiply quantity * measurement, treating null/undefined as 0.
 */
function safeMultiply(
  quantity: number | null | undefined, 
  measurement: number | null | undefined
): number {
  const qty = typeof quantity === "number" && Number.isFinite(quantity) ? quantity : 0;
  const size = typeof measurement === "number" && Number.isFinite(measurement) ? measurement : 0;
  return qty * size;
}

/**
 * Normalize a number value, returning null for null/undefined/NaN.
 */
function normalizeNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
}
