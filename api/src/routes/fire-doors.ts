/**
 * Fire Door Import Routes
 * Endpoints for importing fire door orders from CSV spreadsheets
 */

import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { 
  parseFireDoorCSV, 
  calculateTotalValue, 
  validateCSVHeaders,
  type ParsedFireDoorRow,
  type FireDoorImportResponse 
} from '../lib/fireDoorImport';

const router = Router();

const FIRE_DOOR_LINE_ITEM_MODEL = (() => {
  try {
    const dmmf = (Prisma as any)?.dmmf;
    const model = dmmf?.datamodel?.models?.find?.((m: any) => m?.name === 'FireDoorLineItem');
    if (!model) return null;
    return model;
  } catch {
    return null;
  }
})();

const FIRE_DOOR_LINE_ITEM_SCALAR_FIELDS = (() => {
  const map = new Map<string, any>();
  const model = FIRE_DOOR_LINE_ITEM_MODEL as any;
  const fields = model?.fields;
  if (!Array.isArray(fields)) return map;
  for (const f of fields) {
    if (f?.kind === 'scalar' && typeof f?.name === 'string') {
      map.set(f.name, f);
    }
  }
  return map;
})();

const LINE_ITEM_FORBIDDEN_UPDATE_FIELDS = new Set<string>([
  'id',
  'tenantId',
  'fireDoorImportId',
  'createdAt',
  'updatedAt',
]);

// UI grid column keys → DB column names when they differ.
const UI_TO_DB_FIELD_ALIASES: Record<string, string> = {
  doorsetLeafFrame: 'doorsetType',
  acousticRating: 'acousticRatingDb',
  fanlightSidelightGlazing: 'fanlightSidelightGlz',
  doorEdgeProtPosition: 'doorEdgeProtPos',
  visionPanelQtyLeaf1: 'visionQtyLeaf1',
  visionPanelQtyLeaf2: 'visionQtyLeaf2',
  leaf1Aperture1Width: 'vp1WidthLeaf1',
  leaf1Aperture1Height: 'vp1HeightLeaf1',
  leaf1Aperture2Width: 'vp2WidthLeaf1',
  leaf1Aperture2Height: 'vp2HeightLeaf1',
  leaf2Aperture1Width: 'vp1WidthLeaf2',
  leaf2Aperture1Height: 'vp1HeightLeaf2',
  leaf2Aperture2Width: 'vp2WidthLeaf2',
  leaf2Aperture2Height: 'vp2HeightLeaf2',
  addition1: 'additionNote1',
  addition1Qty: 'additionNote1Qty',
  closersFloorsprings: 'closerOrFloorSpring',
  closerType: 'closerOrFloorSpring',
  mLeafWidth: 'masterLeafWidth',
  sLeafWidth: 'slaveLeafWidth',
  priceEa: 'unitValue',
  linePrice: 'lineTotal',
};

