const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function applyMigration() {
  try {
    console.log('🔄 Applying component process tracking migration...\n');
    
    const migrationPath = path.join(__dirname, 'prisma/migrations/20251217140000_add_component_process_tracking_ml_costing/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the entire migration as one transaction
    await pool.query(sql);
    
    console.log('Executing migration SQL...\n');
    
    console.log('\n✅ Migration completed successfully!');
    
    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ComponentProcess', 'ProcessTimingPrediction', 'ProcessCostRate')
      ORDER BY table_name
    `);
    
    console.log('\n📊 Created tables:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
