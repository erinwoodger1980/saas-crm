/**
 * Fire Door Quotes API Routes
 * Dedicated quote management for fire door projects
 * Separate from standard joinery quotes
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/fire-door-quotes
 * Create a new fire door quote
 */
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const userId = req.auth.userId;

    const {
      title,
      clientName,
      projectReference,
      siteAddress,
      deliveryAddress,
      contactEmail,
      contactPhone,
      poNumber,
      dateRequired,
      lineItems = [],
      notes,
      leadId,
      fireDoorImportId,
    } = req.body;

    // Calculate total value from line items
    const totalValue = lineItems.reduce((sum: number, item: any) => {
      return sum + (item.lineTotal || 0);
    }, 0);

    // Create quote in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create or find lead
      let lead;
      if (leadId) {
        lead = await tx.lead.findFirst({
          where: { id: leadId, tenantId },
        });
      } else {
        // Auto-create lead for this quote
        lead = await tx.lead.create({
          data: {
            tenantId,
            createdById: userId,
            contactName: clientName || 'Fire Door Customer',
            email: contactEmail,
            status: 'NEW',
            capturedAt: new Date(),
            custom: {
              projectReference,
              siteAddress,
              deliveryAddress,
              dateRequired,
              contactPhone,
            },
          },
        });
      }

      // Create standard quote
      const quote = await tx.quote.create({
        data: {
          tenantId,
          leadId: lead!.id,
          title: title || 'Fire Door Quote',
          status: 'DRAFT',
          totalGBP: totalValue,
          currency: 'GBP',
          notes,
          meta: {
            type: 'FIRE_DOOR',
            clientName,
            projectReference,
            siteAddress,
            deliveryAddress,
            contactEmail,
            contactPhone,
            poNumber,
            dateRequired,
            fireDoorImportId,
          },
        },
      });

      // Create line items in quotes table
      for (const item of lineItems) {
        await tx.quoteLine.create({
          data: {
            quoteId: quote.id,
            description: `${item.doorRef || 'Door'} - ${item.location || ''} - ${item.fireRating || ''}`,
            qty: item.quantity || 1,
            unitPrice: item.unitValue || 0,
            lineTotalGBP: item.lineTotal || 0,
            meta: item, // Store full fire door specification
          },
        });
      }

      // Link import if provided
      if (fireDoorImportId) {
        await tx.fireDoorImport.update({
          where: { id: fireDoorImportId },
          data: { orderId: quote.id },
        });
      }

      // Create fire door schedule project if manufacturer
      const tenantSettings = await tx.tenantSettings.findUnique({
        where: { tenantId },
      });

      if (tenantSettings?.isFireDoorManufacturer) {
        await tx.fireDoorScheduleProject.create({
          data: {
            tenantId,
            projectId: quote.id,
            mjsNumber: projectReference || undefined,
            jobName: title,
            clientName,
            dateReceived: new Date(),
            dateRequired: dateRequired ? new Date(dateRequired) : undefined,
            poNumber,
            jobLocation: 'RED FOLDER',
            signOffStatus: 'NOT LOOKED AT',
            orderingStatus: 'NOT IN BOM',
            lastUpdatedBy: userId,
          },
        });
      }

      return { quote, lead: lead! };
    });

    return res.json({
      id: result.quote.id,
      leadId: result.lead.id,
      title: result.quote.title,
      totalValue,
      status: result.quote.status,
    });
  } catch (error: any) {
    console.error('[fire-door-quotes] Create error:', error);
    return res.status(500).json({ error: 'Failed to create quote' });
  }
});

/**
 * GET /api/fire-door-quotes/:id
 * Get a specific fire door quote with all line items
 */
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const quoteId = req.params.id;

    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenantId,
      },
      include: {
        lines: true,
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
            custom: true,
          },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const quoteMeta = (quote.meta as any) || {};
    const leadCustom = (quote.lead?.custom as any) || {};
    const quoteWithLines = quote as typeof quote & { lines: any[] };

    // Transform to fire door quote format
    const fireDoorQuote = {
      id: quote.id,
      leadId: quote.leadId,
      title: quote.title,
      clientName: quoteMeta.clientName || quote.lead?.contactName,
      projectReference: quoteMeta.projectReference,
      siteAddress: quoteMeta.siteAddress,
      deliveryAddress: quoteMeta.deliveryAddress,
      contactEmail: quoteMeta.contactEmail || quote.lead?.email,
      contactPhone: quoteMeta.contactPhone || leadCustom.contactPhone,
      poNumber: quoteMeta.poNumber,
      dateRequired: quoteMeta.dateRequired,
      status: quote.status,
      totalValue: Number(quote.totalGBP || 0),
      notes: quote.notes,
      lineItems: quoteWithLines.lines.map((item: any, index: number) => ({
        id: item.id,
        rowIndex: index,
        ...(item.meta || {}),
        quantity: item.qty,
        unitValue: Number(item.unitPrice || 0),
        lineTotal: Number(item.lineTotalGBP || 0),
      })),
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };

    return res.json(fireDoorQuote);
  } catch (error: any) {
    console.error('[fire-door-quotes] Get error:', error);
    return res.status(500).json({ error: 'Failed to get quote' });
  }
});

/**
 * PUT /api/fire-door-quotes/:id
 * Update a fire door quote
 */
