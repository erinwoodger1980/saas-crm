/**
 * Fire Door CSV Parser
 * Parses CSV files with fire door orders into structured data
 */

import { parse } from 'csv-parse/sync';
import { ParsedFireDoorRow, RawCSVRow } from './types';
import { FIRE_DOOR_FIELD_LABELS, FIRE_DOOR_MATCHABLE_FIELD_LABELS } from './fieldCatalog';
import { resolveFireDoorDbKeyForLabel } from './labelToDbKey';

export type FireDoorHeaderMap = Record<string, string>;

// No required headers. Import can proceed with partial mappings.
const REQUIRED_HEADERS = [] as const;

function getHeadersFromCsv(csvContent: string | Buffer): string[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    to: 1,
  });

  if (!records.length) return [];
  const firstRecord = records[0] as Record<string, any>;
  return Object.keys(firstRecord);
}

export function getCsvHeaders(csvContent: string | Buffer): string[] {
  return getHeadersFromCsv(csvContent);
}

function getMappedValue(rawRow: RawCSVRow, expectedHeader: string, headerMap?: FireDoorHeaderMap): string | undefined {
  const mappedHeader = headerMap && typeof headerMap === 'object' ? String((headerMap as any)[expectedHeader] || '').trim() : '';
  const key = mappedHeader || expectedHeader;
  return (rawRow as any)[key];
}

/**
 * Parse currency string to decimal number
 * Handles formats like: £1,104.00, $1,104.00, 1,104.00, 1104
 */
