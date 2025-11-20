// api/src/routes/leads.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { MeasurementSource } from "@prisma/client";
import { gmailSend, getAccessTokenForTenant, gmailFetchAttachment } from "../services/gmail";
import { logInsight, logEvent } from "../services/training";
import { UiStatus, loadTaskPlaybook, ensureTaskFromRecipe, TaskPlaybook } from "../task-playbook";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { randomUUID } from "crypto";
import multer from "multer";
import {
  CANONICAL_FIELD_CONFIG,
  lookupCsvField,
  parseFlexibleDate,
  toNumberGBP,
  toISODate,
} from "../lib/leads/fieldMap";

const router = Router();

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/* ------------------------------------------------------------------ */
/* Helpers: auth + status mapping                                      */
/* ------------------------------------------------------------------ */

function headerString(req: any, key: string): string | undefined {
  const raw = req.headers?.[key];
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

function getAuth(req: any) {
  return {
    tenantId:
      (req.auth?.tenantId as string | undefined) ?? headerString(req, "x-tenant-id"),
    userId:
      (req.auth?.userId as string | undefined) ?? headerString(req, "x-user-id"),
    email: (req.auth?.email as string | undefined) ?? headerString(req, "x-user-email"),
  };
}

// Stored enum values (supports both legacy + new names)
type DbStatus =
  | "NEW"
  | "CONTACTED"
  | "INFO_REQUESTED"
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "REJECTED"
  | "READY_TO_QUOTE"
  | "QUOTE_SENT"
  | "WON"
  | "LOST";

function uiToDb(s: UiStatus): DbStatus {
  switch (s) {
    case "NEW_ENQUIRY":
      return "NEW";
    case "INFO_REQUESTED":
      return "INFO_REQUESTED";
    case "READY_TO_QUOTE":
      return "READY_TO_QUOTE";
    case "QUOTE_SENT":
      return "QUOTE_SENT";
    case "WON":
      return "WON";
    case "REJECTED":
      return "REJECTED";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    case "LOST":
      return "LOST";
  }
  return "NEW";
}

function dbToUi(db: string): UiStatus {
  switch (String(db).toUpperCase()) {
    case "NEW":
      return "NEW_ENQUIRY";
    case "CONTACTED":
      return "INFO_REQUESTED";
    case "INFO_REQUESTED":
      return "INFO_REQUESTED";
    case "QUALIFIED":
      return "READY_TO_QUOTE";
    case "READY_TO_QUOTE":
      return "READY_TO_QUOTE";
    case "QUOTE_SENT":
      return "QUOTE_SENT";
    case "REJECTED":
      return "REJECTED";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    case "WON":
      return "WON";
    case "LOST":
      return "LOST";
    default:
      return "NEW_ENQUIRY";
  }
}

function monthStartUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

const CANONICAL_FIELD_KEYS = Object.keys(CANONICAL_FIELD_CONFIG);

function normalizeCanonicalValue(key: string, input: any): any {
  const config = CANONICAL_FIELD_CONFIG[key];
  if (!config) return input;
  if (input === undefined) return undefined;
  if (input === null) return null;

  if (config.type === "number") {
    if (typeof input === "number") {
      return Number.isFinite(input) ? input : null;
    }
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return null;
      const parsed = toNumberGBP(trimmed);
      return parsed != null ? parsed : null;
    }
    return null;
  }

  if (config.type === "date") {
    if (input instanceof Date) {
      return Number.isNaN(input.getTime()) ? null : input;
    }
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return null;
      const parsed = parseFlexibleDate(trimmed) ?? null;
      if (parsed) return parsed;
      const iso = toISODate(trimmed);
      if (iso) {
        const next = new Date(iso);
        return Number.isNaN(next.getTime()) ? null : next;
      }
      return null;
    }
    return null;
  }

  return input;
}

function canonicalToCustomValue(key: string, value: any): any {
  const config = CANONICAL_FIELD_CONFIG[key];
  if (!config) return value;
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (config.type === "date") {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      const parsed = parseFlexibleDate(value);
      return parsed ? parsed.toISOString() : value;
    }
  }
  return value;
}

function toMaybeNumber(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object" && value !== null) {
    const possible = value as any;
    if (typeof possible.toNumber === "function") {
      const num = Number(possible.toNumber());
      return Number.isNaN(num) ? null : num;
    }
    if (typeof possible.valueOf === "function") {
      const val = possible.valueOf();
      const num = Number(val);
      if (!Number.isNaN(num)) return num;
    }
  }
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

const MIN_MEASUREMENT_MM = 300;
const MAX_MEASUREMENT_MM = 3000;

function normalizeMeasurement(value: any): number | null {
  const num = toMaybeNumber(value);
  if (num === null) return null;
  const clamped = Math.max(MIN_MEASUREMENT_MM, Math.min(MAX_MEASUREMENT_MM, num));
  return Math.round(clamped / 10) * 10;
}

function normalizeMeasurementSource(input: any): MeasurementSource | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().toUpperCase();
  if (raw === "MANUAL") return "MANUAL";
  if (raw === "PHOTO_ESTIMATE") return "PHOTO_ESTIMATE";
  return null;
}

function normalizeConfidence(input: any): number | null {
  const num = toMaybeNumber(input);
  if (num === null) return null;
  const clamped = Math.max(0, Math.min(1, num));
  return Math.round(clamped * 100) / 100;
}

function buildComputedValues(lead: any): Record<string, any> {
  const base = lead?.custom && typeof lead.custom === "object" ? { ...(lead.custom as Record<string, any>) } : {};
  for (const key of CANONICAL_FIELD_KEYS) {
    const raw = (lead as any)[key];
    if (raw === undefined || raw === null) continue;
    const cfg = CANONICAL_FIELD_CONFIG[key];
    if (cfg?.type === "date") {
      const value = raw instanceof Date ? raw : new Date(raw);
      if (!Number.isNaN(value.getTime())) {
        base[key] = value.toISOString();
      }
    } else {
      if (typeof raw === "object" && raw !== null) {
        const possible = raw as any;
        if (typeof possible.toNumber === "function") {
          base[key] = Number(possible.toNumber());
          continue;
        }
        if (typeof possible.valueOf === "function") {
          const val = possible.valueOf();
          const num = Number(val);
          if (!Number.isNaN(num)) {
            base[key] = num;
            continue;
          }
        }
      }
      const num = Number(raw);
      base[key] = Number.isNaN(num) ? raw : num;
    }
  }
  return base;
}

function serializeLeadRow(lead: any, extras: Record<string, any> = {}) {
  const payload: any = {
    id: lead.id,
    contactName: lead.contactName,
    email: lead.email,
    description: lead.description,
    status: (lead.custom as any)?.uiStatus || dbToUi(lead.status),
    custom: lead.custom,
    estimatedValue: toMaybeNumber(lead.estimatedValue),
    quotedValue: toMaybeNumber(lead.quotedValue),
    dateQuoteSent: lead.dateQuoteSent ? lead.dateQuoteSent.toISOString() : null,
    computed: buildComputedValues(lead),
    ...extras,
  };
  return payload;
}

