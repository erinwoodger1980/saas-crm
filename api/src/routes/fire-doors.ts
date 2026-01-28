/**
 * Fire Door Import Routes
 * Endpoints for importing fire door orders from CSV spreadsheets
 */

import { Router } from 'express';
import { parse as parseCsv } from 'csv-parse/sync';
import multer from 'multer';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { 
  parseFireDoorCSV, 
  calculateTotalValue, 
  validateCSVHeaders,
  getCsvHeaders,
  getExpectedCsvHeaders,
  COLUMN_MAPPING,
  isCostOrLabourFieldLabel,
  type ParsedFireDoorRow,
  type FireDoorImportResponse 
} from '../lib/fireDoorImport';

const router = Router();

const FIRE_DOOR_REQUIRED_HEADERS: readonly string[] = [];

function resolveTenantId(req: any): string {
  return (
    req.auth?.tenantId ||
    req.user?.tenantId ||
    (req.headers["x-tenant-id"] as string) ||
    ""
  );
}

function resolveUserId(req: any): string | undefined {
  return (
    req.auth?.userId ||
    req.user?.id ||
    (req.headers["x-user-id"] as string) ||
    undefined
  );
}

function isXlsxUpload(file: Express.Multer.File): boolean {
  const name = String(file?.originalname || '').toLowerCase();
  const type = String((file as any)?.mimetype || '').toLowerCase();
  if (name.endsWith('.xlsx')) return true;
  if (type.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) return true;
  return false;
}

function isXlsUpload(file: Express.Multer.File): boolean {
  const name = String(file?.originalname || '').toLowerCase();
  const type = String((file as any)?.mimetype || '').toLowerCase();
  if (name.endsWith('.xls')) return true;
  if (type.includes('application/vnd.ms-excel')) return true;
  return false;
}

function csvEscape(value: any): string {
  const s = value === null || value === undefined ? '' : String(value);
  const needsQuotes = /[\n\r",]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function normalizeHeaderCandidate(input: any): string {
  return String(input ?? '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .trim();
}

function getCellText(cell: ExcelJS.Cell): string {
  const t = (cell as any)?.text;
  if (typeof t === 'string') return t;
  const v = cell?.value as any;
  if (v === null || v === undefined) return '';
  return String(v);
}

function rowToValues(row: ExcelJS.Row, maxColumns: number): string[] {
  const out: string[] = [];
  for (let col = 1; col <= maxColumns; col++) {
    const cell = row.getCell(col);
    out.push(getCellText(cell));
  }
  while (out.length > 1 && String(out[out.length - 1] ?? '').trim() === '') {
    out.pop();
  }
  return out;
}

function getCsvSampleValues(csvContent: string | Buffer, headers: string[]): Record<string, string> {
  try {
    const records = parseCsv(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      to: 5,
    }) as Array<Record<string, any>>;

    if (!Array.isArray(records) || records.length === 0) return {};

    const sample: Record<string, string> = {};
    for (const header of headers) {
      if (!header) continue;
      for (const row of records) {
        const raw = (row as any)?.[header];
        const value = raw == null ? '' : String(raw).trim();
        if (value) {
          sample[header] = value;
          break;
        }
      }
    }

    return sample;
  } catch {
    return {};
  }
}

function detectHeaderRowNumber(
  worksheet: ExcelJS.Worksheet,
  opts: { requiredHeaders: readonly string[]; expectedHeaders: readonly string[] }
): number {
  const requiredSet = new Set(opts.requiredHeaders.map(normalizeHeaderCandidate));
  const expectedSet = new Set(opts.expectedHeaders.map(normalizeHeaderCandidate));
  const hasRequired = requiredSet.size > 0;

  const maxScanRows = Math.min(worksheet.actualRowCount || worksheet.rowCount || 0, 50);
  const maxColumns = Math.max(worksheet.actualColumnCount || 0, worksheet.columnCount || 0, 1);

  let bestRow = 1;
  let bestScore = -1;

  for (let i = 1; i <= maxScanRows; i++) {
    const row = worksheet.getRow(i);
    const values = rowToValues(row, maxColumns);
    const normCells = new Set(values.map(normalizeHeaderCandidate).filter(Boolean));
    if (normCells.size === 0) continue;

    let requiredMatches = 0;
    let expectedMatches = 0;
    for (const c of normCells) {
      if (requiredSet.has(c)) requiredMatches++;
      if (expectedSet.has(c)) expectedMatches++;
    }

    // Prefer rows that match required headers if they exist; otherwise use expected headers.
    const score = (hasRequired ? (requiredMatches * 1000) : 0) + expectedMatches * 10 + Math.min(normCells.size, 50);
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  // Guard: if we didn't match anything meaningful, default to row 1.
  const bestRowValues = rowToValues(worksheet.getRow(bestRow), Math.max(worksheet.actualColumnCount || 0, worksheet.columnCount || 0, 1));
  const bestNorm = new Set(bestRowValues.map(normalizeHeaderCandidate).filter(Boolean));
  let bestRequiredMatches = 0;
  let bestExpectedMatches = 0;
  for (const c of bestNorm) {
    if (requiredSet.has(c)) bestRequiredMatches++;
    if (expectedSet.has(c)) bestExpectedMatches++;
  }
  // Guard: when required headers exist, insist on at least 2 matches.
  if (hasRequired && bestRequiredMatches < 2) return 1;
  // Guard: when we have no required headers, still require a minimal signal.
  if (!hasRequired && bestExpectedMatches < 2) return 1;

  return bestRow;
}

async function convertXlsxBufferToCsv(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  opts: { requiredHeaders: readonly string[]; expectedHeaders: readonly string[]; sheetName?: string | null; sheetIndex?: number | null }
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any);
  const arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  await workbook.xlsx.load(arrayBuffer as any);

  const sheets = Array.isArray(workbook.worksheets) ? workbook.worksheets : [];
  const pickByName = (opts.sheetName ? sheets.find((ws) => ws.name === opts.sheetName) : undefined);
  const pickByIndex = (Number.isFinite(opts.sheetIndex as any) && (opts.sheetIndex as any) != null)
    ? sheets[(opts.sheetIndex as number) - 1]
    : undefined;

  const worksheet = pickByName || pickByIndex || sheets[0];
  if (!worksheet) {
    throw new Error('Excel file has no worksheets');
  }

  const maxColumns = Math.max(worksheet.actualColumnCount || 0, worksheet.columnCount || 0, 1);
  const headerRowNumber = detectHeaderRowNumber(worksheet, opts);
  const lastRow = worksheet.actualRowCount || worksheet.rowCount || headerRowNumber;

  const lines: string[] = [];
  for (let r = headerRowNumber; r <= lastRow; r++) {
    const row = worksheet.getRow(r);
    const values = rowToValues(row, maxColumns);
    // Skip completely empty rows
    if (!values.some((v) => String(v ?? '').trim() !== '')) continue;
    const cells = values.map((v) => csvEscape(v));
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}

function detectHeaderRowIndexFromRows(
  rows: any[][],
  opts: { requiredHeaders: readonly string[]; expectedHeaders: readonly string[] }
): number {
  const requiredSet = new Set(opts.requiredHeaders.map(normalizeHeaderCandidate));
  const expectedSet = new Set(opts.expectedHeaders.map(normalizeHeaderCandidate));
  const hasRequired = requiredSet.size > 0;

  const maxScanRows = Math.min(rows.length, 50);

  let bestRow = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScanRows; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    const normCells = new Set(row.map(normalizeHeaderCandidate).filter(Boolean));
    if (normCells.size === 0) continue;

    let requiredMatches = 0;
    let expectedMatches = 0;
    for (const c of normCells) {
      if (requiredSet.has(c)) requiredMatches++;
      if (expectedSet.has(c)) expectedMatches++;
    }

    const score = (hasRequired ? (requiredMatches * 1000) : 0) + expectedMatches * 10 + Math.min(normCells.size, 50);
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  const best = Array.isArray(rows[bestRow]) ? rows[bestRow] : [];
  const bestNorm = new Set(best.map(normalizeHeaderCandidate).filter(Boolean));
  let bestRequiredMatches = 0;
  let bestExpectedMatches = 0;
  for (const c of bestNorm) {
    if (requiredSet.has(c)) bestRequiredMatches++;
    if (expectedSet.has(c)) bestExpectedMatches++;
  }
  if (hasRequired && bestRequiredMatches < 2) return 0;
  if (!hasRequired && bestExpectedMatches < 2) return 0;
  return bestRow;
}

function convertXlsBufferToCsv(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  opts: { requiredHeaders: readonly string[]; expectedHeaders: readonly string[]; sheetName?: string | null; sheetIndex?: number | null }
): { csv: string; sheets: string[] } {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any);
  const workbook = XLSX.read(input, { type: 'buffer' });
  const sheets = Array.isArray(workbook.SheetNames) ? workbook.SheetNames.filter(Boolean) : [];
  if (!sheets.length) {
    throw new Error('Excel file has no worksheets');
  }

  const pickByName = (opts.sheetName ? sheets.find((n) => n === opts.sheetName) : undefined);
  const pickByIndex = (Number.isFinite(opts.sheetIndex as any) && (opts.sheetIndex as any) != null)
    ? sheets[(opts.sheetIndex as number) - 1]
    : undefined;
  const sheetName = pickByName || pickByIndex || sheets[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Excel worksheet not found');
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as any[][];
  const headerRowIndex = detectHeaderRowIndexFromRows(rows, opts);
  const maxColumns = Math.max(1, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)));

  const lines: string[] = [];
  for (let r = headerRowIndex; r < rows.length; r++) {
    const row = Array.isArray(rows[r]) ? rows[r] : [];
    const values: string[] = [];
    for (let c = 0; c < maxColumns; c++) {
      values.push(String(row[c] ?? ''));
    }
    while (values.length > 1 && String(values[values.length - 1] ?? '').trim() === '') {
      values.pop();
    }
    if (!values.some((v) => String(v ?? '').trim() !== '')) continue;
    lines.push(values.map((v) => csvEscape(v)).join(','));
  }

  return { csv: lines.join('\n'), sheets };
}

