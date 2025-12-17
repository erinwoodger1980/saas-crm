/**
 * Lipping calculation utilities
 * 
 * These functions integrate the lipping lookup table with door manufacturing,
 * configurator, and material cost calculations.
 */

export interface LippingSpec {
  doorsetType: string;
  topMm: number | null;
  bottomMm: number | null;
  hingeMm: number | null;
  lockMm: number | null;
  safeHingeMm: number | null;
  daExposedMm: number | null;
  trimMm: number | null;
  postformedMm: number | null;
  extrasMm: number | null;
  commentsForNotes: string | null;
}

export interface DoorDimensions {
  widthMm: number;
  heightMm: number;
  quantity?: number;
}

export interface LippingMaterialRequirements {
  // Linear meters required per edge
  topLinearMeters: number | null;
  bottomLinearMeters: number | null;
  hingeLinearMeters: number | null;
  lockLinearMeters: number | null;
  safeHingeLinearMeters: number | null;
  daExposedLinearMeters: number | null;
  
  // Thickness (mm) per edge
  topThicknessMm: number | null;
  bottomThicknessMm: number | null;
  hingeThicknessMm: number | null;
  lockThicknessMm: number | null;
  safeHingeThicknessMm: number | null;
  daExposedThicknessMm: number | null;
  
  // Processing requirements
  trimMm: number | null;
  postformedMm: number | null;
  extrasMm: number | null;
  
  // Notes for production
  notes: string[];
  doorsetType: string;
  quantity: number;
}

/**
 * Calculate lipping material requirements for a door
 */
export function calculateLippingRequirements(
  lippingSpec: LippingSpec,
  dimensions: DoorDimensions
): LippingMaterialRequirements {
  const { widthMm, heightMm, quantity = 1 } = dimensions;
  
  // Convert dimensions to meters for linear calculations
  const widthM = widthMm / 1000;
  const heightM = heightMm / 1000;
  
  const notes: string[] = [];
  
  // Add specification notes
  if (lippingSpec.commentsForNotes) {
    notes.push(lippingSpec.commentsForNotes);
  }
  
  // Add dimension-based notes
  if (lippingSpec.postformedMm) {
    notes.push(`Postformed lipping: ${lippingSpec.postformedMm}mm`);
  }
  
  if (lippingSpec.extrasMm) {
    notes.push(`Extra lipping allowance: ${lippingSpec.extrasMm}mm`);
  }
  
  return {
    // Linear meters (total for all doors in quantity)
    topLinearMeters: lippingSpec.topMm ? widthM * quantity : null,
    bottomLinearMeters: lippingSpec.bottomMm ? widthM * quantity : null,
    hingeLinearMeters: lippingSpec.hingeMm ? heightM * quantity : null,
    lockLinearMeters: lippingSpec.lockMm ? heightM * quantity : null,
    safeHingeLinearMeters: lippingSpec.safeHingeMm ? heightM * quantity : null,
    daExposedLinearMeters: lippingSpec.daExposedMm ? heightM * quantity : null,
    
    // Thickness specifications (mm)
    topThicknessMm: lippingSpec.topMm,
    bottomThicknessMm: lippingSpec.bottomMm,
    hingeThicknessMm: lippingSpec.hingeMm,
    lockThicknessMm: lippingSpec.lockMm,
    safeHingeThicknessMm: lippingSpec.safeHingeMm,
    daExposedThicknessMm: lippingSpec.daExposedMm,
    
    // Processing specs
    trimMm: lippingSpec.trimMm,
    postformedMm: lippingSpec.postformedMm,
    extrasMm: lippingSpec.extrasMm,
    
    notes,
    doorsetType: lippingSpec.doorsetType,
    quantity
  };
}

/**
 * Calculate total lipping cost based on material price per linear meter
 */
export function calculateLippingCost(
  requirements: LippingMaterialRequirements,
  pricePerLinearMeter: { [thicknessMm: number]: number }
): {
  topCost: number;
  bottomCost: number;
  hingeCost: number;
  lockCost: number;
  safeHingeCost: number;
  daExposedCost: number;
  totalCost: number;
  breakdown: Array<{ edge: string; meters: number; thickness: number; unitPrice: number; cost: number }>;
} {
  const breakdown: Array<{ edge: string; meters: number; thickness: number; unitPrice: number; cost: number }> = [];
  
  const calculateEdgeCost = (
    edge: string,
    linearMeters: number | null,
    thicknessMm: number | null
  ): number => {
    if (!linearMeters || !thicknessMm) return 0;
    
    const unitPrice = pricePerLinearMeter[thicknessMm] || 0;
    const cost = linearMeters * unitPrice;
    
    if (cost > 0) {
      breakdown.push({ edge, meters: linearMeters, thickness: thicknessMm, unitPrice, cost });
    }
    
    return cost;
  };
  
  const topCost = calculateEdgeCost('Top', requirements.topLinearMeters, requirements.topThicknessMm);
  const bottomCost = calculateEdgeCost('Bottom', requirements.bottomLinearMeters, requirements.bottomThicknessMm);
  const hingeCost = calculateEdgeCost('Hinge', requirements.hingeLinearMeters, requirements.hingeThicknessMm);
  const lockCost = calculateEdgeCost('Lock', requirements.lockLinearMeters, requirements.lockThicknessMm);
  const safeHingeCost = calculateEdgeCost('Safe Hinge', requirements.safeHingeLinearMeters, requirements.safeHingeThicknessMm);
  const daExposedCost = calculateEdgeCost('D/A Exposed', requirements.daExposedLinearMeters, requirements.daExposedThicknessMm);
  
  const totalCost = topCost + bottomCost + hingeCost + lockCost + safeHingeCost + daExposedCost;
  
  return {
    topCost,
    bottomCost,
    hingeCost,
    lockCost,
    safeHingeCost,
    daExposedCost,
    totalCost,
    breakdown
  };
}