/* ------------------------------------------------------------------ */
/* CSV Import Helpers                                                  */
/* ------------------------------------------------------------------ */

function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const flushField = () => {
    let value = currentField;
    if (!inQuotes) {
      value = value.replace(/\r/g, '');
    }
    currentField = '';
    currentRow.push(value);
  };

  const flushRow = () => {
    flushField();
    // Remove empty trailing row created by extra newline
    if (currentRow.length === 1 && currentRow[0] === '' && rows.length === 0) {
      currentRow = [];
      return;
    }
    rows.push(currentRow.map(field => field.trim().replace(/^"|"$/g, '').replace(/""/g, '"')));
    currentRow = [];
  };

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = i + 1 < csvText.length ? csvText[i + 1] : '';

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      flushField();
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      // handle Windows style \r\n newlines
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      flushRow();
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    flushRow();
  }

  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h, idx) => {
    const trimmed = h.trim();
    return idx === 0 ? trimmed.replace(/^\ufeff/, '') : trimmed;
  });
  const normalizedRows = dataRows
    .filter(row => row.some(cell => cell.trim().length > 0))
    .map(row => {
      const padded = [...row];
      while (padded.length < headers.length) padded.push('');
      return padded.slice(0, headers.length);
    });

  return { headers, rows: normalizedRows };
}

function validateLeadData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.contactName || typeof data.contactName !== 'string' || !data.contactName.trim()) {
    errors.push('Contact name is required');
  }
  
  if (data.email && typeof data.email === 'string' && data.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      errors.push('Invalid email format');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* CSV Import Endpoints                                                */
/* ------------------------------------------------------------------ */

// Preview CSV file and return headers for field mapping
router.post("/import/preview", upload.single('csvFile'), async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });
  
  if (!req.file) {
    return res.status(400).json({ error: "CSV file is required" });
  }
  
  try {
    const csvText = req.file.buffer.toString('utf-8');
    const { headers, rows } = parseCSV(csvText);
    
    // Return first few rows as preview
    const preview = rows.slice(0, 5);
    
    // Get questionnaire questions for this tenant
    const leadFieldDefs = await prisma.leadFieldDef.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' }
    });
    
    // Build available fields including basic fields and questionnaire questions
    const availableFields = [
      { key: 'contactName', label: 'Contact Name', required: true },
      { key: 'email', label: 'Email', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'company', label: 'Company', required: false },
      { key: 'description', label: 'Description', required: false },
      { key: 'source', label: 'Source', required: false },
      { key: 'status', label: 'Status', required: false },
      // Add questionnaire questions
      ...leadFieldDefs.map(field => ({
        key: `custom.${field.key}`,
        label: `${field.label} (Questionnaire)`,
        required: field.required
      }))
    ];
    
    res.json({
      headers,
      preview,
      totalRows: rows.length,
      availableFields
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to parse CSV file' });
  }
});

// Import leads from CSV with field mapping
router.post("/import/execute", upload.single('csvFile'), async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });
  
  if (!req.file) {
    return res.status(400).json({ error: "CSV file is required" });
  }
  
  const { fieldMapping } = req.body;
  if (!fieldMapping) {
    return res.status(400).json({ error: "Field mapping is required" });
  }
  
  let mapping: Record<string, string>;
  try {
    mapping = typeof fieldMapping === 'string' ? JSON.parse(fieldMapping) : fieldMapping;
  } catch {
    return res.status(400).json({ error: "Invalid field mapping format" });
  }
  
  try {
    const csvText = req.file.buffer.toString('utf-8');
    const { headers, rows } = parseCSV(csvText);
    
    const playbook = await loadTaskPlaybook(tenantId);
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: number; errors: string[] }>,
      leadIds: [] as string[]
    };
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const leadData: any = {};
      const customData: any = {};
      
      // Map CSV columns to lead fields
      const mappedColumns = new Set<string>();
      for (const [csvColumn, leadField] of Object.entries(mapping)) {
        mappedColumns.add(csvColumn);
        const columnIndex = headers.indexOf(csvColumn);
        if (columnIndex >= 0 && columnIndex < row.length) {
          const rawValue = row[columnIndex]?.trim();
          if (!rawValue) continue;
          const config = lookupCsvField(csvColumn);
          const transformed = config?.transform ? config.transform(rawValue) ?? rawValue : rawValue;

          if (leadField.startsWith('custom.')) {
            const questionKey = leadField.substring(7);
            if (CANONICAL_FIELD_CONFIG[questionKey]) {
              const normalized = normalizeCanonicalValue(questionKey, transformed);
              if (normalized !== undefined) {
                leadData[questionKey] = normalized ?? null;
                const customVal = canonicalToCustomValue(questionKey, normalized);
                customData[questionKey] = customVal ?? null;
                continue;
              }
            }
            customData[questionKey] = transformed;
          } else {
            const canonical = normalizeCanonicalValue(leadField, transformed);
            if (canonical !== undefined) {
              leadData[leadField] = canonical ?? null;
              if (CANONICAL_FIELD_CONFIG[leadField]) {
                const customVal = canonicalToCustomValue(leadField, canonical);
                customData[leadField] = customVal ?? null;
              }
            } else {
              leadData[leadField] = transformed;
            }

            if (config?.qKey && !Object.prototype.hasOwnProperty.call(customData, config.qKey)) {
              if (CANONICAL_FIELD_CONFIG[config.qKey]) {
                const normalized = normalizeCanonicalValue(config.qKey, transformed);
                if (normalized !== undefined) {
                  customData[config.qKey] = canonicalToCustomValue(config.qKey, normalized);
                }
              } else {
                customData[config.qKey] = transformed;
              }
            }
          }
        }
      }

      // Auto-apply canonical mappings for unmapped columns
      headers.forEach((header, idx) => {
        if (idx >= row.length) return;
        if (mappedColumns.has(header)) return;
        const config = lookupCsvField(header);
        if (!config) return;
        const rawValue = row[idx]?.trim();
        if (!rawValue) return;
        const transformed = config.transform ? config.transform(rawValue) ?? rawValue : rawValue;

        if (config.leadKey) {
          const normalized = normalizeCanonicalValue(config.leadKey, transformed);
          if (normalized !== undefined) {
            leadData[config.leadKey] = normalized ?? null;
            if (CANONICAL_FIELD_CONFIG[config.leadKey]) {
              customData[config.leadKey] = canonicalToCustomValue(config.leadKey, normalized);
            }
          }
        }
        if (config.qKey) {
          if (CANONICAL_FIELD_CONFIG[config.qKey]) {
            const normalized = normalizeCanonicalValue(config.qKey, transformed);
            if (normalized !== undefined) {
              customData[config.qKey] = canonicalToCustomValue(config.qKey, normalized);
            }
          } else {
            customData[config.qKey] = transformed;
          }
        }
      });
      
      // Validate the lead data
      const validation = validateLeadData(leadData);
      if (!validation.valid) {
        results.failed++;
        results.errors.push({ row: i + 1, errors: validation.errors });
        continue;
      }
      
      try {
        // Determine status
        let uiStatus: UiStatus = "NEW_ENQUIRY";
        if (leadData.status) {
          const statusMap: Record<string, UiStatus> = {
            'new': 'NEW_ENQUIRY',
            'contacted': 'INFO_REQUESTED',
            'qualified': 'READY_TO_QUOTE',
            'quote_sent': 'QUOTE_SENT',
            'won': 'WON',
            'lost': 'LOST',
            'rejected': 'REJECTED'
          };
          uiStatus = statusMap[leadData.status.toLowerCase()] || "NEW_ENQUIRY";
        }
        
        // Create custom data object with standard fields and questionnaire responses
        const custom: any = { uiStatus, ...customData };
        for (const key of CANONICAL_FIELD_KEYS) {
          if (leadData[key] !== undefined) {
            const customVal = canonicalToCustomValue(key, leadData[key]);
            if (customVal !== undefined) {
              custom[key] = customVal;
            }
          }
        }
        if (leadData.phone) custom.phone = leadData.phone;
        if (leadData.company) custom.company = leadData.company;
        if (leadData.source) custom.source = leadData.source;

        // Create the lead
        const lead = await prisma.lead.create({
          data: {
            tenantId,
            createdById: userId,
            contactName: leadData.contactName,
            email: leadData.email || "",
            status: uiToDb(uiStatus),
            description: leadData.description || null,
            ...(leadData.estimatedValue !== undefined ? { estimatedValue: leadData.estimatedValue } : {}),
            ...(leadData.quotedValue !== undefined ? { quotedValue: leadData.quotedValue } : {}),
            ...(leadData.dateQuoteSent !== undefined ? { dateQuoteSent: leadData.dateQuoteSent } : {}),
            ...(leadData.capturedAt !== undefined ? { capturedAt: leadData.capturedAt } : {}),
            custom,
          },
        });
        
        // Create initial tasks
        await handleStatusTransition({
          tenantId,
          leadId: lead.id,
          prevUi: null,
          nextUi: uiStatus,
          actorId: userId,
          playbook
        });
        
        results.successful++;
        results.leadIds.push(lead.id);
        
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          errors: [`Failed to create lead: ${error.message}`]
        });
      }
    }
    
    res.json(results);
    
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to process CSV file' });
  }
});

