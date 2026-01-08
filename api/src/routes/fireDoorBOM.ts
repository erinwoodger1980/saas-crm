import express, { Request, Response } from 'express';
import { requireAuth, AuthPayload } from '../middleware/auth';
import {
  generateFireDoorBOM,
  getFireDoorBOM,
  batchGenerateFireDoorBOMs,
  deleteFireDoorBOM,
  getFireDoorBOMSummary,
  getProductTypeForFireDoor,
} from '../services/fireDoorBOMGenerator';

const router = express.Router();

interface TenantRequest extends Request {
  auth?: AuthPayload;
}

/**
 * POST /fire-door-bom/generate/:fireDoorId
 * Generate BOM for a single fire door row
 *
 * Body: {
 *   productTypeId?: string, // optional, auto-detected if not provided
 *   fieldValues: Record<string, string | number | boolean> // all grid columns
 * }
 *
 * Response: {
 *   id: string,
 *   fireDoorId: string,
 *   bomData: GeneratedBOM,
 *   totalCost: number,
 *   itemCount: number
 * }
 */
router.post('/generate/:fireDoorId', requireAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { fireDoorId } = req.params;
    const { productTypeId, fieldValues } = req.body;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant ID' });
    }

    if (!fireDoorId) {
      return res.status(400).json({ error: 'Fire door ID required' });
    }

    if (!fieldValues || typeof fieldValues !== 'object') {
      return res.status(400).json({ error: 'fieldValues object required' });
    }

    const bom = await generateFireDoorBOM({
      id: fireDoorId,
      tenantId,
      productTypeId,
      fieldValues,
    });

    res.json(bom);
  } catch (error) {
    console.error('Generate fire door BOM error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate BOM',
    });
  }
});

/**
 * POST /fire-door-bom/batch-generate
 * Generate BOMs for multiple fire door rows (CSV import, etc.)
 *
 * Body: {
 *   rows: Array<{
 *     id: string,
 *     fieldValues: Record<string, string | number | boolean>
 *   }>
 * }
 *
 * Response: {
 *   success: number,
 *   failed: number,
 *   errors: Array<{rowId, error}>,
 *   results: FireDoorBOM[]
 * }
 */
router.post('/batch-generate', requireAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { rows } = req.body;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant ID' });
    }

    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows array required' });
    }

    // Add tenantId to each row
    const rowsWithTenant = rows.map((row) => ({
      ...row,
      tenantId,
    }));

    const result = await batchGenerateFireDoorBOMs(rowsWithTenant);
    res.json(result);
  } catch (error) {
    console.error('Batch generate fire door BOM error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Batch generation failed',
    });
  }
});

/**
 * GET /fire-door-bom/:fireDoorId
 * Get BOM for a fire door row
 *
 * Response: {
 *   id: string,
 *   fireDoorId: string,
 *   bomData: GeneratedBOM,
 *   totalCost: number,
 *   itemCount: number,
 *   generatedAt: ISO datetime
 * }
 */
router.get('/:fireDoorId', requireAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { fireDoorId } = req.params;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant ID' });
    }

    const bom = await getFireDoorBOM(fireDoorId);

    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    // Verify tenantId matches
    if (bom.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(bom);
  } catch (error) {
    console.error('Get fire door BOM error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get BOM',
    });
  }
});

/**
 * GET /fire-door-bom/:fireDoorId/summary
 * Get BOM summary for grid display (lightweight)
 *
 * Response: {
 *   totalCost: number,
 *   itemCount: number,
 *   topComponents: Array<{code: string, cost: number}>,
 *   generatedAt: ISO datetime
 * }
 */
router.get('/:fireDoorId/summary', requireAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { fireDoorId } = req.params;

    const summary = await getFireDoorBOMSummary(fireDoorId);

    if (!summary) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    res.json(summary);
  } catch (error) {
    console.error('Get fire door BOM summary error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get summary',
    });
  }
});

/**
 * DELETE /fire-door-bom/:fireDoorId
 * Delete BOM for a fire door row
 *
 * Response: { success: true }
 */
router.delete('/:fireDoorId', requireAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { fireDoorId } = req.params;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant ID' });
    }

    // Verify tenantId
    const bom = await getFireDoorBOM(fireDoorId);
    if (bom && bom.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await deleteFireDoorBOM(fireDoorId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete fire door BOM error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to delete BOM',
    });
  }
});

/**
 * POST /fire-door-bom/detect-product-type
 * Detect ProductType from fire door row data
 *
 * Body: {
 *   fieldValues: Record<string, string | number | boolean>
 * }
 *
 * Response: {
 *   productTypeId: string,
 *   productTypeName: string,
 *   code: string
 * }
 */
router.post('/detect-product-type', requireAuth, async (req: TenantRequest, res: Response) => {
  try {
    const { fieldValues } = req.body;
    const tenantId = req.auth?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'No tenant ID' });
    }

    if (!fieldValues || typeof fieldValues !== 'object') {
      return res.status(400).json({ error: 'fieldValues object required' });
    }

    const productTypeId = await getProductTypeForFireDoor(
      { fieldValues },
      tenantId
    );

    // Get ProductType details
    const { prisma } = await import('../db');
    const productType = await prisma.productType.findUnique({
      where: { id: productTypeId },
    });

    res.json({
      productTypeId,
      productTypeName: productType?.name || 'Unknown',
      code: productType?.code || 'UNKNOWN',
    });
  } catch (error) {
    console.error('Detect product type error:', error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Failed to detect product type',
    });
  }
});

export default router;
