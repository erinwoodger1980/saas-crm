const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Standard fire door components to add
const STANDARD_COMPONENTS = [
  // Hinges
  {
    componentType: 'HINGE',
    code: 'HNG-BT-SS',
    name: 'Butt Hinge - Stainless Steel',
    description: 'CE marked fire-rated butt hinge, stainless steel, 100mm x 75mm',
    unitOfMeasure: 'EA',
    basePrice: 8.50,
    leadTimeDays: 3
  },
  {
    componentType: 'HINGE',
    code: 'HNG-BT-PSS',
    name: 'Butt Hinge - Polished Stainless Steel',
    description: 'CE marked fire-rated butt hinge, polished stainless steel, 100mm x 75mm',
    unitOfMeasure: 'EA',
    basePrice: 12.00,
    leadTimeDays: 3
  },
  {
    componentType: 'HINGE',
    code: 'HNG-RISE-SS',
    name: 'Rising Butt Hinge - Stainless Steel',
    description: 'Rising butt hinge for fire doors, stainless steel',
    unitOfMeasure: 'EA',
    basePrice: 15.00,
    leadTimeDays: 5
  },
  
  // Locks
  {
    componentType: 'LOCK',
    code: 'LOCK-SL-SS',
    name: 'Sashlock - Stainless Steel',
    description: 'CE marked fire-rated sashlock, 76mm backset',
    unitOfMeasure: 'EA',
    basePrice: 35.00,
    leadTimeDays: 3
  },
  {
    componentType: 'LOCK',
    code: 'LOCK-PANIC',
    name: 'Panic Hardware',
    description: 'Fire exit panic push bar, CE marked',
    unitOfMeasure: 'EA',
    basePrice: 185.00,
    leadTimeDays: 7
  },
  {
    componentType: 'LOCK',
    code: 'LOCK-MAG',
    name: 'Magnetic Lock',
    description: 'Electromagnetic lock for fire doors, fail-safe',
    unitOfMeasure: 'EA',
    basePrice: 120.00,
    leadTimeDays: 5
  },
  
  // Intumescent Strips
  {
    componentType: 'INTUMESCENT_STRIP',
    code: 'INT-15MM',
    name: 'Intumescent Strip - 15mm',
    description: 'Fire-rated intumescent strip, 15mm x 4mm',
    unitOfMeasure: 'M',
    basePrice: 1.50,
    leadTimeDays: 1
  },
  {
    componentType: 'INTUMESCENT_STRIP',
    code: 'INT-20MM',
    name: 'Intumescent Strip - 20mm',
    description: 'Fire-rated intumescent strip, 20mm x 4mm',
    unitOfMeasure: 'M',
    basePrice: 1.80,
    leadTimeDays: 1
  },
  {
    componentType: 'INTUMESCENT_STRIP',
    code: 'INT-COMBO-15MM',
    name: 'Intumescent + Smoke Seal - 15mm',
    description: 'Combined intumescent and smoke seal strip, 15mm',
    unitOfMeasure: 'M',
    basePrice: 2.20,
    leadTimeDays: 1
  },
  
  // Smoke Seals
  {
    componentType: 'SMOKE_SEAL',
    code: 'SMOKE-15MM',
    name: 'Smoke Seal - 15mm',
    description: 'Acoustic smoke seal, 15mm',
    unitOfMeasure: 'M',
    basePrice: 1.20,
    leadTimeDays: 1
  },
  
  // Door Closers
  {
    componentType: 'DOOR_CLOSER',
    code: 'CLO-OH-STD',
    name: 'Overhead Door Closer - Standard',
    description: 'CE marked overhead door closer, adjustable, suitable for fire doors',
    unitOfMeasure: 'EA',
    basePrice: 45.00,
    leadTimeDays: 5
  },
  {
    componentType: 'DOOR_CLOSER',
    code: 'CLO-CON',
    name: 'Concealed Door Closer',
    description: 'Concealed overhead door closer for fire doors',
    unitOfMeasure: 'EA',
    basePrice: 85.00,
    leadTimeDays: 7
  },
  {
    componentType: 'DOOR_CLOSER',
    code: 'CLO-FLOOR',
    name: 'Floor Spring',
    description: 'Floor-mounted door closer/spring',
    unitOfMeasure: 'EA',
    basePrice: 120.00,
    leadTimeDays: 10
  },
  
  // Vision Panels
  {
    componentType: 'VISION_PANEL',
    code: 'VP-FD30-300X600',
    name: 'Vision Panel - FD30 300x600mm',
    description: 'Fire-rated glass vision panel, 30min rating, 300x600mm',
    unitOfMeasure: 'EA',
    basePrice: 65.00,
    leadTimeDays: 10
  },
  {
    componentType: 'VISION_PANEL',
    code: 'VP-FD60-300X600',
    name: 'Vision Panel - FD60 300x600mm',
    description: 'Fire-rated glass vision panel, 60min rating, 300x600mm',
    unitOfMeasure: 'EA',
    basePrice: 95.00,
    leadTimeDays: 14
  },
  
  // Glazing Beads
  {
    componentType: 'GLAZING_BEAD',
    code: 'GB-HARDWOOD',
    name: 'Glazing Bead - Hardwood',
    description: 'Hardwood glazing bead for vision panels',
    unitOfMeasure: 'M',
    basePrice: 3.50,
    leadTimeDays: 3
  },
  
  // Door Blanks
  {
    componentType: 'DOOR_BLANK',
    code: 'BLANK-FD30-44',
    name: 'Door Blank - FD30 44mm',
    description: 'Fire door blank, FD30 rating, 44mm thick',
    unitOfMeasure: 'EA',
    basePrice: 85.00,
    leadTimeDays: 5
  },
  {
    componentType: 'DOOR_BLANK',
    code: 'BLANK-FD60-54',
    name: 'Door Blank - FD60 54mm',
    description: 'Fire door blank, FD60 rating, 54mm thick',
    unitOfMeasure: 'EA',
    basePrice: 125.00,
    leadTimeDays: 5
  },
  
  // Frames
  {
    componentType: 'FRAME',
    code: 'FRAME-HARDWOOD-STD',
    name: 'Frame - Hardwood Standard',
    description: 'Hardwood fire door frame, standard profile',
    unitOfMeasure: 'SET',
    basePrice: 95.00,
    leadTimeDays: 7
  },
  {
    componentType: 'FRAME',
    code: 'FRAME-SOFTWOOD-STD',
    name: 'Frame - Softwood Standard',
    description: 'Softwood fire door frame, standard profile',
    unitOfMeasure: 'SET',
    basePrice: 65.00,
    leadTimeDays: 5
  }
];

