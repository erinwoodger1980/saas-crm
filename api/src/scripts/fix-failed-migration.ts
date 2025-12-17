import { Pool } from 'pg';

async function fixFailedMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    try {
      // Check current migration state
      const checkResult = await client.query(`
        SELECT migration_name, started_at, finished_at, logs
        FROM _prisma_migrations
        WHERE migration_name = '20251217000000_add_fire_door_schedule_column_config'
      `);
      
      console.log('Current migration state:', checkResult.rows);
      
      if (checkResult.rows.length > 0 && !checkResult.rows[0].finished_at) {
        console.log('\nMarking failed migration as rolled back...');
        
        // Mark as rolled back so new migrations can proceed
        await client.query(`
          UPDATE _prisma_migrations
          SET rolled_back_at = NOW(),
              finished_at = NOW()
          WHERE migration_name = '20251217000000_add_fire_door_schedule_column_config'
          AND finished_at IS NULL
        `);
        
        console.log('✅ Migration marked as rolled back');
      } else {
        console.log('Migration is already finished or does not exist');
      }
      
      // Check if column exists
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'TenantSettings' 
        AND column_name = 'fireDoorScheduleColumnConfig'
      `);
      
      console.log('\nColumn exists in database:', columnCheck.rows.length > 0);
      
      // Check final migration state
      const finalResult = await client.query(`
        SELECT migration_name, started_at, finished_at, rolled_back_at
        FROM _prisma_migrations
        WHERE migration_name = '20251217000000_add_fire_door_schedule_column_config'
      `);
      
      console.log('\nFinal migration state:', finalResult.rows);
      console.log('\n✅ Database is ready for new migrations');
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  fixFailedMigration().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
}

export { fixFailedMigration };
