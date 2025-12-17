import { prisma } from './src/prisma';

async function verifyComponentSystem() {
  try {
    console.log('🔍 Verifying Component System tables...\n');

    // Check ComponentLookup
    const componentCount = await prisma.componentLookup.count();
    console.log(`✅ ComponentLookup table exists (${componentCount} records)`);

    // Check ProductTypeComponent
    const productTypeCount = await prisma.productTypeComponent.count();
    console.log(`✅ ProductTypeComponent table exists (${productTypeCount} records)`);

    // Check ComponentProfile
    const profileCount = await prisma.componentProfile.count();
    console.log(`✅ ComponentProfile table exists (${profileCount} records)`);

    // Check Project
    const projectCount = await prisma.project.count();
    console.log(`✅ Project table exists (${projectCount} records)`);

    // Check BOMLineItem
    const bomCount = await prisma.bOMLineItem.count();
    console.log(`✅ BOMLineItem table exists (${bomCount} records)`);

    // Check Supplier updates
    const supplierWithComponents = await prisma.supplier.findMany({
      where: {
        OR: [
          { leadTimeDays: { not: null } },
          { preferredForTypes: { isEmpty: false } }
        ]
      },
      take: 1
    });
    console.log(`✅ Supplier table updated with component fields`);

    console.log('\n🎉 Component System migration verified successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Migrate existing LippingLookup data to ComponentLookup');
    console.log('2. Define ProductTypeComponent mappings for fire doors');
    console.log('3. Populate component catalog with hinges, locks, seals, etc.');
    console.log('4. Build component management UI');

  } catch (error) {
    console.error('❌ Error verifying component system:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyComponentSystem();