/* ------------------------------------------------------------------ */
/* Task helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Create follow-up tasks when status transitions happen.
 * We *proactively* create tasks so the user can do the action next.
 */
async function handleStatusTransition(opts: {
  tenantId: string;
  leadId: string;
  prevUi: UiStatus | null;
  nextUi: UiStatus;
  actorId?: string | null;
  playbook?: TaskPlaybook;
}) {
  const { tenantId, leadId, nextUi } = opts;
  const playbook = opts.playbook ?? (await loadTaskPlaybook(tenantId));
  const recipes = playbook.status[nextUi] || [];

  for (const recipe of recipes) {
    await ensureTaskFromRecipe({
      tenantId,
      recipe,
      relatedId: leadId,
      relatedType: recipe.relatedType ?? "LEAD",
      uniqueKey: `${recipe.id}:${leadId}`,
      actorId: opts.actorId ?? null,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Field defs                                                          */
/* ------------------------------------------------------------------ */

router.get("/fields", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const defs = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });
  res.json(defs);
});

router.post("/fields", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { id, key, label, type = "text", required = false, config, sortOrder = 0 } = req.body;
  if (!key || !label) return res.status(400).json({ error: "key and label required" });

  const data = { tenantId, key, label, type, required, config, sortOrder };
  const def = id
    ? await prisma.leadFieldDef.update({ where: { id }, data })
    : await prisma.leadFieldDef.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: data,
        create: data,
      });

  res.json(def);
});

/* ------------------------------------------------------------------ */
/* Grouped list for Leads board                                        */
/* ------------------------------------------------------------------ */

const UI_BUCKETS: UiStatus[] = [
  "NEW_ENQUIRY",
  "INFO_REQUESTED",
  "DISQUALIFIED",
  "REJECTED",
  "READY_TO_QUOTE",
  "QUOTE_SENT",
  "WON",
  "LOST",
];

router.get("/grouped", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const rows = await prisma.lead.findMany({
    where: { tenantId },
    orderBy: [{ capturedAt: "desc" }],
    include: {
      opportunity: {
        select: { id: true }
      }
    }
  });

  const grouped: Record<UiStatus, any[]> = Object.fromEntries(
    UI_BUCKETS.map((s) => [s, [] as any[]])
  ) as any;

  for (const l of rows) {
    const ui = (l.custom as any)?.uiStatus as UiStatus | undefined;
    const bucket = ui ?? dbToUi(l.status);
    (grouped[bucket] || grouped.NEW_ENQUIRY).push({
      ...l,
      opportunityId: l.opportunity?.id || null
    });
  }

  res.json(grouped);
});

/* ------------------------------------------------------------------ */
/* Create lead                                                         */
/* ------------------------------------------------------------------ */

router.post("/", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const {
    contactName,
    email,
    status,
    custom = {},
    description,
  }: {
    contactName: string;
    email?: string;
    status?: UiStatus;
    custom?: any;
    description?: string;
  } = req.body || {};

  if (!contactName) return res.status(400).json({ error: "contactName required" });

  const uiStatus: UiStatus = status || "NEW_ENQUIRY";

  const playbook = await loadTaskPlaybook(tenantId);

  const now = new Date();
  const customData = { 
    ...(custom ?? {}), 
    uiStatus, 
    enquiryDate: now.toISOString().split('T')[0],
    // alias to support tenant questionnaires that use 'dateReceived'
    dateReceived: now.toISOString().split('T')[0],
  };

  // Auto-set dateQuoteSent if creating with QUOTE_SENT status
  let dateQuoteSent: Date | undefined = undefined;
  if (uiStatus === "QUOTE_SENT") {
    dateQuoteSent = now;
    customData.dateQuoteSent = now.toISOString().split('T')[0];
  }

  // Auto-set dateOrderPlaced if creating with WON status
  if (uiStatus === "WON") {
    customData.dateOrderPlaced = now.toISOString().split('T')[0];
  }

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      createdById: userId,
      contactName: String(contactName),
      email: email ?? "",
      status: uiToDb(uiStatus),
      description: description ?? null,
      capturedAt: now,
      dateQuoteSent: dateQuoteSent,
      custom: customData,
    },
  });

  // Proactive first task
  await handleStatusTransition({ tenantId, leadId: lead.id, prevUi: null, nextUi: uiStatus, actorId: userId, playbook });

  // If created with WON status, ensure opportunity exists
  if (uiStatus === "WON") {
    try {
      await prisma.opportunity.create({
        data: {
          tenantId,
          leadId: lead.id,
          title: lead.contactName || "Project",
          stage: "WON" as any,
          wonAt: now,
        },
      });
    } catch (e) {
      // May already exist if handleStatusTransition created it
      console.warn("[leads] ensure opportunity on new WON lead failed:", (e as any)?.message || e);
    }
  }

  res.json(lead);
});

