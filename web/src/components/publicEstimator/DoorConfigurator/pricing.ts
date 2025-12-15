/**
 * Door Pricing Calculator
 * Calculates door price based on configuration
 */

import { DoorConfiguration, DoorPricingMatrix } from './types';
import { PRICING_MATRIX } from './constants';

interface PriceBreakdown {
  basePrice: number;
  styleMultiplier: number;
  colorMultiplier: number;
  glassMultiplier: number;
  sizeMultiplier: number;
  sideLightPrice: number;
  topLightPrice: number;
  hardwarePrice: number;
  subtotal: number;
  vat: number;
  total: number;
}

export function calculateDoorPrice(
  config: DoorConfiguration,
  matrix: DoorPricingMatrix = PRICING_MATRIX
): PriceBreakdown {
  // Calculate base price from dimensions
  const widthM = config.dimensions.width / 1000;
  const heightM = config.dimensions.height / 1000;
  const areaM2 = widthM * heightM;
  const basePrice = areaM2 * matrix.basePricePerSqM;

  // Determine size multiplier
  const sizeMultiplier = getSizeMultiplier(config.dimensions, matrix);

  // Style multiplier
  const styleMultiplier = config.style.baseMultiplier;

  // Color multiplier
  const colorMultiplier = config.color.priceMultiplier;

  // Glass multiplier
  const glassMultiplier = config.selectedGlass.priceMultiplier;

  // Calculate side light cost
  let sideLightPrice = 0;
  if (config.sideLight.enabled) {
    const count = config.sideLight.position === 'both' ? 2 : 1;
    sideLightPrice = 
      (matrix.sideLight.basePricePerUnit + 
       (config.sideLight.width * matrix.sideLight.widthMultiplier / 100)) * count;
    
    if (config.sideLight.hasGlass && config.sideLight.glassOption) {
      sideLightPrice *= config.sideLight.glassOption.priceMultiplier;
    }
  }

  // Calculate top light cost
  let topLightPrice = 0;
  if (config.topLight.enabled) {
    topLightPrice = 
      matrix.topLight.basePrice * 
      matrix.topLight.styleMultipliers[config.topLight.style];
    
    if (config.topLight.hasGlass && config.topLight.glassOption) {
      topLightPrice *= config.topLight.glassOption.priceMultiplier;
    }
  }

  // Calculate hardware costs
  let hardwarePrice = 0;
  if (config.hardware.handleStyle === 'contemporary') {
    hardwarePrice += matrix.hardware.handleUpgrade;
  }
  if (config.hardware.letterPlate) {
    hardwarePrice += matrix.hardware.letterPlate;
  }
  if (config.hardware.knocker) {
    hardwarePrice += matrix.hardware.knocker;
  }

  // Calculate subtotal
  const doorPrice = basePrice * styleMultiplier * colorMultiplier * glassMultiplier * sizeMultiplier;
  const subtotal = doorPrice + sideLightPrice + topLightPrice + hardwarePrice;

  // VAT at 20%
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  return {
    basePrice,
    styleMultiplier,
    colorMultiplier,
    glassMultiplier,
    sizeMultiplier,
    sideLightPrice,
    topLightPrice,
    hardwarePrice,
    subtotal,
    vat,
    total,
  };
}

function getSizeMultiplier(
  dimensions: { width: number; height: number },
  matrix: DoorPricingMatrix
): number {
  const { width, height } = dimensions;

  // Extra large
  if (width > 1200 || height > 2400) {
    return matrix.sizeMultipliers.extraLarge;
  }

  // Large
  if (width > 914 || height > 2134) {
    return matrix.sizeMultipliers.large;
  }

  // Standard
  return matrix.sizeMultipliers.standard;
}

export function formatPrice(price: number): string {
  return `£${price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function getPriceDescription(breakdown: PriceBreakdown): string[] {
  const descriptions: string[] = [];

  descriptions.push(`Door: ${formatPrice(breakdown.basePrice)} base`);

  if (breakdown.styleMultiplier !== 1.0) {
    descriptions.push(`Style: ${(breakdown.styleMultiplier * 100).toFixed(0)}%`);
  }

  if (breakdown.colorMultiplier !== 1.0) {
    descriptions.push(`Finish: ${(breakdown.colorMultiplier * 100).toFixed(0)}%`);
  }

  if (breakdown.glassMultiplier !== 1.0) {
    descriptions.push(`Glass: ${(breakdown.glassMultiplier * 100).toFixed(0)}%`);
  }

  if (breakdown.sizeMultiplier !== 1.0) {
    descriptions.push(`Size: ${(breakdown.sizeMultiplier * 100).toFixed(0)}%`);
  }

  if (breakdown.sideLightPrice > 0) {
    descriptions.push(`Side light(s): ${formatPrice(breakdown.sideLightPrice)}`);
  }

  if (breakdown.topLightPrice > 0) {
    descriptions.push(`Top light: ${formatPrice(breakdown.topLightPrice)}`);
  }

  if (breakdown.hardwarePrice > 0) {
    descriptions.push(`Hardware: ${formatPrice(breakdown.hardwarePrice)}`);
  }

  return descriptions;
}
