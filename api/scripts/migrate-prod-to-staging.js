const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const PROD_DB = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
const STAGING_DB = process.env.STAGING_DATABASE_URL;

if (!PROD_DB) {
  throw new Error(
    'Missing PROD_DATABASE_URL (or DATABASE_URL). Refusing to run without an explicit production DB URL.',
  );
}

if (!STAGING_DB) {
  throw new Error('Missing STAGING_DATABASE_URL. Refusing to run without an explicit staging DB URL.');
}

async function migrate() {
  try {
    console.log('🔄 Exporting production database...');
    const { stdout } = await execAsync(
      `pg_dump "${PROD_DB}" --clean --if-exists --no-owner --no-privileges`,
      { maxBuffer: 50 * 1024 * 1024 }
    );
    
    console.log('📝 Importing to staging database...');
    await execAsync(`psql "${STAGING_DB}"`, {
      input: stdout,
      maxBuffer: 50 * 1024 * 1024
    });
    
    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrate();
