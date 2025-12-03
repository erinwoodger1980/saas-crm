import { prisma } from './api/src/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('📦 Reading migration file...\n');
    const migrationSql = fs.readFileSync(
      path.join(__dirname, 'api/prisma/migrations/20251203_add_client_table.sql'),
      'utf-8'
    );
    
    // Split the SQL file by statement (rough split on semicolons)
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`🚀 Running ${statements.length} migration statements...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      try {
        console.log(`  ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`);
        await prisma.$executeRawUnsafe(statement);
      } catch (error: any) {
        // Ignore "already exists" errors during idempotent migrations
        if (error.message?.includes('already exists')) {
          console.log(`    ⚠️  Skipped (already exists)`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!\n');
    
    // Verify the Client table was created
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "Client"
    `;
    console.log(`📊 Client table now has ${result[0].count} records\n`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
