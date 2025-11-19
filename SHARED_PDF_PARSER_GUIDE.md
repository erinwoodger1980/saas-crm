# Shared PDF Parser Integration Guide

## Overview

The shared PDF parser (`api/src/lib/pdfParsing.ts`) provides a unified, intelligent layer for parsing **all** PDF types in the system:

- ✅ **Supplier quotes** - Extract line items with prices
- ✅ **JoinerySoft exports** - Parse estimating software PDFs
- ✅ **ML training data** - Historic quote PDFs for training

## Key Benefits

1. **Consistency** - Same extraction logic across all PDF sources
2. **Joinery Intelligence** - Built-in detection for dimensions, wood types, finishes, glass
3. **Smart Image Filtering** - Removes logos/badges, keeps only joinery elevations
4. **Image-Line Matching** - Automatically attaches relevant images to products
5. **Fallback Support** - Gracefully handles poorly structured PDFs

## Architecture

```
┌─────────────────────────────────────┐
│   Shared PDF Parser (pdfParsing.ts) │
│  ─────────────────────────────────  │
│  • extractPdfLayout()                │
│  • buildLineItemsFromText()          │
│  • classifyAndFilterImages()         │
│  • attachImagesToLines()             │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴───────────┬───────────────┐
    │                      │               │
┌───▼──────┐      ┌───────▼─────┐  ┌──────▼────────┐
│ Supplier │      │ JoinerySoft │  │  ML Training  │
│  Parser  │      │   Parser    │  │   Ingestion   │
└──────────┘      └─────────────┘  └───────────────┘
```

## Core Functions

### 1. `extractPdfLayout(buffer)`

Extracts text blocks and images with layout coordinates.

```typescript
import { extractPdfLayout } from './lib/pdfParsing';

const layout = await extractPdfLayout(pdfBuffer);

// Returns:
{
  pages: [{ width: 612, height: 792 }],
  textBlocks: [
    { page: 0, x: 50, y: 100, width: 400, height: 18, text: "Oak Bifold Door 2400x2100mm" },
    // ...
  ],
  images: [
    { page: 0, x: 100, y: 200, width: 300, height: 400, data: Uint8Array, hash: "abc123..." },
    // ...
  ]
}
```

### 2. `buildLineItemsFromText(textBlocks, options?)`

Parses text blocks into structured line items using joinery heuristics.

```typescript
import { buildLineItemsFromText } from './lib/pdfParsing';

const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });

// Returns:
[
  {
    description: "Oak Bifold Door",
    qty: 2,
    unitPrice: 1250.00,
    totalPrice: 2500.00,
    meta: {
      dimensions: "2400x2100mm",
      area: "5.04m²",
      productType: "bifold",
      wood: "oak",
      finish: "factory finished",
      glass: "double glazed"
    }
  },
  // ...
]
```

### 3. `classifyAndFilterImages(images, pages)`

Filters out non-joinery images (logos, headers, footers, duplicates).

```typescript
import { classifyAndFilterImages } from './lib/pdfParsing';

const joineryImages = classifyAndFilterImages(layout.images, layout.pages);

// Removes:
// - Images in top/bottom 15% (headers/footers)
// - Tiny images < 60x60px (icons/badges)
// - Images appearing >3 times (logos)
// - Very wide/narrow images (decorative borders)
```

### 4. `attachImagesToLines(lines, images)`

Matches joinery images to appropriate product lines by proximity.

```typescript
import { attachImagesToLines } from './lib/pdfParsing';

const linesWithImages = attachImagesToLines(lines, joineryImages);

// Adds imageRef to relevant lines:
{
  description: "Oak Bifold Door",
  // ...
  meta: {
    // ...
    imageRef: { page: 0, hash: "abc123..." }
  }
}
```

## Integration Examples

### Example 1: Refactoring Supplier Parser

**Before** (api/src/lib/supplier/parse.ts):

```typescript
export async function parseSupplierPdf(
  buffer: Buffer,
  options?: { supplier?: string; currency?: string }
): Promise<SupplierParseResult> {
  // Custom extraction logic
  const extraction = extractStructuredText(buffer);
  const { result, metadata } = buildSupplierParse(extraction);
  
  // Custom line parsing
  let baseParse: SupplierParseResult = {
    supplier: result.supplier || options?.supplier,
    currency: result.currency || inferCurrency(result),
    lines: result.lines,
    // ...
  };
  
  // No image handling
  return baseParse;
}
```

**After** (using shared parser):

