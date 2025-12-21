/**
 * Pricing Calculator
 * 
 * Generates pricing from BOM and cutlist
 * - Material costs (volume/area based)
 * - Hardware costs (unit prices)
 * - Finishing costs (area based)
 * - Labor costs (optional)
 * - Markup and tax
 */

import type {
  ResolvedProduct,
  BomLine,
  CutLine,
  PricingSummary,
} from '@/types/resolved-product';
import { generateBom } from './bom';
import { generateCutlist, calculateTotalLinearMeters, calculateTotalArea } from './cutlist';

export interface PricingOptions {
  materialCostPerM3?: Record<string, number>; // Material key → £/m³
  materialCostPerM2?: Record<string, number>; // Material key → £/m²
  materialCostPerM?: Record<string, number>; // Material key → £/m (for seals)
  hardwareCosts?: Record<string, number>; // SKU → unit price
  finishingCostPerM2?: number; // £/m² for painting/staining
  laborCostPerHour?: number;
  estimatedHours?: number;
  markupPercent?: number;
  taxPercent?: number;
  currency?: string;
}

const DEFAULT_MATERIAL_COSTS_M3: Record<string, number> = {
  'oak-natural': 2500,
  'accoya-natural': 3200,
  'sapele-natural': 2800,
  'pine-natural': 1200,
  'oak-veneered-ply': 180,
  'default': 1500,
};

const DEFAULT_MATERIAL_COSTS_M2: Record<string, number> = {
  'clear-glass': 85,
  'frosted-glass': 95,
  'stained-glass': 350,
  'tinted-glass': 110,
  'oak-veneered-ply': 45,
  'default': 80,
};

const DEFAULT_MATERIAL_COSTS_M: Record<string, number> = {
  'rubber-black': 8,
  'rubber-grey': 8,
  'default': 7,
};

const DEFAULT_HARDWARE_COSTS: Record<string, number> = {
  'WIN-AL-AV4-92': 285,
  'YALE-STD-001': 125,
  'HND-LVR-CHR-001': 45,
  'HNG-BUT-SS-100': 18,
};

/**
 * Generate pricing summary for a resolved product
 */
export function generatePricing(
  product: ResolvedProduct,
  options: PricingOptions = {}
): PricingSummary {
  const {
    materialCostPerM3 = DEFAULT_MATERIAL_COSTS_M3,
    materialCostPerM2 = DEFAULT_MATERIAL_COSTS_M2,
    materialCostPerM = DEFAULT_MATERIAL_COSTS_M,
    hardwareCosts = DEFAULT_HARDWARE_COSTS,
    finishingCostPerM2 = 25,
    laborCostPerHour = 45,
    estimatedHours = 0,
    markupPercent = 35,
    taxPercent = 20,
    currency = 'GBP',
  } = options;
  
  const breakdown: PricingSummary['breakdown'] = [];
  
  // Generate BOM if not already present
  const bom = product.bom.length > 0 ? product.bom : generateBom(product);
  
  // Calculate material costs
  let materialsCost = 0;
  
  for (const line of bom) {
    if (line.material === 'Hardware') continue;
    if (line.componentId === 'finishing') continue;
    
    let unitCost = 0;
    const materialKey = line.material;
    
    if (line.unit === 'm³') {
      unitCost = materialCostPerM3[materialKey] || materialCostPerM3['default'] || 0;
    } else if (line.unit === 'm²') {
      unitCost = materialCostPerM2[materialKey] || materialCostPerM2['default'] || 0;
    } else if (line.unit === 'm') {
      unitCost = materialCostPerM[materialKey] || materialCostPerM['default'] || 0;
    }
    
    const lineCost = unitCost * line.quantity;
    materialsCost += lineCost;
    
    breakdown.push({
      category: 'Materials',
      description: `${line.componentName} (${line.quantity.toFixed(2)} ${line.unit})`,
      amount: lineCost,
    });
  }
  
  // Calculate hardware costs
  let hardwareCost = 0;
  
  for (const line of bom) {
    if (line.material !== 'Hardware') continue;
    
    const unitCost = line.unitCost || hardwareCosts[line.sku || ''] || 0;
    const lineCost = unitCost * line.quantity;
    hardwareCost += lineCost;
    
    breakdown.push({
      category: 'Hardware',
      description: `${line.componentName} (${line.quantity} ea)`,
      amount: lineCost,
    });
  }
  
  // Calculate finishing costs
  let finishingCost = 0;
  
  const finishingLine = bom.find(line => line.componentId === 'finishing');
  if (finishingLine) {
    finishingCost = finishingLine.quantity * finishingCostPerM2;
    
    breakdown.push({
      category: 'Finishing',
      description: `Surface finishing (${finishingLine.quantity.toFixed(2)} m²)`,
      amount: finishingCost,
    });
  }
  
  // Calculate labor costs
  let laborCost = 0;
  
  if (estimatedHours > 0) {
    laborCost = estimatedHours * laborCostPerHour;
    
    breakdown.push({
      category: 'Labor',
      description: `Fabrication labor (${estimatedHours} hours @ £${laborCostPerHour}/hr)`,
      amount: laborCost,
    });
  }
  
  // Calculate subtotal
  const subtotal = materialsCost + hardwareCost + finishingCost + laborCost;
  
  // Apply markup
  const markupAmount = subtotal * (markupPercent / 100);
  
  if (markupPercent > 0) {
    breakdown.push({
      category: 'Markup',
      description: `Business markup (${markupPercent}%)`,
      amount: markupAmount,
    });
  }
  
  // Calculate pre-tax total
  const preTaxTotal = subtotal + markupAmount;
  
  // Apply tax
  const taxAmount = preTaxTotal * (taxPercent / 100);
  
  if (taxPercent > 0) {
    breakdown.push({
      category: 'Tax',
      description: `VAT (${taxPercent}%)`,
      amount: taxAmount,
    });
  }
  
  // Calculate final total
  const total = preTaxTotal + taxAmount;
  
  return {
    subtotal,
    materials: materialsCost,
    hardware: hardwareCost,
    finishing: finishingCost,
    labor: laborCost,
    markup: markupAmount,
    tax: taxAmount,
    total,
    currency,
    breakdown,
  };
}

/**
 * Format price as currency string
 */
export function formatPrice(amount: number, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Calculate estimated labor hours based on product complexity
 */
export function estimateLaborHours(product: ResolvedProduct): number {
  let hours = 0;
  
  // Base setup time
  hours += 0.5;
  
  // Profile cutting and machining
  const profileCount = product.instances.filter(i => i.kind === 'profileExtrusion').length;
  hours += profileCount * 0.3; // 18 minutes per profile piece
  
  // Panel cutting and edge work
  const panelCount = product.instances.filter(i => i.kind === 'panel').length;
  hours += panelCount * 0.4; // 24 minutes per panel
  
  // Glass installation
  const glassCount = product.instances.filter(i => i.kind === 'glass').length;
  hours += glassCount * 0.5; // 30 minutes per glass unit
  
  // Assembly (joinery, gluing, clamping)
  hours += 2.0;
  
  // Finishing (sanding, filling, painting/staining)
  const finishingLine = product.bom.find(line => line.componentId === 'finishing');
  if (finishingLine) {
    hours += finishingLine.quantity * 0.8; // 48 minutes per m² (multiple coats)
  }
  
  // Hardware installation
  hours += product.hardware.length * 0.5;
  
  // Quality control and packaging
  hours += 1.0;
  
  return Math.ceil(hours * 10) / 10; // Round to 1 decimal
}
