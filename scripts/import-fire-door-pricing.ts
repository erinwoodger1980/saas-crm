/**
 * Fire Door Pricing Data Import Script
 * 
 * Imports Excel pricing data from costings-data.json into ComponentLookup and Material tables.
 * Maps Excel sheets to database records that can be edited through /settings/components UI.
 * 
 * Key Sheets to Import:
 * - Door Core Prices (137 rows) → ComponentLookup (componentType: "DOOR_CORE")
 * - Timber Prices (52 rows) → Material (category: "TIMBER")
 * - Glass Prices (58 rows) → ComponentLookup (componentType: "GLASS")
 * - Leaf_Frame Finishes (105 rows) → Material (category: "FINISH")
 * - Ironmongery (70 rows) → ComponentLookup (componentType: "IRONMONGERY")
 * - Veneer Layon Prices 2024 (79 rows) → Material (category: "VENEER")
 * 
 * Usage:
 *   pnpm tsx scripts/import-fire-door-pricing.ts --tenant <tenantId>
 *   pnpm tsx scripts/import-fire-door-pricing.ts --tenant <tenantId> --dry-run
 */

import { PrismaClient, MaterialCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ImportOptions {
  tenantId: string;
  dryRun: boolean;
  overwrite: boolean;
}

interface CostingSheets {
  'Door Core Prices'?: any[];
  'Timber Prices'?: any[];
  'Glass Prices'?: any[];
  'Leaf_Frame Finishes'?: any[];
  'Ironmongery'?: any[];
  'Veneer Layon Prices 2024'?: any[];
  'Weights'?: any[];
}

/**
 * Import Door Core Prices sheet to ComponentLookup
 * Example rows: Strebord, Halspan variants with fire ratings
 */
async function importDoorCorePrices(rows: any[], tenantId: string, dryRun: boolean) {
  console.log(`\n📦 Importing Door Core Prices (${rows.length} rows)...`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    // Skip empty rows
    if (!row || Object.keys(row).length === 0) continue;
    
    // Extract meaningful data from row
    // Adjust these field names based on actual Excel column headers
    const code = row['Code'] || row['Product Code'] || row['code'];
    const name = row['Name'] || row['Description'] || row['Product Name'];
    const price = parseFloat(row['Price'] || row['Unit Price'] || row['Cost'] || '0');
    const thickness = row['Thickness'] || row['thickness'];
    const fireRating = row['Fire Rating'] || row['FR'] || row['fireRating'];
    const coreType = row['Core Type'] || row['Type'] || row['Material'];
    
    if (!code || !name) {
      skipped++;
      continue;
    }
    
    const componentData = {
      tenantId,
      productTypes: ['FIRE_DOOR', 'FIRE_DOOR_SET'],
      componentType: 'DOOR_CORE',
      code: String(code).trim(),
      name: String(name).trim(),
      description: `${coreType || ''} ${fireRating || ''} core`.trim(),
      unitOfMeasure: 'EA',
      basePrice: price,
      leadTimeDays: 7,
      isActive: true,
      metadata: {
        thickness: thickness,
        fireRating: fireRating,
        coreType: coreType,
        sourceSheet: 'Door Core Prices',
        imported: new Date().toISOString()
      }
    };
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${componentData.code} - ${componentData.name}`);
      imported++;
    } else {
      try {
        await prisma.componentLookup.upsert({
          where: { tenantId_code: { tenantId, code: componentData.code } },
          create: componentData,
          update: componentData
        });
        imported++;
        console.log(`  ✓ ${componentData.code} - ${componentData.name}`);
      } catch (error) {
        console.error(`  ✗ Error importing ${componentData.code}:`, error);
        skipped++;
      }
    }
  }
  
  console.log(`  📊 Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Import Timber Prices to Material table
 * Example: Oak, Ash, Walnut lipping, stiles, rails
 */
async function importTimberPrices(rows: any[], tenantId: string, dryRun: boolean) {
  console.log(`\n🪵 Importing Timber Prices (${rows.length} rows)...`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    if (!row || Object.keys(row).length === 0) continue;
    
    const code = row['Code'] || row['Product Code'] || row['code'];
    const name = row['Name'] || row['Description'] || row['Species'];
    const price = parseFloat(row['Price'] || row['Unit Price'] || row['Cost Per M'] || '0');
    const species = row['Species'] || row['Timber Type'];
    const grade = row['Grade'] || row['Quality'];
    const thickness = row['Thickness'] || row['T'];
    const width = row['Width'] || row['W'];
    
    if (!code || !name) {
      skipped++;
      continue;
    }
    
    const materialData = {
      tenantId,
      category: 'TIMBER' as MaterialCategory,
      code: String(code).trim(),
      name: String(name).trim(),
      description: `${species || ''} ${grade || ''} timber`.trim(),
      unitCost: price,
      currency: 'GBP',
      unit: 'M',
      thickness: thickness ? parseFloat(thickness) : null,
      width: width ? parseFloat(width) : null,
      species: species,
      grade: grade,
      isActive: true,
      leadTimeDays: 7
    };
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${materialData.code} - ${materialData.name}`);
      imported++;
    } else {
      try {
        await prisma.material.upsert({
          where: { tenantId_code: { tenantId, code: materialData.code } },
          create: materialData,
          update: materialData
        });
        imported++;
        console.log(`  ✓ ${materialData.code} - ${materialData.name}`);
      } catch (error) {
        console.error(`  ✗ Error importing ${materialData.code}:`, error);
        skipped++;
      }
    }
  }
  
  console.log(`  📊 Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Import Glass Prices to ComponentLookup
 * Example: Pyroguard, Pilkington fire-rated glass
 */
async function importGlassPrices(rows: any[], tenantId: string, dryRun: boolean) {
  console.log(`\n🪟 Importing Glass Prices (${rows.length} rows)...`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    if (!row || Object.keys(row).length === 0) continue;
    
    const code = row['Code'] || row['Product Code'] || row['code'];
    const name = row['Name'] || row['Description'] || row['Glass Type'];
    const price = parseFloat(row['Price'] || row['Unit Price'] || row['Cost Per M2'] || '0');
    const thickness = row['Thickness'] || row['T'];
    const fireRating = row['Fire Rating'] || row['FR'];
    const glassType = row['Type'] || row['Glass Type'];
    
    if (!code || !name) {
      skipped++;
      continue;
    }
    
    const componentData = {
      tenantId,
      productTypes: ['FIRE_DOOR', 'FIRE_DOOR_SET', 'WINDOW'],
      componentType: 'GLASS',
      code: String(code).trim(),
      name: String(name).trim(),
      description: `${glassType || ''} ${fireRating || ''} glass`.trim(),
      unitOfMeasure: 'M2',
      basePrice: price,
      leadTimeDays: 14,
      isActive: true,
      metadata: {
        thickness: thickness,
        fireRating: fireRating,
        glassType: glassType,
        sourceSheet: 'Glass Prices',
        imported: new Date().toISOString()
      }
    };
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${componentData.code} - ${componentData.name}`);
      imported++;
    } else {
      try {
        await prisma.componentLookup.upsert({
          where: { tenantId_code: { tenantId, code: componentData.code } },
          create: componentData,
          update: componentData
        });
        imported++;
        console.log(`  ✓ ${componentData.code} - ${componentData.name}`);
      } catch (error) {
        console.error(`  ✗ Error importing ${componentData.code}:`, error);
        skipped++;
      }
    }
  }
  
  console.log(`  📊 Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Import Leaf_Frame Finishes to Material table
 * Example: Lacquer, PVC wrap, veneer finishes
 */
async function importLeafFrameFinishes(rows: any[], tenantId: string, dryRun: boolean) {
  console.log(`\n🎨 Importing Leaf_Frame Finishes (${rows.length} rows)...`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    if (!row || Object.keys(row).length === 0) continue;
    
    const code = row['Code'] || row['Product Code'] || row['code'];
    const name = row['Name'] || row['Description'] || row['Finish'];
    const price = parseFloat(row['Price'] || row['Unit Price'] || row['Cost'] || '0');
    const finishType = row['Type'] || row['Finish Type'];
    const color = row['Colour'] || row['Color'];
    
    if (!code || !name) {
      skipped++;
      continue;
    }
    
    const materialData = {
      tenantId,
      category: 'FINISH' as MaterialCategory,
      code: String(code).trim(),
      name: String(name).trim(),
      description: `${finishType || ''} ${color || ''} finish`.trim(),
      unitCost: price,
      currency: 'GBP',
      unit: 'M2',
      finish: finishType,
      colorName: color,
      isActive: true,
      leadTimeDays: 7
    };
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${materialData.code} - ${materialData.name}`);
      imported++;
    } else {
      try {
        await prisma.material.upsert({
          where: { tenantId_code: { tenantId, code: materialData.code } },
          create: materialData,
          update: materialData
        });
        imported++;
        console.log(`  ✓ ${materialData.code} - ${materialData.name}`);
      } catch (error) {
        console.error(`  ✗ Error importing ${materialData.code}:`, error);
        skipped++;
      }
    }
  }
  
  console.log(`  📊 Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Import Ironmongery to ComponentLookup
 * Example: Hinges, locks, closers, seals
 */
async function importIronmongery(rows: any[], tenantId: string, dryRun: boolean) {
  console.log(`\n🔩 Importing Ironmongery (${rows.length} rows)...`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    if (!row || Object.keys(row).length === 0) continue;
    
    const code = row['Code'] || row['Product Code'] || row['code'];
    const name = row['Name'] || row['Description'] || row['Product'];
    const price = parseFloat(row['Price'] || row['Unit Price'] || row['Cost'] || '0');
    const category = row['Category'] || row['Type'];
    const brand = row['Brand'] || row['Manufacturer'];
    
    if (!code || !name) {
      skipped++;
      continue;
    }
    
    const componentData = {
      tenantId,
      productTypes: ['FIRE_DOOR', 'FIRE_DOOR_SET', 'STANDARD_DOOR'],
      componentType: 'IRONMONGERY',
      code: String(code).trim(),
      name: String(name).trim(),
      description: `${brand || ''} ${category || ''}`.trim(),
      unitOfMeasure: 'EA',
      basePrice: price,
      leadTimeDays: 7,
      isActive: true,
      metadata: {
        category: category,
        brand: brand,
        sourceSheet: 'Ironmongery',
        imported: new Date().toISOString()
      }
    };
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${componentData.code} - ${componentData.name}`);
      imported++;
    } else {
      try {
        await prisma.componentLookup.upsert({
          where: { tenantId_code: { tenantId, code: componentData.code } },
          create: componentData,
          update: componentData
        });
        imported++;
        console.log(`  ✓ ${componentData.code} - ${componentData.name}`);
      } catch (error) {
        console.error(`  ✗ Error importing ${componentData.code}:`, error);
        skipped++;
      }
    }
  }
  
  console.log(`  📊 Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Import Veneer Layon Prices to Material table
 */
async function importVeneerPrices(rows: any[], tenantId: string, dryRun: boolean) {
  console.log(`\n🪵 Importing Veneer Layon Prices (${rows.length} rows)...`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    if (!row || Object.keys(row).length === 0) continue;
    
    const code = row['Code'] || row['Product Code'] || row['code'];
    const name = row['Name'] || row['Description'] || row['Veneer'];
    const price = parseFloat(row['Price'] || row['Unit Price'] || row['Cost'] || '0');
    const species = row['Species'] || row['Timber'];
    
    if (!code || !name) {
      skipped++;
      continue;
    }
    
    const materialData = {
      tenantId,
      category: 'VENEER' as MaterialCategory,
      code: String(code).trim(),
      name: String(name).trim(),
      description: `${species || ''} veneer`.trim(),
      unitCost: price,
      currency: 'GBP',
      unit: 'M2',
      species: species,
      isActive: true,
      leadTimeDays: 14
    };
    
    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${materialData.code} - ${materialData.name}`);
      imported++;
    } else {
      try {
        await prisma.material.upsert({
          where: { tenantId_code: { tenantId, code: materialData.code } },
          create: materialData,
          update: materialData
        });
        imported++;
        console.log(`  ✓ ${materialData.code} - ${materialData.name}`);
      } catch (error) {
        console.error(`  ✗ Error importing ${materialData.code}:`, error);
        skipped++;
      }
    }
  }
  
  console.log(`  📊 Imported: ${imported}, Skipped: ${skipped}`);
}

/**
 * Main import function
 */
async function importPricingData(options: ImportOptions) {
  console.log('🔥 Fire Door Pricing Data Import');
  console.log('================================\n');
  console.log(`Tenant ID: ${options.tenantId}`);
  console.log(`Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
  console.log(`Overwrite: ${options.overwrite ? 'YES' : 'NO'}\n`);
  
  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: options.tenantId }
  });
  
  if (!tenant) {
    throw new Error(`Tenant ${options.tenantId} not found`);
  }
  
  console.log(`✓ Tenant found: ${tenant.name}\n`);
  
  // Load costings data
  const costingsPath = path.join(__dirname, '../costings-data.json');
  
  if (!fs.existsSync(costingsPath)) {
    throw new Error(`Costings data file not found: ${costingsPath}`);
  }
  
  console.log(`📂 Loading: ${costingsPath}\n`);
  const costingsData: CostingSheets = JSON.parse(fs.readFileSync(costingsPath, 'utf-8'));
  
  // Import each sheet
  if (costingsData['Door Core Prices']) {
    await importDoorCorePrices(costingsData['Door Core Prices'], options.tenantId, options.dryRun);
  }
  
  if (costingsData['Timber Prices']) {
    await importTimberPrices(costingsData['Timber Prices'], options.tenantId, options.dryRun);
  }
  
  if (costingsData['Glass Prices']) {
    await importGlassPrices(costingsData['Glass Prices'], options.tenantId, options.dryRun);
  }
  
  if (costingsData['Leaf_Frame Finishes']) {
    await importLeafFrameFinishes(costingsData['Leaf_Frame Finishes'], options.tenantId, options.dryRun);
  }
  
  if (costingsData['Ironmongery']) {
    await importIronmongery(costingsData['Ironmongery'], options.tenantId, options.dryRun);
  }
  
  if (costingsData['Veneer Layon Prices 2024']) {
    await importVeneerPrices(costingsData['Veneer Layon Prices 2024'], options.tenantId, options.dryRun);
  }
  
  console.log('\n✅ Import complete!\n');
  
  if (options.dryRun) {
    console.log('ℹ️  This was a dry run. No data was written to the database.');
    console.log('   Remove --dry-run flag to perform actual import.\n');
  } else {
    console.log('📝 Next steps:');
    console.log('   1. Review imported components at /settings/components');
    console.log('   2. Adjust pricing and lead times as needed');
    console.log('   3. Set up BOM inclusion rules for fire door configurator');
    console.log('   4. Configure quantity formulas for automatic calculations\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const tenantId = args.find(arg => args[args.indexOf(arg) - 1] === '--tenant');
const dryRun = args.includes('--dry-run');
const overwrite = args.includes('--overwrite');

if (!tenantId) {
  console.error('❌ Error: --tenant <tenantId> is required\n');
  console.log('Usage:');
  console.log('  pnpm tsx scripts/import-fire-door-pricing.ts --tenant <tenantId>');
  console.log('  pnpm tsx scripts/import-fire-door-pricing.ts --tenant <tenantId> --dry-run');
  console.log('  pnpm tsx scripts/import-fire-door-pricing.ts --tenant <tenantId> --overwrite\n');
  process.exit(1);
}

// Run import
importPricingData({ tenantId, dryRun, overwrite })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
