/**
 * Aperture and Glass Calculation Module
 * 
 * Converts Excel "Cost Sheet" vision panel / glass logic into pure TypeScript.
 * 
 * This module handles:
 * - Vision panel aperture sizes (structural "see size" vs. production cut-out)
 * - Fire certification offsets for production apertures
 * - Glass cut sizes with clearances
 * - Glass area calculations for pricing
 * - Validation flags (glass type required, etc.)
 * 
 * @module apertures-and-glass
 */

import type { LeafConfiguration } from "./derived-dimensions";

/**
 * Extended input interface for aperture and glass calculations.
 * Reuses core dimensions from DoorCostingInput and adds vision panel specifics.
 */
export interface DoorCostingInput {
  // Frame / leaf basics (from derived-dimensions module)
  frameWidthMm: number | null;
  frameHeightMm: number | null;
  leafConfiguration: LeafConfiguration;
  numberOfLeaves: number;
  masterLeafWidthMm: number | null;
  slaveLeafWidthMm: number | null;
  leafHeightMm: number | null; // from calculateDerivedDimensions or UI

  // Fire / certification context (used for aperture production offsets)
  certificationScheme: string | null; // e.g. "Q Mark", etc.
  fireRating: string | null; // e.g. FD30, FD60, etc.
  acousticRatingDb: number | null;
  fireCertificationKey: string | null; // drives 'Door Production'!CQ6 lookup

  // Vision panel quantities (from Import sheet via HLOOKUP)
  visionPanelQtyLeaf1: number; // "Vision Panel Qty, Leaf 1"
  visionPanelQtyLeaf2: number; // "Vision Panel Qty, Leaf 2"

  // Leaf 1 aperture sizes - "See Size Detail" (structural aperture)
  leaf1Aperture1WidthSeeDetailMm: number | null;
  leaf1Aperture1HeightSeeDetailMm: number | null;
  leaf1Aperture2WidthSeeDetailMm: number | null;
  leaf1Aperture2HeightSeeDetailMm: number | null;

  // Leaf 2 "See Size Detail" - defaults to Leaf 1 if undefined + VP qty > 0
  leaf2Aperture1WidthSeeDetailMm?: number | null;
  leaf2Aperture1HeightSeeDetailMm?: number | null;
  leaf2Aperture2WidthSeeDetailMm?: number | null;
  leaf2Aperture2HeightSeeDetailMm?: number | null;

  // Glass choice (resolved elsewhere, e.g. via Glass Type VLOOKUP)
  glassType: string | null;
}

/**
 * Rules interface for aperture production offsets and glass constraints.
 * 
 * Provides lookup methods for fire certification offsets and glass sizing limits.
 */
export interface ApertureRules {
  /**
   * Get production aperture offset based on fire certification key.
   * 
   * In Excel: VLOOKUP('Door Production'!CQ6, 'Fire Certification Check'!$AG$3:$AK$98, 5, FALSE)
   * 
   * @param fireCertificationKey - The certification key from Door Production sheet
   * @returns Offset object with width/height adjustments, or null if not found
   */
  getApertureProductionOffsetMm(
    fireCertificationKey: string | null
  ): { widthOffsetMm: number; heightOffsetMm: number } | null;

  /**
   * Glass clearance per side (how much smaller glass should be than aperture).
   * Typical value: 3-5mm per side.
   */
  glassClearancePerSideMm: number;

  /**
   * Minimum glass dimensions for safety/practical limits.
   */
  minGlassHeightMm: number;
  minGlassWidthMm: number;
}

/**
 * Result of aperture and glass calculations.
 * 
 * Contains production aperture sizes, glass cut dimensions, areas, and validation flags.
 */
export interface ApertureAndGlassResult {
  // Leaf 1 - production aperture sizes (after fire-cert offsets)
  leaf1Aperture1WidthProductionMm: number | null;
  leaf1Aperture1HeightProductionMm: number | null;
  leaf1Aperture2WidthProductionMm: number | null;
  leaf1Aperture2HeightProductionMm: number | null;

