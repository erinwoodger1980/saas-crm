/**
 * Window Configurator Pricing Engine
 * Calculates window prices based on configuration and pricing matrix
 */

import type {
  WindowConfiguration,
  WindowPricingMatrix,
  PriceBreakdown,
} from './types';

export function calculateWindowPrice(
  config: WindowConfiguration,
  matrix: WindowPricingMatrix
): PriceBreakdown {
  // Calculate base price from area (per unit)
  const widthM = config.dimensions.width / 1000;
  const heightM = config.dimensions.height / 1000;
  const areaPerUnit = widthM * heightM;
  const totalUnits = config.dimensions.columns * config.dimensions.rows;
  
  // Base price per unit
  const basePricePerUnit = areaPerUnit * matrix.basePricePerSqM;
  
  // Window type multiplier
  const windowTypeMultiplier = matrix.windowTypeMultipliers[config.windowType];
  
  // Style multiplier
  const styleMultiplier = matrix.styleMultipliers[config.style.id] || 1.0;
  
  // Color multiplier
  const colorMultiplier = matrix.colorMultipliers[config.color.id] || 1.0;
  
  // Glazing multiplier
  const glazingMultiplier = matrix.glazingMultipliers[config.glazing.id] || 1.0;
  
  // Size multiplier
  const sizeMultiplier = getSizeMultiplier(config.dimensions.width, config.dimensions.height, matrix);
  
  // Calculate price per unit with all multipliers
  const pricePerUnit = 
    basePricePerUnit *
    windowTypeMultiplier *
    styleMultiplier *
    colorMultiplier *
    glazingMultiplier *
    sizeMultiplier;
  
  // Total before multi-unit discount
  const totalBeforeDiscount = pricePerUnit * totalUnits;
  
  // Multi-unit discount
  const discountMultiplier = getMultiUnitDiscount(totalUnits, matrix);
  const multiUnitDiscount = totalBeforeDiscount * (1 - discountMultiplier);
  const totalAfterDiscount = totalBeforeDiscount * discountMultiplier;
  
  // Hardware addons (per unit)
  let hardwarePrice = 0;
  if (config.hardware.locks === 'security') {
    hardwarePrice += matrix.hardwareAddons.securityLocks * totalUnits;
  } else if (config.hardware.locks === 'premium') {
    hardwarePrice += matrix.hardwareAddons.premiumLocks * totalUnits;
  }
  
  if (config.hardware.handles === 'contemporary') {
    hardwarePrice += matrix.hardwareAddons.contemporaryHandles * totalUnits;
  }
  
  if (config.hardware.restrictors) {
    hardwarePrice += matrix.hardwareAddons.restrictors * totalUnits;
  }
  
  if (config.hardware.trickleVents) {
    hardwarePrice += matrix.hardwareAddons.trickleVents * totalUnits;
  }
  
  // Feature addons (per unit)
  let featuresPrice = 0;
  if (config.features.Georgian) {
    featuresPrice += matrix.featureAddons.georgian * totalUnits;
  }
  
  if (config.features.leaded) {
    featuresPrice += matrix.featureAddons.leaded * totalUnits;
  }
  
  if (config.features.tiltIn && config.windowType === 'sash') {
    featuresPrice += matrix.featureAddons.tiltIn * totalUnits;
  }
  
  if (config.features.restrictorStays && config.windowType === 'casement') {
    featuresPrice += matrix.featureAddons.restrictorStays * totalUnits;
  }
  
  // Calculate totals
  const subtotal = totalAfterDiscount + hardwarePrice + featuresPrice;
  const vat = subtotal * 0.2; // 20% VAT
  const total = subtotal + vat;
  
  return {
    basePrice: basePricePerUnit,
    windowTypeMultiplier,
    styleMultiplier,
    colorMultiplier,
    glazingMultiplier,
    sizeMultiplier,
    multiUnitDiscount: multiUnitDiscount,
    hardwarePrice,
    featuresPrice,
    subtotal,
    vat,
    total,
  };
}

function getSizeMultiplier(
  width: number,
  height: number,
  matrix: WindowPricingMatrix
): number {
  if (width <= 1200 && height <= 1500) {
    return matrix.sizeMultipliers.standard;
  } else if (width <= 1500 && height <= 1800) {
    return matrix.sizeMultipliers.large;
  } else {
    return matrix.sizeMultipliers.extraLarge;
  }
}

function getMultiUnitDiscount(
  totalUnits: number,
  matrix: WindowPricingMatrix
): number {
  if (totalUnits >= 4) {
    return matrix.multiUnitDiscount.fourPlusUnits;
  } else if (totalUnits === 3) {
    return matrix.multiUnitDiscount.threeUnits;
  } else if (totalUnits === 2) {
    return matrix.multiUnitDiscount.twoUnits;
  }
  return 1.0; // No discount for single unit
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function getPriceDescription(breakdown: PriceBreakdown, totalUnits: number): string[] {
  const descriptions: string[] = [];
  
  descriptions.push(`Base price: ${formatPrice(breakdown.basePrice)} per unit × ${totalUnits} unit${totalUnits > 1 ? 's' : ''}`);
  
  if (breakdown.windowTypeMultiplier !== 1.0) {
    descriptions.push(`Window type: ×${breakdown.windowTypeMultiplier.toFixed(2)}`);
  }
  
  if (breakdown.styleMultiplier !== 1.0) {
    descriptions.push(`Style: ×${breakdown.styleMultiplier.toFixed(2)}`);
  }
  
  if (breakdown.colorMultiplier !== 1.0) {
    descriptions.push(`Color/Finish: ×${breakdown.colorMultiplier.toFixed(2)}`);
  }
  
  if (breakdown.glazingMultiplier !== 1.0) {
    descriptions.push(`Glazing: ×${breakdown.glazingMultiplier.toFixed(2)}`);
  }
  
  if (breakdown.sizeMultiplier !== 1.0) {
    descriptions.push(`Size: ×${breakdown.sizeMultiplier.toFixed(2)}`);
  }
  
  if (breakdown.multiUnitDiscount > 0) {
    descriptions.push(`Multi-unit discount: -${formatPrice(breakdown.multiUnitDiscount)}`);
  }
  
  if (breakdown.hardwarePrice > 0) {
    descriptions.push(`Hardware upgrades: +${formatPrice(breakdown.hardwarePrice)}`);
  }
  
  if (breakdown.featuresPrice > 0) {
    descriptions.push(`Additional features: +${formatPrice(breakdown.featuresPrice)}`);
  }
  
  descriptions.push(`Subtotal: ${formatPrice(breakdown.subtotal)}`);
  descriptions.push(`VAT (20%): ${formatPrice(breakdown.vat)}`);
  
  return descriptions;
}
