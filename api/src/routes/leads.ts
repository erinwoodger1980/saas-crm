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
import fs from "fs";
import path from "path";
import { simpleParser } from "mailparser";
import OpenAI from "openai";
import {
  CANONICAL_FIELD_CONFIG,
  lookupCsvField,
  parseFlexibleDate,
  toNumberGBP,
  toISODate,
} from "../lib/leads/fieldMap";
import { extractGlobalSpecsFromAnswers, specsToPrismaData } from "../lib/globalSpecs";
import { linkLeadToClientAccount, linkOpportunityToClientAccount } from "../lib/clientAccount";
import { completeTasksOnRecordChangeByLinks } from "../services/field-link";
import { evaluateAutomationRules } from "./automation-rules";
import { logOrderFlow } from "../lib/order-flow-log";

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
  | "ESTIMATE"
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
    case "ESTIMATE":
      return "ESTIMATE";
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
    case "COMPLETED":
      return "WON"; // COMPLETED is a UI-only status for completed orders
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
    case "ESTIMATE":
      return "ESTIMATE";
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
  const baseCustom: any =
    lead?.custom && typeof lead.custom === "object" && !Array.isArray(lead.custom)
      ? { ...(lead.custom as Record<string, any>) }
      : {};
  const clientSource = lead?.client?.source;
  if (typeof clientSource === "string" && clientSource.trim()) {
    baseCustom.source = clientSource.trim();
  }

  const payload: any = {
    id: lead.id,
    number: lead.number ?? null,
    contactName: lead.contactName,
    email: lead.email,
    phone: lead.phone ?? null,
    address: lead.address ?? null,
    deliveryAddress: lead.deliveryAddress ?? null,
    description: lead.description,
    status: (lead.custom as any)?.uiStatus || dbToUi(lead.status),
    custom: baseCustom,
    estimatedValue: toMaybeNumber(lead.estimatedValue),
    quotedValue: toMaybeNumber(lead.quotedValue),
    dateQuoteSent: lead.dateQuoteSent ? lead.dateQuoteSent.toISOString() : null,
    clientId: lead.clientId ?? null,
    computed: buildComputedValues(lead),
    ...extras,
  };
  return payload;
}

function serializeVisionInference(record: any) {
  return {
    id: record.id,
    itemNumber: record.itemNumber ?? null,
    source: record.source,
    widthMm: record.widthMm ?? null,
    heightMm: record.heightMm ?? null,
    confidence: record.confidence ?? null,
    attributes: record.attributes ?? null,
    description: record.description ?? null,
    notes: record.notes ?? null,
    photoLabel: record.photoLabel ?? null,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : null,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : null,
  };
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
  
  const emailValue = typeof data.email === 'string' ? data.email.trim() : '';
  if (!emailValue) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      errors.push('Invalid email format');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

function normalizeEmail(raw: any): string | null {
  const value = typeof raw === "string" ? raw.trim() : raw ? String(raw).trim() : "";
  if (!value) return null;
  return value.toLowerCase();
}

function deriveNameFromEmail(email: string): string {
  const local = String(email).split("@")[0] || "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  return cleaned || email;
}

function stringOrNull(raw: any): string | null {
  if (raw === undefined || raw === null) return null;
  const value = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return value ? value : null;
}

function parseTagList(raw: any): string[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0);
  }
  const value = String(raw).trim();
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function parseMaybeDate(raw: any): Date | null {
  if (raw === undefined || raw === null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = parseFlexibleDate(value);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function mergeJsonObjects(a: any, b: any): any {
  const ao = a && typeof a === "object" && !Array.isArray(a) ? a : {};
  const bo = b && typeof b === "object" && !Array.isArray(b) ? b : {};
  return { ...ao, ...bo };
}

async function upsertClientForImport(opts: {
  tenantId: string;
  userId: string;
  leadData: any;
  clientData: any;
  clientCustomData: any;
}): Promise<string | null> {
  const { tenantId, userId, leadData, clientData, clientCustomData } = opts;

  const email = normalizeEmail(clientData.email ?? leadData.email ?? null);
  // Per CRM expectations: only link Clients by email.
  if (!email) return null;

  const phone = stringOrNull(clientData.phone ?? leadData.phone ?? null);
  const companyName = stringOrNull(clientData.companyName ?? leadData.company ?? null);
  const contactName =
    stringOrNull(leadData.contactName ?? clientData.contactPerson ?? null) ??
    stringOrNull(clientData.name ?? null) ??
    (companyName ? companyName : deriveNameFromEmail(email));
  const clientName = stringOrNull(clientData.name ?? null) ?? companyName ?? contactName ?? deriveNameFromEmail(email);

  const candidate = {
    name: clientName,
    email: email || null,
    phone: phone || null,
    address: (clientData.address ?? leadData.address ?? null) as any,
    city: clientData.city ?? null,
    postcode: clientData.postcode ?? null,
    country: clientData.country ?? undefined,
    contactPerson: contactName,
    companyName: companyName || null,
    type: clientData.type ?? undefined,
    source: clientData.source ?? undefined,
    notes: clientData.notes ?? undefined,
    tags: parseTagList(clientData.tags),
    custom: Object.keys(clientCustomData || {}).length > 0 ? clientCustomData : undefined,
  };

  const emailFilter: any = { equals: email, mode: "insensitive" };

  let existing: any = null;
  // Prefer matching by ClientContact.email (multi-contact companies)
  const existingContact = await prisma.clientContact.findFirst({
    where: { email: emailFilter, client: { tenantId } },
    select: { clientId: true },
  });
  if (existingContact?.clientId) {
    existing = await prisma.client.findFirst({ where: { id: existingContact.clientId, tenantId } });
  }
  if (!existing && candidate.email) {
    existing = await prisma.client.findFirst({ where: { tenantId, email: emailFilter } });
  }

  const ensureContactForClient = async (clientId: string) => {
    const existingForEmail = await prisma.clientContact.findFirst({
      where: { clientId, email: emailFilter },
      select: { id: true, name: true, phone: true, mobile: true },
    });

    if (existingForEmail) {
      const contactUpdate: any = {};
      if (contactName && String(contactName).trim() && existingForEmail.name.trim() !== String(contactName).trim()) {
        contactUpdate.name = String(contactName).trim();
      }
      if (phone && (!existingForEmail.phone || !existingForEmail.phone.trim())) {
        contactUpdate.phone = String(phone).trim();
      }
      if (Object.keys(contactUpdate).length > 0) {
        await prisma.clientContact.update({ where: { id: existingForEmail.id }, data: contactUpdate });
      }
      return;
    }

    const anyExisting = await prisma.clientContact.findFirst({ where: { clientId }, select: { id: true } });
    await prisma.clientContact.create({
      data: {
        clientId,
        name: contactName || deriveNameFromEmail(email),
        email,
        phone,
        isPrimary: !anyExisting,
      },
    });
  };

  if (existing) {
    const updateData: any = {};
    const setIfEmpty = (key: string, value: any) => {
      if (value === undefined) return;
      if (value === null) return;
      const current = (existing as any)[key];
      if (current === undefined || current === null || (typeof current === "string" && !current.trim())) {
        updateData[key] = typeof value === "string" ? value.trim() : value;
      }
    };

    setIfEmpty("email", candidate.email);
    setIfEmpty("phone", candidate.phone);
    setIfEmpty("address", candidate.address);
    setIfEmpty("city", candidate.city);
    setIfEmpty("postcode", candidate.postcode);
    setIfEmpty("country", candidate.country);
    setIfEmpty("contactPerson", candidate.contactPerson);
    setIfEmpty("companyName", candidate.companyName);
    setIfEmpty("type", candidate.type);
    setIfEmpty("source", candidate.source);
    setIfEmpty("notes", candidate.notes);

    if (candidate.tags.length > 0) {
      const existingTags = Array.isArray(existing.tags) ? existing.tags : [];
      const merged = Array.from(new Set([...existingTags, ...candidate.tags]));
      if (merged.length !== existingTags.length) updateData.tags = merged;
    }

    if (candidate.custom) {
      updateData.custom = mergeJsonObjects(existing.custom, candidate.custom);
    }

    if (Object.keys(updateData).length > 0) {
      const updated = await prisma.client.update({ where: { id: existing.id }, data: updateData });
      await ensureContactForClient(updated.id);
      return updated.id;
    }
    await ensureContactForClient(existing.id);
    return existing.id;
  }

  const created = await prisma.client.create({
    data: {
      tenantId,
      userId,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      address: candidate.address ? String(candidate.address).trim() : null,
      city: candidate.city ? String(candidate.city).trim() : null,
      postcode: candidate.postcode ? String(candidate.postcode).trim() : null,
      country: candidate.country ? String(candidate.country).trim() : undefined,
      contactPerson: candidate.contactPerson ? String(candidate.contactPerson).trim() : null,
      companyName: candidate.companyName,
      type: candidate.type ? String(candidate.type).trim() : undefined,
      source: candidate.source ? String(candidate.source).trim() : undefined,
      notes: candidate.notes ? String(candidate.notes).trim() : undefined,
      tags: candidate.tags,
      contacts: {
        create: {
          name: contactName || deriveNameFromEmail(email),
          email,
          phone,
          isPrimary: true,
        },
      },
      ...(candidate.custom ? { custom: candidate.custom } : {}),
    },
  });
  return created.id;
}

async function ensureClientContactForLeadEmail(opts: {
  tenantId: string;
  clientId: string;
  email: string;
  name: string;
  phone?: string | null;
}): Promise<void> {
  const { tenantId, clientId, email, name, phone } = opts;

  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId }, select: { id: true } });
  if (!client) return;

  const emailFilter: any = { equals: email, mode: "insensitive" };
  const existing = await prisma.clientContact.findFirst({
    where: { clientId, email: emailFilter },
    select: { id: true, name: true, phone: true },
  });

  if (existing) {
    const updateData: any = {};
    if (name && String(name).trim() && existing.name.trim() !== String(name).trim()) updateData.name = String(name).trim();
    if (phone && (!existing.phone || !existing.phone.trim())) updateData.phone = phone;
    if (Object.keys(updateData).length > 0) {
      await prisma.clientContact.update({ where: { id: existing.id }, data: updateData });
    }
    return;
  }

  const anyExisting = await prisma.clientContact.findFirst({ where: { clientId }, select: { id: true } });
  await prisma.clientContact.create({
    data: {
      clientId,
      name: name || deriveNameFromEmail(email),
      email,
      phone: phone ?? null,
      isPrimary: !anyExisting,
    },
  });
}