function coerceScalarValue(value: any, fieldMeta: any): any {
  if (value === undefined) return undefined;
  if (value === '') return null;
  if (value === null) return null;

  const type = fieldMeta?.type;

  // Prisma scalar types in DMMF: String, Int, Float, Decimal, Boolean, DateTime, Json
  if (type === 'Int') {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
    if (typeof value === 'string') {
      const n = parseInt(value.replace(/,/g, '').trim(), 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  if (type === 'Float' || type === 'Decimal') {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[£$€¥₹]/g, '').replace(/,/g, '').trim();
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  if (type === 'Boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === 'yes' || v === '1') return true;
      if (v === 'false' || v === 'no' || v === '0') return false;
    }
    return null;
  }

  if (type === 'DateTime') {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isFinite(d.getTime()) ? d : null;
    }
    return null;
  }

  if (type === 'Json') {
    return value;
  }

  // Default to string-ish
  return typeof value === 'string' ? value : String(value);
}

function serializeLineItemForJson(item: any) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    unitValue: item.unitValue != null ? Number(item.unitValue) : null,
    labourCost: item.labourCost != null ? Number(item.labourCost) : null,
    materialCost: item.materialCost != null ? Number(item.materialCost) : null,
    lineTotal: item.lineTotal != null ? Number(item.lineTotal) : null,
  };
}

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * POST /api/fire-doors/import
 * Import fire door orders from CSV spreadsheet
 * 
 * Auth: Requires authenticated user
 * Tenant: Must be fire door manufacturer (isFireDoorManufacturer === true)
 * Body: multipart/form-data with 'file' field
 * Optional: projectId, orderId in body
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    // 1. Auth checks
    const userId = req.auth?.userId as string | undefined;
    const tenantId = req.auth?.tenantId as string | undefined;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 2. Check if tenant is fire door manufacturer
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ 
        error: 'Fire door import is only available for fire door manufacturers',
        message: 'This feature requires fire door manufacturer access. Please contact support to enable this feature.',
      });
    }

    // 3. Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sourceName = req.file.originalname;
    const csvContent = req.file.buffer;

    // 4. Validate CSV headers
    const headerValidation = validateCSVHeaders(csvContent);
    if (!headerValidation.valid) {
      return res.status(400).json({
        error: 'Invalid CSV format',
        message: 'CSV file is missing required columns',
        missingHeaders: headerValidation.missingHeaders,
      });
    }

    // 5. Parse CSV
    let parsedRows: ParsedFireDoorRow[];
    try {
      parsedRows = parseFireDoorCSV(csvContent);
    } catch (err: any) {
      console.error('[fire-door-import] CSV parse error:', err);
      return res.status(400).json({
        error: 'Failed to parse CSV file',
        message: err.message || 'Invalid CSV format',
      });
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({
        error: 'No valid product rows found',
        message: 'CSV must contain rows with Item = "Product"',
      });
    }

    // 6. Calculate totals
    const totalValue = calculateTotalValue(parsedRows);
    const rowCount = parsedRows.length;

    // 7. Extract optional linkage and derive metadata
    const projectId = (req.body.projectId as string) || null;
    const orderId = (req.body.orderId as string) || null;
    const mjsNumberFromForm = (req.body.mjsNumber as string) || null;
    const customerNameFromForm = (req.body.customerName as string) || null;
    const jobDescriptionFromForm = (req.body.jobDescription as string) || null;
    const netValueFromForm = req.body.netValue ? Number(req.body.netValue) : null;
    const firstRow = parsedRows[0];
    const mjsNumber = mjsNumberFromForm || firstRow.code || sourceName.replace('.csv', '');
    const clientName = customerNameFromForm || firstRow.location || 'New Fire Door Customer';
    const jobDescription = jobDescriptionFromForm || `${clientName} - ${mjsNumber}`;
    const netValue = netValueFromForm ?? totalValue;

    // 8. Persist using a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Ensure project exists
      let fireDoorProjectId = projectId;
      if (!fireDoorProjectId) {
        const existingProject = await tx.fireDoorScheduleProject.findFirst({
          where: { tenantId, mjsNumber },
        });
        if (existingProject) {
          fireDoorProjectId = existingProject.id;
        } else {
          const fireDoorProject = await tx.fireDoorScheduleProject.create({
            data: {
              tenantId,
              mjsNumber,
              clientName,
              jobName: jobDescription,
              netValue: netValue as any,
              dateReceived: new Date(),
              jobLocation: 'RED FOLDER',
              signOffStatus: 'NOT LOOKED AT',
              lastUpdatedBy: userId,
              lastUpdatedAt: new Date(),
            },
          });
          fireDoorProjectId = fireDoorProject.id;

          // Create/ensure lead and opportunity
          let lead = await tx.lead.findFirst({ where: { tenantId, contactName: clientName } });
          if (!lead) {
            lead = await tx.lead.create({
              data: {
                tenantId,
                createdById: userId,
                contactName: clientName,
                capturedAt: new Date(),
                status: 'INFO_REQUESTED',
              },
            });
          }
          const opportunity = await tx.opportunity.create({
            data: {
              tenantId,
              leadId: lead.id,
              title: `${clientName} - ${mjsNumber}`,
              stage: 'QUALIFY',
              createdAt: new Date(),
            },
          });
          await tx.fireDoorScheduleProject.update({
            where: { id: fireDoorProjectId },
            data: { projectId: opportunity.id },
          });
        }
      }

      // Create import record
      const importRecord = await tx.fireDoorImport.create({
        data: {
          tenantId,
          createdById: userId,
          sourceName,
          status: 'COMPLETED',
          totalValue,
          currency: 'GBP',
          rowCount,
          projectId: fireDoorProjectId,
          orderId,
        },
      });

      // Create line items
      const lineItems = await Promise.all(
        parsedRows.map((row, idx) =>
          tx.fireDoorLineItem.create({
            data: {
              fireDoorImportId: importRecord.id,
              tenantId,
              rowIndex: idx,
              itemType: row.itemType,
              code: row.code,
              quantity: row.quantity,
              doorRef: row.doorRef,
              location: row.location,
              doorsetType: row.doorSetType,
              rating: row.fireRating,
              acousticRatingDb: row.acousticRatingDb,
              internalColour: row.internalColour,
              externalColour: row.externalColour,
              frameFinish: row.frameFinish,
              leafHeight: row.leafHeight,
              masterLeafWidth: row.masterLeafWidth,
              slaveLeafWidth: row.slaveLeafWidth,
              leafThickness: row.leafThickness,
              leafConfiguration: row.leafConfiguration,
              ifSplitMasterSize: row.ifSplitMasterSize,
              doorFinishSide1: row.doorFinishSide1,
              doorFinishSide2: row.doorFinishSide2,
              doorFacing: row.doorFacing,
              lippingFinish: row.lippingFinish,
              doorEdgeProtType: row.doorEdgeProtType,
              doorEdgeProtPos: row.doorEdgeProtPos,
              doorUndercut: row.doorUndercut,
              doorUndercutMm: row.doorUndercutMm,
              visionQtyLeaf1: row.visionQtyLeaf1,
              vp1WidthLeaf1: row.vp1WidthLeaf1,
              vp1HeightLeaf1: row.vp1HeightLeaf1,
              vp2WidthLeaf1: row.vp2WidthLeaf1,
              vp2HeightLeaf1: row.vp2HeightLeaf1,
              visionQtyLeaf2: row.visionQtyLeaf2,
              vp1WidthLeaf2: row.vp1WidthLeaf2,
              vp1HeightLeaf2: row.vp1HeightLeaf2,
              vp2WidthLeaf2: row.vp2WidthLeaf2,
              vp2HeightLeaf2: row.vp2HeightLeaf2,
              totalGlazedAreaMaster: row.totalGlazedAreaMaster,
              fanlightSidelightGlz: row.fanlightSidelightGlz,
              glazingTape: row.glazingTape,
              ironmongeryPackRef: row.ironmongeryPackRef,
              closerOrFloorSpring: row.closerOrFloorSpring,
              spindleFacePrep: row.spindleFacePrep,
              cylinderFacePrep: row.cylinderFacePrep,
              flushBoltSupplyPrep: row.flushBoltSupplyPrep,
              flushBoltQty: row.flushBoltQty,
              fingerProtection: row.fingerProtection,
              fireSignage: row.fireSignage,
              fireSignageQty: row.fireSignageQty,
              fireSignageFactoryFit: row.fireSignageFactoryFit,
              fireIdDisc: row.fireIdDisc,
              fireIdDiscQty: row.fireIdDiscQty,
              doorViewer: row.doorViewer,
              doorViewerPosition: row.doorViewerPosition,
              doorViewerPrepSize: row.doorViewerPrepSize,
              doorChain: row.doorChain,
              doorViewersQty: row.doorViewersQty,
              doorChainFactoryFit: row.doorChainFactoryFit,
              doorViewersFactoryFit: row.doorViewersFactoryFit,
              additionNote1: row.additionNote1,
              additionNote1Qty: row.additionNote1Qty,
              unitValue: row.unitValue,
              labourCost: row.labourCost,
              materialCost: row.materialCost,
              lineTotal: row.lineTotal,
              rawRowJson: row.rawRowJson as any,
            },
          })
        )
      );

      return { importRecord, lineItems };
    });

    // 9. Build response with preview of first 10 line items
    const previewItems = result.lineItems.slice(0, 10).map((item) => ({
      id: item.id,
      doorRef: item.doorRef,
      location: item.location,
      fireRating: item.rating,
      quantity: item.quantity,
      lineTotal: item.lineTotal ? Number(item.lineTotal) : null,
    }));

    const response: FireDoorImportResponse = {
      import: {
        id: result.importRecord.id,
        totalValue: Number(result.importRecord.totalValue),
        currency: result.importRecord.currency,
        status: result.importRecord.status,
        rowCount: result.importRecord.rowCount,
        createdAt: result.importRecord.createdAt,
      },
      lineItems: previewItems,
      totalValue: Number(totalValue),
      rowCount,
    };

    console.log(
      `[fire-door-import] Successfully imported ${rowCount} doors for tenant ${tenantId}, total value: £${totalValue.toFixed(2)}`
    );

    return res.json(response);
  } catch (error: any) {
    console.error('[fire-door-import] Error:', error);
    return res.status(500).json({
      error: 'Import failed',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * GET /api/fire-doors/imports
 * List all fire door imports for the tenant
 * 
 * Auth: Requires authenticated user
 * Query params:
 *   - limit: number of records (default 20)
 *   - offset: pagination offset (default 0)
 */
router.get('/imports', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check fire door manufacturer status
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: 'Fire door import access required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const [imports, total] = await Promise.all([
      prisma.fireDoorImport.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          sourceName: true,
          status: true,
          totalValue: true,
          currency: true,
          rowCount: true,
          createdAt: true,
          projectId: true,
          orderId: true,
        },
      }),
      prisma.fireDoorImport.count({ where: { tenantId } }),
    ]);

    return res.json({
      imports: imports.map((i) => ({
        ...i,
        totalValue: Number(i.totalValue),
      })),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[fire-door-import] List error:', error);
    return res.status(500).json({ error: 'Failed to list imports' });
  }
});

