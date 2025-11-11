import { PrismaClient } from '@prisma/client';

const prodDatabaseUrl = 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDatabaseUrl
    }
  }
});

// Import the seed template function (adjust path as needed)
async function initializeTenantWithSeedData(tenantId: string) {
  const TEMPLATE_SLUG = 'demo-tenant';
  
  try {
    console.log(`🌱 Initializing tenant ${tenantId} with Demo Tenant seed data...`);

    const templateTenant = await prisma.tenant.findUnique({
      where: { slug: TEMPLATE_SLUG },
      include: {
        leadFieldDefs: true,
        tasks: true,
        automationRules: true
      }
    });

    if (!templateTenant) {
      console.warn(`⚠️  Demo Tenant template not found.`);
      return { success: false, message: 'Template tenant not found' };
    }

    let copiedItems = 0;

    // Copy questionnaire fields
    if (templateTenant.leadFieldDefs && templateTenant.leadFieldDefs.length > 0) {
      for (const field of templateTenant.leadFieldDefs) {
        await prisma.leadFieldDef.create({
          data: {
            tenantId,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            config: field.config as any,
            sortOrder: field.sortOrder
          }
        });
        copiedItems++;
      }
      console.log(`✅ Copied ${templateTenant.leadFieldDefs.length} questionnaire fields`);
    }

    return {
      success: true,
      questionnaireFields: templateTenant.leadFieldDefs?.length || 0,
      totalItems: copiedItems
    };

  } catch (error) {
    console.error(`❌ Failed to initialize tenant ${tenantId}:`, error);
    throw error;
  }
}

async function main() {
  console.log('Testing seed template initialization...\n');

  // Find a test tenant to initialize (pick one of the empty ones)
  const testTenant = await prisma.tenant.findUnique({
    where: { slug: 'test-company-1' },
    include: {
      _count: {
        select: { leadFieldDefs: true }
      }
    }
  });

  if (!testTenant) {
    console.log('Test tenant not found');
    return;
  }

  console.log(`Found test tenant: ${testTenant.slug} with ${testTenant._count.leadFieldDefs} fields\n`);

  if (testTenant._count.leadFieldDefs > 0) {
    console.log('⚠️  This tenant already has questionnaire fields. Please pick an empty tenant.');
    return;
  }

  // Run the initialization
  const result = await initializeTenantWithSeedData(testTenant.id);
  
  console.log('\n=== Result ===');
  console.log(JSON.stringify(result, null, 2));

  // Verify the fields were copied
  const copiedFields = await prisma.leadFieldDef.findMany({
    where: { tenantId: testTenant.id },
    orderBy: { sortOrder: 'asc' }
  });

  console.log(`\n=== Verification: ${copiedFields.length} fields now in ${testTenant.slug} ===`);
  copiedFields.forEach(f => {
    console.log(`  [${f.sortOrder}] ${f.key}: ${f.label} (${f.type})`);
  });

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