const FIRE_DOOR_LINE_ITEM_MODEL = (() => {
  try {
    const dmmf = (Prisma as any)?.dmmf;
    const model = dmmf?.datamodel?.models?.find?.((m: any) => m?.name === 'FireDoorLineItem');
    if (!model) return null;
    return model;
  } catch {
    return null;
  }
})();

const FIRE_DOOR_LINE_ITEM_SCALAR_FIELDS = (() => {
  const map = new Map<string, any>();
  const model = FIRE_DOOR_LINE_ITEM_MODEL as any;
  const fields = model?.fields;
  if (!Array.isArray(fields)) return map;
  for (const f of fields) {
    if (f?.kind === 'scalar' && typeof f?.name === 'string') {
      map.set(f.name, f);
    }
  }
  return map;
})();

const LINE_ITEM_FORBIDDEN_UPDATE_FIELDS = new Set<string>([
  'id',
  'tenantId',
  'fireDoorImportId',
  'createdAt',
  'updatedAt',
]);

// UI grid column keys → DB column names when they differ.
const UI_TO_DB_FIELD_ALIASES: Record<string, string> = {
  doorsetLeafFrame: 'doorsetType',
  acousticRating: 'acousticRatingDb',
  fanlightSidelightGlazing: 'fanlightSidelightGlz',
  doorEdgeProtPosition: 'doorEdgeProtPos',
  visionPanelQtyLeaf1: 'visionQtyLeaf1',
  visionPanelQtyLeaf2: 'visionQtyLeaf2',
  leaf1Aperture1Width: 'vp1WidthLeaf1',
  leaf1Aperture1Height: 'vp1HeightLeaf1',
  leaf1Aperture2Width: 'vp2WidthLeaf1',
  leaf1Aperture2Height: 'vp2HeightLeaf1',
  leaf2Aperture1Width: 'vp1WidthLeaf2',
  leaf2Aperture1Height: 'vp1HeightLeaf2',
  leaf2Aperture2Width: 'vp2WidthLeaf2',
  leaf2Aperture2Height: 'vp2HeightLeaf2',
  addition1: 'additionNote1',
  addition1Qty: 'additionNote1Qty',
  closersFloorsprings: 'closerOrFloorSpring',
  mLeafWidth: 'masterLeafWidth',
  sLeafWidth: 'slaveLeafWidth',
  priceEa: 'unitValue',
  linePrice: 'lineTotal',
};

function coerceScalarValue(value: any, fieldMeta: any): any {
  if (value === undefined) return undefined;
  if (value === '') return null;
  if (value === null) return null;

  const type = fieldMeta?.type;

  // Prisma scalar types in DMMF: String, Int, Float, Decimal, Boolean, DateTime, Json
  if (type === 'Int') {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
    if (typeof value === 'string') {
      const n = parseInt(value.replace(/,/g, '').trim(), 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  if (type === 'Float' || type === 'Decimal') {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[£$€¥₹]/g, '').replace(/,/g, '').trim();
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  if (type === 'Boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true' || v === 'yes' || v === '1') return true;
      if (v === 'false' || v === 'no' || v === '0') return false;
    }
    return null;
  }

  if (type === 'DateTime') {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isFinite(d.getTime()) ? d : null;
    }
    return null;
  }

  if (type === 'Json') {
    return value;
  }

  // Default to string-ish
  return typeof value === 'string' ? value : String(value);
}

function sanitizeJsonValue(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((v) => sanitizeJsonValue(v));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeJsonValue(v);
    }
    return out;
  }
  return value;
}

function serializeLineItemForJson(item: any) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    unitValue: item.unitValue != null ? Number(item.unitValue) : null,
    labourCost: item.labourCost != null ? Number(item.labourCost) : null,
    materialCost: item.materialCost != null ? Number(item.materialCost) : null,
    lineTotal: item.lineTotal != null ? Number(item.lineTotal) : null,
  };
}

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

function getJsonObject(value: any): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function sanitizeColumnWidths(input: any): Record<string, number> {
  const obj = getJsonObject(input);
  const out: Record<string, number> = {};
  for (const [kRaw, v] of Object.entries(obj)) {
    const k = String(kRaw || '').trim();
    if (!k) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    // Keep within a sensible UI range
    const clamped = Math.max(40, Math.min(1200, n));
    out[k] = clamped;
  }
  return out;
}

/**
 * GET /api/fire-doors/order-grid/column-widths
 * System-wide UI preference for Fire Door Order Grid column widths.
 */
