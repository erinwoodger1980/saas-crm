/**
 * Import Costings Excel Data to LookupTable
 * 
 * Imports pricing data from costings-data.json into LookupTable records
 * that can be used with LOOKUP() formulas in calculated fields.
 * 
 * Usage:
 *   pnpm tsx scripts/import-costings-to-lookup-tables.ts <tenantId>
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from api/.env
config({ path: join(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

console.log('✅ DATABASE_URL loaded:', process.env.DATABASE_URL?.substring(0, 30) + '...\n');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function main() {
  console.log('🔄 Importing costings data to lookup tables...\n');

  // Get tenantId from command line or use first tenant
  const targetTenantId = process.argv[2];
  
  let tenant;
  if (targetTenantId) {
    tenant = await prisma.tenant.findUnique({ where: { id: targetTenantId } });
    if (!tenant) {
      console.error(`❌ Tenant not found: ${targetTenantId}`);
      process.exit(1);
    }
  } else {
    tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.error('❌ No tenant found. Please create a tenant first or specify tenant ID.');
      console.error('   Usage: pnpm tsx scripts/import-costings-to-lookup-tables.ts <tenantId>');
      process.exit(1);
    }
  }

  console.log(`✅ Using tenant: ${tenant.name} (${tenant.id})\n`);

  // Load costings data
  const costingsPath = join(__dirname, '../../costings-data.json');
  const rawData = readFileSync(costingsPath, 'utf-8');
  // Replace NaN with null to make it valid JSON
  const cleanedData = rawData.replace(/:\s*NaN/g, ': null');
  const costingsData = JSON.parse(cleanedData);

  // 1. Door Core Prices
  await importTable(tenant.id, {
    name: 'DoorCorePrices',
    description: 'Fire door core pricing and specifications (137 rows)',
    sheetName: 'Door Core Prices',
    data: costingsData['Door Core Prices'],
  });

  // 2. Timber Prices
  await importTable(tenant.id, {
    name: 'TimberPrices',
    description: 'Timber material pricing (52 rows)',
    sheetName: 'Timber Prices',
    data: costingsData['Timber Prices'],
  });

  // 3. Glass Prices
  await importTable(tenant.id, {
    name: 'GlassPrices',
    description: 'Glass and glazing pricing (58 rows)',
    sheetName: 'Glass Prices',
    data: costingsData['Glass Prices'],
  });

  // 4. Leaf/Frame Finishes
  await importTable(tenant.id, {
    name: 'LeafFrameFinishes',
    description: 'Door finishing options and pricing (105 rows)',
    sheetName: 'Leaf_Frame Finishes',
    data: costingsData['Leaf_Frame Finishes'],
  });

  // 5. Veneer Layon Prices
  await importTable(tenant.id, {
    name: 'VeneerLayonPrices',
    description: 'Veneer layon pricing 2024 (79 rows)',
    sheetName: 'Veneer Layon Prices 2024',
    data: costingsData['Veneer Layon Prices 2024'],
  });

  // 6. Ironmongery
  await importTable(tenant.id, {
    name: 'IronmongeryPrices',
    description: 'Ironmongery hardware pricing (70 rows)',
    sheetName: 'Ironmongery',
    data: costingsData['Ironmongery'],
  });

  // 7. Fire Certification
  await importTable(tenant.id, {
    name: 'FireCertification',
    description: 'Fire certification reference data (116 rows)',
    sheetName: 'Fire Certification',
    data: costingsData['Fire Certification'],
  });

  // 8. Weights
  await importTable(tenant.id, {
    name: 'DoorWeights',
    description: 'Door weight calculations (26 rows)',
    sheetName: 'Weights',
    data: costingsData['Weights'],
  });

  // 9. Leaf Sizing By Frame Type
  await importTable(tenant.id, {
    name: 'LeafSizingByFrameType',
    description: 'Leaf sizing calculations by frame type (63 rows)',
    sheetName: 'Leaf Sizing By Frame Type',
    data: costingsData['Leaf Sizing By Frame Type'],
  });

  console.log('\n✅ Import complete!\n');
  console.log('📋 Summary of imported lookup tables:');
  
  const tables = await prisma.lookupTable.findMany({
    where: { tenantId: tenant.id },
    select: { name: true, description: true },
  });
  
  tables.forEach(table => {
    console.log(`  - ${table.name}: ${table.description}`);
  });

  console.log('\n💡 Use these tables in formulas:');
  console.log('   LOOKUP(DoorCorePrices, core=${lineItem.core}&rating=${lineItem.rating}, price)');
  console.log('   LOOKUP(TimberPrices, material=${lineItem.material}, price)');
  console.log('   LOOKUP(IronmongeryPrices, type=${lineItem.hingeType}, price)');
}

async function importTable(
  tenantId: string,
  config: { name: string; description: string; sheetName: string; data: any[] }
) {
  const { name, description, sheetName, data } = config;

  console.log(`\n📊 Importing: ${name} (${sheetName})`);

  if (!data || data.length === 0) {
    console.log(`   ⚠️  No data found in sheet "${sheetName}"`);
    return;
  }

  // Get columns from first row
  const columns = Object.keys(data[0]);
  console.log(`   📋 ${columns.length} columns, ${data.length} rows`);

  // Clean data - remove rows with all null/undefined values
  const cleanData = data.filter(row => {
    return Object.values(row).some(val => val !== null && val !== undefined && val !== '');
  });

  console.log(`   🧹 ${cleanData.length} rows after cleaning`);

  // Check if table already exists
  const existing = await prisma.lookupTable.findFirst({
    where: { tenantId, name },
  });

  if (existing) {
    console.log(`   🔄 Updating existing table...`);
    await prisma.lookupTable.update({
      where: { id: existing.id },
      data: {
        description,
        columns,
        rows: cleanData,
        updatedAt: new Date(),
      },
    });
  } else {
    console.log(`   ➕ Creating new table...`);
    await prisma.lookupTable.create({
      data: {
        tenantId,
        name,
        description,
        columns,
        rows: cleanData,
        isStandard: false,
      },
    });
  }

  console.log(`   ✅ Done`);
}

main()
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
