import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ComponentGeneratorService } from '../services/componentGenerator';

const router = Router();
const prisma = new PrismaClient();

// ============================================================================
// POST /fire-door-components/generate/:lineItemId
// Generate components from a line item
// ============================================================================
router.post('/generate/:lineItemId', async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { lineItemId } = req.params;
    const { forceRegenerate } = req.body;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify line item belongs to tenant
    const lineItem = await prisma.fireDoorLineItem.findFirst({
      where: { id: lineItemId, tenantId },
    });

    if (!lineItem) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    const componentGenerator = new ComponentGeneratorService(prisma);
    const components = await componentGenerator.generateComponents({
      lineItemId,
      tenantId,
      forceRegenerate: forceRegenerate ?? false,
    });

    res.json({
      success: true,
      componentsGenerated: components.length,
      components,
    });
  } catch (error) {
    console.error('Error generating components:', error);
    res.status(500).json({
      error: 'Failed to generate components',
      details: process.env.NODE_ENV === 'development' ? (error as any)?.message : undefined,
    });
  }
});

// ============================================================================
// GET /fire-door-components/:lineItemId
// Get all components for a line item
// ============================================================================
router.get('/:lineItemId', async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { lineItemId } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const components = await prisma.componentInstance.findMany({
      where: {
        tenantId,
        fireDoorLineItemId: lineItemId,
      },
      include: {
        definition: true,
      },
      orderBy: [
        { definition: { category: 'asc' } },
        { definition: { name: 'asc' } },
      ],
    });

    res.json(components);
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

// ============================================================================
// GET /fire-door-components/:lineItemId/bom
// Get Bill of Materials for a line item
// ============================================================================
router.get('/:lineItemId/bom', async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { lineItemId } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all components for this line item
    const components = await prisma.componentInstance.findMany({
      where: {
        tenantId,
        fireDoorLineItemId: lineItemId,
      },
      include: {
        definition: true,
      },
      orderBy: [
        { definition: { category: 'asc' } },
        { definition: { name: 'asc' } },
      ],
    });

    // Group by category
    const bom = {
      manufactured: components.filter((c) => c.definition.category === 'MANUFACTURED'),
      purchased: components.filter((c) => c.definition.category === 'PURCHASED'),
      assembly: components.filter((c) => c.definition.category === 'ASSEMBLY'),
    };

    // Calculate totals
    const totals = {
      manufactured: bom.manufactured.reduce(
        (sum, c) => sum + (c.totalCost ? Number(c.totalCost) : 0),
        0
      ),
      purchased: bom.purchased.reduce((sum, c) => sum + (c.totalCost ? Number(c.totalCost) : 0), 0),
      assembly: bom.assembly.reduce((sum, c) => sum + (c.totalCost ? Number(c.totalCost) : 0), 0),
    };

    totals['total' as any] = totals.manufactured + totals.purchased + totals.assembly;

    res.json({ components: bom, totals });
  } catch (error) {
    console.error('Error generating BOM:', error);
    res.status(500).json({ error: 'Failed to generate BOM' });
  }
});

// ============================================================================
// GET /fire-door-components/:lineItemId/preview3d
// Get 3D preview data for a line item
// ============================================================================
router.get('/:lineItemId/preview3d', async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { lineItemId } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const components = await prisma.componentInstance.findMany({
      where: { tenantId, fireDoorLineItemId: lineItemId },
      include: { definition: true },
    });

    const preview3D = {
      components: components.map((c) => ({
        id: c.id,
        type: c.definition.name.toLowerCase().replace(/\s+/g, '_'),
        dimensions: {
          width: (c.properties as any).width || 0,
          height: (c.properties as any).height || (c.properties as any).length || 0,
          depth: (c.properties as any).thickness || (c.properties as any).depth || 0,
        },
        position: (c.position3D as any) || { x: 0, y: 0, z: 0, rotation: 0 },
        material: (c.properties as any).material || 'unknown',
        color: (c.properties as any).finishColor || (c.properties as any).finish,
        quantity: c.quantity,
      })),
      boundingBox: {
        width: Math.max(...components.map((c) => (c.properties as any).width || 0)),
        height: Math.max(
          ...components.map((c) => (c.properties as any).height || (c.properties as any).length || 0)
        ),
        depth: Math.max(
          ...components.map((c) => (c.properties as any).thickness || 0)
        ),
      },
    };

    res.json(preview3D);
  } catch (error) {
    console.error('Error generating 3D preview:', error);
    res.status(500).json({ error: 'Failed to generate 3D preview' });
  }
});

// ============================================================================
// DELETE /fire-door-components/:lineItemId
// Delete all components for a line item
// ============================================================================
router.delete('/:lineItemId', async (req: any, res: Response) => {
  try {
    const tenantId = req.auth?.tenantId;
    const { lineItemId } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deleted = await prisma.componentInstance.deleteMany({
      where: {
        tenantId,
        fireDoorLineItemId: lineItemId,
      },
    });

    res.json({ success: true, deletedCount: deleted.count });
  } catch (error) {
    console.error('Error deleting components:', error);
    res.status(500).json({ error: 'Failed to delete components' });
  }
});

export default router;
