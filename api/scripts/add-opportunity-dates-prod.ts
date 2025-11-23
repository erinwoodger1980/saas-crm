import { PrismaClient } from '@prisma/client';

// NOTE: Removed explicit datasources override (not compatible with current Prisma client type)
// If you need to target a different DB, set DATABASE_URL before running this script.
const prisma = new PrismaClient();

async function main() {
  console.log('Adding startDate and deliveryDate columns to Opportunity table...');
  
  try {
    // Check if columns already exist
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Opportunity' 
      AND column_name IN ('startDate', 'deliveryDate')
    `);
    
    console.log('Existing date columns:', result);
    
    // Add columns if they don't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Opportunity" 
      ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "deliveryDate" TIMESTAMP(3)
    `);
    
    console.log('✅ Columns added successfully!');
    
    // Verify
    const verify = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Opportunity' 
      AND column_name IN ('startDate', 'deliveryDate')
    `);
    
    console.log('Verified columns:', verify);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
