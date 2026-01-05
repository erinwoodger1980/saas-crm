import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /product-types - Get all product types for current tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const productTypes = await prisma.productType.findMany({
      where: {
        tenantId,
        isActive: true
      },
      orderBy: [
        { level: 'asc' }, // category, type, option
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        level: true,
        parentId: true,
        svgPreview: true,
        sortOrder: true,
        metadata: true
      }
    });

    res.json(productTypes);
  } catch (error) {
    console.error('[product-types] Error fetching product types:', error);
    res.status(500).json({ error: 'Failed to fetch product types' });
  }
});

// GET /product-types/:id - Get a single product type
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { id } = req.params;

    const productType = await prisma.productType.findFirst({
      where: {
        id,
        tenantId
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!productType) {
      return res.status(404).json({ error: 'Product type not found' });
    }

    res.json(productType);
  } catch (error) {
    console.error('[product-types] Error fetching product type:', error);
    res.status(500).json({ error: 'Failed to fetch product type' });
  }
});

export default router;
