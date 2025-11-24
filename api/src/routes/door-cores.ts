/**
 * Door Cores API Routes
 * CRUD operations for door core materials (fire-rated door core specifications)
 * Used by fire door production system for material dropdowns
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/door-cores
 * List all door cores for tenant
 */
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const includeInactive = req.query.includeInactive === 'true';
    const search = req.query.search as string | undefined;

    let where: any = { tenantId };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const doorCores = await prisma.doorCore.findMany({
      where,
      orderBy: [
        { fireRating: 'desc' },
        { code: 'asc' },
      ],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        supplier: true,
        unitCost: true,
        currency: true,
        fireRating: true,
        acoustic: true,
        maxHeight: true,
        maxWidth: true,
        weight: true,
        isActive: true,
        leadTimeDays: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      ok: true,
      doorCores: doorCores.map((core) => ({
        ...core,
        unitCost: Number(core.unitCost),
        maxHeight: core.maxHeight ? Number(core.maxHeight) : null,
        maxWidth: core.maxWidth ? Number(core.maxWidth) : null,
        weight: core.weight ? Number(core.weight) : null,
      })),
    });
  } catch (error: any) {
    console.error('[GET /door-cores] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch door cores',
      detail: error?.message,
    });
  }
});

/**
 * GET /api/door-cores/:id
 * Get a specific door core
 */
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { id } = req.params;

    const doorCore = await prisma.doorCore.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!doorCore) {
      return res.status(404).json({
        ok: false,
        error: 'Door core not found',
      });
    }

    res.json({
      ok: true,
      doorCore: {
        ...doorCore,
        unitCost: Number(doorCore.unitCost),
        maxHeight: doorCore.maxHeight ? Number(doorCore.maxHeight) : null,
        maxWidth: doorCore.maxWidth ? Number(doorCore.maxWidth) : null,
        weight: doorCore.weight ? Number(doorCore.weight) : null,
      },
    });
  } catch (error: any) {
    console.error('[GET /door-cores/:id] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch door core',
      detail: error?.message,
    });
  }
});

/**
 * POST /api/door-cores
 * Create a new door core
 */
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const {
      code,
      name,
      description,
      supplier,
      unitCost,
      currency = 'GBP',
      fireRating,
      acoustic,
      maxHeight,
      maxWidth,
      weight,
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

    const doorCore = await prisma.doorCore.create({
      data: {
        tenantId,
        code,
        name,
        description,
        supplier,
        unitCost: unitCost || 0,
        currency,
        fireRating,
        acoustic,
        maxHeight,
        maxWidth,
        weight,
        isActive,
        leadTimeDays,
        notes,
      },
    });

    res.json({
      ok: true,
      doorCore: {
        ...doorCore,
        unitCost: Number(doorCore.unitCost),
        maxHeight: doorCore.maxHeight ? Number(doorCore.maxHeight) : null,
        maxWidth: doorCore.maxWidth ? Number(doorCore.maxWidth) : null,
        weight: doorCore.weight ? Number(doorCore.weight) : null,
      },
    });
  } catch (error: any) {
    console.error('[POST /door-cores] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to create door core',
      detail: error?.message,
    });
  }
});

/**
 * PUT /api/door-cores/:id
 * Update a door core
 */
router.put('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { id } = req.params;
    const {
      code,
      name,
      description,
      supplier,
      unitCost,
      currency,
      fireRating,
      acoustic,
      maxHeight,
      maxWidth,
      weight,
      isActive,
      leadTimeDays,
      notes,
    } = req.body;

    // Verify ownership
    const existing = await prisma.doorCore.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: 'Door core not found',
      });
    }

    const doorCore = await prisma.doorCore.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(supplier !== undefined && { supplier }),
        ...(unitCost !== undefined && { unitCost }),
        ...(currency !== undefined && { currency }),
        ...(fireRating !== undefined && { fireRating }),
        ...(acoustic !== undefined && { acoustic }),
        ...(maxHeight !== undefined && { maxHeight }),
        ...(maxWidth !== undefined && { maxWidth }),
        ...(weight !== undefined && { weight }),
        ...(isActive !== undefined && { isActive }),
        ...(leadTimeDays !== undefined && { leadTimeDays }),
        ...(notes !== undefined && { notes }),
      },
    });

    res.json({
      ok: true,
      doorCore: {
        ...doorCore,
        unitCost: Number(doorCore.unitCost),
        maxHeight: doorCore.maxHeight ? Number(doorCore.maxHeight) : null,
        maxWidth: doorCore.maxWidth ? Number(doorCore.maxWidth) : null,
        weight: doorCore.weight ? Number(doorCore.weight) : null,
      },
    });
  } catch (error: any) {
    console.error('[PUT /door-cores/:id] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to update door core',
      detail: error?.message,
    });
  }
});

/**
 * DELETE /api/door-cores/:id
 * Soft delete a door core (set isActive = false)
 */
router.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.doorCore.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return res.status(404).json({
        ok: false,
        error: 'Door core not found',
      });
    }

    // Soft delete by setting isActive = false
    await prisma.doorCore.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      ok: true,
      message: 'Door core deactivated',
    });
  } catch (error: any) {
    console.error('[DELETE /door-cores/:id] Error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete door core',
      detail: error?.message,
    });
  }
});

export default router;
