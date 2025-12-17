/**
 * Lipping lookup integration for door configurator and pricing engine
 * 
 * This module provides hooks and utilities to integrate the lipping lookup
 * table with the door configurator, material cost calculations, and quote generation.
 */

import { calculateLippingRequirements, calculateLippingCost, LippingSpec, DoorDimensions } from './lipping-calculations';

export interface ConfiguratorDoorSpec {
  doorsetType: string;
  width: number;
  height: number;
  quantity: number;
  // ... other configurator fields
}

export interface LippingPricingContext {
  lippingSpecs: LippingSpec[];
  materialPrices: {
    [thicknessMm: number]: number; // Price per linear meter by thickness
  };
}

/**
 * Fetch lipping specifications from API
 */
export async function fetchLippingSpecs(): Promise<LippingSpec[]> {
  const response = await fetch('/api/lipping-lookup', {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch lipping specifications');
  }

  return response.json();
}

/**
 * Fetch a specific lipping spec by doorset type
 */
export async function fetchLippingSpecByType(doorsetType: string): Promise<LippingSpec | null> {
  const response = await fetch(`/api/lipping-lookup/type/${encodeURIComponent(doorsetType)}`, {
    credentials: 'include'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch lipping specification');
  }

  return response.json();
}

/**
 * Calculate lipping cost for a door configuration
 * This is the main integration point for the configurator
 */
export async function calculateDoorLippingCost(
  doorSpec: ConfiguratorDoorSpec,
  pricingContext?: LippingPricingContext
): Promise<{
  totalCost: number;
  breakdown: Array<{ edge: string; meters: number; thickness: number; unitPrice: number; cost: number }>;
  requirements: any;
  notes: string[];
}> {
  // Fetch lipping spec if not in context
  let lippingSpec: LippingSpec | null = null;
  
  if (pricingContext?.lippingSpecs) {
    lippingSpec = pricingContext.lippingSpecs.find(
      spec => spec.doorsetType === doorSpec.doorsetType
    ) || null;
  }
  
  if (!lippingSpec) {
    lippingSpec = await fetchLippingSpecByType(doorSpec.doorsetType);
  }
  
  if (!lippingSpec) {
    return {
      totalCost: 0,
      breakdown: [],
      requirements: null,
      notes: [`No lipping specification found for doorset type: ${doorSpec.doorsetType}`]
    };
  }
  
  // Calculate requirements
  const dimensions: DoorDimensions = {
    widthMm: doorSpec.width,
    heightMm: doorSpec.height,
    quantity: doorSpec.quantity
  };
  
  const requirements = calculateLippingRequirements(lippingSpec, dimensions);
  
  // Get default pricing if not provided
  const materialPrices = pricingContext?.materialPrices || getDefaultLippingPrices();
  
  // Calculate cost
  const costBreakdown = calculateLippingCost(requirements, materialPrices);
  
  return {
    totalCost: costBreakdown.totalCost,
    breakdown: costBreakdown.breakdown,
    requirements,
    notes: requirements.notes
  };
}

/**
 * Default lipping prices (£ per linear meter by thickness)
 * These should be overridden by actual material costs from the database
 */
function getDefaultLippingPrices(): { [thicknessMm: number]: number } {
  return {
    0: 0,
    2: 1.50,
    4: 2.00,
    5: 2.50,
    6: 3.00,
    7: 3.50,
    8: 4.00,
    10: 5.00,
    11: 5.50,
    12: 6.00
  };
}

/**
 * Batch calculate lipping costs for multiple doors
 * Useful for quote generation with multiple line items
 */
export async function batchCalculateLippingCosts(
  doorSpecs: ConfiguratorDoorSpec[]
): Promise<Array<{
  doorSpec: ConfiguratorDoorSpec;
  lippingCost: number;
  breakdown: any[];
  notes: string[];
}>> {
  // Fetch all lipping specs once
  const lippingSpecs = await fetchLippingSpecs();
  const materialPrices = getDefaultLippingPrices(); // TODO: Fetch from material costs table
  
  const pricingContext: LippingPricingContext = {
    lippingSpecs,
    materialPrices
  };
  
  // Calculate for each door
  const results = await Promise.all(
    doorSpecs.map(async (doorSpec) => {
      const result = await calculateDoorLippingCost(doorSpec, pricingContext);
      return {
        doorSpec,
        lippingCost: result.totalCost,
        breakdown: result.breakdown,
        notes: result.notes
      };
    })
  );
  
  return results;
}

/**
 * Add lipping costs to a quote line item
 * This enriches quote data with lipping calculations
 */
export function enrichQuoteLineItemWithLipping(
  lineItem: any,
  lippingCalculation: {
    totalCost: number;
    breakdown: any[];
    notes: string[];
  }
): any {
  return {
    ...lineItem,
    lipping: {
      cost: lippingCalculation.totalCost,
      breakdown: lippingCalculation.breakdown,
      notes: lippingCalculation.notes
    },
    // Add lipping cost to total
    subtotal: (lineItem.subtotal || 0) + lippingCalculation.totalCost
  };
}

/**
 * Integration hook for material cost system
 * Calculates lipping requirements for material ordering
 */
export async function calculateLippingMaterialOrder(
  doorSpecs: ConfiguratorDoorSpec[]
): Promise<{
  byThickness: { [thicknessMm: number]: number }; // Total linear meters by thickness
  totalLinearMeters: number;
  doorsetTypes: string[];
  specialRequirements: string[];
}> {
  const lippingSpecs = await fetchLippingSpecs();
  
  const byThickness: { [thicknessMm: number]: number } = {};
  const doorsetTypesSet = new Set<string>();
  const specialRequirementsSet = new Set<string>();
  
  for (const doorSpec of doorSpecs) {
    const lippingSpec = lippingSpecs.find(spec => spec.doorsetType === doorSpec.doorsetType);
    
    if (!lippingSpec) continue;
    
    doorsetTypesSet.add(doorSpec.doorsetType);
    
    const dimensions: DoorDimensions = {
      widthMm: doorSpec.width,
      heightMm: doorSpec.height,
      quantity: doorSpec.quantity
    };
    
    const requirements = calculateLippingRequirements(lippingSpec, dimensions);
    
    // Accumulate by thickness
    const addToThickness = (thickness: number | null, meters: number | null) => {
      if (thickness && meters) {
        byThickness[thickness] = (byThickness[thickness] || 0) + meters;
      }
    };
    
    addToThickness(requirements.topThicknessMm, requirements.topLinearMeters);
    addToThickness(requirements.bottomThicknessMm, requirements.bottomLinearMeters);
    addToThickness(requirements.hingeThicknessMm, requirements.hingeLinearMeters);
    addToThickness(requirements.lockThicknessMm, requirements.lockLinearMeters);
    addToThickness(requirements.safeHingeThicknessMm, requirements.safeHingeLinearMeters);
    addToThickness(requirements.daExposedThicknessMm, requirements.daExposedLinearMeters);
    
    // Collect special requirements
    requirements.notes.forEach(note => specialRequirementsSet.add(note));
  }
  
  const totalLinearMeters = Object.values(byThickness).reduce((sum, meters) => sum + meters, 0);
  
  return {
    byThickness,
    totalLinearMeters,
    doorsetTypes: Array.from(doorsetTypesSet),
    specialRequirements: Array.from(specialRequirementsSet)
  };
}

/**
 * React hook for configurator integration
 */
export function useLippingCalculator() {
  const [lippingSpecs, setLippingSpecs] = React.useState<LippingSpec[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    fetchLippingSpecs()
      .then(specs => {
        setLippingSpecs(specs);
        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);
  
  const calculateCost = React.useCallback(
    async (doorSpec: ConfiguratorDoorSpec) => {
      const pricingContext: LippingPricingContext = {
        lippingSpecs,
        materialPrices: getDefaultLippingPrices()
      };
      
      return calculateDoorLippingCost(doorSpec, pricingContext);
    },
    [lippingSpecs]
  );
  
  return {
    lippingSpecs,
    isLoading,
    error,
    calculateCost
  };
}

// Note: React import should be added when this file is used in React components
import * as React from 'react';
