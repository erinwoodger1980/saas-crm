"use strict";
/**
 * Phase 2: Starter Library Seed
 * Seeds minimal ProductTypes, Attributes, Questions, QuestionSets, and Components
 * so new users can start quoting immediately with sensible defaults
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedConfiguredProductStarter = seedConfiguredProductStarter;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seedConfiguredProductStarter({ tenantId }) {
    console.log(`🌱 Seeding ConfiguredProduct starter library for tenant ${tenantId}...`);
    // ============================================================================
    // 1. ATTRIBUTES - Universal product attributes
    // ============================================================================
    console.log('  📊 Creating Attributes...');
    const attributes = await Promise.all([
        // Dimensions
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'width' } },
            create: {
                tenantId,
                code: 'width',
                name: 'Width',
                description: 'Overall width in millimeters',
                attributeType: 'number',
                unit: 'mm',
                requiredForCosting: true,
                requiredForManufacture: true,
                affectsPrice: true,
                affectsBOM: true,
                hints: { min: 400, max: 3000, step: 1 }
            },
            update: {}
        }),
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'height' } },
            create: {
                tenantId,
                code: 'height',
                name: 'Height',
                description: 'Overall height in millimeters',
                attributeType: 'number',
                unit: 'mm',
                requiredForCosting: true,
                requiredForManufacture: true,
                affectsPrice: true,
                affectsBOM: true,
                hints: { min: 400, max: 3000, step: 1 }
            },
            update: {}
        }),
        // Material
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'timberGroup' } },
            create: {
                tenantId,
                code: 'timberGroup',
                name: 'Timber Group',
                description: 'Primary timber material',
                attributeType: 'select',
                options: ['Softwood', 'Hardwood', 'Accoya', 'Engineered'],
                defaultValue: 'Softwood',
                requiredForCosting: true,
                requiredForManufacture: true,
                affectsPrice: true,
                affectsBOM: true
            },
            update: {}
        }),
        // Finish
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'finish' } },
            create: {
                tenantId,
                code: 'finish',
                name: 'Finish',
                description: 'Surface finish treatment',
                attributeType: 'select',
                options: ['Unfinished', 'Primed', 'Painted', 'Stained', 'Clear Lacquer'],
                defaultValue: 'Unfinished',
                requiredForCosting: true,
                affectsPrice: true,
                affectsBOM: true
            },
            update: {}
        }),
        // Glazing
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'glazingType' } },
            create: {
                tenantId,
                code: 'glazingType',
                name: 'Glazing Type',
                description: 'Glass specification',
                attributeType: 'select',
                options: ['None', 'DGU Clear', 'DGU Obscure', 'DGU Toughened', 'Triple Glazed'],
                defaultValue: 'None',
                requiredForCosting: true,
                affectsPrice: true,
                affectsBOM: true
            },
            update: {}
        }),
        // Hardware
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'hardwarePack' } },
            create: {
                tenantId,
                code: 'hardwarePack',
                name: 'Hardware Pack',
                description: 'Ironmongery specification',
                attributeType: 'select',
                options: ['Standard', 'Premium', 'Fire Door', 'Security'],
                defaultValue: 'Standard',
                requiredForCosting: true,
                affectsPrice: true,
                affectsBOM: true
            },
            update: {}
        }),
        // Color
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'colourInside' } },
            create: {
                tenantId,
                code: 'colourInside',
                name: 'Inside Colour',
                description: 'Interior face colour',
                attributeType: 'text',
                requiredForManufacture: true,
                affectsBOM: true
            },
            update: {}
        }),
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'colourOutside' } },
            create: {
                tenantId,
                code: 'colourOutside',
                name: 'Outside Colour',
                description: 'Exterior face colour',
                attributeType: 'text',
                requiredForManufacture: true,
                affectsBOM: true
            },
            update: {}
        }),
        // Panel configuration
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'panelCount' } },
            create: {
                tenantId,
                code: 'panelCount',
                name: 'Panel Count',
                description: 'Number of panels (for bifolds)',
                attributeType: 'number',
                unit: 'panels',
                options: ['2', '3', '4', '5', '6'],
                defaultValue: '2',
                requiredForCosting: true,
                affectsPrice: true,
                affectsBOM: true
            },
            update: {}
        }),
        // Opening configuration
        prisma.attribute.upsert({
            where: { tenantId_code: { tenantId, code: 'opening' } },
            create: {
                tenantId,
                code: 'opening',
                name: 'Opening',
                description: 'How the window/door opens',
                attributeType: 'select',
                options: ['Fixed', 'Side Hung', 'Top Hung', 'Sliding', 'Bifold'],
                requiredForCosting: true,
                affectsBOM: true
            },
            update: {}
        })
    ]);
    console.log(`    ✓ Created ${attributes.length} attributes`);
    // ============================================================================
    // 2. PRODUCT TYPES - Tree structure (category → type → option)
    // ============================================================================
    console.log('  🏗️  Creating ProductType tree...');
    // Category: Doors
    const doorCategory = await prisma.productType.upsert({
        where: { tenantId_code: { tenantId, code: 'CAT_DOOR' } },
        create: {
            tenantId,
            code: 'CAT_DOOR',
            name: 'Doors',
            description: 'All door products',
            level: 'category',
            sortOrder: 1,
            isActive: true
        },
        update: {}
    });
    // Type: Entrance Doors
    const entranceDoorType = await prisma.productType.upsert({
        where: { tenantId_code: { tenantId, code: 'TYPE_ENTRANCE_DOOR' } },
        create: {
            tenantId,
            code: 'TYPE_ENTRANCE_DOOR',
            name: 'Entrance Doors',
            description: 'Panelled entrance doors',
            level: 'type',
            parentId: doorCategory.id,
            sortOrder: 1,
            isActive: true
        },
        update: { parentId: doorCategory.id }
    });
    // Options: E01, E02, E03
    const entranceOptions = await Promise.all([
        prisma.productType.upsert({
            where: { tenantId_code: { tenantId, code: 'OPT_E01' } },
            create: {
                tenantId,
                code: 'OPT_E01',
                name: 'E01 - 2 Panel',
                description: 'Entrance door with 2 panels',
                level: 'option',
                parentId: entranceDoorType.id,
                sortOrder: 1,
                isActive: true
            },
            update: { parentId: entranceDoorType.id }
        }),
        prisma.productType.upsert({
            where: { tenantId_code: { tenantId, code: 'OPT_E02' } },
            create: {
                tenantId,
                code: 'OPT_E02',
                name: 'E02 - 4 Panel',
                description: 'Entrance door with 4 panels',
                level: 'option',
                parentId: entranceDoorType.id,
                sortOrder: 2,
                isActive: true
            },
            update: { parentId: entranceDoorType.id }
        }),
        prisma.productType.upsert({
            where: { tenantId_code: { tenantId, code: 'OPT_E03' } },
            create: {
                tenantId,
                code: 'OPT_E03',
                name: 'E03 - Glazed',
                description: 'Entrance door with glazing',
                level: 'option',
                parentId: entranceDoorType.id,
                sortOrder: 3,
                isActive: true
            },
            update: { parentId: entranceDoorType.id }
        })
    ]);
    // Category: Windows
    const windowCategory = await prisma.productType.upsert({
        where: { tenantId_code: { tenantId, code: 'CAT_WINDOW' } },
        create: {
            tenantId,
            code: 'CAT_WINDOW',
            name: 'Windows',
            description: 'All window products',
            level: 'category',
            sortOrder: 2,
            isActive: true
        },
        update: {}
    });
    // Type: Casement Windows
    const casementType = await prisma.productType.upsert({
        where: { tenantId_code: { tenantId, code: 'TYPE_CASEMENT' } },
        create: {
            tenantId,
            code: 'TYPE_CASEMENT',
            name: 'Casement Windows',
            description: 'Side or top hung windows',
            level: 'type',
            parentId: windowCategory.id,
            sortOrder: 1,
            isActive: true
        },
        update: { parentId: windowCategory.id }
    });
    // Type: Sash Windows
    const sashType = await prisma.productType.upsert({
        where: { tenantId_code: { tenantId, code: 'TYPE_SASH' } },
        create: {
            tenantId,
            code: 'TYPE_SASH',
            name: 'Sash Windows',
            description: 'Traditional sliding sash windows',
            level: 'type',
            parentId: windowCategory.id,
            sortOrder: 2,
            isActive: true
        },
        update: { parentId: windowCategory.id }
    });
    console.log(`    ✓ Created ProductType tree (2 categories, 3 types, 3 options)`);
    // ============================================================================
    // 3. QUESTIONS - UI layer over attributes
    // ============================================================================
    console.log('  ❓ Creating Questions...');
    const questions = await Promise.all([
        prisma.question.create({
            data: {
                tenantId,
                attributeCode: 'width',
                label: 'Width (mm)',
                helpText: 'Overall width of the product',
                placeholder: 'e.g. 1200',
                controlType: 'input',
                displayOrder: 1
            }
        }),
        prisma.question.create({
            data: {
                tenantId,
                attributeCode: 'height',
                label: 'Height (mm)',
                helpText: 'Overall height of the product',
                placeholder: 'e.g. 2100',
                controlType: 'input',
                displayOrder: 2
            }
        }),
        prisma.question.create({
            data: {
                tenantId,
                attributeCode: 'timberGroup',
                label: 'Timber Type',
                helpText: 'Select the timber material',
                controlType: 'select',
                displayOrder: 3
            }
        }),
        prisma.question.create({
            data: {
                tenantId,
                attributeCode: 'finish',
                label: 'Finish',
                helpText: 'Choose the surface finish',
                controlType: 'select',
                displayOrder: 4
            }
        }),
        prisma.question.create({
            data: {
                tenantId,
                attributeCode: 'glazingType',
                label: 'Glazing',
                helpText: 'Select glazing specification',
                controlType: 'select',
                displayOrder: 5,
                visibilityRules: {
                    showWhen: {
                        productType: ['OPT_E03', 'TYPE_CASEMENT', 'TYPE_SASH']
                    }
                }
            }
        }),
        prisma.question.create({
            data: {
                tenantId,
                attributeCode: 'hardwarePack',
                label: 'Hardware',
                helpText: 'Choose ironmongery pack',
                controlType: 'select',
                displayOrder: 6
            }
        }),
        prisma.question.create({
            data: {
                tenantId,
                attributeCode: 'colourInside',
                label: 'Inside Colour',
                helpText: 'Interior face colour (RAL or name)',
                placeholder: 'e.g. RAL 9010 or White',
                controlType: 'input',
                displayOrder: 7
            }
        }),
        prisma.question.create({
            data: {
                tenantId,
                attributeCode: 'colourOutside',
                label: 'Outside Colour',
                helpText: 'Exterior face colour (RAL or name)',
                placeholder: 'e.g. RAL 7016 or Anthracite',
                controlType: 'input',
                displayOrder: 8
            }
        })
    ]);
    console.log(`    ✓ Created ${questions.length} questions`);
    // ============================================================================
    // 4. QUESTION SETS - Group questions by product type
    // ============================================================================
    console.log('  📋 Creating QuestionSets...');
    const entranceQuestionSet = await prisma.questionSet.create({
        data: {
            tenantId,
            name: 'Entrance Door Questions',
            description: 'Standard questions for entrance doors',
            productTypeId: entranceDoorType.id
        }
    });
    const windowQuestionSet = await prisma.questionSet.create({
        data: {
            tenantId,
            name: 'Window Questions',
            description: 'Standard questions for windows',
            productTypeId: casementType.id
        }
    });
    // Link questions to entrance door set (all except panelCount)
    const entranceQuestions = questions.filter(q => ['width', 'height', 'timberGroup', 'finish', 'glazingType', 'hardwarePack', 'colourInside', 'colourOutside'].includes(q.attributeCode));
    await Promise.all(entranceQuestions.map((question, idx) => prisma.questionSetQuestion.create({
        data: {
            questionSetId: entranceQuestionSet.id,
            questionId: question.id,
            sortOrder: idx,
            isRequired: ['width', 'height', 'timberGroup'].includes(question.attributeCode)
        }
    })));
    // Link questions to window set
    await Promise.all(entranceQuestions.map((question, idx) => prisma.questionSetQuestion.create({
        data: {
            questionSetId: windowQuestionSet.id,
            questionId: question.id,
            sortOrder: idx,
            isRequired: ['width', 'height', 'timberGroup', 'glazingType'].includes(question.attributeCode)
        }
    })));
    // Update product types with question sets
    await prisma.productType.update({
        where: { id: entranceDoorType.id },
        data: { questionSetId: entranceQuestionSet.id }
    });
    await prisma.productType.update({
        where: { id: casementType.id },
        data: { questionSetId: windowQuestionSet.id }
    });
    await prisma.productType.update({
        where: { id: sashType.id },
        data: { questionSetId: windowQuestionSet.id }
    });
    console.log(`    ✓ Created 2 question sets with linked questions`);
    // ============================================================================
    // 5. COMPONENT LOOKUPS - Basic components with defaults
    // ============================================================================
    console.log('  🔧 Creating Component starters...');
    const frameSet = await prisma.componentLookup.upsert({
        where: { tenantId_code: { tenantId, code: 'FRAME-SET' } },
        create: {
            tenantId,
            code: 'FRAME-SET',
            name: 'Frame Set',
            description: 'Complete frame assembly',
            componentType: 'FRAME',
            productTypes: ['TYPE_ENTRANCE_DOOR', 'TYPE_CASEMENT', 'TYPE_SASH'],
            unitOfMeasure: 'EA',
            basePrice: 150.00,
            inclusionRules: { alwaysInclude: true },
            quantityFormula: '1',
            isActive: true
        },
        update: {}
    });
    const panelSet = await prisma.componentLookup.upsert({
        where: { tenantId_code: { tenantId, code: 'PANEL-SET' } },
        create: {
            tenantId,
            code: 'PANEL-SET',
            name: 'Panel/Sash Set',
            description: 'Opening panels or sashes',
            componentType: 'PANEL',
            productTypes: ['TYPE_ENTRANCE_DOOR', 'TYPE_CASEMENT', 'TYPE_SASH'],
            unitOfMeasure: 'EA',
            basePrice: 200.00,
            inclusionRules: { alwaysInclude: true },
            quantityFormula: '1',
            isActive: true
        },
        update: {}
    });
    const glazingUnit = await prisma.componentLookup.upsert({
        where: { tenantId_code: { tenantId, code: 'GLAZING-UNIT' } },
        create: {
            tenantId,
            code: 'GLAZING-UNIT',
            name: 'Glazing Unit',
            description: 'Double glazed unit with beads',
            componentType: 'GLAZING',
            productTypes: ['TYPE_ENTRANCE_DOOR', 'TYPE_CASEMENT', 'TYPE_SASH'],
            unitOfMeasure: 'M2',
            basePrice: 80.00,
            inclusionRules: {
                condition: 'selections.glazingType !== "None"'
            },
            quantityFormula: '(selections.width * selections.height) / 1000000',
            isActive: true
        },
        update: {}
    });
    const hardwarePack = await prisma.componentLookup.upsert({
        where: { tenantId_code: { tenantId, code: 'HARDWARE-STD' } },
        create: {
            tenantId,
            code: 'HARDWARE-STD',
            name: 'Standard Hardware Pack',
            description: 'Hinges, locks, handles',
            componentType: 'HARDWARE',
            productTypes: ['TYPE_ENTRANCE_DOOR', 'TYPE_CASEMENT', 'TYPE_SASH'],
            unitOfMeasure: 'EA',
            basePrice: 50.00,
            inclusionRules: { alwaysInclude: true },
            quantityFormula: '1',
            isActive: true
        },
        update: {}
    });
    const finishingPack = await prisma.componentLookup.upsert({
        where: { tenantId_code: { tenantId, code: 'FINISH-PACK' } },
        create: {
            tenantId,
            code: 'FINISH-PACK',
            name: 'Finishing Pack',
            description: 'Paint, stain, or lacquer materials',
            componentType: 'FINISH',
            productTypes: ['TYPE_ENTRANCE_DOOR', 'TYPE_CASEMENT', 'TYPE_SASH'],
            unitOfMeasure: 'EA',
            basePrice: 30.00,
            inclusionRules: {
                condition: 'selections.finish !== "Unfinished"'
            },
            quantityFormula: '1',
            isActive: true
        },
        update: {}
    });
    console.log(`    ✓ Created 5 component starters with inclusion rules`);
    console.log(`✅ ConfiguredProduct starter library seeded successfully for tenant ${tenantId}`);
    return {
        attributes: attributes.length,
        productTypes: 8,
        questions: questions.length,
        questionSets: 2,
        components: 5
    };
}
// Allow running this seed independently
if (require.main === module) {
    const tenantId = process.env.TENANT_ID;
    if (!tenantId) {
        console.error('❌ TENANT_ID environment variable required');
        process.exit(1);
    }
    seedConfiguredProductStarter({ tenantId })
        .then(result => {
        console.log('\n📊 Seed Summary:', result);
        process.exit(0);
    })
        .catch(error => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    })
        .finally(() => prisma.$disconnect());
}