/**
 * GET /api/fire-doors/imports/by-project/:projectId
 * List all imports associated with a specific Fire Door Schedule project
 */
router.get('/imports/by-project/:projectId', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projectId = req.params.projectId as string;
    const imports = await prisma.fireDoorImport.findMany({
      where: { tenantId, projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceName: true,
        totalValue: true,
        currency: true,
        rowCount: true,
        createdAt: true,
      },
    });

    return res.json({ imports: imports.map(i => ({ ...i, totalValue: Number(i.totalValue) })) });
  } catch (error: any) {
    console.error('[fire-door-import] List by project error:', error);
    return res.status(500).json({ error: 'Failed to list imports for project' });
  }
});

/**
 * GET /api/fire-doors/imports/:id
 * Get details of a specific import with all line items
 * 
 * Auth: Requires authenticated user
 */
router.get('/imports/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const importId = req.params.id;

    const importRecord = await prisma.fireDoorImport.findFirst({
      where: { 
        id: importId,
        tenantId, // Ensure tenant isolation
      },
      include: {
        lineItems: {
          orderBy: { rowIndex: 'asc' },
        },
      },
    });

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Convert Decimal fields to numbers for JSON serialization
    const response = {
      ...importRecord,
      totalValue: Number(importRecord.totalValue),
      lineItems: importRecord.lineItems.map((item) => ({
        ...item,
        unitValue: item.unitValue ? Number(item.unitValue) : null,
        labourCost: item.labourCost ? Number(item.labourCost) : null,
        materialCost: item.materialCost ? Number(item.materialCost) : null,
        lineTotal: item.lineTotal ? Number(item.lineTotal) : null,
      })),
    };

    return res.json(response);
  } catch (error: any) {
    console.error('[fire-door-import] Get import error:', error);
    return res.status(500).json({ error: 'Failed to fetch import' });
  }
});

