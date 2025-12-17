const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default lipping lookup data from CSV
const defaultLippingData = [
  {
    doorsetType: 'STANDARD CONCEALED',
    topMm: 8,
    bottomMm: 8,
    hingeMm: 8,
    lockMm: 8,
    safeHingeMm: 0,
    daExposedMm: 0,
    trimMm: 2,
    postformedMm: null,
    extrasMm: null,
    commentsForNotes: null,
    sortOrder: 1
  },
  {
    doorsetType: 'STANDARD EXPOSED',
    topMm: 8,
    bottomMm: 8,
    hingeMm: 8,
    lockMm: 8,
    safeHingeMm: 0,
    daExposedMm: 0,
    trimMm: 2,
    postformedMm: null,
    extrasMm: 5,
    commentsForNotes: 'FACINGS TO BE APPLIED AND CORE 2ND TRIMMED BEFORE LIPPING',
    sortOrder: 2
  },
  {
    doorsetType: 'D/A 44',
    topMm: 8,
    bottomMm: 8,
    hingeMm: 8,
    lockMm: 8,
    safeHingeMm: 0,
    daExposedMm: 8,
    trimMm: 2,
    postformedMm: null,
    extrasMm: null,
    commentsForNotes: '1no 8mm CONCEALED LIPPING TO HINGE SIDE + 1no 8mm EXPOSED',
    sortOrder: 3
  },
  {
    doorsetType: 'D/A 54',
    topMm: 6,
    bottomMm: 8,
    hingeMm: 8,
    lockMm: 8,
    safeHingeMm: 0,
    daExposedMm: 12,
    trimMm: 2,
    postformedMm: null,
    extrasMm: null,
    commentsForNotes: '1no 6mm CONCEALED LIPPING TO HINGE SIDE + 1no 12mm EXPOSED',
    sortOrder: 4
  },
  {
    doorsetType: 'SAFEHINGE 44',
    topMm: 7,
    bottomMm: 7,
    hingeMm: 8,
    lockMm: 8,
    safeHingeMm: 8,
    daExposedMm: 0,
    trimMm: 2,
    postformedMm: null,
    extrasMm: null,
    commentsForNotes: 'T-SECTION LIPPINGS REQUIRED TOP AND BOTTOM',
    sortOrder: 5
  },
  {
    doorsetType: 'SAFEHINGE 54',
    topMm: 7,
    bottomMm: 7,
    hingeMm: 0,
    lockMm: 8,
    safeHingeMm: 11,
    daExposedMm: 0,
    trimMm: 2,
    postformedMm: null,
    extrasMm: null,
    commentsForNotes: 'T-SECTION LIPPINGS REQUIRED TOP AND BOTTOM & NO LIPPING ON HINGE SIDE',
    sortOrder: 6
  },
  {
    doorsetType: 'POSTFORMED 44',
    topMm: 8,
    bottomMm: 8,
    hingeMm: 8,
    lockMm: 8,
    safeHingeMm: 0,
    daExposedMm: 0,
    trimMm: 2,
    postformedMm: 4,
    extrasMm: null,
    commentsForNotes: null,
    sortOrder: 7
  }
];

async function seedLippingLookup() {
  try {
    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true }
    });

    console.log(`Found ${tenants.length} tenants`);

    for (const tenant of tenants) {
      console.log(`\nSeeding lipping lookup for tenant: ${tenant.name} (${tenant.id})`);

      for (const lipping of defaultLippingData) {
        const existing = await prisma.lippingLookup.findUnique({
          where: {
            tenantId_doorsetType: {
              tenantId: tenant.id,
              doorsetType: lipping.doorsetType
            }
          }
        });

        if (!existing) {
          await prisma.lippingLookup.create({
            data: {
              tenantId: tenant.id,
              ...lipping
            }
          });
          console.log(`  ✓ Created: ${lipping.doorsetType}`);
        } else {
          console.log(`  - Skipped (exists): ${lipping.doorsetType}`);
        }
      }
    }

    console.log('\n✅ Lipping lookup seeding completed successfully');
  } catch (error) {
    console.error('Error seeding lipping lookup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  seedLippingLookup();
}

module.exports = { seedLippingLookup, defaultLippingData };
