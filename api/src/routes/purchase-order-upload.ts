// api/src/routes/purchase-order-upload.ts
// Manual Purchase Order upload + material cost learning
import { Router } from 'express';
import multer from 'multer';
// Removed external CSV parser dependency; using lightweight internal parser to avoid missing module errors.
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
  // Very simple CSV parser (supports quoted fields, commas, newlines)
  const text = buffer.toString('utf-8');
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = i + 1 < text.length ? text[i + 1] : '';
    if (ch === '"') {
      if (inQuotes && next === '"') { field += '"'; i++; continue; }
      inQuotes = !inQuotes; continue;
    }
    if (ch === ',' && !inQuotes) { current.push(field); field = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      current.push(field); field=''; rows.push(current.map(f=>f.trim())); current=[]; continue;
    }
    field += ch;
  }
  if (field.length || current.length) { current.push(field); rows.push(current.map(f=>f.trim())); }
  if (!rows.length) return [];
  const headers = rows[0].map(h=>h.replace(/^\ufeff/, '')).map(h=>h.toLowerCase());
  const dataRows = rows.slice(1).filter(r=>r.some(c=>c.trim().length));
  const indexOf = (h: string) => headers.indexOf(h.toLowerCase());
  return dataRows.map(r => {
    const grab = (keys: string[]): string => {
      for (const k of keys) { const idx = indexOf(k); if (idx >= 0 && idx < r.length) { const v = r[idx].trim(); if (v) return v; } }
      return '';
    };
    const rawQty = grab(['quantity','qty']);
    const rawUnitPrice = grab(['unitprice','price','cost']);
    const out: ParsedLine = {
      code: grab(['code','material_code']) || undefined,
      name: grab(['name','material_name','description']) || undefined,
      quantity: rawQty ? Number(rawQty) : undefined,
      unit: grab(['unit','uom']) || undefined,
      unitPrice: rawUnitPrice ? Number(rawUnitPrice) : undefined,
      currency: grab(['currency']) || 'GBP'
    };
    return out;
  }).filter(l => l.unitPrice && (l.code || l.name));
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
    // Find existing supplier by tenant + name (no composite unique constraint in schema)
    let supplier = await prisma.supplier.findFirst({ where: { tenantId, name: supplierName } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { tenantId, name: supplierName, defaultCurrency: 'GBP', isActive: true }
      });
    }

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
            category: 'CONSUMABLE',
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
