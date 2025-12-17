import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ==================== ComponentLookup Routes ====================

// GET /components - Get all components for tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { 
      componentType, 
      productType, 
      isActive, 
      search,
      supplierId 
    } = req.query;

    const where: any = { tenantId };
    
    if (componentType) {
      where.componentType = componentType;
    }
    if (productType) {
      where.productTypes = { has: productType };
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (supplierId) {
      where.supplierId = supplierId;
    }
    if (search) {
      where.OR = [
        { code: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const components = await prisma.componentLookup.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            leadTimeDays: true
          }
        }
      },
      orderBy: [
        { componentType: 'asc' },
        { code: 'asc' }
      ]
    });

    // Ensure productTypes is always an array for all components (handle null, undefined, or non-array values)
    const safeComponents = components.map(c => ({
      ...c,
      productTypes: (Array.isArray(c.productTypes) && c.productTypes !== null) 
        ? c.productTypes 
        : []
    }));

    res.json(safeComponents);
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
});

// GET /components/:id - Get specific component
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const component = await prisma.componentLookup.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true
      }
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Ensure productTypes is always an array (handle null, undefined, or non-array values)
    const safeComponent = {
      ...component,
      productTypes: (Array.isArray(component.productTypes) && component.productTypes !== null) 
        ? component.productTypes 
        : []
    };

    res.json(safeComponent);
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({ error: 'Failed to fetch component' });
  }
});

// GET /components/code/:code - Get component by code
router.get('/code/:code', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { code } = req.params;

    const component = await prisma.componentLookup.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: decodeURIComponent(code)
        }
      },
      include: {
        supplier: true
      }
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(component);
  } catch (error) {
    console.error('Error fetching component by code:', error);
    res.status(500).json({ error: 'Failed to fetch component' });
  }
});

// POST /components - Create new component
router.post('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const {
      productTypes,
      componentType,
      code,
      name,
      description,
      unitOfMeasure,
      basePrice,
      leadTimeDays,
      supplierId,
      isActive,
      metadata
    } = req.body;

    // Validate required fields
    if (!componentType || !code || !name) {
      return res.status(400).json({ 
        error: 'Missing required fields: componentType, code, name' 
      });
    }

    // Check for duplicate code
    const existing = await prisma.componentLookup.findUnique({
      where: {
        tenantId_code: { tenantId, code }
      }
    });

    if (existing) {
      return res.status(409).json({ 
        error: 'Component with this code already exists' 
      });
    }

    const component = await prisma.componentLookup.create({
      data: {
        tenantId,
        productTypes: productTypes || [],
        componentType,
        code,
        name,
        description,
        unitOfMeasure: unitOfMeasure || 'EA',
        basePrice: basePrice || 0,
        leadTimeDays: leadTimeDays || 0,
        supplierId,
        isActive: isActive !== false,
        metadata
      },
      include: {
        supplier: true
      }
    });

    res.status(201).json(component);
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({ error: 'Failed to create component' });
  }
});

// PUT /components/:id - Update component
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    // Verify component belongs to tenant
    const existing = await prisma.componentLookup.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const {
      productTypes,
      componentType,
      code,
      name,
      description,
      unitOfMeasure,
      basePrice,
      leadTimeDays,
      supplierId,
      isActive,
      metadata
    } = req.body;

    // If code is changing, check for duplicates
    if (code && code !== existing.code) {
      const duplicate = await prisma.componentLookup.findUnique({
        where: {
          tenantId_code: { tenantId, code }
        }
      });

      if (duplicate) {
        return res.status(409).json({ 
          error: 'Component with this code already exists' 
        });
      }
    }

    const component = await prisma.componentLookup.update({
      where: { id },
      data: {
        productTypes,
        componentType,
        code,
        name,
        description,
        unitOfMeasure,
        basePrice,
        leadTimeDays,
        supplierId,
        isActive,
        metadata
      },
      include: {
        supplier: true
      }
    });

    res.json(component);
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({ error: 'Failed to update component' });
  }
});

// DELETE /components/:id - Delete component
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    // Verify component belongs to tenant
    const existing = await prisma.componentLookup.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Check if component is used in any BOMs
    const bomCount = await prisma.bOMLineItem.count({
      where: { componentLookupId: id }
    });

    if (bomCount > 0) {
      return res.status(409).json({ 
        error: `Cannot delete component: used in ${bomCount} BOM line items. Set to inactive instead.` 
      });
    }

    await prisma.componentLookup.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({ error: 'Failed to delete component' });
  }
});