  // Leaf 2 - production aperture sizes (cut out dimensions)
  leaf2Aperture1WidthProductionMm: number | null;
  leaf2Aperture1HeightProductionMm: number | null;
  leaf2Aperture2WidthProductionMm: number | null;
  leaf2Aperture2HeightProductionMm: number | null;

  // Glass cut sizes (per panel - uniform per leaf)
  leaf1GlassCutWidthMm: number | null;
  leaf1GlassCutHeightMm: number | null;
  leaf2GlassCutWidthMm: number | null;
  leaf2GlassCutHeightMm: number | null;

  // Glass areas for pricing
  leaf1GlassAreaPerPanelM2: number | null;
  leaf2GlassAreaPerPanelM2: number | null;
  totalGlassAreaM2: number | null;

  // Status / validation flags
  visionPanelSizeDetail: string | null; // "Cut_Out" when VP + glass type present
  tempGlassCheckMessage: string | null; // "Glass Type Required" when VP but no glass
}

/**
 * Normalize a number input, returning null for invalid values.
 */
function normalizeNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Compute production aperture size from see-size + fire certification offset.
 * 
 * Excel formula:
 * ```
 * =IFERROR(
 *   VLOOKUP('Door Production'!CQ6, 'Fire Certification Check'!$AG$3:$AK$98, 5, FALSE)
 *   + [Leaf Aperture Width/Height (See Size Detail)],
 *   ""
 * )
 * ```
 * 
 * @param seeSizeMm - Structural aperture size from "See Size Detail"
 * @param offsetMm - Production offset from fire certification lookup
 * @returns Production aperture size, or null if see-size missing
 */
function computeProductionAperture(
  seeSizeMm: number | null,
  offsetMm: number
): number | null {
  const seeSize = normalizeNumber(seeSizeMm);
  if (seeSize === null) return null;
  return seeSize + offsetMm;
}

/**
 * Compute glass cut size from production aperture with clearances.
 * 
 * Glass must be smaller than the aperture by clearance amount on each side.
 * Enforces minimum glass dimensions for safety.
 * 
 * @param productionMm - Production aperture dimension
 * @param clearancePerSideMm - Clearance per side (typically 3-5mm)
 * @param minGlassMm - Minimum allowed glass dimension
 * @returns Glass cut size, or null if production aperture missing
 */
function computeGlassCutSize(
  productionMm: number | null,
  clearancePerSideMm: number,
  minGlassMm: number
): number | null {
  const production = normalizeNumber(productionMm);
  if (production === null) return null;

  // Glass is aperture minus clearance on both sides
  const glassSizeRaw = production - 2 * clearancePerSideMm;
  
  // Enforce minimum for safety/practicality
  return Math.max(minGlassMm, glassSizeRaw);
}

/**
 * Compute glass area in square meters from width and height in millimeters.
 * 
 * @param widthMm - Glass width in millimeters
 * @param heightMm - Glass height in millimeters
 * @returns Area in square meters, rounded to 3 decimal places, or null if dimensions missing
 */
function computeGlassArea(
  widthMm: number | null,
  heightMm: number | null
): number | null {
  const width = normalizeNumber(widthMm);
  const height = normalizeNumber(heightMm);
  if (width === null || height === null) return null;

  const widthM = width / 1000;
  const heightM = height / 1000;
  const areaM2 = widthM * heightM;

  return Math.round(areaM2 * 1000) / 1000; // 3 decimal places
}

/**
 * Calculate apertures and glass dimensions for vision panels.
 * 
 * This is the main function that orchestrates all aperture and glass calculations
 * based on the Excel "Cost Sheet" logic.
 * 
 * Process:
 * 1. Get fire certification production offsets
 * 2. Compute Leaf 1 production apertures (see-size + offset)
 * 3. Default Leaf 2 see-sizes to Leaf 1 if needed
 * 4. Compute Leaf 2 production apertures
 * 5. Calculate glass cut sizes (production - clearances)
 * 6. Calculate glass areas and totals
 * 7. Set validation flags (Cut_Out, Glass Type Required)
 * 
 * @param input - Door specification with vision panel details
 * @param rules - Aperture rules for offsets and glass constraints
 * @returns Complete aperture and glass calculation results
 */
