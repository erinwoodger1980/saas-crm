// Silence only console.warn during tests but keep console.error visible for debugging
try {
  // @ts-ignore
  jest.spyOn(console, 'warn').mockImplementation(() => {});
} catch {}

// Ensure prisma schema migrated for tests (idempotent)
import { prisma } from '../src/prisma';
import { execSync } from 'child_process';
async function ensureSchema() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "Questionnaire" LIMIT 1`;
  } catch {
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    } catch (e) {
      // swallow migration failure; tests may still run if tables exist
    }
  }
}
beforeAll(async () => {
  await ensureSchema();
});

// Provide a basic global.fetch mock for ML calls
(global as any).fetch = async (url: string, init?: any) => {
  // Return a simple ML predict response for /ml/predict
  if (String(url).includes('/ml/predict')) {
    const body = JSON.stringify({ predicted_total: 2000, confidence: 0.8, model_version: 'test-model-1' });
    return {
      ok: true,
      status: 200,
      async text() { return body; },
    } as any;
  }
  // Default minimal 404
  return {
    ok: false,
    status: 404,
    async text() { return ''; },
  } as any;
};
