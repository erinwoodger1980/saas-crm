import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /component-variants - Get all variants (optionally filtered by component)
router.get('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { componentLookupId, isActive } = req.query;

    const where: any = { tenantId };
    if (componentLookupId) {
      where.componentLookupId = componentLookupId;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const variants = await prisma.componentVariant.findMany({
      where,
      include: {
        component: {
          select: {
            code: true,
            name: true,
            componentType: true,
            basePrice: true,
            unitOfMeasure: true
          }
        },
        supplier: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { componentLookupId: 'asc' },
        { variantCode: 'asc' }
      ]
    });

    res.json(variants);
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

// GET /component-variants/:id - Get specific variant
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const variant = await prisma.componentVariant.findFirst({
      where: { id, tenantId },
      include: {
        component: true,
        supplier: true
      }
    });

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    res.json(variant);
  } catch (error) {
    console.error('Error fetching variant:', error);
    res.status(500).json({ error: 'Failed to fetch variant' });
  }
});

// POST /component-variants - Create new variant
router.post('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const {
      componentLookupId,
      variantCode,
      variantName,
      attributeValues,
      dimensionFormulas,
      priceModifier,
      unitPrice,
      supplierId,
      supplierSKU,
      leadTimeDays,
      minimumOrderQty,
      specifications,
      isActive,
      isStocked,
      stockLevel
    } = req.body;

    if (!componentLookupId || !variantCode || !variantName || !attributeValues) {
      return res.status(400).json({ 
        error: 'componentLookupId, variantCode, variantName, and attributeValues are required' 
      });
    }

    const variant = await prisma.componentVariant.create({
      data: {
        tenantId,
        componentLookupId,
        variantCode,
        variantName,
        attributeValues,
        dimensionFormulas,
        priceModifier: priceModifier || 0,
        unitPrice,
        supplierId,
        supplierSKU,
        leadTimeDays,
        minimumOrderQty,
        specifications,
        isActive: isActive !== false,
        isStocked: isStocked || false,
        stockLevel
      },
      include: {
        component: true,
        supplier: true
      }
    });

    res.status(201).json(variant);
  } catch (error: any) {
    console.error('Error creating variant:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'A variant with this code already exists' 
      });
    }
    res.status(500).json({ error: 'Failed to create variant' });
  }
});

// PUT /component-variants/:id - Update variant
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const existing = await prisma.componentVariant.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    const {
      variantCode,
      variantName,
      attributeValues,
      dimensionFormulas,
      priceModifier,
      unitPrice,
      supplierId,
      supplierSKU,
      leadTimeDays,
      minimumOrderQty,
      specifications,
      isActive,
      isStocked,
      stockLevel
    } = req.body;

    const variant = await prisma.componentVariant.update({
      where: { id },
      data: {
        variantCode,
        variantName,
        attributeValues,
        dimensionFormulas,
        priceModifier,
        unitPrice,
        supplierId,
        supplierSKU,
        leadTimeDays,
        minimumOrderQty,
        specifications,
        isActive,
        isStocked,
        stockLevel
      },
      include: {
        component: true,
        supplier: true
      }
    });

    res.json(variant);
  } catch (error: any) {
    console.error('Error updating variant:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'A variant with this code already exists' 
      });
    }
    res.status(500).json({ error: 'Failed to update variant' });
  }
});

// DELETE /component-variants/:id - Delete variant
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const existing = await prisma.componentVariant.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    await prisma.componentVariant.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting variant:', error);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
});

// POST /component-variants/calculate-price - Calculate price for variant based on attributes
router.post('/calculate-price', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { componentLookupId, attributeValues, quantity } = req.body;

    if (!componentLookupId || !attributeValues) {
      return res.status(400).json({ 
        error: 'componentLookupId and attributeValues are required' 
      });
    }

    // Get base component
    const component = await prisma.componentLookup.findFirst({
      where: { id: componentLookupId, tenantId }
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Get attributes for this component type
    const attributes = await prisma.componentAttribute.findMany({
      where: {
        tenantId,
        componentType: component.componentType,
        affectsPrice: true
      }
    });

    let totalPrice = component.basePrice;
    const priceBreakdown: any[] = [];

    // Calculate price modifiers from attributes
    for (const attr of attributes) {
      const selectedValue = attributeValues[attr.attributeName];
      if (selectedValue && attr.options) {
        const options = JSON.parse(attr.options as string);
        const option = options.find((o: any) => o.value === selectedValue);
        if (option && option.priceModifier) {
          totalPrice += option.priceModifier;
          priceBreakdown.push({
            attribute: attr.attributeName,
            value: selectedValue,
            modifier: option.priceModifier
          });
        }
      }
    }

    // Calculate total if quantity provided
    const finalTotal = quantity ? totalPrice * quantity : totalPrice;

    res.json({
      basePrice: component.basePrice,
      unitPrice: totalPrice,
      quantity: quantity || 1,
      totalPrice: finalTotal,
      priceBreakdown
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    res.status(500).json({ error: 'Failed to calculate price' });
  }
});

export default router;
