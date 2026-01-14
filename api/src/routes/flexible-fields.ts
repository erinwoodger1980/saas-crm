/**
 * Field Management API Routes
 * Endpoints for managing custom fields, lookup tables, and display contexts
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

/**
 * Get tenant ID from request auth context
 * Falls back to query parameter for backward compatibility
 */
function getTenantId(req: any): string | null {
  // First try req.auth (from JWT middleware)
  if (req.auth?.tenantId) {
    return req.auth.tenantId;
  }
  // Fall back to query parameter
  const tenantId = req.query.tenantId;
  return tenantId ? (tenantId as string) : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);
}

function normalizeLookupRows(value: unknown): Record<string, any>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r) => r && typeof r === 'object') as Record<string, any>[];
}

function buildUiRowFromDbRow(dbRow: any): Record<string, any> {
  const base = (dbRow?.customProps && typeof dbRow.customProps === 'object' && !Array.isArray(dbRow.customProps))
    ? { ...(dbRow.customProps as Record<string, any>) }
    : {};

  // Always ensure core identifiers are present for consumers
  base.value = dbRow.value;
  base.label = dbRow.label;
  if (dbRow.description != null) base.description = dbRow.description;
  if (dbRow.code != null) base.code = dbRow.code;
  if (dbRow.costPerUnit != null) base.costPerUnit = dbRow.costPerUnit;
  if (dbRow.unitType != null) base.unitType = dbRow.unitType;
  if (dbRow.currency != null) base.currency = dbRow.currency;
  if (dbRow.markup != null) base.markup = dbRow.markup;
  if (dbRow.isActive != null) base.isActive = dbRow.isActive;

  return base;
}

function buildDbRowFromUiRow(uiRow: Record<string, any>, columns: string[], index: number): {
  value: string;
  label: string;
  description?: string;
  code?: string;
  customProps: Record<string, any>;
  sortOrder: number;
  isActive: boolean;
} {
  const firstCol = columns[0];
  const secondCol = columns[1];

  const rawValue = uiRow.value ?? (firstCol ? uiRow[firstCol] : undefined) ?? uiRow.id ?? uiRow.code;
  const rawLabel = uiRow.label ?? (secondCol ? uiRow[secondCol] : undefined) ?? uiRow.name;

  let value = String(rawValue ?? '').trim();
  if (!value) value = `row-${index + 1}`;

  const label = String(rawLabel ?? value).trim() || value;
  const description = typeof uiRow.description === 'string' ? uiRow.description : undefined;
  const code = typeof uiRow.code === 'string' ? uiRow.code : undefined;

  return {
    value,
    label,
    description,
    code,
    customProps: { ...uiRow, value, label, ...(description ? { description } : {}), ...(code ? { code } : {}) },
    sortOrder: index,
    isActive: uiRow.isActive === false ? false : true,
  };
}

// ============================================================================
// FIELD ENDPOINTS
// ============================================================================

/**
 * GET /api/fields
 * Get all fields for a tenant, optionally filtered by scope or context
 */