/* ------------------------------------------------------------------ */
/* Update lead (partial) + task side-effects on status change          */
/* ------------------------------------------------------------------ */

router.patch("/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

  const body = (req.body ?? {}) as {
    contactName?: string | null;
    email?: string | null;
    status?: UiStatus;
    description?: string | null;
    custom?: Record<string, any>;
    questionnaire?: Record<string, any>;
    estimatedValue?: number | string | null;
    quotedValue?: number | string | null;
    dateQuoteSent?: string | Date | null;
    startDate?: string | Date | null;
    deliveryDate?: string | Date | null;
    estimatedWidthMm?: number | string | null;
    estimatedHeightMm?: number | string | null;
    measurementSource?: MeasurementSource | string | null;
    measurementConfidence?: number | string | null;
  };

  const prevCustom = ((existing.custom as any) || {}) as Record<string, any>;
  const prevUi: UiStatus = (prevCustom.uiStatus as UiStatus) ?? dbToUi(existing.status);
  const nextCustom: Record<string, any> = { ...prevCustom };
  let nextUi: UiStatus = prevUi;

  const data: any = {};
  const canonicalUpdates: Record<string, any> = {};

  const applyCanonical = (key: string, raw: any) => {
    if (!CANONICAL_FIELD_CONFIG[key]) return;
    const normalized = normalizeCanonicalValue(key, raw);
    if (normalized === undefined) return;
    canonicalUpdates[key] = normalized;
    const customVal = canonicalToCustomValue(key, normalized);
    nextCustom[key] = customVal ?? null;
  };

  const applyQuestionnairePatch = (patch?: Record<string, any>) => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return;
    for (const [key, value] of Object.entries(patch)) {
      if (CANONICAL_FIELD_CONFIG[key]) {
        applyCanonical(key, value);
      } else {
        nextCustom[key] = value === undefined ? null : value;
      }
    }
  };

  if (body.contactName !== undefined) data.contactName = body.contactName || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.description !== undefined) data.description = body.description || null;

  if (body.status !== undefined) {
    nextUi = body.status;
    data.status = uiToDb(nextUi);
    nextCustom.uiStatus = nextUi;
    
    // Auto-set dateQuoteSent when status changes to QUOTE_SENT
    if (nextUi === "QUOTE_SENT" && prevUi !== "QUOTE_SENT" && !existing.dateQuoteSent) {
      const now = new Date();
      data.dateQuoteSent = now;
      nextCustom.dateQuoteSent = now.toISOString().split('T')[0];
    }

    // Auto-set dateOrderPlaced when status changes to WON
    if (nextUi === "WON" && prevUi !== "WON") {
      const now = new Date();
      // Store an ISO date string (YYYY-MM-DD) in custom for analytics/UI purposes
      if (!nextCustom.dateOrderPlaced) {
        nextCustom.dateOrderPlaced = now.toISOString().split('T')[0];
      }
      // Opportunity.wonAt is handled below in the opportunity upsert; keep both in sync conceptually
    }
  }

  if (body.estimatedValue !== undefined) applyCanonical("estimatedValue", body.estimatedValue);
  if (body.quotedValue !== undefined) applyCanonical("quotedValue", body.quotedValue);
  if (body.dateQuoteSent !== undefined) applyCanonical("dateQuoteSent", body.dateQuoteSent);
  if (body.startDate !== undefined) applyCanonical("startDate", body.startDate);
  if (body.deliveryDate !== undefined) applyCanonical("deliveryDate", body.deliveryDate);

  if (body.estimatedWidthMm !== undefined) {
    data.estimatedWidthMm = normalizeMeasurement(body.estimatedWidthMm);
  }
  if (body.estimatedHeightMm !== undefined) {
    data.estimatedHeightMm = normalizeMeasurement(body.estimatedHeightMm);
  }
  if (body.measurementSource !== undefined) {
    data.measurementSource = normalizeMeasurementSource(body.measurementSource);
  }
  if (body.measurementConfidence !== undefined) {
    data.measurementConfidence = normalizeConfidence(body.measurementConfidence);
  }

  applyQuestionnairePatch(body.questionnaire);
  applyQuestionnairePatch(body.custom);

  // Only apply canonical updates to Lead if they exist as direct fields
  // startDate and deliveryDate should only go to custom and opportunity
  const leadOnlyFields = ['estimatedValue', 'quotedValue', 'dateQuoteSent'];
  for (const [key, value] of Object.entries(canonicalUpdates)) {
    if (leadOnlyFields.includes(key)) {
      data[key] = value;
    }
  }
  data.custom = nextCustom;

  const updated = await prisma.lead.update({ where: { id }, data });

  if (nextUi !== prevUi) {
    const actorId = (req.auth?.userId as string | undefined) ?? null;
    const playbook = await loadTaskPlaybook(tenantId);
    await handleStatusTransition({ tenantId, leadId: id, prevUi, nextUi, actorId, playbook });

    // Learning signal: when users move a lead to certain buckets, label the originating ingests
    const positive: UiStatus[] = [
      "INFO_REQUESTED",
      "READY_TO_QUOTE",
      "QUOTE_SENT",
      "WON",
    ];
    const negative: UiStatus[] = ["DISQUALIFIED", "REJECTED", "LOST"];
    try {
      if (positive.includes(nextUi)) {
        await prisma.emailIngest.updateMany({
          where: { tenantId, leadId: id },
          data: { userLabelIsLead: true, userLabeledAt: new Date() },
        });
      } else if (negative.includes(nextUi)) {
        await prisma.emailIngest.updateMany({
          where: { tenantId, leadId: id },
          data: { userLabelIsLead: false, userLabeledAt: new Date() },
        });
      }
    } catch {}

    // Also log transparent training insights so the AI Training page reflects this acceptance/rejection
    try {
      const becameAccepted = positive.includes(nextUi);
      const becameRejected = negative.includes(nextUi);
      if (becameAccepted || becameRejected) {
        const decision = becameAccepted ? "accepted" : "rejected";

        // Link to originating emails if any; else log against the lead itself
        const ingests = await prisma.emailIngest.findMany({
          where: { tenantId, leadId: id },
          select: { provider: true, messageId: true },
          take: 20,
        });

        if (ingests.length > 0) {
          for (const g of ingests) {
            if (!g.provider || !g.messageId) continue;
            await logInsight({
              tenantId,
              module: "lead_classifier",
              inputSummary: `email:${g.provider}:${g.messageId}`,
              decision,
              confidence: null,
              userFeedback: { byStatusChange: true, status: nextUi, actorId },
            });
          }
        } else {
          await logInsight({
            tenantId,
            module: "lead_classifier",
            inputSummary: `lead:${id}:${nextUi}`,
            decision,
            confidence: null,
            userFeedback: { byStatusChange: true, status: nextUi, actorId },
          });
        }

        // Audit trail event
        await logEvent({
          tenantId,
          module: "lead_classifier",
          kind: "FEEDBACK",
          payload: { source: "lead_status_change", leadId: id, to: nextUi, from: prevUi, decision },
          actorId,
        });

        // Trigger ML retraining if enough feedback has accumulated
        try {
          if (process.env.ML_URL && (becameAccepted || becameRejected)) {
            // Check if we should trigger retraining (every 10 feedback examples)
            const feedbackCount = await (prisma as any).trainingInsights.count({
              where: {
                tenantId,
                module: "lead_classifier",
                userFeedback: { not: null }
              }
            });

            // Trigger retraining every 10 new feedback examples
            if (feedbackCount > 0 && feedbackCount % 10 === 0) {
              const retrainPayload = {
                tenantId,
                limit: Math.min(feedbackCount, 100) // Use recent examples
              };

              fetch(`${process.env.ML_URL}/lead-classifier/retrain`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(retrainPayload),
              }).then(response => {
                if (response.ok) {
                  console.log(`[leads] Triggered ML retraining with ${feedbackCount} examples`);
                } else {
                  console.warn("[leads] ML retraining failed:", response.statusText);
                }
              }).catch(e => {
                console.warn("[leads] ML retraining error:", (e as any)?.message || e);
              });
            }
          }
        } catch (e) {
          console.warn("[leads] ML retraining trigger error:", (e as any)?.message || e);
        }
      }
    } catch (e) {
      console.warn("[leads] status→training log failed:", (e as any)?.message || e);
    }

    // Auto-complete the initial "Review enquiry" task when moving off NEW_ENQUIRY
    try {
      if (prevUi === "NEW_ENQUIRY" && nextUi !== "NEW_ENQUIRY") {
        const key = `status:new-review:${id}`;
        const reviewTask = await prisma.task.findFirst({
          where: {
            tenantId,
            relatedType: "LEAD" as any,
            relatedId: id,
            status: { notIn: ["DONE", "CANCELLED"] as any },
            meta: { path: ["key"], equals: key } as any,
          },
          select: { id: true },
        });
        if (reviewTask) {
          await prisma.task.update({
            where: { id: reviewTask.id },
            data: { status: "DONE" as any, completedAt: new Date(), updatedById: actorId ?? undefined },
          });
        }
      }
    } catch (e) {
      console.warn("[leads] auto-complete review task failed:", (e as any)?.message || e);
    }
  }

  // Adjust source conversions when toggling WON on/off (optional; keep if you used this before)
  const prevWon = prevUi === "WON";
  const nextWon = nextUi === "WON";
  if (prevWon !== nextWon) {
    const source = (nextCustom.source ?? prevCustom.source ?? "Unknown").toString().trim() || "Unknown";
    const cap = existing.capturedAt instanceof Date ? existing.capturedAt : new Date(existing.capturedAt as any);
    const m = monthStartUTC(cap);
    await prisma.leadSourceCost.upsert({
      where: { tenantId_source_month: { tenantId, source, month: m } },
      update: { conversions: { increment: nextWon ? 1 : -1 } },
      create: { tenantId, source, month: m, spend: 0, leads: 0, conversions: nextWon ? 1 : 0, scalable: true },
    });
  }

  // When a lead is marked WON, ensure there's a corresponding Opportunity in stage WON
  // so it appears in the Workshop schedule. If one exists, update it; else create it.
  try {
    if (nextUi === "WON") {
      await prisma.$transaction(async (tx) => {
        const latestQuote = await tx.quote.findFirst({
          where: { tenantId, leadId: id },
          orderBy: { updatedAt: "desc" },
          select: { title: true, totalGBP: true },
        });
        const title = latestQuote?.title || updated.contactName || "Project";
        
        // Get startDate and deliveryDate from the updated lead's custom data
        const startDate = (updated.custom as any)?.startDate || null;
        const deliveryDate = (updated.custom as any)?.deliveryDate || null;
        
        // Use quote totalGBP if available, otherwise fall back to lead's quotedValue
        const valueGBP = (latestQuote as any)?.totalGBP ?? updated.quotedValue ?? undefined;
        
        const opportunity = await tx.opportunity.upsert({
          where: { leadId: id },
          update: {
            stage: "WON" as any,
            wonAt: new Date(),
            title,
            valueGBP,
            startDate: startDate ? new Date(startDate) : undefined,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
          },
          create: {
            tenantId,
            leadId: id,
            title,
            stage: "WON" as any,
            wonAt: new Date(),
            valueGBP,
            startDate: startDate ? new Date(startDate) : null,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          },
        });
        
        // Auto-seed process assignments for this opportunity
        const processDefinitions = await tx.workshopProcessDefinition.findMany({
          where: { tenantId, requiredByDefault: true },
          orderBy: { sortOrder: "asc" },
        });
        
        for (const processDef of processDefinitions) {
          await tx.projectProcessAssignment.upsert({
            where: {
              opportunityId_processDefinitionId: {
                opportunityId: opportunity.id,
                processDefinitionId: processDef.id,
              },
            },
            create: {
              tenantId,
              opportunityId: opportunity.id,
              processDefinitionId: processDef.id,
              required: true,
              estimatedHours: processDef.estimatedHours,
            },
            update: {}, // Don't update if already exists
          });
        }
      });
    }
  } catch (e) {
    console.warn("[leads] ensure opportunity on WON failed:", (e as any)?.message || e);
  }

  // If startDate or deliveryDate were updated and an opportunity exists, sync them
  try {
    if ((body.startDate !== undefined || body.deliveryDate !== undefined) && nextUi === "WON") {
      const existingOpp = await prisma.opportunity.findFirst({
        where: { leadId: id },
      });
      if (existingOpp) {
        const oppUpdate: any = {};
        if (body.startDate !== undefined) {
          const startDate = (updated.custom as any)?.startDate || null;
          oppUpdate.startDate = startDate ? new Date(startDate) : null;
        }
        if (body.deliveryDate !== undefined) {
          const deliveryDate = (updated.custom as any)?.deliveryDate || null;
          oppUpdate.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
        }
        await prisma.opportunity.update({
          where: { id: existingOpp.id },
          data: oppUpdate,
        });
      }
    }
  } catch (e) {
    console.warn("[leads] sync opportunity dates failed:", (e as any)?.message || e);
  }

  try {
    const latestQuote = await prisma.quote.findFirst({
      where: { tenantId, leadId: id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, totalGBP: true },
    });
    if (latestQuote) {
      const latestEstimate = await prisma.estimate.findFirst({
        where: { tenantId, quoteId: latestQuote.id },
        orderBy: { createdAt: "desc" },
      });
      if (latestEstimate) {
        const acceptedPrice = latestQuote.totalGBP != null ? Number(latestQuote.totalGBP) : null;
        if (nextUi === "WON") {
          await prisma.estimate.update({
            where: { id: latestEstimate.id },
            data: {
              actualAcceptedPrice: acceptedPrice ?? undefined,
              outcome: "won",
            },
          });
        } else if (["DISQUALIFIED", "REJECTED", "LOST"].includes(nextUi)) {
          await prisma.estimate.update({
            where: { id: latestEstimate.id },
            data: {
              outcome: "lost",
            },
          });
        }
      }
    }
  } catch (e) {
    console.warn("[leads] estimate outcome sync failed:", (e as any)?.message || e);
  }

  res.json({ ok: true, lead: serializeLeadRow(updated) });
});