router.get('/order-grid/column-widths', async (req, res) => {
  try {
    const appSettings = await prisma.appSettings.findUnique({
      where: { id: 'global' },
      select: { fireDoorOrderGridColumnWidths: true },
    });

    const columnWidths = sanitizeColumnWidths((appSettings as any)?.fireDoorOrderGridColumnWidths);
    return res.json({ ok: true, columnWidths });
  } catch (error: any) {
    console.error('[fire-doors] Get order grid column widths error:', error);
    return res.status(500).json({ error: 'Failed to load column widths' });
  }
});

/**
 * POST /api/fire-doors/order-grid/column-widths
 * Body: { columnWidths: Record<string, number> }
 */
router.post('/order-grid/column-widths', async (req, res) => {
  try {
    const body = (req.body && typeof req.body === 'object') ? (req.body as any) : {};
    const columnWidths = sanitizeColumnWidths(body.columnWidths);

    await prisma.appSettings.upsert({
      where: { id: 'global' },
      update: { fireDoorOrderGridColumnWidths: columnWidths },
      create: { id: 'global', fireDoorOrderGridColumnWidths: columnWidths },
      select: { id: true },
    });

    return res.json({ ok: true, columnWidths });
  } catch (error: any) {
    console.error('[fire-doors] Save order grid column widths error:', error);
    return res.status(500).json({ error: 'Failed to save column widths' });
  }
});

