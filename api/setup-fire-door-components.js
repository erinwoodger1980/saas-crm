const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Define fire door component types with their display configuration
const FIRE_DOOR_COMPONENTS = [
  {
    componentType: 'LIPPING',
    displayName: 'Lipping',
    isRequired: true,
    sortOrder: 1,
    formulaEnabled: false,
    description: 'Edge lipping for fire door'
  },
  {
    componentType: 'INTUMESCENT_STRIP',
    displayName: 'Intumescent Strip',
    isRequired: true,
    sortOrder: 2,
    formulaEnabled: true,
    formulaExpression: 'perimeter * 2',
    description: 'Fire-rated intumescent strip'
  },
  {
    componentType: 'SMOKE_SEAL',
    displayName: 'Smoke Seal',
    isRequired: false,
    sortOrder: 3,
    formulaEnabled: true,
    formulaExpression: 'perimeter',
    description: 'Smoke seal strip'
  },
  {
    componentType: 'HINGE',
    displayName: 'Hinges',
    isRequired: true,
    sortOrder: 4,
    formulaEnabled: false,
    description: 'Fire-rated hinges (typically 3 per door)'
  },
  {
    componentType: 'LOCK',
    displayName: 'Lock',
    isRequired: true,
    sortOrder: 5,
    formulaEnabled: false,
    description: 'Fire-rated lock mechanism'
  },
  {
    componentType: 'DOOR_CLOSER',
    displayName: 'Door Closer',
    isRequired: true,
    sortOrder: 6,
    formulaEnabled: false,
    description: 'Self-closing mechanism for fire doors'
  },
  {
    componentType: 'VISION_PANEL',
    displayName: 'Vision Panel',
    isRequired: false,
    sortOrder: 7,
    formulaEnabled: false,
    description: 'Fire-rated glass vision panel'
  },
  {
    componentType: 'GLAZING_BEAD',
    displayName: 'Glazing Bead',
    isRequired: false,
    sortOrder: 8,
    formulaEnabled: true,
    formulaExpression: 'visionPanelPerimeter * 2',
    description: 'Beading for vision panel'
  },
  {
    componentType: 'DOOR_BLANK',
    displayName: 'Door Blank',
    isRequired: true,
    sortOrder: 9,
    formulaEnabled: false,
    description: 'Core fire door blank'
  },
  {
    componentType: 'FACING',
    displayName: 'Facing Material',
    isRequired: false,
    sortOrder: 10,
    formulaEnabled: true,
    formulaExpression: 'doorArea * 2',
    description: 'Facing veneer or laminate'
  },
  {
    componentType: 'FRAME',
    displayName: 'Frame',
    isRequired: true,
    sortOrder: 11,
    formulaEnabled: false,
    description: 'Fire-rated door frame'
  },
  {
    componentType: 'THRESHOLD',
    displayName: 'Threshold',
    isRequired: false,
    sortOrder: 12,
    formulaEnabled: false,
    description: 'Door threshold'
  },
  {
    componentType: 'PAINT_FINISH',
    displayName: 'Paint/Finish',
    isRequired: false,
    sortOrder: 13,
    formulaEnabled: true,
    formulaExpression: 'doorArea * 2.2',
    description: 'Paint or finish coating'
  }
];

async function setupFireDoorComponents() {
  try {
    console.log('🔧 Setting up Fire Door component type mappings...\n');
    
    // Get all tenants
    const tenantsResult = await pool.query(`
      SELECT id, name FROM "Tenant" ORDER BY name
    `);
    
    console.log(`Found ${tenantsResult.rows.length} tenants\n`);
    
    let totalInserted = 0;
    
    for (const tenant of tenantsResult.rows) {
      console.log(`📦 Setting up components for: ${tenant.name}`);
      
      for (const component of FIRE_DOOR_COMPONENTS) {
        try {
          await pool.query(`
            INSERT INTO "ProductTypeComponent" (
              "id",
              "tenantId",
              "productType",
              "componentType",
              "displayName",
              "isRequired",
              "sortOrder",
              "formulaEnabled",
              "formulaExpression",
              "createdAt",
              "updatedAt"
            ) VALUES (
              gen_random_uuid(),
              $1,
              'FIRE_DOOR',
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
            ON CONFLICT ("tenantId", "productType", "componentType") DO UPDATE SET
              "displayName" = EXCLUDED."displayName",
              "isRequired" = EXCLUDED."isRequired",
              "sortOrder" = EXCLUDED."sortOrder",
              "formulaEnabled" = EXCLUDED."formulaEnabled",
              "formulaExpression" = EXCLUDED."formulaExpression",
              "updatedAt" = CURRENT_TIMESTAMP
          `, [
            tenant.id,
            component.componentType,
            component.displayName,
            component.isRequired,
            component.sortOrder,
            component.formulaEnabled,
            component.formulaExpression
          ]);
          
          totalInserted++;
        } catch (error) {
          console.error(`  ❌ Error adding ${component.componentType}: ${error.message}`);
        }
      }
      
      console.log(`  ✅ Configured ${FIRE_DOOR_COMPONENTS.length} component types`);
    }
    
    console.log(`\n✅ Total component mappings created: ${totalInserted}\n`);
    
    // Verify the setup
    const verifyResult = await pool.query(`
      SELECT 
        t.name as tenant_name,
        COUNT(ptc.id) as component_count,
        array_agg(ptc."componentType" ORDER BY ptc."sortOrder") as components
      FROM "Tenant" t
      LEFT JOIN "ProductTypeComponent" ptc ON t.id = ptc."tenantId" AND ptc."productType" = 'FIRE_DOOR'
      GROUP BY t.name
      ORDER BY t.name
      LIMIT 3
    `);
    
    console.log('📊 Verification (sample):');
    verifyResult.rows.forEach(row => {
      console.log(`\n  ${row.tenant_name}:`);
      console.log(`    Components: ${row.component_count}`);
      if (row.components && row.components[0]) {
        console.log(`    Types: ${row.components.slice(0, 5).join(', ')}${row.components.length > 5 ? '...' : ''}`);
      }
    });
    
    console.log('\n\n🎉 Fire door component setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Populate ComponentLookup with specific components:');
    console.log('   - Add standard hinges (HNG-BT-SS, HNG-BT-PSS)');
    console.log('   - Add locks (LOCK-SL-SS, LOCK-PANIC)');
    console.log('   - Add intumescent strips (INT-15MM, INT-20MM)');
    console.log('   - Add door closers, frames, blanks, etc.');
    console.log('2. Build component management UI at /settings/components');
    console.log('3. Integrate with fire door schedule');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

setupFireDoorComponents();