/* ------------------------------------------------------------------ */
/* Read one (for modal)                                               */
/* ------------------------------------------------------------------ */

router.get("/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, tenantId },
  });
  if (!lead) return res.status(404).json({ error: "not found" });

  // Find an existing draft quote for this lead (if any)
  const existingQuote = await prisma.quote.findFirst({ where: { tenantId, leadId: lead.id }, orderBy: { createdAt: "desc" }, select: { id: true, status: true } });

  const fields = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  res.json({
    lead: serializeLeadRow(lead, {
      quoteId: existingQuote?.id || null,
      quoteStatus: existingQuote?.status || null,
    }),
    fields,
  });
});

/* ------------------------------------------------------------------ */
/* Send questionnaire (email link). Does NOT create a task.           */
/* ------------------------------------------------------------------ */

// prefer a single clean absolute origin for links in emails
function pickWebOrigin(): string {
  const raw = String(process.env.WEB_ORIGIN || "").trim();
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  // Prefer the first entry that already includes http/https
  const withScheme = parts.find((p) => /^https?:\/\//i.test(p));
  let base = withScheme || parts[0] || String(process.env.APP_URL || process.env.WEB_APP_URL || "").trim();
  if (!base) base = "https://www.joineryai.app";
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base.replace(/\/+$/, "");
}

router.post("/:id/request-info", async (req, res) => {
  try {
    const { tenantId, email: fromEmail } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });
    if (!lead.email) return res.status(400).json({ error: "lead has no email" });

  const WEB_ORIGIN = pickWebOrigin();
  const ts = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const slug = ts?.slug || ("tenant-" + tenantId.slice(0, 6));
    const qUrl = `${WEB_ORIGIN}/q/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`;

    const fromHeader = fromEmail || "me";
    const subject = `More details needed – ${lead.contactName || "your enquiry"}`;
    const body =
      `Hi ${lead.contactName || ""},\n\n` +
      `To prepare an accurate quote we need a few more details.\n` +
      `Please fill in this short form: ${qUrl}\n\n` +
      `Thanks,\n${fromEmail || "CRM"}`;

    const rfc822 =
      `From: ${fromHeader}\r\n` +
      `To: ${lead.email}\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${body}\r\n`;

    const accessToken = await getAccessTokenForTenant(tenantId);
    await gmailSend(accessToken, rfc822);

    // Move to INFO_REQUESTED, but do NOT create a task now
    const prevCustom = ((lead.custom as any) || {}) as Record<string, any>;
    await prisma.lead.update({
      where: { id },
      data: {
        status: uiToDb("INFO_REQUESTED"),
        custom: { ...prevCustom, uiStatus: "INFO_REQUESTED" },
      },
    });

    // Task creation happens when questionnaire is actually submitted
    return res.json({ ok: true, url: qUrl });
  } catch (e: any) {
    console.error("[leads] request-info failed:", e);
    return res.status(500).json({ error: e?.message || "request-info failed" });
  }
});

