/**
 * Seed standard component definitions for fire door BOM generation
 * Run with: DATABASE_URL="..." pnpm tsx scripts/seed-fire-door-components.ts <tenantId>
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/prisma';

async function seedComponentDefinitions(tenantId: string) {
  console.log('[seed] Seeding component definitions for tenant:', tenantId);

  // Delete existing component definitions for this tenant
  const deleted = await prisma.componentDefinition.deleteMany({
    where: { tenantId },
  });
  console.log(`[seed] Deleted ${deleted.count} existing component definitions\n`);

  const definitions = [];

  // 1. DOOR BLANK - Main door core
  definitions.push(
    await prisma.componentDefinition.create({
      data: {
        tenantId,
        name: 'Door Blank',
        description: 'Main door core with specified dimensions and material',
        category: 'MANUFACTURED',
        isActive: true,
        propertyMappings: {
          width: { source: 'field', field: 'masterWidth', type: 'number' },
          height: { source: 'field', field: 'doorHeight', type: 'number' },
          thickness: { source: 'field', field: 'thickness', type: 'number', default: 44 },
          coreType: { source: 'field', field: 'core', type: 'string' },
          rating: { source: 'field', field: 'rating', type: 'string' },
          material: {
            source: 'lookup',
            lookupTable: 'DoorCorePrices',
            matchFields: { Core: '${coreType}', Rating: '${rating}' },
            returnField: 'Material',
          },
          unitCost: {
            source: 'lookup',
            lookupTable: 'DoorCorePrices',
            matchFields: { Core: '${coreType}', Rating: '${rating}' },
            returnField: 'Price',
          },
        },
        creationRules: {
          conditions: [{ field: 'doorsetType', operator: 'in', values: ['Doorset', 'Leaf Only'] }],
          quantity: { source: 'constant', value: 1 },
        },
        preview3DTemplate: {
          type: 'box',
          dimensions: ['${width}', '${height}', '${thickness}'],
          position: [0, 0, 0],
          material: '${material}',
        },
      },
    })
  );
  console.log('[seed] ✅ Door Blank');

  // 2. FRAME JAMB - Vertical frame pieces (x2)
  definitions.push(
    await prisma.componentDefinition.create({
      data: {
        tenantId,
        name: 'Frame Jamb',
        description: 'Vertical door frame component (2 required per frame)',
        category: 'MANUFACTURED',
        isActive: true,
        propertyMappings: {
          length: { source: 'field', field: 'oFHeight', type: 'number' },
          width: { source: 'constant', value: 115 },
          thickness: { source: 'field', field: 'frameThickness', type: 'number', default: 32 },
          material: { source: 'field', field: 'frameMaterial', type: 'string', default: 'Redwood' },
          profile: { source: 'field', field: 'frameProfile', type: 'string' },
        },
        creationRules: {
          conditions: [{ field: 'doorsetType', operator: 'in', values: ['Doorset', 'Frame Only'] }],
          quantity: { source: 'constant', value: 2 },
        },
        preview3DTemplate: {
          type: 'box',
          dimensions: ['${width}', '${length}', '${thickness}'],
          position: [0, 0, 0],
          material: '${material}',
        },
      },
    })
  );
  console.log('[seed] ✅ Frame Jamb');

  // 3. FRAME HEAD - Horizontal top frame
  definitions.push(
    await prisma.componentDefinition.create({
      data: {
        tenantId,
        name: 'Frame Head',
        description: 'Horizontal top door frame component',
        category: 'MANUFACTURED',
        isActive: true,
        propertyMappings: {
          length: { source: 'field', field: 'oFWidth', type: 'number' },
          width: { source: 'constant', value: 115 },
          thickness: { source: 'field', field: 'frameThickness', type: 'number', default: 32 },
          material: { source: 'field', field: 'frameMaterial', type: 'string', default: 'Redwood' },
          profile: { source: 'field', field: 'frameProfile', type: 'string' },
        },
        creationRules: {
          conditions: [{ field: 'doorsetType', operator: 'in', values: ['Doorset', 'Frame Only'] }],
          quantity: { source: 'constant', value: 1 },
        },
        preview3DTemplate: {
          type: 'box',
          dimensions: ['${length}', '${width}', '${thickness}'],
          position: [0, 0, 0],
          material: '${material}',
        },
      },
    })
  );
  console.log('[seed] ✅ Frame Head');

  // 4. HINGES - From ironmongery pricing
  definitions.push(
    await prisma.componentDefinition.create({
      data: {
        tenantId,
        name: 'Hinges',
        description: 'Door hinges from ironmongery specification',
        category: 'PURCHASED',
        isActive: true,
        propertyMappings: {
          type: { source: 'field', field: 'hingeType', type: 'string' },
          finish: { source: 'field', field: 'hingeFinish', type: 'string' },
          size: { source: 'field', field: 'hingeSize', type: 'string', default: '4 inch' },
          unitCost: {
            source: 'lookup',
            lookupTable: 'IronmongeryPrices',
            matchFields: { Item: '${type}' },
            returnField: 'UnitPrice',
          },
        },
        creationRules: {
          conditions: [{ field: 'hingeType', operator: '!=', values: [null, ''] }],
          quantity: { source: 'field', field: 'qtyOfHinges', default: 3 },
        },
      },
    })
  );
  console.log('[seed] ✅ Hinges');

  // 5. VISION PANEL GLASS
  definitions.push(
    await prisma.componentDefinition.create({
      data: {
        tenantId,
        name: 'Vision Panel Glass',
        description: 'Glass for vision panel cutout',
        category: 'PURCHASED',
        isActive: true,
        propertyMappings: {
          width: { source: 'field', field: 'vp1WidthLeaf1', type: 'number' },
          height: { source: 'field', field: 'vp1HeightLeaf1', type: 'number' },
          glassType: { source: 'field', field: 'glassType', type: 'string' },
          beadType: { source: 'field', field: 'beadType', type: 'string' },
          area: { source: 'calculated', formula: '(${width} * ${height}) / 1000000' },
          pricePerM2: {
            source: 'lookup',
            lookupTable: 'GlassPrices',
            matchFields: { Type: '${glassType}' },
            returnField: 'PricePerM2',
          },
          unitCost: { source: 'calculated', formula: '${pricePerM2} * ${area}' },
        },
        creationRules: {
          conditions: [
            { field: 'visionQtyLeaf1', operator: '>', values: [0] },
            { field: 'vp1WidthLeaf1', operator: '>', values: [0] },
          ],
          quantity: { source: 'field', field: 'visionQtyLeaf1', default: 1 },
        },
      },
    })
  );
  console.log('[seed] ✅ Vision Panel Glass');

  console.log(`\n[seed] ✨ Created ${definitions.length} component definitions`);
  return definitions;
}

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Usage: DATABASE_URL="..." pnpm tsx scripts/seed-fire-door-components.ts <tenantId>');
    console.error('Example: DATABASE_URL="..." pnpm tsx scripts/seed-fire-door-components.ts cmi58fkzm0000it43i4h78pej');
    process.exit(1);
  }

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    console.error(`❌ Tenant not found: ${tenantId}`);
    process.exit(1);
  }

  console.log(`\n🔧 Seeding fire door components for: ${tenant.name} (${tenantId})\n`);

  await seedComponentDefinitions(tenantId);

  console.log('\n✅ Done!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
