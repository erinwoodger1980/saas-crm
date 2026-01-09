/**
 * Populate columns field for existing lookup tables
 * Extracts column names from the first row's data field
 * 
 * Usage:
 *   cd api && pnpm populate-columns (uses local DATABASE_URL)
 *   DATABASE_URL=postgres://... pnpm populate-columns (uses specific database)
 */

import { prisma } from '../src/prisma';

async function populateLookupTableColumns() {
  try {
    console.log('🔍 Finding lookup tables without columns...');
    
    // Get all lookup tables
    const tables = await prisma.lookupTable.findMany({
      include: {
        rows: {
          take: 1, // Just need first row to get column names
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    console.log(`📊 Found ${tables.length} total lookup tables`);

    let updated = 0;
    let skipped = 0;

    for (const table of tables) {
      // Skip if already has columns
      if (table.columns && table.columns.length > 0) {
        console.log(`⏭️  Skipping ${table.tableName} - already has ${table.columns.length} columns`);
        skipped++;
        continue;
      }

      // Skip if no rows
      if (!table.rows || table.rows.length === 0) {
        console.log(`⚠️  Skipping ${table.tableName} - no rows to infer columns from`);
        skipped++;
        continue;
      }

      // Extract column names from first row's data field
      const firstRow = table.rows[0];
      const data = firstRow.data as Record<string, any> || {};
      const columnNames = Object.keys(data);

      if (columnNames.length === 0) {
        console.log(`⚠️  Skipping ${table.tableName} - first row has no data fields`);
        skipped++;
        continue;
      }

      // Update the table with inferred columns
      await prisma.lookupTable.update({
        where: { id: table.id },
        data: { columns: columnNames }
      });

      console.log(`✅ Updated ${table.tableName}: added ${columnNames.length} columns [${columnNames.join(', ')}]`);
      updated++;
    }

    console.log('\n📈 Summary:');
    console.log(`   - Total tables: ${tables.length}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log('✨ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

populateLookupTableColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
