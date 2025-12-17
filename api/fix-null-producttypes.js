process.env.DATABASE_URL = "postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking for components with NULL productTypes...');
  
  const componentsWithNull = await prisma.$queryRaw`
    SELECT id, code, "productTypes" 
    FROM "ComponentLookup" 
    WHERE "productTypes" IS NULL
    LIMIT 10
  `;
  
  console.log('Found components with NULL productTypes:', componentsWithNull.length);
  console.log(componentsWithNull);
  
  if (componentsWithNull.length > 0) {
    console.log('\nUpdating NULL productTypes to empty array...');
    const result = await prisma.$executeRaw`
      UPDATE "ComponentLookup" 
      SET "productTypes" = ARRAY[]::TEXT[] 
      WHERE "productTypes" IS NULL
    `;
    console.log(`Updated ${result} components`);
  }
  
  console.log('\nVerifying all components now have arrays...');
  const allComponents = await prisma.$queryRaw`
    SELECT id, code, "productTypes" 
    FROM "ComponentLookup" 
    LIMIT 5
  `;
  console.log('Sample components:', allComponents);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
