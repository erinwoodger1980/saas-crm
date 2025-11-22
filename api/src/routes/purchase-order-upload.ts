// api/src/routes/purchase-order-upload.ts
// Manual Purchase Order upload + material cost learning
import { Router } from 'express';
import multer from 'multer';
import csv from 'csv-parse/sync';
import { prisma } from '../prisma';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: 'unauthorized' });
  next();
}

interface ParsedLine {
  code?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  currency?: string;
}

function parseCsv(buffer: Buffer): ParsedLine[] {
  const text = buffer.toString('utf-8');
  const records: any[] = csv.parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true });
  return records.map(r => ({
    code: (r.code || r.material_code || '').trim() || undefined,
    name: (r.name || r.material_name || '').trim() || undefined,
    quantity: r.quantity ? Number(r.quantity) : undefined,
    unit: (r.unit || '').trim() || undefined,
    unitPrice: r.unitPrice ? Number(r.unitPrice) : (r.price ? Number(r.price) : undefined),
    currency: (r.currency || 'GBP').trim()
  })).filter(l => l.unitPrice && (l.code || l.name));
}

router.post('/', requireAuth, upload.single('file'), async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const supplierName: string | undefined = req.body.supplierName || undefined;
  const opportunityId: string | undefined = req.body.opportunityId || undefined;
  const purchaseOrderRef: string | undefined = req.body.purchaseOrderRef || undefined; // external ref

  try {
    let lines: ParsedLine[] = [];
    if (req.file) {
      lines = parseCsv(req.file.buffer);
    } else if (Array.isArray(req.body.lines)) {
      lines = req.body.lines as ParsedLine[];
    } else {
      return res.status(400).json({ error: 'no_lines', message: 'Provide CSV file or lines[] JSON' });
    }

    if (!supplierName) {
      return res.status(400).json({ error: 'supplier_required' });
    }

    // Resolve supplier (create if missing)
    const supplier = await prisma.supplier.upsert({
      where: { tenantId_name: { tenantId, name: supplierName } },
      update: {},
      create: { tenantId, name: supplierName, currency: 'GBP', active: true }
    });

    // Create a PurchaseOrder (status RECEIVED immediately for manual historical upload)
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId: supplier.id,
        status: 'RECEIVED',
        currency: 'GBP',
        totalAmount: 0,
        notes: `Manual upload${opportunityId ? ' Opportunity: ' + opportunityId : ''}`,
        orderDate: new Date(),
        receivedDate: new Date()
      }
    });

    const materialCostPayload: any[] = [];
    const priceChangeAlerts: any[] = [];
    let totalAmount = 0;

    for (const l of lines) {
      const code = l.code || undefined;
      const name = l.name || code || 'Unknown';
      const unitPrice = l.unitPrice || 0;
      totalAmount += unitPrice * (l.quantity || 1);

      // Find existing material item by code first then name
      let materialItem = code ? await prisma.materialItem.findFirst({ where: { tenantId, code } }) : null;
      if (!materialItem && name) {
        materialItem = await prisma.materialItem.findFirst({ where: { tenantId, name } });
      }

      let previousCost: number | null = null;
      if (!materialItem) {
        materialItem = await prisma.materialItem.create({
          data: {
            tenantId,
            code: code || `mat_${Date.now()}`,
            name,
            category: 'consumable',
            cost: unitPrice,
            currency: l.currency || 'GBP',
            unit: l.unit || 'unit',
            supplierId: supplier.id,
            stockQuantity: 0
          }
        });
      } else {
        previousCost = Number(materialItem.cost);
        if (previousCost !== unitPrice) {
          // Update cost
          await prisma.materialItem.update({
            where: { id: materialItem.id },
            data: { cost: unitPrice }
          });
          const deltaPercent = previousCost > 0 ? ((unitPrice - previousCost) / previousCost) * 100 : null;
          priceChangeAlerts.push({
            code: materialItem.code,
            name: materialItem.name,
            oldCost: previousCost,
            newCost: unitPrice,
            deltaPercent: deltaPercent !== null ? Number(deltaPercent.toFixed(2)) : null
          });
        }
      }

      // Create PO line
      await prisma.purchaseOrderLine.create({
        data: {
          purchaseOrderId: po.id,
          materialItemId: materialItem.id,
          description: name,
          quantity: l.quantity ? l.quantity as any : (1 as any),
          unit: l.unit || 'unit',
          unitPrice: unitPrice as any,
          lineTotal: (unitPrice * (l.quantity || 1)) as any,
          notes: purchaseOrderRef || null
        }
      });

      materialCostPayload.push({
        tenantId,
        materialCode: materialItem.code,
        materialName: materialItem.name,
        supplierName: supplierName,
        currency: l.currency || 'GBP',
        unit: l.unit || 'unit',
        unitPrice,
        previousUnitPrice: previousCost,
        purchaseOrderId: po.id
      });
    }

    // Update PO total
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { totalAmount: totalAmount as any }
    });

    // Call ML service to save material costs
    const ML_URL = (process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || 'http://localhost:8000').replace(/\/$/, '');
    let mlResult: any = null;
    try {
      const r = await fetch(`${ML_URL}/save-material-costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, items: materialCostPayload })
      });
      if (r.ok) mlResult = await r.json();
    } catch (e: any) {
      console.warn('[purchase-order-upload] ML material cost save failed:', e.message || e);
    }

    return res.json({
      ok: true,
      purchaseOrderId: po.id,
      supplier: supplierName,
      linesUploaded: lines.length,
      priceChangeAlerts,
      materialCostsSaved: mlResult?.count || 0,
      mlItems: mlResult?.items || [],
      totalAmount
    });
  } catch (e: any) {
    console.error('[purchase-order-upload] failed:', e);
    return res.status(500).json({ error: 'internal_error', message: e.message || String(e) });
  }
});

export default router;
