import express from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const CreateMaterialSchema = z.object({
  category: z.enum([
    'TIMBER_HARDWOOD',
    'TIMBER_SOFTWOOD',
    'BOARD_MDF',
    'BOARD_PLYWOOD',
    'MOULDING_BEAD',
    'MOULDING_GROOVE',
    'RAISED_PANEL',
    'VENEER_SHEET',
  ]),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  supplierId: z.string().optional(),
  unitCost: z.number().min(0).default(0),
  currency: z.string().default('GBP'),
  unit: z.string().default('m'),
  thickness: z.number().optional(),
  width: z.number().optional(),
  length: z.number().optional(),
  species: z.string().optional(),
  grade: z.string().optional(),
  finish: z.string().optional(),
  color: z.string().optional(), // Hex color
  colorName: z.string().optional(),
  textureUrl: z.string().optional(),
  textureType: z.string().optional(),
  roughness: z.number().min(0).max(1).default(0.5),
  metalness: z.number().min(0).max(1).default(0),
  opacity: z.number().min(0).max(1).default(1),
  renderingProps: z.any().optional(),
  isActive: z.boolean().default(true),
  isStock: z.boolean().default(false),
  leadTimeDays: z.number().optional(),
  minOrderQty: z.number().optional(),
  notes: z.string().optional(),
});

const UpdateMaterialSchema = CreateMaterialSchema.partial();

/**
 * GET /api/materials
 * List all materials for tenant
 */
router.get('/', async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { category, colorName, isActive } = req.query;

    const where: any = { tenantId: auth.tenantId };
    if (category) where.category = category;
    if (colorName) where.colorName = { contains: colorName as string, mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const materials = await prisma.material.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { colorName: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json(materials);
  } catch (error: any) {
    console.error('[Materials API] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch materials', message: error.message });
  }
});

/**
 * GET /api/materials/:id
 * Get single material by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const material = await prisma.material.findFirst({
      where: {
        id: req.params.id,
        tenantId: auth.tenantId,
      },
      include: {
        supplier: true,
      },
    });

    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json(material);
  } catch (error: any) {
    console.error('[Materials API] GET/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch material', message: error.message });
  }
});

/**
 * POST /api/materials
 * Create new material
 */
router.post('/', async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = CreateMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error });
    }

    const data = parsed.data;

    // Check for duplicate code
    const existing = await prisma.material.findFirst({
      where: {
        tenantId: auth.tenantId,
        code: data.code,
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Material code already exists' });
    }

    const material = await prisma.material.create({
      data: {
        ...data,
        tenantId: auth.tenantId,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    console.log('[Materials API] Created material:', material.code);
    res.json(material);
  } catch (error: any) {
    console.error('[Materials API] POST error:', error);
    res.status(500).json({ error: 'Failed to create material', message: error.message });
  }
});

/**
 * PATCH /api/materials/:id
 * Update material
 */
router.patch('/:id', async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = UpdateMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error });
    }

    const data = parsed.data;

    // Verify ownership
    const existing = await prisma.material.findFirst({
      where: {
        id: req.params.id,
        tenantId: auth.tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Material not found' });
    }

    // Check for code conflict if code is being changed
    if (data.code && data.code !== existing.code) {
      const codeConflict = await prisma.material.findFirst({
        where: {
          tenantId: auth.tenantId,
          code: data.code,
          id: { not: req.params.id },
        },
      });

      if (codeConflict) {
        return res.status(409).json({ error: 'Material code already exists' });
      }
    }

    const material = await prisma.material.update({
      where: { id: req.params.id },
      data,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    console.log('[Materials API] Updated material:', material.code);
    res.json(material);
  } catch (error: any) {
    console.error('[Materials API] PATCH error:', error);
    res.status(500).json({ error: 'Failed to update material', message: error.message });
  }
});

/**
 * DELETE /api/materials/:id
 * Delete material
 */
router.delete('/:id', async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify ownership
    const existing = await prisma.material.findFirst({
      where: {
        id: req.params.id,
        tenantId: auth.tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Material not found' });
    }

    await prisma.material.delete({
      where: { id: req.params.id },
    });

    console.log('[Materials API] Deleted material:', existing.code);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Materials API] DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete material', message: error.message });
  }
});

/**
 * GET /api/materials/colors/list
 * Get list of unique colors for filtering
 */
router.get('/colors/list', async (req, res) => {
  try {
    const auth = (req as any).auth;
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const materials = await prisma.material.findMany({
      where: {
        tenantId: auth.tenantId,
        colorName: { not: null },
        isActive: true,
      },
      select: {
        color: true,
        colorName: true,
      },
      distinct: ['colorName'],
    });

    const colors = materials
      .filter(m => m.colorName)
      .map(m => ({
        name: m.colorName,
        hex: m.color,
      }));

    res.json(colors);
  } catch (error: any) {
    console.error('[Materials API] GET colors/list error:', error);
    res.status(500).json({ error: 'Failed to fetch colors', message: error.message });
  }
});

export default router;
