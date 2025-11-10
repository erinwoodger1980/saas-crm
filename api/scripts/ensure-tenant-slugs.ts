/**
 * Ensure all tenants have slugs
 * Auto-generates slugs from tenant names for any tenant with null slug
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensureTenantSlugs() {
  console.log('🔍 Finding tenants without slugs...');
  
  const tenantsWithoutSlugs = await prisma.tenant.findMany({
    where: {
      OR: [
        { slug: null },
        { slug: '' }
      ]
    },
    select: {
      id: true,
      name: true,
      slug: true
    }
  });

  console.log(`Found ${tenantsWithoutSlugs.length} tenant(s) without slugs`);

  if (tenantsWithoutSlugs.length === 0) {
    console.log('✅ All tenants already have slugs');
    return;
  }

  for (const tenant of tenantsWithoutSlugs) {
    let baseSlug = toSlug(tenant.name);
    if (!baseSlug) {
      baseSlug = `tenant-${tenant.id.slice(0, 8)}`;
    }

    // Ensure uniqueness
    let slug = baseSlug;
    let suffix = 1;
    
    while (true) {
      const existing = await prisma.tenant.findUnique({
        where: { slug }
      });
      
      if (!existing || existing.id === tenant.id) {
        break;
      }
      
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    console.log(`  Setting slug for "${tenant.name}": ${slug}`);
    
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { slug }
    });
  }

  console.log('✅ All tenants now have slugs');
}

ensureTenantSlugs()
  .catch((error) => {
    console.error('Error ensuring tenant slugs:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
