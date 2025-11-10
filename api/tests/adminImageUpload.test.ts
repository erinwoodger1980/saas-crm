import request from 'supertest';
import fs from 'fs';
import path from 'path';

/**
 * Integration test for cookie-auth image uploads to /api/admin/landing-tenants/:id/images
 * Uses /seed to obtain a JWT, sets it as cookie, then performs multipart upload.
 * Skips if running in CI without server (requires dev server running on PORT env).
 */

describe('admin image upload', () => {
  const API_ORIGIN = process.env.API_ORIGIN || `http://localhost:${process.env.PORT || 4000}`;
  let jwt: string | null = null;
  let tenantId: string | null = null;

  beforeAll(async () => {
    try {
      const seedResp = await request(API_ORIGIN).post('/seed');
      if (seedResp.status !== 200) {
        console.warn('seed failed status:', seedResp.status);
        return; // leave jwt null to skip tests
      }
      jwt = seedResp.body.token || seedResp.body.jwt || null;
      tenantId = seedResp.body.tenant?.id || null;
    } catch (e) {
      console.warn('seed request failed, skipping tests', (e as any)?.message);
    }
  });

  function skipIfNoJwt() {
    if (!jwt || !tenantId) {
      console.warn('No JWT/tenantId from seed; skipping image upload tests');
      return true;
    }
    return false;
  }

  test('uploads a single image with cookie auth', async () => {
    if (skipIfNoJwt()) return; // Skip

    // Create a small in-memory PNG buffer (1x1 pixel)
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wk7l3IAAAAASUVORK5CYII=';
    const imgBuffer = Buffer.from(pngBase64, 'base64');
    const tmpFile = path.join(__dirname, 'tmp-test.png');
    fs.writeFileSync(tmpFile, imgBuffer);

    const res = await request(API_ORIGIN)
      .post(`/api/admin/landing-tenants/${tenantId}/images`)
      .set('Cookie', [`jauth=${jwt}`])
      .attach('images', tmpFile);

    fs.unlinkSync(tmpFile);

    expect([200,201]).toContain(res.status);
    expect(Array.isArray(res.body)).toBe(true);
    if (Array.isArray(res.body) && res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('url');
      expect(res.body[0]).toHaveProperty('altText');
    }
  });

  test('rejects upload without auth cookie', async () => {
    if (skipIfNoJwt()) return; // Skip

    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wk7l3IAAAAASUVORK5CYII=';
    const imgBuffer = Buffer.from(pngBase64, 'base64');
    const tmpFile = path.join(__dirname, 'tmp-test2.png');
    fs.writeFileSync(tmpFile, imgBuffer);

    const res = await request(API_ORIGIN)
      .post(`/api/admin/landing-tenants/${tenantId}/images`)
      .attach('images', tmpFile);

    fs.unlinkSync(tmpFile);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});
