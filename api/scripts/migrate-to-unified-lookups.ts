/**
 * Migration Script: Consolidate MaterialItems, IronmongeryItems into unified LookupTables
 * 
 * This script:
 * 1. Creates lookup tables for each material/ironmongery category
 * 2. Migrates MaterialItems to LookupTableRow with 3D/texture data
 * 3. Migrates IronmongeryItems to LookupTableRow with pricing data
 * 4. Preserves all metadata (supplier, pricing, 3D properties, etc.)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting migration to unified lookup tables...\n');

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true }
  });

  for (const tenant of tenants) {
    console.log(`\n📦 Processing tenant: ${tenant.name} (${tenant.id})`);
    
    await migrateMaterialItems(tenant.id);
    await migrateIronmongeryItems(tenant.id);
  }

  console.log('\n✅ Migration complete!');
}

async function migrateMaterialItems(tenantId: string) {
  console.log('  📋 Migrating MaterialItems...');
  
  const materialItems = await prisma.materialItem.findMany({
    where: { tenantId },
    include: { supplier: true }
  });

  if (materialItems.length === 0) {
    console.log('     No MaterialItems found');
    return;
  }

  // Group by category
  const categoriesSet = new Set(materialItems.map(m => m.category));
  const categories = Array.from(categoriesSet);
  
  for (const category of categories) {
    const tableName = getCategoryTableName(category);
    
    // Create or get lookup table
    const lookupTable = await prisma.lookupTable.upsert({
      where: {
        tenantId_tableName: {
          tenantId,
          tableName
        }
      },
      create: {
        tenantId,
        tableName,
        category: 'material',
        description: `${category} materials`,
        isStandard: false
      },
      update: {}
    });

    // Migrate items in this category
    const categoryItems = materialItems.filter(m => m.category === category);
    
    for (const item of categoryItems) {
      await prisma.lookupTableRow.upsert({
        where: {
          lookupTableId_value: {
            lookupTableId: lookupTable.id,
            value: item.code
          }
        },
        create: {
          lookupTableId: lookupTable.id,
          value: item.code,
          label: item.name,
          description: item.description,
          code: item.code,
          
          // Pricing
          costPerUnit: item.cost,
          unitType: item.unit,
          currency: item.currency,
          
          // Supplier/BOM
          supplierId: item.supplierId,
          leadTimeDays: item.leadTimeDays,
          
          // 3D/Visual (extract from customProps if exists)
          texture: extractTexture(item),
          materialType: getMaterialType(category),
          
          // Stock
          customProps: {
            stockQuantity: item.stockQuantity?.toString(),
            minStockLevel: item.minStockLevel?.toString(),
            notes: item.notes
          },
          
          isActive: item.isActive,
          sortOrder: 0
        },
        update: {
          label: item.name,
          description: item.description,
          costPerUnit: item.cost,
          unitType: item.unit,
          isActive: item.isActive
        }
      });
    }
    
    console.log(`     ✓ Migrated ${categoryItems.length} ${category} items to ${tableName}`);
  }
}

async function migrateIronmongeryItems(tenantId: string) {
  console.log('  🔧 Migrating IronmongeryItems...');
  
  const ironmongeryItems = await prisma.ironmongeryItem.findMany({
    where: { tenantId }
  });

  if (ironmongeryItems.length === 0) {
    console.log('     No IronmongeryItems found');
    return;
  }

  // Group by category
  const categoriesSet = new Set(ironmongeryItems.map(i => i.category));
  const categories = Array.from(categoriesSet);
  
  for (const category of categories) {
    const tableName = getIronmongeryTableName(category);
    
    // Create or get lookup table
    const lookupTable = await prisma.lookupTable.upsert({
      where: {
        tenantId_tableName: {
          tenantId,
          tableName
        }
      },
      create: {
        tenantId,
        tableName,
        category: 'ironmongery',
        description: `${category} ironmongery`,
        isStandard: false
      },
      update: {}
    });

    // Migrate items in this category
    const categoryItems = ironmongeryItems.filter(i => i.category === category);
    
    for (const item of categoryItems) {
      await prisma.lookupTableRow.upsert({
        where: {
          lookupTableId_value: {
            lookupTableId: lookupTable.id,
            value: item.code
          }
        },
        create: {
          lookupTableId: lookupTable.id,
          value: item.code,
          label: item.name,
          description: item.description,
          code: item.code,
          
          // Pricing
          costPerUnit: item.unitCost,
          unitType: 'each',
          currency: item.currency,
          
          // Supplier/BOM
          supplierCode: item.supplier,
          leadTimeDays: item.leadTimeDays,
          
          // Technical
          fireRated: item.fireRated,
          grade: item.grade,
          finish: item.finish,
          
          // Material type
          materialType: item.material,
          
          // Visual
          imageUrl: item.imageUrl,
          
          // Extended properties
          customProps: {
            notes: item.notes
          },
          
          isActive: item.isActive,
          sortOrder: 0
        },
        update: {
          label: item.name,
          description: item.description,
          costPerUnit: item.unitCost,
          isActive: item.isActive
        }
      });
    }
    
    console.log(`     ✓ Migrated ${categoryItems.length} ${category} items to ${tableName}`);
  }
}

function getCategoryTableName(category: string): string {
  const map: Record<string, string> = {
    'TIMBER': 'Timber',
    'VENEER': 'Veneer',
    'SHEET': 'Sheet Material',
    'ADHESIVE': 'Adhesives',
    'FINISH': 'Finishes',
    'HARDWARE': 'Hardware',
    'CORE': 'Door Cores',
    'EDGE_BANDING': 'Edge Banding',
    'GLAZING': 'Glazing',
    'OTHER': 'Other Materials'
  };
  return map[category] || category;
}

function getIronmongeryTableName(category: string): string {
  const map: Record<string, string> = {
    'HINGE': 'Hinges',
    'LOCK': 'Locks',
    'HANDLE': 'Handles',
    'CLOSER': 'Door Closers',
    'SEAL': 'Seals',
    'LETTER_PLATE': 'Letter Plates',
    'VIEWER': 'Door Viewers',
    'BOLT': 'Bolts',
    'CYLINDER': 'Cylinders',
    'PLATE': 'Plates',
    'OTHER': 'Other Ironmongery'
  };
  return map[category] || category;
}

function extractTexture(item: any): string | null {
  // Look for texture in various possible locations
  if (item.texture) return item.texture;
  if (item.imageUrl) return item.imageUrl;
  
  // Check if there's a pattern in the code or name
  const name = item.name.toLowerCase();
  if (name.includes('oak')) return 'wood_oak';
  if (name.includes('walnut')) return 'wood_walnut';
  if (name.includes('ash')) return 'wood_ash';
  if (name.includes('maple')) return 'wood_maple';
  if (name.includes('pine')) return 'wood_pine';
  if (name.includes('mdf')) return 'wood_mdf';
  if (name.includes('ply')) return 'wood_plywood';
  
  return null;
}

function getMaterialType(category: string): string {
  if (category.includes('TIMBER') || category.includes('VENEER')) return 'wood';
  if (category.includes('SHEET')) return 'composite';
  if (category.includes('GLAZING')) return 'glass';
  if (category.includes('HARDWARE')) return 'metal';
  return 'other';
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
