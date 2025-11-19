# PDF Test Fixtures

This directory contains sample PDF files used for regression testing the unified PDF parsing pipeline.

## Required Test Files

To run the full test suite, add these PDF files:

### Supplier Quotes
- `supplier-quote-example.pdf` - Basic supplier quote with joinery items
- `supplier-quote-with-images.pdf` - Quote with product elevation images
- `supplier-quote-with-delivery.pdf` - Quote including delivery charges
- `supplier-quote-detailed.pdf` - Quote with full product metadata (wood, finish, glass)

### User-Provided Quotes
- `user-quote-example.pdf` - Basic user-uploaded quote
- `user-quote-pricing.pdf` - User quote with detailed pricing

### Historic Quotes
- `historic-quote-example.pdf` - Historic quote for ML training

### Image Classification Tests
- `quote-with-header-logo.pdf` - Quote with company logo in header
- `quote-with-repeated-badges.pdf` - Quote with repeated badge images
- `quote-with-images-mixed.pdf` - Quote with both joinery images and delivery items

### Error Handling
- `empty-document.pdf` - Empty or minimal PDF

## Creating Test Fixtures

1. **Supplier Quotes**: Export real supplier quotes (anonymized) or create samples with:
   - Product descriptions with dimensions
   - Pricing columns (qty, unit price, total)
   - Product elevation images
   - Delivery line items

2. **User Quotes**: Create PDFs matching your own quote format with:
   - Clear line item structure
   - Product images per line
   - Consistent pricing format

3. **Image Tests**: Create PDFs with:
   - Company logos in header/footer
   - Repeated badge/icon images
   - Product elevation drawings in mid-page

## Running Tests

```bash
cd api
npm test tests/pdfParsing.test.ts
```

Tests will skip gracefully if fixture PDFs are missing, but comprehensive testing requires all fixtures.

## Privacy Note

Do not commit PDFs containing real client data. Anonymize or create synthetic test PDFs.
