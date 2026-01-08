import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthPayload } from '../middleware/auth';
import {
  generateTemplateProduct,
  matchAIComponentsToTemplates,
  getProductTypeTemplates,
} from '../services/templateProductGenerator';
import { prisma } from '../db';

// Augment Request with auth/tenantId
interface TenantRequest extends Request {
  auth?: AuthPayload;
  tenantId?: string;
}

const router = Router();

/**
 * POST /templates/generate
 * Generate a complete BOM from a ProductType selection with user parameters
 * 
 * Request body:
 * {
 *   productTypeId: "fire-door-30-single",
 *   fieldValues: {
 *     leafHeight: 2100,
 *     leafWidth: 900,
 *     lippingMaterial: "oak-european",
 *     facing: "white-laminate",
 *     glassType: "georgian-wire-7mm"
 *   }
 * }
 */
router.post('/generate', requireAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { productTypeId, fieldValues } = req.body;
    const tenantId = req.auth?.tenantId;

    if (!productTypeId || !fieldValues) {
      return res.status(400).json({
        error: 'Missing required fields: productTypeId, fieldValues',
      });
    }

    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    // Verify ProductType exists and belongs to tenant
    const productType = await prisma.productType.findFirst({
      where: {
        id: productTypeId,
        tenantId,
      },
    });

    if (!productType) {
      return res.status(404).json({ error: 'ProductType not found' });
    }

    // Generate the BOM
    const bom = await generateTemplateProduct({
      productTypeId,
      fieldValues,
      tenantId,
    });

    res.json(bom);
  } catch (error) {
    console.error('Template generation failed:', error);
    res.status(500).json({ error: 'Failed to generate template product' });
  }
});

/**
 * GET /templates/:productTypeId
 * Get all ComponentTemplates for a ProductType
 * Shows what components are needed and from which lookup tables materials are selected
 */
router.get('/:productTypeId', requireAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { productTypeId } = req.params;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant context' });
    }

    // Verify ProductType exists
    const productType = await prisma.productType.findFirst({
      where: {
        id: productTypeId,
        tenantId,
      },
    });

    if (!productType) {
      return res.status(404).json({ error: 'ProductType not found' });
    }

    // Get templates
    const templates = await getProductTypeTemplates(productTypeId);

    res.json(templates);
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * POST /templates/match-ai-components
 * Match AI-detected components to ComponentTemplates
 * 
 * Request body:
 * {
 *   detectedComponents: [
 *     { name: "timber lipping", category: "edge-banding", keywords: ["lipping", "edge"], confidence: 0.95 },
 *     { name: "glass panel", category: "glazing", keywords: ["glass", "pane"], confidence: 0.92 }
 *   ]
 * }
 */
router.post(
  '/match-ai-components',
  requireAuth,
  async (req: TenantRequest, res: Response) => {
    try {
      const { detectedComponents } = req.body;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: 'No tenant context' });
      }

      if (!detectedComponents || !Array.isArray(detectedComponents)) {
        return res.status(400).json({
          error: 'Missing required field: detectedComponents (array)',
        });
      }

      const matches = await matchAIComponentsToTemplates(detectedComponents, tenantId);

      res.json({
        detectedComponentsCount: detectedComponents.length,
        matchedComponentsCount: matches.length,
        matches,
      });
    } catch (error) {
      console.error('AI component matching failed:', error);
      res.status(500).json({ error: 'Failed to match components' });
    }
  }
);

/**
 * POST /templates/preview
 * Preview a BOM generation before confirming
 * Same as /generate but returns preview data for UI display
 */
router.post(
  '/preview',
  requireAuth,
  async (req: TenantRequest, res: Response) => {
    try {
      const { productTypeId, fieldValues } = req.body;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) {
        return res.status(401).json({ error: 'No tenant context' });
      }

      if (!productTypeId || !fieldValues) {
        return res.status(400).json({
          error: 'Missing required fields: productTypeId, fieldValues',
        });
      }

      const bom = await generateTemplateProduct({
        productTypeId,
        fieldValues,
        tenantId,
      });

      // Format for UI preview
      res.json({
        productType: productTypeId,
        preview: {
          itemCount: bom.lineItems.length,
          totalPrice: bom.totalPrice,
          totalMarkup: bom.totalMarkup,
          lineItems: bom.lineItems.map((item) => ({
            component: item.componentCode,
            material: item.materialCode,
            quantity: item.quantity,
            unit: item.quantityUnit,
            unitCost: item.costPerUnit,
            lineTotal: item.totalCost,
          })),
        },
      });
    } catch (error) {
      console.error('BOM preview failed:', error);
      res.status(500).json({ error: 'Failed to preview BOM' });
    }
  }
);

export default router;
