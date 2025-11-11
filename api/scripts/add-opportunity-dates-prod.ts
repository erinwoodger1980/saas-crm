import { PrismaClient } from '@prisma/client';

const prodDatabaseUrl = 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDatabaseUrl
    }
  }
});

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
