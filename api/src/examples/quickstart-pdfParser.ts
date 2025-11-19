/**
 * Quick Start Examples - Shared PDF Parser
 * 
 * Copy these examples to quickly integrate the shared PDF parser
 * into your code.
 */

import {
  extractPdfLayout,
  buildLineItemsFromText,
  classifyAndFilterImages,
  attachImagesToLines,
} from '../lib/pdfParsing';

// ============================================================================
// EXAMPLE 1: Basic Usage - Parse a supplier quote PDF
// ============================================================================

export async function example1_BasicParsing(pdfBuffer: Buffer) {
  console.log('=== Example 1: Basic PDF Parsing ===\n');

  // Step 1: Extract layout
  const layout = await extractPdfLayout(pdfBuffer);
  console.log(`✅ Extracted ${layout.textBlocks.length} text blocks and ${layout.images.length} images\n`);

  // Step 2: Build line items
  const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
  console.log(`✅ Found ${lines.length} joinery line items\n`);

  // Step 3: View first line item
  if (lines.length > 0) {
    console.log('First line item:');
    console.log(JSON.stringify(lines[0], null, 2));
  }

  return lines;
}

// ============================================================================
// EXAMPLE 2: With Image Processing
// ============================================================================

export async function example2_WithImages(pdfBuffer: Buffer) {
  console.log('=== Example 2: Parse with Images ===\n');

  // Extract layout
  const layout = await extractPdfLayout(pdfBuffer);

  // Build lines
  const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
  console.log(`Found ${lines.length} lines`);

  // Filter images (remove logos, headers, footers)
  const cleanImages = classifyAndFilterImages(layout.images, layout.pages);
  console.log(`Filtered ${layout.images.length} → ${cleanImages.length} images`);

  // Attach images to lines
  const linesWithImages = attachImagesToLines(lines, cleanImages);
  const attachedCount = linesWithImages.filter(l => l.meta.imageRef).length;
  console.log(`Attached images to ${attachedCount} lines\n`);

  // Show lines with images
  linesWithImages.forEach((line, index) => {
    if (line.meta.imageRef) {
      console.log(`Line ${index + 1}: "${line.description}" has image (hash: ${line.meta.imageRef.hash.slice(0, 8)}...)`);
    }
  });

  return linesWithImages;
}

// ============================================================================
// EXAMPLE 3: Extract Joinery Metadata
// ============================================================================

export async function example3_JoineryMetadata(pdfBuffer: Buffer) {
  console.log('=== Example 3: Joinery Metadata Extraction ===\n');

  const layout = await extractPdfLayout(pdfBuffer);
  const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });

  // Display joinery-specific metadata
  lines.forEach((line, index) => {
    console.log(`\nLine ${index + 1}: ${line.description}`);
    console.log(`  Qty: ${line.qty || 'N/A'}`);
    console.log(`  Unit Price: ${line.unitPrice ? `£${line.unitPrice}` : 'N/A'}`);
    console.log(`  Total: ${line.totalPrice ? `£${line.totalPrice}` : 'N/A'}`);
    
    if (line.meta.dimensions) console.log(`  📏 Dimensions: ${line.meta.dimensions}`);
    if (line.meta.area) console.log(`  📐 Area: ${line.meta.area}`);
    if (line.meta.productType) console.log(`  🏷️  Type: ${line.meta.productType}`);
    if (line.meta.wood) console.log(`  🌳 Wood: ${line.meta.wood}`);
    if (line.meta.finish) console.log(`  🎨 Finish: ${line.meta.finish}`);
    if (line.meta.glass) console.log(`  🪟 Glass: ${line.meta.glass}`);
  });

  return lines;
}

// ============================================================================
// EXAMPLE 4: Convert to Database Format
// ============================================================================

