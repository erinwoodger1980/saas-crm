/**
 * API Endpoint: POST /api/architect-packs/:id/build
 * 
 * Build parametric products from confirmed openings
 * Uses the AI template configurator system to generate:
 * - Resolved products with 3D models
 * - BOM (Bill of Materials)
 * - Cutlist
 * - Pricing breakdown
 * 
 * Request params:
 * - id: string (architect pack ID)
 * 
 * Request body:
 * - openingIds?: string[] (specific openings to build, defaults to all confirmed)
 * - quoteId?: string (quote to add products to)
 * - autoConfirm?: boolean (automatically confirm all products)
 * 
 * Response:
 * - products: Array of built products with scenes
 * - quoteLineIds: Array of created quote line IDs (if quoteId provided)
 * - totalCount: number
 * - totalValue: number (GBP)
 */

import { Request, Response } from 'express';
import { prisma } from '../../db';

// This will integrate with the AI template configurator system
// import { resolveProduct } from '../../../web/src/lib/scene/resolve-product';
// import { buildScene } from '../../../web/src/lib/scene/scene-builder';
// import { calculateBOM } from '../../../web/src/lib/costing/bom';
// import { generateCutlist } from '../../../web/src/lib/costing/cutlist';
// import { calculatePricing } from '../../../web/src/lib/costing/pricing';

export async function buildProductsFromOpenings(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { openingIds, quoteId, autoConfirm = false } = req.body;
    const tenantId = req.auth?.tenantId;

    // Validate authentication
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No tenant ID found'
      });
    }

    // Fetch architect pack
    const pack = await prisma.architectPack.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            openings: {
              where: openingIds 
                ? { id: { in: openingIds } }
                : { userConfirmed: true },
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    });

    if (!pack) {
      return res.status(404).json({
        success: false,
        error: 'Architect pack not found or access denied'
      });
    }

    if (!pack.analyses.length) {
      return res.status(404).json({
        success: false,
        error: 'No analysis found for this architect pack'
      });
    }

    const analysis = pack.analyses[0];
    const openings = analysis.openings;

    if (!openings.length) {
      return res.status(400).json({
        success: false,
        error: 'No confirmed openings found to build products from'
      });
    }

    // Validate quote if provided
    let quote = null;
    if (quoteId) {
      quote = await prisma.quote.findFirst({
        where: {
          id: quoteId,
          tenantId
        }
      });

      if (!quote) {
        return res.status(404).json({
          success: false,
          error: 'Quote not found or access denied'
        });
      }
    }

    // Build products from openings
    const builtProducts = [];
    const createdQuoteLineIds = [];

    for (const opening of openings) {
      // Map opening to product archetype
      const archetype = mapOpeningToArchetype(opening);

      // Generate template draft from opening
      const templateDraft = generateTemplateDraft(opening, archetype);

      // TODO: Integrate with AI template configurator
      // const resolvedProduct = resolveProduct(templateDraft);
      // const sceneConfig = buildScene(resolvedProduct);
      // const bom = calculateBOM(resolvedProduct);
      // const cutlist = generateCutlist(resolvedProduct);
      // const pricing = calculatePricing(resolvedProduct, bom);

      // Placeholder product data
      const product = {
        openingId: opening.id,
        type: opening.type,
        dimensions: {
          widthMm: opening.widthMm,
          heightMm: opening.heightMm
        },
        archetype: archetype.name,
        // sceneConfig: sceneConfig,
        // bom: bom,
        // cutlist: cutlist,
        // pricing: pricing
        estimatedPrice: estimatePrice(opening),
        description: generateDescription(opening)
      };

      builtProducts.push(product);

      // Create quote line if quote provided
      if (quote) {
        const quoteLine = await prisma.quoteLine.create({
          data: {
            quoteId: quote.id,
            description: product.description,
            qty: 1,
            unitPrice: product.estimatedPrice,
            currency: 'GBP',
            lineTotalGBP: product.estimatedPrice,
            meta: {
              source: 'architect_pack',
              architectPackId: pack.id,
              analysisId: analysis.id,
              openingId: opening.id
            },
            configuredProduct: {
              // TODO: Store resolved product configuration
              archetype: archetype.name,
              dimensions: product.dimensions
            }
          }
        });

        // Link opening to quote line
        await prisma.architectOpening.update({
          where: { id: opening.id },
          data: {
            quoteLineId: quoteLine.id,
            userConfirmed: autoConfirm ? true : opening.userConfirmed
          }
        });

        createdQuoteLineIds.push(quoteLine.id);
      }
    }

    const totalValue = builtProducts.reduce(
      (sum, p) => sum + p.estimatedPrice,
      0
    );

    return res.json({
      success: true,
      data: {
        products: builtProducts,
        quoteLineIds: createdQuoteLineIds,
        totalCount: builtProducts.length,
        totalValue,
        quoteId: quote?.id
      }
    });

  } catch (error) {
    console.error('Error building products from openings:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error building products',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Map opening to product archetype template
 */
function mapOpeningToArchetype(opening: any) {
  const archetypes = {
    door: { name: 'entrance-door', templateId: 'door-entrance-e01' },
    window: { name: 'window', templateId: 'window-fixed-w01' },
    screen: { name: 'screen-door', templateId: 'door-screen-s01' },
    sliding: { name: 'sliding-door', templateId: 'door-sliding-sd01' },
    bifolding: { name: 'bifold-door', templateId: 'door-bifold-bf01' }
  };

  return archetypes[opening.type as keyof typeof archetypes] || archetypes.door;
}

/**
 * Generate template draft from opening
 */
function generateTemplateDraft(opening: any, archetype: any) {
  return {
    archetype: archetype.name,
    templateId: archetype.templateId,
    userInput: {
      description: `${opening.type} for ${opening.locationHint || 'location'}`,
      dimensions: {
        widthMm: opening.widthMm,
        heightMm: opening.heightMm
      },
      location: opening.locationHint,
      glazingType: opening.glazingType,
      frameType: opening.frameType
    },
    metadata: {
      source: 'architect_pack',
      confidence: opening.confidence,
      pageNumber: opening.pageNumber
    }
  };
}

/**
 * Estimate price based on opening size and type
 * Simple placeholder - would use actual costing system
 */
function estimatePrice(opening: any): number {
  const baseRates = {
    door: 500,
    window: 300,
    screen: 400,
    sliding: 800,
    bifolding: 1200
  };

  const baseRate = baseRates[opening.type as keyof typeof baseRates] || 500;
  const area = (opening.widthMm * opening.heightMm) / 1000000; // m²
  
  return Math.round(baseRate + (area * 200));
}

/**
 * Generate human-readable description
 */
function generateDescription(opening: any): string {
  const location = opening.locationHint ? ` - ${opening.locationHint}` : '';
  const dimensions = `${opening.widthMm}mm x ${opening.heightMm}mm`;
  const type = opening.type.charAt(0).toUpperCase() + opening.type.slice(1);
  
  return `${type} ${dimensions}${location}`;
}
