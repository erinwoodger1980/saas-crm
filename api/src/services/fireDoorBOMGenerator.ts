import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { generateTemplateProduct } from './templateProductGenerator';

/**
 * Fire Door BOM Auto-Generation Service
 *
 * Watches for changes in FireDoorSchedule rows and automatically generates
 * BOMs using the unified ComponentTemplate system.
 *
 * Flow:
 * 1. User fills in fire door row (height=2100, width=900, lippingMaterial=oak, etc.)
 * 2. Service detects field changes
 * 3. Looks up ProductType for this fire door (based on rating, type, etc.)
 * 4. Calls generateTemplateProduct with the field values
 * 5. Stores BOM in database linked to the fire door row
 * 6. Updates grid UI with BOM summary (cost, items, etc.)
 */

interface FireDoorRowData {
  id: string;
  tenantId: string;
  productTypeId?: string; // ProductType for this fire door (FD30-SINGLE, FD60-DOUBLE, etc.)
  fieldValues: Record<string, string | number | boolean>; // All grid columns (height, width, materials, etc.)
}

interface FireDoorBOM {
  id: string;
  fireDoorId: string;
  tenantId: string;
  productTypeId: string;
  bomData: any; // Full GeneratedBOM structure
  totalCost: number;
  itemCount: number;
  generatedAt: Date;
  updatedAt: Date;
}

const toNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  if (typeof (value as any).toNumber === 'function') return (value as any).toNumber();
  return Number(value) || 0;
};

/**
 * Determine ProductType from fire door row data
 *
 * Maps fire door specs to standard ProductType templates:
 * - rating (FD30, FD60, FD90) + leafCount (single, double) → ProductType ID
 * - Falls back to "Generic Fire Door" if no specific match
 */
export async function getProductTypeForFireDoor(
  fireDoorRow: Partial<FireDoorRowData>,
  tenantId: string
): Promise<string> {
  const { fieldValues = {} } = fireDoorRow;

  // Extract key fields for ProductType determination
  const rating = fieldValues.rating || fieldValues.coreType;
  const leafCount = fieldValues.leafCount || (fieldValues.leafWidth ? '2' : '1');
  const hasVisionPanel = fieldValues.hasVisionPanel || false;

  // Build ProductType code: FD30-SINGLE, FD60-DOUBLE, etc.
  let code = `FD${rating}-${leafCount === 2 || leafCount === '2' ? 'DOUBLE' : 'SINGLE'}`;
  if (hasVisionPanel) {
    code += '-VISION';
  }

  // Look up ProductType
  let productType = await prisma.productType.findFirst({
    where: {
      tenantId,
      code,
      isActive: true,
    },
  });

  // Fallback to generic fire door type if specific one not found
  if (!productType) {
    productType = await prisma.productType.findFirst({
      where: {
        tenantId,
        code: 'GENERIC-FIRE-DOOR',
        isActive: true,
      },
    });
  }

  // Last resort fallback
  if (!productType) {
    productType = await prisma.productType.findFirst({
      where: {
        tenantId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!productType) {
    throw new Error(`No ProductType found for fire door: ${code}`);
  }

  return productType.id;
}

/**
 * Generate BOM for a fire door row
 *
 * Called when:
 * 1. User manually triggers BOM generation
 * 2. Auto-triggered on field changes (via service/scheduler)
 * 3. Batch processing (CSV import)
 */
export async function generateFireDoorBOM(
  fireDoorRow: FireDoorRowData
): Promise<FireDoorBOM> {
  const { id: fireDoorId, tenantId, fieldValues } = fireDoorRow;

  // Determine ProductType if not provided
  let productTypeId = fireDoorRow.productTypeId;
  if (!productTypeId) {
    productTypeId = await getProductTypeForFireDoor(fireDoorRow, tenantId);
  }

  // Generate BOM using unified template system
  const bom = await generateTemplateProduct({
    productTypeId,
    fieldValues,
    tenantId,
  });

  // Store BOM in database
  const stored = await prisma.fireDoorBOM.upsert({
    where: { fireDoorId },
    create: {
      fireDoorId,
      tenantId,
      productTypeId,
      bomData: bom as unknown as Prisma.InputJsonValue,
      totalCost: bom.totalPrice,
      itemCount: bom.lineItems.length,
    },
    update: {
      productTypeId,
      bomData: bom as unknown as Prisma.InputJsonValue,
      totalCost: bom.totalPrice,
      itemCount: bom.lineItems.length,
      updatedAt: new Date(),
    },
  });

  return {
    id: stored.id,
    fireDoorId: stored.fireDoorId,
    tenantId: stored.tenantId,
    productTypeId: stored.productTypeId,
    bomData: stored.bomData,
    totalCost: toNumber(stored.totalCost),
    itemCount: toNumber(stored.itemCount),
    generatedAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

/**
 * Get BOM for a fire door row
 */
export async function getFireDoorBOM(
  fireDoorId: string
): Promise<FireDoorBOM | null> {
  const stored = await prisma.fireDoorBOM.findUnique({
    where: { fireDoorId },
  });

  if (!stored) return null;

  return {
    id: stored.id,
    fireDoorId: stored.fireDoorId,
    tenantId: stored.tenantId,
    productTypeId: stored.productTypeId,
    bomData: stored.bomData,
    totalCost: toNumber(stored.totalCost),
    itemCount: toNumber(stored.itemCount),
    generatedAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

/**
 * Batch generate BOMs for multiple fire door rows
 *
 * Used when:
 * - Importing CSV with fire doors
 * - User selects multiple rows and clicks "Generate BOMs"
 * - Scheduled job processes new rows
 *
 * Returns progress and any errors
 */
export async function batchGenerateFireDoorBOMs(
  fireDoorRows: FireDoorRowData[]
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ rowId: string; error: string }>;
  results: FireDoorBOM[];
}> {
  const results: FireDoorBOM[] = [];
  const errors: Array<{ rowId: string; error: string }> = [];
  let success = 0;
  let failed = 0;

  for (const row of fireDoorRows) {
    try {
      const bom = await generateFireDoorBOM(row);
      results.push(bom);
      success++;
    } catch (error) {
      failed++;
      errors.push({
        rowId: row.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { success, failed, errors, results };
}

/**
 * Delete BOM for a fire door row
 */
export async function deleteFireDoorBOM(fireDoorId: string): Promise<void> {
  await prisma.fireDoorBOM.delete({
    where: { fireDoorId },
  }).catch(() => {
    // Silently ignore if BOM doesn't exist
  });
}

/**
 * Get BOM summary for UI display
 *
 * Returns condensed info for grid display:
 * - Total cost
 * - Item count
 * - Top 3 components by cost
 * - Last generated time
 */
export async function getFireDoorBOMSummary(
  fireDoorId: string
): Promise<{
  totalCost: number;
  itemCount: number;
  topComponents: Array<{ code: string; cost: number }>;
  generatedAt: Date;
} | null> {
  const bom = await getFireDoorBOM(fireDoorId);
  if (!bom) return null;

  const lineItems = Array.isArray((bom as any).bomData?.lineItems)
    ? (bom as any).bomData.lineItems
    : [];

  const topComponents = lineItems
    .sort((a: any, b: any) => toNumber(b.totalCost) - toNumber(a.totalCost))
    .slice(0, 3)
    .map((item: any) => ({
      code: item.componentCode,
      cost: toNumber(item.totalCost),
    }));

  return {
    totalCost: bom.totalCost,
    itemCount: bom.itemCount,
    topComponents,
    generatedAt: bom.generatedAt,
  };
}
