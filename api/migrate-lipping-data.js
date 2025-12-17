const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrateLippingData() {
  try {
    console.log('🔄 Migrating LippingLookup data to ComponentLookup...\n');
    
    // First, check how many lipping records we have
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM "LippingLookup" WHERE "isActive" = true
    `);
    
    console.log(`Found ${countResult.rows[0].count} active lipping records to migrate\n`);
    
    // Migrate the data
    const result = await pool.query(`
      INSERT INTO "ComponentLookup" (
        "id",
        "tenantId",
        "productTypes",
        "componentType",
        "code",
        "name",
        "description",
        "unitOfMeasure",
        "basePrice",
        "leadTimeDays",
        "supplierId",
        "isActive",
        "metadata",
        "createdAt",
        "updatedAt"
      )
      SELECT 
        gen_random_uuid() as id,
        "tenantId",
        ARRAY['FIRE_DOOR', 'FIRE_DOOR_SET']::TEXT[] as "productTypes",
        'LIPPING' as "componentType",
        'LIP-' || REPLACE("doorsetType", ' ', '-') as code,
        "doorsetType" || ' Lipping' as name,
        "commentsForNotes" as description,
        'MM' as "unitOfMeasure",
        0 as "basePrice",
        0 as "leadTimeDays",
        NULL as "supplierId",
        "isActive",
        jsonb_build_object(
          'doorsetType', "doorsetType",
          'topMm', "topMm",
          'bottomMm', "bottomMm",
          'hingeMm', "hingeMm",
          'lockMm', "lockMm",
          'safeHingeMm', "safeHingeMm",
          'daExposedMm', "daExposedMm",
          'trimMm', "trimMm",
          'postformedMm', "postformedMm",
          'extrasMm', "extrasMm"
        ) as metadata,
        "createdAt",
        "updatedAt"
      FROM "LippingLookup"
      WHERE "isActive" = true
      ON CONFLICT ("tenantId", "code") DO NOTHING
      RETURNING "code", "name", "tenantId"
    `);
    
    console.log(`✅ Migrated ${result.rows.length} lipping records\n`);
    
    if (result.rows.length > 0) {
      console.log('Sample migrated records:');
      result.rows.slice(0, 5).forEach(row => {
        console.log(`  • ${row.code}: ${row.name}`);
      });
      if (result.rows.length > 5) {
        console.log(`  ... and ${result.rows.length - 5} more`);
      }
    }
    
    // Verify the migration
    const verifyResult = await pool.query(`
      SELECT 
        "componentType",
        COUNT(*) as count,
        array_agg(DISTINCT "tenantId") as tenants
      FROM "ComponentLookup"
      WHERE "componentType" = 'LIPPING'
      GROUP BY "componentType"
    `);
    
    console.log('\n📊 Migration Summary:');
    if (verifyResult.rows.length > 0) {
      const row = verifyResult.rows[0];
      console.log(`  Component Type: ${row.componenttype}`);
      console.log(`  Total Records: ${row.count}`);
      console.log(`  Tenants: ${row.tenants.length}`);
    }
    
    console.log('\n🎉 Lipping data migration complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Define ProductTypeComponent mappings for fire doors');
    console.log('2. Add other component types (hinges, locks, seals, etc.)');
    console.log('3. Build component management UI');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('duplicate key')) {
      console.log('\n💡 Some records already exist - this is normal if you ran this before');
    }
  } finally {
    await pool.end();
  }
}

migrateLippingData();
