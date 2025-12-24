import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /product-type-components/:productTypeId - Get components assigned to a product type
router.get('/:productTypeId', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { productTypeId } = req.params;

    const assignments = await prisma.productTypeComponentAssignment.findMany({
      where: {
        tenantId,
        productTypeId
      },
      include: {
        component: {
          include: {
            supplier: true,
            profile: true
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching product type components:', error);
    res.status(500).json({ error: 'Failed to fetch product type components' });
  }
});

// POST /product-type-components/:productTypeId/assign - Assign a component to a product type
router.post('/:productTypeId/assign', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { productTypeId } = req.params;
    const { componentId, isRequired, isDefault, quantityFormula, metadata } = req.body;

    if (!componentId) {
      return res.status(400).json({ error: 'componentId is required' });
    }

    // Verify component exists and belongs to tenant
    const component = await prisma.componentLookup.findFirst({
      where: { id: componentId, tenantId }
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Verify product type exists and belongs to tenant
    const productType = await prisma.productType.findFirst({
      where: { id: productTypeId, tenantId }
    });

    if (!productType) {
      return res.status(404).json({ error: 'Product type not found' });
    }

    // Get current max sort order
    const maxSortOrder = await prisma.productTypeComponentAssignment.findFirst({
      where: { productTypeId, tenantId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    });

    const sortOrder = (maxSortOrder?.sortOrder ?? -1) + 1;

    // Create assignment
    const assignment = await prisma.productTypeComponentAssignment.create({
      data: {
        tenantId,
        productTypeId,
        componentId,
        isRequired: isRequired ?? false,
        isDefault: isDefault ?? false,
        sortOrder,
        quantityFormula,
        metadata: metadata ?? null
      },
      include: {
        component: {
          include: {
            supplier: true,
            profile: true
          }
        }
      }
    });

    res.json(assignment);
  } catch (error: any) {
    console.error('Error assigning component:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Component already assigned to this product type' });
    }
    res.status(500).json({ error: 'Failed to assign component' });
  }
});

// PATCH /product-type-components/:assignmentId - Update assignment settings
router.patch('/:assignmentId', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { assignmentId } = req.params;
    const { isRequired, isDefault, sortOrder, quantityFormula, metadata } = req.body;

    // Verify assignment exists and belongs to tenant
    const existing = await prisma.productTypeComponentAssignment.findFirst({
      where: { id: assignmentId, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = await prisma.productTypeComponentAssignment.update({
      where: { id: assignmentId },
      data: {
        isRequired: isRequired ?? existing.isRequired,
        isDefault: isDefault ?? existing.isDefault,
        sortOrder: sortOrder ?? existing.sortOrder,
        quantityFormula: quantityFormula !== undefined ? quantityFormula : existing.quantityFormula,
        metadata: metadata !== undefined ? metadata : existing.metadata
      },
      include: {
        component: {
          include: {
            supplier: true,
            profile: true
          }
        }
      }
    });

    res.json(assignment);
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// DELETE /product-type-components/:assignmentId - Remove component assignment
router.delete('/:assignmentId', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { assignmentId } = req.params;

    // Verify assignment exists and belongs to tenant
    const existing = await prisma.productTypeComponentAssignment.findFirst({
      where: { id: assignmentId, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await prisma.productTypeComponentAssignment.delete({
      where: { id: assignmentId }
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// GET /product-type-components/:productTypeId/available - Get components available to assign
router.get('/:productTypeId/available', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { productTypeId } = req.params;
    const { componentType, search } = req.query;

    // Get already assigned component IDs
    const assigned = await prisma.productTypeComponentAssignment.findMany({
      where: { tenantId, productTypeId },
      select: { componentId: true }
    });

    const assignedIds = assigned.map(a => a.componentId);

    // Get available components (not yet assigned)
    const where: any = {
      tenantId,
      isActive: true,
      id: { notIn: assignedIds }
    };

    if (componentType) {
      where.componentType = componentType;
    }

    if (search) {
      where.OR = [
        { code: { contains: String(search), mode: 'insensitive' } },
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const components = await prisma.componentLookup.findMany({
      where,
      include: {
        supplier: true,
        profile: true
      },
      orderBy: [
        { componentType: 'asc' },
        { code: 'asc' }
      ],
      take: 50
    });

    res.json(components);
  } catch (error) {
    console.error('Error fetching available components:', error);
    res.status(500).json({ error: 'Failed to fetch available components' });
  }
});

export default router;
