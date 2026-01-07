import { prisma } from './src/prisma';

async function checkSchema() {
  try {
    // Query to list all tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%pportunit%'
      ORDER BY table_name;
    `;
    
    console.log('Tables matching Opportunity:', tables);
    
    // Check if we can query Opportunity
    const oppCheck = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'Opportunity'
      LIMIT 5;
    `;
    
    console.log('\nOpportunity columns:', oppCheck);
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