/**
 * POST /api/fire-doors/import
 * Import fire door orders from CSV spreadsheet
 * 
 * Auth: Requires authenticated user
 * Tenant: Must be fire door manufacturer (isFireDoorManufacturer === true)
 * Body: multipart/form-data with 'file' field
 * Optional: projectId, orderId in body
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    // 1. Auth checks
    const userId = req.auth?.userId as string | undefined;
    const tenantId = req.auth?.tenantId as string | undefined;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 2. Check if tenant is fire door manufacturer
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ 
        error: 'Fire door import is only available for fire door manufacturers',
        message: 'This feature requires fire door manufacturer access. Please contact support to enable this feature.',
      });
    }

    // 3. Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sourceName = req.file.originalname;
    let csvContent: string | Buffer = req.file.buffer;

    if (isXlsxUpload(req.file)) {
      const rawSheetName = (req.body as any)?.sheetName;
      const sheetName = typeof rawSheetName === 'string' && rawSheetName.trim() ? rawSheetName.trim() : null;

      const rawSheetIndex = (req.body as any)?.sheetIndex;
      const sheetIndex = typeof rawSheetIndex === 'string' && rawSheetIndex.trim()
        ? Number(rawSheetIndex)
        : (typeof rawSheetIndex === 'number' ? rawSheetIndex : null);
      const sheetIndexClean = Number.isFinite(sheetIndex as any) ? Math.floor(sheetIndex as number) : null;

      try {
        // If the workbook has multiple sheets and the user didn't specify which one,
        // return a selection prompt so the UI can ask.
        if (!sheetName && !sheetIndexClean) {
          const workbook = new ExcelJS.Workbook();
          const input = Buffer.isBuffer(req.file.buffer) ? req.file.buffer : Buffer.from(req.file.buffer as any);
          const arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
          await workbook.xlsx.load(arrayBuffer as any);
          const sheets = Array.isArray(workbook.worksheets) ? workbook.worksheets.map((ws) => ws.name).filter(Boolean) : [];
          if (sheets.length > 1) {
            return res.status(422).json({
              error: 'Select sheet',
              message: 'Please select which sheet to import from this Excel workbook.',
              needsSheetSelection: true,
              sheets,
            });
          }
        }

        csvContent = await convertXlsxBufferToCsv(req.file.buffer, {
          requiredHeaders: FIRE_DOOR_REQUIRED_HEADERS,
          expectedHeaders: getExpectedCsvHeaders(),
          sheetName,
          sheetIndex: sheetIndexClean,
        });
      } catch (err: any) {
        console.error('[fire-door-import] Excel parse error:', err);
        return res.status(400).json({
          error: 'Failed to parse Excel file',
          message: err?.message || 'Invalid Excel format',
        });
      }
    }

    // Optional header mapping (for column matcher UI)
    let headerMap: Record<string, string> | undefined;
    try {
      const raw = (req.body as any)?.headerMap;
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(parsed as any)) {
            const kk = String(k || '').trim();
            const vv = String(v || '').trim();
            if (!kk || !vv) continue;
            out[kk] = vv;
          }
          headerMap = Object.keys(out).length ? out : undefined;
        }
      }
    } catch {
      headerMap = undefined;
    }

    // 4. Validate headers (CSV or Excel converted to CSV)
    const headers = getCsvHeaders(csvContent);
    const sampleValues = getCsvSampleValues(csvContent, headers);
    const sampleValues = getCsvSampleValues(csvContent, headers);
    const expectedHeaders = getExpectedCsvHeaders();
    const expectedHeadersForMapping = expectedHeaders.filter((csvHeader) => {
      // Primary rule: hide by label suffix (matches the user's CSV field list).
      if (isCostOrLabourFieldLabel(csvHeader)) return false;

      // Back-compat: if the expected header happens to be a COLUMN_MAPPING key,
      // also hide when the mapped internal field ends with cost/labour.
      const mappedField = (COLUMN_MAPPING as any)?.[csvHeader];
      const f = String(mappedField || '').trim().toLowerCase();
      return !(f.endsWith('cost') || f.endsWith('labour'));
    });

    const forceMapping = (() => {
      const raw = (req.body as any)?.forceMapping;
      if (raw === true) return true;
      const s = String(raw ?? '').trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes';
    })();

    const normalize = (input: any) =>
      String(input ?? '')
        .toLowerCase()
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*\/\s*/g, '/')
        .replace(/\s*-\s*/g, '-')
        .trim();

    const headerNormSet = new Set(headers.map(normalize).filter(Boolean));
    const hm = headerMap && typeof headerMap === 'object' ? headerMap : undefined;
    const missingExpected = expectedHeadersForMapping.filter((expected) => {
      const ne = normalize(expected);
      if (!ne) return false;
      if (headerNormSet.has(ne)) return false;
      const mapped = hm ? String((hm as any)[expected] || '').trim() : '';
      if (mapped && headerNormSet.has(normalize(mapped))) return false;
      return true;
    });

    // No "required" fields, but if the file doesn't match the import template and the user
    // hasn't provided a mapping, prompt the column matcher UI.
    // If forceMapping is true, always prompt once so the user can review/adjust mappings.
    if (!hm && (forceMapping || missingExpected.length > 0)) {
      return res.status(422).json({
        error: 'Column mapping recommended',
        message: forceMapping
          ? 'Review how your spreadsheet columns map to the import format.'
          : 'Your spreadsheet columns don’t match the expected import format. Please map columns to continue.',
        needsMapping: true,
        missingHeaders: missingExpected,
        requiredHeaders: [],
        headers,
        expectedHeaders: expectedHeadersForMapping,
      });
    }

    // 5. Parse CSV (or Excel-as-CSV)
    let parsedRows: ParsedFireDoorRow[];
    try {
      parsedRows = parseFireDoorCSV(csvContent, { headerMap });
    } catch (err: any) {
      console.error('[fire-door-import] CSV parse error:', err);
      return res.status(400).json({
        error: 'Failed to parse spreadsheet file',
        message: err.message || 'Invalid spreadsheet format',
      });
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({
        error: 'No valid product rows found',
        message: 'No importable rows were found in this spreadsheet.',
      });
    }

    // 6. Calculate totals
    const totalValue = calculateTotalValue(parsedRows);
    const rowCount = parsedRows.length;

    // 7. Extract optional linkage and derive metadata
    const projectId = (req.body.projectId as string) || null;
    const orderId = (req.body.orderId as string) || null;
    const mjsNumberFromForm = (req.body.mjsNumber as string) || null;
    const customerNameFromForm = (req.body.customerName as string) || null;
    const jobDescriptionFromForm = (req.body.jobDescription as string) || null;
    const netValueFromForm = req.body.netValue ? Number(req.body.netValue) : null;
    const firstRow = parsedRows[0];
    const mjsNumber = mjsNumberFromForm || firstRow.code || sourceName.replace(/\.(csv|xlsx)$/i, '');
    const clientName = customerNameFromForm || firstRow.location || 'New Fire Door Customer';
    const jobDescription = jobDescriptionFromForm || `${clientName} - ${mjsNumber}`;
    const netValue = netValueFromForm ?? totalValue;

    const importStartMs = Date.now();

    // 8. Prepare line item payloads outside any transaction (keeps interactive tx fast)
    const preparedLineItems = parsedRows.map((row, idx) => {
      const scalarData: Record<string, any> = {};
      for (const [k, v] of Object.entries(row as any)) {
        if (!k || k === 'rawRowJson') continue;
        if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(k)) continue;
        const meta = FIRE_DOOR_LINE_ITEM_SCALAR_FIELDS.get(k);
        if (!meta) continue;
        scalarData[k] = coerceScalarValue(v, meta);
      }

      return {
        rawRowJson: (row as any).rawRowJson as any,
        ...scalarData,
        tenantId,
        rowIndex: idx,
      };
    });

    // 9. Persist project + import record in a short interactive transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // Ensure project exists
        let fireDoorProjectId = projectId;
        if (!fireDoorProjectId) {
          const existingProject = await tx.fireDoorScheduleProject.findFirst({
            where: { tenantId, mjsNumber },
          });
          if (existingProject) {
            fireDoorProjectId = existingProject.id;
          } else {
            const fireDoorProject = await tx.fireDoorScheduleProject.create({
              data: {
                tenantId,
                mjsNumber,
                clientName,
                jobName: jobDescription,
                netValue: netValue as any,
                dateReceived: new Date(),
                jobLocation: 'RED FOLDER',
                signOffStatus: 'NOT LOOKED AT',
                lastUpdatedBy: userId,
                lastUpdatedAt: new Date(),
              },
            });
            fireDoorProjectId = fireDoorProject.id;

            // Create/ensure lead and opportunity
            let lead = await tx.lead.findFirst({ where: { tenantId, contactName: clientName } });
            if (!lead) {
              lead = await tx.lead.create({
                data: {
                  tenantId,
                  createdById: userId,
                  contactName: clientName,
                  capturedAt: new Date(),
                  status: 'INFO_REQUESTED',
                },
              });
            }
            const opportunity = await tx.opportunity.create({
              data: {
                tenantId,
                leadId: lead.id,
                title: `${clientName} - ${mjsNumber}`,
                stage: 'QUALIFY',
                createdAt: new Date(),
              },
            });
            await tx.fireDoorScheduleProject.update({
              where: { id: fireDoorProjectId },
              data: { projectId: opportunity.id },
            });
          }
        }

        // Create import record (mark as processing until rows are inserted)
        const importRecord = await tx.fireDoorImport.create({
          data: {
            tenantId,
            createdById: userId,
            sourceName,
            status: 'PROCESSING',
            totalValue,
            currency: 'GBP',
            rowCount,
            projectId: fireDoorProjectId,
            orderId,
          },
        });

        return { importRecord, fireDoorProjectId };
      },
      // Render/production defaults can be 5s; imports can legitimately take longer.
      { timeout: 120000 }
    );

    // 10. Insert line items in small batches outside the interactive transaction
    const BATCH_SIZE = 100;
    try {
      const total = preparedLineItems.length;
      const batches = Math.ceil(total / BATCH_SIZE) || 1;
      console.log('[fire-door-import] Inserting line items:', {
        tenantId,
        importId: result.importRecord.id,
        total,
        batchSize: BATCH_SIZE,
        batches,
      });

      for (let i = 0; i < preparedLineItems.length; i += BATCH_SIZE) {
        const chunk = preparedLineItems.slice(i, i + BATCH_SIZE);
        await prisma.fireDoorLineItem.createMany({
          data: chunk.map((li) => ({
            ...li,
            fireDoorImportId: result.importRecord.id,
          })) as any,
        });
      }

      await prisma.fireDoorImport.update({
        where: { id: result.importRecord.id },
        data: { status: 'COMPLETED' },
      });

      console.log('[fire-door-import] Insert complete:', {
        tenantId,
        importId: result.importRecord.id,
        totalInserted: preparedLineItems.length,
        durationMs: Date.now() - importStartMs,
      });
    } catch (e: any) {
      await prisma.fireDoorImport.update({
        where: { id: result.importRecord.id },
        data: { status: 'FAILED' },
      });

      console.error('[fire-door-import] Insert failed:', {
        tenantId,
        importId: result.importRecord.id,
        durationMs: Date.now() - importStartMs,
        message: e?.message || String(e),
      });
      throw e;
    }

    const previewRows = await prisma.fireDoorLineItem.findMany({
      where: { fireDoorImportId: result.importRecord.id },
      orderBy: { rowIndex: 'asc' },
      take: 10,
      select: {
        id: true,
        doorRef: true,
        location: true,
        rating: true,
        quantity: true,
        lineTotal: true,
      },
    });

    // 11. Build response with preview of first 10 line items
    const previewItems = previewRows.map((item) => ({
      id: item.id,
      doorRef: item.doorRef,
      location: item.location,
      fireRating: item.rating,
      quantity: item.quantity,
      lineTotal: item.lineTotal ? Number(item.lineTotal) : null,
    }));

    const response: FireDoorImportResponse = {
      import: {
        id: result.importRecord.id,
        totalValue: Number(result.importRecord.totalValue),
        currency: result.importRecord.currency,
        status: result.importRecord.status,
        rowCount: result.importRecord.rowCount,
        createdAt: result.importRecord.createdAt,
      },
      lineItems: previewItems,
      totalValue: Number(totalValue),
      rowCount,
    };

    console.log(
      `[fire-door-import] Successfully imported ${rowCount} doors for tenant ${tenantId}, total value: £${totalValue.toFixed(2)}`
    );

    return res.json(response);
  } catch (error: any) {
    console.error('[fire-door-import] Error:', error);
    return res.status(500).json({
      error: 'Import failed',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/fire-doors/import-lw
 * Import fire door orders from a Lloyd Worrall (LW) spreadsheet.
 *
 * Behaves like /import, but:
 * - Supports legacy .xls files
 * - Remembers the column mapping per-tenant (stored in TenantSettings.beta)
 * - Extracts Quote No (row 8, columns O+P merged) and Prepared By (row 8)
 */
router.post('/import-lw', upload.single('file'), async (req, res) => {
  try {
    const userId = req.auth?.userId as string | undefined;
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true, beta: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({
        error: 'Fire door import is only available for fire door manufacturers',
        message: 'This feature requires fire door manufacturer access. Please contact support to enable this feature.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!isXlsxUpload(req.file) && !isXlsUpload(req.file) && !String(req.file.originalname || '').toLowerCase().endsWith('.csv')) {
      return res.status(400).json({
        error: 'Unsupported file type',
        message: 'Please upload an Excel (.xls/.xlsx) or CSV file.',
      });
    }

    const projectId = (req.body.projectId as string) || null;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const project = await prisma.fireDoorScheduleProject.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true, laqNumber: true, scheduledBy: true },
    });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const sourceName = req.file.originalname;
    let csvContent: string | Buffer = req.file.buffer;

    // Optional header mapping (for column matcher UI)
    let headerMap: Record<string, string> | undefined;
    try {
      const raw = (req.body as any)?.headerMap;
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(parsed as any)) {
            const kk = String(k || '').trim();
            const vv = String(v || '').trim();
            if (!kk || !vv) continue;
            out[kk] = vv;
          }
          headerMap = Object.keys(out).length ? out : undefined;
        }
      }
    } catch {
      headerMap = undefined;
    }

    const rawSheetName = (req.body as any)?.sheetName;
    const sheetName = typeof rawSheetName === 'string' && rawSheetName.trim() ? rawSheetName.trim() : null;

    const rawSheetIndex = (req.body as any)?.sheetIndex;
    const sheetIndex = typeof rawSheetIndex === 'string' && rawSheetIndex.trim()
      ? Number(rawSheetIndex)
      : (typeof rawSheetIndex === 'number' ? rawSheetIndex : null);
    const sheetIndexClean = Number.isFinite(sheetIndex as any) ? Math.floor(sheetIndex as number) : null;

    let quoteNumber: string | null = null;
    let preparedBy: string | null = null;

    if (!String(sourceName || '').toLowerCase().endsWith('.csv')) {
      try {
        const input = Buffer.isBuffer(req.file.buffer) ? req.file.buffer : Buffer.from(req.file.buffer as any);
        const workbook = XLSX.read(input, { type: 'buffer' });
        const sheets = Array.isArray(workbook.SheetNames) ? workbook.SheetNames.filter(Boolean) : [];

        if (!sheetName && !sheetIndexClean && sheets.length > 1) {
          return res.status(422).json({
            error: 'Select sheet',
            message: 'Please select which sheet to import from this Excel workbook.',
            needsSheetSelection: true,
            sheets,
          });
        }

        const pickedSheetName = (sheetName ? sheets.find((n) => n === sheetName) : undefined)
          || ((Number.isFinite(sheetIndexClean as any) && sheetIndexClean != null) ? sheets[(sheetIndexClean as number) - 1] : undefined)
          || sheets[0];
        const worksheet = pickedSheetName ? workbook.Sheets[pickedSheetName] : undefined;
        if (!worksheet) {
          throw new Error('Excel worksheet not found');
        }

        const getCell = (addr: string) => {
          const c = (worksheet as any)?.[addr];
          if (!c) return '';
          return String(c.w ?? c.v ?? '').trim();
        };

        // Quote No: row 8, columns O+P (merged in this template)
        const q = `${getCell('O8')}${getCell('P8')}`.trim();
        quoteNumber = q || null;

        // Prepared By: row 8 (template may merge into W/X)
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' }) as any[][];
        const r8 = Array.isArray(rows[7]) ? rows[7].map((v) => String(v ?? '').trim()) : [];
        const preparedCell = r8.find((v) => /prepared\s*by/i.test(v))
          || getCell('X8')
          || getCell('W8');

        if (preparedCell) {
          const m = String(preparedCell).match(/prepared\s*by\s*:\s*(.+)$/i);
          preparedBy = (m && m[1] ? String(m[1]).trim() : String(preparedCell).trim()) || null;
        }

        const expectedHeaders = getExpectedCsvHeaders();
        const headerRowIndex = detectHeaderRowIndexFromRows(rows, { requiredHeaders: FIRE_DOOR_REQUIRED_HEADERS, expectedHeaders });
        const maxColumns = Math.max(1, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)));

        const lines: string[] = [];
        for (let r = headerRowIndex; r < rows.length; r++) {
          const row = Array.isArray(rows[r]) ? rows[r] : [];
          const values: string[] = [];
          for (let c = 0; c < maxColumns; c++) {
            values.push(String(row[c] ?? ''));
          }
          while (values.length > 1 && String(values[values.length - 1] ?? '').trim() === '') {
            values.pop();
          }
          if (!values.some((v) => String(v ?? '').trim() !== '')) continue;
          lines.push(values.map((v) => csvEscape(v)).join(','));
        }

        csvContent = lines.join('\n');
      } catch (err: any) {
        console.error('[fire-door-import-lw] Excel parse error:', err);
        return res.status(400).json({
          error: 'Failed to parse Excel file',
          message: err?.message || 'Invalid Excel format',
        });
      }
    }

    const beta = getJsonObject((tenantSettings as any).beta);
    const savedMapRaw = getJsonObject((beta as any).fireDoorLWImportHeaderMap);
    const savedMap = Object.keys(savedMapRaw).length ? (savedMapRaw as Record<string, string>) : undefined;

    const effectiveHeaderMap = headerMap || savedMap;

    // Validate headers (CSV or Excel converted to CSV)
    const headers = getCsvHeaders(csvContent);
    const expectedHeaders = getExpectedCsvHeaders();
    const expectedHeadersForMapping = expectedHeaders.filter((csvHeader) => {
      if (isCostOrLabourFieldLabel(csvHeader)) return false;
      const mappedField = (COLUMN_MAPPING as any)?.[csvHeader];
      const f = String(mappedField || '').trim().toLowerCase();
      return !(f.endsWith('cost') || f.endsWith('labour'));
    });

    const previewOnly = (() => {
      const raw = (req.body as any)?.previewOnly;
      if (raw === true) return true;
      const s = String(raw ?? '').trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes';
    })();

    const forceMapping = (() => {
      const raw = (req.body as any)?.forceMapping;
      if (raw === true) return true;
      const s = String(raw ?? '').trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes';
    })();

    const normalize = (input: any) =>
      String(input ?? '')
        .toLowerCase()
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*\/\s*/g, '/')
        .replace(/\s*-\s*/g, '-')
        .trim();

    const headerNormSet = new Set(headers.map(normalize).filter(Boolean));
    const hm = effectiveHeaderMap && typeof effectiveHeaderMap === 'object' ? effectiveHeaderMap : undefined;
    const missingExpected = expectedHeadersForMapping.filter((expected) => {
      const ne = normalize(expected);
      if (!ne) return false;
      if (headerNormSet.has(ne)) return false;
      const mapped = hm ? String((hm as any)[expected] || '').trim() : '';
      if (mapped && headerNormSet.has(normalize(mapped))) return false;
      return true;
    });

    // If forceMapping/previewOnly is true, always prompt once so the user can review/adjust mappings.
    if (forceMapping || previewOnly) {
      return res.status(422).json({
        error: 'Column mapping recommended',
        message: 'Review how your spreadsheet columns map to the import format.',
        needsMapping: true,
        missingHeaders: missingExpected,
        requiredHeaders: [],
        headers,
        expectedHeaders: expectedHeadersForMapping,
        headerMap: hm || {},
        sampleValues,
      });
    }

    // If file doesn't match and we have no saved/user mapping, prompt the mapping UI.
    if (!hm && missingExpected.length > 0) {
      return res.status(422).json({
        error: 'Column mapping recommended',
        message: 'Your spreadsheet columns don’t match the expected import format. Please map columns to continue.',
        needsMapping: true,
        missingHeaders: missingExpected,
        requiredHeaders: [],
        headers,
        expectedHeaders: expectedHeadersForMapping,
        headerMap: {},
        sampleValues,
      });
    }

    let parsedRows: ParsedFireDoorRow[];
    try {
      parsedRows = parseFireDoorCSV(csvContent, { headerMap: hm });
    } catch (err: any) {
      console.error('[fire-door-import-lw] CSV parse error:', err);
      return res.status(400).json({
        error: 'Failed to parse spreadsheet file',
        message: err.message || 'Invalid spreadsheet format',
      });
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({
        error: 'No valid product rows found',
        message: 'No importable rows were found in this spreadsheet.',
      });
    }

    const totalValue = calculateTotalValue(parsedRows);
    const rowCount = parsedRows.length;
    const importStartMs = Date.now();

    const preparedLineItems = parsedRows.map((row, idx) => {
      const scalarData: Record<string, any> = {};
      for (const [k, v] of Object.entries(row as any)) {
        if (!k || k === 'rawRowJson') continue;
        if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(k)) continue;
        const meta = FIRE_DOOR_LINE_ITEM_SCALAR_FIELDS.get(k);
        if (!meta) continue;
        scalarData[k] = coerceScalarValue(v, meta);
      }

      return {
        rawRowJson: (row as any).rawRowJson as any,
        ...scalarData,
        tenantId,
        rowIndex: idx,
      };
    });

    const result = await prisma.$transaction(
      async (tx) => {
        const importRecord = await tx.fireDoorImport.create({
          data: {
            tenantId,
            createdById: userId,
            sourceName,
            status: 'PROCESSING',
            totalValue,
            currency: 'GBP',
            rowCount,
            projectId,
          },
        });

        // Opportunistically fill project metadata from fixed LW cells.
        const updateData: any = { lastUpdatedBy: userId, lastUpdatedAt: new Date() };
        if (quoteNumber && !String(project.laqNumber || '').trim()) {
          updateData.laqNumber = quoteNumber;
        }
        if (preparedBy && !String(project.scheduledBy || '').trim()) {
          updateData.scheduledBy = preparedBy;
        }
        if (Object.keys(updateData).length > 2) {
          await tx.fireDoorScheduleProject.update({ where: { id: projectId }, data: updateData });
        }

        return { importRecord };
      },
      { timeout: 120000 }
    );

    const BATCH_SIZE = 100;
    try {
      const total = preparedLineItems.length;
      const batches = Math.ceil(total / BATCH_SIZE) || 1;
      console.log('[fire-door-import-lw] Inserting line items:', {
        tenantId,
        importId: result.importRecord.id,
        total,
        batchSize: BATCH_SIZE,
        batches,
      });

      for (let i = 0; i < preparedLineItems.length; i += BATCH_SIZE) {
        const chunk = preparedLineItems.slice(i, i + BATCH_SIZE);
        await prisma.fireDoorLineItem.createMany({
          data: chunk.map((li) => ({
            ...li,
            fireDoorImportId: result.importRecord.id,
          })) as any,
        });
      }

      await prisma.fireDoorImport.update({
        where: { id: result.importRecord.id },
        data: { status: 'COMPLETED' },
      });

      console.log('[fire-door-import-lw] Insert complete:', {
        tenantId,
        importId: result.importRecord.id,
        totalInserted: preparedLineItems.length,
        durationMs: Date.now() - importStartMs,
      });
    } catch (e: any) {
      await prisma.fireDoorImport.update({
        where: { id: result.importRecord.id },
        data: { status: 'FAILED' },
      });
      console.error('[fire-door-import-lw] Insert failed:', {
        tenantId,
        importId: result.importRecord.id,
        durationMs: Date.now() - importStartMs,
        message: e?.message || String(e),
      });
      throw e;
    }

    // Persist mapping template after successful LW import.
    // - If the user supplied a mapping, save it.
    // - Otherwise (first run), save an identity mapping for any exact header matches
    //   so subsequent LW imports consistently bypass the mapping prompt.
    const mapToSave = (() => {
      if (headerMap && Object.keys(headerMap).length) return headerMap;
      if (savedMap && Object.keys(savedMap).length) return null;

      const headerByNorm = new Map<string, string>();
      for (const h of headers) {
        const nh = normalize(h);
        if (nh && !headerByNorm.has(nh)) headerByNorm.set(nh, h);
      }

      const out: Record<string, string> = {};
      for (const expected of expectedHeadersForMapping) {
        const found = headerByNorm.get(normalize(expected));
        if (found) out[expected] = found;
      }
      return Object.keys(out).length ? out : null;
    })();

    if (mapToSave) {
      try {
        await prisma.tenantSettings.update({
          where: { tenantId },
          data: {
            beta: {
              ...(beta as any),
              fireDoorLWImportHeaderMap: mapToSave,
            },
          },
          select: { tenantId: true },
        });
      } catch (e: any) {
        console.warn('[fire-door-import-lw] Failed to save header map template:', e?.message || String(e));
      }
    }

    const previewRows = await prisma.fireDoorLineItem.findMany({
      where: { fireDoorImportId: result.importRecord.id },
      orderBy: { rowIndex: 'asc' },
      take: 10,
      select: {
        id: true,
        doorRef: true,
        location: true,
        rating: true,
        quantity: true,
        lineTotal: true,
      },
    });

    const previewItems = previewRows.map((item) => ({
      id: item.id,
      doorRef: item.doorRef,
      location: item.location,
      fireRating: item.rating,
      quantity: item.quantity,
      lineTotal: item.lineTotal ? Number(item.lineTotal) : null,
    }));

    const response: FireDoorImportResponse = {
      import: {
        id: result.importRecord.id,
        totalValue: Number(result.importRecord.totalValue),
        currency: result.importRecord.currency,
        status: result.importRecord.status,
        rowCount: result.importRecord.rowCount,
        createdAt: result.importRecord.createdAt,
      },
      lineItems: previewItems,
      totalValue: Number(totalValue),
      rowCount,
    };

    console.log(
      `[fire-door-import-lw] Successfully imported ${rowCount} doors for tenant ${tenantId}, total value: £${Number(totalValue).toFixed(2)}`
    );

    return res.json(response);
  } catch (error: any) {
    console.error('[fire-door-import-lw] Error:', error);
    return res.status(500).json({
      error: 'Import failed',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * GET /api/fire-doors/imports
 * List all fire door imports for the tenant
 * 
 * Auth: Requires authenticated user
 * Query params:
 *   - limit: number of records (default 20)
 *   - offset: pagination offset (default 0)
 */
router.get('/imports', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check fire door manufacturer status
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: 'Fire door import access required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const [imports, total] = await Promise.all([
      prisma.fireDoorImport.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          sourceName: true,
          status: true,
          totalValue: true,
          currency: true,
          rowCount: true,
          createdAt: true,
          projectId: true,
          orderId: true,
        },
      }),
      prisma.fireDoorImport.count({ where: { tenantId } }),
    ]);

    return res.json({
      imports: imports.map((i) => ({
        ...i,
        totalValue: Number(i.totalValue),
      })),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[fire-door-import] List error:', error);
    return res.status(500).json({ error: 'Failed to list imports' });
  }
});

