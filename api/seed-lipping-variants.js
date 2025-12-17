const { PrismaClient } = require('@prisma/client');

async function seedLippingVariantSystem() {
  const prisma = new PrismaClient();
  try {
    console.log('🌱 Seeding lipping variant system...\n');
    
    // Get a tenant (use the first one for demo)
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      throw new Error('No tenant found');
    }
    console.log(`📍 Using tenant: ${tenant.name} (${tenant.id})\n`);

    // 1. Create base LIPPING component (if doesn't exist)
    let lippingComponent = await prisma.componentLookup.findFirst({
      where: {
        tenantId: tenant.id,
        code: 'LIPPING-BASE'
      }
    });

    if (!lippingComponent) {
      lippingComponent = await prisma.componentLookup.create({
        data: {
          tenantId: tenant.id,
          code: 'LIPPING-BASE',
          name: 'Lipping (Base Component)',
          componentType: 'LIPPING',
          productTypes: ['FIRE_DOOR', 'FIRE_DOOR_SET'],
          unitOfMeasure: 'M',
          basePrice: 15.00, // Base price per meter
          leadTimeDays: 5,
          isActive: true,
          description: 'Edging lipping - base component with variants for different timber types and dimensions'
        }
      });
      console.log('✅ Created base lipping component');
    } else {
      console.log('ℹ️  Base lipping component already exists');
    }

    // 2. Create ComponentAttribute for Timber Type
    const timberAttribute = await prisma.componentAttribute.upsert({
      where: {
        tenantId_componentType_attributeName: {
          tenantId: tenant.id,
          componentType: 'LIPPING',
          attributeName: 'Timber'
        }
      },
      create: {
        tenantId: tenant.id,
        componentType: 'LIPPING',
        attributeName: 'Timber',
        attributeType: 'SELECT',
        displayOrder: 1,
        isRequired: true,
        affectsPrice: true,
        affectsBOM: true,
        options: JSON.stringify([
          { value: 'OAK', label: 'Oak', priceModifier: 0, metadata: { density: 0.75 } },
          { value: 'SAPELE', label: 'Sapele', priceModifier: 2.50, metadata: { density: 0.62 } },
          { value: 'WALNUT', label: 'Walnut', priceModifier: 8.00, metadata: { density: 0.64 } },
          { value: 'ASH', label: 'Ash', priceModifier: 1.50, metadata: { density: 0.68 } },
          { value: 'MAPLE', label: 'Maple', priceModifier: 3.00, metadata: { density: 0.63 } }
        ])
      },
      update: {}
    });
    console.log('✅ Created Timber attribute for LIPPING\n');

    // 3. Create ComponentAttribute for Thickness (linked to door type)
    const thicknessAttribute = await prisma.componentAttribute.upsert({
      where: {
        tenantId_componentType_attributeName: {
          tenantId: tenant.id,
          componentType: 'LIPPING',
          attributeName: 'Thickness'
        }
      },
      create: {
        tenantId: tenant.id,
        componentType: 'LIPPING',
        attributeName: 'Thickness',
        attributeType: 'SELECT',
        displayOrder: 2,
        isRequired: true,
        affectsPrice: false, // Thickness from door type doesn't affect price
        affectsBOM: true,
        options: JSON.stringify([
          { value: '10', label: '10mm', metadata: { doorTypes: ['STANDARD'] } },
          { value: '12', label: '12mm', metadata: { doorTypes: ['FD30'] } },
          { value: '15', label: '15mm', metadata: { doorTypes: ['FD60', 'FD90'] } },
          { value: '18', label: '18mm', metadata: { doorTypes: ['HEAVY_DUTY'] } }
        ])
      },
      update: {}
    });
    console.log('✅ Created Thickness attribute for LIPPING\n');

    // 4. Create ComponentAttribute for Width (calculated from blank)
    const widthAttribute = await prisma.componentAttribute.upsert({
      where: {
        tenantId_componentType_attributeName: {
          tenantId: tenant.id,
          componentType: 'LIPPING',
          attributeName: 'Width'
        }
      },
      create: {
        tenantId: tenant.id,
        componentType: 'LIPPING',
        attributeName: 'Width',
        attributeType: 'CALCULATED',
        displayOrder: 3,
        isRequired: true,
        affectsPrice: false,
        affectsBOM: true,
        calculationFormula: 'blankThickness',
        calculationUnit: 'mm',
        metadata: JSON.stringify({
          description: 'Width of lipping equals thickness of door blank'
        })
      },
      update: {}
    });
    console.log('✅ Created Width attribute (calculated from blank thickness)\n');

    // 5. Create ComponentAttribute for Length (calculated from blank)
    const lengthAttribute = await prisma.componentAttribute.upsert({
      where: {
        tenantId_componentType_attributeName: {
          tenantId: tenant.id,
          componentType: 'LIPPING',
          attributeName: 'Length'
        }
      },
      create: {
        tenantId: tenant.id,
        componentType: 'LIPPING',
        attributeName: 'Length',
        attributeType: 'CALCULATED',
        displayOrder: 4,
        isRequired: true,
        affectsPrice: true, // Longer lengths cost more
        affectsBOM: true,
        calculationFormula: '(blankHeight * 2 + blankWidth * 2) / 1000', // Perimeter in meters
        calculationUnit: 'm',
        metadata: JSON.stringify({
          description: 'Total length needed = perimeter of door'
        })
      },
      update: {}
    });
    console.log('✅ Created Length attribute (calculated from door perimeter)\n');

    // 6. Create example ComponentVariants for different timber types
    const timbers = ['OAK', 'SAPELE', 'WALNUT'];
    const thicknesses = ['10', '12', '15'];

    console.log('📦 Creating component variants...\n');
    
    for (const timber of timbers) {
      for (const thickness of thicknesses) {
        const variantCode = `LIP-${timber}-${thickness}MM`;
        
        const timberOption = JSON.parse(timberAttribute.options).find(o => o.value === timber);
        const basePrice = lippingComponent.basePrice + (timberOption?.priceModifier || 0);
        
        await prisma.componentVariant.upsert({
          where: {
            tenantId_variantCode: {
              tenantId: tenant.id,
              variantCode
            }
          },
          create: {
            tenantId: tenant.id,
            componentLookupId: lippingComponent.id,
            variantCode,
            variantName: `${timberOption.label} Lipping ${thickness}mm`,
            attributeValues: JSON.stringify({
              Timber: timber,
              Thickness: thickness
            }),
            dimensionFormulas: JSON.stringify({
              width: 'blankThickness',
              length: '(blankHeight * 2 + blankWidth * 2) / 1000',
              thickness: thickness
            }),
            priceModifier: timberOption?.priceModifier || 0,
            unitPrice: basePrice,
            isActive: true,
            specifications: JSON.stringify({
              material: timberOption.label,
              thickness: `${thickness}mm`,
              finish: 'Unfinished',
              grade: 'Select',
              moisture: '10-12%'
            })
          },
          update: {}
        });
        
        console.log(`  ✅ ${variantCode}: ${timberOption.label} ${thickness}mm @ £${basePrice.toFixed(2)}/m`);
      }
    }
    
    console.log('\n✨ Lipping variant system seeded successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Base Component: LIPPING-BASE');
    console.log('   • Attributes: Timber (5 options), Thickness (4 options), Width (calculated), Length (calculated)');
    console.log(`   • Variants: ${timbers.length * thicknesses.length} unique lipping variants`);
    console.log('\n💡 How it works:');
    console.log('   1. User selects door type → determines lipping thickness');
    console.log('   2. User selects timber from dropdown → determines material and price modifier');
    console.log('   3. System calculates width from blank thickness');
    console.log('   4. System calculates length from door perimeter (height * 2 + width * 2)');
    console.log('   5. ComponentVariant is selected with all attributes');
    console.log('   6. BOMVariantLineItem created with calculated dimensions and final price\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedLippingVariantSystem();