/**
 * PATCH /api/fire-doors/line-items/bulk
 * Persist grid edits for multiple line items in a single request.
 *
 * Body: { updates: Array<{ id: string; changes: Record<string, any> }> }
 *
 * Notes:
 * - Updates scalar DB fields when they exist
 * - Stores all other edited columns into rawRowJson.__grid for round-trip persistence
 */
router.patch('/line-items/bulk', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check fire door manufacturer status
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: 'Fire door import access required' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : null;
    const updates = (body && Array.isArray((body as any).updates)) ? (body as any).updates : null;

    if (!updates || updates.length === 0) {
      return res.status(400).json({ error: 'Invalid updates payload' });
    }

    const ids: string[] = [];
    const seen = new Set<string>();
    for (const u of updates) {
      const id = String(u?.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Each update must include a valid id' });
      if (seen.has(id)) return res.status(400).json({ error: `Duplicate id in updates: ${id}` });
      seen.add(id);
      ids.push(id);
    }

    const existing = await prisma.fireDoorLineItem.findMany({
      where: {
        tenantId,
        id: { in: ids },
      },
      select: {
        id: true,
        rawRowJson: true,
      },
    });

    const existingById = new Map<string, { id: string; rawRowJson: any }>();
    for (const item of existing) existingById.set(item.id, item as any);

    const missing = ids.filter((id) => !existingById.has(id));
    if (missing.length > 0) {
      return res.status(404).json({ error: 'One or more line items not found', missing });
    }

    const tx: Prisma.PrismaPromise<any>[] = [];

    for (const u of updates) {
      const rowId = String(u?.id || '').trim();
      const changes = (u && typeof u === 'object' && typeof (u as any).changes === 'object' && (u as any).changes && !Array.isArray((u as any).changes))
        ? (u as any).changes
        : null;

      if (!changes) {
        return res.status(400).json({ error: `Invalid changes for id ${rowId}` });
      }

      const current = existingById.get(rowId)!;
      const updateData: Record<string, any> = {};
      const gridEdits: Record<string, any> = {};

      for (const [uiKeyRaw, uiVal] of Object.entries(changes)) {
        const uiKey = String(uiKeyRaw || '').trim();
        if (!uiKey) continue;
        if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(uiKey)) continue;

        const dbKey = UI_TO_DB_FIELD_ALIASES[uiKey] || uiKey;
        const meta = FIRE_DOOR_LINE_ITEM_SCALAR_FIELDS.get(dbKey);
        const isScalar = !!meta;

        if (isScalar && !LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(dbKey)) {
          updateData[dbKey] = coerceScalarValue(uiVal, meta);
        } else {
          gridEdits[uiKey] = uiVal === '' ? null : uiVal;
        }
      }

      if (Object.keys(updateData).length === 0 && Object.keys(gridEdits).length === 0) {
        continue;
      }

      if (Object.keys(gridEdits).length > 0) {
        const baseRaw = (current.rawRowJson && typeof current.rawRowJson === 'object') ? (current.rawRowJson as any) : {};
        const prevGrid = (baseRaw.__grid && typeof baseRaw.__grid === 'object') ? baseRaw.__grid : {};
        updateData.rawRowJson = {
          ...baseRaw,
          __grid: {
            ...prevGrid,
            ...gridEdits,
          },
        };
      }

      tx.push(
        prisma.fireDoorLineItem.update({
          where: { id: rowId },
          data: updateData,
        })
      );
    }

    if (tx.length === 0) {
      return res.json({ ok: true, updated: false, items: [] });
    }

    const updated = await prisma.$transaction(tx);
    return res.json({ ok: true, updated: true, items: updated.map(serializeLineItemForJson) });
  } catch (error: any) {
    console.error('[fire-doors] Bulk update line items error:', error);
    return res.status(500).json({ error: 'Failed to bulk update line items', message: error.message || 'Unknown error' });
  }
});

