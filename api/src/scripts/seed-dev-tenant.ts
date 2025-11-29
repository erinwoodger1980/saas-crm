import prisma from "../db";
import { STANDARD_FIELDS } from "../lib/standardQuestionnaireFields";

async function main() {
  const argv = process.argv.slice(2);
  const getArg = (flag: string, def?: string) => {
    const idx = argv.findIndex(a => a === flag || a === `--${flag}`);
    if (idx === -1) return def;
    return argv[idx + 1] && !argv[idx + 1].startsWith("-") ? argv[idx + 1] : def;
  };

  const slug = getArg("slug", "dev-tenant");
  const name = getArg("name", "Dev Tenant");
  console.log(`[seed-tenant] Using slug=${slug} name=${name}`);

  // Upsert Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { name },
    create: { slug, name },
  });
  console.log(`[seed-tenant] Tenant id=${tenant.id} ensured.`);

  // Ensure TenantSettings
  const settings = await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: { brandName: name },
    create: {
      tenantId: tenant.id,
      slug: slug,
      brandName: name,
      introHtml: null,
      website: null,
      phone: null,
      links: {},
      questionnaire: {},
      logoUrl: null,
      inbox: {},
      quoteDefaults: {},
      taskPlaybook: {},
      questionnaireEmailSubject: null,
      questionnaireEmailBody: null,
      beta: {},
      isFireDoorManufacturer: false,
      galleryImageUrls: [],
      heroImageUrl: null,
      primaryColor: null,
      reviewCount: null,
      reviewScore: null,
      reviewSourceLabel: null,
      secondaryColor: null,
      serviceArea: null,
      testimonials: {},
    },
  });
  console.log(`[seed-tenant] TenantSettings ensured for tenant ${tenant.id}.`);

  // Create default questionnaire if not exists
  let questionnaire = await prisma.questionnaire.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!questionnaire) {
    questionnaire = await prisma.questionnaire.create({
      data: { tenantId: tenant.id, name: 'Default', description: 'Auto-created default questionnaire' }
    });
    console.log(`[seed-tenant] Created default questionnaire ${questionnaire.id}`);
  }

  // Insert standard fields (skip if key exists)
  const existingKeys = new Set(
    (await prisma.questionnaireField.findMany({ where: { tenantId: tenant.id }, select: { key: true } }))
      .map(r => r.key)
  );
  let created = 0;
  for (const f of STANDARD_FIELDS) {
    if (existingKeys.has(f.key)) continue;
    await prisma.questionnaireField.create({
      data: {
        tenantId: tenant.id,
        questionnaireId: questionnaire.id,
        key: f.key,
        label: f.label,
        type: f.type, // use enum uppercase values directly
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
    created++;
  }
  console.log(`[seed-tenant] Added ${created} standard questionnaire fields.`);

  console.log(`[seed-tenant] Complete.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
