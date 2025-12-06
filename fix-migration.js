const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require'
});

async function fixMigration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const result = await client.query(
      "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20251205163731_add_performed_by_name' RETURNING *"
    );
    
    console.log(`Deleted ${result.rowCount} failed migration record(s)`);
    if (result.rows.length > 0) {
      console.log('Deleted:', result.rows[0]);
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

fixMigration();
