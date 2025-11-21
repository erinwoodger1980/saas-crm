import { PrismaClient } from '@prisma/client';
import { extractStructuredText } from './src/lib/pdf/extract';
import { buildSupplierParse } from './src/lib/pdf/parser';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function testParse() {
  console.log('Testing West & Reid quote parsing with production database...\n');
  
  try {
    // Test DB connection
    const tenant = await prisma.tenant.findFirst({ select: { id: true, name: true } });
    console.log(`✓ Connected to DB - Found tenant: ${tenant?.name || 'None'}\n`);
    
    // Read PDF
    const pdfPath = path.join(__dirname, 'uploads/test/west-and-reid-test.pdf');
    if (!fs.existsSync(pdfPath)) {
      console.error('PDF file not found at:', pdfPath);
      process.exit(1);
    }
    
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`✓ Loaded PDF: ${(pdfBuffer.length / 1024).toFixed(1)} KB\n`);
    
    // Extract structured text
    console.log('Step 1: Extracting structured text from PDF...');
    const extraction = await extractStructuredText(pdfBuffer);
    
    console.log(`  - Rows found: ${extraction.rows.length}`);
    console.log(`  - Avg glyph quality: ${(extraction.glyphQuality * 100).toFixed(1)}%`);
    console.log(`  - Unicode map size: ${extraction.unicodeMapSize}\n`);
    
    // Parse into structured data
    console.log('Step 2: Parsing line items and totals...');
    const { result, metadata } = buildSupplierParse(extraction);
    
    console.log(`\n📋 Parsed ${result.lines.length} line items:\n`);
    result.lines.forEach((line, i) => {
      console.log(`  ${i+1}. ${line.description.substring(0, 60)}${line.description.length > 60 ? '...' : ''}`);
      if (line.qty) console.log(`     Qty: ${line.qty}`);
      if (line.costUnit) console.log(`     Unit cost: £${line.costUnit.toFixed(2)}`);
      if (line.lineTotal) console.log(`     Line total: £${line.lineTotal.toFixed(2)}`);
      console.log('');
    });
    
    console.log('💰 Detected Totals:');
    if (result.detected_totals?.subtotal) {
      console.log(`  Subtotal: £${result.detected_totals.subtotal.toFixed(2)}`);
    }
    if (result.detected_totals?.delivery) {
      console.log(`  Delivery: £${result.detected_totals.delivery.toFixed(2)}`);
    }
    if (result.detected_totals?.estimated_total) {
      console.log(`  Grand Total: £${result.detected_totals.estimated_total.toFixed(2)}`);
    }
    
    console.log('\n📊 Parsing Quality:');
    console.log(`  Description Quality: ${(metadata.descriptionQuality * 100).toFixed(1)}%`);
    console.log(`  Glyph Quality: ${(metadata.glyphQuality * 100).toFixed(1)}%`);
    console.log(`  Low Confidence: ${metadata.lowConfidence ? '❌ Yes' : '✓ No'}`);
    
    if (metadata.warnings?.length) {
      console.log('\n⚠️  Warnings:');
      metadata.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    // Expected values for comparison
    console.log('\n🎯 Expected vs Actual:');
    console.log(`  Expected Subtotal: £6,859.97`);
    console.log(`  Actual Subtotal:   £${result.detected_totals?.subtotal?.toFixed(2) || 'Not detected'}`);
    console.log(`  Expected Total:    £8,231.96`);
    console.log(`  Actual Total:      £${result.detected_totals?.estimated_total?.toFixed(2) || 'Not detected'}`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testParse();
