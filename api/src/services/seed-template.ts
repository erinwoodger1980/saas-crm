// Service to initialize new tenants with seed template data
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SEED_TENANT_ID = 'seed_template_tenant';

export async function initializeTenantWithSeedData(tenantId: string) {
  try {
    console.log(`🌱 Initializing tenant ${tenantId} with seed data...`);

    // Copy questionnaire fields from seed template
    const seedQuestionnaireFields = await prisma.leadFieldDef.findMany({
      where: { tenantId: SEED_TENANT_ID }
    });

    for (const field of seedQuestionnaireFields) {
      await prisma.leadFieldDef.create({
        data: {
          tenantId,
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          config: field.config as any, // Handle Prisma JSON type
          sortOrder: field.sortOrder
        }
      });
    }

    console.log(`✅ Copied ${seedQuestionnaireFields.length} questionnaire fields to tenant ${tenantId}`);

    // You can add more seed data copying here:
    // - Sample task templates
    // - Default email templates
    // - Sample automation rules
    // - Default settings

    return {
      success: true,
      questionnaireFields: seedQuestionnaireFields.length
    };

  } catch (error) {
    console.error(`❌ Failed to initialize tenant ${tenantId} with seed data:`, error);
    throw error;
  }
}

export async function ensureSeedTemplateExists() {
  try {
    const seedTenant = await prisma.tenant.findUnique({
      where: { id: SEED_TENANT_ID }
    });

    if (!seedTenant) {
      console.log('⚠️  Seed template tenant not found. Please run: npm run seed-template');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to ensure seed template exists:', error);
    return false;
  }
}