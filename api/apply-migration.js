#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('✓ Connected to database');
    console.log('Database:', client.database);
    
    const sql = fs.readFileSync(path.join(__dirname, 'prisma/migrations/add_monthly_gp_models.sql'), 'utf8');
    
    console.log('\n📝 Executing migration SQL...\n');
    
    await client.query(sql);
    
    console.log('\n✅ Migration applied successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration();
