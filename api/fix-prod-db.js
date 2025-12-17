const { PrismaClient } = require('./.prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function fixProductTypes() {
  try {
    console.log('Connecting to production database...');
    
    const result = await prisma.$executeRaw`
      UPDATE "ComponentLookup" 
      SET "productTypes" = ARRAY[]::TEXT[] 
      WHERE "productTypes" IS NULL
    `;
    
    console.log(`✅ Updated ${result} components`);
    
    await prisma.$executeRaw`
      ALTER TABLE "ComponentLookup" 
      ALTER COLUMN "productTypes" SET DEFAULT ARRAY[]::TEXT[]
    `;
    
    console.log('✅ Set default value');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProductTypes();