/**
 * Generate a human-readable summary of lipping requirements
 */
export function generateLippingSummary(requirements: LippingMaterialRequirements): string {
  const lines: string[] = [];
  
  lines.push(`Doorset Type: ${requirements.doorsetType}`);
  lines.push(`Quantity: ${requirements.quantity}`);
  lines.push('');
  
  lines.push('Lipping Requirements:');
  
  const edges = [
    { name: 'Top', meters: requirements.topLinearMeters, thickness: requirements.topThicknessMm },
    { name: 'Bottom', meters: requirements.bottomLinearMeters, thickness: requirements.bottomThicknessMm },
    { name: 'Hinge', meters: requirements.hingeLinearMeters, thickness: requirements.hingeThicknessMm },
    { name: 'Lock', meters: requirements.lockLinearMeters, thickness: requirements.lockThicknessMm },
    { name: 'Safe Hinge', meters: requirements.safeHingeLinearMeters, thickness: requirements.safeHingeThicknessMm },
    { name: 'D/A Exposed', meters: requirements.daExposedLinearMeters, thickness: requirements.daExposedThicknessMm }
  ];
  
  for (const edge of edges) {
    if (edge.meters && edge.thickness) {
      lines.push(`  ${edge.name}: ${edge.meters.toFixed(2)}m @ ${edge.thickness}mm`);
    }
  }
  
  if (requirements.trimMm) {
    lines.push(`  Trim: ${requirements.trimMm}mm`);
  }
  
  if (requirements.postformedMm) {
    lines.push(`  Postformed: ${requirements.postformedMm}mm`);
  }
  
  if (requirements.extrasMm) {
    lines.push(`  Extras: ${requirements.extrasMm}mm`);
  }
  
  if (requirements.notes.length > 0) {
    lines.push('');
    lines.push('Manufacturing Notes:');
    requirements.notes.forEach(note => lines.push(`  • ${note}`));
  }
  
  return lines.join('\n');
}

/**
 * Validate lipping specifications for completeness
 */
export function validateLippingSpec(spec: LippingSpec): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!spec.doorsetType || spec.doorsetType.trim() === '') {
    errors.push('Doorset type is required');
  }
  
  // Check if at least one edge has lipping specified
  const hasAnyLipping = [
    spec.topMm,
    spec.bottomMm,
    spec.hingeMm,
    spec.lockMm,
    spec.safeHingeMm,
    spec.daExposedMm
  ].some(val => val !== null && val > 0);
  
  if (!hasAnyLipping) {
    warnings.push('No lipping specifications found - at least one edge should have lipping');
  }
  
  // Validate reasonable ranges
  const checkRange = (value: number | null, name: string, min: number, max: number) => {
    if (value !== null && (value < min || value > max)) {
      warnings.push(`${name} (${value}mm) is outside typical range (${min}-${max}mm)`);
    }
  };
  
  checkRange(spec.topMm, 'Top', 0, 20);
  checkRange(spec.bottomMm, 'Bottom', 0, 20);
  checkRange(spec.hingeMm, 'Hinge', 0, 20);
  checkRange(spec.lockMm, 'Lock', 0, 20);
  checkRange(spec.safeHingeMm, 'Safe Hinge', 0, 20);
  checkRange(spec.daExposedMm, 'D/A Exposed', 0, 20);
  checkRange(spec.trimMm, 'Trim', 0, 10);
  checkRange(spec.postformedMm, 'Postformed', 0, 10);
  checkRange(spec.extrasMm, 'Extras', 0, 20);
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Common doorset type presets for quick selection
 */
export const COMMON_DOORSET_TYPES = [
  'STANDARD CONCEALED',
  'STANDARD EXPOSED',
  'D/A 44',
  'D/A 54',
  'SAFEHINGE 44',
  'SAFEHINGE 54',
  'POSTFORMED 44'
] as const;