/* ------------------------------------------------------------------ */
/* Questionnaire submit → create “Review questionnaire” task only     */
/* (keep status at INFO_REQUESTED so owner can decide next step)      */
/* ------------------------------------------------------------------ */

router.post("/:id/submit-questionnaire", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

    const answers = (req.body?.answers ?? {}) as Record<string, any>;
    const prev = (lead.custom as any) || {};
    const merged: Record<string, any> = { ...prev, uiStatus: "INFO_REQUESTED" as UiStatus };
    const canonicalUpdates: Record<string, any> = {};

    for (const [key, value] of Object.entries(answers)) {
      if (CANONICAL_FIELD_CONFIG[key]) {
        const normalized = normalizeCanonicalValue(key, value);
        if (normalized !== undefined) {
          canonicalUpdates[key] = normalized;
          merged[key] = canonicalToCustomValue(key, normalized) ?? null;
        }
      } else {
        merged[key] = value === undefined ? null : value;
      }
    }

    const data: any = {
      status: uiToDb("INFO_REQUESTED"),
      custom: merged,
    };
    for (const [key, value] of Object.entries(canonicalUpdates)) {
      data[key] = value;
    }

    await prisma.lead.update({
      where: { id },
      data,
    });

    const playbook = await loadTaskPlaybook(tenantId);
    const recipe = playbook.manual?.questionnaire_followup ?? null;

    await ensureTaskFromRecipe({
      tenantId,
      recipe,
      relatedId: id,
      relatedType: recipe?.relatedType ?? "QUESTIONNAIRE",
      uniqueKey: `manual:questionnaire_followup:${id}`,
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[leads] submit-questionnaire failed:", e);
    return res.status(500).json({ error: e?.message || "submit failed" });
  }
});

/* ------------------------------------------------------------------ */
/* Supplier quote request (kept — unchanged core, trimmed comments)    */
/* ------------------------------------------------------------------ */

const EXT_FROM_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/tiff": ".tif",
  "application/zip": ".zip",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.dwg": ".dwg",
  "image/vnd.dxf": ".dxf",
  "application/octet-stream": ".bin",
};
function ensureFilenameWithExt(filename: string | undefined, mimeType: string) {
  let name = (filename || "attachment").trim();
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += EXT_FROM_MIME[mimeType] || ".bin";
  return name;
}

