#!/usr/bin/env node
/**
 * Extract Questionnaire Answers from Parsed PDFs
 * 
 * This script analyzes existing ParsedSupplierLine and QuoteQuestionnaireMatch data
 * to extract answers to standard questionnaire fields and populate QuestionnaireResponse records.
 * 
 * Usage: node scripts/extract-questionnaire-from-pdfs.js [tenantId]
 */

const { PrismaClient } = require('../api/node_modules/@prisma/client');
const { PrismaPg } = require('../api/node_modules/@prisma/adapter-pg');
const { Pool } = require('../api/node_modules/pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Field extraction mappings
const EXTRACTORS = {
  // Dimensions
  'door_width_mm': (data) => {
    if (data.widthMm) return data.widthMm;
    // Try parsing from description
    const match = data.description?.match(/width[:\s]+(\d+)\s*mm/i);
    return match ? parseFloat(match[1]) : null;
  },
  
  'door_height_mm': (data) => {
    if (data.heightMm) return data.heightMm;
    const match = data.description?.match(/height[:\s]+(\d+)\s*mm/i);
    return match ? parseFloat(match[1]) : null;
  },
  
  'thickness_mm': (data) => {
    if (data.thicknessMm) return data.thicknessMm;
    const match = data.description?.match(/(\d+)\s*mm\s+thick/i);
    return match ? parseFloat(match[1]) : null;
  },
  
  // Quantities
  'quantity': (data) => {
    if (data.quantity) return data.quantity;
    if (data.qty) return data.qty;
    return null;
  },
  
  // Materials
  'timber_species': (data) => {
    const desc = (data.description || '').toLowerCase();
    const species = ['oak', 'pine', 'ash', 'walnut', 'maple', 'cherry', 'mahogany'];
    for (const s of species) {
      if (desc.includes(s)) return s.charAt(0).toUpperCase() + s.slice(1);
    }
    return null;
  },
  
  'glass_type': (data) => {
    const desc = (data.description || '').toLowerCase();
    if (desc.includes('double glaz') || desc.includes('dgu')) return 'Double Glazed';
    if (desc.includes('obscure')) return 'Obscured';
    if (desc.includes('clear')) return 'Clear';
    if (desc.includes('toughen')) return 'Toughened';
    return null;
  },
  
  // Fire ratings
  'fire_rating': (data) => {
    const desc = (data.description || '').toLowerCase();
    if (desc.includes('fd60')) return 'FD60';
    if (desc.includes('fd30')) return 'FD30';
    if (desc.includes('fd90')) return 'FD90';
    if (desc.includes('fire rated') || desc.includes('fire door')) return 'Fire Rated';
    return null;
  },
  
  // Finish
  'finish_type': (data) => {
    const desc = (data.description || '').toLowerCase();
    if (desc.includes('stain')) return 'Stained';
    if (desc.includes('paint')) return 'Painted';
    if (desc.includes('lacquer') || desc.includes('varnish')) return 'Lacquered';
    if (desc.includes('prime')) return 'Primed';
    if (desc.includes('unfinish')) return 'Unfinished';
    return null;
  },
  
  // Unit price and total
  'unit_price_gbp': (data) => {
    if (data.unitPrice) return data.unitPrice;
    if (data.costUnit) return data.costUnit;
    return null;
  },
  
  'line_total_gbp': (data) => {
    if (data.lineTotal) return data.lineTotal;
    return null;
  },
};

async function extractAnswersFromQuote(quoteId, tenantId) {
  console.log(`Processing quote ${quoteId}...`);
  
  // Get all parsed data for this quote
  const matches = await prisma.quoteQuestionnaireMatch.findMany({
    where: { quoteId },
    orderBy: { createdAt: 'asc' },
  });
  
  const parsedLines = await prisma.parsedSupplierLine.findMany({
    where: { quoteId },
    orderBy: { createdAt: 'asc' },
  });
  
  if (matches.length === 0 && parsedLines.length === 0) {
    console.log(`  No parsed data found for quote ${quoteId}`);
    return { extracted: 0 };
  }
  
  // Get standard questionnaire fields
  const fields = await prisma.questionnaireField.findMany({
    where: {
      tenantId,
      isStandard: true,
      isActive: true,
    },
  });
  
  if (fields.length === 0) {
    console.log(`  No standard fields found for tenant ${tenantId}`);
    return { extracted: 0 };
  }
  
  // Combine all data sources
  const allData = [
    ...matches.map(m => ({
      description: m.description,
      widthMm: m.widthMm,
      heightMm: m.heightMm,
      thicknessMm: m.thicknessMm,
      quantity: m.quantity,
      unitPrice: m.unitPrice,
      lineTotal: m.lineTotal,
      qty: m.quantity,
      costUnit: m.unitPrice,
    })),
    ...parsedLines.map(l => ({
      description: l.description,
      qty: l.qty,
      costUnit: l.costUnit,
      lineTotal: l.lineTotal,
      widthMm: null,
      heightMm: null,
      thicknessMm: null,
      quantity: l.qty,
      unitPrice: l.costUnit,
    })),
  ];
  
  // Extract answers
  const extractedAnswers = {};
  let extractionCount = 0;
  
  for (const field of fields) {
    const extractor = EXTRACTORS[field.key];
    if (!extractor) continue;
    
    // Try to extract from each data source until we find a value
    for (const data of allData) {
      const value = extractor(data);
      if (value !== null && value !== undefined) {
        extractedAnswers[field.id] = value;
        extractionCount++;
        console.log(`  Extracted ${field.key}: ${value}`);
        break;
      }
    }
  }
  
  if (extractionCount === 0) {
    console.log(`  No values extracted from parsed data`);
    return { extracted: 0 };
  }
  
  // Get or create questionnaire
  let questionnaire = await prisma.questionnaire.findFirst({
    where: { tenantId, isActive: true },
  });
  
  if (!questionnaire) {
    questionnaire = await prisma.questionnaire.create({
      data: {
        tenantId,
        name: 'Standard Questionnaire',
        description: 'Auto-generated from schema',
        isActive: true,
      },
    });
  }
  
  // Get or create response
  let response = await prisma.questionnaireResponse.findFirst({
    where: { quoteId },
  });
  
  if (!response) {
    response = await prisma.questionnaireResponse.create({
      data: {
        tenantId,
        questionnaireId: questionnaire.id,
        quoteId,
      },
    });
  }
  
  // Upsert answers
  for (const [fieldId, value] of Object.entries(extractedAnswers)) {
    await prisma.questionnaireAnswer.upsert({
      where: {
        responseId_fieldId: {
          responseId: response.id,
          fieldId,
        },
      },
      create: {
        responseId: response.id,
        fieldId,
        value,
      },
      update: {
        value,
      },
    });
  }
  
  console.log(`  ✓ Extracted ${extractionCount} answers for quote ${quoteId}`);
  return { extracted: extractionCount };
}

async function main() {
  const tenantId = process.argv[2];
  
  if (!tenantId) {
    console.error('Usage: node extract-questionnaire-from-pdfs.js <tenantId>');
    process.exit(1);
  }
  
  console.log(`Extracting questionnaire answers for tenant: ${tenantId}\n`);
  
  // Get all quotes with parsed data
  const quotesWithMatches = await prisma.quote.findMany({
    where: {
      tenantId,
      OR: [
        { questionnaireMatches: { some: {} } },
        { id: { in: (await prisma.parsedSupplierLine.findMany({
          where: { tenantId },
          select: { quoteId: true },
          distinct: ['quoteId'],
        })).map(p => p.quoteId) } },
      ],
    },
    select: { id: true, title: true },
  });
  
  console.log(`Found ${quotesWithMatches.length} quotes with parsed data\n`);
  
  let totalExtracted = 0;
  let processedCount = 0;
  
  for (const quote of quotesWithMatches) {
    const result = await extractAnswersFromQuote(quote.id, tenantId);
    totalExtracted += result.extracted;
    if (result.extracted > 0) processedCount++;
  }
  
  console.log(`\n✓ Complete! Processed ${processedCount}/${quotesWithMatches.length} quotes`);
  console.log(`  Total answers extracted: ${totalExtracted}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
