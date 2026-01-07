import { prisma } from './src/prisma';

async function checkConnection() {
  try {
    // Show connection info
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
    // List all tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
      LIMIT 20;
    `;
    
    console.log('\nFirst 20 tables in database:', tables);
    
    // Check for Opportunity with different casing
    const oppTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND LOWER(table_name) LIKE '%opportunity%';
    `;
    
    console.log('\nTables with "opportunity" in name:', oppTables);
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkConnection();
