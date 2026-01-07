const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    const sql = fs.readFileSync(path.join(__dirname, 'prisma', 'migrations', 'add_client_portal_fields.sql'), 'utf8');
    await client.query(sql);
    
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
