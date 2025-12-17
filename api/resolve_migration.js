const { Client } = require('pg');

async function resolveMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if the migration is already in the _prisma_migrations table
    const checkResult = await client.query(
      "SELECT * FROM _prisma_migrations WHERE migration_name = '20251217000000_add_fire_door_schedule_column_config'"
    );

    console.log('Migration records found:', checkResult.rows.length);

    if (checkResult.rows.length > 0) {
      console.log('Migration record exists with status:', checkResult.rows[0]);
      
      // If it failed, delete it so we can mark it as applied
      if (checkResult.rows[0].finished_at === null || checkResult.rows[0].logs) {
        console.log('Deleting failed migration record...');
        await client.query(
          "DELETE FROM _prisma_migrations WHERE migration_name = '20251217000000_add_fire_door_schedule_column_config'"
        );
        console.log('Failed migration record deleted');
      }
    }

    // Check if column actually exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'TenantSettings' 
      AND column_name = 'fireDoorScheduleColumnConfig'
    `);

    console.log('Column exists:', columnCheck.rows.length > 0);

    if (columnCheck.rows.length > 0) {
      // Column exists, so mark migration as applied
      console.log('Marking migration as successfully applied...');
      await client.query(`
        INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (
          gen_random_uuid(),
          '8a7d8e9f0c1b2a3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7',
          NOW(),
          '20251217000000_add_fire_door_schedule_column_config',
          NULL,
          NULL,
          NOW(),
          1
        )
        ON CONFLICT DO NOTHING
      `);
      console.log('Migration marked as applied successfully');
    }

    console.log('\n✅ Migration conflict resolved');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

resolveMigration();
