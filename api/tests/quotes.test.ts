import express from 'express';
import request from 'supertest';

// Mock prisma client used inside routes
jest.mock('../src/prisma', () => {
  const quoteLines = [
    { id: 'ln1', quoteId: 'q1', description: 'Item A', qty: 1, unitPrice: 100, currency: 'GBP', meta: {} },
    { id: 'ln2', quoteId: 'q1', description: 'Item B', qty: 1, unitPrice: 100, currency: 'GBP', meta: {} },
  ];
  let quote = {
    id: 'q1', tenantId: 't1', title: 'Test Quote', status: 'DRAFT', currency: 'GBP',
    markupDefault: 0.25, lines: quoteLines, leadId: 'lead1', meta: {},
    tenant: { id: 't1', name: 'Tenant' }, lead: { id: 'lead1', contactName: 'Client', email: 'c@example.com', custom: {} },
  } as any;

  const updates: Record<string, any> = {};

  return {
    prisma: {
      quoteLine: {
        findMany: jest.fn(async (args: any) => {
          return quoteLines;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const idx = quoteLines.findIndex((l) => l.id === where.id);
          if (idx >= 0) {
            quoteLines[idx] = { ...quoteLines[idx], meta: (data?.meta?.set ?? quoteLines[idx].meta) } as any;
          }
          return quoteLines[idx];
        }),
      },
      quote: {
        findFirst: jest.fn(async ({ where, include }: any) => {
          if (where?.id === 'q1' && where?.tenantId === 't1') {
            return include?.lines ? { ...quote, lines: quoteLines } : quote;
          }
          return null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          if (where?.id === 'q1') {
            quote = { ...quote, ...data };
            return quote;
          }
          return null;
        }),
      },
      parsedSupplierLine: {
        findMany: jest.fn(async () => []),
      },
      modelVersion: {
        findFirst: jest.fn(async () => ({ id: 'mv1', model: 'qa_estimator', isProduction: true })),
      },
      estimate: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: 'est1' })),
      },
    },
  };
});

// Mock training service logs to no-op
jest.mock('../src/services/training', () => ({
  logInferenceEvent: jest.fn(async () => {}),
  logInsight: jest.fn(async () => {}),
}));

// Import router after mocks
import quotesRouter from '../src/routes/quotes';

function makeApp() {
  const app = express();
  app.use(express.json());
  // Inject auth
  app.use((req: any, _res, next) => { req.auth = { tenantId: 't1', userId: 'u1' }; next(); });
  app.use('/quotes', quotesRouter);
  return app;
}

describe('Quotes API', () => {
  it('GET /quotes/:id/lines returns lines for quote', async () => {
    const app = makeApp();
    const res = await request(app).get('/quotes/q1/lines');
    expect(res.status).toBe(200);
  expect(Array.isArray(res.body?.lines)).toBe(true);
  expect(res.body.lines.length).toBeGreaterThanOrEqual(2);
  expect(res.body.lines[0]).toHaveProperty('description');
  expect(res.body.lines[0]).toHaveProperty('qty');
  });

  it('POST /quotes/:id/price (ml questionnaire) scales totals and updates quote', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/quotes/q1/price')
      .send({ method: 'ml', source: 'questionnaire' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.method).toBe('ml');
    expect(res.body.predictedTotal).toBe(2000);
    expect(res.body.totalGBP).toBeGreaterThan(0);
  });

  it('POST /quotes/:id/price uses custom.items[0] when present', async () => {
    const app = makeApp();
    const { prisma } = require('../src/prisma');
    // Return a quote where lead.custom has an items array
    prisma.quote.findFirst.mockResolvedValueOnce({
      id: 'q1', tenantId: 't1', title: 'Test Quote', status: 'DRAFT', currency: 'GBP',
      markupDefault: 0.25,
      lines: [
        { id: 'a', quoteId: 'q1', description: 'Line 1', qty: 2, unitPrice: 0, currency: 'GBP', meta: {} },
        { id: 'b', quoteId: 'q1', description: 'Line 2', qty: 1, unitPrice: 0, currency: 'GBP', meta: {} },
      ],
      leadId: 'lead1', meta: {},
      tenant: { id: 't1', name: 'Tenant' },
      lead: { id: 'lead1', contactName: 'Client', email: 'c@example.com', custom: { address: 'Somewhere', items: [{ width: 1200, height: 800, timber: 'Oak' }] } },
    });

    const res = await request(app)
      .post('/quotes/q1/price')
      .send({ method: 'ml', source: 'questionnaire' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.method).toBe('ml');
    // Our mocked ML returns 2000 regardless of features; ensure distribution still sums to predicted total
    expect(Math.round(res.body.totalGBP)).toBe(2000);
  });

  it('POST /quotes/:id/price distributes predicted total when costs are zero', async () => {
    const app = makeApp();
    // Override mocked lines to have zero cost
    const { prisma } = require('../src/prisma');
    const linesZero = [
      { id: 'lz1', quoteId: 'q1', description: 'No cost A', qty: 2, unitPrice: 0, currency: 'GBP', meta: {} },
      { id: 'lz2', quoteId: 'q1', description: 'No cost B', qty: 1, unitPrice: 0, currency: 'GBP', meta: {} },
    ];
    prisma.quote.findFirst.mockResolvedValueOnce({
      id: 'q1', tenantId: 't1', title: 'Test Quote', status: 'DRAFT', currency: 'GBP',
      markupDefault: 0.25, lines: linesZero, leadId: 'lead1', meta: {},
      tenant: { id: 't1', name: 'Tenant' }, lead: { id: 'lead1', contactName: 'Client', email: 'c@example.com', custom: {} },
    });

    const res = await request(app)
      .post('/quotes/q1/price')
      .send({ method: 'ml', source: 'questionnaire' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.method).toBe('ml');
    expect(res.body.predictedTotal).toBe(2000);
    expect(Math.round(res.body.totalGBP)).toBe(2000); // should distribute to equal predicted total
  });
});
