/**
 * Test script for Fire Door Pricing Service
 * 
 * Demonstrates how to use the pricing service with imported component data
 * 
 * Usage:
 *   pnpm tsx scripts/test-fire-door-pricing.ts --tenant <tenantId>
 */

import { PrismaClient } from '@prisma/client';
import FireDoorPricingService, { type FireDoorConfig } from '../api/src/services/fire-door-pricing';

const prisma = new PrismaClient();

async function testFireDoorPricing() {
  const args = process.argv.slice(2);
  const tenantIdIndex = args.indexOf('--tenant');
  
  if (tenantIdIndex === -1 || !args[tenantIdIndex + 1]) {
    console.error('❌ Missing --tenant argument');
    console.log('Usage: pnpm tsx scripts/test-fire-door-pricing.ts --tenant <tenantId>');
    process.exit(1);
  }

  const tenantId = args[tenantIdIndex + 1];

  console.log('🔥 Fire Door Pricing Service Test\n');
  console.log(`Tenant ID: ${tenantId}\n`);

  // Example fire door configuration
  const config: FireDoorConfig = {
    // Basic dimensions (mm)
    masterLeafWidth: 826,
    masterLeafHeight: 2040,
    leafThickness: 54,      // FD60 typically 54mm
    leafCount: 1,
    quantity: 1,

    // Fire rating
    fireRating: 'FD60',

    // Core selection (will be looked up from ComponentLookup)
    coreType: 'STREBORD-FD60-54MM',

    // Lipping (will be looked up from Material)
    lippingMaterial: 'OAK-LIPPING-10MM',
    lippingThickness: 10,

    // Facing/finish (will be looked up from Material)
    doorFacing: 'PAINT',

    // Glass/vision panels (optional)
    visionPanelQty1: 1,
    vp1Width: 300,
    vp1Height: 600,
    glassType: 'PYROGUARD-60-44',

    // Frame
    includeFrame: true,
    frameWidth: 926,
    frameHeight: 2140,
    frameMaterial: 'OAK',

    // Ironmongery
    hingeSupplyType: 'Supplied',
    hingeType: 'BUTT-HINGE-100x75-SS',
    hingeQty: 3,
    lockType1: 'SASHLOCK-5-LEVER',
    lockSupplyType1: 'Supplied',
    closerType: 'DOOR-CLOSER-OVERHEAD',
    closerSupplyType: 'Supplied',

    // Additional options
    factoryFitIronmongery: false,
    preMachineForIronmongery: true,
  };

  console.log('📋 Configuration:');
  console.log(`  - Leaf Size: ${config.masterLeafWidth}mm x ${config.masterLeafHeight}mm`);
  console.log(`  - Thickness: ${config.leafThickness}mm`);
  console.log(`  - Fire Rating: ${config.fireRating}`);
  console.log(`  - Core Type: ${config.coreType}`);
  console.log(`  - Lipping: ${config.lippingMaterial}`);
  console.log(`  - Finish: ${config.doorFacing}`);
  console.log(`  - Vision Panels: ${config.visionPanelQty1 || 0}`);
  console.log(`  - Frame: ${config.includeFrame ? 'Yes' : 'No'}`);
  console.log(`  - Quantity: ${config.quantity}\n`);

  try {
    const service = new FireDoorPricingService(prisma, tenantId);
    
    console.log('💰 Calculating price...\n');
    const breakdown = await service.calculatePrice(config, {
      overheadPercent: 15,
      marginPercent: 25,
      shopRatePerHour: 45,
      includeLabour: true,
    });

    console.log('✅ Price Breakdown:\n');
    
    // Materials
    console.log('📦 Materials:');
    if (breakdown.materials.length === 0) {
      console.log('  ⚠️  No materials found - you may need to run the import script first');
      console.log('  Run: pnpm tsx scripts/import-fire-door-pricing.ts --tenant <tenantId>\n');
    } else {
      for (const material of breakdown.materials) {
        console.log(`  - ${material.description}`);
        console.log(`    ${material.quantity.toFixed(2)} ${material.unit} × £${material.unitCost.toFixed(2)} = £${material.totalCost.toFixed(2)}`);
      }
      console.log(`  Total Materials: £${breakdown.materialsCostTotal.toFixed(2)}\n`);
    }

    // Labour
    if (breakdown.labour.length > 0) {
      console.log('👷 Labour:');
      for (const labour of breakdown.labour) {
        console.log(`  - ${labour.operation}: ${labour.minutes} mins @ £${labour.ratePerHour}/hr = £${labour.cost.toFixed(2)}`);
      }
      console.log(`  Total Labour: £${breakdown.labourCostTotal.toFixed(2)}\n`);
    }

    // Summary
    console.log('💵 Summary:');
    console.log(`  Materials Cost:     £${breakdown.materialsCostTotal.toFixed(2)}`);
    console.log(`  Labour Cost:        £${breakdown.labourCostTotal.toFixed(2)}`);
    console.log(`  Subtotal:           £${breakdown.subtotal.toFixed(2)}`);
    console.log(`  Overhead (${breakdown.overheadPercent}%):     £${breakdown.overhead.toFixed(2)}`);
    console.log(`  Pre-Margin Total:   £${breakdown.preMarginTotal.toFixed(2)}`);
    console.log(`  Margin (${breakdown.marginPercent}%):       £${breakdown.margin.toFixed(2)}`);
    console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Final Price:        £${breakdown.finalPrice.toFixed(2)}`);
    console.log(`  Price per Door:     £${breakdown.pricePerDoor.toFixed(2)}\n`);

    // API usage example
    console.log('🔌 API Usage:');
    console.log(`  POST /tenant/fire-door/calculate-price`);
    console.log(`  POST /tenant/fire-door/generate-bom\n`);

    // Component counts
    const componentCounts = breakdown.materials.reduce((acc, m) => {
      acc[m.category] = (acc[m.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Component Summary:');
    for (const [category, count] of Object.entries(componentCounts)) {
      console.log(`  - ${category}: ${count} items`);
    }

  } catch (error: any) {
    console.error('❌ Pricing failed:', error.message);
    console.error('\nMake sure you have:');
    console.error('1. Run the import script: pnpm tsx scripts/import-fire-door-pricing.ts --tenant <tenantId>');
    console.error('2. Verified component codes match your imported data');
    console.error('3. Checked that the tenant ID is correct');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testFireDoorPricing().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
