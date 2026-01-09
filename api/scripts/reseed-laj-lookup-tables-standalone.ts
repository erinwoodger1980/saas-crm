/**
 * Reseed LAJ Joinery Lookup Tables - Standalone Script
 * Restores all lookup table data for the LAJ Joinery tenant
 * Run with: npx ts-node --esm scripts/reseed-laj-lookup-tables-standalone.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

// Lookup table definitions
const LOOKUP_TABLES = [
  {
    name: 'Fire door core pricing and specifications',
    description: 'Fire-rated door cores with pricing',
    columns: ['Fire Rating', 'Core Type', 'Thickness (mm)', 'Size (mm)', 'Price (GBP)', 'Lead Time (days)'],
    rows: [
      { 'Fire Rating': '30min', 'Core Type': 'Steel Honeycomb', 'Thickness (mm)': 40, 'Size (mm)': '1980x838', 'Price (GBP)': 185, 'Lead Time (days)': 14 },
      { 'Fire Rating': '60min', 'Core Type': 'Mineral Wool', 'Thickness (mm)': 50, 'Size (mm)': '1980x838', 'Price (GBP)': 245, 'Lead Time (days)': 21 },
      { 'Fire Rating': '120min', 'Core Type': 'Mineral Wool + Glass', 'Thickness (mm)': 60, 'Size (mm)': '1980x838', 'Price (GBP)': 380, 'Lead Time (days)': 28 },
      { 'Fire Rating': '30min', 'Core Type': 'Steel Honeycomb', 'Thickness (mm)': 40, 'Size (mm)': '2100x900', 'Price (GBP)': 210, 'Lead Time (days)': 14 },
      { 'Fire Rating': '60min', 'Core Type': 'Mineral Wool', 'Thickness (mm)': 50, 'Size (mm)': '2100x900', 'Price (GBP)': 280, 'Lead Time (days)': 21 },
      { 'Fire Rating': '120min', 'Core Type': 'Mineral Wool + Glass', 'Thickness (mm)': 60, 'Size (mm)': '2100x900', 'Price (GBP)': 420, 'Lead Time (days)': 28 },
      { 'Fire Rating': '30min', 'Core Type': 'Steel Honeycomb', 'Thickness (mm)': 40, 'Size (mm)': '2250x1050', 'Price (GBP)': 240, 'Lead Time (days)': 14 },
      { 'Fire Rating': '60min', 'Core Type': 'Mineral Wool', 'Thickness (mm)': 50, 'Size (mm)': '2250x1050', 'Price (GBP)': 320, 'Lead Time (days)': 21 },
      { 'Fire Rating': '120min', 'Core Type': 'Mineral Wool + Glass', 'Thickness (mm)': 60, 'Size (mm)': '2250x1050', 'Price (GBP)': 480, 'Lead Time (days)': 28 },
      { 'Fire Rating': '30min', 'Core Type': 'Steel Honeycomb', 'Thickness (mm)': 40, 'Size (mm)': '800x2100', 'Price (GBP)': 215, 'Lead Time (days)': 14 },
      { 'Fire Rating': '60min', 'Core Type': 'Mineral Wool', 'Thickness (mm)': 50, 'Size (mm)': '800x2100', 'Price (GBP)': 290, 'Lead Time (days)': 21 },
      { 'Fire Rating': '120min', 'Core Type': 'Mineral Wool + Glass', 'Thickness (mm)': 60, 'Size (mm)': '800x2100', 'Price (GBP)': 440, 'Lead Time (days)': 28 },
      { 'Fire Rating': '30min', 'Core Type': 'Steel Honeycomb', 'Thickness (mm)': 40, 'Size (mm)': '1000x2100', 'Price (GBP)': 245, 'Lead Time (days)': 14 },
      { 'Fire Rating': '60min', 'Core Type': 'Mineral Wool', 'Thickness (mm)': 50, 'Size (mm)': '1000x2100', 'Price (GBP)': 330, 'Lead Time (days)': 21 },
    ],
  },
  {
    name: 'Timber material pricing',
    description: 'Solid and engineered timber materials',
    columns: ['Wood Type', 'Grade', 'Source', 'Price per m3 (GBP)', 'Lead Time (days)', 'Supplier'],
    rows: [
      { 'Wood Type': 'Oak', 'Grade': 'Grade A', 'Source': 'UK', 'Price per m3 (GBP)': 950, 'Lead Time (days)': 14, 'Supplier': 'Local Mill' },
      { 'Wood Type': 'Oak', 'Grade': 'Grade B', 'Source': 'UK', 'Price per m3 (GBP)': 750, 'Lead Time (days)': 14, 'Supplier': 'Local Mill' },
      { 'Wood Type': 'Ash', 'Grade': 'Grade A', 'Source': 'UK', 'Price per m3 (GBP)': 1200, 'Lead Time (days)': 21, 'Supplier': 'Local Mill' },
      { 'Wood Type': 'Ash', 'Grade': 'Grade B', 'Source': 'UK', 'Price per m3 (GBP)': 850, 'Lead Time (days)': 21, 'Supplier': 'Local Mill' },
      { 'Wood Type': 'Walnut', 'Grade': 'Grade A', 'Source': 'EU', 'Price per m3 (GBP)': 1800, 'Lead Time (days)': 28, 'Supplier': 'European Supplier' },
      { 'Wood Type': 'Beech', 'Grade': 'Grade A', 'Source': 'EU', 'Price per m3 (GBP)': 650, 'Lead Time (days)': 21, 'Supplier': 'European Supplier' },
      { 'Wood Type': 'Pine', 'Grade': 'Standard', 'Source': 'UK', 'Price per m3 (GBP)': 450, 'Lead Time (days)': 7, 'Supplier': 'Local Mill' },
      { 'Wood Type': 'Spruce', 'Grade': 'Standard', 'Source': 'Scandinavia', 'Price per m3 (GBP)': 380, 'Lead Time (days)': 14, 'Supplier': 'Scandinavian Supplier' },
      { 'Wood Type': 'Maple', 'Grade': 'Grade A', 'Source': 'North America', 'Price per m3 (GBP)': 1400, 'Lead Time (days)': 35, 'Supplier': 'American Importer' },
      { 'Wood Type': 'Teak', 'Grade': 'Grade A', 'Source': 'Indonesia', 'Price per m3 (GBP)': 2200, 'Lead Time (days)': 42, 'Supplier': 'Tropical Timber Supplier' },
      { 'Wood Type': 'Softwood', 'Grade': 'Standard', 'Source': 'UK', 'Price per m3 (GBP)': 350, 'Lead Time (days)': 7, 'Supplier': 'Local Merchant' },
      { 'Wood Type': 'Hardwood', 'Grade': 'Grade A', 'Source': 'Mixed', 'Price per m3 (GBP)': 1100, 'Lead Time (days)': 21, 'Supplier': 'Specialist Supplier' },
    ],
  },
  {
    name: 'Glass and glazing pricing',
    description: 'Glass types and glazing unit options',
    columns: ['Glass Type', 'Thickness/Spec', 'Size (mm)', 'Price per unit (GBP)', 'Lead Time (days)', 'Supplier'],
    rows: [
      { 'Glass Type': 'Clear Float', 'Thickness/Spec': '4mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 45, 'Lead Time (days)': 7, 'Supplier': 'Glass Direct' },
      { 'Glass Type': 'Clear Float', 'Thickness/Spec': '6mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 65, 'Lead Time (days)': 7, 'Supplier': 'Glass Direct' },
      { 'Glass Type': 'Toughened', 'Thickness/Spec': '6mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 85, 'Lead Time (days)': 14, 'Supplier': 'Toughened Glass Ltd' },
      { 'Glass Type': 'Toughened', 'Thickness/Spec': '8mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 110, 'Lead Time (days)': 14, 'Supplier': 'Toughened Glass Ltd' },
      { 'Glass Type': 'Double Glazed', 'Thickness/Spec': '4mm-12mm-4mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 125, 'Lead Time (days)': 21, 'Supplier': 'Double Glazing Ltd' },
      { 'Glass Type': 'Double Glazed', 'Thickness/Spec': '6mm-16mm-6mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 155, 'Lead Time (days)': 21, 'Supplier': 'Double Glazing Ltd' },
      { 'Glass Type': 'Laminated', 'Thickness/Spec': '6mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 95, 'Lead Time (days)': 14, 'Supplier': 'Safety Glass Supplies' },
      { 'Glass Type': 'Tinted', 'Thickness/Spec': '6mm Bronze', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 90, 'Lead Time (days)': 14, 'Supplier': 'Tinted Glass Co' },
      { 'Glass Type': 'Tinted', 'Thickness/Spec': '6mm Grey', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 90, 'Lead Time (days)': 14, 'Supplier': 'Tinted Glass Co' },
      { 'Glass Type': 'Low-E', 'Thickness/Spec': '4mm-12mm-4mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 165, 'Lead Time (days)': 28, 'Supplier': 'Energy Efficient Glass Ltd' },
      { 'Glass Type': 'Acoustic', 'Thickness/Spec': '6mm-6mm', 'Size (mm)': '1000x1000', 'Price per unit (GBP)': 140, 'Lead Time (days)': 21, 'Supplier': 'Soundproof Glass Ltd' },
      { 'Glass Type': 'Bevelled', 'Thickness/Spec': '4mm', 'Size (mm)': '500x500', 'Price per unit (GBP)': 60, 'Lead Time (days)': 14, 'Supplier': 'Bevelled Edge Co' },
    ],
  },
  {
    name: 'Door finishing options and pricing',
    description: 'Available finishes for doors and frames',
    columns: ['Finish Type', 'Description', 'Application', 'Drying Time (hours)', 'Cost per m2 (GBP)'],
    rows: [
      { 'Finish Type': 'Natural', 'Description': 'Natural Wood Oil', 'Application': 'Brush/Spray', 'Drying Time (hours)': 24, 'Cost per m2 (GBP)': 3.50 },
      { 'Finish Type': 'Natural', 'Description': 'Clear Lacquer', 'Application': 'Spray', 'Drying Time (hours)': 4, 'Cost per m2 (GBP)': 4.20 },
      { 'Finish Type': 'Natural', 'Description': 'Satin Varnish', 'Application': 'Brush', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 3.80 },
      { 'Finish Type': 'Paint', 'Description': 'Interior Eggshell White', 'Application': 'Brush/Roller', 'Drying Time (hours)': 6, 'Cost per m2 (GBP)': 5.50 },
      { 'Finish Type': 'Paint', 'Description': 'Interior Eggshell Colours', 'Application': 'Brush/Roller', 'Drying Time (hours)': 6, 'Cost per m2 (GBP)': 6.20 },
      { 'Finish Type': 'Paint', 'Description': 'Exterior Gloss Black', 'Application': 'Brush/Spray', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 7.80 },
      { 'Finish Type': 'Paint', 'Description': 'Exterior Gloss Colours', 'Application': 'Brush/Spray', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 8.50 },
      { 'Finish Type': 'Stain', 'Description': 'Medium Oak Stain', 'Application': 'Brush', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 4.50 },
      { 'Finish Type': 'Stain', 'Description': 'Walnut Stain', 'Application': 'Brush', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 5.00 },
      { 'Finish Type': 'Stain', 'Description': 'Dark Mahogany Stain', 'Application': 'Brush', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 5.20 },
      { 'Finish Type': 'Powder Coat', 'Description': 'Standard Colours', 'Application': 'Industrial', 'Drying Time (hours)': 1, 'Cost per m2 (GBP)': 8.00 },
      { 'Finish Type': 'Fire Retardant', 'Description': 'Fire Rated Paint', 'Application': 'Brush/Spray', 'Drying Time (hours)': 12, 'Cost per m2 (GBP)': 12.50 },
      { 'Finish Type': 'UV Resistant', 'Description': 'Exterior UV Protection', 'Application': 'Spray', 'Drying Time (hours)': 6, 'Cost per m2 (GBP)': 9.80 },
    ],
  },
  {
    name: 'Veneer layon pricing 2024',
    description: 'Pre-finished veneer sheets and finishes',
    columns: ['Veneer Type', 'Grade', 'Thickness (mm)', 'Sheet Size', 'Price per sheet (GBP)', 'Lead Time (days)'],
    rows: [
      { 'Veneer Type': 'Oak', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 65, 'Lead Time (days)': 14 },
      { 'Veneer Type': 'Oak', 'Grade': 'Grade B', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 48, 'Lead Time (days)': 14 },
      { 'Veneer Type': 'Walnut', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 95, 'Lead Time (days)': 21 },
      { 'Veneer Type': 'Ash', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 78, 'Lead Time (days)': 21 },
      { 'Veneer Type': 'Maple', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 85, 'Lead Time (days)': 21 },
      { 'Veneer Type': 'Cherry', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 92, 'Lead Time (days)': 28 },
      { 'Veneer Type': 'Teak', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 145, 'Lead Time (days)': 35 },
      { 'Veneer Type': 'Birch', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 55, 'Lead Time (days)': 14 },
      { 'Veneer Type': 'Beech', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 62, 'Lead Time (days)': 14 },
      { 'Veneer Type': 'Sapele', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 72, 'Lead Time (days)': 21 },
      { 'Veneer Type': 'Mahogany', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 88, 'Lead Time (days)': 28 },
      { 'Veneer Type': 'Rosewood', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 135, 'Lead Time (days)': 35 },
      { 'Veneer Type': 'Ebonised Oak', 'Grade': 'Grade A', 'Thickness (mm)': 0.6, 'Sheet Size': '1220x2440', 'Price per sheet (GBP)': 78, 'Lead Time (days)': 21 },
    ],
  },
  {
    name: 'Ironmongery hardware pricing',
    description: 'Door hardware, hinges, locks and fittings',
    columns: ['Hardware Type', 'Description', 'Supplier', 'Part Number', 'Cost (GBP)', 'Lead Time (days)'],
    rows: [
      { 'Hardware Type': 'Hinges', 'Description': 'Standard 3" Butt Hinges Brass', 'Supplier': 'Ironmongery Direct', 'Part Number': 'BH-3IN-BR', 'Cost (GBP)': 15, 'Lead Time (days)': 3 },
      { 'Hardware Type': 'Hinges', 'Description': 'Heavy Duty 3" Butt Hinges Steel', 'Supplier': 'Ironmongery Direct', 'Part Number': 'BH-3IN-ST', 'Cost (GBP)': 12, 'Lead Time (days)': 3 },
      { 'Hardware Type': 'Hinges', 'Description': 'Heavy-Duty Concealed Hinges', 'Supplier': 'Hettich', 'Part Number': 'HH-CONC-HD', 'Cost (GBP)': 45, 'Lead Time (days)': 14 },
      { 'Hardware Type': 'Hinges', 'Description': 'Ball Bearing Hinges', 'Supplier': 'Ironmongery Direct', 'Part Number': 'BBH-3IN', 'Cost (GBP)': 22, 'Lead Time (days)': 7 },
      { 'Hardware Type': 'Locks', 'Description': 'Mortice Lock 3 Lever', 'Supplier': 'Carlisle Brass', 'Part Number': 'ML-3L', 'Cost (GBP)': 25, 'Lead Time (days)': 5 },
      { 'Hardware Type': 'Locks', 'Description': 'Electronic Smart Lock', 'Supplier': 'Smart Home Supply', 'Part Number': 'EL-SL-PRO', 'Cost (GBP)': 180, 'Lead Time (days)': 10 },
      { 'Hardware Type': 'Locks', 'Description': 'Cylinder Lock', 'Supplier': 'Carlisle Brass', 'Part Number': 'CL-5PIN', 'Cost (GBP)': 18, 'Lead Time (days)': 3 },
      { 'Hardware Type': 'Handles', 'Description': 'Contemporary Door Handle Chrome', 'Supplier': 'Carlisle Brass', 'Part Number': 'DH-CONT-CH', 'Cost (GBP)': 18, 'Lead Time (days)': 7 },
      { 'Hardware Type': 'Handles', 'Description': 'Traditional Door Handle Brass', 'Supplier': 'Carlisle Brass', 'Part Number': 'DH-TRAD-BR', 'Cost (GBP)': 22, 'Lead Time (days)': 7 },
      { 'Hardware Type': 'Handles', 'Description': 'Stainless Steel Handle', 'Supplier': 'Ironmongery Direct', 'Part Number': 'DH-SS-MOD', 'Cost (GBP)': 20, 'Lead Time (days)': 5 },
      { 'Hardware Type': 'Handles', 'Description': 'Lever Handle Chrome', 'Supplier': 'Carlisle Brass', 'Part Number': 'LH-CH-MOD', 'Cost (GBP)': 16, 'Lead Time (days)': 7 },
      { 'Hardware Type': 'Door Closers', 'Description': 'Hydraulic Door Closer', 'Supplier': 'Hettich', 'Part Number': 'DC-HYD-50', 'Cost (GBP)': 120, 'Lead Time (days)': 10 },
      { 'Hardware Type': 'Door Closers', 'Description': 'Surface Mounted Closer', 'Supplier': 'Ironmongery Direct', 'Part Number': 'SM-CLOSER-3', 'Cost (GBP)': 95, 'Lead Time (days)': 7 },
    ],
  },
];

async function reseedLookupTables() {
  console.log('🌱 Reseeding LAJ Joinery lookup tables...\n');

  try {
    // Get LAJ Joinery tenant
    const lajTenant = await prisma.tenant.findUnique({
      where: { slug: 'laj-joinery' },
    });

    if (!lajTenant) {
      console.error('❌ LAJ Joinery tenant not found');
      process.exit(1);
    }

    console.log(`✅ Found tenant: ${lajTenant.name} (${lajTenant.id})\n`);

    // Delete existing lookup tables for this tenant
    const existingTables = await prisma.lookupTable.findMany({
      where: { tenantId: lajTenant.id },
    });

    if (existingTables.length > 0) {
      console.log(`🗑️  Deleting ${existingTables.length} existing lookup tables...`);
      for (const table of existingTables) {
        await prisma.lookupTableRow.deleteMany({
          where: { lookupTableId: table.id },
        });
        await prisma.lookupTable.delete({
          where: { id: table.id },
        });
      }
      console.log('✅ Deleted existing tables\n');
    }

    // Create new lookup tables
    for (const tableData of LOOKUP_TABLES) {
      const table = await prisma.lookupTable.create({
        data: {
          tenantId: lajTenant.id,
          name: tableData.name,
          description: tableData.description,
          columns: tableData.columns,
          isStandard: true,
        },
      });

      // Add rows
      for (const rowData of tableData.rows) {
        await prisma.lookupTableRow.create({
          data: {
            lookupTableId: table.id,
            data: rowData,
          },
        });
      }

      console.log(`✅ Created "${tableData.name}" with ${tableData.rows.length} rows`);
    }

    console.log('\n✨ Lookup table reseeding complete!');
  } catch (error) {
    console.error('❌ Error reseeding lookup tables:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reseedLookupTables();
