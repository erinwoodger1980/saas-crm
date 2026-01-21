import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'wealden-joinery' },
  });

  if (!tenant) {
    console.log('❌ Tenant not found');
    return;
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id },
  });

  if (settings) {
    console.log('✅ TenantSettings exists');
    console.log('Questionnaire field length:', Array.isArray(settings.questionnaire) ? settings.questionnaire.length : 'null/undefined');
    console.log('Questionnaire value:', JSON.stringify(settings.questionnaire, null, 2));
  } else {
    console.log('❌ TenantSettings NOT found - will be created on first API call');
  }
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