export async function example4_ConvertToDbFormat(pdfBuffer: Buffer, quoteId: string) {
  console.log('=== Example 4: Convert to Database Format ===\n');

  const layout = await extractPdfLayout(pdfBuffer);
  const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
  const cleanImages = classifyAndFilterImages(layout.images, layout.pages);
  const linesWithImages = attachImagesToLines(lines, cleanImages);

  // Convert to database format
  const dbLines = linesWithImages.map((line, index) => ({
    quoteId,
    orderIndex: index,
    description: line.description,
    quantity: line.qty || null,
    unitPrice: line.unitPrice || null,
    totalPrice: line.totalPrice || null,
    
    // Store metadata as JSON
    meta: {
      dimensions: line.meta.dimensions,
      area: line.meta.area,
      productType: line.meta.productType,
      wood: line.meta.wood,
      finish: line.meta.finish,
      glass: line.meta.glass,
      imageHash: line.meta.imageRef?.hash,
      imagePage: line.meta.imageRef?.page,
    },
  }));

  console.log(`Converted ${dbLines.length} lines to database format\n`);
  console.log('Sample DB record:');
  console.log(JSON.stringify(dbLines[0], null, 2));

  return dbLines;
}

// ============================================================================
// EXAMPLE 5: Comparison with Legacy Parser
// ============================================================================

export async function example5_CompareWithLegacy(pdfBuffer: Buffer) {
  console.log('=== Example 5: Compare New vs Old Parser ===\n');

  // NEW: Shared parser
  console.log('Running NEW parser...');
  const startNew = Date.now();
  const layout = await extractPdfLayout(pdfBuffer);
  const newLines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
  const cleanImages = classifyAndFilterImages(layout.images, layout.pages);
  const newResult = attachImagesToLines(newLines, cleanImages);
  const timeNew = Date.now() - startNew;

  // OLD: Legacy parser (example - replace with actual legacy function)
  console.log('Running OLD parser...');
  const startOld = Date.now();
  // const oldResult = await legacyParseSupplierPdf(pdfBuffer);
  const timeOld = Date.now() - startOld;

  // Compare
  console.log('\n📊 COMPARISON:');
  console.log(`  New Parser: ${newResult.length} lines in ${timeNew}ms`);
  // console.log(`  Old Parser: ${oldResult.length} lines in ${timeOld}ms`);
  console.log(`  Images attached: ${newResult.filter(l => l.meta.imageRef).length}`);
  console.log(`  Joinery metadata: ${newResult.filter(l => l.meta.dimensions || l.meta.wood).length} lines\n`);

  return { newResult, timeNew, timeOld };
}

// ============================================================================
// EXAMPLE 6: Filter By Product Type
// ============================================================================

export async function example6_FilterByType(pdfBuffer: Buffer, productType: string) {
  console.log(`=== Example 6: Filter by Type "${productType}" ===\n`);

  const layout = await extractPdfLayout(pdfBuffer);
  const allLines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });

  // Filter by product type
  const filtered = allLines.filter(line => 
    line.meta.productType?.toLowerCase() === productType.toLowerCase()
  );

  console.log(`Found ${filtered.length} "${productType}" items out of ${allLines.length} total\n`);
  
  filtered.forEach((line, index) => {
    console.log(`${index + 1}. ${line.description} - ${line.meta.dimensions || 'no dims'}`);
  });

  return filtered;
}

// ============================================================================
// EXAMPLE 7: Calculate Price Summary
// ============================================================================

export async function example7_PriceSummary(pdfBuffer: Buffer) {
  console.log('=== Example 7: Price Summary ===\n');

  const layout = await extractPdfLayout(pdfBuffer);
  const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });

  // Calculate totals
  let subtotal = 0;
  let itemsWithPrices = 0;

  lines.forEach(line => {
    if (line.totalPrice != null && Number.isFinite(line.totalPrice)) {
      subtotal += line.totalPrice;
      itemsWithPrices++;
    }
  });

  console.log(`Total Lines: ${lines.length}`);
  console.log(`Lines with Prices: ${itemsWithPrices}`);
  console.log(`Subtotal: £${subtotal.toFixed(2)}`);
  console.log(`Average per item: £${(subtotal / itemsWithPrices).toFixed(2)}\n`);

  // Group by product type
  const byType: Record<string, number> = {};
  lines.forEach(line => {
    const type = line.meta.productType || 'unknown';
    byType[type] = (byType[type] || 0) + (line.totalPrice || 0);
  });

  console.log('Breakdown by Type:');
  Object.entries(byType).forEach(([type, total]) => {
    console.log(`  ${type}: £${total.toFixed(2)}`);
  });

  return { subtotal, itemsWithPrices, byType };
}

