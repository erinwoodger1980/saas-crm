/**
 * Phase 4: ML Payload Builder
 * 
 * Extracts canonical ConfiguredProduct selections as the primary source,
 * falls back to legacy questionnaire data for backward compatibility
 */

import { prisma } from '../prisma';

interface ConfiguredProduct {
  productTypeId?: string;
  selections: Record<string, any>;
  derived?: any;
  provenance?: Record<string, string>;
}

interface MLPayloadBuilderOptions {
  includeLineItems?: boolean;
  preferCanonical?: boolean;
}

/**
 * Extracts all configured products from a quote's line items
 */
export async function extractConfiguredProducts(
  quoteId: string
): Promise<ConfiguredProduct[]> {
  const quoteLines = await prisma.quoteLine.findMany({
    where: { quoteId }
  });

  const products: ConfiguredProduct[] = [];

  for (const line of quoteLines) {
    const config = line.configuredProduct as any;
    if (config?.selections) {
      products.push(config);
    }
  }

  return products;
}

/**
 * Builds ML payload with canonical data preferred
 * Fallback to legacy fields for backward compatibility
 */
export async function buildMLPayload(
  quoteId: string,
  options: MLPayloadBuilderOptions = {}
): Promise<any> {
  const {
    includeLineItems = true,
    preferCanonical = true
  } = options;

  // Get quote with all related data
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      lines: true,
      questionnaireResponse: {
        include: {
          answers: {
            include: { field: true }
          }
        }
      },
      lead: {
        select: {
          custom: true,
          globalTimberSpec: true,
          globalGlassSpec: true,
          globalIronmongerySpec: true,
          globalFinishSpec: true
        }
      }
    }
  });

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found`);
  }

  // Build canonical selections map from quote lines
  const canonicalSelections: Record<string, any> = {};
  const provenanceMap: Record<string, string> = {};

  if (preferCanonical) {
    for (const line of quote.lines) {
      const config = line.configuredProduct as any;
      if (config?.selections) {
        Object.assign(canonicalSelections, config.selections);
        if (config.provenance) {
          Object.assign(provenanceMap, config.provenance);
        }
      }
    }
  }

  // Fall back to legacy questionnaire answers
  const legacySelections: Record<string, any> = {};
  if (quote.questionnaireResponse) {
    for (const answer of quote.questionnaireResponse.answers) {
      const field = answer.field;
      // Use field key as-is for backward compatibility
      legacySelections[field.key] = answer.value;
      if (!provenanceMap[field.key]) {
        provenanceMap[field.key] = 'legacy';
      }
    }
  }

  // Fall back to lead custom fields
  const leadCustom = (quote.lead?.custom as any) || {};
  for (const [key, value] of Object.entries(leadCustom)) {
    if (value !== null && value !== undefined && !legacySelections[key]) {
      legacySelections[key] = value;
      if (!provenanceMap[key]) {
        provenanceMap[key] = 'lead-custom';
      }
    }
  }

  // Merge: canonical first, then legacy fallback
  const allSelections = { ...legacySelections, ...canonicalSelections };

  // Build payload
  const payload: any = {
    quoteId,
    tenantId: quote.tenantId,
    leadId: quote.leadId,
    status: quote.status,
    currency: quote.currency || 'GBP',
    
    // Canonical selections
    selections: allSelections,
    
    // Provenance tracking
    provenance: provenanceMap,
    
    // Canonical product info
    productTypes: extractProductTypeInfo(quote.lines),
    
    // Legacy fields (for backward compatibility)
    legacyFields: {
      questionnaire: quote.questionnaireResponse ? {
        responseId: quote.questionnaireResponse.id,
        answers: Object.fromEntries(
          quote.questionnaireResponse.answers.map(a => [a.field.key, a.value])
        )
      } : null,
      leadGlobalSpecs: {
        timber: quote.lead?.globalTimberSpec,
        glass: quote.lead?.globalGlassSpec,
        ironmongery: quote.lead?.globalIronmongerySpec,
        finish: quote.lead?.globalFinishSpec
      }
    },
    
    // Quote context
    subtotals: {
      material: quote.subtotalMaterialGBP ? Number(quote.subtotalMaterialGBP) : 0,
      labour: quote.subtotalLabourGBP ? Number(quote.subtotalLabourGBP) : 0,
      other: quote.subtotalOtherGBP ? Number(quote.subtotalOtherGBP) : 0,
      total: quote.totalGBP ? Number(quote.totalGBP) : 0
    },
    
    // ML fields
    mlContext: {
      modelVersion: quote.mlModelVersion,
      confidence: quote.mlConfidence ? Number(quote.mlConfidence) : undefined,
      estimatedPrice: quote.mlEstimatedPrice ? Number(quote.mlEstimatedPrice) : undefined,
      priceVariance: quote.priceVariancePercent ? Number(quote.priceVariancePercent) : undefined
    }
  };

  // Include line items if requested
  if (includeLineItems) {
    payload.lineItems = quote.lines.map(line => ({
      id: line.id,
      description: line.description,
      qty: Number(line.qty),
      unitPrice: Number(line.unitPrice),
      lineTotalGBP: Number(line.lineTotalGBP),
      configuredProduct: line.configuredProduct
    }));
  }

  return payload;
}

/**
 * Extract product type information from quote lines
 */
function extractProductTypeInfo(
  lines: any[]
): Array<{ lineId: string; productTypeId?: string }> {
  return lines.map(line => {
    const config = line.configuredProduct as any;
    return {
      lineId: line.id,
      productTypeId: config?.productTypeId
    };
  });
}

/**
 * Normalize ML payload for consistency
 * Handles different data types and ensures all expected fields exist
 */
export function normalizeMLPayload(payload: any): any {
  return {
    quoteId: payload.quoteId || '',
    tenantId: payload.tenantId || '',
    leadId: payload.leadId || '',
    status: payload.status || 'DRAFT',
    currency: payload.currency || 'GBP',
    
    // Canonical data (preferred)
    selections: normalizeObject(payload.selections || {}),
    provenance: normalizeObject(payload.provenance || {}),
    
    // Product type info
    productTypes: Array.isArray(payload.productTypes) ? payload.productTypes : [],
    
    // Legacy fields (preserved for compatibility)
    legacyFields: {
      questionnaire: payload.legacyFields?.questionnaire || null,
      leadGlobalSpecs: payload.legacyFields?.leadGlobalSpecs || {}
    },
    
    // Subtotals
    subtotals: {
      material: normalizeNumber(payload.subtotals?.material),
      labour: normalizeNumber(payload.subtotals?.labour),
      other: normalizeNumber(payload.subtotals?.other),
      total: normalizeNumber(payload.subtotals?.total)
    },
    
    // ML context
    mlContext: {
      modelVersion: payload.mlContext?.modelVersion,
      confidence: normalizeNumber(payload.mlContext?.confidence),
      estimatedPrice: normalizeNumber(payload.mlContext?.estimatedPrice),
      priceVariance: normalizeNumber(payload.mlContext?.priceVariance)
    },
    
    // Line items (optional)
    lineItems: Array.isArray(payload.lineItems)
      ? payload.lineItems.map((item: any) => ({
          id: item.id || '',
          description: item.description || '',
          qty: normalizeNumber(item.qty),
          unitPrice: normalizeNumber(item.unitPrice),
          lineTotalGBP: normalizeNumber(item.lineTotalGBP),
          configuredProduct: item.configuredProduct || null
        }))
      : []
  };
}

/**
 * Helper: normalize object (remove nulls/undefs)
 */
function normalizeObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Helper: normalize number
 */
function normalizeNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = parseFloat(String(value));
  return isNaN(num) ? null : num;
}

/**
 * Comparison utility: check if two payloads have significant differences
 */
export function compareMLPayloads(
  old: any,
  new_: any,
  significanceThreshold: number = 0.01
): {
  hasDifferences: boolean;
  changedFields: string[];
  priceDifference: number | null;
} {
  const changedFields: string[] = [];
  let priceDifference: number | null = null;

  // Compare selections
  if (JSON.stringify(old.selections) !== JSON.stringify(new_.selections)) {
    changedFields.push('selections');
  }

  // Compare price (tolerance for floating point)
  const oldPrice = old.mlContext?.estimatedPrice || 0;
  const newPrice = new_.mlContext?.estimatedPrice || 0;
  const priceDiff = Math.abs(newPrice - oldPrice);
  
  if (priceDiff > significanceThreshold * Math.max(1, oldPrice)) {
    changedFields.push('estimatedPrice');
    priceDifference = priceDiff;
  }

  // Compare subtotals
  if (JSON.stringify(old.subtotals) !== JSON.stringify(new_.subtotals)) {
    changedFields.push('subtotals');
  }

  return {
    hasDifferences: changedFields.length > 0,
    changedFields,
    priceDifference
  };
}

export { ConfiguredProduct };