async function upsertClientSourceForLead(opts: {
  tenantId: string;
  userId: string;
  leadId: string;
  leadEmail: string | null | undefined;
  leadName: string | null | undefined;
  clientId: string | null | undefined;
  source: string;
}): Promise<{ clientId: string } | null> {
  const { tenantId, userId, leadId, leadEmail, leadName, clientId, source } = opts;
  const trimmed = String(source || "").trim();
  if (!trimmed) return null;

  // Keep LeadSourceConfig in sync so sources show up in dropdowns immediately.
  try {
    const existingCfg = await prisma.leadSourceConfig.findFirst({
      where: { tenantId, source: { equals: trimmed, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingCfg) {
      await prisma.leadSourceConfig.update({
        where: { id: existingCfg.id },
        data: { source: trimmed },
      });
    } else {
      await prisma.leadSourceConfig.create({
        data: { tenantId, source: trimmed, scalable: true },
      });
    }
  } catch (e) {
    console.warn("[leads] leadSourceConfig upsert failed:", (e as any)?.message || e);
  }

  if (clientId) {
    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { source: trimmed },
      select: { id: true },
    });
    return { clientId: updated.id };
  }

  const email = normalizeEmail(leadEmail);
  if (!email) return null;
  const name = stringOrNull(leadName) ?? deriveNameFromEmail(email);

  const emailFilter: any = { equals: email, mode: "insensitive" };
  const byContact = await prisma.clientContact.findFirst({
    where: { email: emailFilter, client: { tenantId } },
    select: { clientId: true },
  });
  const existing = byContact?.clientId
    ? await prisma.client.findFirst({ where: { id: byContact.clientId, tenantId } })
    : await prisma.client.findFirst({ where: { tenantId, email: emailFilter } });
  const client = existing
    ? await prisma.client.update({ where: { id: existing.id }, data: { source: trimmed }, select: { id: true } })
    : await prisma.client.create({
        data: {
          tenantId,
          userId,
          name,
          email,
          source: trimmed,
          contacts: { create: { name, email, isPrimary: true } },
        },
        select: { id: true },
      });

  await prisma.lead.update({ where: { id: leadId }, data: { clientId: client.id } });
  return { clientId: client.id };
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

    // Provide distinct value samples per column (helps UI map status values)
    const columnValueSamples: Record<string, string[]> = {};
    const MAX_DISTINCT = 20;
    for (let h = 0; h < headers.length; h++) {
      const header = headers[h];
      const distinct: string[] = [];
      const seen = new Set<string>();
      for (let r = 0; r < rows.length; r++) {
        const raw = rows[r]?.[h];
        if (!raw) continue;
        const val = String(raw).trim();
        if (!val) continue;
        const key = val.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        distinct.push(val);
        if (distinct.length >= MAX_DISTINCT) break;
      }
      if (distinct.length > 0) columnValueSamples[header] = distinct;
    }
    
    // Get questionnaire fields for this tenant (client, public, and internal scopes for import)
    const questionnaireFields = await prisma.questionnaireField.findMany({
      where: { 
        tenantId,
        scope: {
          in: ['client', 'public', 'internal']
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
    
    // Build available fields including basic fields and questionnaire fields
    const availableFields = [
      { key: 'number', label: 'Lead Number', required: false },
      { key: 'contactName', label: 'Contact Name', required: false },
      { key: 'email', label: 'Email', required: true },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'address', label: 'Address', required: false },
      { key: 'company', label: 'Company', required: false },
      { key: 'description', label: 'Project Description', required: false },
      { key: 'status', label: 'Status', required: false },
      { key: 'capturedAt', label: 'Date Created / Enquiry Date', required: false },
      { key: 'nextAction', label: 'Next Action', required: false },
      { key: 'nextActionAt', label: 'Next Action Due Date', required: false },
      { key: 'startDate', label: 'Start Date (Production)', required: false },
      { key: 'deliveryDate', label: 'Delivery Date', required: false },
      { key: 'quotedValue', label: 'Quoted Value (£)', required: false },
      { key: 'estimatedValue', label: 'Estimated Value (£)', required: false },
      { key: 'dateQuoteSent', label: 'Date Quote Sent', required: false },

      // Client fields (creates/updates Client and links Lead.clientId)
      // NOTE: Contact identity fields are mapped once via Lead fields (email/name/phone)
      // and then synced into Client + ClientContact automatically.
      { key: 'client.address', label: 'Client: Address', required: false },
      { key: 'client.city', label: 'Client: City', required: false },
      { key: 'client.postcode', label: 'Client: Postcode', required: false },
      { key: 'client.country', label: 'Client: Country', required: false },
      { key: 'client.contactPerson', label: 'Client: Contact Person', required: false },
      { key: 'client.companyName', label: 'Client: Company Name', required: false },
      { key: 'client.type', label: 'Client: Type', required: false },
      { key: 'client.source', label: 'Client: Lead Source', required: false },
      { key: 'client.notes', label: 'Client: Notes', required: false },
      { key: 'client.tags', label: 'Client: Tags (comma separated)', required: false },

      // Task fields (creates one task per imported row when provided)
      { key: 'task.title', label: 'Task: Title', required: false },
      { key: 'task.dueAt', label: 'Task: Due Date', required: false },
      { key: 'task.startedAt', label: 'Task: Started Date', required: false },
      { key: 'task.completedAt', label: 'Task: Completed Date', required: false },
      { key: 'task.description', label: 'Task: Description', required: false },
      { key: 'task.priority', label: 'Task: Priority (LOW/MEDIUM/HIGH/URGENT)', required: false },
      { key: 'task.status', label: 'Task: Status (OPEN/IN_PROGRESS/BLOCKED/DONE/CANCELLED)', required: false },
      { key: 'task.communicationChannel', label: 'Task: Communication Channel', required: false },
      { key: 'task.communicationDirection', label: 'Task: Communication Direction (INBOUND/OUTBOUND)', required: false },
      { key: 'task.communicationType', label: 'Task: Communication Type (EMAIL/PHONE/MEETING/SMS/OTHER)', required: false },
      { key: 'task.communicationNotes', label: 'Task: Communication Notes', required: false },
      // Add questionnaire fields
      ...questionnaireFields.map(field => ({
        key: `custom.${field.key}`,
        label: field.label,
        required: field.required
      }))
    ];
    
    res.json({
      headers,
      preview,
      totalRows: rows.length,
      availableFields,
      columnValueSamples,
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
  
  const { fieldMapping, defaultStatus, createOpportunities, statusValueMap } = req.body;
  if (!fieldMapping) {
    return res.status(400).json({ error: "Field mapping is required" });
  }
  
  let mapping: Record<string, string>;
  try {
    mapping = typeof fieldMapping === 'string' ? JSON.parse(fieldMapping) : fieldMapping;
  } catch {
    return res.status(400).json({ error: "Invalid field mapping format" });
  }

  let statusMapFromCsv: Record<string, UiStatus> = {};
  if (statusValueMap) {
    try {
      const parsed = typeof statusValueMap === 'string' ? JSON.parse(statusValueMap) : statusValueMap;
      if (parsed && typeof parsed === 'object') {
        statusMapFromCsv = parsed as Record<string, UiStatus>;
      }
    } catch {
      return res.status(400).json({ error: 'Invalid status value mapping format' });
    }
  }
  
  const defaultUiStatus: UiStatus = (defaultStatus as UiStatus) || "NEW_ENQUIRY";
  const shouldCreateOpportunities = createOpportunities === 'true' || createOpportunities === true;
  
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
      const clientData: any = {};
      const clientCustomData: any = {};
      const taskData: any = {};
      
      // Map CSV columns to lead/client/task fields
      const mappedColumns = new Set<string>();
      for (const [csvColumn, leadField] of Object.entries(mapping)) {
        mappedColumns.add(csvColumn);
        const columnIndex = headers.indexOf(csvColumn);
        if (columnIndex >= 0 && columnIndex < row.length) {
          const rawValue = row[columnIndex]?.trim();
          if (!rawValue) continue;
          const config = lookupCsvField(csvColumn);
          const transformed = config?.transform ? config.transform(rawValue) ?? rawValue : rawValue;

          // Canonical: some fields belong on Client (e.g. source)
          if (config?.clientKey) {
            clientData[config.clientKey] = transformed;
          }

          // Client mapping
          if (leadField.startsWith('client.custom.')) {
            const key = leadField.substring('client.custom.'.length);
            clientCustomData[key] = transformed;
            continue;
          }
          if (leadField.startsWith('client.')) {
            const key = leadField.substring('client.'.length);
            clientData[key] = transformed;
            continue;
          }

          // Task mapping
          if (leadField.startsWith('task.')) {
            const key = leadField.substring('task.'.length);
            if (key === 'dueAt' || key === 'startedAt' || key === 'completedAt') {
              const parsed = parseMaybeDate(transformed);
              if (parsed) taskData[key] = parsed;
              continue;
            }
            taskData[key] = transformed;
            continue;
          }

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
            // Special-case: these are real Lead columns but not in CANONICAL_FIELD_CONFIG
            if (leadField === 'nextActionAt') {
              const parsed = parseMaybeDate(transformed);
              if (parsed) leadData.nextActionAt = parsed;
              continue;
            }

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

        if (config.clientKey) {
          clientData[config.clientKey] = transformed;
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
        // Determine status - use from CSV if provided, otherwise use default from import options
        let uiStatus: UiStatus = defaultUiStatus;
        if (leadData.status) {
          const rawStatus = String(leadData.status);
          const statusLower = rawStatus.toLowerCase().trim();

          // If UI supplied explicit mapping for this raw status, use it.
          const mapped = statusMapFromCsv[statusLower] as UiStatus | undefined;
          if (mapped) {
            uiStatus = mapped;
          } else {
          const statusMap: Record<string, UiStatus> = {
            'new': 'NEW_ENQUIRY',
            'new_enquiry': 'NEW_ENQUIRY',
            'contacted': 'INFO_REQUESTED',
            'info_requested': 'INFO_REQUESTED',
            'qualified': 'READY_TO_QUOTE',
            'ready_to_quote': 'READY_TO_QUOTE',
            'estimate': 'ESTIMATE',
            'quote_sent': 'QUOTE_SENT',
            'won': 'WON',
            'lost': 'LOST',
            'rejected': 'REJECTED',
            'disqualified': 'DISQUALIFIED',
            'completed': 'COMPLETED'
          };
          uiStatus = statusMap[statusLower] || defaultUiStatus;
          }
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

        // Upsert/link Client (best-effort). We link if we have any meaningful client/contact data.
        let clientId: string | null = null;
        const hasClientSignal =
          Object.keys(clientData).length > 0 ||
          Object.keys(clientCustomData).length > 0 ||
          !!leadData.email;
        if (hasClientSignal) {
          try {
            clientId = await upsertClientForImport({
              tenantId,
              userId,
              leadData,
              clientData,
              clientCustomData,
            });
          } catch (e) {
            console.warn("[Import] client upsert failed:", (e as any)?.message || e);
          }
        }

        // If importing an open communication task (next action) but the Lead doesn't
        // explicitly specify nextAction/nextActionAt, default them from the task.
        if (!leadData.nextAction && taskData.title) {
          const statusRaw = taskData.status ? String(taskData.status).trim().toUpperCase() : "OPEN";
          const isClosed = statusRaw === "DONE" || statusRaw === "CANCELLED";
          if (!isClosed) {
            leadData.nextAction = String(taskData.title).trim();
            if (!leadData.nextActionAt && taskData.dueAt instanceof Date) {
              leadData.nextActionAt = taskData.dueAt;
            }
          }
        }

        // Create the lead
        const normalizedEmail = normalizeEmail(leadData.email);
        const derivedContactName =
          stringOrNull(leadData.contactName ?? null) ??
          stringOrNull((clientData as any)?.contactPerson ?? null) ??
          stringOrNull((clientData as any)?.name ?? null) ??
          (normalizedEmail ? deriveNameFromEmail(normalizedEmail) : "Unknown");

        const lead = await prisma.lead.create({
          data: {
            tenantId,
            createdById: userId,
            ...(clientId ? { clientId } : {}),
            number: leadData.number || null,
            contactName: derivedContactName,
            email: normalizedEmail || "",
            phone: leadData.phone || null,
            address: leadData.address || null,
            status: uiToDb(uiStatus),
            description: leadData.description || null,
            nextAction: leadData.nextAction || null,
            ...(leadData.nextActionAt ? { nextActionAt: leadData.nextActionAt } : {}),
            ...(leadData.estimatedValue !== undefined ? { estimatedValue: leadData.estimatedValue } : {}),
            ...(leadData.quotedValue !== undefined ? { quotedValue: leadData.quotedValue } : {}),
            ...(leadData.dateQuoteSent !== undefined ? { dateQuoteSent: leadData.dateQuoteSent } : {}),
            ...(leadData.capturedAt !== undefined ? { capturedAt: leadData.capturedAt } : {}),
            custom,
          },
        });

        // Optional: create a task per row if task fields are provided
        const hasTask = Object.keys(taskData).length > 0;
        if (hasTask) {
          const title = (taskData.title ? String(taskData.title).trim() : "").trim();
          if (title) {
            const priorityRaw = taskData.priority ? String(taskData.priority).trim().toUpperCase() : undefined;
            const statusRaw = taskData.status ? String(taskData.status).trim().toUpperCase() : undefined;
            const directionRaw = taskData.communicationDirection
              ? String(taskData.communicationDirection).trim().toUpperCase()
              : undefined;
            const typeRaw = taskData.communicationType
              ? String(taskData.communicationType).trim().toUpperCase()
              : undefined;

            const normalizedStatus = (statusRaw || "OPEN") as any;
            const completedAt =
              taskData.completedAt instanceof Date
                ? taskData.completedAt
                : normalizedStatus === "DONE" && taskData.dueAt instanceof Date
                  ? taskData.dueAt
                  : normalizedStatus === "DONE"
                    ? new Date()
                    : undefined;

            const taskType =
              taskData.communicationChannel || taskData.communicationNotes || typeRaw || directionRaw
                ? ("COMMUNICATION" as any)
                : ("MANUAL" as any);

            await prisma.task.create({
              data: {
                tenantId,
                title,
                description: taskData.description ? String(taskData.description) : null,
                relatedType: "LEAD" as any,
                relatedId: lead.id,
                autocreated: false,
                taskType,
                ...(taskData.dueAt instanceof Date ? { dueAt: taskData.dueAt } : {}),
                ...(taskData.startedAt instanceof Date ? { startedAt: taskData.startedAt } : {}),
                ...(completedAt ? { completedAt } : {}),
                ...(priorityRaw ? { priority: priorityRaw as any } : {}),
                ...(normalizedStatus ? { status: normalizedStatus } : {}),
                communicationChannel: taskData.communicationChannel
                  ? String(taskData.communicationChannel)
                  : null,
                communicationDirection: directionRaw ? (directionRaw as any) : null,
                communicationType: typeRaw ? (typeRaw as any) : null,
                communicationNotes: taskData.communicationNotes ? String(taskData.communicationNotes) : null,
                createdById: userId,
                updatedById: userId,
              },
            });
          }
        }

        // Proactively seed playbook tasks for the imported status (best-effort)
        try {
          const playbook = await loadTaskPlaybook(tenantId);
          await handleStatusTransition({
            tenantId,
            leadId: lead.id,
            prevUi: null,
            nextUi: uiStatus,
            actorId: userId,
            playbook,
          });
        } catch (e) {
          console.warn("[Import] task seed failed:", (e as any)?.message || e);
        }
        
        // Create opportunity if requested and status is WON
        if (shouldCreateOpportunities && uiStatus === 'WON') {
          try {
            // Check if opportunity already exists
            const existingOpp = await prisma.opportunity.findUnique({
              where: { leadId: lead.id }
            });
            
            if (!existingOpp) {
              const oppTitle = leadData.number && leadData.description 
                ? `${leadData.number} - ${leadData.description}`
                : leadData.description || leadData.contactName || 'Imported Project';
              
              // Get dates from customData (they're stored there, not in leadData)
              const startDateStr = customData.startDate;
              const deliveryDateStr = customData.deliveryDate;
              const installationStartDateStr = customData.installationStartDate;
              const installationEndDateStr = customData.installationEndDate;
              
              const opportunity = await prisma.opportunity.create({
                data: {
                  tenantId,
                  leadId: lead.id,
                  title: oppTitle,
                  number: leadData.number || null,
                  description: leadData.description || null,
                  // Ensure imported WON leads create WON-stage opportunities so they appear in Workshop
                  stage: 'WON' as any,
                  wonAt: new Date(),
                  valueGBP: leadData.quotedValue || leadData.estimatedValue || null,
                  ...(startDateStr ? { startDate: new Date(startDateStr) } : {}),
                  ...(deliveryDateStr ? { deliveryDate: new Date(deliveryDateStr) } : {}),
                  ...(installationStartDateStr ? { installationStartDate: new Date(installationStartDateStr) } : {}),
                  ...(installationEndDateStr ? { installationEndDate: new Date(installationEndDateStr) } : {}),
                }
              });

              // Trigger automation rules for the newly created opportunity
              // This will create any scheduled tasks based on date fields (e.g., material ordering)
              try {
                const fieldsSet = [];
                if (startDateStr) fieldsSet.push('startDate');
                if (deliveryDateStr) fieldsSet.push('deliveryDate');
                if (installationStartDateStr) fieldsSet.push('installationStartDate');
                if (installationEndDateStr) fieldsSet.push('installationEndDate');

                await evaluateAutomationRules({
                  tenantId,
                  entityType: 'OPPORTUNITY',
                  entityId: opportunity.id,
                  entity: opportunity,
                  changedFields: fieldsSet,
                  userId,
                });
                console.log(`[Import] Triggered automation rules for opportunity ${opportunity.id}`);
              } catch (autoError) {
                console.error('[Import] Failed to trigger automation rules:', autoError);
                // Don't fail the import if automation fails
              }
            }
          } catch (oppError: any) {
            console.error('Failed to create opportunity for lead', lead.id, oppError);
            // Don't fail the entire import if opportunity creation fails
          }
        }
        
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

  console.log(`[task-playbook] handleStatusTransition: status=${nextUi}, recipes=${recipes.length}`, {
    activeRecipes: recipes.filter(r => r.active !== false).map(r => r.title),
  });

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
  "ESTIMATE",
  "QUOTE_SENT",
  "WON",
  "LOST",
  "COMPLETED",
];

router.get("/grouped", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const rows = await prisma.lead.findMany({
    where: { tenantId },
    orderBy: [{ capturedAt: "desc" }],
    include: {
      client: {
        select: { source: true },
      },
      opportunity: {
        select: { 
          id: true,
          valueGBP: true,
          deliveryDate: true,
          groupId: true,
          parentOpportunityId: true,
          group: { select: { id: true, name: true } },
          projectProcesses: {
            include: {
              processDefinition: {
                select: { code: true, name: true }
              }
            }
          }
        }
      }
    }
  });

  // Get task counts for all leads
  const leadIds = rows.map(l => l.id);
  const taskCounts = await prisma.task.groupBy({
    by: ['relatedId'],
    where: {
      tenantId,
      relatedType: 'LEAD',
      relatedId: { in: leadIds },
      status: { notIn: ['DONE', 'CANCELLED'] }
    },
    _count: true
  });
  const taskCountMap = new Map(taskCounts.map(t => [t.relatedId, t._count]));

  const grouped: Record<UiStatus, any[]> = Object.fromEntries(
    UI_BUCKETS.map((s) => [s, [] as any[]])
  ) as any;

  for (const l of rows) {
    const ui = (l.custom as any)?.uiStatus as UiStatus | undefined;
    const bucket = ui ?? dbToUi(l.status);

    const baseCustom = ((l.custom as any) || {}) as any;
    const clientSource = (l as any)?.client?.source;
    const mergedCustom =
      typeof clientSource === "string" && clientSource.trim()
        ? { ...baseCustom, source: clientSource.trim() }
        : baseCustom;
    
    // Calculate process completion percentages
    const processes = l.opportunity?.projectProcesses || [];
    const processPercentages: Record<string, number> = {};
    
    if (processes.length > 0) {
      // Group by process code and calculate completion
      const byCode: Record<string, { total: number; completed: number }> = {};
      processes.forEach(p => {
        const code = p.processDefinition.code;
        if (!byCode[code]) {
          byCode[code] = { total: 0, completed: 0 };
        }
        byCode[code].total += 1;
        if (p.status === 'completed') {
          byCode[code].completed += 1;
        }
      });
      
      // Calculate percentages
      Object.keys(byCode).forEach(code => {
        const { total, completed } = byCode[code];
        processPercentages[code] = Math.round((completed / total) * 100);
      });
    }
    
    (grouped[bucket] || grouped.NEW_ENQUIRY).push({
      ...l,
      custom: mergedCustom,
      opportunityId: l.opportunity?.id || null,
      opportunityGroupId: (l.opportunity as any)?.groupId ?? null,
      opportunityGroupName: (l.opportunity as any)?.group?.name ?? null,
      parentOpportunityId: (l.opportunity as any)?.parentOpportunityId ?? null,
      manufacturingCompletionDate: (l.opportunity as any)?.deliveryDate || null,
      orderValueGBP: (l.opportunity as any)?.valueGBP ?? null,
      taskCount: taskCountMap.get(l.id) || 0,
      processPercentages
    });
  }

  res.json(grouped);
});

/* ------------------------------------------------------------------ */
/* Create lead                                                         */
/* ------------------------------------------------------------------ */

router.post("/", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

    const {
      contactName,
      email,
      status,
      custom = {},
      number,
      description,
      assignedUserId,
      noEmail = false,
    }: {
      contactName: string;
      email?: string | null;
      status?: UiStatus;
      custom?: any;
      number?: string;
      description?: string;
      assignedUserId?: string;
      noEmail?: boolean;
    } = req.body || {};

    if (!contactName) return res.status(400).json({ error: "contactName required" });
    const allowNoEmail = Boolean(noEmail);
    const normalizedEmail = normalizeEmail(email);
    if (!allowNoEmail) {
      if (!normalizedEmail) return res.status(400).json({ error: "email required" });
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: "invalid email" });
      }
    }

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

    // Source is stored on Client; accept legacy custom.source but don't persist it on Lead
    const requestedSource =
      typeof (customData as any)?.source === "string" ? String((customData as any).source) : null;
    if (Object.prototype.hasOwnProperty.call(customData, "source")) {
      delete (customData as any).source;
    }

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

    // Link/create Client only when we have an email
    let clientId: string | null = null;
    if (normalizedEmail) {
      try {
        clientId = await upsertClientForImport({
          tenantId,
          userId,
          leadData: { contactName, email: normalizedEmail },
          clientData: {},
          clientCustomData: {},
        });
      } catch (e) {
        console.warn("[leads] client upsert failed:", (e as any)?.message || e);
      }
    }

    let lead = await prisma.lead.create({
      data: {
        tenantId,
        createdById: userId,
        ...(clientId ? { clientId } : {}),
        contactName: String(contactName),
        email: normalizedEmail || null,
        status: uiToDb(uiStatus),
        number: number ?? null,
        description: description ?? null,
        capturedAt: now,
        dateQuoteSent: dateQuoteSent,
        custom: customData,
      },
    });

    if (requestedSource && normalizedEmail) {
      try {
        const linked = await upsertClientSourceForLead({
          tenantId,
          userId,
          leadId: lead.id,
          leadEmail: normalizedEmail,
          leadName: contactName,
          clientId: lead.clientId,
          source: requestedSource,
        });
        if (linked?.clientId) {
          lead = (await prisma.lead.findUnique({
            where: { id: lead.id },
            include: { client: { select: { source: true } } },
          })) as any;
        }
      } catch (e) {
        console.warn("[leads] client source upsert failed:", (e as any)?.message || e);
      }
    }

    // Link to ClientAccount for customer data reuse
    if (normalizedEmail) {
      linkLeadToClientAccount(lead.id).catch((err) => 
        console.warn("[leads] Failed to link ClientAccount:", err)
      );
    }

    // Proactive first task
    await handleStatusTransition({ tenantId, leadId: lead.id, prevUi: null, nextUi: uiStatus, actorId: userId, playbook });

    // If assigned to a user, create initial task for them
    if (assignedUserId) {
      const initialTask = await prisma.task.create({
        data: {
          tenantId,
          createdById: userId,
          title: `Review enquiry: ${lead.contactName}`,
          description: `Review and respond to enquiry from ${lead.contactName} (${normalizedEmail})`,
          status: "OPEN",
          priority: "HIGH",
          taskType: "MANUAL",
          relatedType: "LEAD",
          relatedId: lead.id,
          autoCompleted: false,
          requiresSignature: false,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24 hours
        },
      });

      // Assign task to user
      await prisma.taskAssignee.create({
        data: {
          taskId: initialTask.id,
          userId: assignedUserId,
          role: "OWNER",
        },
      });
    }

    // If created with WON status, ensure opportunity exists
    if (uiStatus === "WON") {
      try {
        const opp = await prisma.opportunity.create({
          data: {
            tenantId,
            leadId: lead.id,
            title: lead.contactName || "Project",
            stage: "WON" as any,
            wonAt: now,
          },
        });
        // Link opportunity to ClientAccount
        linkOpportunityToClientAccount(opp.id).catch((err) => 
          console.warn("[leads] Failed to link Opportunity to ClientAccount:", err)
        );
      } catch (e) {
        // May already exist if handleStatusTransition created it
        console.warn("[leads] ensure opportunity on new WON lead failed:", (e as any)?.message || e);
      }
    }

    const baseCustom = (((lead as any).custom as any) || {}) as any;
    const clientSource = (lead as any)?.client?.source ?? null;
    res.json({ ...(lead as any), custom: { ...baseCustom, source: clientSource ?? null } });
  } catch (e: any) {
    console.error("[leads] POST / failed:", e);
    res.status(500).json({ error: "internal_error", detail: e.message });
  }
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
    number?: string | null;
    contactName?: string | null;
    email?: string | null;
    clientId?: string | null;
    status?: UiStatus;
    description?: string | null;
    custom?: Record<string, any>;
    questionnaire?: Record<string, any>;
    estimatedValue?: number | string | null;
    quotedValue?: number | string | null;
    dateQuoteSent?: string | Date | null;
    startDate?: string | Date | null;
    deliveryDate?: string | Date | null;

    // Order lifecycle fields (stored on Opportunity but editable from Lead)
    dateOrderPlaced?: string | Date | null;
    orderValueGBP?: number | string | null;
    estimatedWidthMm?: number | string | null;
    estimatedHeightMm?: number | string | null;
    measurementSource?: MeasurementSource | string | null;
    measurementConfidence?: number | string | null;

    // Allow editing key dates (normally auto-populated)
    capturedAt?: string | Date | null;
    createdAt?: string | Date | null;
  };

  const prevCustom = ((existing.custom as any) || {}) as Record<string, any>;
  const prevUi: UiStatus = (prevCustom.uiStatus as UiStatus) ?? dbToUi(existing.status);
  const nextCustom: Record<string, any> = { ...prevCustom };
  let nextUi: UiStatus = prevUi;

  const data: any = {};
  const canonicalUpdates: Record<string, any> = {};

  const parseDateTimeOrNull = (raw: any): Date | null => {
    if (raw === undefined) return undefined as any;
    if (raw === null || raw === "") return null;
    if (raw instanceof Date) return raw;
    if (typeof raw === "string") {
      const d = new Date(raw);
      if (!Number.isFinite(d.getTime())) return undefined as any;
      return d;
    }
    return undefined as any;
  };

  const parseMoneyOrNull = (raw: any): number | null => {
    if (raw === undefined) return undefined as any;
    if (raw === null || raw === "") return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const parsed = toNumberGBP(trimmed);
      return parsed != null ? parsed : null;
    }
    return null;
  };

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

  if (body.number !== undefined) data.number = body.number || null;
  if (body.contactName !== undefined) {
    const nextName = stringOrNull(body.contactName);
    if (!nextName) return res.status(400).json({ error: "contactName cannot be empty" });
    data.contactName = nextName;
  }
  if (body.email !== undefined) {
    // Lead.email is optional. Allow clearing it by sending null/"".
    if (body.email === null || body.email === "") {
      data.email = null;
    } else {
      const nextEmail = normalizeEmail(body.email);
      if (!nextEmail) return res.status(400).json({ error: "invalid email" });
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(nextEmail)) return res.status(400).json({ error: "invalid email" });
      data.email = nextEmail;
    }
  }
  if ((body as any).phone !== undefined) data.phone = (body as any).phone || null;
  if ((body as any).address !== undefined) data.address = (body as any).address || null;
  if ((body as any).deliveryAddress !== undefined) data.deliveryAddress = (body as any).deliveryAddress || null;

  if ((body as any).capturedAt !== undefined) {
    const parsed = parseDateTimeOrNull((body as any).capturedAt);
    if (parsed === undefined) return res.status(400).json({ error: "invalid capturedAt" });
    data.capturedAt = parsed;
  }

  if ((body as any).createdAt !== undefined) {
    const parsed = parseDateTimeOrNull((body as any).createdAt);
    if (parsed === undefined) return res.status(400).json({ error: "invalid createdAt" });
    data.createdAt = parsed;
  }
  if (body.clientId !== undefined) data.clientId = body.clientId || null;
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

  const requestedOrderPlacedAt = body.dateOrderPlaced !== undefined ? parseDateTimeOrNull(body.dateOrderPlaced) : undefined;
  if (requestedOrderPlacedAt === undefined && body.dateOrderPlaced !== undefined) {
    return res.status(400).json({ error: "invalid dateOrderPlaced" });
  }
  const requestedOrderValueGBP = body.orderValueGBP !== undefined ? parseMoneyOrNull(body.orderValueGBP) : undefined;

  const hasRequestedQuoteProgress =
    body.dateQuoteSent !== undefined ||
    body.quotedValue !== undefined;
  const hasRequestedOrderProgress =
    body.dateOrderPlaced !== undefined ||
    body.orderValueGBP !== undefined;

  // Bidirectional status syncing: setting quote fields promotes status to QUOTE_SENT (unless already later/terminal)
  if (hasRequestedQuoteProgress && nextUi !== "WON" && nextUi !== "LOST" && nextUi !== "DISQUALIFIED") {
    if (nextUi !== "QUOTE_SENT") {
      nextUi = "QUOTE_SENT";
      data.status = uiToDb(nextUi);
      nextCustom.uiStatus = nextUi;
    }

    // If we promoted to QUOTE_SENT and dateQuoteSent is missing, seed it.
    if (!canonicalUpdates.dateQuoteSent && !existing.dateQuoteSent) {
      const now = new Date();
      canonicalUpdates.dateQuoteSent = now;
      data.dateQuoteSent = now;
      nextCustom.dateQuoteSent = now.toISOString().split("T")[0];
    }
  }

  // Bidirectional status syncing: setting order fields promotes status to WON
  if (hasRequestedOrderProgress) {
    if (nextUi !== "WON") {
      nextUi = "WON";
      data.status = uiToDb(nextUi);
      nextCustom.uiStatus = nextUi;
    }

    const effectiveOrderPlacedAt =
      requestedOrderPlacedAt && requestedOrderPlacedAt !== null
        ? requestedOrderPlacedAt
        : prevUi !== "WON"
          ? new Date()
          : null;

    if (effectiveOrderPlacedAt) {
      nextCustom.dateOrderPlaced = effectiveOrderPlacedAt.toISOString().split("T")[0];
    }

    if (body.orderValueGBP !== undefined) {
      nextCustom.orderValueGBP = requestedOrderValueGBP ?? null;
    }
  }

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

  // Source is stored on Client; accept legacy custom.source but don't persist it on Lead
  const hasRequestedSource = Object.prototype.hasOwnProperty.call(nextCustom, "source");
  const requestedSourceRaw = hasRequestedSource ? (nextCustom as any).source : null;
  const requestedSource =
    typeof requestedSourceRaw === "string"
      ? requestedSourceRaw
      : requestedSourceRaw != null
        ? String(requestedSourceRaw)
        : null;
  if (hasRequestedSource) {
    delete (nextCustom as any).source;
  }

  // Only apply canonical updates to Lead if they exist as direct fields
  // startDate and deliveryDate should only go to custom and opportunity
  const leadOnlyFields = ['estimatedValue', 'quotedValue', 'dateQuoteSent'];
  for (const [key, value] of Object.entries(canonicalUpdates)) {
    if (leadOnlyFields.includes(key)) {
      data[key] = value;
    }
  }
  data.custom = nextCustom;

  let updated = await prisma.lead.update({ where: { id }, data });

  let effectiveClientId: string | null = (updated as any).clientId ?? null;
  let effectiveSource: string | null = null;

  // Keep Lead ↔ Client/ClientContact linked by email (multi-contact aware)
  try {
    const actorId = (req.auth?.userId as string | undefined) ?? (existing as any).createdById;
    const updatedEmail = normalizeEmail((updated as any).email);
    const updatedName = stringOrNull((updated as any).contactName) ?? (updatedEmail ? deriveNameFromEmail(updatedEmail) : null);
    if (updatedEmail) {
      if (body.clientId !== undefined && body.clientId) {
        // Respect explicit clientId changes; ensure contact exists for the lead email
        await ensureClientContactForLeadEmail({
          tenantId,
          clientId: String(body.clientId),
          email: updatedEmail,
          name: updatedName || deriveNameFromEmail(updatedEmail),
          phone: (updated as any).phone ?? null,
        });
        effectiveClientId = String(body.clientId);
      } else {
        const linkedClientId = await upsertClientForImport({
          tenantId,
          userId: actorId,
          leadData: { email: updatedEmail, contactName: updatedName, phone: (updated as any).phone ?? null },
          clientData: {},
          clientCustomData: {},
        });
        if (linkedClientId && linkedClientId !== effectiveClientId) {
          updated = (await prisma.lead.update({ where: { id }, data: { clientId: linkedClientId } })) as any;
          effectiveClientId = linkedClientId;
        }
      }
    }
  } catch (e) {
    console.warn("[leads.patch] client/contact sync failed:", (e as any)?.message || e);
  }

  if (requestedSource && String(requestedSource).trim()) {
    try {
      const linked = await upsertClientSourceForLead({
        tenantId,
        userId: (req.auth?.userId as string | undefined) ?? (existing as any).createdById,
        leadId: id,
        leadEmail: (updated as any).email,
        leadName: (updated as any).contactName,
        clientId: effectiveClientId,
        source: String(requestedSource),
      });
      if (linked?.clientId) {
        effectiveClientId = linked.clientId;
        effectiveSource = String(requestedSource).trim();
        updated = (await prisma.lead.findUnique({ where: { id } })) as any;
      }
    } catch (e) {
      console.warn("[leads.patch] client source upsert failed:", (e as any)?.message || e);
    }
  }

  // After persisting, trigger generic Field ↔ Task link auto-completion on relevant changes
  try {
    const changed: Record<string, any> = {};
    // Include all top-level fields updated (except the custom blob)
    for (const k of Object.keys(data)) {
      if (k === "custom") continue;
      changed[k] = (updated as any)[k];
    }
    // For canonical date fields stored in custom, expose them by key
    if (body.startDate !== undefined || Object.prototype.hasOwnProperty.call(canonicalUpdates, "startDate")) {
      changed["startDate"] = (updated.custom as any)?.startDate ?? null;
    }
    if (body.deliveryDate !== undefined || Object.prototype.hasOwnProperty.call(canonicalUpdates, "deliveryDate")) {
      changed["deliveryDate"] = (updated.custom as any)?.deliveryDate ?? null;
    }
    if (Object.keys(changed).length > 0) {
      await completeTasksOnRecordChangeByLinks({
        tenantId,
        model: "Lead",
        recordId: id,
        changed,
        newRecord: updated,
      });
    }
  } catch (e) {
    console.warn("[leads.patch] field-link sync failed:", (e as any)?.message || e);
  }

  if (nextUi !== prevUi) {
    const actorId = (req.auth?.userId as string | undefined) ?? null;
    const playbook = await loadTaskPlaybook(tenantId);
    await handleStatusTransition({ tenantId, leadId: id, prevUi, nextUi, actorId, playbook });

    logOrderFlow("lead_status_transition", { tenantId, leadId: id, from: prevUi, to: nextUi, actorId });

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
    let source = (effectiveSource ?? prevCustom.source ?? "Unknown").toString().trim() || "Unknown";
    if (!effectiveSource && effectiveClientId) {
      try {
        const c = await prisma.client.findUnique({ where: { id: effectiveClientId }, select: { source: true } });
        source = (c?.source ?? prevCustom.source ?? "Unknown").toString().trim() || "Unknown";
      } catch {}
    }
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

        const existingOpp = await tx.opportunity.findFirst({
          where: { leadId: id },
          select: { id: true, valueGBP: true },
        });
        
        // Get startDate and deliveryDate from the updated lead's custom data
        const startDate = (updated.custom as any)?.startDate || null;
        const deliveryDate = (updated.custom as any)?.deliveryDate || null;
        
        // Use explicit orderValueGBP if provided, otherwise preserve existing Opp value, otherwise fall back to quote totalGBP, otherwise lead.quotedValue
        const explicitOrderValueGBP = body.orderValueGBP !== undefined ? requestedOrderValueGBP : undefined;
        const valueGBP =
          explicitOrderValueGBP !== undefined
            ? explicitOrderValueGBP
            : existingOpp?.valueGBP ?? (latestQuote as any)?.totalGBP ?? updated.quotedValue ?? undefined;

        const shouldSetWonAt = body.dateOrderPlaced !== undefined || (prevUi !== "WON" && nextUi === "WON");
        const wonAt =
          body.dateOrderPlaced !== undefined
            ? (requestedOrderPlacedAt && requestedOrderPlacedAt !== null ? requestedOrderPlacedAt : undefined)
            : new Date();
        
        const opportunity = await tx.opportunity.upsert({
          where: { leadId: id },
          update: {
            stage: "WON" as any,
            wonAt: shouldSetWonAt ? (wonAt ?? undefined) : undefined,
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
            wonAt: wonAt ?? new Date(),
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
        
        // Auto-create Fire Door Schedule project for fire door manufacturers
        const tenantSettings = await tx.tenantSettings.findUnique({
          where: { tenantId },
          select: { isFireDoorManufacturer: true },
        });
        
        if (tenantSettings?.isFireDoorManufacturer) {
          // Check if fire door schedule project already exists for this opportunity
          const existingSchedule = await tx.fireDoorScheduleProject.findFirst({
            where: { tenantId, projectId: opportunity.id },
          });
          
          if (!existingSchedule) {
            await tx.fireDoorScheduleProject.create({
              data: {
                tenantId,
                projectId: opportunity.id,
                jobName: title,
                clientName: updated.contactName || undefined,
                dateReceived: new Date(),
                dateRequired: deliveryDate ? new Date(deliveryDate) : undefined,
                jobLocation: "IN PROGRESS",
                signOffStatus: "AWAITING SCHEDULE",
                lastUpdatedBy: (req as any).user?.id,
                lastUpdatedAt: new Date(),
              },
            });
          }
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
    // Capture ML project actuals when opportunity is marked as WON (non-blocking)
    if (nextUi === "WON") {
      const opportunity = await prisma.opportunity.findFirst({
        where: { leadId: id },
        select: { id: true },
      }).catch(() => null);
    
      if (opportunity) {
        const ML_URL = (process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000").replace(/\/$/, "");
        const API_INTERNAL_BASE = (process.env.API_INTERNAL_URL || process.env.API_URL || "http://localhost:8001").replace(/\/$/, "");
        fetch(`${API_INTERNAL_BASE}/api/ml-actuals/capture/${opportunity.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.authorization || "",
          },
        })
          .then((r) => {
            if (r.ok) {
              console.log(`[ml-actuals] Captured actuals for opportunity ${opportunity.id}`);
            } else {
              console.warn(`[ml-actuals] Failed to capture actuals: ${r.status} ${r.statusText}`);
            }
          })
          .catch((e) => console.warn("[ml-actuals] Error capturing actuals:", e?.message || e));
      }
    }

  }

  const withClient = await prisma.lead.findUnique({
    where: { id },
    include: { client: { select: { source: true } } },
  });
  res.json({ ok: true, lead: serializeLeadRow(withClient || updated) });
});

/* ------------------------------------------------------------------ */
/* Read one (for modal)                                               */
/* ------------------------------------------------------------------ */

router.get("/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, tenantId },
    include: {
      client: {
        select: { source: true },
      },
      visionInferences: {
        orderBy: [{ itemNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!lead) return res.status(404).json({ error: "not found" });

  // Find an existing draft quote for this lead (if any)
  const existingQuote = await prisma.quote.findFirst({ where: { tenantId, leadId: lead.id }, orderBy: { createdAt: "desc" }, select: { id: true, status: true } });

  const fields = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  const visionInferences = Array.isArray((lead as any).visionInferences)
    ? (lead as any).visionInferences.map(serializeVisionInference)
    : [];

  res.json({
    lead: serializeLeadRow(lead, {
      quoteId: existingQuote?.id || null,
      quoteStatus: existingQuote?.status || null,
      visionInferences,
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
    
    // Sign an invite token to switch estimator into INVITE mode
    const token = jwt.sign({ t: tenantId, l: id, scope: "public-invite" }, env.APP_JWT_SECRET, { expiresIn: "90d" });
    
    // Use NEW public estimator route instead of old questionnaire
    const qUrl = `${WEB_ORIGIN}/tenant/${encodeURIComponent(slug)}/estimate?leadId=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;

    // Allow custom subject and body from request, or use defaults
    const customSubject = req.body?.subject;
    const customBody = req.body?.body;
    
    const fromHeader = fromEmail || "me";
    const subject = customSubject || `More details needed – ${lead.contactName || "your enquiry"}`;
    const body = customBody || (
      `Hi ${lead.contactName || ""},\n\n` +
      `To prepare an accurate quote we need a few more details.\n` +
      `Please fill in this short form: ${qUrl}\n\n` +
      `Thanks,\n${fromEmail || "CRM"}`
    );

    // If sendEmail is false, just return the preview without sending
    if (req.body?.sendEmail === false) {
      return res.json({ ok: true, url: qUrl, token, preview: { subject, body, to: lead.email, from: fromHeader } });
    }

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
    return res.json({ ok: true, url: qUrl, token });
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
    const globalSpecs = extractGlobalSpecsFromAnswers(answers);
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
      ...specsToPrismaData(globalSpecs),
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

    // PHASE 2: Dual-write to ConfiguredProduct if lead has quotes
    try {
      const quotes = await prisma.quote.findMany({ where: { leadId: id }, select: { id: true } });
      if (quotes.length > 0) {
        const { syncAnswerToConfiguredProduct } = await import('../services/configured-product-sync');
        // Sync each answer to the canonical configuredProduct for all quotes
        for (const quote of quotes) {
          for (const [fieldKey, value] of Object.entries(answers)) {
            // Find the field by key
            const field = await prisma.questionnaireField.findFirst({
              where: { tenantId, key: fieldKey }
            });
            if (field) {
              await syncAnswerToConfiguredProduct(quote.id, field.id, value, tenantId);
            }
          }
        }
      }
    } catch (syncError) {
      console.error('[leads] ConfiguredProduct sync failed (non-fatal):', syncError);
      // Don't fail the request - dual-write is optional
    }

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

    const rawBuffer = Buffer.from(base64, "base64");
    const looksLikeEml = (() => {
      const lowerName = String(filename || "").toLowerCase();
      const lowerType = String(mimeType || "").toLowerCase();
      if (lowerName.endsWith(".eml")) return true;
      if (lowerType === "message/rfc822") return true;
      // Lightweight heuristic: RFC822-ish headers present in first chunk
      const head = rawBuffer.subarray(0, Math.min(rawBuffer.length, 8192)).toString("utf8");
      return /\bMIME-Version:\s*1\.0\b/i.test(head) || /\bContent-Type:\s*multipart\//i.test(head);
    })();

    let emailData:
      | {
          contactName: string | null;
          email: string | null;
          subject: string | null;
          bodyText: string | null;
          summary: string | null;
          confidence: number;
          fromEmail: string | null;
          attachments?: Array<{ source: "upload"; fileId: string; filename: string; mimeType?: string | null; size?: number | null }>;
        }
      | null = null;

    if (looksLikeEml) {
      try {
        const parsed = await simpleParser(rawBuffer);
        const subjectOuter = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
        const outerFromText = parsed.from?.text ? String(parsed.from.text) : null;
        const outerFromParsed = parseFromHeader(outerFromText);
        const outerFromEmail = outerFromParsed?.email ? String(outerFromParsed.email).toLowerCase() : null;
        const text = (() => {
          const plain = typeof parsed.text === "string" ? parsed.text : "";
          if (plain && plain.trim()) return plain;
          const html = typeof (parsed as any)?.html === "string" ? String((parsed as any).html) : "";
          if (!html) return "";
          // Best-effort HTML -> text for forwarded headers that sometimes live only in HTML.
          return html
            .replace(/<\s*br\s*\/?>/gi, "\n")
            .replace(/<\s*\/p\s*>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/\r\n/g, "\n");
        })();

        const forwarded = extractForwardedEmailContext(text, outerFromEmail);
        const chosenFrom = forwarded?.from || outerFromParsed;
        const chosenSubject = (subjectOuter && /^fwd?:\s*/i.test(subjectOuter) && forwarded?.subject)
          ? forwarded.subject
          : (subjectOuter || forwarded?.subject || null);

        const bodyTextRaw = cleanEmailBodyText(text);
        const bodyText = await cleanEmailEnquiryText(bodyTextRaw);
        const summary = bodyText
          ? bodyText.slice(0, 250) + (bodyText.length > 250 ? "..." : "")
          : null;

        const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
        const persisted = await persistEmailAttachments({ tenantId, attachments, originalFilename: filename });

        const email = chosenFrom?.email ? String(chosenFrom.email).toLowerCase() : null;
        const contactName = chosenFrom?.name || (email ? deriveNameFromEmail(email) : null);
        const fromEmailForUi = (() => {
          if (chosenFrom?.name && chosenFrom?.email) return `${chosenFrom.name} <${chosenFrom.email}>`;
          if (chosenFrom?.email) return chosenFrom.email;
          return outerFromText;
        })();

        let confidence = 0.6;
        if (email && contactName && chosenSubject) confidence = 0.9;
        else if (email && chosenSubject) confidence = 0.8;
        else if (email || contactName) confidence = 0.6;
        else confidence = 0.3;

        emailData = {
          contactName,
          email,
          subject: chosenSubject,
          bodyText: bodyText || null,
          summary,
          confidence,
          fromEmail: fromEmailForUi || null,
          attachments: persisted,
        };
      } catch (e: any) {
        console.warn("[leads] parse-email mailparser failed; falling back:", e?.message || e);
      }
    }

    if (!emailData) {
      // Decode base64 content (best-effort) and fall back to legacy parsing
      const fileContent = rawBuffer.toString("utf-8");
      const legacy = parseEmailContent(fileContent);
      emailData = { ...legacy, fromEmail: null };
    }
    
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
          fromEmail: emailData.fromEmail,
          attachments: (emailData as any)?.attachments,
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

function parseFromHeader(fromHeader: string | null): { name: string | null; email: string | null } | null {
  if (!fromHeader) return null;
  const raw = String(fromHeader).trim();
  if (!raw) return null;
  const emailMatch = raw.match(/<([^>]+)>/);
  if (emailMatch?.[1]) {
    const email = emailMatch[1].trim();
    const name = raw.replace(/<[^>]+>/, "").trim().replace(/^\"|\"$/g, "");
    return { name: name || null, email: email || null };
  }
  const simpleEmail = raw.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (simpleEmail?.[1]) return { name: null, email: simpleEmail[1] };
  return null;
}

function cleanEmailBodyText(input: string): string {
  const s = String(input || "");
  // mailparser already decodes MIME; this is just whitespace cleanup + safety trimming.
  const cleaned = s
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  // Avoid accidental gigantic bodies (e.g. weird encodings). Keep enough for context.
  return cleaned.slice(0, 20000);
}

function extractForwardedEmailContext(
  text: string,
  outerFromEmail?: string | null,
): { from: { name: string | null; email: string | null } | null; subject: string | null } | null {
  const raw = String(text || "");
  if (!raw) return null;
  const hay = raw.slice(0, 12000);

  // Only attempt if it looks like a forwarded/quoted block.
  // Note: "Sent:" is typically followed by a space (no word boundary), so use \s not \b.
  const looksForwarded =
    /(^|\n)\s*(fw|fwd)\s*:/i.test(hay) ||
    /\bForwarded message\b/i.test(hay) ||
    /\bOriginal Message\b/i.test(hay) ||
    /(^|\n)\s*Sent:\s/i.test(hay) ||
    /(^|\n)\s*From:\s/i.test(hay) ||
    /(^|\n)\s*_{8,}\s*$/m.test(hay);
  if (!looksForwarded) return null;

  const outer = outerFromEmail ? String(outerFromEmail).toLowerCase() : null;
  const startIdx = (() => {
    const markers: RegExp[] = [
      /-{2,}\s*Forwarded message\s*-{2,}/i,
      /-{2,}\s*Original Message\s*-{2,}/i,
      /^_{8,}\s*$/m, // Outlook separator line
      /^Begin forwarded message:/im,
      /\bForwarded message\b/i,
      /\bOriginal Message\b/i,
    ];
    for (const re of markers) {
      const idx = hay.search(re);
      if (idx >= 0) return idx;
    }
    return 0;
  })();

  const segment = hay.slice(startIdx);
  const lines = segment.split(/\r?\n/).slice(0, 250);

  const fromCandidates: Array<{ name: string | null; email: string | null }> = [];
  const subjectCandidates: string[] = [];

  for (const lineRaw of lines) {
    const line = String(lineRaw || "").trim();
    const fromMatch = line.match(/^(?:>\s*)?From:\s*(.+)$/i);
    if (fromMatch?.[1]) {
      const parsed = parseFromHeader(fromMatch[1].trim());
      if (parsed) fromCandidates.push(parsed);
      continue;
    }
    const subjMatch = line.match(/^(?:>\s*)?Subject:\s*(.+)$/i);
    if (subjMatch?.[1]) {
      subjectCandidates.push(subjMatch[1].trim());
      continue;
    }
  }

  const pickFrom = (() => {
    // Prefer the deepest (last) From: that isn't the outer sender.
    for (let i = fromCandidates.length - 1; i >= 0; i -= 1) {
      const c = fromCandidates[i];
      const email = c?.email ? String(c.email).toLowerCase() : null;
      if (email && outer && email === outer) continue;
      if (email || c?.name) return c;
    }
    // Fallback: if we didn't find a better one, allow a match (better than nothing)
    return fromCandidates.length ? fromCandidates[fromCandidates.length - 1] : null;
  })();
  const pickSubject = subjectCandidates.length ? subjectCandidates[0] : null;

  if (!pickFrom && !pickSubject) return null;
  return { from: pickFrom, subject: pickSubject };
}

async function cleanEmailEnquiryText(input: string): Promise<string> {
  const raw = cleanEmailBodyText(input);
  if (!raw) return "";

  // Heuristic cleanup first (cheap + deterministic)
  const heuristic = (() => {
    let s = raw;
    // Strip common mobile/app footers
    s = s.replace(/\n\s*Sent\s+from\s+my\s+\S[\s\S]*$/i, "\n");
    s = s.replace(/\n\s*Sent\s+from\s+Outlook[\s\S]*$/i, "\n");
    s = s.replace(/\n\s*Get\s+Outlook\s+for\s+iOS[\s\S]*$/i, "\n");

    // Trim everything after a typical signature delimiter
    const sigIdx = s.search(/\n\s*(--\s*$|Kind\s+Regards\b|Regards\b|Thanks\b|Many\s+thanks\b)/im);
    if (sigIdx > 0) s = s.slice(0, sigIdx).trim();

    // Drop huge quoted chains after an Outlook-style forwarded header block.
    const chainIdx = s.search(/\n\s*_{8,}\s*\n[\s\S]*\n\s*From:\s+/m);
    if (chainIdx > 0) s = s.slice(0, chainIdx).trim();
    return cleanEmailBodyText(s);
  })();

  // AI cleanup if configured.
  if (!env.OPENAI_API_KEY) return heuristic;

  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Extract the core customer enquiry message from an email. Remove signatures, legal footers, tracking links, and quoted/forwarded email chains. Return plain text only. Do not add or invent details.",
        },
        {
          role: "user",
          content: raw.slice(0, 12000),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_enquiry_clean",
          schema: {
            type: "object",
            properties: {
              cleaned: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["cleaned", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = resp.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content) as { cleaned?: string; confidence?: number };
    const cleaned = typeof parsed.cleaned === "string" ? parsed.cleaned.trim() : "";
    if (!cleaned) return heuristic;
    // If the model isn't confident, prefer heuristic to avoid over-trimming.
    if (typeof parsed.confidence === "number" && parsed.confidence < 0.5) return heuristic;
    return cleanEmailBodyText(cleaned);
  } catch (err: any) {
    console.warn("[leads] AI email cleaning failed; using heuristic:", err?.message || err);
    return heuristic;
  }
}

async function persistEmailAttachments(opts: {
  tenantId: string;
  attachments: Array<{ filename?: string | null; contentType?: string | null; content?: Buffer | Uint8Array; size?: number | null }>;
  originalFilename?: string;
}): Promise<Array<{ source: "upload"; fileId: string; filename: string; mimeType?: string | null; size?: number | null }>> {
  const { tenantId } = opts;
  const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const out: Array<{ source: "upload"; fileId: string; filename: string; mimeType?: string | null; size?: number | null }> = [];
  const attachments = Array.isArray(opts.attachments) ? opts.attachments : [];
  for (const [idx, a] of attachments.entries()) {
    const buf = a?.content ? Buffer.from(a.content as any) : null;
    if (!buf || !buf.length) continue;

    const mimeType = typeof a?.contentType === "string" && a.contentType.trim() ? a.contentType.trim() : null;
    const safeBase = (() => {
      const rawName = typeof a?.filename === "string" && a.filename.trim() ? a.filename.trim() : `attachment_${idx + 1}`;
      return rawName.replace(/[^\w.\-]+/g, "_");
    })();

    const ts = Date.now();
    const diskName = `${ts}__${safeBase}`;
    const absPath = path.join(UPLOAD_DIR, diskName);
    await fs.promises.writeFile(absPath, buf);

    const row = await prisma.uploadedFile.create({
      data: {
        tenantId,
        quoteId: null,
        kind: "OTHER",
        name: safeBase,
        path: path.relative(process.cwd(), absPath),
        mimeType: mimeType || "application/octet-stream",
        sizeBytes: typeof a?.size === "number" ? a.size : buf.length,
      },
      select: { id: true, name: true, mimeType: true, sizeBytes: true },
    });

    out.push({
      source: "upload",
      fileId: row.id,
      filename: row.name,
      mimeType: row.mimeType,
      size: row.sizeBytes,
    });
  }
  return out;
}

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

// POST /leads/:id/disqualify - Disqualify a lead and send notification email
router.post("/:id/disqualify", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.tenantId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { message, taskId } = req.body;

    if (!id) return res.status(400).json({ error: "Lead ID required" });

    // Fetch the lead
    const lead = await prisma.lead.findUnique({
      where: { id, tenantId: auth.tenantId },
      select: {
        id: true,
        email: true,
        contactName: true,
        status: true,
      },
    });

    if (!lead) return res.status(404).json({ error: "Lead not found" });
    if (!lead.email) return res.status(400).json({ error: "Lead has no email address" });

    // Update lead status to DISQUALIFIED
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: { status: "DISQUALIFIED" },
      select: { id: true, status: true },
    });

    // Send disqualification email
    try {
      const { sendEmailViaTenant } = await import("../services/email-sender");
      const tenantSettings = await prisma.tenantSettings.findFirst({
        where: { tenantId: auth.tenantId },
        select: { brandName: true },
      });

      const brandName = tenantSettings?.brandName || "Our team";

      await sendEmailViaTenant(auth.tenantId, {
        to: lead.email,
        subject: "Your Project Enquiry",
        body: message || `Hi ${lead.contactName || "there"},

Thank you for reaching out to us with your project enquiry. We appreciate the opportunity.

After reviewing your project details, we've determined that this type of work falls outside our current scope. We're unable to provide a quote at this time.

Best regards,
${brandName}`,
      });
    } catch (emailError) {
      console.error("Failed to send disqualification email:", emailError);
      // Don't fail the request if email fails
    }

    // Mark related task as done if provided
    if (taskId) {
      try {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "DONE", completedAt: new Date() },
        });
      } catch (taskError) {
        console.error("Failed to mark task complete:", taskError);
      }
    }

    return res.json({ ok: true, lead: updatedLead });
  } catch (err: any) {
    console.error("POST /leads/:id/disqualify error", err);
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

// Align React versions to Next supported
// Downgrade React to version 18.2.0
// Redeploy the application

export default router;