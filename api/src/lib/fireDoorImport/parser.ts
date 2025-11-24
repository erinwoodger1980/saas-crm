/**
 * Fire Door CSV Parser
 * Parses CSV files with fire door orders into structured data
 */

import { parse } from 'csv-parse/sync';
import { COLUMN_MAPPING, ParsedFireDoorRow, RawCSVRow } from './types';

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
export function parseFireDoorRow(rawRow: RawCSVRow, rowIndex: number): ParsedFireDoorRow {
  const parsed: Partial<ParsedFireDoorRow> = {
    rawRowJson: rawRow,
  };

  // Map text fields
  const textFields = [
    'itemType', 'code', 'doorRef', 'location', 'doorSetType', 'fireRating', 'handing',
    'internalColour', 'externalColour', 'frameFinish', 'leafConfiguration', 'ifSplitMasterSize',
    'doorFinishSide1', 'doorFinishSide2', 'doorFacing', 'lippingFinish',
    'doorEdgeProtType', 'doorEdgeProtPos', 'doorUndercut',
    'fanlightSidelightGlz', 'glazingTape', 'ironmongeryPackRef', 'closerOrFloorSpring',
    'spindleFacePrep', 'cylinderFacePrep', 'flushBoltSupplyPrep', 'fingerProtection',
    'fireSignage', 'fireSignageFactoryFit', 'fireIdDisc', 'doorViewer',
    'doorViewerPosition', 'doorViewerPrepSize', 'doorChain',
    'doorChainFactoryFit', 'doorViewersFactoryFit', 'additionNote1'
  ];

  const intFields = [
    'quantity', 'acousticRatingDb', 'visionQtyLeaf1', 'visionQtyLeaf2',
    'flushBoltQty', 'fireSignageQty', 'fireIdDiscQty', 'doorViewersQty', 'additionNote1Qty'
  ];

  const floatFields = [
    'leafHeight', 'masterLeafWidth', 'slaveLeafWidth', 'leafThickness', 'doorUndercutMm',
    'vp1WidthLeaf1', 'vp1HeightLeaf1', 'vp2WidthLeaf1', 'vp2HeightLeaf1',
    'vp1WidthLeaf2', 'vp1HeightLeaf2', 'vp2WidthLeaf2', 'vp2HeightLeaf2',
    'totalGlazedAreaMaster'
  ];

  const currencyFields = ['unitValue', 'labourCost', 'materialCost'];

  // Find the CSV column name for each field and parse it
  for (const [csvHeader, fieldName] of Object.entries(COLUMN_MAPPING)) {
    const rawValue = rawRow[csvHeader];

    if (textFields.includes(fieldName)) {
      (parsed as any)[fieldName] = cleanTextValue(rawValue);
    } else if (intFields.includes(fieldName)) {
      (parsed as any)[fieldName] = parseIntValue(rawValue);
    } else if (floatFields.includes(fieldName)) {
      (parsed as any)[fieldName] = parseFloatValue(rawValue);
    } else if (currencyFields.includes(fieldName)) {
      (parsed as any)[fieldName] = parseCurrencyToDecimal(rawValue);
    }
  }

  // Calculate line total: unitValue * quantity (default qty to 1 if missing)
  const unitValue = parsed.unitValue || 0;
  const quantity = parsed.quantity || 1;
  parsed.lineTotal = unitValue * quantity;

  return parsed as ParsedFireDoorRow;
}

/**
 * Parse entire CSV file into array of fire door line items
 * Only processes rows where Item === "Product"
 */
export function parseFireDoorCSV(csvContent: string | Buffer): ParsedFireDoorRow[] {
  // Parse CSV with headers
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // Handle UTF-8 BOM
    relax_column_count: true, // Allow inconsistent column counts
  });

  const parsedRows: ParsedFireDoorRow[] = [];

  for (let i = 0; i < records.length; i++) {
    const rawRow = records[i] as RawCSVRow;
    
    // Only process rows where Item === "Product"
    const itemType = rawRow['Item']?.trim();
    if (itemType !== 'Product') {
      continue;
    }

    const parsed = parseFireDoorRow(rawRow, i + 2); // +2 because row 1 is header, array is 0-indexed
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
export function validateCSVHeaders(csvContent: string | Buffer): { valid: boolean; missingHeaders: string[] } {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    to: 1, // Only parse first data row to get headers
  });

  if (records.length === 0) {
    return { valid: false, missingHeaders: ['No data rows found'] };
  }

  const headers = Object.keys(records[0]);
  const requiredHeaders = ['Item', 'Code', 'Door Ref', 'Location', 'Fire Rating', 'Value'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

  return {
    valid: missingHeaders.length === 0,
    missingHeaders,
  };
}