// ============================================================================
// EXAMPLE 8: Validate Data Quality
// ============================================================================

export async function example8_ValidateQuality(pdfBuffer: Buffer) {
  console.log('=== Example 8: Data Quality Validation ===\n');

  const layout = await extractPdfLayout(pdfBuffer);
  const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });

  // Quality metrics
  const metrics = {
    totalLines: lines.length,
    linesWithQty: lines.filter(l => l.qty != null).length,
    linesWithPrice: lines.filter(l => l.unitPrice != null || l.totalPrice != null).length,
    linesWithDimensions: lines.filter(l => l.meta.dimensions).length,
    linesWithWood: lines.filter(l => l.meta.wood).length,
    linesWithFinish: lines.filter(l => l.meta.finish).length,
    linesWithGlass: lines.filter(l => l.meta.glass).length,
  };

  // Calculate quality score (0-100)
  const score = Math.round(
    (metrics.linesWithQty / metrics.totalLines * 20) +
    (metrics.linesWithPrice / metrics.totalLines * 30) +
    (metrics.linesWithDimensions / metrics.totalLines * 25) +
    (metrics.linesWithWood / metrics.totalLines * 15) +
    (metrics.linesWithFinish / metrics.totalLines * 10)
  );

  console.log('Quality Metrics:');
  console.log(`  ✓ Lines with quantity: ${metrics.linesWithQty}/${metrics.totalLines} (${Math.round(metrics.linesWithQty/metrics.totalLines*100)}%)`);
  console.log(`  ✓ Lines with pricing: ${metrics.linesWithPrice}/${metrics.totalLines} (${Math.round(metrics.linesWithPrice/metrics.totalLines*100)}%)`);
  console.log(`  ✓ Lines with dimensions: ${metrics.linesWithDimensions}/${metrics.totalLines} (${Math.round(metrics.linesWithDimensions/metrics.totalLines*100)}%)`);
  console.log(`  ✓ Lines with wood type: ${metrics.linesWithWood}/${metrics.totalLines} (${Math.round(metrics.linesWithWood/metrics.totalLines*100)}%)`);
  console.log(`  ✓ Lines with finish: ${metrics.linesWithFinish}/${metrics.totalLines} (${Math.round(metrics.linesWithFinish/metrics.totalLines*100)}%)`);
  console.log(`  ✓ Lines with glass spec: ${metrics.linesWithGlass}/${metrics.totalLines} (${Math.round(metrics.linesWithGlass/metrics.totalLines*100)}%)`);
  console.log(`\n📊 Quality Score: ${score}/100\n`);

  return { metrics, score };
}

// ============================================================================
// CLI RUNNER (for testing)
// ============================================================================

if (require.main === module) {
  const fs = require('fs');
  
  // Get PDF file from command line
  const pdfPath = process.argv[2];
  
  if (!pdfPath) {
    console.error('Usage: node quickstart-examples.js <path-to-pdf>');
    process.exit(1);
  }
  
  const buffer = fs.readFileSync(pdfPath);
  
  // Run all examples
  (async () => {
    await example1_BasicParsing(buffer);
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example2_WithImages(buffer);
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example3_JoineryMetadata(buffer);
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example7_PriceSummary(buffer);
    console.log('\n' + '='.repeat(60) + '\n');
    
    await example8_ValidateQuality(buffer);
  })().catch(console.error);
}
