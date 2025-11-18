import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type MaterialItemCategory = 
  | 'DOOR_BLANK'
  | 'LIPPING'
  | 'TIMBER'
  | 'GLASS'
  | 'IRONMONGERY'
  | 'BOARD'
  | 'VENEER'
  | 'FINISH'
  | 'HARDWARE'
  | 'CONSUMABLE'
  | 'OTHER';

interface MaterialItemSeed {
  code: string;
  name: string;
  description: string;
  cost: number;
  unit: string;
  category: MaterialItemCategory;
  stock?: number;
  leadTimeDays?: number;
  minStockLevel?: number;
}

const MATERIALS: MaterialItemSeed[] = [
  {
    code: 'CORE-FD30-44',
    name: 'FD30 Fire Door Core 44mm',
    description: 'Solid core material for 30-minute fire-rated doors, 44mm thickness',
    cost: 18.0,
    unit: 'm2',
    category: 'DOOR_BLANK',
    stock: 150,
    leadTimeDays: 5,
    minStockLevel: 50,
  },
  {
    code: 'CORE-FD60-54',
    name: 'FD60 Fire Door Core 54mm',
    description: 'Solid core material for 60-minute fire-rated doors, 54mm thickness',
    cost: 27.0,
    unit: 'm2',
    category: 'DOOR_BLANK',
    stock: 100,
    leadTimeDays: 7,
    minStockLevel: 30,
  },
  {
    code: 'LIP-SOFTWOOD',
    name: 'Softwood Lipping',
    description: 'Standard softwood lipping for door edges',
    cost: 3.0,
    unit: 'm',
    category: 'LIPPING',
    stock: 500,
    leadTimeDays: 3,
    minStockLevel: 100,
  },
  {
    code: 'TIMBER-SOFTWOOD',
    name: 'Softwood Timber',
    description: 'Structural softwood for door frames',
    cost: 4.5,
    unit: 'm',
    category: 'TIMBER',
    stock: 400,
    leadTimeDays: 3,
    minStockLevel: 100,
  },
  {
    code: 'GLASS-FR-CLEAR',
    name: 'Fire-Rated Clear Glass',
    description: 'Clear fire-resistant glazing for vision panels',
    cost: 55.0,
    unit: 'm2',
    category: 'GLASS',
    stock: 50,
    leadTimeDays: 14,
    minStockLevel: 10,
  },
  {
    code: 'IRON-PACK-STD-FD',
    name: 'Standard Fire Door Ironmongery Pack',
    description: 'Complete hardware pack including hinges, handle, and closer',
    cost: 85.0,
    unit: 'each',
    category: 'IRONMONGERY',
    stock: 200,
    leadTimeDays: 7,
    minStockLevel: 50,
  },
];

async function main() {
  console.log('🌱 Starting LAJ Joinery materials seed script...\n');

  // Step 1: Find LAJ Joinery tenant
  console.log('📋 Step 1: Finding tenant "laj-joinery"...');
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'laj-joinery' },
  });

  if (!tenant) {
    throw new Error('❌ Tenant "laj-joinery" not found. Please run seedTenantLaj.ts first.');
  }

  console.log(`   ✅ Found tenant: ${tenant.name} (${tenant.id})\n`);

  // Step 2: Upsert material items
  console.log('📦 Step 2: Creating/updating material items...');
  let itemsCreated = 0;
  let itemsUpdated = 0;

  for (const item of MATERIALS) {
    const existing = await (prisma as any).materialItem.findFirst({
      where: {
        tenantId: tenant.id,
        code: item.code,
      },
    });

    const itemData = {
      name: item.name,
      description: item.description,
      cost: item.cost,
      unit: item.unit,
      category: item.category,
      stockQuantity: item.stock,
      leadTimeDays: item.leadTimeDays,
      minStockLevel: item.minStockLevel,
    };

    if (existing) {
      await (prisma as any).materialItem.update({
        where: { id: existing.id },
        data: itemData,
      });
      itemsUpdated++;
      console.log(`   🔄 Updated item: ${item.code} - ${item.name}`);
    } else {
      await (prisma as any).materialItem.create({
        data: {
          tenantId: tenant.id,
          code: item.code,
          ...itemData,
        },
      });
      itemsCreated++;
      console.log(`   ✅ Created item: ${item.code} - ${item.name}`);
    }
  }

  console.log(`   📊 Items: ${itemsCreated} created, ${itemsUpdated} updated\n`);

  // Step 3: Summary with pricing
  console.log('💰 Material Pricing Summary:');
  console.log('   ════════════════════════════════════════════════');
  for (const item of MATERIALS) {
    const priceStr = `£${item.cost.toFixed(2)}/${item.unit}`;
    console.log(`   ${item.code.padEnd(20)} ${priceStr.padEnd(15)} ${item.name}`);
  }
  console.log('   ════════════════════════════════════════════════\n');

  console.log('✅ LAJ Joinery materials seed completed successfully!');
}

main()
  .then(() => {
    console.log('\n🎉 Seed script finished!');
  })
  .catch((e) => {
    console.error('\n❌ Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
