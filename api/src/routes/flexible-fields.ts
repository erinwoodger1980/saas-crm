/**
 * Field Management API Routes
 * Endpoints for managing custom fields, lookup tables, and display contexts
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ============================================================================
// FIELD ENDPOINTS
// ============================================================================

/**
 * GET /api/fields
 * Get all fields for a tenant, optionally filtered by scope or context
 */
router.get('/fields', async (req: Request, res: Response) => {
  try {
    const { tenantId, scope, context, includeDisplayContexts } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const where: any = { tenantId: tenantId as string };
    if (scope) where.scope = scope as string;

    let fields = await prisma.questionnaireField.findMany({
      where,
      include: {
        displayContexts: includeDisplayContexts === 'true',
        componentLookup: false,
        lookupTable: false,
      },
      orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }],
    });

    // Filter by context if requested
    if (context) {
      fields = fields.filter(
        (field: any) =>
          field.defaultContexts.includes(context as string) ||
          (field.displayContexts?.some((dc: any) => dc.context === context))
      );
    }

    return res.json(fields);
  } catch (error) {
    console.error('Error fetching fields:', error);
    return res.status(500).json({ error: 'Failed to fetch fields' });
  }
});

/**
 * GET /api/fields/:fieldId
 * Get a specific field with all details
 */
router.get('/fields/:fieldId', async (req: Request, res: Response) => {
  try {
    const { fieldId } = req.params;

    const field = await prisma.questionnaireField.findUnique({
      where: { id: fieldId },
      include: {
        displayContexts: true,
        componentLookup: true,
        lookupTable: true,
      },
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    return res.json(field);
  } catch (error) {
    console.error('Error fetching field:', error);
    return res.status(500).json({ error: 'Failed to fetch field' });
  }
});

/**
 * POST /api/fields
 * Create a new custom field
 */
router.post('/fields', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      key,
      label,
      type,
      scope,
      helpText,
      options,
      required,
      showInPublicForm,
      showInQuote,
      defaultContexts,
      ...otherFields
    } = req.body;

    if (!tenantId || !key || !label || !type || !scope) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, key, label, type, scope',
      });
    }

    // Check for duplicate key within tenant and scope
    const existing = await prisma.questionnaireField.findFirst({
      where: { tenantId, key, scope },
    });

    if (existing) {
      return res.status(409).json({
        error: `Field with key "${key}" already exists for scope "${scope}"`,
      });
    }

    const field = await prisma.questionnaireField.create({
      data: {
        tenantId,
        key,
        label,
        type,
        scope,
        helpText,
        options,
        required,
        showInPublicForm,
        showInQuote,
        defaultContexts: defaultContexts || [],
        ...otherFields,
      },
    });

    return res.status(201).json(field);
  } catch (error) {
    console.error('Error creating field:', error);
    return res.status(500).json({ error: 'Failed to create field' });
  }
});

/**
 * PATCH /api/fields/:fieldId
 * Update a field
 */
router.patch('/fields/:fieldId', async (req: Request, res: Response) => {
  try {
    const { fieldId } = req.params;
    const updates = req.body;

    const field = await prisma.questionnaireField.update({
      where: { id: fieldId },
      data: updates,
      include: {
        displayContexts: true,
        componentLookup: true,
        lookupTable: true,
      },
    });

    return res.json(field);
  } catch (error) {
    console.error('Error updating field:', error);
    return res.status(500).json({ error: 'Failed to update field' });
  }
});

/**
 * DELETE /api/fields/:fieldId
 * Delete a field (soft delete by marking inactive)
 */
router.delete('/fields/:fieldId', async (req: Request, res: Response) => {
  try {
    const { fieldId } = req.params;

    await prisma.questionnaireField.update({
      where: { id: fieldId },
      data: { isActive: false },
    });

    return res.json({ success: true, message: 'Field deleted' });
  } catch (error) {
    console.error('Error deleting field:', error);
    return res.status(500).json({ error: 'Failed to delete field' });
  }
});

// ============================================================================
// FIELD DISPLAY CONTEXT ENDPOINTS
// ============================================================================

/**
 * GET /api/display-contexts
 * Get display context configuration for a tenant
 */
