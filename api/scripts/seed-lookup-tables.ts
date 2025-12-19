/**
 * Seed Standard Lookup Tables
 * Creates lookup tables for timber pricing, hardware, finishes, etc.
 * Run with: npx tsx scripts/seed-lookup-tables.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Timber pricing table structure
const TIMBER_PRICING = {
  name: 'Timber Pricing',
  description: 'Softwood and hardwood pricing per m3',
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
  ],
  isStandard: true,
};

// Hardware options
const HARDWARE_OPTIONS = {
  name: 'Hardware Options',
  description: 'Available door hardware and fittings',
  columns: ['Hardware Type', 'Description', 'Supplier', 'Part Number', 'Cost (GBP)', 'Lead Time (days)'],
  rows: [
    { 'Hardware Type': 'Hinges', 'Description': 'Standard 3" Butt Hinges Brass', 'Supplier': 'Ironmongery Direct', 'Part Number': 'BH-3IN-BR', 'Cost (GBP)': 15, 'Lead Time (days)': 3 },
    { 'Hardware Type': 'Hinges', 'Description': 'Heavy Duty 3" Butt Hinges Steel', 'Supplier': 'Ironmongery Direct', 'Part Number': 'BH-3IN-ST', 'Cost (GBP)': 12, 'Lead Time (days)': 3 },
    { 'Hardware Type': 'Locks', 'Description': 'Mortice Lock 3 Lever', 'Supplier': 'Carlisle Brass', 'Part Number': 'ML-3L', 'Cost (GBP)': 25, 'Lead Time (days)': 5 },
    { 'Hardware Type': 'Locks', 'Description': 'Electronic Smart Lock', 'Supplier': 'Smart Home Supply', 'Part Number': 'EL-SL-PRO', 'Cost (GBP)': 180, 'Lead Time (days)': 10 },
    { 'Hardware Type': 'Handles', 'Description': 'Contemporary Door Handle Chrome', 'Supplier': 'Carlisle Brass', 'Part Number': 'DH-CONT-CH', 'Cost (GBP)': 18, 'Lead Time (days)': 7 },
    { 'Hardware Type': 'Handles', 'Description': 'Traditional Door Handle Brass', 'Supplier': 'Carlisle Brass', 'Part Number': 'DH-TRAD-BR', 'Cost (GBP)': 22, 'Lead Time (days)': 7 },
    { 'Hardware Type': 'Hinges', 'Description': 'Heavy-Duty Concealed Hinges', 'Supplier': 'Hettich', 'Part Number': 'HH-CONC-HD', 'Cost (GBP)': 45, 'Lead Time (days)': 14 },
  ],
  isStandard: true,
};

// Finish options
const FINISH_OPTIONS = {
  name: 'Finish Options',
  description: 'Available wood finishes and paint options',
  columns: ['Finish Type', 'Description', 'Application', 'Drying Time (hours)', 'Cost per m2 (GBP)'],
  rows: [
    { 'Finish Type': 'Natural', 'Description': 'Natural Wood Oil', 'Application': 'Brush/Spray', 'Drying Time (hours)': 24, 'Cost per m2 (GBP)': 3.50 },
    { 'Finish Type': 'Natural', 'Description': 'Clear Lacquer', 'Application': 'Spray', 'Drying Time (hours)': 4, 'Cost per m2 (GBP)': 4.20 },
    { 'Finish Type': 'Paint', 'Description': 'Interior Eggshell White', 'Application': 'Brush/Roller', 'Drying Time (hours)': 6, 'Cost per m2 (GBP)': 5.50 },
    { 'Finish Type': 'Paint', 'Description': 'Interior Eggshell Colours', 'Application': 'Brush/Roller', 'Drying Time (hours)': 6, 'Cost per m2 (GBP)': 6.20 },
    { 'Finish Type': 'Paint', 'Description': 'Exterior Gloss Black', 'Application': 'Brush/Spray', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 7.80 },
    { 'Finish Type': 'Stain', 'Description': 'Medium Oak Stain', 'Application': 'Brush', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 4.50 },
    { 'Finish Type': 'Stain', 'Description': 'Walnut Stain', 'Application': 'Brush', 'Drying Time (hours)': 8, 'Cost per m2 (GBP)': 5.00 },
  ],
  isStandard: true,
};

// Material options
const MATERIAL_OPTIONS = {
  name: 'Material Options',
  description: 'Available materials for construction',
  columns: ['Material', 'Type', 'Thickness (mm)', 'Cost per sheet/unit', 'Supplier'],
  rows: [
    { 'Material': 'MDF', 'Type': 'Standard', 'Thickness (mm)': 18, 'Cost per sheet/unit': 32, 'Supplier': 'Local Merchant' },
    { 'Material': 'Plywood', 'Type': 'Birch', 'Thickness (mm)': 18, 'Cost per sheet/unit': 48, 'Supplier': 'Local Merchant' },
    { 'Material': 'Plywood', 'Type': 'Oak Veneer', 'Thickness (mm)': 18, 'Cost per sheet/unit': 65, 'Supplier': 'Local Merchant' },
    { 'Material': 'Hardwood', 'Type': 'Oak Solid', 'Thickness (mm)': 20, 'Cost per sheet/unit': 95, 'Supplier': 'Timber Merchant' },
    { 'Material': 'Hardwood', 'Type': 'Walnut Solid', 'Thickness (mm)': 20, 'Cost per sheet/unit': 140, 'Supplier': 'Timber Merchant' },
    { 'Material': 'Glass', 'Type': 'Clear 6mm', 'Thickness (mm)': 6, 'Cost per sheet/unit': 55, 'Supplier': 'Glass Supplier' },
    { 'Material': 'Glass', 'Type': 'Toughened 8mm', 'Thickness (mm)': 8, 'Cost per sheet/unit': 85, 'Supplier': 'Glass Supplier' },
  ],
  isStandard: true,
};

// Labour rates
const LABOUR_RATES = {
  name: 'Labour Rates',
  description: 'Hourly rates for different skilled trades',
  columns: ['Trade', 'Skill Level', 'Hourly Rate (GBP)', 'Minimum Charge (hours)'],
  rows: [
    { 'Trade': 'Carpenter', 'Skill Level': 'Apprentice', 'Hourly Rate (GBP)': 18, 'Minimum Charge (hours)': 2 },
    { 'Trade': 'Carpenter', 'Skill Level': 'Journeyman', 'Hourly Rate (GBP)': 28, 'Minimum Charge (hours)': 2 },
    { 'Trade': 'Carpenter', 'Skill Level': 'Master', 'Hourly Rate (GBP)': 40, 'Minimum Charge (hours)': 2 },
    { 'Trade': 'Joinery', 'Skill Level': 'Journeyman', 'Hourly Rate (GBP)': 35, 'Minimum Charge (hours)': 2 },
    { 'Trade': 'Joinery', 'Skill Level': 'Master', 'Hourly Rate (GBP)': 48, 'Minimum Charge (hours)': 2 },
    { 'Trade': 'Finishing', 'Skill Level': 'Standard', 'Hourly Rate (GBP)': 22, 'Minimum Charge (hours)': 2 },
    { 'Trade': 'Installation', 'Skill Level': 'Standard', 'Hourly Rate (GBP)': 25, 'Minimum Charge (hours)': 1 },
  ],
  isStandard: true,
};

async function seedLookupTables() {
  console.log('🌱 Seeding standard lookup tables...\n');

  let tenant = await prisma.tenant.findFirst();
  
  if (!tenant) {
    console.log('⚠️  No tenant found. Please create a tenant first.');
    return;
  }

  console.log(`Using tenant: ${tenant.name}\n`);

  const tables = [TIMBER_PRICING, HARDWARE_OPTIONS, FINISH_OPTIONS, MATERIAL_OPTIONS, LABOUR_RATES];

  for (const tableData of tables) {
    const existing = await prisma.lookupTable.findFirst({
      where: {
        tenantId: tenant.id,
        name: tableData.name,
      },
    });

    if (existing) {
      console.log(`⏭️  ${tableData.name} already exists`);
      continue;
    }

    await prisma.lookupTable.create({
      data: {
        tenantId: tenant.id,
        name: tableData.name,
        description: tableData.description,
        columns: tableData.columns,
        rows: tableData.rows,
        isStandard: tableData.isStandard,
      },
    });

    console.log(`✅ Created ${tableData.name}`);
  }

  console.log('\n✨ Lookup table seeding complete!');
}

seedLookupTables()
  .catch((error) => {
    console.error('❌ Error seeding lookup tables:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
