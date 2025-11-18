import type { ApertureRules } from "./apertures-and-glass";

/**
 * Sample implementation of ApertureRules using lookup tables.
 * 
 * This provides realistic default values for fire certification offsets
 * and glass sizing constraints based on typical door specifications.
 */

interface FireCertificationOffset {
  certificationKey: string;
  widthOffsetMm: number;
  heightOffsetMm: number;
}

/**
 * Fire Certification Check lookup table (Fire Certification Check!$AG$3:$AK$98).
 * 
 * Maps fire certification keys to production aperture offsets.
 * In Excel, this is column 5 of the VLOOKUP range.
 * 
 * These offsets account for fire-rated intumescent seals and other
 * certification-specific manufacturing tolerances.
 */
const FIRE_CERT_OFFSETS: FireCertificationOffset[] = [
  // Standard certifications
  { certificationKey: "FD30_QMARK", widthOffsetMm: 10, heightOffsetMm: 10 },
  { certificationKey: "FD60_QMARK", widthOffsetMm: 12, heightOffsetMm: 12 },
  { certificationKey: "FD90_QMARK", widthOffsetMm: 15, heightOffsetMm: 15 },
  { certificationKey: "FD120_QMARK", widthOffsetMm: 18, heightOffsetMm: 18 },
  
  // BWF Certifire certifications
  { certificationKey: "FD30_BWF", widthOffsetMm: 10, heightOffsetMm: 10 },
  { certificationKey: "FD60_BWF", widthOffsetMm: 12, heightOffsetMm: 12 },
  { certificationKey: "FD90_BWF", widthOffsetMm: 15, heightOffsetMm: 15 },
  
  // Acoustic certifications (typically no additional offset)
  { certificationKey: "RW29_STANDARD", widthOffsetMm: 0, heightOffsetMm: 0 },
  { certificationKey: "RW32_STANDARD", widthOffsetMm: 0, heightOffsetMm: 0 },
  { certificationKey: "RW35_STANDARD", widthOffsetMm: 0, heightOffsetMm: 0 },
  
  // Combined fire + acoustic
  { certificationKey: "FD30_RW29", widthOffsetMm: 10, heightOffsetMm: 10 },
  { certificationKey: "FD30_RW32", widthOffsetMm: 12, heightOffsetMm: 12 },
  { certificationKey: "FD60_RW32", widthOffsetMm: 15, heightOffsetMm: 15 },
  
  // Non-certified (standard tolerance)
  { certificationKey: "NONE", widthOffsetMm: 5, heightOffsetMm: 5 },
  { certificationKey: "STANDARD", widthOffsetMm: 5, heightOffsetMm: 5 },
];

/**
 * Sample implementation of ApertureRules with realistic defaults.
 */
export class SampleApertureRules implements ApertureRules {
  /**
   * Glass clearance per side: 4mm (typical for UK joinery).
   * This allows for thermal expansion and installation tolerances.
   */
  readonly glassClearancePerSideMm = 4;

  /**
   * Minimum glass height: 100mm (safety/structural minimum).
   */
  readonly minGlassHeightMm = 100;

  /**
   * Minimum glass width: 100mm (safety/structural minimum).
   */
  readonly minGlassWidthMm = 100;

  /**
   * Get production aperture offset based on fire certification key.
   * 
   * Matches Excel VLOOKUP:
   * ```
   * =VLOOKUP('Door Production'!CQ6, 'Fire Certification Check'!$AG$3:$AK$98, 5, FALSE)
   * ```
   * 
   * @param fireCertificationKey - The certification key from Door Production sheet
   * @returns Offset object with width/height adjustments, or null if not found
   */
  getApertureProductionOffsetMm(
    fireCertificationKey: string | null
  ): { widthOffsetMm: number; heightOffsetMm: number } | null {
    if (!fireCertificationKey) return null;

    const normalizedKey = fireCertificationKey.trim().toUpperCase();
    const found = FIRE_CERT_OFFSETS.find(
      (row) => row.certificationKey.toUpperCase() === normalizedKey
    );

    return found
      ? { widthOffsetMm: found.widthOffsetMm, heightOffsetMm: found.heightOffsetMm }
      : null;
  }
}

/**
 * Create a sample aperture rules instance with default values.
 * Useful for testing and development.
 */
export function createSampleApertureRules(): ApertureRules {
  return new SampleApertureRules();
}

/**
 * Export the fire certification offsets table for reference/testing.
 */
export { FIRE_CERT_OFFSETS };
