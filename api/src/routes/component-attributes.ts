import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /component-attributes - Get all attributes for a component type
router.get('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { componentType } = req.query;

    const where: any = { tenantId };
    if (componentType) {
      where.componentType = componentType;
    }

    const attributes = await prisma.componentAttribute.findMany({
      where,
      orderBy: [
        { componentType: 'asc' },
        { displayOrder: 'asc' }
      ]
    });

    res.json(attributes);
  } catch (error) {
    console.error('Error fetching component attributes:', error);
    res.status(500).json({ error: 'Failed to fetch attributes' });
  }
});

// GET /component-attributes/:id - Get specific attribute
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const attribute = await prisma.componentAttribute.findFirst({
      where: { id, tenantId }
    });

    if (!attribute) {
      return res.status(404).json({ error: 'Attribute not found' });
    }

    res.json(attribute);
  } catch (error) {
    console.error('Error fetching attribute:', error);
    res.status(500).json({ error: 'Failed to fetch attribute' });
  }
});

// POST /component-attributes - Create new attribute
router.post('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const {
      componentType,
      attributeName,
      attributeType,
      displayOrder,
      isRequired,
      options,
      calculationFormula,
      calculationUnit,
      affectsPrice,
      affectsBOM,
      metadata
    } = req.body;

    if (!componentType || !attributeName || !attributeType) {
      return res.status(400).json({ 
        error: 'componentType, attributeName, and attributeType are required' 
      });
    }

    const attribute = await prisma.componentAttribute.create({
      data: {
        tenantId,
        componentType,
        attributeName,
        attributeType,
        displayOrder: displayOrder || 0,
        isRequired: isRequired || false,
        options,
        calculationFormula,
        calculationUnit,
        affectsPrice: affectsPrice || false,
        affectsBOM: affectsBOM || false,
        metadata
      }
    });

    res.status(201).json(attribute);
  } catch (error: any) {
    console.error('Error creating attribute:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'An attribute with this name already exists for this component type' 
      });
    }
    res.status(500).json({ error: 'Failed to create attribute' });
  }
});

// PUT /component-attributes/:id - Update attribute
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const existing = await prisma.componentAttribute.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Attribute not found' });
    }

    const {
      attributeName,
      attributeType,
      displayOrder,
      isRequired,
      options,
      calculationFormula,
      calculationUnit,
      affectsPrice,
      affectsBOM,
      metadata
    } = req.body;

    const attribute = await prisma.componentAttribute.update({
      where: { id },
      data: {
        attributeName,
        attributeType,
        displayOrder,
        isRequired,
        options,
        calculationFormula,
        calculationUnit,
        affectsPrice,
        affectsBOM,
        metadata
      }
    });

    res.json(attribute);
  } catch (error: any) {
    console.error('Error updating attribute:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        error: 'An attribute with this name already exists for this component type' 
      });
    }
    res.status(500).json({ error: 'Failed to update attribute' });
  }
});

// DELETE /component-attributes/:id - Delete attribute
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const existing = await prisma.componentAttribute.findFirst({
      where: { id, tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Attribute not found' });
    }

    await prisma.componentAttribute.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting attribute:', error);
    res.status(500).json({ error: 'Failed to delete attribute' });
  }
});

export default router;
