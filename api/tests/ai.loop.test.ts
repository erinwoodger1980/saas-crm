import express from 'express';
import request from 'supertest';

// Mock prisma aiSession table with in-memory store
jest.mock('../src/prisma', () => {
  const aiSessions: any[] = [];
  return {
    prisma: {
      aiSession: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `sess_${aiSessions.length + 1}`, rounds: 0, ...data, createdAt: new Date(), updatedAt: new Date() };
          aiSessions.push(row);
          return row;
        }),
        findUnique: jest.fn(async ({ where }: any) => aiSessions.find(s => s.id === where.id) || null),
        update: jest.fn(async ({ where, data }: any) => {
          const idx = aiSessions.findIndex(s => s.id === where.id);
          if (idx < 0) throw new Error('not_found');
          aiSessions[idx] = { ...aiSessions[idx], ...data, updatedAt: new Date() };
          return aiSessions[idx];
        }),
      },
    },
    __store: { aiSessions },
  };
});

// Stub queueRun to avoid kicking the background loop in tests
jest.mock('../src/services/ai/loop', () => ({ queueRun: jest.fn() }));

import loopRouter from '../src/routes/ai/loop';

function makeApp(role: 'user'|'admin'|'owner'='admin') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.auth = { userId: 'u1', tenantId: 't1', role }; next(); });
  app.use('/ai/loop', loopRouter);
  return app;
}

describe('AI Loop routes', () => {
  it('POST /ai/loop/start requires admin', async () => {
    const app = makeApp('user');
    const res = await request(app).post('/ai/loop/start').send({ taskKey: 'test', description: 'desc' });
    expect(res.status).toBe(403);
  });

  it('POST /ai/loop/start creates a session and returns id', async () => {
    const app = makeApp('admin');
    const res = await request(app).post('/ai/loop/start').send({ taskKey: 'test', description: 'try change', files: ['web/src/**'], mode: 'dry-run', maxRounds: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessionId');
  });

  it('POST /ai/loop/status returns snapshot', async () => {
    const app = makeApp('admin');
    const start = await request(app).post('/ai/loop/start').send({ taskKey: 'test', description: 'desc', files: ['api/src/**'] });
    const sessionId = start.body.sessionId as string;
    const res = await request(app).post('/ai/loop/status').send({ sessionId });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'OPEN', rounds: 0, maxRounds: 3 });
  });
});
