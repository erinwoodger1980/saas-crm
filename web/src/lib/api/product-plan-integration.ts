/**
 * ProductPlanQuoteIntegration.ts
 * 
 * Helper to integrate ProductPlan v1 into quote line item workflow.
 * Use when:
 * 1. Editing a quote line item's 3D configuration
 * 2. Offering "Generate from description/photo" action
 * 
 * Exported functions:
 * - generatePlanForLineItem(lineItem): Calls /api/ai/generate-product-plan with line context
 * - updateLineWithPlan(lineItem, plan): Persists plan metadata to line item
 */

import { ProductPlanV1 } from '@/types/product-plan';
import { compileProductPlanToProductParams, validateProductPlan } from '@/lib/scene/plan-compiler';

/**
 * Generate a ProductPlan for a quote line item
 */
export async function generatePlanForLineItem(
  lineItem: {
    id: string;
    description?: string;
    configuredProduct?: {
      productType?: { category: string; type: string; option?: string };
      dimensions?: { widthMm: number; heightMm: number; depthMm: number };
    };
  }
): Promise<ProductPlanV1 | null> {
  try {
    const response = await fetch('/api/ai/generate-product-plan', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: lineItem.description || `Line item ${lineItem.id}`,
        existingProductType: lineItem.configuredProduct?.productType,
        existingDims: lineItem.configuredProduct?.dimensions
      })
    });

    if (!response.ok) {
      console.error('[AI2SCENE] Plan generation failed:', response.status);
      return null;
    }

    const plan = (await response.json()) as ProductPlanV1;
    
    // Validate plan
    const errors = validateProductPlan(plan);
    if (errors.length > 0) {
      console.error('[AI2SCENE] Plan validation failed:', errors);
      return null;
    }

    console.log('[AI2SCENE] Generated plan for line item:', lineItem.id, plan);
    return plan;
  } catch (error) {
    console.error('[AI2SCENE] Error generating plan for line item:', error);
    return null;
  }
}

/**
 * Persist ProductPlan metadata to a quote line item
 * Stores the full plan in line.customData for later retrieval
 */
export async function updateLineWithPlan(
  lineItemId: string,
  plan: ProductPlanV1,
  quoteId: string
): Promise<boolean> {
  try {
    // Compile plan to ProductParams
    const params = compileProductPlanToProductParams(plan, {
      source: 'estimate'
    });

    // POST to update line with compiled params + plan metadata
    const response = await fetch(`/api/quotes/${quoteId}/lines/${lineItemId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configuredProduct: {
          productType: {
            category: plan.detected.category,
            type: plan.detected.type,
            option: plan.detected.option
          },
          dimensions: {
            widthMm: plan.dimensions.widthMm ?? params.dimensions.width,
            heightMm: plan.dimensions.heightMm ?? params.dimensions.height,
            depthMm: plan.dimensions.depthMm ?? params.dimensions.depth
          }
        },
        customData: {
          plan, // Full plan for 3D rendering
          compiledParams: params,
          source: 'generated-plan-v1'
        }
      })
    });

    if (!response.ok) {
      console.error('[AI2SCENE] Failed to update line with plan:', response.status);
      return false;
    }

    console.log('[AI2SCENE] Updated line item with plan:', lineItemId);
    return true;
  } catch (error) {
    console.error('[AI2SCENE] Error updating line with plan:', error);
    return false;
  }
}

/**
 * Load ProductPlan from a quote line item (if available)
 */
export function getPlanFromLineItem(lineItem: any): ProductPlanV1 | null {
  const customData = lineItem?.customData || lineItem?.configuredProduct?.customData;
  if (customData?.plan) {
    return customData.plan as ProductPlanV1;
  }
  return null;
}
