# 📚 Shared PDF Parser - Quick Reference Card

## 🚀 Quick Start (3 lines)

```typescript
import { extractPdfLayout, buildLineItemsFromText } from './lib/pdfParsing';
const layout = await extractPdfLayout(pdfBuffer);
const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
```

## 📦 Core Functions

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `extractPdfLayout(buffer)` | PDF Buffer | `{ pages, textBlocks, images }` | Extract text + images with coordinates |
| `buildLineItemsFromText(blocks, opts?)` | Text blocks | `ParsedLineLike[]` | Parse into structured line items |
| `classifyAndFilterImages(images, pages)` | Images, pages | `PdfImageBlock[]` | Remove logos/headers/footers |
| `attachImagesToLines(lines, images)` | Lines, images | `ParsedLineLike[]` | Match images to product lines |
| `parseFromPlainText(text)` | Plain text | `ParsedLineLike[]` | Fallback parser |

## 🏗️ Data Types

```typescript
// Input: PDF Layout
type PdfLayout = {
  pages: { width: number; height: number }[];
  textBlocks: PdfTextBlock[];  // { page, x, y, width, height, text }
  images: PdfImageBlock[];      // { page, x, y, width, height, data, hash }
};

// Output: Parsed Line
type ParsedLineLike = {
  description: string;
  qty: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  meta: {
    dimensions?: string;        // "2400x2100mm"
    area?: string;              // "5.04m²"
    productType?: string;       // "bifold", "door", "window"
    wood?: string;              // "oak", "pine"
    finish?: string;            // "factory finished"
    glass?: string;             // "double glazed"
    imageRef?: { page: number; hash: string };
  };
};
```

## 🎯 Common Patterns

### Parse supplier quote
```typescript
const layout = await extractPdfLayout(buffer);
const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: true });
const cleanImages = classifyAndFilterImages(layout.images, layout.pages);
const result = attachImagesToLines(lines, cleanImages);
```

### Parse JoinerySoft export
```typescript
const layout = await extractPdfLayout(buffer);
const lines = buildLineItemsFromText(layout.textBlocks, { joineryOnly: false });
// Access dimensions, wood, finish automatically
```

### Filter by product type
```typescript
const doors = lines.filter(l => l.meta.productType === 'door');
const windows = lines.filter(l => l.meta.productType === 'window');
```

### Calculate total
```typescript
const total = lines.reduce((sum, l) => sum + (l.totalPrice || 0), 0);
```

### Find lines with images
```typescript
const withImages = lines.filter(l => l.meta.imageRef);
```

## 🔍 Joinery Detection Patterns

| Feature | Example Match | Regex |
|---------|--------------|-------|
| Dimensions | `2400x2100mm` | `/\b(\d{3,4})\s*[xX×]\s*(\d{3,4})\s*mm\b/` |
| Area | `5.04m²` | `/\b(\d+(?:\.\d+)?)\s*m[²2]\b/` |
| Price | `£1,234.56` | `/£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/` |
| Product | `bifold`, `door` | `/\b(door\|window\|bifold\|sash\|frame...)\b/` |
| Wood | `oak`, `hardwood` | `/\b(oak\|pine\|hardwood\|mahogany...)\b/` |
| Finish | `painted` | `/\b(painted\|stained\|varnished...)\b/` |
| Glass | `double glazed` | `/\b(single glazed\|double glazed...)\b/` |

## 🖼️ Image Classification

### Filtered Out
- ❌ Top 15% of page (headers)
- ❌ Bottom 15% of page (footers)
- ❌ Size < 60x60px (icons/badges)
- ❌ Appearing >3 times (logos)
- ❌ Aspect ratio >10:1 or <1:10 (borders)

### Kept
- ✅ Mid-page images (15-85%)
- ✅ Size >= 60x60px
- ✅ Unique or rare (<= 3 occurrences)
- ✅ Normal aspect ratio

## 🧪 Testing

```typescript
// Test basic parsing
expect(lines[0].description).toContain('Oak Door');
expect(lines[0].meta.dimensions).toBe('2400x2100mm');

// Test image filtering
const filtered = classifyAndFilterImages(images, pages);
expect(filtered.length).toBeLessThan(images.length);

// Test image attachment
const result = attachImagesToLines(lines, images);
expect(result[0].meta.imageRef).toBeDefined();
```

## 🚦 Migration Guide

### Step 1: Enable feature flag
```bash
export USE_SHARED_PARSER=true
```

### Step 2: Import V2 parser
```typescript
import { parseSupplierPdfV2 } from './lib/supplier/parseV2';
```

### Step 3: Compare results
```typescript
import { compareParserResults } from './lib/supplier/parseV2';
const comparison = await compareParserResults(buffer);
console.log(comparison);
```

### Step 4: Roll out gradually
- Test with sample PDFs
- Monitor accuracy metrics
- Deploy to production

## 📊 Performance

| Operation | Time (typical) | Notes |
|-----------|----------------|-------|
| `extractPdfLayout()` | 100-500ms | Depends on PDF size |
| `buildLineItemsFromText()` | 10-50ms | Fast regex-based |
| `classifyAndFilterImages()` | 5-20ms | Simple filters |
| `attachImagesToLines()` | 5-10ms | Proximity matching |
| **Total** | ~200-600ms | Comparable to legacy |

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Images not attached | Check filter thresholds in `classifyAndFilterImages()` |
| Lines not detected | Try `joineryOnly: false` to see all lines |
| Low extraction quality | Use OCR fallback for scanned PDFs |
| Missing metadata | Check if regex patterns match your text format |

## 📁 File Locations

| File | Purpose |
|------|---------|
| `api/src/lib/pdfParsing.ts` | Core shared parser |
| `api/src/lib/supplier/parseV2.ts` | Example refactored supplier parser |
| `api/src/examples/quickstart-pdfParser.ts` | Usage examples |
| `SHARED_PDF_PARSER_GUIDE.md` | Complete documentation |
| `SHARED_PDF_PARSER_SUMMARY.md` | Implementation summary |

## 🔗 Related Files

- `api/src/lib/pdf/extract.ts` - Text extraction
- `api/src/lib/pdf/extractImages.ts` - Image extraction
- `api/src/types/parse.ts` - Type definitions

---

**Need help?** See `SHARED_PDF_PARSER_GUIDE.md` for detailed documentation