router.get('/fields', async (req: Request, res: Response) => {
  try {
    const { scope, context, includeDisplayContexts } = req.query;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for /api/flexible-fields' });
    }

    const where: any = { tenantId, isActive: true };
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
      tenantId: bodyTenantId,
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

    // Use tenantId from auth context, or from body for backward compatibility
    const tenantId = getTenantId(req) || bodyTenantId;

    if (!tenantId || !key || !label || !type || !scope) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, key, label, type, scope for /api/flexible-fields',
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
 * Delete a field (hard delete - permanently removes the field)
 */
router.delete('/fields/:fieldId', async (req: Request, res: Response) => {
  try {
    const { fieldId } = req.params;

    // Check if field has any answers/data
    const answerCount = await prisma.questionnaireAnswer.count({
      where: { fieldId },
    });

    if (answerCount > 0) {
      // If field has data, delete answers first
      await prisma.questionnaireAnswer.deleteMany({
        where: { fieldId },
      });
    }

    // Delete the field
    await prisma.questionnaireField.delete({
      where: { id: fieldId },
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
    const { context } = req.query;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for /api/flexible-fields' });
    }

    const where: any = { tenantId };
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
    const { tenantId: bodyTenantId, fieldId, context, isVisible, sortOrder } = req.body;
    const tenantId = getTenantId(req) || bodyTenantId;

    if (!tenantId || !fieldId || !context) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, fieldId, context for /api/flexible-fields',
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
    const { name } = req.query;
    const tenantId = getTenantId(req);

    console.log('[lookup-tables] Auth context:', {
      hasAuth: !!req.auth,
      authTenantId: req.auth?.tenantId,
      queryTenantId: req.query.tenantId,
      resolvedTenantId: tenantId
    });

    if (!tenantId) {
      console.error('[lookup-tables] No tenantId found in auth or query');
      return res.status(400).json({ error: 'tenantId is required for /api/flexible-fields' });
    }

    const where: any = { tenantId };
    if (name) where.tableName = { contains: name as string, mode: 'insensitive' };

    console.log('[lookup-tables] Querying with where:', where);

    const tables = await prisma.lookupTable.findMany({
      where,
      include: {
        rows: {
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[lookup-tables] Found ${tables.length} tables for tenant ${tenantId}`);
    
    const payload = tables.map((t: any) => ({
      ...t,
      rows: Array.isArray(t.rows) ? t.rows.map(buildUiRowFromDbRow) : [],
    }));

    console.log(`[lookup-tables] Returning ${payload.length} lookup tables`);
    return res.json(payload);
  } catch (error) {
    console.error('[lookup-tables] Error fetching lookup tables:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch lookup tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/lookup-tables/:tableId
 * Get a single lookup table (by id) for a tenant
 */
router.get('/lookup-tables/:tableId', async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for /api/flexible-fields' });
    }

    const table = await prisma.lookupTable.findFirst({
      where: { id: tableId, tenantId },
      include: { rows: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!table) return res.status(404).json({ error: 'Lookup table not found' });

    return res.json({
      ...table,
      rows: Array.isArray((table as any).rows) ? (table as any).rows.map(buildUiRowFromDbRow) : [],
    });
  } catch (error) {
    console.error('[lookup-tables] Error fetching lookup table:', error);
    return res.status(500).json({ error: 'Failed to fetch lookup table' });
  }
});

/**
 * POST /api/lookup-tables
 * Create a new lookup table
 */
router.post('/lookup-tables', async (req: Request, res: Response) => {
  try {
    const { tenantId: bodyTenantId, tableName, name, description, rows: rowsData, category, columns } = req.body;
    const tenantId = getTenantId(req) || bodyTenantId;
    const finalTableName = tableName || name;

    if (!tenantId || !finalTableName) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, tableName',
      });
    }

    // Check for duplicate tableName within tenant
    const existing = await prisma.lookupTable.findUnique({
      where: {
        tenantId_tableName: {
          tenantId,
          tableName: finalTableName,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ error: `Lookup table "${finalTableName}" already exists` });
    }

    const normalizedColumns = normalizeStringArray(columns);
    const normalizedRows = normalizeLookupRows(rowsData);
    const effectiveColumns = normalizedColumns.length
      ? normalizedColumns
      : (normalizedRows[0] ? Object.keys(normalizedRows[0]) : []);

    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.lookupTable.create({
        data: {
          tenantId,
          tableName: finalTableName,
          name: typeof name === 'string' && name.trim() ? name.trim() : finalTableName,
          description,
          category,
          columns: effectiveColumns,
          isStandard: false,
        },
      });

      if (normalizedRows.length) {
        // Ensure unique values within this payload
        const seen = new Map<string, number>();
        const rowsToCreate = normalizedRows.map((r, i) => {
          const dbRow = buildDbRowFromUiRow(r, effectiveColumns, i);
          const count = (seen.get(dbRow.value) ?? 0) + 1;
          seen.set(dbRow.value, count);
          const value = count > 1 ? `${dbRow.value}-${count}` : dbRow.value;
          return {
            lookupTableId: table.id,
            value,
            label: dbRow.label,
            description: dbRow.description,
            code: dbRow.code,
            sortOrder: i,
            isActive: true,
            customProps: { ...dbRow.customProps, value },
          };
        });

        for (const row of rowsToCreate) {
          await tx.lookupTableRow.create({ data: row });
        }
      }

      const full = await tx.lookupTable.findUnique({
        where: { id: table.id },
        include: { rows: { orderBy: { sortOrder: 'asc' } } },
      });

      return full;
    });

    return res.status(201).json({
      ...result,
      rows: Array.isArray((result as any)?.rows) ? (result as any).rows.map(buildUiRowFromDbRow) : [],
    });
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
    const { rows: rowsData, name, description, category, tableName, columns } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for /api/flexible-fields' });
    }

    const existing = await prisma.lookupTable.findFirst({
      where: { id: tableId, tenantId },
      include: { rows: true },
    });

    if (!existing) return res.status(404).json({ error: 'Lookup table not found' });

    const normalizedColumns = normalizeStringArray(columns);
    const normalizedRows = normalizeLookupRows(rowsData);
    const effectiveColumns = normalizedColumns.length
      ? normalizedColumns
      : (existing as any).columns || [];

    const nextTableName =
      (typeof tableName === 'string' && tableName.trim())
        ? tableName.trim()
        : (typeof name === 'string' && name.trim() ? name.trim() : undefined);

    const updated = await prisma.$transaction(async (tx) => {
      const table = await tx.lookupTable.update({
        where: { id: tableId },
        data: {
          ...(nextTableName ? { tableName: nextTableName } : {}),
          ...(typeof name === 'string' ? { name: name.trim() || null } : {}),
          ...(typeof description === 'string' ? { description: description.trim() || null } : {}),
          ...(typeof category === 'string' ? { category: category.trim() || null } : {}),
          ...(effectiveColumns ? { columns: effectiveColumns } : {}),
        },
      });

      if (Array.isArray(rowsData)) {
        const incoming = normalizedRows.map((r, i) => buildDbRowFromUiRow(r, effectiveColumns, i));
        const incomingValues = new Set(incoming.map((r) => r.value));

        // Upsert each incoming row by (lookupTableId,value)
        for (const [i, r] of incoming.entries()) {
          await tx.lookupTableRow.upsert({
            where: {
              lookupTableId_value: {
                lookupTableId: tableId,
                value: r.value,
              },
            },
            update: {
              label: r.label,
              description: r.description,
              code: r.code,
              sortOrder: i,
              isActive: true,
              customProps: r.customProps,
            },
            create: {
              lookupTableId: tableId,
              value: r.value,
              label: r.label,
              description: r.description,
              code: r.code,
              sortOrder: i,
              isActive: true,
              customProps: r.customProps,
            },
          });
        }

        // Soft-deactivate rows removed from payload
        await tx.lookupTableRow.updateMany({
          where: {
            lookupTableId: tableId,
            value: { notIn: Array.from(incomingValues) },
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      const full = await tx.lookupTable.findUnique({
        where: { id: table.id },
        include: { rows: { orderBy: { sortOrder: 'asc' } } },
      });

      return full;
    });

    return res.json({
      ...updated,
      rows: Array.isArray((updated as any)?.rows) ? (updated as any).rows.map(buildUiRowFromDbRow) : [],
    });
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
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for /api/flexible-fields' });
    }

    const existing = await prisma.lookupTable.findFirst({ where: { id: tableId, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Lookup table not found' });

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
      tenantId: bodyTenantId,
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

    const tenantId = getTenantId(req) || bodyTenantId;

    if (!tenantId || !eventType || !contextSnapshot) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, eventType, contextSnapshot for /api/flexible-fields',
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
 * Get ML training events for a tenant
 */
router.get('/ml-training-events', async (req: Request, res: Response) => {
  try {
    const { fieldId, eventType, leadId, limit } = req.query;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for /api/flexible-fields' });
    }

    const where: any = { tenantId };
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
    const { tenantId: bodyTenantId, fieldId, inputs, context } = req.body;
    const tenantId = getTenantId(req) || bodyTenantId;

    if (!tenantId || !fieldId) {
      return res.status(400).json({ error: 'Missing required fields: tenantId, fieldId for /api/flexible-fields' });
    }

    const field = await prisma.questionnaireField.findUnique({
      where: { id: fieldId },
      include: { lookupTable: { include: {} } },
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
    if (field.lookupTableId && inputs && field.lookupInputFields) {
      const table = await prisma.lookupTable.findUnique({
        where: { id: field.lookupTableId },
        include: { rows: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      });
      if (!table) return res.status(404).json({ error: 'Lookup table not found' });
      const rows = Array.isArray((table as any)?.rows) ? (table as any).rows.map(buildUiRowFromDbRow) : [];

      // Filter rows based on lookup input fields
      const matchingRow = (rows as any[])?.find?.((row: any) =>
        field.lookupInputFields!.every(
          (inputField: string) =>
            row[inputField] === inputs[inputField] ||
            String(row[inputField]).toLowerCase() === String(inputs[inputField]).toLowerCase()
        )
      );

      if (matchingRow && field.lookupOutputField) {
        result = (matchingRow as any)[field.lookupOutputField];
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
