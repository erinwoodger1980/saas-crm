const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'api', '.env.local') });

// Use the API's generated Prisma client
const { PrismaClient } = require('./api/node_modules/.prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function fixProductTypes() {
  try {
    console.log('Connecting to production database...');
    console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
    // Find all components with NULL productTypes
    const componentsWithNull = await prisma.$queryRaw`
      SELECT id, code, name, "productTypes" 
      FROM "ComponentLookup" 
      WHERE "productTypes" IS NULL
    `;
    
    console.log(`Found ${componentsWithNull.length} components with NULL productTypes`);
    
    if (componentsWithNull.length > 0) {
      console.log('Fixing NULL productTypes...');
      
      // Update all NULL productTypes to empty array
      const result = await prisma.$executeRaw`
        UPDATE "ComponentLookup" 
        SET "productTypes" = ARRAY[]::TEXT[] 
        WHERE "productTypes" IS NULL
      `;
      
      console.log(`✅ Updated ${result} components`);
    } else {
      console.log('✅ No components with NULL productTypes found');
    }
    
    // Set the default for the column
    await prisma.$executeRaw`
      ALTER TABLE "ComponentLookup" 
      ALTER COLUMN "productTypes" SET DEFAULT ARRAY[]::TEXT[]
    `;
    
    console.log('✅ Set default value for productTypes column');
    
    // Verify the fix
    const allComponents = await prisma.componentLookup.findMany({
      select: {
        id: true,
        code: true,
        productTypes: true
      }
    });
    
    console.log('\nVerification:');
    console.log(`Total components: ${allComponents.length}`);
    const withNull = allComponents.filter(c => c.productTypes === null);
    const withEmpty = allComponents.filter(c => Array.isArray(c.productTypes) && c.productTypes.length === 0);
    const withValues = allComponents.filter(c => Array.isArray(c.productTypes) && c.productTypes.length > 0);
    
    console.log(`- With NULL: ${withNull.length}`);
    console.log(`- With empty array: ${withEmpty.length}`);
    console.log(`- With values: ${withValues.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProductTypes();
