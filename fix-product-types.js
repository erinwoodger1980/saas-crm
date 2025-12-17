const { PrismaClient } = require('./api/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function fixProductTypes() {
  try {
    console.log('Checking for NULL productTypes...');
    
    // Update NULL to empty array
    const result = await prisma.$executeRaw`
      UPDATE "ComponentLookup" 
      SET "productTypes" = ARRAY[]::TEXT[] 
      WHERE "productTypes" IS NULL
    `;
    
    console.log(`Updated ${result} rows`);
    
    // Verify
    const components = await prisma.componentLookup.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        productTypes: true
      }
    });
    
    console.log(`\nTotal components: ${components.length}`);
    const withNull = components.filter(c => c.productTypes === null);
    console.log(`Components with NULL productTypes: ${withNull.length}`);
    
    if (withNull.length > 0) {
      console.log('Components with NULL:', withNull);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProductTypes();
