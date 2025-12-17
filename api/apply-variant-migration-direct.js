const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📄 Reading migration SQL...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'prisma/migrations/20251217150000_add_component_variants_and_attributes/migration.sql'),
      'utf8'
    );

    console.log('🔄 Applying component variants migration...\n');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ComponentAttribute', 'ComponentVariant', 'BOMVariantLineItem')
      ORDER BY table_name;
    `);

    console.log('📊 Created tables:');
    result.rows.forEach(row => console.log(`  ✅ ${row.table_name}`));
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

applyMigration();