/**
 * GET /api/fire-doors/imports/by-project/:projectId
 * List all imports associated with a specific Fire Door Schedule project
 */
router.get('/imports/by-project/:projectId', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projectId = req.params.projectId as string;
    const imports = await prisma.fireDoorImport.findMany({
      where: { tenantId, projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceName: true,
        totalValue: true,
        currency: true,
        rowCount: true,
        createdAt: true,
      },
    });

    return res.json({ imports: imports.map(i => ({ ...i, totalValue: Number(i.totalValue) })) });
  } catch (error: any) {
    console.error('[fire-door-import] List by project error:', error);
    return res.status(500).json({ error: 'Failed to list imports for project' });
  }
});

/**
 * GET /api/fire-doors/imports/:id
 * Get details of a specific import with all line items
 * 
 * Auth: Requires authenticated user
 */
router.get('/imports/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const importId = req.params.id;

    const importRecord = await prisma.fireDoorImport.findFirst({
      where: { 
        id: importId,
        tenantId, // Ensure tenant isolation
      },
      include: {
        lineItems: {
          orderBy: { rowIndex: 'asc' },
        },
      },
    });

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    // Convert Decimal fields to numbers for JSON serialization
    const response = {
      ...importRecord,
      totalValue: Number(importRecord.totalValue),
      lineItems: importRecord.lineItems.map((item) => ({
        ...item,
        unitValue: item.unitValue ? Number(item.unitValue) : null,
        labourCost: item.labourCost ? Number(item.labourCost) : null,
        materialCost: item.materialCost ? Number(item.materialCost) : null,
        lineTotal: item.lineTotal ? Number(item.lineTotal) : null,
      })),
    };

    return res.json(response);
  } catch (error: any) {
    console.error('[fire-door-import] Get import error:', error);
    return res.status(500).json({ error: 'Failed to fetch import' });
  }
});