export function parseCurrencyToDecimal(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null;
  
  // Remove currency symbols, spaces, and commas
  const cleaned = value
    .replace(/[£$€¥₹]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '')
    .trim();
  
  if (!cleaned || cleaned === '' || cleaned === '-') return null;
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse integer value from string
 */
export function parseIntValue(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null;
  
  const cleaned = value.trim();
  if (!cleaned || cleaned === '' || cleaned === '-') return null;
  
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse float value from string
 */
export function parseFloatValue(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null;
  
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned || cleaned === '' || cleaned === '-') return null;
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Clean and normalize text values
 */
export function cleanTextValue(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned === '' || cleaned === '-' ? null : cleaned;
}

/**
 * Parse a single CSV row into structured fire door data
 */
export function parseFireDoorRow(
  rawRow: RawCSVRow,
  rowIndex: number,
  opts?: { headerMap?: FireDoorHeaderMap }
): ParsedFireDoorRow {
  const parsed: Record<string, any> = {
    rawRowJson: rawRow,
  };

  // Keep numeric parsing for known DB scalar fields.
  const intFields = new Set<string>([
    'quantity',
    'acousticRatingDb',
    'visionQtyLeaf1',
    'visionQtyLeaf2',
    'flushBoltQty',
    'fireSignageQty',
    'fireIdDiscQty',
    'doorViewersQty',
    'additionNote1Qty',
  ]);

  const floatFields = new Set<string>([
    'leafHeight',
    'masterLeafWidth',
    'slaveLeafWidth',
    'leafThickness',
    'doorUndercutMm',
    'vp1WidthLeaf1',
    'vp1HeightLeaf1',
    'vp2WidthLeaf1',
    'vp2HeightLeaf1',
    'vp1WidthLeaf2',
    'vp1HeightLeaf2',
    'vp2WidthLeaf2',
    'vp2HeightLeaf2',
    'totalGlazedAreaMaster',
  ]);

  const currencyFields = new Set<string>([
    'unitValue',
    'labourCost',
    'materialCost',
    'lineTotal',
  ]);

  for (const expectedLabel of FIRE_DOOR_FIELD_LABELS) {
    const dbKey = resolveFireDoorDbKeyForLabel(expectedLabel);

    const rawValue = getMappedValue(rawRow, expectedLabel, opts?.headerMap);
    if (rawValue === undefined) continue;

    if (currencyFields.has(dbKey) || dbKey.endsWith('Cost') || dbKey.endsWith('Labour')) {
      parsed[dbKey] = parseCurrencyToDecimal(rawValue);
      continue;
    }
    if (intFields.has(dbKey)) {
      parsed[dbKey] = parseIntValue(rawValue);
      continue;
    }
    if (floatFields.has(dbKey)) {
      parsed[dbKey] = parseFloatValue(rawValue);
      continue;
    }

    parsed[dbKey] = cleanTextValue(rawValue);
  }

  // Legacy support (some exports have Item/Code columns but they are not part of the catalog list).
  if (parsed.itemType === undefined) {
    parsed.itemType = cleanTextValue((rawRow as any).Item);
  }
  if (parsed.code === undefined) {
    parsed.code = cleanTextValue((rawRow as any).Code ?? (rawRow as any).Name);
  }

  // Calculate line total: unitValue * quantity (default qty to 1 if missing) unless a line total was supplied.
  const unitValue = typeof parsed.unitValue === 'number' && Number.isFinite(parsed.unitValue) ? parsed.unitValue : 0;
  const quantity = typeof parsed.quantity === 'number' && Number.isFinite(parsed.quantity) ? parsed.quantity : 1;
  if (parsed.lineTotal == null) {
    parsed.lineTotal = unitValue * quantity;
  }

  return parsed as ParsedFireDoorRow;
}

/**
 * Parse entire CSV file into array of fire door line items
 * Only processes rows where Item === "Product"
 */
export function parseFireDoorCSV(csvContent: string | Buffer, opts?: { headerMap?: FireDoorHeaderMap }): ParsedFireDoorRow[] {
  // Parse CSV with headers
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // Handle UTF-8 BOM
    relax_column_count: true, // Allow inconsistent column counts
  });

  const parsedRows: ParsedFireDoorRow[] = [];

  // If the spreadsheet has an explicit "Item" column, we keep the historical behaviour
  // and only import rows where Item === "Product". If not, treat every row as importable.
  const hasItemColumn = (() => {
    const first = (records?.[0] as any) || null;
    if (!first || typeof first !== 'object') return false;
    return Object.prototype.hasOwnProperty.call(first, 'Item');
  })();

  for (let i = 0; i < records.length; i++) {
    const rawRow = records[i] as RawCSVRow;
    
    if (hasItemColumn) {
      // Only process rows where Item === "Product" (legacy format)
      const itemType = String((rawRow as any)?.Item || '').trim();
      if (itemType !== 'Product') {
        continue;
      }
    }

    const parsed = parseFireDoorRow(rawRow, i + 2, opts); // +2 because row 1 is header, array is 0-indexed
    parsedRows.push(parsed);
  }

  return parsedRows;
}

/**
 * Calculate total value from array of parsed rows
 */
export function calculateTotalValue(rows: ParsedFireDoorRow[]): number {
  return rows.reduce((sum, row) => sum + (row.lineTotal || 0), 0);
}

/**
 * Validation helper: check if CSV has expected headers
 */
export function validateCSVHeaders(
  csvContent: string | Buffer,
  opts?: { headerMap?: FireDoorHeaderMap }
): { valid: boolean; missingHeaders: string[]; headers: string[]; requiredHeaders: string[] } {
  const headers = getHeadersFromCsv(csvContent);

  if (headers.length === 0) {
    return { valid: false, missingHeaders: ['No data rows found'], headers: [], requiredHeaders: [...REQUIRED_HEADERS] };
  }

  const headerSet = new Set(headers);
  const hm = opts?.headerMap && typeof opts.headerMap === 'object' ? opts.headerMap : undefined;

  const missingHeaders = [...REQUIRED_HEADERS].filter((expected) => {
    if (headerSet.has(expected)) return false;
    const mapped = hm ? String((hm as any)[expected] || '').trim() : '';
    if (mapped && headerSet.has(mapped)) return false;
    return true;
  });

  return {
    valid: missingHeaders.length === 0,
    missingHeaders,
    headers,
    requiredHeaders: [...REQUIRED_HEADERS],
  };
}

export function getExpectedCsvHeaders(): string[] {
  return [...FIRE_DOOR_MATCHABLE_FIELD_LABELS];
}
