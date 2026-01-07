import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createRFISchema = z.object({
  fireDoorLineItemId: z.string(),
  field: z.string(),
  question: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignedTo: z.string().optional(),
  visibleToCustomer: z.boolean().default(true),
});

const updateRFISchema = z.object({
  status: z.enum(['open', 'answered', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.string().nullable().optional(),
  response: z.string().nullable().optional(),
  visibleToCustomer: z.boolean().optional(),
});

// GET /api/fire-door-rfis - List all RFIs for tenant
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, priority, fireDoorLineItemId, projectId } = req.query;
    const tenantId = req.auth!.tenantId;

    const where: any = { tenantId };

    if (status) where.status = status as string;
    if (priority) where.priority = priority as string;
    if (fireDoorLineItemId) where.fireDoorLineItemId = fireDoorLineItemId as string;
    if (projectId) {
      where.lineItem = { projectId: projectId as string };
    }

    const rfis = await prisma.fireDoorRFI.findMany({
      where,
      include: {
        lineItem: {
          select: {
            id: true,
            mjsNumber: true,
            location: true,
            projectId: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // open first
        { priority: 'desc' }, // urgent first
        { createdAt: 'desc' },
      ],
    });

    res.json(rfis);
  } catch (error) {
    console.error('Error fetching RFIs:', error);
    res.status(500).json({ error: 'Failed to fetch RFIs' });
  }
});

// GET /api/fire-door-rfis/:id - Get single RFI
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.auth!.tenantId;

    const rfi = await prisma.fireDoorRFI.findFirst({
      where: { id, tenantId },
      include: {
        lineItem: {
          select: {
            id: true,
            mjsNumber: true,
            location: true,
            projectId: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    res.json(rfi);
  } catch (error) {
    console.error('Error fetching RFI:', error);
    res.status(500).json({ error: 'Failed to fetch RFI' });
  }
});

// POST /api/fire-door-rfis - Create new RFI
router.post('/', requireAuth, async (req, res) => {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const data = createRFISchema.parse(req.body);

    // Verify line item belongs to tenant
    const lineItem = await prisma.fireDoorScheduleProject.findFirst({
      where: {
        id: data.fireDoorLineItemId,
        tenantId,
      },
    });

    if (!lineItem) {
      return res.status(404).json({ error: 'Fire door line item not found' });
    }

    const rfi = await prisma.fireDoorRFI.create({
      data: {
        ...data,
        tenantId,
        createdBy: userId,
      },
      include: {
        lineItem: {
          select: {
            id: true,
            mjsNumber: true,
            location: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(rfi);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating RFI:', error);
    res.status(500).json({ error: 'Failed to create RFI' });
  }
});

// PATCH /api/fire-door-rfis/:id - Update RFI
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.auth!.tenantId;

    const data = updateRFISchema.parse(req.body);

    // Verify RFI belongs to tenant
    const existingRFI = await prisma.fireDoorRFI.findFirst({
      where: { id, tenantId },
    });

    if (!existingRFI) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    // Auto-set timestamps based on status changes
    const updateData: any = { ...data };

    if (data.response && !existingRFI.respondedAt) {
      updateData.respondedAt = new Date();
    }

    if (data.status === 'closed' && existingRFI.status !== 'closed') {
      updateData.resolvedAt = new Date();
    }

    const rfi = await prisma.fireDoorRFI.update({
      where: { id },
      data: updateData,
      include: {
        lineItem: {
          select: {
            id: true,
            mjsNumber: true,
            location: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json(rfi);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating RFI:', error);
    res.status(500).json({ error: 'Failed to update RFI' });
  }
});

// DELETE /api/fire-door-rfis/:id - Delete RFI
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.auth!.tenantId;

    // Verify RFI belongs to tenant
    const existingRFI = await prisma.fireDoorRFI.findFirst({
      where: { id, tenantId },
    });

    if (!existingRFI) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    await prisma.fireDoorRFI.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting RFI:', error);
    res.status(500).json({ error: 'Failed to delete RFI' });
  }
});

// GET /api/fire-door-rfis/customer/:clientAccountId - Get customer-visible RFIs
router.get('/customer/:clientAccountId', async (req, res) => {
  try {
    const { clientAccountId } = req.params;

    // Find all fire door projects for this client
    const fireDoorProjects = await prisma.fireDoorScheduleProject.findMany({
      where: { clientName: clientAccountId }, // Using clientName as identifier
      select: { id: true },
    });

    const lineItemIds = fireDoorProjects.map((p) => p.id);

    // Get RFIs for these line items
    const rfis = await prisma.fireDoorRFI.findMany({
      where: {
        visibleToCustomer: true,
        status: { in: ['open', 'answered'] }, // Don't show closed RFIs
        fireDoorLineItemId: { in: lineItemIds },
      },
      include: {
        lineItem: {
          select: {
            id: true,
            mjsNumber: true,
            location: true,
            projectId: true,
          },
        },
        creator: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json(rfis);
  } catch (error) {
    console.error('Error fetching customer RFIs:', error);
    res.status(500).json({ error: 'Failed to fetch RFIs' });
  }
});

export default router;
