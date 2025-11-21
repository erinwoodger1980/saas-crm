/**
 * Public pricing preview service for the estimator.
 * Provides live estimate based on in-progress questionnaire data.
 */

interface EstimateItem {
  description: string;
  widthMm?: number;
  heightMm?: number;
  openingType?: string;
  specs?: {
    timber?: string;
    glass?: string;
    ironmongery?: string;
    finish?: string;
  };
}

interface EstimateRequest {
  tenantId: string;
  items: EstimateItem[];
  globalSpecs?: {
    timber?: string;
    glass?: string;
    ironmongery?: string;
    finish?: string;
  };
}

interface EstimateResponse {
  items: Array<{
    description: string;
    netGBP: number;
    vatGBP: number;
    totalGBP: number;
  }>;
  subtotalNet: number;
  totalVAT: number;
  totalGBP: number;
  currency: string;
  note: string;
  needsManualQuote?: boolean;
  manualQuoteReason?: string;
}

/**
 * Calculate a rough estimate for public preview.
 * This is a simplified version that can run without full ML model.
 * For production, integrate with actual pricing model or ML service.
 */
export async function estimateQuote(req: EstimateRequest): Promise<EstimateResponse> {
  const items = req.items || [];
  const VAT_RATE = 0.20;

  // Check if we have enough information to provide a reliable estimate
  let needsManualQuote = false;
  let manualQuoteReason: string | undefined;

  // Insufficient items
  if (items.length === 0) {
    needsManualQuote = true;
    manualQuoteReason = 'No items provided';
  }

  // Check if any items are missing critical dimensions
  const itemsMissingDimensions = items.filter(item => !item.widthMm || !item.heightMm || item.widthMm <= 0 || item.heightMm <= 0);
  if (!needsManualQuote && itemsMissingDimensions.length > items.length * 0.5) {
    // More than 50% of items missing dimensions
    needsManualQuote = true;
    manualQuoteReason = 'Insufficient measurement details';
  }

  // Check for unusual sizes that might need special pricing
  const itemsWithUnusualSize = items.filter(item => {
    if (!item.widthMm || !item.heightMm) return false;
    const areaSqM = (item.widthMm * item.heightMm) / 1000000;
    return areaSqM > 10 || areaSqM < 0.3; // Very large or very small
  });
  if (!needsManualQuote && itemsWithUnusualSize.length > 0) {
    needsManualQuote = true;
    manualQuoteReason = 'Unusual dimensions requiring specialist review';
  }

  // If we need manual quote, return early with placeholder values
  if (needsManualQuote) {
    return {
      items: items.map(item => ({
        description: item.description || 'Opening',
        netGBP: 0,
        vatGBP: 0,
        totalGBP: 0,
      })),
      subtotalNet: 0,
      totalVAT: 0,
      totalGBP: 0,
      currency: 'GBP',
      note: 'Manual quote required',
      needsManualQuote: true,
      manualQuoteReason,
    };
  }

  // Simple heuristic-based pricing for preview
  const estimatedItems = items.map((item) => {
    const basePrice = calculateItemBasePrice(item, req.globalSpecs);
    const netGBP = Math.round(basePrice * 100) / 100;
    const vatGBP = Math.round(netGBP * VAT_RATE * 100) / 100;
    const totalGBP = netGBP + vatGBP;

    return {
      description: item.description || 'Opening',
      netGBP,
      vatGBP,
      totalGBP,
    };
  });

  const subtotalNet = estimatedItems.reduce((sum, item) => sum + item.netGBP, 0);
  const totalVAT = Math.round(subtotalNet * VAT_RATE * 100) / 100;
  const totalGBP = subtotalNet + totalVAT;

  return {
    items: estimatedItems,
    subtotalNet: Math.round(subtotalNet * 100) / 100,
    totalVAT,
    totalGBP: Math.round(totalGBP * 100) / 100,
    currency: 'GBP',
    note: 'Estimate only – final price subject to survey and detailed specification.',
    needsManualQuote: false,
  };
}

/**
 * Calculate base price for a single item using simple heuristics.
 * This should be replaced with actual pricing logic or ML model calls.
 */
function calculateItemBasePrice(
  item: EstimateItem,
  globalSpecs?: EstimateRequest['globalSpecs']
): number {
  // Base price per square meter
  let pricePerSqM = 800; // Default baseline

  const specs = item.specs || globalSpecs || {};

  // Material adjustments
  if (specs.timber) {
    const timber = specs.timber.toLowerCase();
    if (timber.includes('accoya')) pricePerSqM += 200;
    if (timber.includes('oak')) pricePerSqM += 150;
    if (timber.includes('aluminium') || timber.includes('aluminum')) pricePerSqM += 300;
  }

  // Glass adjustments
  if (specs.glass) {
    const glass = specs.glass.toLowerCase();
    if (glass.includes('triple')) pricePerSqM += 100;
    if (glass.includes('acoustic')) pricePerSqM += 150;
    if (glass.includes('laminated')) pricePerSqM += 80;
  }

  // Calculate area if dimensions provided
  let areaSqM = 1.5; // Default area if not specified
  if (item.widthMm && item.heightMm && item.widthMm > 0 && item.heightMm > 0) {
    areaSqM = (item.widthMm * item.heightMm) / 1000000; // Convert mm² to m²
    
    // Minimum charge for small items
    if (areaSqM < 0.5) areaSqM = 0.5;
    // Maximum reasonable size check
    if (areaSqM > 10) areaSqM = 10;
  }

  // Opening type multipliers
  if (item.openingType) {
    const type = item.openingType.toLowerCase();
    if (type.includes('door')) pricePerSqM *= 1.1;
    if (type.includes('french') || type.includes('bifold')) pricePerSqM *= 1.3;
    if (type.includes('sliding')) pricePerSqM *= 1.2;
  }

  return pricePerSqM * areaSqM;
}
