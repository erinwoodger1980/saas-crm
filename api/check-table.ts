import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTable() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE '%tenant%'
    `);
    console.log("Tables matching 'tenant':");
    result.rows.forEach(row => console.log("  -", row.table_name));
  } finally {
    client.release();
    await pool.end();
  }
}

checkTable();
