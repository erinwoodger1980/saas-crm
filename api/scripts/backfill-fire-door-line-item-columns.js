#!/usr/bin/env node

/*
Backfill FireDoorLineItem scalar columns from historical JSON storage.

- Reads `rawRowJson` (original CSV row) using the canonical Fire Door catalog labels.
- Also reads `rawRowJson.__grid` (historical grid edits) and maps UI keys -> DB keys.
- Writes into real Prisma scalar columns where currently null.

Safe defaults:
- Dry-run by default (no writes unless --write).
- Does not overwrite non-null columns unless --overwrite.

Usage:
  DATABASE_URL=... node scripts/backfill-fire-door-line-item-columns.js --write
  DATABASE_URL=... node scripts/backfill-fire-door-line-item-columns.js --dry-run

Options:
  --write           Actually write updates (default: false)
  --overwrite       Overwrite non-null fields (default: false)
  --tenant <id>     Restrict to tenantId
  --limit <n>       Stop after processing n rows
  --batch <n>       Batch size for pagination (default: 200)
*/

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { Prisma, PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const args = minimist(process.argv.slice(2), {
  boolean: ['write', 'dry-run', 'overwrite'],
  default: {
    write: false,
    overwrite: false,
    batch: 200,
  },
});

const shouldWrite = Boolean(args.write) && !Boolean(args['dry-run']);
const overwrite = Boolean(args.overwrite);
const tenantId = args.tenant ? String(args.tenant) : null;
const limit = Number.isFinite(Number(args.limit)) ? Number(args.limit) : null;
const batchSize = Math.max(1, Math.min(1000, Number(args.batch) || 200));

const LINE_ITEM_FORBIDDEN_UPDATE_FIELDS = new Set(['id', 'tenantId', 'fireDoorImportId', 'createdAt', 'updatedAt']);

// UI grid column keys → DB column names when they differ.
const UI_TO_DB_FIELD_ALIASES = {
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
  closerType: 'closerOrFloorSpring',
  mLeafWidth: 'masterLeafWidth',
  sLeafWidth: 'slaveLeafWidth',
  priceEa: 'unitValue',
  linePrice: 'lineTotal',
};

function normalizeLabel(input) {
  return String(input || '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeaderCandidate(input) {
  return String(input ?? '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .trim();
}

function autoDbKeyFromLabel(label) {
  const cleaned = normalizeLabel(label)
    .replace(/\u00a0/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'field';
  const [first, ...rest] = parts;
  return first.toLowerCase() + rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function coerceScalarValue(value, fieldMeta) {
  if (value === undefined) return undefined;
  if (value === '') return null;
  if (value === null) return null;

  const type = fieldMeta && fieldMeta.type;

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

  return typeof value === 'string' ? value : String(value);
}

function readCatalogLabels() {
  const catalogPath = path.join(__dirname, '..', 'src', 'lib', 'fireDoorImport', 'fieldCatalog.ts');
  const src = fs.readFileSync(catalogPath, 'utf8');
  const m = src.match(/const FIRE_DOOR_FIELD_LABELS_RAW = \[(\s|\S)*?\] as const;/);
  if (!m) throw new Error('Could not find FIRE_DOOR_FIELD_LABELS_RAW in fieldCatalog.ts');

  const strRe = /'([^']*)'/g;
  const labels = [];
  let sm;
  while ((sm = strRe.exec(m[0]))) {
    const label = normalizeLabel(sm[1]);
    if (!label) continue;
    labels.push(label);
  }

  // De-dupe case-insensitively, preserve order
  const out = [];
  const seen = new Set();
  for (const l of labels) {
    const k = l.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

function readLabelToDbKeyMap() {
  const mapPath = path.join(__dirname, '..', 'src', 'lib', 'fireDoorImport', 'labelToDbKey.ts');
  const src = fs.readFileSync(mapPath, 'utf8');
  const entryRe = /^\s*"([^"]+)":\s*"([^"]+)",?\s*$/gm;
  const map = new Map();
  let em;
  while ((em = entryRe.exec(src))) {
    map.set(String(em[1]).toLowerCase(), String(em[2]));
  }
  return map;
}

function buildExpectedLabelToDbKey(labels, explicitMap) {
  return labels.map((label) => {
    const norm = normalizeLabel(label).toLowerCase();
    const dbKey = explicitMap.get(norm) || autoDbKeyFromLabel(label);
    return { label, dbKey };
  });
}

function getScalarFieldMetaMap() {
  const dmmf = Prisma && Prisma.dmmf;
  const model = dmmf && dmmf.datamodel && Array.isArray(dmmf.datamodel.models)
    ? dmmf.datamodel.models.find((m) => m && m.name === 'FireDoorLineItem')
    : null;
  const map = new Map();
  const fields = model && Array.isArray(model.fields) ? model.fields : [];
  for (const f of fields) {
    if (f && f.kind === 'scalar' && typeof f.name === 'string') {
      map.set(f.name, f);
    }
  }
  return map;
}

function getRowHeaderLookup(rawRowJson) {
  const out = new Map();
  if (!rawRowJson || typeof rawRowJson !== 'object') return out;
  for (const k of Object.keys(rawRowJson)) {
    if (k === '__grid') continue;
    const nk = normalizeHeaderCandidate(k);
    if (!nk) continue;
    if (!out.has(nk)) out.set(nk, k);
  }
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Refusing to run.');
    process.exit(2);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

  try {
    const labels = readCatalogLabels();
    const explicitMap = readLabelToDbKeyMap();
    const expected = buildExpectedLabelToDbKey(labels, explicitMap);

    const scalarMeta = getScalarFieldMetaMap();

    // Select only scalar fields that actually exist.
    const select = { id: true, tenantId: true, rawRowJson: true };
    for (const { dbKey } of expected) {
      if (!dbKey) continue;
      if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(dbKey)) continue;
      if (scalarMeta.has(dbKey)) select[dbKey] = true;
    }

    let processed = 0;
    let updated = 0;
    let fieldsWritten = 0;

    const where = tenantId ? { tenantId } : {};
    const total = await prisma.fireDoorLineItem.count({ where });
    console.log(`Backfill FireDoorLineItem columns (${shouldWrite ? 'WRITE' : 'DRY-RUN'})`);
    console.log(`Rows in scope: ${total}${tenantId ? ` (tenantId=${tenantId})` : ''}`);

    let cursor = null;

    while (true) {
      const take = batchSize;
      const batch = await prisma.fireDoorLineItem.findMany({
        where,
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
        select,
      });

      if (!batch.length) break;

      for (const item of batch) {
        processed++;
        if (limit && processed > limit) break;

        const updateData = {};

        // 1) From rawRowJson using catalog labels (tolerant header matching)
        const raw = item.rawRowJson && typeof item.rawRowJson === 'object' ? item.rawRowJson : {};
        const headerLookup = getRowHeaderLookup(raw);

        for (const { label, dbKey } of expected) {
          if (!dbKey) continue;
          if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(dbKey)) continue;
          const meta = scalarMeta.get(dbKey);
          if (!meta) continue;

          const currentVal = item[dbKey];
          if (!overwrite && currentVal !== null && currentVal !== undefined) continue;

          let rawValue = raw[label];
          if (rawValue === undefined) {
            const nk = normalizeHeaderCandidate(label);
            const actualKey = headerLookup.get(nk);
            if (actualKey) rawValue = raw[actualKey];
          }
          if (rawValue === undefined) continue;

          const coerced = coerceScalarValue(rawValue, meta);
          if (coerced === undefined) continue;
          updateData[dbKey] = coerced;
        }

        // 2) From rawRowJson.__grid (historical edits)
        const grid = raw && raw.__grid && typeof raw.__grid === 'object' ? raw.__grid : null;
        if (grid) {
          for (const [uiKeyRaw, uiVal] of Object.entries(grid)) {
            const uiKey = String(uiKeyRaw || '').trim();
            if (!uiKey) continue;

            const dbKey = UI_TO_DB_FIELD_ALIASES[uiKey] || uiKey;
            if (LINE_ITEM_FORBIDDEN_UPDATE_FIELDS.has(dbKey)) continue;
            const meta = scalarMeta.get(dbKey);
            if (!meta) continue;

            const currentVal = item[dbKey];
            if (!overwrite && currentVal !== null && currentVal !== undefined) continue;

            const coerced = coerceScalarValue(uiVal, meta);
            if (coerced === undefined) continue;
            updateData[dbKey] = coerced;
          }
        }

        const keys = Object.keys(updateData);
        if (keys.length) {
          updated++;
          fieldsWritten += keys.length;
          if (shouldWrite) {
            await prisma.fireDoorLineItem.update({ where: { id: item.id }, data: updateData });
          }
        }
      }

      cursor = batch[batch.length - 1].id;

      if (limit && processed >= limit) break;
    }

    console.log(`Processed: ${processed}`);
    console.log(`Would update: ${updated}`);
    console.log(`Fields ${shouldWrite ? 'written' : 'to write'}: ${fieldsWritten}`);
    console.log('Done.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err && err.message ? err.message : err);
  if (err && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
