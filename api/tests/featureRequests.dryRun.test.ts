import express from 'express';
import request from 'supertest';
import featureRequestsRouter from '../src/routes/featureRequests';

jest.mock('../src/prisma', () => {
  const fr = {
    id: 'fr_dry',
    tenantId: 't1',
    createdByUserId: 'u1',
    title: 'DryRun',
    description: 'Dry run diff',
    category: 'UI',
    allowedFiles: ['web/src/**'],
    priority: 2,
    status: 'OPEN',
    patchText: null,
  } as any;
  return {
    prisma: {
      featureRequest: {
        findUnique: jest.fn(async ({ where: { id } }: any) => id === fr.id ? fr : null),
        update: jest.fn(async ({ where: { id }, data }: any) => ({ ...fr, ...data })),
      }
    }
  };
});

jest.mock('../src/routes/ai/codex', () => ({
  buildPrompt: jest.fn(async () => 'PROMPT'),
  callOpenAI: jest.fn(async () => '*** Update File: web/src/example.ts\n+console.log("hi")'),
  validateAndApplyDiff: jest.fn(async () => {}),
  runChecks: jest.fn(async () => ({ ok: true, errors: 'ok' })),
  createBranchAndPR: jest.fn(async () => 'https://example.test/pr/1')
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.auth = { tenantId: 't1', userId: 'u1', role: 'owner' }; next(); });
  app.use('/feature-requests', featureRequestsRouter);
  return app;
}

describe('featureRequests dry-run flow', () => {
  it('returns diff without changing status', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/feature-requests/admin/fr_dry/run-ai')
      .send({ taskKey: 'ads-lp-prod', dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.patchText).toMatch(/Update File/);
    expect(res.body.status).toBe('OPEN');
  });
});
