import { prisma } from '../prisma'

async function main() {
  const slug = 'tenant-cmgt7e'
  const tenantName = 'Tenant cmgt7e'

  console.log(`🔍 Ensuring tenant + settings for slug: ${slug}`)

  // 1. Ensure Tenant exists
  let tenant = await prisma.tenant.findFirst({ where: { slug } })
  if (!tenant) {
    console.log('➡️  Tenant not found. Creating...')
    tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug,
        // Add any initial keyword/serviceAreas arrays if desired
        keywords: [],
        serviceAreas: [],
      },
    })
    console.log(`✅ Tenant created id=${tenant.id}`)
  } else {
    console.log(`✅ Tenant already exists id=${tenant.id}`)
  }

  // 2. Ensure TenantSettings exists (handle orphan slug case)
  let settings = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } })
  if (!settings) {
    // Check if a row already uses this slug (maybe orphaned)
    const existingBySlug = await prisma.tenantSettings.findUnique({ where: { slug } })
    if (existingBySlug) {
      console.log('⚠️  Found existing TenantSettings with this slug but different tenantId. Checking if tenant exists...')
      const linkedTenant = await prisma.tenant.findUnique({ where: { id: existingBySlug.tenantId } })
      if (!linkedTenant) {
        console.log('🧹 Orphan TenantSettings detected. Deleting orphan row so we can recreate.')
        await prisma.tenantSettings.delete({ where: { tenantId: existingBySlug.tenantId } })
      } else {
        console.log('✅ Settings already linked to existing tenant. Using that tenant instead of newly created one.')
        tenant = linkedTenant
      }
    }
  }

  // Refresh settings after possible cleanup / tenant reassignment
  settings = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } })
  if (!settings) {
    console.log('➡️  Creating TenantSettings row...')
    settings = await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        slug,
        brandName: tenantName,
        introHtml: '<p>Welcome</p>',
        questionnaire: {},
        links: {},
        inbox: {},
        logoUrl: null,
        primaryColor: '#0d9488',
        secondaryColor: '#f0fdfa',
        galleryImageUrls: [],
        testimonials: [],
        reviewScore: null,
        reviewCount: null,
        reviewSourceLabel: null,
        serviceArea: 'UK',
        taskPlaybook: '{}',
        beta: '{}',
        isFireDoorManufacturer: false,
      },
    })
    console.log('✅ TenantSettings created')
  } else {
    console.log('✅ TenantSettings already exists for tenant')
  }

  console.log('\nSummary:')
  console.log({ tenantId: tenant.id, slug, hasSettings: !!settings })
}

main()
  .catch((err) => {
    console.error('❌ Seed failed', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
