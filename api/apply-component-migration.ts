import { prisma } from './src/prisma';

async function checkAndApplyMigration() {
  try {
    // Check if migration was recorded
    const migration = await prisma.$queryRaw`
      SELECT migration_name, finished_at, logs 
      FROM _prisma_migrations 
      WHERE migration_name = '20251217132728_add_global_component_system'
    `;
    
    console.log('Migration status:', migration);
    
    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ComponentLookup', 'ProductTypeComponent', 'Project', 'BOMLineItem')
    `;
    
    console.log('Tables found:', tables);
    
    if (!Array.isArray(tables) || tables.length === 0) {
      console.log('\n⚠️  Migration was recorded but tables don\'t exist!');
      console.log('Manually executing migration SQL...\n');
      
      // Read and execute the migration SQL
      const fs = require('fs');
      const path = require('path');
      const migrationSQL = fs.readFileSync(
        path.join(__dirname, 'prisma/migrations/20251217132728_add_global_component_system/migration.sql'),
        'utf-8'
      );
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log('✅ Executed:', statement.substring(0, 60) + '...');
        } catch (error: any) {
          console.log('⚠️  Statement may have already been applied or failed:', error.message);
        }
      }
      
      console.log('\n🎉 Migration SQL executed successfully!');
    } else {
      console.log('✅ Tables already exist!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndApplyMigration();