/**
 * PATCH /api/fire-doors/line-items/:id
 * Persist grid edits for a single line item.
 * - Updates scalar DB fields when they exist
 * - Stores all other edited columns into rawRowJson.__grid for round-trip persistence
 */
router.patch('/line-items/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check fire door manufacturer status
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: 'Fire door import access required' });
    }

    const lineItemId = String(req.params.id || '').trim();
    if (!lineItemId) {
      return res.status(400).json({ error: 'Line item id required' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : null;
    const changes = (body && typeof (body as any).changes === 'object' && (body as any).changes)
      ? (body as any).changes
      : body;

    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return res.status(400).json({ error: 'Invalid changes payload' });
    }

    const existing = await prisma.fireDoorLineItem.findFirst({
      where: { id: lineItemId, tenantId },
      select: { id: true, rawRowJson: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    const updateData: Record<string, any> = {};
    const gridEdits: Record<string, any> = {};

    for (const [uiKeyRaw, uiVal] of Object.entries(changes)) {
      const uiKey = String(uiKeyRaw || '').trim();
      if (!uiKey) continue;
      if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(uiKey)) continue;

      const dbKey = UI_TO_DB_FIELD_ALIASES[uiKey] || uiKey;

      const meta = FIRE_DOOR_LINE_ITEM_SCALAR_FIELDS.get(dbKey);
      const isScalar = !!meta;

      if (isScalar && !LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(dbKey)) {
        updateData[dbKey] = coerceScalarValue(uiVal, meta);
      } else {
        // Persist any non-DB column edits in rawRowJson.__grid keyed by grid column key
        gridEdits[uiKey] = uiVal === '' ? null : uiVal;
      }
    }

    if (Object.keys(updateData).length === 0 && Object.keys(gridEdits).length === 0) {
      return res.json({ ok: true, updated: false });
    }

    if (Object.keys(gridEdits).length > 0) {
      const baseRaw = (existing.rawRowJson && typeof existing.rawRowJson === 'object') ? (existing.rawRowJson as any) : {};
      const prevGrid = (baseRaw.__grid && typeof baseRaw.__grid === 'object') ? baseRaw.__grid : {};
      updateData.rawRowJson = {
        ...baseRaw,
        __grid: {
          ...prevGrid,
          ...gridEdits,
        },
      };
    }

    const updated = await prisma.fireDoorLineItem.update({
      where: { id: lineItemId },
      data: updateData,
    });

    return res.json({
      ok: true,
      updated: true,
      item: serializeLineItemForJson(updated),
    });
  } catch (error: any) {
    console.error('[fire-doors] Update line item error:', error);
    return res.status(500).json({ error: 'Failed to update line item', message: error.message || 'Unknown error' });
  }
});

export default router;