/**
 * PATCH /api/fire-doors/line-items/bulk
 * Persist grid edits for multiple line items in a single request.
 *
 * Body: { updates: Array<{ id: string; changes: Record<string, any> }> }
 *
 * Notes:
 * - Updates scalar DB fields when they exist
 * - Stores all other edited columns into rawRowJson.__grid for round-trip persistence
 */
router.patch('/line-items/bulk', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check fire door manufacturer status
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: 'Fire door import access required' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : null;
    const updates = (body && Array.isArray((body as any).updates)) ? (body as any).updates : null;

    if (!updates || updates.length === 0) {
      return res.status(400).json({ error: 'Invalid updates payload' });
    }

    const ids: string[] = [];
    const seen = new Set<string>();
    for (const u of updates) {
      const id = String(u?.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Each update must include a valid id' });
      if (seen.has(id)) return res.status(400).json({ error: `Duplicate id in updates: ${id}` });
      seen.add(id);
      ids.push(id);
    }

    const existing = await prisma.fireDoorLineItem.findMany({
      where: {
        tenantId,
        id: { in: ids },
      },
      select: {
        id: true,
        rawRowJson: true,
      },
    });

    const existingById = new Map<string, { id: string; rawRowJson: any }>();
    for (const item of existing) existingById.set(item.id, item as any);

    const missing = ids.filter((id) => !existingById.has(id));
    if (missing.length > 0) {
      return res.status(404).json({ error: 'One or more line items not found', missing });
    }

    const tx: Prisma.PrismaPromise<any>[] = [];

    for (const u of updates) {
      const rowId = String(u?.id || '').trim();
      const changes = (u && typeof u === 'object' && typeof (u as any).changes === 'object' && (u as any).changes && !Array.isArray((u as any).changes))
        ? (u as any).changes
        : null;

      if (!changes) {
        return res.status(400).json({ error: `Invalid changes for id ${rowId}` });
      }

      const current = existingById.get(rowId)!;
      const updateData: Record<string, any> = {};
      const gridEdits: Record<string, any> = {};

      for (const [uiKeyRaw, uiVal] of Object.entries(changes)) {
        const uiKey = String(uiKeyRaw || '').trim();
        if (!uiKey) continue;
        if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(uiKey)) continue;

        const dbKey = UI_TO_DB_FIELD_ALIASES[uiKey] || uiKey;
        const meta = FIRE_DOOR_LINE_ITEM_SCALAR_FIELDS.get(dbKey);
        const isScalar = !!meta;

        if (isScalar && !LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(dbKey)) {
          updateData[dbKey] = coerceScalarValue(uiVal, meta);
        } else {
          gridEdits[uiKey] = sanitizeJsonValue(uiVal === '' ? null : uiVal);
        }
      }

      if (Object.keys(updateData).length === 0 && Object.keys(gridEdits).length === 0) {
        continue;
      }

      if (Object.keys(gridEdits).length > 0) {
        const baseRaw = (current.rawRowJson && typeof current.rawRowJson === 'object') ? (current.rawRowJson as any) : {};
        const prevGrid = (baseRaw.__grid && typeof baseRaw.__grid === 'object') ? baseRaw.__grid : {};
        updateData.rawRowJson = {
          ...baseRaw,
          __grid: {
            ...prevGrid,
            ...gridEdits,
          },
        };
      }

      tx.push(
        prisma.fireDoorLineItem.update({
          where: { id: rowId },
          data: updateData,
        })
      );
    }

    if (tx.length === 0) {
      return res.json({ ok: true, updated: false, items: [] });
    }

    const updated = await prisma.$transaction(tx);
    return res.json({ ok: true, updated: true, items: updated.map(serializeLineItemForJson) });
  } catch (error: any) {
    console.error('[fire-doors] Bulk update line items error:', error);
    return res.status(500).json({ error: 'Failed to bulk update line items', message: error.message || 'Unknown error' });
  }
});

