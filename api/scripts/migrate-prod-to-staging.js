const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const PROD_DB = 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a/joineryai_db';
const STAGING_DB = 'postgresql://joineryai_db_staging_user:kXLKGlH9fWCTfEE9hvu3gdJsg8l9xHBu@dpg-d5gir4h5pdvs73cn3u8g-a/joineryai_db_staging';

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
