import 'dotenv/config';
import { prisma } from './src/prisma';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('Loaded .env.local');
}

async function applyMigration() {
  try {
    const sqlPath = path.join(__dirname, 'prisma/migrations/add_monthly_gp_models.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Applying migration to production database...');
    console.log('SQL:', sql);
    
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\nExecuting:', statement.substring(0, 80) + '...');
        await prisma.$executeRawUnsafe(statement);
        console.log('✓ Success');
      }
    }
    
    console.log('\n✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