/**
 * PATCH /api/fire-doors/line-items/:id
 * Persist grid edits for a single line item.
 * - Updates scalar DB fields when they exist
 * - Stores all other edited columns into rawRowJson.__grid for round-trip persistence
 */
router.patch('/line-items/:id', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check fire door manufacturer status
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: 'Fire door import access required' });
    }

    const lineItemId = String(req.params.id || '').trim();
    if (!lineItemId) {
      return res.status(400).json({ error: 'Line item id required' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : null;
    const changes = (body && typeof (body as any).changes === 'object' && (body as any).changes)
      ? (body as any).changes
      : body;

    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return res.status(400).json({ error: 'Invalid changes payload' });
    }

    const existing = await prisma.fireDoorLineItem.findFirst({
      where: { id: lineItemId, tenantId },
      select: { id: true, rawRowJson: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    const updateData: Record<string, any> = {};
    const gridEdits: Record<string, any> = {};

    for (const [uiKeyRaw, uiVal] of Object.entries(changes)) {
      const uiKey = String(uiKeyRaw || '').trim();
      if (!uiKey) continue;
      if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(uiKey)) continue;

      const dbKey = UI_TO_DB_FIELD_ALIASES[uiKey] || uiKey;

      const meta = FIRE_DOOR_LINE_ITEM_SCALAR_FIELDS.get(dbKey);
      const isScalar = !!meta;

      if (isScalar && !LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(dbKey)) {
        updateData[dbKey] = coerceScalarValue(uiVal, meta);
      } else {
        // Persist any non-DB column edits in rawRowJson.__grid keyed by grid column key
        gridEdits[uiKey] = sanitizeJsonValue(uiVal === '' ? null : uiVal);
      }
    }

    if (Object.keys(updateData).length === 0 && Object.keys(gridEdits).length === 0) {
      return res.json({ ok: true, updated: false });
    }

    if (Object.keys(gridEdits).length > 0) {
      const baseRaw = (existing.rawRowJson && typeof existing.rawRowJson === 'object') ? (existing.rawRowJson as any) : {};
      const prevGrid = (baseRaw.__grid && typeof baseRaw.__grid === 'object') ? baseRaw.__grid : {};
      updateData.rawRowJson = {
        ...baseRaw,
        __grid: {
          ...prevGrid,
          ...gridEdits,
        },
      };
    }

    const updated = await prisma.fireDoorLineItem.update({
      where: { id: lineItemId },
      data: updateData,
    });

    return res.json({
      ok: true,
      updated: true,
      item: serializeLineItemForJson(updated),
    });
  } catch (error: any) {
    console.error('[fire-doors] Update line item error:', error);
    return res.status(500).json({ error: 'Failed to update line item', message: error.message || 'Unknown error' });
  }
});

/**
 * POST /api/fire-doors/line-items/bulk-create
 * Create N blank line items for an import.
 *
 * Body: { fireDoorImportId: string; count: number }
 */
router.post('/line-items/bulk-create', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check fire door manufacturer status
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: 'Fire door import access required' });
    }

    const fireDoorImportId = String((req.body as any)?.fireDoorImportId || '').trim();
    const countRaw = (req.body as any)?.count;
    const count = Number(countRaw);

    if (!fireDoorImportId) {
      return res.status(400).json({ error: 'fireDoorImportId is required' });
    }
    if (!Number.isFinite(count) || count <= 0) {
      return res.status(400).json({ error: 'count must be a positive number' });
    }
    if (count > 500) {
      return res.status(400).json({ error: 'count too large (max 500)' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const imp = await tx.fireDoorImport.findFirst({
        where: { id: fireDoorImportId, tenantId },
        select: { id: true },
      });
      if (!imp) {
        throw Object.assign(new Error('Import not found'), { status: 404 });
      }

      const max = await tx.fireDoorLineItem.aggregate({
        where: { tenantId, fireDoorImportId },
        _max: { rowIndex: true },
      });
      const startRowIndex = (max?._max?.rowIndex ?? -1) + 1;

      const data: Array<{ tenantId: string; fireDoorImportId: string; rowIndex: number; rawRowJson: any }> = [];
      for (let i = 0; i < count; i++) {
        data.push({
          tenantId,
          fireDoorImportId,
          rowIndex: startRowIndex + i,
          rawRowJson: { __grid: {} },
        });
      }

      await tx.fireDoorLineItem.createMany({ data });
      await tx.fireDoorImport.update({
        where: { id: fireDoorImportId },
        data: { rowCount: { increment: count } },
      });

      const items = await tx.fireDoorLineItem.findMany({
        where: {
          tenantId,
          fireDoorImportId,
          rowIndex: { gte: startRowIndex },
        },
        orderBy: { rowIndex: 'asc' },
      });

      return items;
    });

    return res.json({ ok: true, items: created.map(serializeLineItemForJson) });
  } catch (error: any) {
    const status = (error && typeof error === 'object' && (error as any).status) ? (error as any).status : null;
    if (status === 404) {
      return res.status(404).json({ error: 'Import not found' });
    }
    console.error('[fire-doors] Bulk create line items error:', error);
    return res.status(500).json({ error: 'Failed to bulk create line items', message: error.message || 'Unknown error' });
  }
});

