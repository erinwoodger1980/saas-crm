const { PrismaClient } = require('@prisma/client');

async function applyMigration() {
  const prisma = new PrismaClient();
  try {
    console.log('🔄 Applying component variants migration...');
    
    const fs = require('fs');
    const path = require('path');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/20251217150000_add_component_variants_and_attributes/migration.sql'),
      'utf8'
    );

    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ComponentAttribute', 'ComponentVariant', 'BOMVariantLineItem')
      ORDER BY table_name;
    `;
    
    console.log('📊 Created tables:');
    tables.forEach(t => console.log(`  ✅ ${t.table_name}`));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
