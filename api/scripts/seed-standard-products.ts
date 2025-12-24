/**
 * Seed Standard Products with Parametric Formulas
 * 
 * Creates pre-built product templates that ship with the app:
 * - Fire Doors (FD30, FD60)
 * - Internal Doors (Flush, Panel)
 * - Windows (Casement, Sash)
 * 
 * Each template uses parametric formulas so they auto-adjust
 * when tenant customizes their standard profiles
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface StandardProfile {
  code: string;
  name: string;
  profileType: string;
  dimensions: {
    widthMm: number;
    depthMm: number;
  };
}

interface StandardMaterial {
  code: string;
  name: string;
  color: string;
  category: string;
}

interface ComponentFormula {
  code: string;
  name: string;
  componentType: string;
  positionXFormula: string;
  positionYFormula: string;
  positionZFormula: string;
  widthFormula: string;
  heightFormula: string;
  depthFormula: string;
  bodyProfileCode: string;
  startEndProfileCode?: string;
  endEndProfileCode?: string;
  materialCode: string;
}

interface ProductTemplate {
  type: string;
  name: string;
  description: string;
  components: ComponentFormula[];
  variables: Record<string, number>;
}

// Standard profiles that ship with the app
const STANDARD_PROFILES: StandardProfile[] = [
  {
    code: 'RECT_45X95',
    name: 'Standard Rail/Stile 45×95mm',
    profileType: 'RECTANGULAR',
    dimensions: { widthMm: 45, depthMm: 95 }
  },
  {
    code: 'RECT_35X70',
    name: 'Standard Frame 35×70mm',
    profileType: 'RECTANGULAR',
    dimensions: { widthMm: 35, depthMm: 70 }
  },
  {
    code: 'TENON_10X40',
    name: 'Standard Tenon 10×40mm',
    profileType: 'TENON',
    dimensions: { widthMm: 10, depthMm: 40 }
  },
  {
    code: 'SHOULDER_5X15',
    name: 'Standard Shoulder 5×15mm',
    profileType: 'SHOULDER',
    dimensions: { widthMm: 5, depthMm: 15 }
  },
  {
    code: 'REBATE_12X20',
    name: 'Standard Rebate 12×20mm',
    profileType: 'REBATE',
    dimensions: { widthMm: 12, depthMm: 20 }
  }
];

const STANDARD_MATERIALS: StandardMaterial[] = [
  {
    code: 'OAK_HARDWOOD',
    name: 'European Oak Hardwood',
    color: '#D2B48C',
    category: 'HARDWOOD'
  },
  {
    code: 'ASH_HARDWOOD',
    name: 'European Ash Hardwood',
    color: '#F5DEB3',
    category: 'HARDWOOD'
  },
  {
    code: 'MDF_CORE',
    name: 'Fire Rated MDF Core',
    color: '#8B7355',
    category: 'ENGINEERED'
  },
  {
    code: 'PINE_SOFTWOOD',
    name: 'Redwood Pine Softwood',
    color: '#DEB887',
    category: 'SOFTWOOD'
  }
];

// Standard product templates with parametric formulas
const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    type: 'FIRE_DOOR_FD30',
    name: 'FD30 Fire Door (30 min)',
    description: 'Standard 30-minute fire rated flush door with hardwood lipping',
    variables: {
      frameWidth: 45,
      gap: 2,
      rebate: 12,
      tennonLength: 40,
      topRailHeight: 95,
      bottomRailHeight: 95,
      lockRailHeight: 95,
      stileWidth: 95,
      doorThickness: 54,
      lockRailPosition: 990 // From bottom
    },
    components: [
      {
        code: 'TOP_RAIL',
        name: 'Top Rail',
        componentType: 'RAIL',
        positionXFormula: 'stileWidth',
        positionYFormula: '0',
        positionZFormula: 'product.height - topRailHeight',
        widthFormula: 'product.width - stileWidth * 2 + tennonLength * 2',
        heightFormula: 'topRailHeight',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_45X95',
        startEndProfileCode: 'TENON_10X40',
        endEndProfileCode: 'TENON_10X40',
        materialCode: 'OAK_HARDWOOD'
      },
      {
        code: 'BOTTOM_RAIL',
        name: 'Bottom Rail',
        componentType: 'RAIL',
        positionXFormula: 'stileWidth',
        positionYFormula: '0',
        positionZFormula: '0',
        widthFormula: 'product.width - stileWidth * 2 + tennonLength * 2',
        heightFormula: 'bottomRailHeight',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_45X95',
        startEndProfileCode: 'TENON_10X40',
        endEndProfileCode: 'TENON_10X40',
        materialCode: 'OAK_HARDWOOD'
      },
      {
        code: 'LOCK_RAIL',
        name: 'Lock Rail',
        componentType: 'RAIL',
        positionXFormula: 'stileWidth',
        positionYFormula: '0',
        positionZFormula: 'lockRailPosition',
        widthFormula: 'product.width - stileWidth * 2 + tennonLength * 2',
        heightFormula: 'lockRailHeight',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_45X95',
        startEndProfileCode: 'TENON_10X40',
        endEndProfileCode: 'TENON_10X40',
        materialCode: 'OAK_HARDWOOD'
      },
      {
        code: 'STILE_LEFT',
        name: 'Left Stile',
        componentType: 'STILE',
        positionXFormula: '0',
        positionYFormula: '0',
        positionZFormula: '0',
        widthFormula: 'stileWidth',
        heightFormula: 'product.height',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_45X95',
        materialCode: 'OAK_HARDWOOD'
      },
      {
        code: 'STILE_RIGHT',
        name: 'Right Stile',
        componentType: 'STILE',
        positionXFormula: 'product.width - stileWidth',
        positionYFormula: '0',
        positionZFormula: '0',
        widthFormula: 'stileWidth',
        heightFormula: 'product.height',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_45X95',
        materialCode: 'OAK_HARDWOOD'
      },
      {
        code: 'PANEL_CORE',
        name: 'Fire Core Panel',
        componentType: 'PANEL',
        positionXFormula: 'stileWidth',
        positionYFormula: '0',
        positionZFormula: 'bottomRailHeight',
        widthFormula: 'product.width - stileWidth * 2',
        heightFormula: 'product.height - topRailHeight - bottomRailHeight',
        depthFormula: 'doorThickness - 6',
        bodyProfileCode: 'RECT_45X95',
        materialCode: 'MDF_CORE'
      }
    ]
  },
  {
    type: 'INTERNAL_DOOR_FLUSH',
    name: 'Internal Flush Door',
    description: 'Standard internal flush door with softwood frame',
    variables: {
      frameWidth: 35,
      gap: 2,
      tennonLength: 40,
      topRailHeight: 70,
      bottomRailHeight: 70,
      stileWidth: 70,
      doorThickness: 40
    },
    components: [
      {
        code: 'TOP_RAIL',
        name: 'Top Rail',
        componentType: 'RAIL',
        positionXFormula: 'stileWidth',
        positionYFormula: '0',
        positionZFormula: 'product.height - topRailHeight',
        widthFormula: 'product.width - stileWidth * 2 + tennonLength * 2',
        heightFormula: 'topRailHeight',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_35X70',
        startEndProfileCode: 'TENON_10X40',
        endEndProfileCode: 'TENON_10X40',
        materialCode: 'PINE_SOFTWOOD'
      },
      {
        code: 'BOTTOM_RAIL',
        name: 'Bottom Rail',
        componentType: 'RAIL',
        positionXFormula: 'stileWidth',
        positionYFormula: '0',
        positionZFormula: '0',
        widthFormula: 'product.width - stileWidth * 2 + tennonLength * 2',
        heightFormula: 'bottomRailHeight',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_35X70',
        startEndProfileCode: 'TENON_10X40',
        endEndProfileCode: 'TENON_10X40',
        materialCode: 'PINE_SOFTWOOD'
      },
      {
        code: 'STILE_LEFT',
        name: 'Left Stile',
        componentType: 'STILE',
        positionXFormula: '0',
        positionYFormula: '0',
        positionZFormula: '0',
        widthFormula: 'stileWidth',
        heightFormula: 'product.height',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_35X70',
        materialCode: 'PINE_SOFTWOOD'
      },
      {
        code: 'STILE_RIGHT',
        name: 'Right Stile',
        componentType: 'STILE',
        positionXFormula: 'product.width - stileWidth',
        positionYFormula: '0',
        positionZFormula: '0',
        widthFormula: 'stileWidth',
        heightFormula: 'product.height',
        depthFormula: 'doorThickness',
        bodyProfileCode: 'RECT_35X70',
        materialCode: 'PINE_SOFTWOOD'
      }
    ]
  }
];

async function seedStandardProducts() {
  console.log('🌱 Seeding standard products with parametric formulas...');

  // Get the first tenant (for demo purposes - in production, you'd seed for all tenants)
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('❌ No tenant found - please create a tenant first');
    return;
  }

  console.log(`✓ Using tenant: ${tenant.name} (${tenant.id})`);

  // 1. Seed Standard Profiles
  console.log('\n📐 Creating standard profiles...');
  const profileMap = new Map<string, string>();

  for (const profile of STANDARD_PROFILES) {
    const existing = await prisma.profile.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: profile.code } }
    });

    if (existing) {
      console.log(`  ⏭️  Profile ${profile.code} already exists`);
      profileMap.set(profile.code, existing.id);
      continue;
    }

    const created = await prisma.profile.create({
      data: {
        tenantId: tenant.id,
        code: profile.code,
        name: profile.name,
        profileType: profile.profileType,
        dimensions: profile.dimensions,
        isActive: true
      }
    });

    profileMap.set(profile.code, created.id);
    console.log(`  ✓ Created profile: ${profile.code}`);
  }

  // 2. Seed Standard Materials
  console.log('\n🎨 Creating standard materials...');
  const materialMap = new Map<string, string>();

  for (const material of STANDARD_MATERIALS) {
    const existing = await prisma.material.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: material.code } }
    });

    if (existing) {
      console.log(`  ⏭️  Material ${material.code} already exists`);
      materialMap.set(material.code, existing.id);
      continue;
    }

    const created = await prisma.material.create({
      data: {
        tenantId: tenant.id,
        code: material.code,
        name: material.name,
        // Map string categories to enum MaterialCategory
        category: ((): any => {
          switch (material.category) {
            case 'HARDWOOD':
              return 'TIMBER_HARDWOOD';
            case 'SOFTWOOD':
              return 'TIMBER_SOFTWOOD';
            case 'ENGINEERED':
              return 'BOARD_MDF';
            default:
              return 'TIMBER_SOFTWOOD';
          }
        })(),
        color: material.color,
        isActive: true
      }
    });

    materialMap.set(material.code, created.id);
    console.log(`  ✓ Created material: ${material.code}`);
  }

  // 3. Seed Product Templates
  console.log('\n📦 Creating product templates...');

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: tenant.id }
  });

  const beta = (settings?.beta || {}) as Record<string, any>;
  const existingTemplates = (beta.productTemplates || []) as any[];

  for (const template of PRODUCT_TEMPLATES) {
    // Check if template already exists
    if (existingTemplates.some((t: any) => t.type === template.type)) {
      console.log(`  ⏭️  Template ${template.type} already exists`);
      continue;
    }

    // Resolve profile and material IDs
    const componentsWithIds = template.components.map(comp => ({
      ...comp,
      bodyProfileId: profileMap.get(comp.bodyProfileCode),
      startEndProfileId: comp.startEndProfileCode ? profileMap.get(comp.startEndProfileCode) : undefined,
      endEndProfileId: comp.endEndProfileCode ? profileMap.get(comp.endEndProfileCode) : undefined,
      materialId: materialMap.get(comp.materialCode)
    }));

    existingTemplates.push({
      id: `template_${template.type}_${Date.now()}`,
      type: template.type,
      name: template.name,
      description: template.description,
      components: componentsWithIds,
      variables: template.variables,
      createdAt: new Date().toISOString()
    });

    console.log(`  ✓ Created template: ${template.type} with ${template.components.length} components`);
  }

  // Save templates back to settings
  await prisma.tenantSettings.update({
    where: { tenantId: tenant.id },
    data: {
      beta: {
        ...beta,
        productTemplates: existingTemplates
      }
    }
  });

  console.log('\n✅ Standard products seeded successfully!');
  console.log(`\nSummary:`);
  console.log(`  • ${STANDARD_PROFILES.length} profiles`);
  console.log(`  • ${STANDARD_MATERIALS.length} materials`);
  console.log(`  • ${PRODUCT_TEMPLATES.length} product templates`);
}

// Run the seed
seedStandardProducts()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