/**
 * POST /api/fire-doors/line-items/bulk-delete
 * Delete one or more line items and reindex remaining rows for each affected import.
 *
 * Body: { ids: string[] }
 */
router.post('/line-items/bulk-delete', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check fire door manufacturer status
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { isFireDoorManufacturer: true },
    });

    if (!tenantSettings?.isFireDoorManufacturer) {
      return res.status(403).json({ error: 'Fire door import access required' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : null;
    const idsRaw = (body && Array.isArray((body as any).ids)) ? (body as any).ids : null;
    if (!idsRaw || idsRaw.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' });
    }

    const ids: string[] = Array.from(
      new Set((idsRaw as any[]).map((x: any) => String(x || '').trim()).filter(Boolean))
    );
    if (ids.length === 0) {
      return res.status(400).json({ error: 'ids must contain valid ids' });
    }
    if (ids.length > 200) {
      return res.status(400).json({ error: 'Too many ids (max 200)' });
    }

    const existing = await prisma.fireDoorLineItem.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, fireDoorImportId: true },
    });
    const existingIds = new Set(existing.map((x) => x.id));
    const missing = ids.filter((id) => !existingIds.has(id));
    if (missing.length) {
      return res.status(404).json({ error: 'One or more line items not found', missing });
    }

    const importIds: string[] = Array.from(new Set(existing.map((x) => x.fireDoorImportId)));
    const deleteCountByImportId = new Map<string, number>();
    for (const li of existing) {
      deleteCountByImportId.set(li.fireDoorImportId, (deleteCountByImportId.get(li.fireDoorImportId) || 0) + 1);
    }

    await prisma.$transaction(async (tx) => {
      await tx.fireDoorLineItem.deleteMany({
        where: { tenantId, id: { in: ids } },
      });

      // Maintain import rowCount best-effort
      for (const fireDoorImportId of importIds) {
        const dec = deleteCountByImportId.get(fireDoorImportId) || 0;
        if (dec <= 0) continue;
        await tx.fireDoorImport.updateMany({
          where: { tenantId, id: fireDoorImportId },
          data: { rowCount: { decrement: dec } },
        });
      }

      // Reindex each affected import for stable ordering
      for (const fireDoorImportId of importIds) {
        const remaining = await tx.fireDoorLineItem.findMany({
          where: { tenantId, fireDoorImportId },
          select: { id: true, rowIndex: true },
          orderBy: { rowIndex: 'asc' },
        });

        const updates: Prisma.PrismaPromise<any>[] = [];
        for (let i = 0; i < remaining.length; i++) {
          const item = remaining[i];
          if (item.rowIndex !== i) {
            updates.push(tx.fireDoorLineItem.update({ where: { id: item.id }, data: { rowIndex: i } }));
          }
        }
        if (updates.length) {
          await Promise.all(updates);
        }
      }
    });

    return res.json({ ok: true, deleted: ids.length });
  } catch (error: any) {
    console.error('[fire-doors] Bulk delete line items error:', error);
    return res.status(500).json({ error: 'Failed to bulk delete line items', message: error.message || 'Unknown error' });
  }
});

export default router;
