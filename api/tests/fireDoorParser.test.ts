/**
 * Fire Door CSV Parser Tests
 * Unit tests for currency parsing, row parsing, and CSV validation
 */

import { describe, test, expect } from '@jest/globals';
import {
  parseCurrencyToDecimal,
  parseIntValue,
  parseFloatValue,
  cleanTextValue,
  parseFireDoorRow,
  parseFireDoorCSV,
  calculateTotalValue,
  validateCSVHeaders,
} from '../src/lib/fireDoorImport/parser';

describe('parseCurrencyToDecimal', () => {
  test('handles GBP currency symbols', () => {
    expect(parseCurrencyToDecimal('£1,104.00')).toBe(1104.00);
    expect(parseCurrencyToDecimal('£1104')).toBe(1104);
    expect(parseCurrencyToDecimal('£ 1,104.50')).toBe(1104.50);
  });

  test('handles other currency symbols', () => {
    expect(parseCurrencyToDecimal('$1,104.00')).toBe(1104.00);
    // Note: European format (€1.104,00) not currently supported
    // UK/US format with commas as thousands separator is the target
  });

  test('handles plain numbers', () => {
    expect(parseCurrencyToDecimal('1104.50')).toBe(1104.50);
    expect(parseCurrencyToDecimal('1,104')).toBe(1104);
  });

  test('handles null/empty values', () => {
    expect(parseCurrencyToDecimal(null)).toBeNull();
    expect(parseCurrencyToDecimal(undefined)).toBeNull();
    expect(parseCurrencyToDecimal('')).toBeNull();
    expect(parseCurrencyToDecimal('-')).toBeNull();
    expect(parseCurrencyToDecimal('   ')).toBeNull();
  });

  test('handles invalid values', () => {
    expect(parseCurrencyToDecimal('N/A')).toBeNull();
    expect(parseCurrencyToDecimal('TBC')).toBeNull();
  });
});

describe('parseIntValue', () => {
  test('parses integers', () => {
    expect(parseIntValue('5')).toBe(5);
    expect(parseIntValue('100')).toBe(100);
    expect(parseIntValue(' 42 ')).toBe(42);
  });

  test('handles null/empty', () => {
    expect(parseIntValue(null)).toBeNull();
    expect(parseIntValue('')).toBeNull();
    expect(parseIntValue('-')).toBeNull();
  });
});

describe('parseFloatValue', () => {
  test('parses floats', () => {
    expect(parseFloatValue('2.5')).toBe(2.5);
    expect(parseFloatValue('1,234.56')).toBe(1234.56);
    expect(parseFloatValue('100.00')).toBe(100);
  });

  test('handles null/empty', () => {
    expect(parseFloatValue(null)).toBeNull();
    expect(parseFloatValue('')).toBeNull();
  });
});

describe('cleanTextValue', () => {
  test('cleans text', () => {
    expect(cleanTextValue(' hello ')).toBe('hello');
    expect(cleanTextValue('FD30S')).toBe('FD30S');
  });

  test('handles empty values', () => {
    expect(cleanTextValue(null)).toBeNull();
    expect(cleanTextValue('')).toBeNull();
    expect(cleanTextValue('-')).toBeNull();
    expect(cleanTextValue('   ')).toBeNull();
  });
});

