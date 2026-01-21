import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// Import the function from tenants.ts
async function buildQuestionnaireFromLeadFieldDefs(tenantId: string): Promise<any[]> {
  const rows = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  const mapped = rows.map((row: any) => {
    let qType: any = "text";
    if (row.type === "select" || row.type === "multiselect") qType = "select";
    else if (row.type === "date") qType = "date";
    else if (row.type === "number" || row.type === "currency") qType = "number";
    else if (row.type === "textarea") qType = "textarea";
    else if (row.type === "file") qType = "file";
    else if (row.type === "checkbox") qType = "checkbox";

    const config = row.config || {};
    const options = Array.isArray(config.options) ? config.options : [];

    const field: any = {
      id: row.id,
      key: row.key,
      label: row.label,
      type: qType,
      required: row.required ?? false,
      options,
      askInQuestionnaire: true,
      showOnLead: true,
      internalOnly: false,
      visibleAfterOrder: false,
      group: null,
      sortOrder: row.sortOrder ?? 0,
    };
    return field;
  });

  return mapped;
}

async function main() {
  const tenantSlug = process.argv[2] || 'wealden-joinery';
  
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug }
  });

  if (!tenant) {
    console.error(`❌ Tenant not found: ${tenantSlug}`);
    process.exit(1);
  }

  console.log(`Syncing questionnaire for tenant: ${tenant.name} (${tenant.id})`);

  // Build questionnaire from LeadFieldDefs
  const questionnaire = await buildQuestionnaireFromLeadFieldDefs(tenant.id);
  
  console.log(`Found ${questionnaire.length} fields in LeadFieldDef`);

  // Update TenantSettings
  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {
      questionnaire: questionnaire as any,
    },
    create: {
      tenantId: tenant.id,
      slug: `tenant-${tenant.id.slice(0, 6).toLowerCase()}`,
      brandName: tenant.name,
      introHtml: "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
      questionnaire: questionnaire as any,
    },
  });

  console.log(`✅ Successfully synced questionnaire to TenantSettings`);
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
