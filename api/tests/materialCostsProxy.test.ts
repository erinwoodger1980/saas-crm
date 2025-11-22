// api/tests/materialCostsProxy.test.ts
import request from 'supertest';
import express from 'express';
import fetch from 'node-fetch';
import mlRouter from '../src/routes/ml';

// Mock ML fetch for recent material costs
jest.mock('node-fetch', () => {
  return jest.fn(async (url: string) => {
    if (url.includes('/material-costs/recent')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ ok: true, materials: [{ material_code: 'ACC123', unit_price: 4.95, previous_unit_price: 4.50, price_change_percent: 10.0 }], recent: [], count: 1 })
      } as any;
    }
    return { ok: false, status: 404, text: async () => 'not found' } as any;
  }) as any;
});

describe('GET /ml/material-costs/recent', () => {
  const app = express();
  app.use((req: any, _res, next) => { req.auth = { tenantId: 't_test' }; next(); });
  app.use('/ml', mlRouter);

  it('returns recent material cost changes', async () => {
    const res = await request(app).get('/ml/material-costs/recent');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.materials)).toBe(true);
    expect(res.body.materials[0].material_code).toBe('ACC123');
    expect(res.body.materials[0].price_change_percent).toBe(10.0);
  });
});
