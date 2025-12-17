import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /lipping-lookup - Get all lipping lookup entries for tenant
router.get('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const lippingLookups = await prisma.lippingLookup.findMany({
      where: {
        tenantId,
        isActive: true
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });

    res.json(lippingLookups);
  } catch (error) {
    console.error('Error fetching lipping lookups:', error);
    res.status(500).json({ error: 'Failed to fetch lipping lookups' });
  }
});

// GET /lipping-lookup/:id - Get specific lipping lookup entry
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    const lippingLookup = await prisma.lippingLookup.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!lippingLookup) {
      return res.status(404).json({ error: 'Lipping lookup not found' });
    }

    res.json(lippingLookup);
  } catch (error) {
    console.error('Error fetching lipping lookup:', error);
    res.status(500).json({ error: 'Failed to fetch lipping lookup' });
  }
});

// GET /lipping-lookup/type/:doorsetType - Get by doorset type
router.get('/type/:doorsetType', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { doorsetType } = req.params;

    const lippingLookup = await prisma.lippingLookup.findUnique({
      where: {
        tenantId_doorsetType: {
          tenantId,
          doorsetType: decodeURIComponent(doorsetType)
        }
      }
    });

    if (!lippingLookup) {
      return res.status(404).json({ error: 'Lipping lookup not found for this doorset type' });
    }

    res.json(lippingLookup);
  } catch (error) {
    console.error('Error fetching lipping lookup by type:', error);
    res.status(500).json({ error: 'Failed to fetch lipping lookup' });
  }
});

// POST /lipping-lookup - Create new lipping lookup entry
router.post('/', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const {
      doorsetType,
      topMm,
      bottomMm,
      hingeMm,
      lockMm,
      safeHingeMm,
      daExposedMm,
      trimMm,
      postformedMm,
      extrasMm,
      commentsForNotes,
      sortOrder
    } = req.body;

    if (!doorsetType) {
      return res.status(400).json({ error: 'doorsetType is required' });
    }

    // Check if entry already exists
    const existing = await prisma.lippingLookup.findUnique({
      where: {
        tenantId_doorsetType: {
          tenantId,
          doorsetType
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Lipping lookup already exists for this doorset type' });
    }

    const lippingLookup = await prisma.lippingLookup.create({
      data: {
        tenantId,
        doorsetType,
        topMm: topMm || null,
        bottomMm: bottomMm || null,
        hingeMm: hingeMm || null,
        lockMm: lockMm || null,
        safeHingeMm: safeHingeMm || null,
        daExposedMm: daExposedMm || null,
        trimMm: trimMm || null,
        postformedMm: postformedMm || null,
        extrasMm: extrasMm || null,
        commentsForNotes: commentsForNotes || null,
        sortOrder: sortOrder || 0
      }
    });

    res.status(201).json(lippingLookup);
  } catch (error) {
    console.error('Error creating lipping lookup:', error);
    res.status(500).json({ error: 'Failed to create lipping lookup' });
  }
});

// PUT /lipping-lookup/:id - Update lipping lookup entry
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;
    const {
      doorsetType,
      topMm,
      bottomMm,
      hingeMm,
      lockMm,
      safeHingeMm,
      daExposedMm,
      trimMm,
      postformedMm,
      extrasMm,
      commentsForNotes,
      sortOrder,
      isActive
    } = req.body;

    // Verify ownership
    const existing = await prisma.lippingLookup.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lipping lookup not found' });
    }

    // If doorsetType is being changed, check for conflicts
    if (doorsetType && doorsetType !== existing.doorsetType) {
      const conflict = await prisma.lippingLookup.findUnique({
        where: {
          tenantId_doorsetType: {
            tenantId,
            doorsetType
          }
        }
      });

      if (conflict) {
        return res.status(409).json({ error: 'Another lipping lookup already exists for this doorset type' });
      }
    }

    const updatedLippingLookup = await prisma.lippingLookup.update({
      where: { id },
      data: {
        ...(doorsetType !== undefined && { doorsetType }),
        ...(topMm !== undefined && { topMm: topMm || null }),
        ...(bottomMm !== undefined && { bottomMm: bottomMm || null }),
        ...(hingeMm !== undefined && { hingeMm: hingeMm || null }),
        ...(lockMm !== undefined && { lockMm: lockMm || null }),
        ...(safeHingeMm !== undefined && { safeHingeMm: safeHingeMm || null }),
        ...(daExposedMm !== undefined && { daExposedMm: daExposedMm || null }),
        ...(trimMm !== undefined && { trimMm: trimMm || null }),
        ...(postformedMm !== undefined && { postformedMm: postformedMm || null }),
        ...(extrasMm !== undefined && { extrasMm: extrasMm || null }),
        ...(commentsForNotes !== undefined && { commentsForNotes: commentsForNotes || null }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json(updatedLippingLookup);
  } catch (error) {
    console.error('Error updating lipping lookup:', error);
    res.status(500).json({ error: 'Failed to update lipping lookup' });
  }
});

// DELETE /lipping-lookup/:id - Delete (soft delete) lipping lookup entry
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.lippingLookup.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Lipping lookup not found' });
    }

    // Soft delete by setting isActive to false
    await prisma.lippingLookup.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ success: true, message: 'Lipping lookup deleted' });
  } catch (error) {
    console.error('Error deleting lipping lookup:', error);
    res.status(500).json({ error: 'Failed to delete lipping lookup' });
  }
});

// POST /lipping-lookup/calculate - Calculate lipping requirements
router.post('/calculate', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { doorsetType, doorWidth, doorHeight, quantity = 1 } = req.body;

    if (!doorsetType) {
      return res.status(400).json({ error: 'doorsetType is required' });
    }

    const lippingLookup = await prisma.lippingLookup.findUnique({
      where: {
        tenantId_doorsetType: {
          tenantId,
          doorsetType
        }
      }
    });

    if (!lippingLookup) {
      return res.status(404).json({ error: 'Lipping lookup not found for this doorset type' });
    }

    // Calculate total lipping required
    const calculations = {
      doorsetType: lippingLookup.doorsetType,
      perDoor: {
        topMm: lippingLookup.topMm,
        bottomMm: lippingLookup.bottomMm,
        hingeMm: lippingLookup.hingeMm,
        lockMm: lippingLookup.lockMm,
        safeHingeMm: lippingLookup.safeHingeMm,
        daExposedMm: lippingLookup.daExposedMm,
        trimMm: lippingLookup.trimMm,
        postformedMm: lippingLookup.postformedMm,
        extrasMm: lippingLookup.extrasMm
      },
      totalForQuantity: {
        topLinearMeters: doorWidth && lippingLookup.topMm ? (doorWidth / 1000) * quantity : null,
        bottomLinearMeters: doorWidth && lippingLookup.bottomMm ? (doorWidth / 1000) * quantity : null,
        hingeLinearMeters: doorHeight && lippingLookup.hingeMm ? (doorHeight / 1000) * quantity : null,
        lockLinearMeters: doorHeight && lippingLookup.lockMm ? (doorHeight / 1000) * quantity : null,
        safeHingeLinearMeters: doorHeight && lippingLookup.safeHingeMm ? (doorHeight / 1000) * quantity : null,
        daExposedLinearMeters: doorHeight && lippingLookup.daExposedMm ? (doorHeight / 1000) * quantity : null
      },
      commentsForNotes: lippingLookup.commentsForNotes,
      quantity
    };

    res.json(calculations);
  } catch (error) {
    console.error('Error calculating lipping:', error);
    res.status(500).json({ error: 'Failed to calculate lipping' });
  }
});

export default router;
