/**
 * PDF Parsing Regression Tests
 * 
 * Ensures that the unified PDF parsing pipeline:
 * 1. Extracts line items correctly from supplier PDFs
 * 2. Handles user-provided quote PDFs
 * 3. Processes historic PDFs for ML training
 * 4. Correctly identifies joinery items with images
 * 5. Filters out logos and badges
 * 6. Preserves product metadata (dimensions, area, wood, finish)
 * 
 * These tests prevent parsing regressions that would break:
 * - Quote building workflow
 * - ML training data quality
 * - Proposal PDF generation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  parseQuotePdf,
  type ParsedQuote,
  type ParsedQuoteLine,
} from '../src/lib/pdfParsing';

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '../fixtures/pdfs');

// Helper to load test PDFs
function loadTestPdf(filename: string): Buffer {
  const filepath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`Test PDF not found: ${filepath}`);
    console.warn('Skipping test - create fixture PDFs in api/fixtures/pdfs/');
    return Buffer.from([]);
  }
  return fs.readFileSync(filepath);
}

// Helper assertions
function assertHasJoineryLine(lines: ParsedQuoteLine[]): ParsedQuoteLine {
  const joineryLines = lines.filter((l) => l.kind === 'joinery');
  expect(joineryLines.length).toBeGreaterThan(0);
  return joineryLines[0];
}

function assertHasDimensions(line: ParsedQuoteLine): void {
  expect(line.meta.dimensions).toBeTruthy();
  expect(line.meta.dimensions).toMatch(/\d+x\d+/i);
}

function assertHasPricing(line: ParsedQuoteLine): void {
  expect(line.unitCost).toBeGreaterThan(0);
  expect(line.qty).toBeGreaterThan(0);
}

function assertHasImage(line: ParsedQuoteLine): void {
  expect(line.meta.imageRef).toBeTruthy();
  expect(line.meta.imageRef?.page).toBeGreaterThan(0);
  expect(line.meta.imageRef?.hash).toBeTruthy();
}

function assertNoLogoImages(quote: ParsedQuote): void {
  const logoImages = quote.images?.filter((img) => 
    img.classification === 'logo' || img.classification === 'badge'
  );
  expect(logoImages?.length || 0).toBe(0);
}

describe('Unified PDF Parsing Pipeline', () => {
  describe('Supplier PDF Parsing', () => {
    it('should extract joinery line items from supplier quote', async () => {
      const buffer = loadTestPdf('supplier-quote-example.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
        currencyFallback: 'GBP',
        debug: true,
      });

      // Basic structure
      expect(result).toBeTruthy();
      expect(result.source).toBe('supplier');
      expect(result.lines).toBeTruthy();
      expect(result.lines.length).toBeGreaterThan(0);

      // Should have at least one joinery line
      const joineryLine = assertHasJoineryLine(result.lines);
      
      // Joinery lines should have product details
      expect(joineryLine.description).toBeTruthy();
      expect(joineryLine.description.length).toBeGreaterThan(10);

      // Should extract pricing
      assertHasPricing(joineryLine);

      // Should detect dimensions or area
      const hasDimensions = joineryLine.meta.dimensions || joineryLine.meta.area;
      expect(hasDimensions).toBeTruthy();
    });

    it('should identify and attach joinery elevation images', async () => {
      const buffer = loadTestPdf('supplier-quote-with-images.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
        debug: true,
      });

      // Should have classified images
      expect(result.images).toBeTruthy();
      expect(result.images!.length).toBeGreaterThan(0);

      // Should only have joinery elevations, no logos
      assertNoLogoImages(result);

      // Joinery lines should have image references
      const joineryWithImages = result.lines.filter(
        (l) => l.kind === 'joinery' && l.meta.imageRef
      );
      expect(joineryWithImages.length).toBeGreaterThan(0);
    });

    it('should detect delivery lines separately', async () => {
      const buffer = loadTestPdf('supplier-quote-with-delivery.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      const deliveryLines = result.lines.filter((l) => l.kind === 'delivery');
      expect(deliveryLines.length).toBeGreaterThan(0);

      const deliveryLine = deliveryLines[0];
      expect(deliveryLine.description.toLowerCase()).toMatch(/delivery|shipping|freight/);
      expect(deliveryLine.unitCost).toBeGreaterThan(0);

      // Delivery lines should NOT have images
      expect(deliveryLine.meta.imageRef).toBeFalsy();
    });

    it('should extract product metadata (wood, finish, glass)', async () => {
      const buffer = loadTestPdf('supplier-quote-detailed.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      const joineryLine = assertHasJoineryLine(result.lines);

      // Should extract at least one metadata field
      const hasMetadata =
        joineryLine.meta.wood ||
        joineryLine.meta.finish ||
        joineryLine.meta.glass ||
        joineryLine.meta.type;

      expect(hasMetadata).toBeTruthy();
    });
  });

  describe('User-Provided Quote PDF Parsing', () => {
    it('should parse user-uploaded quote PDFs', async () => {
      const buffer = loadTestPdf('user-quote-example.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'user_quote',
        debug: true,
      });

      expect(result.source).toBe('user_quote');
      expect(result.lines.length).toBeGreaterThan(0);

      // Should still classify lines correctly
      const joineryLine = assertHasJoineryLine(result.lines);
      assertHasPricing(joineryLine);
    });

    it('should preserve original pricing from user quotes', async () => {
      const buffer = loadTestPdf('user-quote-pricing.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'user_quote',
      });

      const joineryLine = assertHasJoineryLine(result.lines);

      // Should have preserved unit cost and line cost
      expect(joineryLine.unitCost).toBeGreaterThan(0);
      expect(joineryLine.lineCost).toBeGreaterThan(0);

      // Line cost should match qty * unitCost (allowing for rounding)
      if (joineryLine.qty && joineryLine.unitCost && joineryLine.lineCost) {
        const calculated = joineryLine.qty * joineryLine.unitCost;
        expect(Math.abs(calculated - joineryLine.lineCost)).toBeLessThan(1.0);
      }
    });
  });

  describe('Historic PDF Parsing for ML Training', () => {
    it('should parse historic PDFs for training data', async () => {
      const buffer = loadTestPdf('historic-quote-example.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'historic',
      });

      expect(result.source).toBe('historic');
      expect(result.lines).toBeTruthy();

      // Historic PDFs should still extract structured data
      if (result.lines.length > 0) {
        const firstLine = result.lines[0];
        expect(firstLine.description).toBeTruthy();
      }
    });
  });

  describe('Image Classification', () => {
    it('should filter out header/footer logos', async () => {
      const buffer = loadTestPdf('quote-with-header-logo.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      // Should have filtered out logo images
      assertNoLogoImages(result);

      // But should still have joinery images if present
      if (result.images && result.images.length > 0) {
        const joineryImages = result.images.filter(
          (img) => img.classification === 'joinery_elevation'
        );
        expect(joineryImages.length).toBeGreaterThan(0);
      }
    });

    it('should filter out repeated badge images', async () => {
      const buffer = loadTestPdf('quote-with-repeated-badges.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      // Should not have duplicate badge images
      if (result.images) {
        const hashes = result.images.map((img) => img.hash);
        const uniqueHashes = new Set(hashes);
        
        // Filtered images should be mostly unique (allow some overlap for multi-page elevation views)
        expect(uniqueHashes.size).toBeGreaterThan(hashes.length * 0.8);
      }
    });

    it('should only attach images to joinery lines, not delivery', async () => {
      const buffer = loadTestPdf('quote-with-images-mixed.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      // Check that delivery lines don't have images
      const deliveryLines = result.lines.filter((l) => l.kind === 'delivery');
      if (deliveryLines.length > 0) {
        for (const deliveryLine of deliveryLines) {
          expect(deliveryLine.meta.imageRef).toBeFalsy();
        }
      }

      // But joinery lines should have images if available
      const joineryLines = result.lines.filter((l) => l.kind === 'joinery');
      if (joineryLines.length > 0 && result.images && result.images.length > 0) {
        const joineryWithImages = joineryLines.filter((l) => l.meta.imageRef);
        expect(joineryWithImages.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Fallback and Error Handling', () => {
    it('should handle malformed PDFs gracefully', async () => {
      const buffer = Buffer.from('not a valid pdf');

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      // Should not throw, but return fallback result
      expect(result).toBeTruthy();
      expect(result.lines).toEqual([]);
      expect(result.warnings).toBeTruthy();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });

    it('should handle empty PDFs', async () => {
      const buffer = loadTestPdf('empty-document.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      expect(result).toBeTruthy();
      expect(result.lines).toEqual([]);
    });

    it('should provide confidence scores', async () => {
      const buffer = loadTestPdf('supplier-quote-example.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent currency across all lines', async () => {
      const buffer = loadTestPdf('supplier-quote-example.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
        currencyFallback: 'GBP',
      });

      expect(result.currency).toBe('GBP');

      // All lines should have same currency
      for (const line of result.lines) {
        if (line.currency) {
          expect(line.currency).toBe('GBP');
        }
      }
    });

    it('should assign unique IDs to all lines', async () => {
      const buffer = loadTestPdf('supplier-quote-example.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      const ids = result.lines.map((l) => l.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should calculate line costs correctly', async () => {
      const buffer = loadTestPdf('supplier-quote-example.pdf');
      if (buffer.length === 0) {
        console.warn('Skipping test - no fixture PDF');
        return;
      }

      const result = await parseQuotePdf(buffer, {
        source: 'supplier',
      });

      for (const line of result.lines) {
        if (line.qty && line.unitCost && line.lineCost) {
          const calculated = line.qty * line.unitCost;
          // Allow for small rounding differences
          expect(Math.abs(calculated - line.lineCost)).toBeLessThan(1.0);
        }
      }
    });
  });
});

describe('Helper Functions', () => {
  describe('convertToDbFormat', () => {
    it('should convert ParsedQuoteLine to database format', async () => {
      const { convertToDbFormat } = await import('../src/lib/pdfParsing');
      
      const line: ParsedQuoteLine = {
        id: 'test-123',
        kind: 'joinery',
        description: 'Oak Door 2475x2058mm',
        qty: 1,
        unitCost: 4321.86,
        lineCost: 4321.86,
        currency: 'GBP',
        meta: {
          dimensions: '2475x2058mm',
          area: '5.09m²',
          wood: 'Oak',
        },
      };

      const dbFormat = convertToDbFormat(line, {
        quoteId: 'quote-456',
        tenantId: 'tenant-789',
        order: 0,
      });

      expect(dbFormat.quoteId).toBe('quote-456');
      expect(dbFormat.tenantId).toBe('tenant-789');
      expect(dbFormat.kind).toBe('JOINERY');
      expect(dbFormat.description).toBe('Oak Door 2475x2058mm');
      expect(dbFormat.qty).toBe(1);
      expect(dbFormat.costUnit).toBe(4321.86);
      expect(dbFormat.meta).toBeTruthy();
      
      // Meta should be stringified JSON
      const parsedMeta = JSON.parse(dbFormat.meta);
      expect(parsedMeta.dimensions).toBe('2475x2058mm');
    });
  });

  describe('extractJoineryLinesWithImages', () => {
    it('should extract only joinery lines with images', async () => {
      const { extractJoineryLinesWithImages } = await import('../src/lib/pdfParsing');
      
      const quote: ParsedQuote = {
        source: 'supplier',
        currency: 'GBP',
        lines: [
          {
            id: '1',
            kind: 'joinery',
            description: 'Door with image',
            qty: 1,
            unitCost: 1000,
            lineCost: 1000,
            meta: {
              imageRef: {
                page: 1,
                hash: 'abc123',
                dataUrl: 'data:image/png;base64,abc123',
              },
            },
          },
          {
            id: '2',
            kind: 'joinery',
            description: 'Door without image',
            qty: 1,
            unitCost: 1000,
            lineCost: 1000,
            meta: {},
          },
          {
            id: '3',
            kind: 'delivery',
            description: 'Delivery',
            qty: 1,
            unitCost: 100,
            lineCost: 100,
            meta: {},
          },
        ],
      };

      const result = extractJoineryLinesWithImages(quote);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
      expect(result[0].imageDataUrl).toBe('data:image/png;base64,abc123');
    });
  });
});
