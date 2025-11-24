/**
 * Fire Door Import Routes
 * Endpoints for importing fire door orders from CSV spreadsheets
 */

import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';
import { 
  parseFireDoorCSV, 
  calculateTotalValue, 
  validateCSVHeaders,
  type ParsedFireDoorRow,
  type FireDoorImportResponse 
} from '../lib/fireDoorImport';

const router = Router();

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

    // 7. Extract optional linkage
    const projectId = req.body.projectId || null;
    const orderId = req.body.orderId || null;

    // 8. Create import and line items in transaction
    const result = await prisma.$transaction(async (tx) => {
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
          projectId,
          orderId,
        },
      });

      // Create all line items
      const lineItems = await Promise.all(
        parsedRows.map((row, idx) =>
          tx.fireDoorLineItem.create({
            data: {
              fireDoorImportId: importRecord.id,
              tenantId,
              rowIndex: idx,
              
              // Core fields
              itemType: row.itemType,
              code: row.code,
              quantity: row.quantity,

              // Door identification
              doorRef: row.doorRef,
              location: row.location,
              doorSetType: row.doorSetType,
              fireRating: row.fireRating,
              acousticRatingDb: row.acousticRatingDb,
              handing: row.handing,

              // Colors & finishes
              internalColour: row.internalColour,
              externalColour: row.externalColour,
              frameFinish: row.frameFinish,

              // Leaf geometry
              leafHeight: row.leafHeight,
              masterLeafWidth: row.masterLeafWidth,
              slaveLeafWidth: row.slaveLeafWidth,
              leafThickness: row.leafThickness,
              leafConfiguration: row.leafConfiguration,
              ifSplitMasterSize: row.ifSplitMasterSize,

              // Finishes & edges
              doorFinishSide1: row.doorFinishSide1,
              doorFinishSide2: row.doorFinishSide2,
              doorFacing: row.doorFacing,
              lippingFinish: row.lippingFinish,
              doorEdgeProtType: row.doorEdgeProtType,
              doorEdgeProtPos: row.doorEdgeProtPos,
              doorUndercut: row.doorUndercut,
              doorUndercutMm: row.doorUndercutMm,

              // Vision panels (Leaf 1)
              visionQtyLeaf1: row.visionQtyLeaf1,
              vp1WidthLeaf1: row.vp1WidthLeaf1,
              vp1HeightLeaf1: row.vp1HeightLeaf1,
              vp2WidthLeaf1: row.vp2WidthLeaf1,
              vp2HeightLeaf1: row.vp2HeightLeaf1,

              // Vision panels (Leaf 2)
              visionQtyLeaf2: row.visionQtyLeaf2,
              vp1WidthLeaf2: row.vp1WidthLeaf2,
              vp1HeightLeaf2: row.vp1HeightLeaf2,
              vp2WidthLeaf2: row.vp2WidthLeaf2,
              vp2HeightLeaf2: row.vp2HeightLeaf2,

              // Total glazing
              totalGlazedAreaMaster: row.totalGlazedAreaMaster,
              fanlightSidelightGlz: row.fanlightSidelightGlz,
              glazingTape: row.glazingTape,

              // Ironmongery
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

              // Additional notes
              additionNote1: row.additionNote1,
              additionNote1Qty: row.additionNote1Qty,

              // Pricing
              unitValue: row.unitValue,
              labourCost: row.labourCost,
              materialCost: row.materialCost,
              lineTotal: row.lineTotal,

              // Raw data
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
      fireRating: item.fireRating,
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

export default router;