router.post("/:id/request-supplier-quote", async (req, res) => {
  try {
    const { tenantId, email: fromEmail } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

    const { to, subject, text, fields, attachments } = (req.body ?? {}) as {
      to?: string;
      subject?: string;
      text?: string;
      fields?: Record<string, any>;
      attachments?: Array<
        | { source: "gmail"; messageId: string; attachmentId: string }
        | { source: "upload"; filename: string; mimeType: string; base64: string }
      >;
    };

    if (!to) return res.status(400).json({ error: "to is required" });

    // Build body quickly (AI formatting removed for brevity)
    const summary =
      typeof lead.custom === "object" && lead.custom && "summary" in (lead.custom as any)
        ? (lead.custom as any).summary
        : "-";

    const lines: string[] = [];
    lines.push("Lead details:");
    lines.push(`- Name: ${lead.contactName || "-"}`);
    lines.push(`- Email: ${lead.email || "-"}`);
    lines.push(`- Status: ${lead.status}`);
    lines.push(`- Summary: ${summary}`);
    if (fields && Object.keys(fields).length) {
      lines.push("");
      lines.push("Questionnaire:");
      Object.entries(fields).forEach(([k, v]) => lines.push(`- ${k}: ${v ?? "-"}`));
    }

    // Create a public supplier upload link (JWT token with limited claims)
    const ts = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const slug = ts?.slug || ("tenant-" + tenantId.slice(0, 6));
    const rfqId = randomUUID();
    const token = jwt.sign(
      { t: tenantId, l: id, e: to, r: rfqId },
      env.APP_JWT_SECRET,
      { expiresIn: "90d" }
    );
  const WEB_ORIGIN = pickWebOrigin();
  const uploadUrl = `${WEB_ORIGIN}/sup/${encodeURIComponent(slug)}/${encodeURIComponent(token)}`;

    const sub = subject || `Quote request for ${lead.contactName || "lead"} (${lead.id.slice(0, 8)})`;
    const bodyText =
      `Hi,\n\nPlease provide a price for the following enquiry.\n\n` +
      `${lines.join("\n")}\n\nUpload your quote here: ${uploadUrl}\n\nThanks,\n${fromEmail || "CRM"}`;

    const boundary = "mixed_" + Math.random().toString(36).slice(2);
    const fromHeader = fromEmail || "me";

    const head =
      `From: ${fromHeader}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${sub}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    let mime = "";
    mime += `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${bodyText}\r\n`;

    const acc: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];
    const accessToken = await getAccessTokenForTenant(tenantId);
    if (Array.isArray(attachments)) {
      for (const a of attachments) {
        if ((a as any).source === "gmail") {
          const g = a as { source: "gmail"; messageId: string; attachmentId: string };
          const x = await gmailFetchAttachment(accessToken, g.messageId, g.attachmentId);
          acc.push({ filename: ensureFilenameWithExt(x.filename, x.mimeType), mimeType: x.mimeType, buffer: x.buffer });
        } else {
          const u = a as { source: "upload"; filename: string; mimeType: string; base64: string };
          acc.push({ filename: ensureFilenameWithExt(u.filename, u.mimeType), mimeType: u.mimeType, buffer: Buffer.from(u.base64, "base64") });
        }
      }
    }
    for (const f of acc) {
      const b64 = f.buffer.toString("base64").replace(/.{76}(?=.)/g, "$&\r\n");
      mime += `--${boundary}\r\nContent-Type: ${f.mimeType}; name="${f.filename}"\r\nContent-Disposition: attachment; filename="${f.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}\r\n`;
    }
    mime += `--${boundary}--\r\n`;

    await gmailSend(accessToken, head + mime);

    // Breadcrumb
    const safeCustom = ((lead.custom as any) || {}) as Record<string, any>;
    const rfqs: any[] = Array.isArray((safeCustom as any).supplierRfqs) ? (safeCustom as any).supplierRfqs : [];
    rfqs.push({ rfqId, supplierEmail: to, uploadUrl, tokenPreview: token.slice(0, 16) + "…", createdAt: new Date().toISOString() });
    await prisma.lead.update({
      where: { id },
      data: {
        custom: {
          ...safeCustom,
          lastSupplierEmailTo: to,
          lastSupplierEmailSubject: sub,
          supplierRfqs: rfqs,
        },
      },
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[leads] request-supplier-quote failed:", e);
    res.status(500).json({ error: e?.message || "send failed" });
  }
});

/* ------------------------------------------------------------------ */
/* Demo seed (optional)                                                */
/* ------------------------------------------------------------------ */

router.post("/seed-demo", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  await prisma.leadFieldDef.upsert({
    where: { tenantId_key: { tenantId, key: "company" } },
    update: {},
    create: { tenantId, key: "company", label: "Company", type: "text", required: false, sortOrder: 1 },
  });

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      createdById: userId,
      contactName: "Taylor Example",
      email: "taylor@example.com",
      status: "NEW",
      description: "Test enquiry details here.",
      custom: { uiStatus: "NEW_ENQUIRY" as UiStatus },
    },
  });

  const playbook = await loadTaskPlaybook(tenantId);
  const nextUi: UiStatus = "NEW_ENQUIRY";
  await handleStatusTransition({
    tenantId,
    leadId: lead.id,
    prevUi: null,
    nextUi,
    actorId: userId,
    playbook,
  });

  res.json({ ok: true, lead });
});

/* ------------------------------------------------------------------ */
/* Manual Email Upload and Parsing                                     */
/* ------------------------------------------------------------------ */

router.post("/parse-email", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  try {
    const { filename, mimeType, base64, provider } = req.body;
    
    if (!filename || !base64) {
      return res.status(400).json({ error: "Missing filename or file content" });
    }

    // Decode base64 content
    const fileContent = Buffer.from(base64, 'base64').toString('utf-8');
    
    // Parse email content to extract lead information
    const emailData = parseEmailContent(fileContent);
    
    if (!emailData.contactName && !emailData.email) {
      return res.status(400).json({ error: "Could not extract contact information from email" });
    }

    // Create a new lead from the parsed email
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        createdById: userId,
        contactName: emailData.contactName || "Unknown Contact",
        email: emailData.email || null,
        status: "NEW",
        description: emailData.bodyText || null,
        custom: {
          subject: emailData.subject,
          provider: provider || "manual",
          bodyText: emailData.bodyText,
          summary: emailData.summary,
          uiStatus: "NEW_ENQUIRY" as UiStatus,
          confidence: emailData.confidence,
          source: "manual_upload",
          filename: filename,
          enquiryDate: new Date().toISOString().split('T')[0],
          dateReceived: new Date().toISOString().split('T')[0],
        },
      },
    });

    // Handle status transition and task creation
    const playbook = await loadTaskPlaybook(tenantId);
    await handleStatusTransition({
      tenantId,
      leadId: lead.id,
      prevUi: null,
      nextUi: "NEW_ENQUIRY",
      actorId: userId,
      playbook,
    });

    res.json({
      leadId: lead.id,
      contactName: lead.contactName,
      email: lead.email,
      subject: emailData.subject,
      confidence: emailData.confidence,
      bodyText: emailData.bodyText,
    });

  } catch (e: any) {
    console.error("[leads] parse-email failed:", e);
    res.status(500).json({ error: e?.message || "email parsing failed" });
  }
});

/**
 * Parse email content and extract lead information
 */
