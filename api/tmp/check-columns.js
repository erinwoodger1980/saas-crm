const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ComponentLookup'
        AND column_name IN (
          'positionXFormula','positionYFormula','positionZFormula',
          'widthFormula','heightFormula','depthFormula',
          'bodyProfileId','startEndProfileId','endEndProfileId'
        )
      ORDER BY column_name;
    `);
    console.log('Columns:', cols.rows);

    const idx = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'ComponentLookup'
        AND indexname = 'ComponentLookup_bodyProfileId_idx';
    `);
    console.log('Index:', idx.rows);

    const fks = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'ComponentLookup_bodyProfileId_fkey',
        'ComponentLookup_startEndProfileId_fkey',
        'ComponentLookup_endEndProfileId_fkey'
      );
    `);
    console.log('FKs:', fks.rows);
  } finally {
    await client.end();
  }
})();
