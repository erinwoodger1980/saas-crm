/**
 * Test script to parse West & Reid quote and show extracted data
 */
const fs = require('fs');
const path = require('path');

// Import the parser
const { extractStructuredText } = require('./api/src/lib/pdf/extract');
const { buildSupplierParse } = require('./api/src/lib/pdf/parser');

const pdfPath = path.join(__dirname, 'api/uploads/test/west-and-reid-test.pdf');

async function testParse() {
  console.log('Testing PDF parsing on West & Reid quote...\n');
  
  try {
    // Read PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Extract structured text
    console.log('Step 1: Extracting structured text from PDF...');
    const extraction = await extractStructuredText(pdfBuffer);
    console.log(`  - Found ${extraction.rows.length} rows`);
    console.log(`  - Average glyph quality: ${extraction.avgGlyphQuality.toFixed(2)}`);
    console.log(`  - Detected supplier: ${extraction.inferredSupplier || 'Unknown'}`);
    console.log(`  - Currency: ${extraction.inferredCurrency || 'Unknown'}\n`);
    
    // Parse into structured data
    console.log('Step 2: Parsing line items and totals...');
    const { result, metadata } = buildSupplierParse(extraction);
    
    console.log(`\nParsed ${result.lines.length} line items:`);
    result.lines.forEach((line, i) => {
      console.log(`  ${i+1}. ${line.description}`);
      console.log(`     Qty: ${line.qty || '?'}, Unit: £${line.unit_cost?.toFixed(2) || '?'}, Total: £${line.line_total?.toFixed(2) || '?'}`);
    });
    
    console.log('\nDetected Totals:');
    if (result.detected_totals.subtotal) {
      console.log(`  Subtotal: £${result.detected_totals.subtotal.toFixed(2)}`);
    }
    if (result.detected_totals.delivery) {
      console.log(`  Delivery: £${result.detected_totals.delivery.toFixed(2)}`);
    }
    if (result.detected_totals.estimated_total) {
      console.log(`  Total: £${result.detected_totals.estimated_total.toFixed(2)}`);
    }
    
    console.log('\nParsing Quality:');
    console.log(`  Description Quality: ${(metadata.descriptionQuality * 100).toFixed(1)}%`);
    console.log(`  Glyph Quality: ${(metadata.glyphQuality * 100).toFixed(1)}%`);
    console.log(`  Low Confidence: ${metadata.lowConfidence ? 'Yes' : 'No'}`);
    
    if (metadata.warnings && metadata.warnings.length > 0) {
      console.log('\nWarnings:');
      metadata.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
  } catch (error) {
    console.error('Error parsing PDF:', error.message);
    console.error(error.stack);
  }
}

testParse();
