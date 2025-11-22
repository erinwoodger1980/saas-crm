// api/tests/purchaseOrderUpload.test.ts
import request from 'supertest';
import express from 'express';
import fetch from 'node-fetch';
import purchaseOrderUploadRouter from '../src/routes/purchase-order-upload';
import { prisma } from '../src/prisma';

// Simple auth stub
function authStub(req: any, _res: any, next: any) {
  req.auth = { tenantId: testTenantId, userId: 'u_test', role: 'developer' };
  next();
}

let testTenantId: string;

// Mock ML service fetch
jest.mock('node-fetch', () => {
  return jest.fn(async () => ({ ok: true, json: async () => ({ ok: true, count: 2, items: [] }) })) as any;
});

describe('POST /purchase-orders/upload', () => {
  const app = express();
  app.use(express.json());
  app.use(authStub);
  app.use('/purchase-orders/upload', purchaseOrderUploadRouter);

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: 'PO Upload Tenant', slug: 'po-upload-tenant' } });
    testTenantId = tenant.id;
    // Seed a material item to test price change detection
    await prisma.supplier.create({ data: { tenantId: testTenantId, name: 'Accoya Ltd', currency: 'GBP', active: true } });
    await prisma.materialItem.create({
      data: {
        tenantId: testTenantId,
        code: 'ACC123',
        name: 'Accoya Timber',
        category: 'timber',
        cost: 4.50,
        currency: 'GBP',
        unit: 'm',
        supplier: { connect: { tenantId_name: { tenantId: testTenantId, name: 'Accoya Ltd' } } },
        stockQuantity: 0
      }
    });
  });

  afterAll(async () => {
    await prisma.materialItem.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.supplier.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
  });

  it('uploads CSV and returns price change alerts', async () => {
    const csvContent = 'code,name,quantity,unit,unitPrice\nACC123,Accoya Timber,10,m,4.95\nNEW001,New Material,5,unit,12.00';
    const res = await request(app)
      .post('/purchase-orders/upload')
      .field('supplierName', 'Accoya Ltd')
      .attach('file', Buffer.from(csvContent), 'po.csv');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.linesUploaded).toBe(2);
    expect(Array.isArray(res.body.priceChangeAlerts)).toBe(true);
    // Should include a price change for ACC123
    const accoyaChange = res.body.priceChangeAlerts.find((a: any) => a.code === 'ACC123');
    expect(accoyaChange).toBeDefined();
    expect(accoyaChange.oldCost).toBe(4.50);
    expect(accoyaChange.newCost).toBe(4.95);
  });
});
