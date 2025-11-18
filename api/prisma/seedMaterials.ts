#!/usr/bin/env ts-node
/**
 * Seed MaterialItem pricing data for dev tenant
 * 
 * Creates realistic material items for fire door manufacturing:
 * - Door cores (FD30/FD60)
 * - Lipping materials
 * - Timber for frames
 * - Fire-rated glass
 * - Ironmongery
 * - Finishes
 * 
 * Run with: npx ts-node prisma/seedMaterials.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type MaterialItemCategory = 
  | 'DOOR_BLANK'
  | 'LIPPING'
  | 'IRONMONGERY'
  | 'GLASS'
  | 'TIMBER'
  | 'BOARD'
  | 'VENEER'
  | 'FINISH'
  | 'HARDWARE'
  | 'CONSUMABLE'
  | 'OTHER';

interface MaterialItemSeed {
  code: string;
  name: string;
  category: MaterialItemCategory;
  description: string;
  cost: number;
  unit: string;
  stockQuantity?: number;
  minStockLevel?: number;
  leadTimeDays?: number;
}

const MATERIALS: MaterialItemSeed[] = [
  // Door Blanks & Cores
  {
    code: 'CORE-FD30-SW',
    name: 'FD30 Softwood Core',
    category: 'DOOR_BLANK',
    description: '30-minute fire-rated softwood door core, suitable for standard fire door applications',
    cost: 45.00,
    unit: 'm2',
    stockQuantity: 50,
    minStockLevel: 20,
    leadTimeDays: 7,
  },
  {
    code: 'CORE-FD60-SW',
    name: 'FD60 Softwood Core',
    category: 'DOOR_BLANK',
    description: '60-minute fire-rated softwood door core, enhanced fire resistance',
    cost: 65.00,
    unit: 'm2',
    stockQuantity: 30,
    minStockLevel: 15,
    leadTimeDays: 7,
  },
  {
    code: 'CORE-FD30-HW',
    name: 'FD30 Hardwood Core',
    category: 'DOOR_BLANK',
    description: '30-minute fire-rated hardwood door core, premium quality',
    cost: 85.00,
    unit: 'm2',
    stockQuantity: 20,
    minStockLevel: 10,
    leadTimeDays: 10,
  },
  {
    code: 'CORE-FD60-HW',
    name: 'FD60 Hardwood Core',
    category: 'DOOR_BLANK',
    description: '60-minute fire-rated hardwood door core, maximum fire protection',
    cost: 120.00,
    unit: 'm2',
    stockQuantity: 15,
    minStockLevel: 8,
    leadTimeDays: 14,
  },

  // Lipping Materials
  {
    code: 'LIP-FD30-SW',
    name: 'FD30/60 Softwood Lipping',
    category: 'LIPPING',
    description: 'Fire-rated softwood lipping for door edge protection, 44mm width',
    cost: 8.50,
    unit: 'm',
    stockQuantity: 200,
    minStockLevel: 50,
    leadTimeDays: 5,
  },
  {
    code: 'LIP-FD30-HW-OAK',
    name: 'FD30/60 Oak Lipping',
    category: 'LIPPING',
    description: 'Fire-rated oak lipping for premium finish, 44mm width',
    cost: 15.00,
    unit: 'm',
    stockQuantity: 100,
    minStockLevel: 30,
    leadTimeDays: 7,
  },
  {
    code: 'LIP-FD30-HW-SAPELE',
    name: 'FD30/60 Sapele Lipping',
    category: 'LIPPING',
    description: 'Fire-rated sapele lipping for premium finish, 44mm width',
    cost: 12.00,
    unit: 'm',
    stockQuantity: 80,
    minStockLevel: 25,
    leadTimeDays: 7,
  },

  // Timber (for frames and structural elements)
  {
    code: 'TIM-SW-FRAME',
    name: 'Softwood Frame Timber',
    category: 'TIMBER',
    description: 'Planed softwood timber for door frames, 100x44mm',
    cost: 6.50,
    unit: 'm',
    stockQuantity: 300,
    minStockLevel: 100,
    leadTimeDays: 3,
  },
  {
    code: 'TIM-HW-OAK-FRAME',
    name: 'Oak Frame Timber',
    category: 'TIMBER',
    description: 'Planed oak timber for premium door frames, 100x44mm',
    cost: 18.00,
    unit: 'm',
    stockQuantity: 100,
    minStockLevel: 40,
    leadTimeDays: 7,
  },
  {
    code: 'TIM-HW-SAPELE-FRAME',
    name: 'Sapele Frame Timber',
    category: 'TIMBER',
    description: 'Planed sapele timber for premium door frames, 100x44mm',
    cost: 14.50,
    unit: 'm',
    stockQuantity: 80,
    minStockLevel: 30,
    leadTimeDays: 7,
  },

  // Glass
  {
    code: 'GLASS-FD30-STD',
    name: 'FD30 Fire-Rated Glass',
    category: 'GLASS',
    description: '30-minute fire-rated vision panel glass, 7mm wired polished plate',
    cost: 95.00,
    unit: 'm2',
    stockQuantity: 10,
    minStockLevel: 5,
    leadTimeDays: 14,
  },
  {
    code: 'GLASS-FD60-STD',
    name: 'FD60 Fire-Rated Glass',
    category: 'GLASS',
    description: '60-minute fire-rated vision panel glass, intumescent system',
    cost: 165.00,
    unit: 'm2',
    stockQuantity: 8,
    minStockLevel: 4,
    leadTimeDays: 21,
  },
  {
    code: 'GLASS-BEAD',
    name: 'Glass Glazing Beads',
    category: 'GLASS',
    description: 'Fire-rated glazing beads for securing glass panels',
    cost: 4.50,
    unit: 'm',
    stockQuantity: 150,
    minStockLevel: 50,
    leadTimeDays: 5,
  },

  // Ironmongery
  {
    code: 'IRON-PACK-FD30',
    name: 'FD30 Ironmongery Pack',
    category: 'IRONMONGERY',
    description: 'Complete ironmongery set for FD30 door: hinges (3x), latch, handles, closer',
    cost: 145.00,
    unit: 'each',
    stockQuantity: 25,
    minStockLevel: 10,
    leadTimeDays: 7,
  },
  {
    code: 'IRON-PACK-FD60',
    name: 'FD60 Ironmongery Pack',
    category: 'IRONMONGERY',
    description: 'Complete ironmongery set for FD60 door: heavy-duty hinges (3x), latch, handles, closer',
    cost: 195.00,
    unit: 'each',
    stockQuantity: 20,
    minStockLevel: 8,
    leadTimeDays: 10,
  },
  {
    code: 'IRON-HINGE-FD',
    name: 'Fire Door Hinge (single)',
    category: 'IRONMONGERY',
    description: 'CE marked fire door hinge, 100mm, stainless steel',
    cost: 12.50,
    unit: 'each',
    stockQuantity: 100,
    minStockLevel: 30,
    leadTimeDays: 5,
  },
  {
    code: 'IRON-CLOSER-OVHD',
    name: 'Overhead Door Closer',
    category: 'IRONMONGERY',
    description: 'CE marked overhead door closer for fire doors',
    cost: 55.00,
    unit: 'each',
    stockQuantity: 30,
    minStockLevel: 10,
    leadTimeDays: 7,
  },
  {
    code: 'IRON-SEAL-INTUM',
    name: 'Intumescent Seal',
    category: 'IRONMONGERY',
    description: 'Fire/smoke seal for door edge, 15x4mm',
    cost: 3.50,
    unit: 'm',
    stockQuantity: 200,
    minStockLevel: 80,
    leadTimeDays: 3,
  },

  // Finishes
  {
    code: 'FIN-PRIMER-FD',
    name: 'Fire Door Primer',
    category: 'FINISH',
    description: 'Fire-rated primer for door preparation, 5L',
    cost: 28.00,
    unit: 'each',
    stockQuantity: 20,
    minStockLevel: 10,
    leadTimeDays: 5,
  },
  {
    code: 'FIN-TOPCOAT-WHITE',
    name: 'White Topcoat (Fire-Rated)',
    category: 'FINISH',
    description: 'Fire-rated white topcoat paint, 5L',
    cost: 35.00,
    unit: 'each',
    stockQuantity: 25,
    minStockLevel: 12,
    leadTimeDays: 5,
  },
  {
    code: 'FIN-STAIN-CLEAR',
    name: 'Clear Fire-Rated Stain',
    category: 'FINISH',
    description: 'Fire-rated clear wood stain/varnish, 2.5L',
    cost: 42.00,
    unit: 'each',
    stockQuantity: 15,
    minStockLevel: 8,
    leadTimeDays: 7,
  },
  {
    code: 'FIN-STAIN-OAK',
    name: 'Oak Fire-Rated Stain',
    category: 'FINISH',
    description: 'Fire-rated oak-colored wood stain, 2.5L',
    cost: 45.00,
    unit: 'each',
    stockQuantity: 12,
    minStockLevel: 6,
    leadTimeDays: 7,
  },

  // Board Materials
  {
    code: 'BRD-MDF-FR',
    name: 'Fire-Rated MDF Board',
    category: 'BOARD',
    description: 'Fire-rated MDF sheet for door facings, 2440x1220x6mm',
    cost: 38.00,
    unit: 'each',
    stockQuantity: 40,
    minStockLevel: 20,
    leadTimeDays: 5,
  },
  {
    code: 'BRD-PLY-FR',
    name: 'Fire-Rated Plywood',
    category: 'BOARD',
    description: 'Fire-rated plywood sheet, 2440x1220x9mm',
    cost: 52.00,
    unit: 'each',
    stockQuantity: 30,
    minStockLevel: 15,
    leadTimeDays: 7,
  },

  // Veneer
  {
    code: 'VEN-OAK-CROWN',
    name: 'Crown Cut Oak Veneer',
    category: 'VENEER',
    description: 'Natural oak veneer, crown cut, 0.6mm thickness',
    cost: 85.00,
    unit: 'm2',
    stockQuantity: 20,
    minStockLevel: 10,
    leadTimeDays: 14,
  },
  {
    code: 'VEN-SAPELE',
    name: 'Sapele Veneer',
    category: 'VENEER',
    description: 'Natural sapele veneer, 0.6mm thickness',
    cost: 72.00,
    unit: 'm2',
    stockQuantity: 15,
    minStockLevel: 8,
    leadTimeDays: 14,
  },

  // Hardware & Consumables
  {
    code: 'HW-SCREW-FD',
    name: 'Fire Door Screws (box)',
    category: 'HARDWARE',
    description: 'Box of 200 fire-rated screws, 4x40mm',
    cost: 8.50,
    unit: 'each',
    stockQuantity: 50,
    minStockLevel: 20,
    leadTimeDays: 3,
  },
  {
    code: 'CONS-GLUE-PVA',
    name: 'D4 PVA Adhesive',
    category: 'CONSUMABLE',
    description: 'D4 water-resistant PVA adhesive, 5L',
    cost: 22.00,
    unit: 'each',
    stockQuantity: 15,
    minStockLevel: 8,
    leadTimeDays: 3,
  },
  {
    code: 'CONS-ABRASIVE',
    name: 'Assorted Abrasive Pack',
    category: 'CONSUMABLE',
    description: 'Mixed grit sandpaper pack for door finishing',
    cost: 15.00,
    unit: 'each',
    stockQuantity: 30,
    minStockLevel: 15,
    leadTimeDays: 3,
  },
];

async function main() {
  console.log('🌱 Starting MaterialItem seed script...\n');

  // 1. Find or create the LAJ Joinery tenant
  console.log('📋 Step 1: Finding/creating tenant "laj-joinery"...');
  let tenant = await prisma.tenant.findUnique({
    where: { slug: 'laj-joinery' },
  });

  if (!tenant) {
    console.log('   ➕ Creating tenant "laj-joinery"...');
    tenant = await prisma.tenant.create({
      data: {
        name: 'LAJ Joinery',
        slug: 'laj-joinery',
      },
    });
    console.log(`   ✅ Created tenant: ${tenant.name} (${tenant.id})`);
  } else {
    console.log(`   ✅ Found existing tenant: ${tenant.name} (${tenant.id})`);
  }

  // 2. Flag tenant as fire door manufacturer in TenantSettings
  console.log('\n🔥 Step 2: Setting fire door manufacturer flag...');
  const existingSettings = await (prisma as any).tenantSettings.findUnique({
    where: { tenantId: tenant.id },
  });

  if (existingSettings) {
    await (prisma as any).tenantSettings.update({
      where: { tenantId: tenant.id },
      data: { isFireDoorManufacturer: true },
    });
    console.log('   ✅ Updated tenant settings: isFireDoorManufacturer = true');
  } else {
    await (prisma as any).tenantSettings.create({
      data: {
        tenantId: tenant.id,
        slug: 'laj-joinery',
        brandName: 'LAJ Joinery',
        isFireDoorManufacturer: true,
      },
    });
    console.log('   ✅ Created tenant settings with isFireDoorManufacturer = true');
  }

  // 3. Seed material items
  console.log('\n📦 Step 3: Creating/updating material items...');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const material of MATERIALS) {
    try {
      const existing = await (prisma as any).materialItem.findUnique({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: material.code,
          },
        },
      });

      if (existing) {
        // Update existing item
        await (prisma as any).materialItem.update({
          where: { id: existing.id },
          data: {
            name: material.name,
            category: material.category,
            description: material.description,
            cost: material.cost,
            unit: material.unit,
            stockQuantity: material.stockQuantity ?? existing.stockQuantity,
            minStockLevel: material.minStockLevel ?? existing.minStockLevel,
            leadTimeDays: material.leadTimeDays ?? existing.leadTimeDays,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        updated++;
        console.log(`   🔄 Updated: ${material.code} - ${material.name}`);
      } else {
        // Create new item
        await (prisma as any).materialItem.create({
          data: {
            tenantId: tenant.id,
            code: material.code,
            name: material.name,
            category: material.category,
            description: material.description,
            cost: material.cost,
            currency: 'GBP',
            unit: material.unit,
            stockQuantity: material.stockQuantity ?? 0,
            minStockLevel: material.minStockLevel,
            leadTimeDays: material.leadTimeDays,
            isActive: true,
          },
        });
        created++;
        console.log(`   ✅ Created: ${material.code} - ${material.name}`);
      }
    } catch (error: any) {
      skipped++;
      console.error(`   ❌ Error processing ${material.code}: ${error.message}`);
    }
  }

  // 4. Summary
  console.log('\n📊 Summary:');
  console.log(`   ✅ Created: ${created} items`);
  console.log(`   🔄 Updated: ${updated} items`);
  console.log(`   ❌ Skipped: ${skipped} items`);
  console.log(`   📦 Total materials in catalog: ${created + updated}`);

  // 5. Show category breakdown
  console.log('\n📂 Category Breakdown:');
  const categories = await (prisma as any).materialItem.groupBy({
    by: ['category'],
    where: { tenantId: tenant.id, isActive: true },
    _count: { category: true },
  });

  for (const cat of categories) {
    console.log(`   ${cat.category}: ${cat._count.category} items`);
  }

  // 6. Show some example costs
  console.log('\n💰 Sample Pricing:');
  const samples = await (prisma as any).materialItem.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      code: { in: ['CORE-FD30-SW', 'LIP-FD30-SW', 'GLASS-FD30-STD', 'IRON-PACK-FD30', 'FIN-TOPCOAT-WHITE'] },
    },
    select: { code: true, name: true, cost: true, unit: true },
  });

  for (const item of samples) {
    console.log(`   ${item.code}: £${item.cost.toFixed(2)}/${item.unit}`);
  }

  console.log('\n✅ Seed script completed successfully!\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Seed script failed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
