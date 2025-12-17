const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  try {
    console.log('🔄 Executing component system migration...\n');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/20251217132728_add_global_component_system/migration.sql'),
      'utf-8'
    );
    
    // Split statements and execute one at a time, ignoring "already exists" errors
    const statements = migrationSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        await pool.query(statement);
        const preview = statement.substring(0, 60).replace(/\n/g, ' ');
        console.log(`✅ ${preview}...`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⏭️  Skipped (already exists): ${statement.substring(0, 40)}...`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ComponentLookup', 'ProductTypeComponent', 'ComponentProfile', 'Project', 'BOMLineItem')
      ORDER BY table_name
    `);
    
    console.log('Created tables:');
    result.rows.forEach(row => console.log(`  ✅ ${row.table_name}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
