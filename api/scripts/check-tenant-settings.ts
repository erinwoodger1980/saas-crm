import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  .finally(() => prisma.$disconnect());
