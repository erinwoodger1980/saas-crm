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
      markupPercent,
      deliveryCost,
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
        // Auto-create lead for this fire door project
        lead = await tx.lead.create({
          data: {
            tenantId,
            createdById: userId,
            contactName: clientName || 'Fire Door Customer',
            email: contactEmail,
            status: 'QUALIFIED', // Start as QUALIFIED since this is an actual order
            capturedAt: new Date(),
            estimatedValue: totalValue,
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

      // Create opportunity (WON) for this fire door project
      const opportunity = await tx.opportunity.upsert({
        where: { leadId: lead!.id },
        update: {
          valueGBP: totalValue,
          deliveryDate: dateRequired ? new Date(dateRequired) : null,
        },
        create: {
          tenantId,
          leadId: lead!.id,
          title: title || 'Fire Door Project',
          stage: 'WON',
          wonAt: new Date(),
          valueGBP: totalValue,
          deliveryDate: dateRequired ? new Date(dateRequired) : null,
        },
      });

      // Create standard quote
      const quote = await tx.quote.create({
        data: {
          tenantId,
          leadId: lead!.id,
          title: title || 'Fire Door Quote',
          status: 'ACCEPTED', // Fire door orders are accepted quotes
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
            markupPercent,
            deliveryCost,
            fireDoorImportId,
            opportunityId: opportunity.id,
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
            projectId: opportunity.id, // Link to opportunity, not quote
            mjsNumber: projectReference || undefined,
            jobName: title,
            clientName,
            dateReceived: new Date(),
            dateRequired: dateRequired ? new Date(dateRequired) : undefined,
            poNumber,
            jobLocation: 'RED FOLDER',
            signOffStatus: 'NOT LOOKED AT',
            lastUpdatedBy: userId,
          },
        });
      }

      return { quote, lead: lead!, opportunity };
    });

    return res.json({
      id: result.quote.id,
      leadId: result.lead.id,
      opportunityId: result.opportunity.id,
      title: result.quote.title,
      totalValue,
      status: result.quote.status,
      stage: result.opportunity.stage,
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
      markupPercent: quoteMeta.markupPercent ?? null,
      deliveryCost: quoteMeta.deliveryCost ?? null,
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
      markupPercent,
      deliveryCost,
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
        include: { lines: true, lead: { include: { opportunity: true } } },
      });

      if (!existing) {
        throw new Error('Quote not found');
      }

      // Update opportunity if it exists
      if (existing.lead?.opportunity) {
        await tx.opportunity.update({
          where: { id: existing.lead.opportunity.id },
          data: {
            valueGBP: totalValue,
            deliveryDate: dateRequired ? new Date(dateRequired) : null,
          },
        });
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
            markupPercent,
            deliveryCost,
            opportunityId: existing.lead?.opportunity?.id,
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
          status: 'QUALIFIED', // Imported orders are qualified leads
          capturedAt: new Date(),
          estimatedValue: importRecord.totalValue,
          custom: {
            importId,
            sourceName: importRecord.sourceName,
            contactPhone,
          },
        },
      });

      // Create opportunity (WON) for imported fire door project
      const opportunity = await tx.opportunity.create({
        data: {
          tenantId,
          leadId: lead.id,
          title: title || `Fire Door Project - ${importRecord.sourceName}`,
          stage: 'WON',
          wonAt: new Date(),
          valueGBP: importRecord.totalValue,
        },
      });

      // Create quote
      const quote = await tx.quote.create({
        data: {
          tenantId,
          leadId: lead.id,
          title: title || `Fire Door Quote - ${importRecord.sourceName}`,
          status: 'ACCEPTED', // Imported orders are accepted quotes
          totalGBP: importRecord.totalValue,
          currency: importRecord.currency,
          meta: {
            type: 'FIRE_DOOR',
            clientName,
            contactEmail,
            contactPhone,
            fireDoorImportId: importId,
            sourceName: importRecord.sourceName,
            opportunityId: opportunity.id,
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
            projectId: opportunity.id, // Link to opportunity
            jobName: title || importRecord.sourceName,
            clientName,
            dateReceived: new Date(),
            jobLocation: 'RED FOLDER',
            signOffStatus: 'NOT LOOKED AT',
            lastUpdatedBy: userId,
          },
        });
      }

      return { quote, lead, opportunity };
    });

    return res.json({
      id: result.quote.id,
      leadId: result.lead.id,
      opportunityId: result.opportunity.id,
      title: result.quote.title,
      totalValue: Number(result.quote.totalGBP),
      stage: result.opportunity.stage,
      message: 'Import successfully converted to quote with WON opportunity',
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
