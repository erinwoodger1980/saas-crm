import express from 'express';
import request from 'supertest';
import featureRequestsRouter from '../routes/featureRequests';

// Mock prisma
jest.mock('../prisma', () => {
  const fr = {
    id: 'fr_123',
    tenantId: 't_1',
    createdByUserId: 'u_1',
    title: 'Test Feature',
    description: 'Add a button',
    category: 'UI',
    allowedFiles: ['web/src/**'],
    priority: 2,
    status: 'OPEN',
    patchText: null,
    branchName: null,
    prUrl: null,
    checksStatus: null,
    logs: null
  } as any;
  return {
    prisma: {
      featureRequest: {
        findUnique: jest.fn(async ({ where: { id } }: any) => id === fr.id ? fr : null),
        update: jest.fn(async ({ where: { id }, data }: any) => ({ ...fr, ...data })),
        findMany: jest.fn(async () => [fr]),
        create: jest.fn(async () => fr)
      }
    }
  };
});

// Mock AI codex functions
jest.mock('../routes/ai/codex', () => ({
  buildPrompt: jest.fn(async () => 'PROMPT'),
  callOpenAI: jest.fn(async () => '*** Update File: web/src/example.ts\n+console.log("hi")'),
  validateAndApplyDiff: jest.fn(async () => {}),
  runChecks: jest.fn(async () => ({ ok: true, errors: 'checks passed' })),
  createBranchAndPR: jest.fn(async () => 'https://example.com/pr/1')
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  // Inject fake auth (owner role)
  app.use((req: any, _res, next) => { req.auth = { tenantId: 't_1', userId: 'u_1', role: 'owner' }; next(); });
  app.use('/feature-requests', featureRequestsRouter);
  return app;
}

describe('featureRequests dry-run AI flow', () => {
  it('returns diff on dry run without persisting READY_FOR_REVIEW', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/feature-requests/admin/fr_123/run-ai')
      .send({ taskKey: 'any-key', dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBeTruthy();
    expect(res.body.patchText).toContain('Update File');
    // status remains original
    expect(res.body.status).toBe('OPEN');
  });
});