describe('parseFireDoorRow', () => {
  test('parses complete row', () => {
    const rawRow = {
      'Item': 'Product',
      'Code': 'FD001',
      'Quantity': '2',
      'Door Ref': 'DR-001',
      'Location': 'First Floor',
      'Fire Rating': 'FD30S',
      'Leaf Height': '2100',
      'M Leaf Width': '926',
      'Value': '£1,104.00',
      'Cost of Labour': '£200.00',
      'Cost of Materials': '£800.00',
    };

    const parsed = parseFireDoorRow(rawRow, 0);

    expect(parsed.itemType).toBe('Product');
    expect(parsed.code).toBe('FD001');
    expect(parsed.quantity).toBe(2);
    expect(parsed.doorRef).toBe('DR-001');
    expect(parsed.location).toBe('First Floor');
    expect(parsed.fireRating).toBe('FD30S');
    expect(parsed.leafHeight).toBe(2100);
    expect(parsed.masterLeafWidth).toBe(926);
    expect(parsed.unitValue).toBe(1104.00);
    expect(parsed.labourCost).toBe(200.00);
    expect(parsed.materialCost).toBe(800.00);
    expect(parsed.lineTotal).toBe(2208.00); // 1104 * 2
  });

  test('calculates line total with default quantity of 1', () => {
    const rawRow = {
      'Item': 'Product',
      'Value': '£500.00',
    };

    const parsed = parseFireDoorRow(rawRow, 0);
    expect(parsed.lineTotal).toBe(500.00);
  });

  test('stores raw row JSON', () => {
    const rawRow = {
      'Item': 'Product',
      'Custom Field': 'Custom Value',
    };

    const parsed = parseFireDoorRow(rawRow, 0);
    expect(parsed.rawRowJson).toEqual(rawRow);
  });
});

describe('parseFireDoorCSV', () => {
  test('parses valid CSV with multiple products', () => {
    const csv = `Item,Code,Quantity,Door Ref,Value
Product,FD001,1,DR-001,£1000.00
Header,,,
Product,FD002,2,DR-002,£500.00`;

    const parsed = parseFireDoorCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].code).toBe('FD001');
    expect(parsed[0].lineTotal).toBe(1000);
    expect(parsed[1].code).toBe('FD002');
    expect(parsed[1].lineTotal).toBe(1000); // 500 * 2
  });

  test('filters out non-Product rows', () => {
    const csv = `Item,Code
Header,H001
Product,FD001
Footer,F001
Product,FD002`;

    const parsed = parseFireDoorCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].code).toBe('FD001');
    expect(parsed[1].code).toBe('FD002');
  });

  test('handles empty CSV', () => {
    const csv = `Item,Code\n`;
    const parsed = parseFireDoorCSV(csv);
    expect(parsed).toHaveLength(0);
  });

  test('handles CSV with BOM', () => {
    const csv = '\uFEFFItem,Code,Value\nProduct,FD001,£100';
    const parsed = parseFireDoorCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].code).toBe('FD001');
  });
});

describe('calculateTotalValue', () => {
  test('sums line totals', () => {
    const rows = [
      { lineTotal: 1000, rawRowJson: {} } as any,
      { lineTotal: 500, rawRowJson: {} } as any,
      { lineTotal: 250, rawRowJson: {} } as any,
    ];

    expect(calculateTotalValue(rows)).toBe(1750);
  });

  test('handles null values', () => {
    const rows = [
      { lineTotal: 1000, rawRowJson: {} } as any,
      { lineTotal: null, rawRowJson: {} } as any,
      { lineTotal: 500, rawRowJson: {} } as any,
    ];

    expect(calculateTotalValue(rows)).toBe(1500);
  });

  test('handles empty array', () => {
    expect(calculateTotalValue([])).toBe(0);
  });
});

describe('validateCSVHeaders', () => {
  test('validates correct headers', () => {
    const csv = `Item,Code,Door Ref,Location,Fire Rating,Value\nProduct,FD001,DR-001,Floor 1,FD30S,£1000`;
    const result = validateCSVHeaders(csv);
    expect(result.valid).toBe(true);
    expect(result.missingHeaders).toHaveLength(0);
  });

  test('detects missing required headers', () => {
    const csv = `Item,Code,Door Ref\nProduct,FD001,DR-001`;
    const result = validateCSVHeaders(csv);
    expect(result.valid).toBe(false);
    expect(result.missingHeaders).toContain('Location');
    expect(result.missingHeaders).toContain('Fire Rating');
    expect(result.missingHeaders).toContain('Value');
  });

  test('handles empty CSV', () => {
    const csv = '';
    const result = validateCSVHeaders(csv);
    expect(result.valid).toBe(false);
    expect(result.missingHeaders).toContain('No data rows found');
  });
});