router.put('/:id', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const quoteId = req.params.id;

    const {
      title,
      clientName,
      projectReference,
      siteAddress,
      deliveryAddress,
      contactEmail,
      contactPhone,
      poNumber,
      dateRequired,
      lineItems = [],
      notes,
      status,
    } = req.body;

    // Calculate total value
    const totalValue = lineItems.reduce((sum: number, item: any) => {
      return sum + (item.lineTotal || 0);
    }, 0);

    const result = await prisma.$transaction(async (tx) => {
      // Get existing quote
      const existing = await tx.quote.findFirst({
        where: { id: quoteId, tenantId },
        include: { lines: true },
      });

      if (!existing) {
        throw new Error('Quote not found');
      }

      // Update quote
      const quote = await tx.quote.update({
        where: { id: quoteId },
        data: {
          title,
          totalGBP: totalValue,
          status: status || existing.status,
          notes,
          meta: {
            type: 'FIRE_DOOR',
            clientName,
            projectReference,
            siteAddress,
            deliveryAddress,
            contactEmail,
            contactPhone,
            poNumber,
            dateRequired,
          },
        },
      });

      // Delete old line items
      await tx.quoteLine.deleteMany({
        where: { quoteId },
      });

      // Create new line items
      for (const item of lineItems) {
        await tx.quoteLine.create({
          data: {
            quoteId,
            description: `${item.doorRef || 'Door'} - ${item.location || ''} - ${item.fireRating || ''}`,
            qty: item.quantity || 1,
            unitPrice: item.unitValue || 0,
            lineTotalGBP: item.lineTotal || 0,
            meta: item,
          },
        });
      }

      return quote;
    });

    return res.json({
      id: result.id,
      title: result.title,
      totalValue,
      status: result.status,
    });
  } catch (error: any) {
    console.error('[fire-door-quotes] Update error:', error);
    return res.status(500).json({ error: 'Failed to update quote' });
  }
});

/**
 * POST /api/fire-door-quotes/from-import/:importId
 * Convert a fire door import into a quote with lead
 */
router.post('/from-import/:importId', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const userId = req.auth.userId;
    const importId = req.params.importId;

    const {
      title,
      clientName,
      contactEmail,
      contactPhone,
    } = req.body;

    // Get import with line items
    const importRecord = await prisma.fireDoorImport.findFirst({
      where: { id: importId, tenantId },
      include: {
        lineItems: {
          orderBy: { rowIndex: 'asc' },
        },
      },
    });

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (importRecord.orderId) {
      return res.status(400).json({ 
        error: 'Import already converted to quote',
        quoteId: importRecord.orderId,
      });
    }

    // Create quote from import
    const result = await prisma.$transaction(async (tx) => {
      // Create lead
      const lead = await tx.lead.create({
        data: {
          tenantId,
          createdById: userId,
          contactName: clientName || 'Fire Door Customer',
          email: contactEmail,
          status: 'NEW',
          capturedAt: new Date(),
          custom: {
            importId,
            sourceName: importRecord.sourceName,
            contactPhone,
          },
        },
      });

      // Create quote
      const quote = await tx.quote.create({
        data: {
          tenantId,
          leadId: lead.id,
          title: title || `Fire Door Quote - ${importRecord.sourceName}`,
          status: 'DRAFT',
          totalGBP: importRecord.totalValue,
          currency: importRecord.currency,
          meta: {
            type: 'FIRE_DOOR',
            clientName,
            contactEmail,
            contactPhone,
            fireDoorImportId: importId,
            sourceName: importRecord.sourceName,
          },
        },
      });

      // Create line items from import
      for (const item of importRecord.lineItems) {
        await tx.quoteLine.create({
          data: {
            quoteId: quote.id,
            description: `${item.doorRef || 'Door'} - ${item.location || ''} - ${item.rating || ''}`,
            qty: item.quantity || 1,
            unitPrice: item.unitValue || 0,
            lineTotalGBP: item.lineTotal || 0,
            meta: item,
          },
        });
      }

      // Link import to quote
      await tx.fireDoorImport.update({
        where: { id: importId },
        data: { orderId: quote.id },
      });

      // Create fire door schedule project
      const tenantSettings = await tx.tenantSettings.findUnique({
        where: { tenantId },
      });

      if (tenantSettings?.isFireDoorManufacturer) {
        await tx.fireDoorScheduleProject.create({
          data: {
            tenantId,
            projectId: quote.id,
            jobName: title || importRecord.sourceName,
            clientName,
            dateReceived: new Date(),
            jobLocation: 'RED FOLDER',
            signOffStatus: 'NOT LOOKED AT',
            orderingStatus: 'NOT IN BOM',
            lastUpdatedBy: userId,
          },
        });
      }

      return { quote, lead };
    });

    return res.json({
      id: result.quote.id,
      leadId: result.lead.id,
      title: result.quote.title,
      totalValue: Number(result.quote.totalGBP),
      message: 'Import successfully converted to quote',
    });
  } catch (error: any) {
    console.error('[fire-door-quotes] From import error:', error);
    return res.status(500).json({ error: 'Failed to convert import' });
  }
});

/**
 * GET /api/fire-door-quotes
 * List all fire door quotes
 */
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId;

    const quotes = await prisma.quote.findMany({
      where: {
        tenantId,
        meta: {
          path: ['type'],
          equals: 'FIRE_DOOR',
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            status: true,
          },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = quotes.map((quote: any) => {
      const quoteMeta = (quote.meta as any) || {};
      return {
        id: quote.id,
        title: quote.title,
        clientName: quoteMeta.clientName || quote.lead?.contactName,
        projectReference: quoteMeta.projectReference,
        totalValue: Number(quote.totalGBP || 0),
        status: quote.status,
        leadId: quote.leadId,
        leadStatus: quote.lead?.status,
        lineItemCount: quote._count.lines,
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
      };
    });

    return res.json({ quotes: result });
  } catch (error: any) {
    console.error('[fire-door-quotes] List error:', error);
    return res.status(500).json({ error: 'Failed to list quotes' });
  }
});

export default router;