// ==================== ProductTypeComponent Routes ====================

// GET /components/product-types - Get product type component mappings
router.get('/product-types/all', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { productType } = req.query;

    const where: any = { tenantId };
    if (productType) {
      where.productType = productType;
    }

    const mappings = await prisma.productTypeComponent.findMany({
      where,
      orderBy: [
        { productType: 'asc' },
        { sortOrder: 'asc' }
      ]
    });

    res.json(mappings);
  } catch (error) {
    console.error('Error fetching product type mappings:', error);
    res.status(500).json({ error: 'Failed to fetch product type mappings' });
  }
});

// POST /components/product-types - Create product type mapping
router.post('/product-types/all', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const {
      productType,
      componentType,
      displayName,
      isRequired,
      defaultCode,
      sortOrder,
      formulaEnabled,
      formulaExpression
    } = req.body;

    if (!productType || !componentType || !displayName) {
      return res.status(400).json({ 
        error: 'Missing required fields: productType, componentType, displayName' 
      });
    }

    const mapping = await prisma.productTypeComponent.create({
      data: {
        tenantId,
        productType,
        componentType,
        displayName,
        isRequired: isRequired || false,
        defaultCode,
        sortOrder: sortOrder || 0,
        formulaEnabled: formulaEnabled || false,
        formulaExpression
      }
    });

    res.status(201).json(mapping);
  } catch (error) {
    console.error('Error creating product type mapping:', error);
    res.status(500).json({ error: 'Failed to create product type mapping' });
  }
});

// PUT /components/product-types/:id - Update product type mapping
router.put('/product-types/all/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const existing = await prisma.productTypeComponent.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    const mapping = await prisma.productTypeComponent.update({
      where: { id },
      data: req.body
    });

    res.json(mapping);
  } catch (error) {
    console.error('Error updating product type mapping:', error);
    res.status(500).json({ error: 'Failed to update product type mapping' });
  }
});

// DELETE /components/product-types/:id - Delete product type mapping
router.delete('/product-types/all/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const existing = await prisma.productTypeComponent.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    await prisma.productTypeComponent.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product type mapping:', error);
    res.status(500).json({ error: 'Failed to delete product type mapping' });
  }
});

// GET /components/types - Get all unique component types for tenant
router.get('/types/all', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const components = await prisma.componentLookup.findMany({
      where: { tenantId },
      select: { componentType: true },
      distinct: ['componentType']
    });

    const types = components.map(c => c.componentType).sort();
    res.json(types);
  } catch (error) {
    console.error('Error fetching component types:', error);
    res.status(500).json({ error: 'Failed to fetch component types' });
  }
});

// POST /components/bulk-import - Bulk import components from CSV
router.post('/bulk-import', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { components } = req.body;

    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: 'components array is required' });
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const comp of components) {
      try {
        const { code, name, componentType, productTypes, ...rest } = comp;

        if (!code || !name || !componentType) {
          results.errors.push(`Skipped row: missing required fields (code, name, or componentType)`);
          results.skipped++;
          continue;
        }

        const existing = await prisma.componentLookup.findUnique({
          where: {
            tenantId_code: { tenantId, code }
          }
        });

        if (existing) {
          await prisma.componentLookup.update({
            where: { id: existing.id },
            data: {
              name,
              componentType,
              productTypes: productTypes || existing.productTypes,
              ...rest
            }
          });
          results.updated++;
        } else {
          await prisma.componentLookup.create({
            data: {
              tenantId,
              code,
              name,
              componentType,
              productTypes: productTypes || [],
              unitOfMeasure: rest.unitOfMeasure || 'EA',
              basePrice: rest.basePrice || 0,
              leadTimeDays: rest.leadTimeDays || 0,
              isActive: rest.isActive !== false,
              ...rest
            }
          });
          results.created++;
        }
      } catch (err: any) {
        results.errors.push(`Error with ${comp.code}: ${err.message}`);
        results.skipped++;
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error bulk importing components:', error);
    res.status(500).json({ error: 'Failed to bulk import components' });
  }
});

export default router;