export function calculateAperturesAndGlass(
  input: DoorCostingInput,
  rules: ApertureRules
): ApertureAndGlassResult {
  // Get fire certification production offset
  const offset = rules.getApertureProductionOffsetMm(input.fireCertificationKey);
  const widthOffsetMm = offset?.widthOffsetMm ?? 0;
  const heightOffsetMm = offset?.heightOffsetMm ?? 0;

  const hasLeaf1VP = input.visionPanelQtyLeaf1 > 0;
  const hasLeaf2VP = input.visionPanelQtyLeaf2 > 0;

  // ========================================================================
  // LEAF 1 - Production Apertures
  // ========================================================================
  // Excel: Leaf 1 Aperture 1 Width (Production) = 
  //   VLOOKUP offset + Leaf 1 Aperture 1 Width (See Size Detail)
  const leaf1Aperture1WidthProductionMm = hasLeaf1VP
    ? computeProductionAperture(input.leaf1Aperture1WidthSeeDetailMm, widthOffsetMm)
    : null;

  const leaf1Aperture1HeightProductionMm = hasLeaf1VP
    ? computeProductionAperture(input.leaf1Aperture1HeightSeeDetailMm, heightOffsetMm)
    : null;

  // Aperture 2 (if present)
  const leaf1Aperture2WidthProductionMm = hasLeaf1VP
    ? computeProductionAperture(input.leaf1Aperture2WidthSeeDetailMm, widthOffsetMm)
    : null;

  const leaf1Aperture2HeightProductionMm = hasLeaf1VP
    ? computeProductionAperture(input.leaf1Aperture2HeightSeeDetailMm, heightOffsetMm)
    : null;

  // ========================================================================
  // LEAF 2 - See Size Detail & Production Apertures
  // ========================================================================
  // Excel: IF(LEN([Vision Panel Qty, Leaf 2])>0, [Leaf 1 See Size], "")
  // i.e., Leaf 2 defaults to same aperture size as Leaf 1 when it has VP
  let leaf2Ap1WidthSee = input.leaf2Aperture1WidthSeeDetailMm;
  let leaf2Ap1HeightSee = input.leaf2Aperture1HeightSeeDetailMm;
  let leaf2Ap2WidthSee = input.leaf2Aperture2WidthSeeDetailMm;
  let leaf2Ap2HeightSee = input.leaf2Aperture2HeightSeeDetailMm;

  if (hasLeaf2VP) {
    // Default to Leaf 1 dimensions if not explicitly provided
    if (leaf2Ap1WidthSee == null) {
      leaf2Ap1WidthSee = input.leaf1Aperture1WidthSeeDetailMm;
    }
    if (leaf2Ap1HeightSee == null) {
      leaf2Ap1HeightSee = input.leaf1Aperture1HeightSeeDetailMm;
    }
    if (leaf2Ap2WidthSee == null) {
      leaf2Ap2WidthSee = input.leaf1Aperture2WidthSeeDetailMm;
    }
    if (leaf2Ap2HeightSee == null) {
      leaf2Ap2HeightSee = input.leaf1Aperture2HeightSeeDetailMm;
    }
  }

  // Compute production apertures with same offset logic
  const leaf2Aperture1WidthProductionMm = hasLeaf2VP
    ? computeProductionAperture(leaf2Ap1WidthSee, widthOffsetMm)
    : null;

  const leaf2Aperture1HeightProductionMm = hasLeaf2VP
    ? computeProductionAperture(leaf2Ap1HeightSee, heightOffsetMm)
    : null;

  const leaf2Aperture2WidthProductionMm = hasLeaf2VP
    ? computeProductionAperture(leaf2Ap2WidthSee, widthOffsetMm)
    : null;

  const leaf2Aperture2HeightProductionMm = hasLeaf2VP
    ? computeProductionAperture(leaf2Ap2HeightSee, heightOffsetMm)
    : null;

  // ========================================================================
  // GLASS CUT SIZES
  // ========================================================================
  // Glass is smaller than production aperture by clearance on each side
  // For simplicity, assume Aperture 1 dimensions are used for glass sizing
  // (Excel doesn't explicitly show separate glass cuts for Aperture 2)
  
  const leaf1GlassCutWidthMm = hasLeaf1VP
    ? computeGlassCutSize(
        leaf1Aperture1WidthProductionMm,
        rules.glassClearancePerSideMm,
        rules.minGlassWidthMm
      )
    : null;

  const leaf1GlassCutHeightMm = hasLeaf1VP
    ? computeGlassCutSize(
        leaf1Aperture1HeightProductionMm,
        rules.glassClearancePerSideMm,
        rules.minGlassHeightMm
      )
    : null;

  const leaf2GlassCutWidthMm = hasLeaf2VP
    ? computeGlassCutSize(
        leaf2Aperture1WidthProductionMm,
        rules.glassClearancePerSideMm,
        rules.minGlassWidthMm
      )
    : null;

  const leaf2GlassCutHeightMm = hasLeaf2VP
    ? computeGlassCutSize(
        leaf2Aperture1HeightProductionMm,
        rules.glassClearancePerSideMm,
        rules.minGlassHeightMm
      )
    : null;

  // ========================================================================
  // GLASS AREAS
  // ========================================================================
  const leaf1GlassAreaPerPanelM2 = hasLeaf1VP
    ? computeGlassArea(leaf1GlassCutWidthMm, leaf1GlassCutHeightMm)
    : null;

  const leaf2GlassAreaPerPanelM2 = hasLeaf2VP
    ? computeGlassArea(leaf2GlassCutWidthMm, leaf2GlassCutHeightMm)
    : null;

  // Total glass area = (area per panel * quantity) for both leaves
  let totalGlassAreaM2: number | null = null;
  if (leaf1GlassAreaPerPanelM2 !== null || leaf2GlassAreaPerPanelM2 !== null) {
    totalGlassAreaM2 = 0;
    if (leaf1GlassAreaPerPanelM2 !== null) {
      totalGlassAreaM2 += leaf1GlassAreaPerPanelM2 * input.visionPanelQtyLeaf1;
    }
    if (leaf2GlassAreaPerPanelM2 !== null) {
      totalGlassAreaM2 += leaf2GlassAreaPerPanelM2 * input.visionPanelQtyLeaf2;
    }
    totalGlassAreaM2 = Math.round(totalGlassAreaM2 * 1000) / 1000; // 3 decimal places
  }

  // ========================================================================
  // VALIDATION FLAGS
  // ========================================================================
  const totalVPQty = input.visionPanelQtyLeaf1 + input.visionPanelQtyLeaf2;
  const hasGlassType = input.glassType != null && input.glassType.trim() !== "";

  // Vision Panel Size Detail (EH)
  // Excel: =IF(LEN([Glass Type])>0,"Cut_Out","")
  const visionPanelSizeDetail = totalVPQty > 0 && hasGlassType ? "Cut_Out" : null;

  // Temp Glass Check (EI)
  // Excel: =IF(AND([Vision Panel Qty, Leaf 1] <> "", [Glass Type] = ""), "Glass Type Required", "")
  const tempGlassCheckMessage = totalVPQty > 0 && !hasGlassType ? "Glass Type Required" : null;

  return {
    // Leaf 1 production apertures
    leaf1Aperture1WidthProductionMm,
    leaf1Aperture1HeightProductionMm,
    leaf1Aperture2WidthProductionMm,
    leaf1Aperture2HeightProductionMm,

    // Leaf 2 production apertures
    leaf2Aperture1WidthProductionMm,
    leaf2Aperture1HeightProductionMm,
    leaf2Aperture2WidthProductionMm,
    leaf2Aperture2HeightProductionMm,

    // Glass cut sizes
    leaf1GlassCutWidthMm,
    leaf1GlassCutHeightMm,
    leaf2GlassCutWidthMm,
    leaf2GlassCutHeightMm,

    // Glass areas
    leaf1GlassAreaPerPanelM2,
    leaf2GlassAreaPerPanelM2,
    totalGlassAreaM2,

    // Validation
    visionPanelSizeDetail,
    tempGlassCheckMessage,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
// Main types are already exported via 'export interface' declarations above
// Additional alias for input type to avoid naming conflicts
export type { DoorCostingInput as ApertureDoorCostingInput };