```typescript
import {
  extractPdfLayout,
  buildLineItemsFromText,
  classifyAndFilterImages,
  attachImagesToLines,
  type ParsedLineLike,
} from '../pdfParsing';

export async function parseSupplierPdf(
  buffer: Buffer,
  options?: { supplier?: string; currency?: string }
): Promise<SupplierParseResult> {
  // Use shared extraction
  const layout = await extractPdfLayout(buffer);
  
  // Build line items with joinery intelligence
  const genericLines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
  
  // Filter and classify images
  const joineryImages = classifyAndFilterImages(layout.images, layout.pages);
  
  // Attach images to lines
  const linesWithImages = attachImagesToLines(genericLines, joineryImages);
  
  // Convert to SupplierParseResult format
  const supplierLines = linesWithImages.map((line) => ({
    description: line.description,
    qty: line.qty || undefined,
    unit: line.meta.productType || 'item',
    costUnit: line.unitPrice || undefined,
    lineTotal: line.totalPrice || undefined,
    // Transfer meta fields
    dimensions: line.meta.dimensions,
    area: line.meta.area,
    wood: line.meta.wood,
    finish: line.meta.finish,
    glass: line.meta.glass,
    imageHash: line.meta.imageRef?.hash,
  }));
  
  return {
    supplier: options?.supplier || detectSupplier(layout.textBlocks),
    currency: options?.currency || 'GBP',
    lines: supplierLines,
    detected_totals: {},
    confidence: 0.9,
    usedStages: ['shared-parser'],
  };
}
```

### Example 2: JoinerySoft PDF Integration

```typescript
import {
  extractPdfLayout,
  buildLineItemsFromText,
  attachImagesToLines,
  classifyAndFilterImages,
} from './lib/pdfParsing';

export async function parseJoinerysoftPdf(buffer: Buffer) {
  // Extract layout
  const layout = await extractPdfLayout(buffer);
  
  // Build line items (JoinerySoft PDFs are well-structured, so no filtering needed)
  const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: false });
  
  // Process images
  const cleanImages = classifyAndFilterImages(layout.images, layout.pages);
  const linesWithImages = attachImagesToLines(lines, cleanImages);
  
  // Map to database format
  return {
    source: 'joinerysoft',
    lines: linesWithImages,
    images: cleanImages,
  };
}
```

### Example 3: ML Training Data Ingestion

```typescript
import {
  extractPdfLayout,
  buildLineItemsFromText,
  attachImagesToLines,
  classifyAndFilterImages,
} from './lib/pdfParsing';

export async function ingestHistoricQuoteForTraining(pdfPath: string) {
  const buffer = await fs.readFile(pdfPath);
  
  // Extract with shared parser
  const layout = await extractPdfLayout(buffer);
  const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
  
  // Filter joinery images only
  const joineryImages = classifyAndFilterImages(layout.images, layout.pages);
  const linesWithImages = attachImagesToLines(lines, joineryImages);
  
  // Save to ML training database
  for (const line of linesWithImages) {
    await saveTrainingExample({
      description: line.description,
      features: {
        dimensions: line.meta.dimensions,
        area: line.meta.area,
        wood: line.meta.wood,
        finish: line.meta.finish,
        glass: line.meta.glass,
        productType: line.meta.productType,
      },
      target: {
        unitPrice: line.unitPrice,
        totalPrice: line.totalPrice,
      },
      hasImage: !!line.meta.imageRef,
    });
  }
  
  return {
    linesIngested: lines.length,
    imagesAttached: linesWithImages.filter(l => l.meta.imageRef).length,
  };
}
```

## Joinery Detection Patterns

The shared parser includes built-in regex patterns for joinery-specific extraction:

| Pattern | Regex | Example Matches |
|---------|-------|-----------------|
| **Dimensions** | `/\b(\d{3,4})\s*[xX×]\s*(\d{3,4})\s*mm\b/` | 2400x2100mm, 1200 x 800mm |
| **Area** | `/\b(\d+(?:\.\d+)?)\s*m[²2]\b/` | 5.04m², 3.5 m2 |
| **Money** | `/£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/` | £1,234.56, £250 |
| **Keywords** | `/\b(door\|window\|bifold\|sash\|frame...)\b/` | door, bifold, casement |
| **Wood Types** | `/\b(oak\|pine\|hardwood\|mahogany...)\b/` | oak, hardwood, pine |
| **Finishes** | `/\b(painted\|stained\|varnished...)\b/` | factory finished, painted |
| **Glass** | `/\b(single glazed\|double glazed...)\b/` | double glazed, toughened |
| **Quantity** | `/^(\d+)\s+(?:x\s+\|nr\.?\s+)?/` | 2 x, 5 nr. |

## Migration Strategy

### Phase 1: Supplier Parser (Week 1)

1. ✅ Create shared parser module (`pdfParsing.ts`)
2. Create wrapper function `parseSupplierPdfV2()` using shared parser
3. Add feature flag `USE_SHARED_PARSER` to environment
4. Run A/B testing comparing old vs new parser results
5. Monitor for accuracy regressions
6. Gradually roll out to production

### Phase 2: JoinerySoft Integration (Week 2)

