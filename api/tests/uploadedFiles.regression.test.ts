import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { prisma } from '../src/prisma';
import quotesRouter from '../src/routes/quotes';

/**
 * Regression test: ensure /quotes/:id/files always persists UploadedFile.name and mimeType as non-empty strings.
 * We exercise both normal filename and fallback path (blank filename -> 'attachment').
 */
describe('POST /quotes/:id/files uploaded file name/mimeType regression', () => {
  const app = express();
  let tenantId: string;
  let quoteId: string;

  beforeAll(async () => {
    // Create test tenant & quote
    const slug = `test-tenant-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant Upload Regression',
        slug,
      }
    });
    tenantId = tenant.id;
    const quote = await prisma.quote.create({
      data: {
        tenantId,
        title: 'Upload Regression Quote',
        // minimal meta
        meta: { test: true },
      },
      select: { id: true }
    });
    quoteId = quote.id;

    // Legacy DB may contain lowercase default for quoteSourceType; null it to avoid enum mapping errors
    try {
      await prisma.$executeRawUnsafe(`UPDATE "Quote" SET "quoteSourceType" = NULL WHERE "id" = $1`, quoteId);
    } catch {}

    // Inject auth stub so getTenantId(req) returns our tenant
    app.use((req, _res, next) => { (req as any).auth = { tenantId }; next(); });
    app.use('/quotes', quotesRouter);
  });

  afterAll(async () => {
    // Cleanup created rows
    try { await prisma.uploadedFile.deleteMany({ where: { quoteId } }); } catch {}
    try { await prisma.quote.delete({ where: { id: quoteId } }); } catch {}
    try { await prisma.tenant.delete({ where: { id: tenantId } }); } catch {}
  });

  it('persists name and mimeType for normal filename and fallback for blank filename', async () => {
    // Create a temporary file for upload
    const tmpFile1 = path.join(os.tmpdir(), `upload-test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile1, 'hello world');
    const tmpFile2 = path.join(os.tmpdir(), `upload-test-blank-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile2, 'blank name test');

    const res = await request(app)
      .post(`/quotes/${quoteId}/files`)
      .attach('files', tmpFile1, 'sample-a.txt')
      // Provide a filename that trims to empty to trigger fallback 'attachment'
      .attach('files', tmpFile2, '    ');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('files');
    const files = res.body.files as Array<any>;
    expect(files.length).toBe(2);

    const normal = files.find(f => f.name === 'sample-a.txt');
    const fallback = files.find(f => f.name === 'attachment');

    expect(normal).toBeTruthy();
    expect(typeof normal.mimeType).toBe('string');
    expect(normal.mimeType.length).toBeGreaterThan(0);

    expect(fallback).toBeTruthy();
    expect(fallback.name).toBe('attachment');
    expect(typeof fallback.mimeType).toBe('string');
    expect(fallback.mimeType.length).toBeGreaterThan(0);

    // Double-check DB rows reflect same guarantees
    const dbFiles = await prisma.uploadedFile.findMany({ where: { quoteId } });
    expect(dbFiles.length).toBe(2);
    for (const f of dbFiles) {
      expect(typeof f.name).toBe('string');
      expect(f.name.trim().length).toBeGreaterThan(0);
      // mimeType optional in schema, but we enforce a non-empty string via route fallback
      expect(typeof f.mimeType).toBe('string');
      expect((f.mimeType as string).length).toBeGreaterThan(0);
    }
  });
});
