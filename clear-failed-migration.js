const { Client } = require('pg');

async function clearFailedMigration() {
  const client = new Client({
    connectionString: 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require'
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Checking failed migration status...');
    const checkResult = await client.query(
      `SELECT migration_name, started_at, finished_at, applied_steps_count 
       FROM "_prisma_migrations" 
       WHERE migration_name = '20251202083545_add_number_description'`
    );
    
    if (checkResult.rows.length === 0) {
      console.log('✅ No failed migration found. Already cleared!');
    } else {
      console.log('Found migration:', checkResult.rows[0]);
      
      console.log('Deleting failed migration record...');
      const deleteResult = await client.query(
        `DELETE FROM "_prisma_migrations" 
         WHERE migration_name = '20251202083545_add_number_description'`
      );
      
      console.log(`✅ Successfully deleted ${deleteResult.rowCount} migration record(s)`);
    }
    
    console.log('\nVerifying current migration state...');
    const verifyResult = await client.query(
      `SELECT migration_name, finished_at 
       FROM "_prisma_migrations" 
       ORDER BY started_at DESC 
       LIMIT 5`
    );
    
    console.log('Last 5 migrations:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.migration_name} (${row.finished_at ? 'completed' : 'failed'})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Done! You can now trigger a new deployment in Render.');
  }
}

clearFailedMigration();
