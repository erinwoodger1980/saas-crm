import prisma from "../db";
import { STANDARD_FIELDS } from "../lib/standardQuestionnaireFields";

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, name: true } });
  if (!tenants.length) {
    console.log("No tenants found. Create a tenant first before seeding standard questionnaire fields.");
    return;
  }

  for (const tenant of tenants) {
    // Ensure a default questionnaire exists
    let questionnaire = await prisma.questionnaire.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: "asc" } });
    if (!questionnaire) {
      questionnaire = await prisma.questionnaire.create({ data: { tenantId: tenant.id, name: "Default", description: "Default questionnaire", isActive: true } });
      console.log(`[seed-standard-fields] Created default questionnaire for tenant ${tenant.slug}`);
    }

    // Fetch existing keys to avoid duplicates
    const existing = await prisma.questionnaireField.findMany({ where: { tenantId: tenant.id }, select: { key: true } });
    const existingKeys = new Set(existing.map(e => e.key));

    let createdCount = 0;
    for (const f of STANDARD_FIELDS) {
      if (existingKeys.has(f.key)) continue;
      await prisma.questionnaireField.create({
        data: {
          tenantId: tenant.id,
          questionnaireId: questionnaire.id,
          key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            placeholder: f.placeholder || null,
            helpText: f.helpText || null,
            config: f.options ? { options: f.options } : undefined,
            sortOrder: f.sortOrder,
            isActive: true,
            costingInputKey: f.costingInputKey || null,
            scope: f.scope,
            isHidden: false,
            isStandard: true,
        }
      });
      createdCount++;
    }
    console.log(`[seed-standard-fields] Tenant ${tenant.slug}: added ${createdCount} standard fields (now ${existingKeys.size + createdCount} total).`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
