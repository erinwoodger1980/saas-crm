import request from 'supertest';
import express from 'express';
import { prisma } from '../src/prisma';
import developersRouter from '../src/routes/developers';

// Simple auth stub
function authStub(isDeveloper = true) {
  return (req: any, _res: any, next: any) => {
    req.auth = { user: { isDeveloper }, isDeveloper, userId: 'dev-user' };
    next();
  };
}

describe('/developers API', () => {
  const app = express();
  app.use(express.json());
  app.use(authStub(true));
  app.use('/developers', developersRouter);

  let tenantId: string;
  beforeAll(async () => {
    const t = await prisma.tenant.create({ data: { name: 'Dev Tenant', slug: `dev-tenant-${Date.now()}` } });
    tenantId = t.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it('creates a new developer user when email not found', async () => {
    const email = `newdev${Date.now()}@example.com`;
    const res = await request(app).post('/developers').send({ email, name: 'New Dev' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.item.email).toBe(email.toLowerCase());
    const user = await prisma.user.findFirst({ where: { email } });
    expect(user?.isDeveloper).toBe(true);
  });

  it('promotes existing user to developer', async () => {
    const email = `existing${Date.now()}@example.com`;
    const user = await prisma.user.create({ data: { tenantId, email, role: 'user' } });
    expect(user.isDeveloper).toBe(false);
    const res = await request(app).post('/developers').send({ email });
    expect(res.status).toBe(200);
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.isDeveloper).toBe(true);
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/developers').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('lists developer users', async () => {
    const res = await request(app).get('/developers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('forbids non-developer access', async () => {
    const app2 = express();
    app2.use(express.json());
    app2.use(authStub(false));
    app2.use('/developers', developersRouter);
    const res = await request(app2).get('/developers');
    expect(res.status).toBe(403);
  });
});