async function addStandardComponents() {
  try {
    console.log('📦 Adding standard fire door components...\n');
    
    // Get all tenants
    const tenantsResult = await pool.query(`
      SELECT id, name FROM "Tenant" ORDER BY name
    `);
    
    console.log(`Adding components for ${tenantsResult.rows.length} tenants\n`);
    
    let totalInserted = 0;
    let skipped = 0;
    
    for (const tenant of tenantsResult.rows) {
      console.log(`📋 ${tenant.name}:`);
      
      for (const component of STANDARD_COMPONENTS) {
        try {
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
              "isActive",
              "createdAt",
              "updatedAt"
            ) VALUES (
              gen_random_uuid(),
              $1,
              ARRAY['FIRE_DOOR', 'FIRE_DOOR_SET']::TEXT[],
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              true,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
            ON CONFLICT ("tenantId", "code") DO NOTHING
            RETURNING "code"
          `, [
            tenant.id,
            component.componentType,
            component.code,
            component.name,
            component.description,
            component.unitOfMeasure,
            component.basePrice,
            component.leadTimeDays
          ]);
          
          if (result.rows.length > 0) {
            totalInserted++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`  ❌ Error adding ${component.code}: ${error.message}`);
        }
      }
      
      console.log(`  ✅ Added ${STANDARD_COMPONENTS.length} component types`);
    }
    
    console.log(`\n✅ Total new components: ${totalInserted}`);
    console.log(`⏭️  Skipped existing: ${skipped}\n`);
    
    // Show summary by component type
    const summaryResult = await pool.query(`
      SELECT 
        "componentType",
        COUNT(*) as count,
        array_agg("code" ORDER BY "code") as codes
      FROM "ComponentLookup"
      WHERE "tenantId" = $1 AND "componentType" != 'LIPPING'
      GROUP BY "componentType"
      ORDER BY "componentType"
    `, [tenantsResult.rows[0].id]);
    
    console.log(`📊 Component catalog for ${tenantsResult.rows[0].name}:\n`);
    summaryResult.rows.forEach(row => {
      console.log(`  ${row.componentType}: ${row.count} items`);
      console.log(`    ${row.codes.join(', ')}`);
    });
    
    console.log('\n\n🎉 Standard components added!');
    console.log('\n📋 What you can do now:');
    console.log('1. Build component management UI to view/edit these');
    console.log('2. Add more components via UI or CSV import');
    console.log('3. Link components to suppliers');
    console.log('4. Integrate with fire door schedule for BOM generation');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

addStandardComponents();
