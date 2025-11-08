import express from 'express';
import request from 'supertest';

// Mock prisma client
jest.mock('../src/prisma', () => {
  const featureRequests: any[] = [];
  let idCounter = 1;
  return {
    prisma: {
      featureRequest: {
        create: jest.fn(async ({ data }: any) => {
          const fr = {
            id: `fr${idCounter++}`,
            status: 'OPEN',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          featureRequests.push(fr);
          return fr;
        }),
        findMany: jest.fn(async ({ where }: any = {}) => {
          return featureRequests.filter((fr) => {
            if (where?.tenantId && fr.tenantId !== where.tenantId) return false;
            if (where?.status?.in && !where.status.in.includes(fr.status)) return false;
            return true;
          });
        }),
        findUnique: jest.fn(async ({ where }: any) => {
          return featureRequests.find((fr) => fr.id === where.id) || null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const idx = featureRequests.findIndex((fr) => fr.id === where.id);
          if (idx < 0) throw new Error('not_found');
          featureRequests[idx] = { ...featureRequests[idx], ...data, updatedAt: new Date() };
          return featureRequests[idx];
        }),
      },
    },
    __store: { featureRequests },
  };
});

// Mock AI helpers
jest.mock('../src/routes/ai/codex', () => ({
  buildPrompt: jest.fn(async () => 'Test prompt'),
  callOpenAI: jest.fn(async () => '*** Add File: test.ts\n+console.log("test");\n*** End Patch'),
  validateAndApplyDiff: jest.fn(async () => {}),
  runChecks: jest.fn(async () => ({ ok: true, errors: '' })),
  createBranchAndPR: jest.fn(async () => 'https://github.com/owner/repo/pull/123'),
}));

import featureRequestsRouter from '../src/routes/featureRequests';

function makeApp(auth = { tenantId: 't1', userId: 'u1', role: 'user' }) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.auth = auth; next(); });
  app.use('/feature-requests', featureRequestsRouter);
  return app;
}

describe('Feature Requests API', () => {
  beforeEach(() => {
    const { __store } = require('../src/prisma');
    __store.featureRequests.length = 0;
  });

  it('POST /feature-requests creates a request for tenant', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/feature-requests')
      .send({ tenantId: 't1', title: 'New Feature', description: 'Add feature X', category: 'UI' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('New Feature');
    expect(res.body.tenantId).toBe('t1');
  });

  it('POST /feature-requests denies cross-tenant creation for non-admin', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/feature-requests')
      .send({ tenantId: 't2', title: 'Evil', description: 'Should not work', category: 'UI' });
    expect(res.status).toBe(403);
  });

  it('GET /feature-requests lists tenant requests', async () => {
    const app = makeApp();
  await request(app).post('/feature-requests').send({ tenantId: 't1', title: 'Alpha', description: 'A desc' });
  await request(app).post('/feature-requests').send({ tenantId: 't1', title: 'Beta', description: 'B desc' });
    const res = await request(app).get('/feature-requests?tenantId=t1');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('GET /feature-requests/:id returns detail', async () => {
    const app = makeApp();
    const create = await request(app).post('/feature-requests').send({ tenantId: 't1', title: 'Detail', description: 'Detail desc' });
    const id = create.body.id;
    const res = await request(app).get(`/feature-requests/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.title).toBe('Detail');
  });

  it('GET /feature-requests/admin/queue returns queue for admin', async () => {
    const adminApp = makeApp({ tenantId: 't1', userId: 'u1', role: 'admin' });
    await request(adminApp).post('/feature-requests').send({ tenantId: 't1', title: 'Pending', description: 'Pending desc' });
    const res = await request(adminApp).get('/feature-requests/admin/queue');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /admin/:id/run-ai generates patch and sets READY_FOR_REVIEW', async () => {
    const adminApp = makeApp({ tenantId: 't1', userId: 'u1', role: 'admin' });
    const create = await request(adminApp).post('/feature-requests').send({ tenantId: 't1', title: 'AI Test', description: 'AI desc' });
    const id = create.body.id;
    const res = await request(adminApp).post(`/feature-requests/admin/${id}/run-ai`).send({ taskKey: 'ads-lp-prod', extraContext: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY_FOR_REVIEW');
    expect(res.body.patchText).toBeTruthy();
  });

  it('POST /admin/:id/approve validates, applies, checks, and creates PR', async () => {
    const adminApp = makeApp({ tenantId: 't1', userId: 'u1', role: 'admin' });
    const create = await request(adminApp).post('/feature-requests').send({ tenantId: 't1', title: 'Approve Test', description: 'Approve desc' });
    const id = create.body.id;
    await request(adminApp).post(`/feature-requests/admin/${id}/run-ai`).send({ taskKey: 'ads-lp-prod' });
    const res = await request(adminApp).post(`/feature-requests/admin/${id}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.prUrl).toBeTruthy();
  });

  it('POST /admin/:id/reject marks as REJECTED', async () => {
    const adminApp = makeApp({ tenantId: 't1', userId: 'u1', role: 'admin' });
    const create = await request(adminApp).post('/feature-requests').send({ tenantId: 't1', title: 'Reject Test', description: 'Reject desc' });
    const id = create.body.id;
    const res = await request(adminApp).post(`/feature-requests/admin/${id}/reject`).send({ reason: 'Not suitable' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
  });
});