router.get('/display-contexts', async (req: Request, res: Response) => {
  try {
    const { tenantId, context } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const where: any = { tenantId: tenantId as string };
    if (context) where.context = context as string;

    const contexts = await prisma.fieldDisplayContext.findMany({
      where,
      include: { field: true },
      orderBy: [{ context: 'asc' }, { sortOrder: 'asc' }],
    });

    return res.json(contexts);
  } catch (error) {
    console.error('Error fetching display contexts:', error);
    return res.status(500).json({ error: 'Failed to fetch display contexts' });
  }
});

/**
 * POST /api/display-contexts
 * Set display context for a field
 */
router.post('/display-contexts', async (req: Request, res: Response) => {
  try {
    const { tenantId, fieldId, context, isVisible, sortOrder } = req.body;

    if (!tenantId || !fieldId || !context) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, fieldId, context',
      });
    }

    // Check if context already exists
    const existing = await prisma.fieldDisplayContext.findFirst({
      where: { tenantId, fieldId, context },
    });

    if (existing) {
      // Update existing
      const updated = await prisma.fieldDisplayContext.update({
        where: { id: existing.id },
        data: { isVisible: isVisible ?? existing.isVisible, sortOrder: sortOrder ?? existing.sortOrder },
      });
      return res.json(updated);
    }

    // Create new
    const displayContext = await prisma.fieldDisplayContext.create({
      data: {
        tenantId,
        fieldId,
        context,
        isVisible: isVisible ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    return res.status(201).json(displayContext);
  } catch (error) {
    console.error('Error creating display context:', error);
    return res.status(500).json({ error: 'Failed to create display context' });
  }
});

/**
 * PATCH /api/display-contexts/:contextId
 * Update display context configuration
 */
router.patch('/display-contexts/:contextId', async (req: Request, res: Response) => {
  try {
    const { contextId } = req.params;
    const updates = req.body;

    const displayContext = await prisma.fieldDisplayContext.update({
      where: { id: contextId },
      data: updates,
    });

    return res.json(displayContext);
  } catch (error) {
    console.error('Error updating display context:', error);
    return res.status(500).json({ error: 'Failed to update display context' });
  }
});

/**
 * DELETE /api/display-contexts/:contextId
 * Remove display context configuration
 */
router.delete('/display-contexts/:contextId', async (req: Request, res: Response) => {
  try {
    const { contextId } = req.params;

    await prisma.fieldDisplayContext.delete({
      where: { id: contextId },
    });

    return res.json({ success: true, message: 'Display context deleted' });
  } catch (error) {
    console.error('Error deleting display context:', error);
    return res.status(500).json({ error: 'Failed to delete display context' });
  }
});

// ============================================================================
// LOOKUP TABLE ENDPOINTS
// ============================================================================

/**
 * GET /api/lookup-tables
 * Get all lookup tables for a tenant
 */
router.get('/lookup-tables', async (req: Request, res: Response) => {
  try {
    const { tenantId, name } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const where: any = { tenantId: tenantId as string };
    if (name) where.name = { contains: name as string, mode: 'insensitive' };

    const tables = await prisma.lookupTable.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return res.json(tables);
  } catch (error) {
    console.error('Error fetching lookup tables:', error);
    return res.status(500).json({ error: 'Failed to fetch lookup tables' });
  }
});

/**
 * POST /api/lookup-tables
 * Create a new lookup table
 */
router.post('/lookup-tables', async (req: Request, res: Response) => {
  try {
    const { tenantId, name, description, columns, rows } = req.body;

    if (!tenantId || !name || !columns || !rows) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, name, columns, rows',
      });
    }

    // Check for duplicate name
    const existing = await prisma.lookupTable.findFirst({
      where: { tenantId, name },
    });

    if (existing) {
      return res.status(409).json({ error: `Lookup table "${name}" already exists` });
    }

    const table = await prisma.lookupTable.create({
      data: {
        tenantId,
        name,
        description,
        columns,
        rows,
        isStandard: false,
      },
    });

    return res.status(201).json(table);
  } catch (error) {
    console.error('Error creating lookup table:', error);
    return res.status(500).json({ error: 'Failed to create lookup table' });
  }
});

/**
 * PATCH /api/lookup-tables/:tableId
 * Update a lookup table
 */
router.patch('/lookup-tables/:tableId', async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const { rows, name, description } = req.body;

    const table = await prisma.lookupTable.update({
      where: { id: tableId },
      data: {
        ...(rows && { rows }),
        ...(name && { name }),
        ...(description && { description }),
      },
    });

    return res.json(table);
  } catch (error) {
    console.error('Error updating lookup table:', error);
    return res.status(500).json({ error: 'Failed to update lookup table' });
  }
});