1. Identify JoinerySoft PDF detection logic
2. Create `parseJoinerysoftPdf()` using shared parser
3. Update quote upload handler to detect and route JoinerySoft PDFs
4. Test with sample JoinerySoft exports
5. Deploy to production

### Phase 3: ML Training Pipeline (Week 3)

1. Update ML ingestion script (`ml/email_trainer.py` or similar)
2. Call shared parser via API endpoint
3. Verify training data quality improvements
4. Retrain model with new consistent features
5. Deploy updated model

## Testing

Create comprehensive tests for the shared parser:

```typescript
// api/tests/pdfParsing.test.ts
import { extractPdfLayout, buildLineItemsFromText, classifyAndFilterImages, attachImagesToLines } from '../src/lib/pdfParsing';
import fs from 'fs';

describe('Shared PDF Parser', () => {
  describe('extractPdfLayout', () => {
    it('should extract text blocks and images', async () => {
      const buffer = fs.readFileSync('fixtures/sample-supplier-quote.pdf');
      const layout = await extractPdfLayout(buffer);
      
      expect(layout.textBlocks.length).toBeGreaterThan(0);
      expect(layout.images.length).toBeGreaterThan(0);
      expect(layout.pages.length).toBe(1);
    });
  });
  
  describe('buildLineItemsFromText', () => {
    it('should parse joinery line items', () => {
      const textBlocks = [
        { page: 0, x: 0, y: 0, width: 400, height: 18, text: '2 x Oak Bifold Door 2400x2100mm £2,500.00' },
      ];
      
      const lines = buildLineItemsFromText(textBlocks, { joineryOnly: true });
      
      expect(lines).toHaveLength(1);
      expect(lines[0].description).toContain('Oak Bifold Door');
      expect(lines[0].qty).toBe(2);
      expect(lines[0].meta.dimensions).toBe('2400x2100mm');
      expect(lines[0].meta.wood).toBe('oak');
      expect(lines[0].meta.productType).toBe('bifold');
    });
    
    it('should filter out non-joinery items when joineryOnly=true', () => {
      const textBlocks = [
        { page: 0, x: 0, y: 0, width: 400, height: 18, text: 'Office supplies £50.00' },
      ];
      
      const lines = buildLineItemsFromText(textBlocks, { joineryOnly: true });
      
      expect(lines).toHaveLength(0);
    });
  });
  
  describe('classifyAndFilterImages', () => {
    it('should remove logos and headers', () => {
      const images = [
        { page: 0, x: 50, y: 10, width: 100, height: 50, data: new Uint8Array(), hash: 'logo1' }, // Header
        { page: 0, x: 50, y: 750, width: 100, height: 50, data: new Uint8Array(), hash: 'footer1' }, // Footer
        { page: 0, x: 50, y: 400, width: 300, height: 400, data: new Uint8Array(), hash: 'product1' }, // Valid
      ];
      
      const pages = [{ width: 612, height: 792 }];
      const filtered = classifyAndFilterImages(images, pages);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].hash).toBe('product1');
    });
  });
  
  describe('attachImagesToLines', () => {
    it('should attach images to nearby product lines', () => {
      const lines = [
        { description: 'Oak Door', qty: 1, unitPrice: 500, totalPrice: 500, meta: { productType: 'door' } },
      ];
      
      const images = [
        { page: 0, x: 50, y: 10, width: 300, height: 400, data: new Uint8Array(), hash: 'img1' },
      ];
      
      const result = attachImagesToLines(lines, images);
      
      expect(result[0].meta.imageRef).toBeDefined();
      expect(result[0].meta.imageRef?.hash).toBe('img1');
    });
  });
});
```

## Performance Considerations

- **Caching**: Consider caching extracted layouts for large PDFs
- **Streaming**: For very large PDFs, consider streaming text extraction
- **Image Processing**: Image classification can be expensive - run in background if needed
- **Parallelization**: Extract text and images in parallel

## Future Enhancements

1. **OCR Fallback**: Integrate Tesseract for scanned PDFs
2. **Layout Analysis**: Improve column detection for complex table layouts
3. **Supplier-Specific Tuning**: Allow per-supplier regex overrides
4. **ML-Enhanced Classification**: Use ML to improve image classification accuracy
5. **Multi-Language Support**: Add support for non-English joinery terms

## Support & Troubleshooting

### Common Issues

**Issue**: Images not being attached to lines
- **Solution**: Check that images pass size/position filters. Adjust thresholds in `classifyAndFilterImages()`

**Issue**: Line items not detected
- **Solution**: Enable `joineryOnly: false` to see all detected lines. Check if patterns match your text format.

**Issue**: Low extraction quality
- **Solution**: Use fallback OCR for scanned PDFs. Check `extractPdfLayout()` warnings.

## API Reference

See inline TypeScript documentation in `api/src/lib/pdfParsing.ts` for complete API reference.

---

**Questions?** Contact the dev team or check `/docs/architecture.md`