function parseEmailContent(content: string): {
  contactName: string | null;
  email: string | null;
  subject: string | null;
  bodyText: string | null;
  summary: string | null;
  confidence: number;
} {
  const lines = content.split('\n');
  let subject = null;
  let from = null;
  let bodyText = null;
  let contactName = null;
  let email = null;
  let confidence = 0.5;

  // Parse email headers
  const headerEndIndex = lines.findIndex(line => line.trim() === '');
  const headers = lines.slice(0, headerEndIndex);
  const body = lines.slice(headerEndIndex + 1).join('\n').trim();

  // Extract headers
  for (const line of headers) {
    if (line.toLowerCase().startsWith('subject:')) {
      subject = line.substring(8).trim();
    } else if (line.toLowerCase().startsWith('from:')) {
      from = line.substring(5).trim();
    }
  }

  // Extract email and name from From header
  if (from) {
    const emailMatch = from.match(/<([^>]+)>/);
    if (emailMatch) {
      email = emailMatch[1];
      contactName = from.replace(/<[^>]+>/, '').trim().replace(/^["']|["']$/g, '');
    } else {
      // Check if from is just an email
      const simpleEmailMatch = from.match(/^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
      if (simpleEmailMatch) {
        email = simpleEmailMatch[1];
        contactName = email.split('@')[0]; // Use part before @ as name
      }
    }
  }

  // Clean up contact name
  if (contactName) {
    contactName = contactName.trim();
    if (contactName === '' || contactName === email) {
      contactName = email ? email.split('@')[0] : null;
    }
  }

  // Use body as description and create summary
  bodyText = body;
  let summary = null;
  if (bodyText && bodyText.length > 100) {
    summary = bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : '');
  }

  // Calculate confidence based on what we extracted
  if (email && contactName && subject) confidence = 0.9;
  else if (email && subject) confidence = 0.8;
  else if (email || contactName) confidence = 0.6;
  else confidence = 0.3;

  return {
    contactName,
    email,
    subject,
    bodyText,
    summary,
    confidence,
  };
}

/* ------------------------------------------------------------------ */
/* Delete Lead Endpoint                                               */
/* ------------------------------------------------------------------ */

// DELETE /leads/:id - Delete a lead and all associated data
router.delete("/:id", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });
  
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Lead ID is required" });
  }
  
  try {
    // First verify the lead belongs to this tenant
    const lead = await prisma.lead.findFirst({
      where: { id, tenantId }
    });
    
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    // Delete in transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Delete related records first (due to foreign key constraints)
      
      // Delete email threads and messages
      await tx.emailMessage.deleteMany({
        where: { leadId: id }
      });
      
      await tx.emailThread.deleteMany({
        where: { leadId: id }
      });
      
      await tx.emailIngest.deleteMany({
        where: { leadId: id }
      });
      
      // Delete follow-up logs
      await tx.followUpLog.deleteMany({
        where: { leadId: id }
      });
      
      // Delete tasks related to this lead
      await tx.task.deleteMany({
        where: { 
          AND: [
            { tenantId },
            {
              OR: [
                { relatedId: id },
                { title: { contains: lead.contactName || lead.email || id } }
              ]
            }
          ]
        }
      });
      
      // Delete quotes associated with this lead
      await tx.quote.deleteMany({
        where: { leadId: id }
      });
      
      // Delete opportunities associated with this lead
      await tx.opportunity.deleteMany({
        where: { leadId: id }
      });
      
      // Finally delete the lead itself
      await tx.lead.delete({
        where: { id }
      });
    });
    
    res.json({ success: true, message: "Lead deleted successfully" });
    
  } catch (error: any) {
    console.error("Failed to delete lead:", error);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

/* ------------------------------------------------------------------ */
/* PUBLIC Landing Page Lead Capture Endpoint                           */
/* ------------------------------------------------------------------ */
router.post("/public", async (req, res) => {
  try {
    const {
      source = "unknown",
      name = "",
      email = "",
      phone = "",
      postcode = "",
      projectType = "",
      propertyType = "",
      message = "",
      recaptchaToken = "",
    } = req.body || {};

    const src = String(source || "unknown").toLowerCase();
    const phoneClick = src.includes("phone_click") || src.includes("phone-click") || src.includes("landing-phone");
    const guideDownload = src.includes("guide") || src.includes("exit-guide") || src.includes("lead_magnet");

    // Basic validation
    // - Phone click: only needs phone
    // - Guide download: only needs email and name
    // - Full form: needs name, email, phone, postcode
    if (phoneClick) {
      if (!phone) return res.status(400).json({ ok: false, error: "phone_required" });
    } else if (guideDownload) {
      if (!email) return res.status(400).json({ ok: false, error: "email_required" });
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) return res.status(400).json({ ok: false, error: "invalid_email" });
    } else {
      if (!name || !email || !phone || !postcode) {
        return res.status(400).json({ ok: false, error: "missing_required_fields" });
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    // reCAPTCHA verification only if a token was provided (allows simpler dev + phone click capture)
    if (recaptchaToken) {
      try {
        const { verifyRecaptcha } = await import("../lib/recaptcha");
        const r = await verifyRecaptcha(recaptchaToken);
        if (!r.ok && r.score < 0.4) {
          return res.status(400).json({ ok: false, error: "recaptcha_failed" });
        }
      } catch (e) {
        console.warn("[leads/public] recaptcha verification skipped:", (e as any)?.message || e);
      }
    }

    // Sanitize strings
    const s = (v: any) => String(v ?? "").trim().slice(0, 5000);

    // Idempotency check (10-minute window) – only when we have an email to key by
    if (email) {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recent = await prisma.landingLead.findFirst({
        where: { email: s(email), source: s(source), createdAt: { gte: tenMinAgo } },
        select: { id: true },
      });
      if (recent) {
        return res.json({ ok: true, deduped: true, id: recent.id });
      }
    }

    const finalName = name || (phoneClick ? "Phone Enquiry" : name);

    // Persist to database
    const created = await prisma.landingLead.create({
      data: {
        source: s(source),
        name: s(finalName),
        email: email ? s(email) : "", // empty string for phone-only leads
        phone: s(phone),
        postcode: s(postcode),
        projectType: s(projectType),
        propertyType: s(propertyType),
        message: s(message),
        userAgent: s(req.get("user-agent")),
        ip: s(req.headers["x-forwarded-for"] || req.socket.remoteAddress),
      },
      select: { id: true },
    });

    // Fire-and-forget email notification (skip for obvious spamminess if no email & not phone click? we still notify for phone leads)
    try {
      const { sendLeadEmail } = await import("../lib/mailer");
      sendLeadEmail({ source, name: finalName, email, phone, postcode, projectType, propertyType, message })
        .catch(() => {});
    } catch {}

    return res.json({ ok: true, id: created.id, phoneOnly: phoneClick && !email });
  } catch (err: any) {
    console.error("POST /leads/public error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// Align React versions to Next supported
// Downgrade React to version 18.2.0
// Redeploy the application

export default router;