/**
 * DELETE /api/lookup-tables/:tableId
 * Delete a lookup table
 */
router.delete('/lookup-tables/:tableId', async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;

    await prisma.lookupTable.delete({
      where: { id: tableId },
    });

    return res.json({ success: true, message: 'Lookup table deleted' });
  } catch (error) {
    console.error('Error deleting lookup table:', error);
    return res.status(500).json({ error: 'Failed to delete lookup table' });
  }
});

// ============================================================================
// ML TRAINING EVENT ENDPOINTS
// ============================================================================

/**
 * POST /api/ml-training-events
 * Log an ML training event
 */
router.post('/ml-training-events', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      eventType,
      leadId,
      quoteId,
      fieldId,
      fieldValue,
      estimatedPrice,
      quotedPrice,
      acceptedPrice,
      wasAccepted,
      contextSnapshot,
    } = req.body;

    if (!tenantId || !eventType || !contextSnapshot) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, eventType, contextSnapshot',
      });
    }

    const event = await prisma.mLTrainingEvent.create({
      data: {
        tenantId,
        eventType,
        leadId,
        quoteId,
        fieldId,
        fieldValue,
        estimatedPrice,
        quotedPrice,
        acceptedPrice,
        wasAccepted,
        contextSnapshot,
      },
    });

    return res.status(201).json(event);
  } catch (error) {
    console.error('Error creating ML training event:', error);
    return res.status(500).json({ error: 'Failed to log training event' });
  }
});

/**
 * GET /api/ml-training-events
 * Get ML training events for analysis
 */
router.get('/ml-training-events', async (req: Request, res: Response) => {
  try {
    const { tenantId, eventType, leadId, limit } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const where: any = { tenantId: tenantId as string };
    if (eventType) where.eventType = eventType as string;
    if (leadId) where.leadId = leadId as string;

    const events = await prisma.mLTrainingEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 100,
    });

    return res.json(events);
  } catch (error) {
    console.error('Error fetching ML training events:', error);
    return res.status(500).json({ error: 'Failed to fetch training events' });
  }
});

// ============================================================================
// FIELD EVALUATION ENDPOINT
// ============================================================================

/**
 * POST /api/evaluate-field
 * Evaluate a field (run calculation or lookup)
 */
router.post('/evaluate-field', async (req: Request, res: Response) => {
  try {
    const { tenantId, fieldId, inputs, context } = req.body;

    if (!tenantId || !fieldId) {
      return res.status(400).json({ error: 'Missing required fields: tenantId, fieldId' });
    }

    const field = await prisma.questionnaireField.findUnique({
      where: { id: fieldId },
      include: { lookupTable: true },
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    let result: any;

    // Handle calculation formula
    if (field.calculationFormula && inputs) {
      try {
        // Simple formula evaluation (would need more security for production)
        // Replace field references with values from inputs
        let formula = field.calculationFormula;
        Object.entries(inputs).forEach(([key, value]) => {
          formula = formula.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
        });

        // eslint-disable-next-line no-eval
        result = eval(formula);
      } catch (e) {
        return res.status(400).json({ error: 'Failed to evaluate formula' });
      }
    }

    // Handle lookup table
    if (field.lookupTableId && field.lookupTable && inputs && field.lookupInputFields) {
      const table = field.lookupTable;
      const rows = table.rows as any[];

      // Filter rows based on lookup input fields
      const matchingRow = rows.find((row: any) =>
        field.lookupInputFields!.every(
          (inputField: string) =>
            row[inputField] === inputs[inputField] ||
            String(row[inputField]).toLowerCase() === String(inputs[inputField]).toLowerCase()
        )
      );

      if (matchingRow && field.lookupOutputField) {
        result = matchingRow[field.lookupOutputField];
      }
    }

    // Log ML training event if field is used for training
    if (field.usedForMLTraining) {
      await prisma.mLTrainingEvent.create({
        data: {
          tenantId,
          eventType: 'field_evaluated',
          fieldId,
          fieldValue: result,
          contextSnapshot: { inputs, context },
        },
      });
    }

    return res.json({ result, field: { id: field.id, key: field.key, label: field.label } });
  } catch (error) {
    console.error('Error evaluating field:', error);
    return res.status(500).json({ error: 'Failed to evaluate field' });
  }
});

export default router;
