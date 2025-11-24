/**
 * Ironmongery Items API Routes
 * CRUD operations for ironmongery items (hinges, locks, handles, etc.)
 * Used by fire door production system for ironmongery dropdowns
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/ironmongery-items
 * List all ironmongery items for tenant
 */
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const includeInactive = req.query.includeInactive === 'true';
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    let where: any = { tenantId };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.ironmongeryItem.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { code: 'asc' },
      ],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        description: true,
        supplier: true,
        unitCost: true,
        currency: true,
        finish: true,
        fireRating: true,
        isActive: true,
        leadTimeDays: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      ok: true,
      items: items.map((item) => ({
        ...item,
        unitCost: Number(item.unitCost),
      })),
    });
  } catch (error: any) {
    console.error('[GET /ironmongery-items] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch ironmongery items',
      detail: error?.message,
    });
  }
});

/**
 * GET /api/ironmongery-items/categories
 * Get list of all ironmongery categories in use
 */
router.get('/categories', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;

    const items = await prisma.ironmongeryItem.findMany({
      where: { tenantId },
      select: { category: true },
      distinct: ['category'],
    });

    const categories = items
      .map((item) => item.category)
      .filter(Boolean)
      .sort();

    res.json({
      ok: true,
      categories,
    });
  } catch (error: any) {
    console.error('[GET /ironmongery-items/categories] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch categories',
      detail: error?.message,
    });
  }
});

/**
 * GET /api/ironmongery-items/:id
 * Get a specific ironmongery item
 */
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { id } = req.params;

    const item = await prisma.ironmongeryItem.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: 'Ironmongery item not found',
      });
    }

    res.json({
      ok: true,
      item: {
        ...item,
        unitCost: Number(item.unitCost),
      },
    });
  } catch (error: any) {
    console.error('[GET /ironmongery-items/:id] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch ironmongery item',
      detail: error?.message,
    });
  }
});

/**
 * POST /api/ironmongery-items
 * Create a new ironmongery item
 */
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const {
      code,
      name,
      category,
      description,
      supplier,
      unitCost,
      currency = 'GBP',
      finish,
      fireRating,
      isActive = true,
      leadTimeDays,
      notes,
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        ok: false,
        error: 'Code and name are required',
      });
    }

    const item = await prisma.ironmongeryItem.create({
      data: {
        tenantId,
        code,
        name,
        category,
        description,
        supplier,
        unitCost: unitCost || 0,
        currency,
        finish,
        fireRating,
        isActive,
        leadTimeDays,
        notes,
      },
    });

    res.json({
      ok: true,
      item: {
        ...item,
        unitCost: Number(item.unitCost),
      },
    });
  } catch (error: any) {
    console.error('[POST /ironmongery-items] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create ironmongery item',
      detail: error?.message,
    });
  }
});

/**
 * PUT /api/ironmongery-items/:id
 * Update an ironmongery item
 */
router.put('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { id } = req.params;
    const {
      code,
      name,
      category,
      description,
      supplier,
      unitCost,
      currency,
      finish,
      fireRating,
      isActive,
      leadTimeDays,
      notes,
    } = req.body;

    // Verify ownership
    const existing = await prisma.ironmongeryItem.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: 'Ironmongery item not found',
      });
    }

    const item = await prisma.ironmongeryItem.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(supplier !== undefined && { supplier }),
        ...(unitCost !== undefined && { unitCost }),
        ...(currency !== undefined && { currency }),
        ...(finish !== undefined && { finish }),
        ...(fireRating !== undefined && { fireRating }),
        ...(isActive !== undefined && { isActive }),
        ...(leadTimeDays !== undefined && { leadTimeDays }),
        ...(notes !== undefined && { notes }),
      },
    });

    res.json({
      ok: true,
      item: {
        ...item,
        unitCost: Number(item.unitCost),
      },
    });
  } catch (error: any) {
    console.error('[PUT /ironmongery-items/:id] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update ironmongery item',
      detail: error?.message,
    });
  }
});

/**
 * DELETE /api/ironmongery-items/:id
 * Soft delete an ironmongery item (set isActive = false)
 */
router.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.ironmongeryItem.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: 'Ironmongery item not found',
      });
    }

    // Soft delete by setting isActive = false
    await prisma.ironmongeryItem.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      ok: true,
      message: 'Ironmongery item deactivated',
    });
  } catch (error: any) {
    console.error('[DELETE /ironmongery-items/:id] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete ironmongery item',
      detail: error?.message,
    });
  }
});

export default router;
