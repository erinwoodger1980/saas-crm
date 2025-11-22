// api/scripts/seedStandardFields.ts
/**
 * Seed standard questionnaire fields for all tenants
 * Run with: npx ts-node scripts/seedStandardFields.ts
 */

import { prisma } from "../src/prisma";
import { STANDARD_FIELDS } from "../src/lib/standardQuestionnaireFields";

async function seedStandardFieldsForTenant(tenantId: string) {
  console.log(`\n📋 Seeding standard fields for tenant: ${tenantId}`);

  // Get or create default questionnaire for this tenant
  let questionnaire = await prisma.questionnaire.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!questionnaire) {
    console.log("  Creating default questionnaire...");
    questionnaire = await prisma.questionnaire.create({
      data: {
        tenantId,
        name: "Default Quote Request Form",
        description: "Standard questionnaire with ML-optimized fields",
        isActive: true,
      },
    });
  }

  console.log(`  Using questionnaire: ${questionnaire.id}`);

  // Check which standard fields already exist
  const existingFields = await prisma.questionnaireField.findMany({
    where: {
      tenantId,
      questionnaireId: questionnaire.id,
      isStandard: true,
    },
    select: { key: true },
  });

  const existingKeys = new Set(existingFields.map((f) => f.key));
  const fieldsToCreate = STANDARD_FIELDS.filter((f) => !existingKeys.has(f.key));

  if (fieldsToCreate.length === 0) {
    console.log("  ✅ All standard fields already exist");
    return { created: 0, skipped: existingKeys.size };
  }

  console.log(`  Creating ${fieldsToCreate.length} standard fields...`);

  let created = 0;
  for (const field of fieldsToCreate) {
    try {
      await prisma.questionnaireField.create({
        data: {
          tenantId,
          questionnaireId: questionnaire.id,
          key: field.key,
          label: field.label,
          type: field.type,
          options: field.options ? field.options : undefined,
          required: field.required,
          costingInputKey: field.costingInputKey || null,
          helpText: field.helpText || null,
          placeholder: field.placeholder || null,
          sortOrder: field.sortOrder,
          isStandard: true,
          isActive: true,
          requiredForCosting: !!field.costingInputKey,
        },
      });
      created++;
      console.log(`    ✓ ${field.key}`);
    } catch (error: any) {
      console.error(`    ✗ ${field.key}: ${error.message}`);
    }
  }

  console.log(`  ✅ Created ${created} standard fields`);
  return { created, skipped: existingKeys.size };
}

async function main() {
  console.log("🌱 Starting standard fields seed...\n");
  console.log(`📊 Total standard fields defined: ${STANDARD_FIELDS.length}`);

  // Get all tenants (Tenant model doesn't have deletedAt)
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true },
  });

  console.log(`\n👥 Found ${tenants.length} active tenants\n`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const tenant of tenants) {
    const result = await seedStandardFieldsForTenant(tenant.id);
    totalCreated += result.created;
    totalSkipped += result.skipped;
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Seed completed!");
  console.log(`   Tenants processed: ${tenants.length}`);
  console.log(`   Fields created: ${totalCreated}`);
  console.log(`   Fields skipped (already exist): ${totalSkipped}`);
  console.log("=".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
