// api/src/routes/quotes.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../prisma";
import { Prisma, FileKind } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../env";

import { callMlWithSignedUrl, callMlWithUpload, normaliseMlPayload } from "../lib/ml";
import { fallbackParseSupplierPdf } from "../lib/pdf/fallback";
import { parseSupplierPdf } from "../lib/supplier/parse";
import type { SupplierParseResult } from "../types/parse";
import { logInsight, logInferenceEvent } from "../services/training";
import { redactSupplierLine } from "../lib/ml/redact";
import { sendParserErrorAlert, sendParserFallbackAlert } from "../lib/ops/alerts";
import {
  parsePdfWithTemplate,
  normaliseAnnotations,
  type LayoutTemplateRecord,
  type TemplateParseMeta,
  type TemplateParseOutcome,
} from "../lib/pdf/layoutTemplates";
import { fromDbQuoteSourceType, normalizeQuoteSourceValue, toDbQuoteSourceType } from "../lib/quoteSourceType";

const router = Router();

type ParserStageName = NonNullable<SupplierParseResult["usedStages"]>[number];

/**
 * TypeScript interface for QuoteLine.meta
 * Stores additional line-level metadata like pricing overrides and images
 */
interface QuoteLineMeta {
  sellUnitGBP?: number;
  sellTotalGBP?: number;
  dimensions?: string;
  imageFileId?: string;  // NEW: Reference to UploadedFile.id for per-line thumbnail
  [key: string]: any;    // Allow other fields
}

const FALLBACK_ALERT_RATIO = (() => {
  const raw = Number(process.env.PARSER_FALLBACK_ALERT_RATIO);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 0.3;
})();

async function maybeTriggerFallbackAlert(fallbackCount: number) {
  if (!fallbackCount || fallbackCount <= 0) return;
  if (!(FALLBACK_ALERT_RATIO > 0)) return;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, fallback] = await Promise.all([
      prisma.inferenceEvent.count({
        where: {
          model: "supplier_parser",
          createdAt: { gte: since },
        },
      }),
      prisma.inferenceEvent.count({
        where: {
          model: "supplier_parser",
          createdAt: { gte: since },
          outputJson: { path: ["meta", "fallbackUsed"], equals: true },
        },
      }),
    ]);
    if (!total) return;
    const ratio = fallback / total;
    if (ratio >= FALLBACK_ALERT_RATIO) {
      await sendParserFallbackAlert(ratio, { fallback, total });
    }
  } catch (err: any) {
    console.warn("[parse] fallback alert check failed:", err?.message || err);
  }
}

/**
 * Get tenant ID for the current request.
 * In dev mode, use LAJ Joinery tenant for testing.
 * In production, use authenticated tenant from JWT.
 */
async function getTenantId(req: any): Promise<string> {
  const tenantId = req.auth?.tenantId as string | undefined;
  if (tenantId) return tenantId;

  const isDev = process.env.NODE_ENV !== "production";
  
  if (isDev) {
    // In dev mode, fall back to LAJ Joinery tenant when no auth context
    const lajTenant = await prisma.tenant.findUnique({
      where: { slug: "laj-joinery" },
      select: { id: true },
    });
    
    if (!lajTenant) {
      throw new Error("LAJ Joinery tenant not found. Run: npx ts-node prisma/seedTenantLaj.ts");
    }
    
    return lajTenant.id;
  }
  
  throw new Error("unauthorized");
}

function requireAuth(req: any, res: any, next: any) {
  const isDev = process.env.NODE_ENV !== "production";
  
  // In dev mode, allow requests without auth (will use LAJ Joinery)
  if (isDev) {
    return next();
  }
  
  // In production, require authentication
  if (!req.auth?.tenantId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  
  next();
}

// Parse a number from strings like "1,200.50", "£1,234", "$99", or plain numbers. Returns 0 on failure.
function toNumber(input: any): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (typeof input === "string") {
    // Remove currency symbols and spaces, normalise thousands and decimals
    const cleaned = input.replace(/[\s\u00A0]/g, "").replace(/[^0-9,.-]/g, "");
    // If both comma and dot exist, assume comma is thousands separator
    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");
    const normalised = hasComma && hasDot ? cleaned.replace(/,/g, "") : cleaned.replace(/,/g, ".");
    const n = Number(normalised);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeCurrency(input: any): string {
  const raw = String(input || "").trim();
  if (!raw) return "GBP";
  const upper = raw.toUpperCase();
  if (upper === "£" || upper === "GBP" || upper === "GB POUND" || upper === "POUND") return "GBP";
  if (upper === "$" || upper === "USD" || upper === "US DOLLAR") return "USD";
  if (upper === "EUR" || upper === "€" || upper === "EURO") return "EUR";
  return upper;
}

function pickNumber(obj: any, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    const val = (obj as any)[key];
    const n = toNumber(val);
    if (Number.isFinite(n) && n != null) return n;
  }
  return null;
}

function currencySymbol(code: string | undefined): string {
  switch ((code || "GBP").toUpperCase()) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return "";
  }
}

function safeNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Convenience helpers for the three core numeric fields we expect from supplier parsing.
 * These lists cover variants observed in ML payloads and fallbacks:
 *  - qty: qty | quantity
 *  - unit cost: costUnit | unit_price | unitPrice | price | unit_cost | price_ex_vat
 *  - line total: lineTotal | line_total | total | price_ex_vat | amount | ex_vat_total
 */
function pickQty(obj: any): number | null {
  return pickNumber(obj, ["qty", "quantity"]);
}
function pickUnitCost(obj: any): number | null {
  return pickNumber(obj, [
    "costUnit",
    "unit_price",
    "unitPrice",
    "price",
    "unit_cost",
    "price_ex_vat",
  ]);
}
function pickLineTotal(obj: any): number | null {
  return pickNumber(obj, [
    "lineTotal",
    "line_total",
    "total",
    "price_ex_vat",
    "amount",
    "ex_vat_total",
  ]);
}

function extractModelVersionId(raw: any): string | null {
  if (!raw || typeof raw !== "object") return null;
  const maybeMeta = (raw as any).meta && typeof (raw as any).meta === "object" ? (raw as any).meta : null;
  const candidates: Array<any> = [
    (raw as any).modelVersionId,
    (raw as any).model_version,
    (raw as any).modelVersion,
    (raw as any).model_version_id,
    maybeMeta?.modelVersionId,
    maybeMeta?.model_version,
    maybeMeta?.modelVersion,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function sha256(...chunks: Array<string | Buffer>): string {
  const hash = crypto.createHash("sha256");
  for (const chunk of chunks) {
    if (Buffer.isBuffer(chunk)) {
      hash.update(chunk);
    } else if (typeof chunk === "string") {
      hash.update(chunk);
    } else if (chunk != null) {
      hash.update(String(chunk));
    }
  }
  return hash.digest("hex");
}

function stableJsonStringify(value: any): string {
  const seen = new WeakSet();
  const normalise = (input: any): any => {
    if (input === null || input === undefined) return null;
    if (typeof input === "number") {
      if (!Number.isFinite(input)) return null;
      return Number(input);
    }
    if (typeof input === "string") return input;
    if (typeof input === "boolean") return input;
    if (Array.isArray(input)) return input.map((item) => normalise(item));
    if (typeof input === "object") {
      if (seen.has(input)) return null;
      seen.add(input);
      const keys = Object.keys(input).sort();
      const out: Record<string, any> = {};
      for (const key of keys) {
        const normalised = normalise((input as any)[key]);
        if (normalised !== undefined) out[key] = normalised;
      }
      seen.delete(input);
      return out;
    }
    return String(input);
  };
  return JSON.stringify(normalise(value));
}

function normaliseSupplierLinesForHash(lines: Array<any>): Array<any> {
  if (!Array.isArray(lines)) return [];
  return lines.map((ln) => ({
    supplier: ln?.supplier ? String(ln.supplier) : null,
    rawText: ln?.rawText ? String(ln.rawText) : null,
    qty: safeNumber(ln?.qty),
    costUnit: safeNumber(ln?.costUnit),
    lineTotal: safeNumber(ln?.lineTotal),
    currency: normalizeCurrency(ln?.currency || ""),
    page: typeof ln?.page === "number" && Number.isFinite(ln.page) ? ln.page : null,
  }));
}

function normaliseQuestionnaireForHash(features: any): any {
  if (!features || typeof features !== "object") return {};
  // Ensure the hash uses the flattened feature view so cache keys align with ML inputs
  return flattenQuestionnaireFeatures(features);
}

// Flatten lead.custom payloads to the shape expected by ML:
// - If custom.items exists, merge the first item's fields into the top-level (without keeping the items array)
// - Preserve any existing top-level keys (e.g., address) unless overridden by non-empty item fields
// - Strip undefined/empty string values
function flattenQuestionnaireFeatures(raw: any): Record<string, any> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, any> = {};
  // Copy top-level (excluding items)
  try {
    for (const [k, v] of Object.entries(raw)) {
      if (k === "items") continue;
      if (v === undefined || v === null || v === "") continue;
      out[k] = v as any;
    }
  } catch {}
  // Merge first item if present
  try {
    const items: any[] | undefined = Array.isArray((raw as any).items) ? (raw as any).items : undefined;
    if (items && items.length) {
      const first = items[0] || {};
      for (const [k, v] of Object.entries(first)) {
        if (v === undefined || v === null || v === "") continue;
        out[k] = v as any;
      }
    }
  } catch {}
  return out;
}

const ESTIMATE_CACHE_DAYS = (() => {
  const raw = Number(process.env.ESTIMATE_CACHE_DAYS);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 14;
})();

// Minimum estimate floor when ML returns a non-positive value
const MIN_ESTIMATE_GBP = (() => {
  const raw = Number(process.env.MIN_ESTIMATE_GBP);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 1500; // sensible default to avoid £0 proposals
})();

function sanitiseParseResult(result: SupplierParseResult, supplier?: string | null, currency?: string) {
  return {
    supplier: supplier ?? result.supplier ?? null,
    currency: currency ?? result.currency ?? null,
    lineCount: Array.isArray(result.lines) ? result.lines.length : 0,
    lines: Array.isArray(result.lines)
      ? result.lines.map((ln) => ({
          description:
            ln?.description != null && ln?.description !== undefined
              ? redactSupplierLine(String(ln.description))
              : null,
          qty: safeNumber(ln.qty),
          costUnit: safeNumber(ln.costUnit),
          sellUnit: safeNumber((ln as any)?.sellUnit),
          lineTotal: safeNumber(ln.lineTotal),
        }))
      : [],
    detected_totals: result.detected_totals ?? null,
    confidence: result.confidence ?? null,
    warnings: result.warnings ?? [],
    usedStages: Array.isArray(result.usedStages) ? result.usedStages : null,
    quality: result.quality ?? null,
    meta: normaliseParseMeta(result.meta),
  };
}

function normaliseParseMeta(meta?: SupplierParseResult["meta"]) {
  if (!meta || typeof meta !== "object") return null;
  const fallbackScoredRaw = (meta as any).fallbackScored;
  const fallbackScored =
    fallbackScoredRaw && typeof fallbackScoredRaw === "object"
      ? {
          kept: safeNumber((fallbackScoredRaw as any).kept),
          discarded: safeNumber((fallbackScoredRaw as any).discarded),
        }
      : null;
  const unmappedRowsRaw = Array.isArray((meta as any).unmapped_rows)
    ? (meta as any).unmapped_rows
        .map((row: any) => ({
          description:
            typeof row?.description === "string" && row.description.trim() ? row.description.trim() : null,
          score: safeNumber(row?.score),
          reasons: Array.isArray(row?.reasons)
            ? row.reasons.filter((reason: any) => typeof reason === "string").slice(0, 5)
            : null,
        }))
        .filter(
          (row: { description: string | null; score: number | null; reasons: string[] | null }) =>
            row.description != null || row.score != null || (row.reasons != null && row.reasons.length > 0),
        )
        .slice(0, 5)
    : null;
  const templateRaw = (meta as any).template;
  const templateCandidate =
    templateRaw && typeof templateRaw === "object"
      ? {
          id:
            typeof (templateRaw as any).templateId === "string"
              ? (templateRaw as any).templateId
              : typeof (templateRaw as any).id === "string"
              ? (templateRaw as any).id
              : null,
          name:
            typeof (templateRaw as any).templateName === "string"
              ? (templateRaw as any).templateName
              : typeof (templateRaw as any).name === "string"
              ? (templateRaw as any).name
              : null,
          supplierProfileId:
            typeof (templateRaw as any).supplierProfileId === "string"
              ? (templateRaw as any).supplierProfileId
              : null,
          matchedRows: safeNumber((templateRaw as any).matchedRows),
          annotationCount: safeNumber((templateRaw as any).annotationCount),
          matchedAnnotations: safeNumber((templateRaw as any).matchedAnnotations),
          method: typeof (templateRaw as any).method === "string" ? (templateRaw as any).method : null,
          reason: typeof (templateRaw as any).reason === "string" ? (templateRaw as any).reason : null,
        }
      : null;
  const template =
    templateCandidate &&
    Object.values(templateCandidate).some((value) => value !== null && value !== undefined)
      ? templateCandidate
      : null;
  const normalized = {
    fallbackCleaner: meta.fallbackCleaner === true,
    rawRows: safeNumber((meta as any).rawRows),
    discardedRows: safeNumber((meta as any).discardedRows),
    fallbackScored,
    unmappedRows: unmappedRowsRaw,
    template,
  };
  if (
    !normalized.fallbackCleaner &&
    normalized.rawRows == null &&
    normalized.discardedRows == null &&
    !normalized.fallbackScored &&
    !normalized.unmappedRows &&
    !normalized.template
  ) {
    return null;
  }
  return normalized;
}

function mapQuoteSourceForResponse<T extends { quoteSourceType?: any }>(quote: T | null): T | null {
  if (!quote) return quote;
  const normalized = fromDbQuoteSourceType((quote as any).quoteSourceType) ?? null;
  if ((quote as any).quoteSourceType === normalized) {
    return quote;
  }
  return {
    ...(quote as any),
    quoteSourceType: normalized,
  } as T;
}

async function tryTemplateParsers(
  buffer: Buffer,
  options: {
    templates: LayoutTemplateRecord[];
    supplierHint?: string;
    currencyHint?: string;
  }
): Promise<TemplateParseOutcome | null> {
  if (!options.templates.length) return null;
  let lastOutcome: TemplateParseOutcome | null = null;

  for (const template of options.templates) {
    if (!Array.isArray(template.annotations) || template.annotations.length === 0) {
      continue;
    }
    try {
      const outcome = await parsePdfWithTemplate(buffer, template, {
        supplierHint: options.supplierHint,
        currencyHint: options.currencyHint,
      });
      lastOutcome = outcome;
      if (outcome.meta.method === "template") {
        return outcome;
      }
    } catch (err: any) {
      console.warn(`[parse] Template ${template.id} failed:`, err?.message || err);
    }
  }

  return lastOutcome;
}

function summariseParseQuality(entries: Array<Record<string, any>>): "ok" | "poor" | null {
  if (!Array.isArray(entries) || !entries.length) return null;
  let sawOk = false;
  for (const entry of entries) {
    const quality = entry?.quality;
    if (quality === "poor") return "poor";
    if (quality === "ok") sawOk = true;
  }
  return sawOk ? "ok" : null;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const base = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, `${ts}__${base}`);
  },
});

/**
 * GET /quotes/:id/lines
 * Fetch quote lines for editing/viewing
 */
router.get("/:id/lines", requireAuth, async (req: any, res) => {
  try {
    const tenantId = await getTenantId(req);
    const id = String(req.params.id);
    const lines = await prisma.quoteLine.findMany({
      where: { quote: { id, tenantId } },
      orderBy: { id: "asc" },
    });

    const out = lines.map((ln: any) => ({
      id: ln.id,
      description: ln.description,
      qty: Number(ln.qty),
      unitPrice: Number(ln.unitPrice),
      currency: ln.currency,
      supplier: ln.supplier,
      sku: ln.sku,
      meta: ln.meta as any,
      sellUnit: (ln.meta as any)?.sellUnitGBP ?? null,
      sellTotal: (ln.meta as any)?.sellTotalGBP ?? null,
      lineTotalGBP: Number(ln.lineTotalGBP),
      deliveryShareGBP: Number(ln.deliveryShareGBP),
      surchargeGBP: (ln.meta as any)?.surchargeGBP ?? null,
    }));

    // Fetch image URLs for lines that have imageFileId
    const imageUrlMap = await fetchLineImageUrls(lines, tenantId);

    return res.json({ lines: out, imageUrlMap });
  } catch (e: any) {
    console.error("[/quotes/:id/lines] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /quotes/:id/lines/:lineId
 * Body: { qty?: number | null; unitPrice?: number | null; sellUnitGBP?: number; margin?: number; meta?: Record<string, any> }
 * Updates a single quote line allowing inline editing from the quote builder.
 * - Validates ownership (tenant + quote)
 * - Supports manual override of sellUnitGBP and margin
 * - Recalculates sellUnitGBP & sellTotalGBP if margin/pricing info present
 * - Applies markupDefault from quote when pricingMethod === 'margin' and margin not provided
 * - When user explicitly sets sellUnitGBP or margin, marks line as overridden
 */
router.patch("/:id/lines/:lineId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = await getTenantId(req);
    const quoteId = String(req.params.id);
    const lineId = String(req.params.lineId);
    const quote = await prisma.quote.findFirst({ where: { id: quoteId, tenantId } });
    if (!quote) return res.status(404).json({ error: "quote_not_found" });
    const line = await prisma.quoteLine.findFirst({ where: { id: lineId, quoteId: quote.id } });
    if (!line) return res.status(404).json({ error: "line_not_found" });

    const qtyRaw = req.body?.qty;
    const unitPriceRaw = req.body?.unitPrice;
    let qty: number | null = qtyRaw === null ? null : qtyRaw === undefined ? null : Number(qtyRaw);
    let unitPrice: number | null = unitPriceRaw === null ? null : unitPriceRaw === undefined ? null : Number(unitPriceRaw);
    if (qty != null) {
      if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ error: "invalid_qty" });
    }
    if (unitPrice != null) {
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ error: "invalid_unit_price" });
    }

    // Fallback to existing values when not provided
    qty = qty != null ? qty : Number(line.qty);
    unitPrice = unitPrice != null ? unitPrice : Number(line.unitPrice);

    // Merge meta updates
    const incomingMeta: any = (req.body?.meta && typeof req.body.meta === "object") ? req.body.meta : {};
    const existingMeta: any = (line.meta as any) || {};
    const mergedMeta: any = { ...existingMeta, ...incomingMeta };

    // Check if user is explicitly setting sellUnitGBP or margin (manual override)
    const explicitSellUnitGBP = req.body?.sellUnitGBP !== undefined ? safeNumber(req.body.sellUnitGBP) : null;
    const explicitMargin = req.body?.margin !== undefined ? safeNumber(req.body.margin) : null;
    const explicitSurchargeGBP = req.body?.surchargeGBP !== undefined ? safeNumber(req.body.surchargeGBP) : null;
    const isManualOverride = explicitSellUnitGBP !== null || explicitMargin !== null;

    // Handle surcharge updates
    if (explicitSurchargeGBP !== null && Number.isFinite(explicitSurchargeGBP)) {
      mergedMeta.surchargeGBP = explicitSurchargeGBP;
    }

    // Determine pricing/sell values. Priority:
    // 1. Explicit sellUnitGBP/margin from request body (manual override)
    // 2. Explicit sellUnitGBP/sellTotalGBP in incoming meta
    // 3. Margin-based calculation if pricingMethod === 'margin'
    // 4. Preserve existing sell values
    let sellUnitGBP: number | null = explicitSellUnitGBP ?? safeNumber(incomingMeta?.sellUnitGBP ?? incomingMeta?.sell_unit);
    let sellTotalGBP: number | null = safeNumber(incomingMeta?.sellTotalGBP ?? incomingMeta?.sell_total);
    const pricingMethod = String(mergedMeta?.pricingMethod || existingMeta?.pricingMethod || "") || null;

    // If explicit margin provided, calculate sellUnit from it
    if (explicitMargin !== null && Number.isFinite(explicitMargin) && explicitMargin >= 0) {
      sellUnitGBP = Number(unitPrice) * (1 + explicitMargin);
      sellTotalGBP = sellUnitGBP * Number(qty);
      mergedMeta.margin = explicitMargin;
      mergedMeta.pricingMethod = "margin";
      mergedMeta.overrideMargin = explicitMargin; // Store original override
      mergedMeta.isOverridden = true;
    } else if (sellUnitGBP == null && pricingMethod === "margin") {
      // Auto-calculate from margin if no explicit override
      const margin = safeNumber(incomingMeta?.margin ?? existingMeta?.margin) ?? Number(quote.markupDefault ?? 0.25);
      if (Number.isFinite(margin) && margin >= 0) {
        sellUnitGBP = Number(unitPrice) * (1 + margin);
        sellTotalGBP = sellUnitGBP * Number(qty);
        mergedMeta.margin = margin;
        mergedMeta.pricingMethod = "margin";
      }
    }

    // If explicit sellUnitGBP provided, mark as overridden
    if (explicitSellUnitGBP !== null && Number.isFinite(explicitSellUnitGBP)) {
      sellUnitGBP = explicitSellUnitGBP;
      sellTotalGBP = sellUnitGBP * Number(qty);
      mergedMeta.overrideSellUnitGBP = explicitSellUnitGBP; // Store original override
      mergedMeta.isOverridden = true;
      // Calculate implied margin for reference
      if (Number(unitPrice) > 0) {
        mergedMeta.impliedMargin = (sellUnitGBP / Number(unitPrice)) - 1;
      }
    }

    if (sellUnitGBP != null && sellTotalGBP == null) {
      sellTotalGBP = sellUnitGBP * Number(qty);
    } else if (sellUnitGBP == null && sellTotalGBP != null && Number(qty) > 0) {
      sellUnitGBP = sellTotalGBP / Number(qty);
    }

    if (sellUnitGBP != null) mergedMeta.sellUnitGBP = sellUnitGBP;
    if (sellTotalGBP != null) mergedMeta.sellTotalGBP = sellTotalGBP;

    // Always keep lineTotalGBP aligned with sellTotalGBP when present
    const lineTotalGBP = sellTotalGBP != null ? sellTotalGBP : Number(line.lineTotalGBP);

    const saved = await prisma.quoteLine.update({
      where: { id: line.id },
      data: {
        qty,
        unitPrice: new Prisma.Decimal(unitPrice),
        lineTotalGBP: new Prisma.Decimal(Number.isFinite(lineTotalGBP) ? lineTotalGBP : 0),
        meta: mergedMeta as any,
      },
    });

    const out = {
      id: saved.id,
      description: saved.description,
      qty: Number(saved.qty),
      unitPrice: Number(saved.unitPrice),
      currency: saved.currency,
      supplier: saved.supplier,
      sku: saved.sku,
      meta: saved.meta as any,
      sellUnit: (saved.meta as any)?.sellUnitGBP ?? null,
      sellTotal: (saved.meta as any)?.sellTotalGBP ?? null,
      lineTotalGBP: Number(saved.lineTotalGBP),
      deliveryShareGBP: Number(saved.deliveryShareGBP),
      surchargeGBP: (saved.meta as any)?.surchargeGBP ?? null,
      isOverridden: (saved.meta as any)?.isOverridden ?? false,
    };
    return res.json(out);
  } catch (e: any) {
    console.error("[/quotes/:id/lines/:lineId] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /quotes/:id/lines/save-processed
 * Persist a processed client quote (from ML /process-quote) as quote lines.
 * Body: {
 *   clientQuote: {
 *     currency?: string,
 *     markup_percent?: number,
 *     vat_percent?: number,
 *     subtotal?: number,
 *     vat_amount?: number,
 *     grand_total?: number,
 *     lines: Array<{
 *       description: string,
 *       qty: number,
 *       unit_price?: number,               // supplier unit cost if available
 *       total?: number,                    // supplier line total if available
 *       unit_price_marked_up: number,      // client unit sell price
 *       total_marked_up: number,           // client line total sell price
 *     }>
 *   },
 *   replace?: boolean                      // when true (default), replaces existing lines
 * }
 */
router.post("/:id/lines/save-processed", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const quote = await prisma.quote.findFirst({ where: { id, tenantId }, include: { lines: true } });
    if (!quote) return res.status(404).json({ error: "not_found" });

    const body = req.body || {};
    const clientQuote = body.clientQuote || body.client_quote || null;
    if (!clientQuote || !Array.isArray(clientQuote.lines)) {
      return res.status(400).json({ error: "invalid_client_quote" });
    }

    const replace = body.replace !== false; // default true
    const currency = normalizeCurrency(clientQuote.currency || quote.currency || "GBP");
    const markupPercent = typeof clientQuote.markup_percent === "number" ? clientQuote.markup_percent : null;
    const vatPercent = typeof clientQuote.vat_percent === "number" ? clientQuote.vat_percent : null;

    // Replace existing lines if requested
    if (replace && quote.lines.length > 0) {
      await prisma.quoteLine.deleteMany({ where: { quoteId: quote.id } });
    }

    let created = 0;
    for (const ln of clientQuote.lines as Array<any>) {
      const description = String(ln.description || "Item");
      const qtyRaw = Number(ln.qty ?? 1);
      const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
      const supplierUnit = Number(ln.unit_price ?? (ln.total != null ? Number(ln.total) / qty : 0));
      const sellUnit = Number(ln.unit_price_marked_up ?? 0);
      const sellTotal = Number(ln.total_marked_up ?? sellUnit * qty);

      // CRITICAL: Preserve existing meta fields (especially imageFileId) from original parsed lines
      // Match by description to find the original line
      const originalLine = quote.lines.find(ol => ol.description === description);
      const originalMeta = originalLine?.meta ? (originalLine.meta as any) : {};

      await prisma.quoteLine.create({
        data: {
          quoteId: quote.id,
          supplier: null as any,
          sku: undefined,
          description,
          qty,
          unitPrice: new Prisma.Decimal(Number.isFinite(supplierUnit) ? supplierUnit : 0),
          currency,
          deliveryShareGBP: new Prisma.Decimal(0),
          lineTotalGBP: new Prisma.Decimal(Number.isFinite(sellTotal) ? sellTotal : 0),
          meta: {
            ...originalMeta,  // Preserve existing meta fields (imageFileId, dimensions, etc.)
            pricingMethod: "markup",
            markupPercent,
            vatPercent,
            sellUnitGBP: Number.isFinite(sellUnit) ? sellUnit : 0,
            sellTotalGBP: Number.isFinite(sellTotal) ? sellTotal : 0,
          } as any,
        },
      });
      created += 1;
    }

    const subtotal = Number(clientQuote.subtotal ?? 0);
    const vatAmount = Number(clientQuote.vat_amount ?? 0);
    const grandTotal = Number(clientQuote.grand_total ?? subtotal + vatAmount);

    // Update quote totals and currency
    const meta0: any = (quote.meta as any) || {};
    const meta = {
      ...(meta0 || {}),
      lastProcessed: {
        finishedAt: new Date().toISOString(),
        subtotal,
        vatAmount,
        grandTotal,
        currency,
        lineCount: created,
      },
    } as any;

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        currency,
        totalGBP: new Prisma.Decimal(Number.isFinite(grandTotal) ? grandTotal : 0),
        meta,
      },
    });

    return res.json({ ok: true, created, totalGBP: grandTotal, currency });
  } catch (e: any) {
    console.error("[/quotes/:id/lines/save-processed] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});
const upload = multer({ storage });

/** GET /quotes */
router.get("/", requireAuth, async (req: any, res) => {
  const tenantId = await getTenantId(req);
  const rows = await prisma.quote.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      totalGBP: true,
      createdAt: true,
      leadId: true,
    },
  });
  res.json(rows);
});

/** POST /quotes { title, leadId? } */
router.post("/", requireAuth, async (req: any, res) => {
  const tenantId = await getTenantId(req);
  const { title, leadId } = req.body || {};
  if (!title) return res.status(400).json({ error: "title_required" });

  const q = await prisma.quote.create({
    data: {
      tenantId,
      title,
      leadId: leadId || null,
      // Sensible defaults; store pricing preference in meta
      markupDefault: new Prisma.Decimal(0.25),
      meta: { pricingMode: "ml" },
    },
  });
  res.json(mapQuoteSourceForResponse(q));
});

/** GET /quotes/:id */
/**
 * GET /quotes/source-profiles
 * Returns list of available quote source profiles from three sources:
 * 1. Static software profiles (from quoteSourceProfiles.ts)
 * 2. Tenant-managed software profiles (from SoftwareProfile table)
 * 3. Suppliers (from Supplier table)
 * Used for quote source classification UI
 */
router.get("/source-profiles", requireAuth, async (req: any, res) => {
  try {
    const tenantId = await getTenantId(req);

    const { quoteSourceProfiles } = await import("../lib/quoteSourceProfiles");

    const staticProfiles = quoteSourceProfiles
      .filter((p: any) => p.type === "software")
      .map((profile: any) => ({
        id: profile.id,
        name: profile.displayName,
        type: "software" as const,
        source: "static" as const,
      }));

    const dbSoftwareProfiles = await prisma.softwareProfile.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });

    const dynamicSoftware = dbSoftwareProfiles.map((p) => ({
      id: `sw_${p.id}`,
      name: p.displayName,
      type: "software" as const,
      source: "tenant" as const,
    }));

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });

    const supplierProfiles = suppliers.map((s) => ({
      id: `sup_${s.id}`,
      name: s.name,
      type: "supplier" as const,
      source: "tenant" as const,
    }));

    return res.json([...staticProfiles, ...dynamicSoftware, ...supplierProfiles]);
  } catch (e: any) {
    console.error("[/quotes/source-profiles] failed:", e?.message || e);
    if (e?.message === "unauthorized") {
      return res.status(401).json({ error: "unauthorized" });
    }
    return res.status(500).json({ error: "internal_error", detail: e?.message });
  }
});

router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const tenantId = await getTenantId(req);
    const id = String(req.params.id);
    let q: any;
    try {
      q = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { lines: true, supplierFiles: true },
      });
    } catch (inner: any) {
      const msg = inner?.message || String(inner);
      // Common production mismatch: schema expects quoteSourceType/supplierProfileId but column absent.
  if (/Unknown column/i.test(msg) || /does(?:n't| not)\s+exist/i.test(msg)) {
        console.warn(`[quotes/:id] Prisma schema mismatch, falling back to raw query: ${msg}`);
        // Raw minimal query without new columns
        const rows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, tenantId, leadId, title, status, currency, exchangeRate, deliveryCost, markupDefault, subtotalMaterialGBP, subtotalLabourGBP, subtotalOtherGBP, totalGBP, proposalPdfUrl, notes, meta, createdAt, updatedAt FROM "Quote" WHERE id = $1 AND tenantId = $2 LIMIT 1`,
          id,
          tenantId,
        );
        q = rows[0] || null;
        if (q) {
          q.quoteSourceType = null;
          q.supplierProfileId = null;
          q.lines = [];
          q.supplierFiles = [];
          q.__partial = true;
        }
      } else {
        throw inner; // rethrow if different error
      }
    }
    if (!q) return res.status(404).json({ error: "not_found" });

    // If we only have partial data, still respond so UI can load gracefully
    if (q.__partial) {
      return res.json(mapQuoteSourceForResponse(q));
    }

    const normalizedQuote = mapQuoteSourceForResponse(q);
    const allFiles = Array.isArray(normalizedQuote?.supplierFiles) ? normalizedQuote.supplierFiles : [];
    const supplierFiles = allFiles.filter((f: any) => String(f.kind) === "SUPPLIER_QUOTE");
    const clientQuoteFiles = allFiles.filter((f: any) => String(f.kind) === "CLIENT_QUOTE");

    return res.json({
      ...normalizedQuote,
      supplierFiles,
      clientQuoteFiles,
    });
  } catch (e: any) {
    console.error("[/quotes/:id] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error", detail: e?.message });
  }
});

/** POST /quotes/:id/files  (multipart form-data: files[]) */
router.post("/:id/files", requireAuth, upload.array("files", 10), async (req: any, res) => {
  const tenantId = await getTenantId(req);
  const id = String(req.params.id);
  const q = await prisma.quote.findFirst({ where: { id, tenantId } });
  if (!q) return res.status(404).json({ error: "not_found" });

  // Auto-detect quote source from first PDF
  let detectedSourceType: string | undefined;
  let detectedProfileId: string | undefined;

  const saved = [];
  for (const f of (req.files as Express.Multer.File[])) {
    // Auto-detect quote source from first PDF
    if (!detectedSourceType && f.mimetype === 'application/pdf') {
      try {
        const { extractFirstPageText } = await import('../lib/pdfMetadata');
        const { autoDetectQuoteSourceProfile } = await import('../lib/quoteSourceProfiles');
        
        const buffer = await fs.promises.readFile(f.path);
        const firstPageText = await extractFirstPageText(buffer);
        const profile = autoDetectQuoteSourceProfile(f.originalname, firstPageText);
        
        if (profile) {
          detectedSourceType = profile.type;
          detectedProfileId = profile.id;
          console.log(`[quotes/:id/files] Auto-detected: ${profile.displayName} (${profile.type})`);
        }
      } catch (error) {
        console.error('[quotes/:id/files] Auto-detection failed:', error);
      }
    }

    const row = await prisma.uploadedFile.create({
      data: {
        tenantId,
        quoteId: id,
        kind: "SUPPLIER_QUOTE",
        name: f.originalname,
        path: path.relative(process.cwd(), f.path),
        mimeType: f.mimetype,
        sizeBytes: f.size,
      },
    });
    saved.push(row);
  }

  // Update quote with detected source type and profile (if detected)
  if (detectedSourceType && detectedProfileId) {
    const dbSourceType = toDbQuoteSourceType(detectedSourceType);
    await prisma.quote.update({
      where: { id },
      data: {
        quoteSourceType: dbSourceType,
        supplierProfileId: detectedProfileId,
      },
    });
  }

  res.json({ 
    ok: true, 
    files: saved,
    detected: detectedSourceType ? {
      sourceType: detectedSourceType,
      profileId: detectedProfileId,
    } : null,
  });
});

/** POST /quotes/:id/client-quote-files  (multipart form-data: files[]) */
router.post("/:id/client-quote-files", requireAuth, upload.array("files", 10), async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = String(req.params.id);
  const q = await prisma.quote.findFirst({ where: { id, tenantId } });
  if (!q) return res.status(404).json({ error: "not_found" });

  const saved = [];
  for (const f of (req.files as Express.Multer.File[])) {
    const row = await prisma.uploadedFile.create({
      data: {
        tenantId,
        quoteId: id,
  // Cast because Prisma generates $Enums.FileKind; the string value is correct
  kind: "CLIENT_QUOTE" as any,
        name: f.originalname,
        path: path.relative(process.cwd(), f.path),
        mimeType: f.mimetype,
        sizeBytes: f.size,
      },
    });
    saved.push(row);
  }

  res.json({ ok: true, files: saved });
});

/**
 * PATCH /quotes/:id/source
 * Body: { sourceType: "supplier" | "software", profileId: string }
 * Update the quote source classification for better parsing
 * Supports prefixed IDs: sw_<id> for software profiles, sup_<id> for suppliers, or static IDs
 */
router.patch("/:id/source", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const q = await prisma.quote.findFirst({ where: { id, tenantId } });
    if (!q) return res.status(404).json({ error: "not_found" });

    const rawSourceType = req.body?.sourceType;
    const rawProfileId = req.body?.profileId;

    let normalizedSource: "supplier" | "software" | null | undefined = undefined;
    if (rawSourceType === null || rawSourceType === "") {
      normalizedSource = null;
    } else if (rawSourceType !== undefined) {
      const parsedSource = normalizeQuoteSourceValue(rawSourceType);
      if (!parsedSource) {
        return res.status(400).json({ error: "invalid_source_type" });
      }
      normalizedSource = parsedSource;
    }

    let resolvedProfileId: string | null | undefined = undefined;
    if (rawProfileId === null || rawProfileId === "") {
      resolvedProfileId = null;
    } else if (rawProfileId !== undefined) {
      if (rawProfileId.startsWith("sw_")) {
        const swId = rawProfileId.slice(3);
        const swProfile = await prisma.softwareProfile.findFirst({
          where: { id: swId, tenantId },
        });
        if (!swProfile) {
          return res.status(400).json({ error: "software_profile_not_found" });
        }
        resolvedProfileId = rawProfileId;
      } else if (rawProfileId.startsWith("sup_")) {
        const supId = rawProfileId.slice(4);
        const supplier = await prisma.supplier.findFirst({
          where: { id: supId, tenantId },
        });
        if (!supplier) {
          return res.status(400).json({ error: "supplier_not_found" });
        }
        resolvedProfileId = rawProfileId;
      } else {
        const { getQuoteSourceProfile } = await import("../lib/quoteSourceProfiles");
        const profile = getQuoteSourceProfile(rawProfileId);
        if (!profile) {
          return res.status(400).json({ error: "invalid_profile_id" });
        }
        resolvedProfileId = rawProfileId;
      }
    }

    const updated = await prisma.quote.update({
      where: { id },
      data: {
        quoteSourceType:
          normalizedSource === undefined
            ? q.quoteSourceType
            : normalizedSource === null
            ? null
            : toDbQuoteSourceType(normalizedSource),
        supplierProfileId:
          resolvedProfileId === undefined ? q.supplierProfileId : resolvedProfileId,
      },
    });

    res.json({ ok: true, quote: mapQuoteSourceForResponse(updated) });
  } catch (e: any) {
    console.error("[/quotes/:id/source] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /quotes/:id/preference
 * Body: { pricingMode: "ml" | "margin", margin?: number }
 * Persists the per-quote pricing preference and optional default margin.
 */
router.patch("/:id/preference", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const q = await prisma.quote.findFirst({ where: { id, tenantId } });
    if (!q) return res.status(404).json({ error: "not_found" });

    const pricingModeRaw = String(req.body?.pricingMode || "").toLowerCase();
    const pricingMode = pricingModeRaw === "ml" ? "ml" : pricingModeRaw === "margin" ? "margin" : null;
    if (!pricingMode) return res.status(400).json({ error: "invalid_pricing_mode" });

    const updates: any = { meta: { ...(q.meta as any || {}), pricingMode } };
    if (req.body?.margin !== undefined) {
      const m = Number(req.body.margin);
      if (Number.isFinite(m) && m >= 0 && m <= 5) {
        updates.markupDefault = new Prisma.Decimal(m);
      }
    }

    const saved = await prisma.quote.update({ where: { id: q.id }, data: updates });
    return res.json({ ok: true, quote: mapQuoteSourceForResponse(saved) });
  } catch (e: any) {
    console.error("[/quotes/:id/preference] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});
/**
 * POST /quotes/:id/parse
 * For each supplier file, generate a signed download URL and forward to /ml/parse-quote.
 * Create QuoteLine rows from parsed output.
 */
router.post("/:id/parse", requireAuth, async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const quoteId = String(req.params.id);
  try {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: { supplierFiles: true },
    });
    if (!quote) return res.status(404).json({ error: "not_found" });

    const supplierTemplates = quote.supplierProfileId
      ? await prisma.pdfLayoutTemplate.findMany({
          where: { supplierProfileId: quote.supplierProfileId },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            supplierProfileId: true,
            pageCount: true,
            annotations: {
              orderBy: [{ page: "asc" }, { y: "asc" }, { x: "asc" }],
            },
          },
        })
      : [];

    const templateRecords: LayoutTemplateRecord[] = supplierTemplates
      .map((template) => ({
        id: template.id,
        name: template.name,
        supplierProfileId: template.supplierProfileId ?? undefined,
        annotations: normaliseAnnotations(template.annotations),
        pageCount: template.pageCount ?? undefined,
      }))
      .filter((template) => template.annotations.length);

    const API_BASE = (
      process.env.APP_API_URL ||
      process.env.API_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${process.env.PORT || 4000}`
    ).replace(/\/$/, "");

    const timeoutRaw = Number(process.env.ML_TIMEOUT_MS);
    const TIMEOUT_MS = Math.min(Math.max(Number.isFinite(timeoutRaw) ? Number(timeoutRaw) : (process.env.NODE_ENV === "production" ? 15000 : 20000), 5000), 25000);
    const HEAD_TIMEOUT_MS = 5000;

    const forceFallback =
      req.body?.forceFallback === true ||
      req.body?.forceFallback === "true" ||
      req.body?.forceFallback === 1 ||
      String(req.query.forceFallback ?? "").toLowerCase() === "1" ||
      String(req.query.forceFallback ?? "").toLowerCase() === "true";

    const doParse = async () => {
  const created: any[] = [];
  const fails: Array<{ fileId: string; name?: string | null; status?: number; error?: any }> = [];
  const summaries: any[] = [];
  const warnings = new Set<string>();
  let fallbackUsed = 0;
  const fallbackScoreTotals = { kept: 0, discarded: 0 };
  let sawFallbackScores = false;
      let aggregatedTemplateMeta: TemplateParseMeta | null = null;
      const parsedLinesForDb: Prisma.ParsedSupplierLineCreateManyInput[] = [];

      const filesToParse = [...quote.supplierFiles]
        .filter((x) => /pdf$/i.test(x.mimeType || "") || /\.pdf$/i.test(x.name || ""))
        .sort((a: any, b: any) => new Date(b.uploadedAt || b.createdAt || 0).getTime() - new Date(a.uploadedAt || a.createdAt || 0).getTime())
        .slice(0, 3);

      if (filesToParse.length === 0) {
        return { error: "no_files", created: 0, fails: [], warnings: [], fallbackUsed: 0, summaries: [], timeoutMs: TIMEOUT_MS } as const;
      }

      for (const f of filesToParse) {
        const token = jwt.sign({ t: tenantId, q: quote.id }, env.APP_JWT_SECRET, { expiresIn: "30m" });
        const url = `${API_BASE}/files/${encodeURIComponent(f.id)}?jwt=${encodeURIComponent(token)}`;
        console.log(`[parse] quote ${quote.id} file ${f.id} signed URL length=${url.length}`);

  const info: any = { fileId: f.id, name: f.name, headStatus: null, usedFallback: false };
        const mlErrors: any[] = [];
        let latestMlPayload: any = null;
        let latencyMs: number | null = null;

        if (!forceFallback) {
          try {
            const ctl = new AbortController();
            const timer = setTimeout(() => ctl.abort(), HEAD_TIMEOUT_MS);
            const headResp = await fetch(url, { method: "HEAD", signal: ctl.signal as any });
            clearTimeout(timer);
            info.headStatus = headResp.status;
            if (!headResp.ok) {
              warnings.add(`Signed URL head check failed (${headResp.status}) for ${f.name || f.id}`);
            }
          } catch (err: any) {
            warnings.add(`Signed URL head request failed for ${f.name || f.id}: ${err?.message || err}`);
          }
        }

        const abs = path.isAbsolute(f.path) ? f.path : path.join(process.cwd(), f.path);
        let buffer: Buffer;
        try {
          buffer = await fs.promises.readFile(abs);
        } catch (err: any) {
          fails.push({ fileId: f.id, name: f.name, status: 404, error: { error: "file_read_failed", detail: err?.message || err } });
          warnings.add(`Unable to read supplier file ${f.name || f.id}`);
          summaries.push({ ...info, error: "file_read_failed" });
          continue;
        }

        let parseResult: SupplierParseResult | null = null;
        const supplierHint =
          (typeof req.body?.supplierHint === "string" && req.body.supplierHint) ||
          (typeof quote.title === "string" ? quote.title : undefined);

        if (templateRecords.length) {
          try {
            const templateOutcome = await tryTemplateParsers(buffer, {
              templates: templateRecords,
              supplierHint: supplierHint ?? f.name ?? undefined,
              currencyHint: quote.currency || "GBP",
            });
            if (templateOutcome) {
              info.template = templateOutcome.meta;
              if (!aggregatedTemplateMeta || aggregatedTemplateMeta.method !== "template") {
                aggregatedTemplateMeta = templateOutcome.meta;
              }
              if (templateOutcome.meta.method === "template" && templateOutcome.result) {
                parseResult = templateOutcome.result;
              }
            }
          } catch (err: any) {
            console.warn(`[parse] Template parser failed for ${f.name || f.id}:`, err?.message || err);
          }
        }

        if (!parseResult) {
          try {
            const hybrid = await parseSupplierPdf(buffer, {
              supplierHint: supplierHint ?? f.name ?? undefined,
              currencyHint: quote.currency || "GBP",
              supplierProfileId: quote.supplierProfileId ?? undefined,
            });
            parseResult = hybrid;
            info.hybrid = { used: true, confidence: hybrid.confidence, stages: hybrid.usedStages };
            if (hybrid.warnings) hybrid.warnings.forEach((w: string) => warnings.add(w));
          } catch (err: any) {
            info.hybrid = { used: false, error: err?.message || String(err) };
            warnings.add(`Hybrid parser failed for ${f.name || f.id}: ${err?.message || err}`);
          }
        } else {
          info.hybrid = { used: false, skipped: "template" };
        }

        const mlHeaders: Record<string, string> = {};
        if (req.headers.authorization) {
          mlHeaders.Authorization = String(req.headers.authorization);
        }

        if ((!parseResult || parseResult.lines.length === 0) && !forceFallback) {
          const mlSigned = await callMlWithSignedUrl({
            url,
            filename: f.name || undefined,
            timeoutMs: TIMEOUT_MS,
            headers: mlHeaders,
          });
          info.mlSigned = { status: mlSigned.status, ok: mlSigned.ok, tookMs: mlSigned.tookMs };
          console.log(`[parse] quote ${quote.id} file ${f.id} ML signed status=${mlSigned.status} ok=${mlSigned.ok} took=${mlSigned.tookMs}ms`);
          if (mlSigned.ok) {
            const normalised = normaliseMlPayload(mlSigned.data);
            parseResult = normalised;
            latestMlPayload = mlSigned.data;
            latencyMs = mlSigned.tookMs ?? null;
            if (!normalised.lines.length) {
              mlErrors.push({ stage: "signed_url", error: "no_lines" });
            }
          } else {
            mlErrors.push({ stage: "signed_url", error: mlSigned.error, status: mlSigned.status, detail: mlSigned.detail });
          }

          if ((!parseResult || parseResult.lines.length === 0) && buffer) {
            const upload = await callMlWithUpload({
              buffer,
              filename: f.name || "supplier-quote.pdf",
              timeoutMs: TIMEOUT_MS,
              headers: mlHeaders,
            });
            info.mlUpload = { status: upload.status, ok: upload.ok, tookMs: upload.tookMs };
            console.log(`[parse] quote ${quote.id} file ${f.id} ML upload status=${upload.status} ok=${upload.ok} took=${upload.tookMs}ms`);
            if (upload.ok) {
              const normalisedUpload = normaliseMlPayload(upload.data);
              parseResult = normalisedUpload;
              latestMlPayload = upload.data;
              latencyMs = upload.tookMs ?? null;
              if (!normalisedUpload.lines.length) {
                mlErrors.push({ stage: "upload", error: "no_lines" });
              }
            } else {
              mlErrors.push({ stage: "upload", error: upload.error, status: upload.status, detail: upload.detail });
            }
          }
        }

        let fallbackError: string | null = null;
        if (!parseResult || parseResult.lines.length === 0) {
          info.usedFallback = true;
          fallbackUsed += 1;
          try {
            const fallback = await fallbackParseSupplierPdf(buffer);
            parseResult = fallback;
            console.warn(
              `[parse] quote ${quote.id} file ${f.id} using fallback parser (mlErrors=${mlErrors.length})`,
            );
            if (fallback.warnings) fallback.warnings.forEach((w) => warnings.add(w));
            if (mlErrors.length) {
              warnings.add(`ML parser failed for ${f.name || f.id}; fallback parser applied.`);
            }
          } catch (err: any) {
            fallbackError = err?.message || "fallback_failed";
          }
        } else if (parseResult.warnings) {
          parseResult.warnings.forEach((w) => warnings.add(w));
        }

        if (fallbackError) {
          warnings.add(`Fallback parser failed for ${f.name || f.id}: ${fallbackError}`);
          fails.push({
            fileId: f.id,
            name: f.name,
            status: 422,
            error: {
              error: "fallback_failed",
              detail: fallbackError,
              mlErrors,
            },
          });
          summaries.push({
            ...info,
            error: "fallback_failed",
            fallbackError,
            warnings: [`Fallback parser failed: ${fallbackError}`],
          });
          continue;
        }

  info.warnings = parseResult?.warnings || [];
  if (parseResult?.confidence != null) info.confidence = parseResult.confidence;
  if (parseResult?.detected_totals) info.detected_totals = parseResult.detected_totals;
  if (parseResult?.quality) info.quality = parseResult.quality;
        const cleanerMeta = normaliseParseMeta(parseResult?.meta);
        if (cleanerMeta) {
          info.cleaner = cleanerMeta;
          const keptValue =
            typeof cleanerMeta?.fallbackScored?.kept === "number" && Number.isFinite(cleanerMeta.fallbackScored.kept)
              ? cleanerMeta.fallbackScored.kept
              : null;
          const discardedValue =
            typeof cleanerMeta?.fallbackScored?.discarded === "number" &&
            Number.isFinite(cleanerMeta.fallbackScored.discarded)
              ? cleanerMeta.fallbackScored.discarded
              : null;
          if (keptValue != null || discardedValue != null) {
            fallbackScoreTotals.kept += keptValue ?? 0;
            fallbackScoreTotals.discarded += discardedValue ?? 0;
            sawFallbackScores = true;
          }
        }
        if (mlErrors.length) info.mlErrors = mlErrors;

        const usedStagesArr = Array.isArray(parseResult?.usedStages)
          ? (parseResult?.usedStages as ParserStageName[]).filter(
              (stage): stage is ParserStageName => typeof stage === "string",
            )
          : [];
        info.usedStages = usedStagesArr;
        info.usedOcr = usedStagesArr.includes("ocr");

        const hashSource = buffer ? buffer : Buffer.from(url);
        const inputHash = sha256(tenantId, ":", quote.id, ":", f.id, ":", hashSource);

        if (!parseResult || parseResult.lines.length === 0) {
          const failureReason = parseResult?.error || (mlErrors[0]?.error as string) || "no_lines_detected";
          fails.push({
            fileId: f.id,
            name: f.name,
            status: 422,
            error: {
              error: failureReason,
              mlErrors,
              warnings: parseResult?.warnings,
            },
          });
          summaries.push(info);
          await logInferenceEvent({
            tenantId,
            model: "supplier_parser",
            modelVersionId: "parse-error",
            inputHash,
            outputJson: {
              error: failureReason,
              warnings: parseResult?.warnings,
              mlErrors,
            },
            latencyMs: latencyMs ?? undefined,
            meta: {
              quoteId: quote.id,
              fileId: f.id,
              fallbackUsed: info.usedFallback ?? false,
              usedStages: usedStagesArr,
              usedOcr: info.usedOcr ?? false,
              status: "error",
            },
          });
          continue;
        }

        const currency = normalizeCurrency(parseResult.currency || quote.currency || "GBP");
        const supplier = parseResult.supplier || undefined;
        const usedStages = Array.isArray(parseResult.usedStages)
          ? parseResult.usedStages.join(",")
          : info.usedFallback
          ? "fallback"
          : null;

        const modelVersionId = extractModelVersionId(latestMlPayload) ||
          (info.usedFallback ? `fallback-${new Date().toISOString().slice(0, 10)}` : `external-${new Date().toISOString().slice(0, 10)}`);
        const inferredConfidence =
          safeNumber(parseResult.confidence) ??
          safeNumber(latestMlPayload?.confidence) ??
          null;

        // STEP: Extract images from PDF and prepare for mapping to lines
        const uploadDir = process.env.UPLOAD_DIR 
          ? (path.isAbsolute(process.env.UPLOAD_DIR) ? process.env.UPLOAD_DIR : path.join(process.cwd(), process.env.UPLOAD_DIR))
          : path.join(process.cwd(), "uploads");
        
        let extractedImages: Array<{ fileId: string; page: number; indexOnPage: number }> = [];
        try {
          const { extractAndSaveImagesFromPdf } = await import("../lib/pdf/extractImages");
          extractedImages = await extractAndSaveImagesFromPdf(buffer, tenantId, quote.id, uploadDir);
          if (extractedImages.length > 0) {
            console.log(`[parse] Extracted ${extractedImages.length} images from PDF ${f.name || f.id}`);
          }
        } catch (err: any) {
          console.warn(`[parse] Image extraction failed for ${f.name || f.id}:`, err.message);
          warnings.add(`Image extraction failed: ${err.message}`);
        }

        // STEP: Create quote lines (we'll map images after all lines are created)
        const tempLineInfo: Array<{ id: string; page: number | null }> = [];
        
        let lineIndex = 0;
        for (const ln of parseResult.lines) {
          lineIndex += 1;
          const description = String(ln.description || `${f.name || "Line"} ${lineIndex}`);
          // Quantities & prices can arrive under different keys and sometimes as formatted strings.
          // Use robust pickers with sensible fallbacks to avoid zeroing real values.
          const pickedQty = pickQty(ln);
          const qty = Number.isFinite(Number(pickedQty)) && Number(pickedQty) > 0 ? Number(pickedQty) : 1;
          let unitPrice = pickUnitCost(ln);
          let lineTotalParsed = pickLineTotal(ln);
          if ((unitPrice == null || !(unitPrice > 0)) && lineTotalParsed != null && qty > 0) {
            unitPrice = lineTotalParsed / qty;
          }
          if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice < 0) unitPrice = 0;

          const linePage = typeof (ln as any)?.page === 'number' ? (ln as any).page : null;

          const meta: any = {
            source: info.usedFallback ? "fallback-parser" : "ml-parse",
            raw: ln,
            parsed: parseResult,
            fallback: info.usedFallback,
            confidence: parseResult.confidence ?? null,
            // Image extraction data
            imageIndex: typeof (ln as any)?.imageIndex === 'number' ? (ln as any).imageIndex : undefined,
            imageDataUrl: typeof (ln as any)?.imageDataUrl === 'string' ? (ln as any).imageDataUrl : undefined,
            // Enhanced: Structured product data
            productType: typeof (ln as any)?.productType === 'string' ? (ln as any).productType : undefined,
            wood: typeof (ln as any)?.wood === 'string' ? (ln as any).wood : undefined,
            finish: typeof (ln as any)?.finish === 'string' ? (ln as any).finish : undefined,
            glass: typeof (ln as any)?.glass === 'string' ? (ln as any).glass : undefined,
            dimensions: typeof (ln as any)?.dimensions === 'string' ? (ln as any).dimensions : undefined,
            area: typeof (ln as any)?.area === 'string' ? (ln as any).area : undefined,
          };

          const row = await prisma.quoteLine.create({
            data: {
              quoteId: quote.id,
              supplier: supplier as any,
              sku: undefined,
              description,
              qty,
              unitPrice: new Prisma.Decimal(unitPrice),
              currency,
              deliveryShareGBP: new Prisma.Decimal(0),
              lineTotalGBP: new Prisma.Decimal(0),
              meta,
            },
          });
          created.push(row);
          tempLineInfo.push({ id: row.id, page: linePage });

          // Persist a normalised ParsedSupplierLine row with resilient numeric mapping.
          parsedLinesForDb.push({
            tenantId,
            quoteId: quote.id,
            page: (ln as any)?.page ?? null,
            rawText: String((ln as any)?.rawText ?? description ?? ""),
            description: description ?? null,
            // Numeric field fallbacks:
            //  - qty: qty | quantity
            //  - costUnit: costUnit | unit_price | unitPrice | price | unit_cost | price_ex_vat
            //  - lineTotal: lineTotal | line_total | total | price_ex_vat | amount | ex_vat_total
            qty: ((): number | null => {
              const q = pickQty(ln);
              return Number.isFinite(Number(q)) ? Number(q) : null;
            })(),
            costUnit: ((): number | null => {
              const u = pickUnitCost(ln);
              return Number.isFinite(Number(u)) ? Number(u) : null;
            })(),
            lineTotal: ((): number | null => {
              const t = pickLineTotal(ln);
              return Number.isFinite(Number(t)) ? Number(t) : null;
            })(),
            currency,
            supplier: supplier ?? null,
            confidence: safeNumber((ln as any)?.confidence) ?? inferredConfidence,
            usedStages,
            // Image extraction fields
            imageIndex: typeof (ln as any)?.imageIndex === 'number' ? (ln as any).imageIndex : null,
            imageRef: typeof (ln as any)?.imageRef === 'string' ? (ln as any).imageRef : null,
          });
        }

        // STEP: Map extracted images to quote lines
        if (extractedImages.length > 0 && tempLineInfo.length > 0) {
          try {
            const { mapImagesToLines } = await import("../lib/pdf/extractImages");
            const imageMapping = mapImagesToLines(tempLineInfo, extractedImages);
            
            // Update quote lines with imageFileId in meta
            for (const [lineId, imageFileId] of Object.entries(imageMapping)) {
              const line = created.find(l => l.id === lineId);
              if (line) {
                const existingMeta = (line.meta as any) || {};
                await prisma.quoteLine.update({
                  where: { id: lineId },
                  data: {
                    meta: {
                      ...existingMeta,
                      imageFileId,
                    },
                  },
                });
              }
            }
            
            console.log(`[parse] Mapped ${Object.keys(imageMapping).length} images to quote lines`);
          } catch (err: any) {
            console.warn(`[parse] Image mapping failed: ${err.message}`);
            warnings.add(`Image mapping failed: ${err.message}`);
          }
        }

        info.lineCount = parseResult.lines.length;
        info.currency = currency;
        info.supplier = supplier;
        summaries.push(info);

        // Clean up warnings for UI: if we ended up with usable lines, hide misleading
        // "no lines" warnings from early stages and, where applicable, replace with
        // a clearer informational note.
        const hadLines = Array.isArray(parseResult?.lines) && parseResult.lines.length > 0;
        const usedStagesArr2 = Array.isArray(parseResult?.usedStages) ? parseResult.usedStages : [];
        const parserWarns = Array.isArray(parseResult?.warnings) ? [...parseResult.warnings] : [];
        const hadNoLinesWarnings = parserWarns.some((w) => /no\s+lines?/i.test(w));
        let finalWarnings = parserWarns;
        if (hadLines && hadNoLinesWarnings) {
          finalWarnings = parserWarns.filter((w) => !/no\s+lines?/i.test(w));
          const fallbackMsg = "Structured parser returned no lines; using fallback parser output.";
          if (!finalWarnings.includes(fallbackMsg)) finalWarnings.push(fallbackMsg);
        }

        const sanitizedOutput = {
          ...sanitiseParseResult(parseResult, supplier, currency),
          warnings: finalWarnings,
        };
        await logInferenceEvent({
          tenantId,
          model: "supplier_parser",
          modelVersionId,
          inputHash,
          outputJson: sanitizedOutput,
          confidence: inferredConfidence ?? null,
          latencyMs: latencyMs ?? undefined,
          meta: {
            quoteId: quote.id,
            fileId: f.id,
            fallbackUsed: info.usedFallback ?? false,
            usedStages: usedStagesArr,
            usedOcr: info.usedOcr ?? false,
            status: "ok",
          },
        });

        await logInsight({
          tenantId,
          module: "supplier_parser",
          inputSummary: `quote:${quote.id}:parse:${f.id}`,
          decision: modelVersionId,
          confidence: inferredConfidence ?? null,
          userFeedback: {
            kind: "supplier_parser",
            quoteId: quote.id,
            fileId: f.id,
            modelVersionId,
            latencyMs,
            lineCount: parseResult.lines.length,
          },
        });
      }

  const warningsArr = [...warnings];
  const aggregatedQuality = summariseParseQuality(summaries);
      if (created.length === 0) {
        await maybeTriggerFallbackAlert(fallbackUsed);
        return {
          error: "parse_failed",
          created: 0,
          fails,
          warnings: warningsArr,
          fallbackUsed,
          summaries,
          timeoutMs: TIMEOUT_MS,
          message: fallbackUsed ? "ML could not parse the PDF. Fallback parser attempted but produced no lines." : undefined,
          quality: aggregatedQuality,
          template: aggregatedTemplateMeta ?? undefined,
        } as const;
      }

      if (parsedLinesForDb.length > 0) {
        try {
          await prisma.$transaction([
            prisma.parsedSupplierLine.deleteMany({ where: { tenantId, quoteId: quote.id } }),
            prisma.parsedSupplierLine.createMany({ data: parsedLinesForDb }),
          ]);
        } catch (err: any) {
          console.warn(
            `[parse] quote ${quote.id} failed to persist ParsedSupplierLine:`,
            err?.message || err,
          );
        }
      }

      await maybeTriggerFallbackAlert(fallbackUsed);
      // As a final pass, reduce noisy "no lines" warnings if we created any rows.
      let finalWarnings = warningsArr;
      if (created.length > 0) {
        const hadNoLines = warningsArr.some((w) => /no\s+lines?/i.test(w));
        if (hadNoLines) {
          finalWarnings = warningsArr.filter((w) => !/no\s+lines?/i.test(w));
          if (!finalWarnings.includes("Structured parser returned no lines; using fallback parser output.")) {
            finalWarnings.push("Structured parser returned no lines; using fallback parser output.");
          }
        }
      }
      return {
        ok: true,
        created: created.length,
        fails,
        fallbackUsed,
        summaries,
        warnings: finalWarnings,
        timeoutMs: TIMEOUT_MS,
        message: fallbackUsed ? "ML could not parse some files. Fallback parser applied." : undefined,
        quality: aggregatedQuality,
        fallbackScored: sawFallbackScores ? fallbackScoreTotals : undefined,
        template: aggregatedTemplateMeta ?? undefined,
      } as const;
    };

    const preferAsync = process.env.NODE_ENV === "production" && String(req.query.async ?? "1") !== "0";
    if (preferAsync) {
      try {
        const startedAt = new Date().toISOString();
        const meta0: any = (quote.meta as any) || {};
        await prisma.quote.update({
          where: { id: quote.id },
          data: { meta: { ...(meta0 || {}), lastParse: { state: "running", startedAt } } as any },
        } as any);
      } catch {}

      setImmediate(async () => {
        try {
          const out = await doParse();
          const finishedAt = new Date().toISOString();
          try {
            const meta1: any = (quote.meta as any) || {};
            await prisma.quote.update({
              where: { id: quote.id },
              data: {
                meta: {
                  ...(meta1 || {}),
                  lastParse: (out as any).error
                    ? { state: "error", finishedAt, ...out }
                    : { state: "ok", finishedAt, ...out },
                } as any,
              },
            } as any);
          } catch {}
          if ((out as any).error) {
            console.warn(`[parse async] quote ${quoteId} failed:`, out);
            await sendParserErrorAlert(tenantId, quote.id, String((out as any).error || "unknown"));
          }
        } catch (e: any) {
          console.error(`[parse async] quote ${quoteId} crashed:`, e?.message || e);
          try {
            await prisma.quote.update({
              where: { id: quote.id },
              data: {
                meta: {
                  ...((quote.meta as any) || {}),
                  lastParse: {
                    state: "error",
                    finishedAt: new Date().toISOString(),
                    error: String(e?.message || e),
                  },
                } as any,
              },
            } as any);
          } catch {}
          await sendParserErrorAlert(tenantId, quote.id, String(e?.message || e));
        }
      });
      return res.json({ ok: true, async: true });
    }

    const out = await doParse();
    if ((out as any).error) {
      await sendParserErrorAlert(tenantId, quote.id, String((out as any).error || "unknown"));
      const status = (out as any).error === "no_files" ? 400 : 502;
      return res.status(status).json(out);
    }
    return res.json(out);
  } catch (e: any) {
    console.error("[/quotes/:id/parse] failed:", e?.message || e);
    await sendParserErrorAlert(tenantId, quoteId, String(e?.message || e));
    return res.status(500).json({ error: "internal_error" });
  }
});
/**
 * POST /quotes/:id/render-pdf
 * Renders a beautiful PDF proposal for the quote lines using Puppeteer and stores it as an UploadedFile.
 * Returns: { ok: true, fileId, name }
 */
router.post("/:id/render-pdf", requireAuth, async (req: any, res) => {
  try {
    // Dynamically load puppeteer to avoid type issues if not installed yet
    // @ts-ignore
    let puppeteer: any;
    try {
      puppeteer = require("puppeteer");
    } catch (err: any) {
      console.error("[/quotes/:id/render-pdf] puppeteer missing:", err?.message || err);
      return res
        .status(500)
        .json({ error: "render_failed", reason: "puppeteer_not_installed" });
    }

    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);

    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
      include: { lines: true, tenant: true, lead: true },
    });
    if (!quote) return res.status(404).json({ error: "not_found" });

    const ts = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const quoteDefaults: any = (ts?.quoteDefaults as any) || {};
    const cur = normalizeCurrency(quote.currency || quoteDefaults?.currency || "GBP");
    const sym = currencySymbol(cur);
    const vatRate = Number(quoteDefaults?.vatRate ?? 0.2);
    const showVat = quoteDefaults?.showVat !== false; // default true for UK
    
    // Log lead data for debugging
    if (!quote.lead || !quote.leadId) {
      console.warn(`[render-pdf] Quote ${id} has no lead attached (leadId: ${quote.leadId})`);
    } else {
      console.log(`[render-pdf] Using lead data: contactName=${quote.lead.contactName}, email=${quote.lead.email}`);
    }
    
    const client = quote.lead?.contactName || quote.lead?.email || "Client";
    const title =
      quote.title || `Estimate for ${client}`;

    // Compute totals - CRITICAL: Use meta.sellTotalGBP when available
    const marginDefault = Number(
      quote.markupDefault ?? quoteDefaults?.defaultMargin ?? 0.25,
    );
    const rowsForTotals = quote.lines.map((ln) => {
      const qty = Number(ln.qty || 1);
      const metaAny: any = (ln.meta as any) || {};
      
      // CRITICAL FIX: If sellTotalGBP exists in meta, use it directly
      let total: number;
      if (metaAny?.sellTotalGBP != null && Number.isFinite(Number(metaAny.sellTotalGBP))) {
        total = Number(metaAny.sellTotalGBP);
      } else if (metaAny?.sellUnitGBP != null && Number.isFinite(Number(metaAny.sellUnitGBP))) {
        total = Number(metaAny.sellUnitGBP) * qty;
      } else {
        // Fallback: unitPrice is in POUNDS, apply margin
        const unitPriceGBP = Number(ln.unitPrice || 0);
        const sellUnit = unitPriceGBP * (1 + marginDefault);
        total = sellUnit * qty;
      }
      
      return { total };
    });

    let subtotal = rowsForTotals.reduce(
      (s, r) => s + (Number.isFinite(r.total) ? r.total : 0),
      0,
    );

    // Fallback to quote.totalGBP if lines aren't priced yet
    if (!(subtotal > 0)) {
      const fallbackSubtotal = Number(quote.totalGBP ?? 0);
      if (Number.isFinite(fallbackSubtotal) && fallbackSubtotal > 0) {
        subtotal = fallbackSubtotal;
      }
    }

    const vatAmount = showVat ? subtotal * vatRate : 0;
    const totalGBP = subtotal + vatAmount;
    
    // Safety check: Log warning if totals seem unrealistic
    if (totalGBP > 10000000 || !Number.isFinite(totalGBP)) {
      console.warn("[/quotes/:id/render-pdf] Suspicious total detected:", {
        subtotal,
        vatAmount,
        totalGBP,
        quoteId: quote.id,
        lineCount: quote.lines.length
      });
    }

    // Fetch image URLs for line items
    const imageUrlMap = await fetchLineImageUrls(quote.lines, tenantId);
    
    // 🔹 Build Soho-style multi-page proposal HTML via shared helper
    const html = buildQuoteProposalHtml({
      quote,
      tenantSettings: ts,
      currencyCode: cur,
      currencySymbol: sym,
      totals: { subtotal, vatAmount, totalGBP, vatRate, showVat },
      imageUrlMap,
    });

    let browser: any;
    let firstLaunchError: any;
    try {
      // Prefer Puppeteer's resolved executable if available; fall back to env
      const resolvedExec =
        typeof puppeteer.executablePath === "function"
          ? puppeteer.executablePath()
          : undefined;
      const execPath = resolvedExec || process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--single-process",
          "--no-zygote",
        ],
        executablePath: execPath,
      });
    } catch (err: any) {
      firstLaunchError = err;
      console.warn(
        "[/quotes/:id/render-pdf] puppeteer launch failed; trying @sparticuz/chromium fallback:",
        err?.message || err,
      );
      try {
        // Lazy-load Sparticuz Chromium which bundles a compatible binary for serverless/container envs
        const chromium = require("@sparticuz/chromium");
        const execPath2 = await chromium.executablePath();
        browser = await puppeteer.launch({
          headless: chromium.headless !== undefined ? chromium.headless : true,
          args: chromium.args ?? ["--no-sandbox", "--disable-setuid-sandbox"],
          executablePath: execPath2,
          defaultViewport: chromium.defaultViewport ?? { width: 1280, height: 800 },
          ignoreHTTPSErrors: true,
        });
      } catch (fallbackErr: any) {
        console.error(
          "[/quotes/:id/render-pdf] chromium fallback launch failed:",
          fallbackErr?.message || fallbackErr,
        );
        return res.status(500).json({
          error: "render_failed",
          reason: "puppeteer_launch_failed",
          detail: {
            primary: String(firstLaunchError?.message || firstLaunchError || "unknown"),
            fallback: String(fallbackErr?.message || fallbackErr || "unknown"),
          },
        });
      }
    }

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
      });
      await browser.close();
    } catch (err: any) {
      try {
        if (browser) await browser.close();
      } catch {}
      console.error(
        "[/quotes/:id/render-pdf] pdf generation failed:",
        err?.message || err,
      );
      return res
        .status(500)
        .json({ error: "render_failed", reason: "pdf_generation_failed" });
    }

    const filenameSafe = (title || `Quote ${quote.id}`).replace(/[^\w.\-]+/g, "_");
    // Truncate filename to prevent ENAMETOOLONG errors (max 100 chars before extension)
    const truncatedName = filenameSafe.length > 100 ? filenameSafe.substring(0, 100) : filenameSafe;
    const filename = `${truncatedName}.pdf`;
    const filepath = path.join(UPLOAD_DIR, `${Date.now()}__${filename}`);
    try {
      fs.writeFileSync(filepath, pdfBuffer);
    } catch (err: any) {
      console.error("[/quotes/:id/render-pdf] write file failed:", err?.message || err);
      return res
        .status(500)
        .json({ error: "render_failed", reason: "write_failed" });
    }

    const fileRow = await prisma.uploadedFile.create({
      data: {
        tenantId,
        quoteId: quote.id,
        kind: "OTHER",
        name: filename,
        path: path.relative(process.cwd(), filepath),
        mimeType: "application/pdf",
        sizeBytes: pdfBuffer.length,
      },
    });

    // Generate signed URL for the PDF
    const API_BASE = (
      process.env.APP_API_URL ||
      process.env.API_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${process.env.PORT || 4000}`
    ).replace(/\/$/, "");
    
    const token = jwt.sign({ t: tenantId, q: quote.id }, env.APP_JWT_SECRET, { expiresIn: "7d" });
    const proposalPdfUrl = `${API_BASE}/files/${encodeURIComponent(fileRow.id)}?jwt=${encodeURIComponent(token)}`;

    const meta0: any = (quote.meta as any) || {};
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        proposalPdfUrl: null,
        meta: { 
          ...(meta0 || {}), 
          proposalFileId: fileRow.id,
          proposalPdfUrl,
        } as any,
      } as any,
    });

    return res.json({ 
      ok: true, 
      fileId: fileRow.id, 
      name: fileRow.name,
      proposalPdfUrl,
    });
  } catch (e: any) {
    console.error("[/quotes/:id/render-pdf] failed:", e?.message || e);
    return res
      .status(500)
      .json({ error: "render_failed", reason: "unknown" });
  }
});

/**
 * POST /quotes/:id/render-proposal
 * Alias for /render-pdf - generates and saves the beautiful proposal PDF
 */
router.post("/:id/render-proposal", requireAuth, async (req: any, res) => {
  try {
    // Dynamically load puppeteer to avoid type issues if not installed yet
    // @ts-ignore
    let puppeteer: any;
    try {
      puppeteer = require("puppeteer");
    } catch (err: any) {
      console.error("[/quotes/:id/render-proposal] puppeteer missing:", err?.message || err);
      return res
        .status(500)
        .json({ error: "render_failed", reason: "puppeteer_not_installed" });
    }

    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);

    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
      include: { lines: true, tenant: true, lead: true },
    });
    if (!quote) return res.status(404).json({ error: "not_found" });

    const ts = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const quoteDefaults: any = (ts?.quoteDefaults as any) || {};
    const cur = normalizeCurrency(quote.currency || quoteDefaults?.currency || "GBP");
    const sym = currencySymbol(cur);
    const vatRate = Number(quoteDefaults?.vatRate ?? 0.2);
    const showVat = quoteDefaults?.showVat !== false;
    const client = quote.lead?.contactName || quote.lead?.email || "Client";
    const title =
      quote.title || `Estimate for ${client}`;

    const marginDefault = Number(
      quote.markupDefault ?? quoteDefaults?.defaultMargin ?? 0.25,
    );
    const rowsForTotals = quote.lines.map((ln) => {
      const qty = Number(ln.qty || 1);
      const metaAny: any = (ln.meta as any) || {};
      
      // CRITICAL FIX: If sellTotalGBP exists in meta, use it directly
      let total: number;
      if (metaAny?.sellTotalGBP != null && Number.isFinite(Number(metaAny.sellTotalGBP))) {
        total = Number(metaAny.sellTotalGBP);
      } else if (metaAny?.sellUnitGBP != null && Number.isFinite(Number(metaAny.sellUnitGBP))) {
        total = Number(metaAny.sellUnitGBP) * qty;
      } else {
        // Fallback: unitPrice is in POUNDS, apply margin
        const unitPriceGBP = Number(ln.unitPrice || 0);
        const sellUnit = unitPriceGBP * (1 + marginDefault);
        total = sellUnit * qty;
      }
      
      return { total };
    });

    let subtotal = rowsForTotals.reduce(
      (s, r) => s + (Number.isFinite(r.total) ? r.total : 0),
      0,
    );

    if (!(subtotal > 0)) {
      const fallbackSubtotal = Number(quote.totalGBP ?? 0);
      if (Number.isFinite(fallbackSubtotal) && fallbackSubtotal > 0) {
        subtotal = fallbackSubtotal;
      }
    }

    const vatAmount = showVat ? subtotal * vatRate : 0;
    const totalGBP = subtotal + vatAmount;
    
    // Safety check: Log warning if totals seem unrealistic
    if (totalGBP > 10000000 || !Number.isFinite(totalGBP)) {
      console.warn("[/quotes/:id/render-proposal] Suspicious total detected:", {
        subtotal,
        vatAmount,
        totalGBP,
        quoteId: quote.id,
        lineCount: quote.lines.length
      });
    }

    // Fetch image URLs for line items
    const imageUrlMap = await fetchLineImageUrls(quote.lines, tenantId);
    
    const html = buildQuoteProposalHtml({
      quote,
      tenantSettings: ts,
      currencyCode: cur,
      currencySymbol: sym,
      totals: { subtotal, vatAmount, totalGBP, vatRate, showVat },
      imageUrlMap,
    });

    let browser: any;
    let firstLaunchError: any;
    try {
      const resolvedExec =
        typeof puppeteer.executablePath === "function"
          ? puppeteer.executablePath()
          : undefined;
      const execPath = resolvedExec || process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--single-process",
          "--no-zygote",
        ],
        executablePath: execPath,
      });
    } catch (err: any) {
      firstLaunchError = err;
      console.warn(
        "[/quotes/:id/render-proposal] puppeteer launch failed; trying @sparticuz/chromium fallback:",
        err?.message || err,
      );
      try {
        const chromium = require("@sparticuz/chromium");
        const execPath2 = await chromium.executablePath();
        browser = await puppeteer.launch({
          headless: chromium.headless !== undefined ? chromium.headless : true,
          args: chromium.args ?? ["--no-sandbox", "--disable-setuid-sandbox"],
          executablePath: execPath2,
          defaultViewport: chromium.defaultViewport ?? { width: 1280, height: 800 },
          ignoreHTTPSErrors: true,
        });
      } catch (fallbackErr: any) {
        console.error(
          "[/quotes/:id/render-proposal] chromium fallback launch failed:",
          fallbackErr?.message || fallbackErr,
        );
        return res.status(500).json({
          error: "render_failed",
          reason: "puppeteer_launch_failed",
          detail: {
            primary: String(firstLaunchError?.message || firstLaunchError || "unknown"),
            fallback: String(fallbackErr?.message || fallbackErr || "unknown"),
          },
        });
      }
    }

    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
      });
      await browser.close();
    } catch (err: any) {
      try {
        if (browser) await browser.close();
      } catch {}
      console.error(
        "[/quotes/:id/render-proposal] pdf generation failed:",
        err?.message || err,
      );
      return res
        .status(500)
        .json({ error: "render_failed", reason: "pdf_generation_failed" });
    }

    const filenameSafe = (title || `Quote ${quote.id}`).replace(/[^\w.\-]+/g, "_");
    // Truncate filename to prevent ENAMETOOLONG errors (max 100 chars before extension)
    const truncatedName = filenameSafe.length > 100 ? filenameSafe.substring(0, 100) : filenameSafe;
    const filename = `${truncatedName}.pdf`;
    const filepath = path.join(UPLOAD_DIR, `${Date.now()}__${filename}`);
    try {
      fs.writeFileSync(filepath, pdfBuffer);
    } catch (err: any) {
      console.error(
        "[/quotes/:id/render-proposal] write file failed:",
        err?.message || err,
      );
      return res
        .status(500)
        .json({ error: "render_failed", reason: "write_failed" });
    }

    const fileRow = await prisma.uploadedFile.create({
      data: {
        tenantId,
        quoteId: quote.id,
        kind: "OTHER",
        name: filename,
        path: path.relative(process.cwd(), filepath),
        mimeType: "application/pdf",
        sizeBytes: pdfBuffer.length,
      },
    });

    const meta0: any = (quote.meta as any) || {};
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        proposalPdfUrl: null,
        meta: { ...(meta0 || {}), proposalFileId: fileRow.id } as any,
      } as any,
    });

    return res.json({ ok: true, fileId: fileRow.id, name: fileRow.name });
  } catch (e: any) {
    console.error("[/quotes/:id/render-proposal] failed:", e?.message || e);
    return res
      .status(500)
      .json({ error: "render_failed", reason: "unknown" });
  }
});

/**
 * GET /quotes/:id/proposal/signed
 * Returns a signed URL for the generated proposal PDF (if any).
 */
router.get("/:id/proposal/signed", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const q = await prisma.quote.findFirst({ where: { id, tenantId } });
    if (!q) return res.status(404).json({ error: "not_found" });
    const meta: any = (q.meta as any) || {};
    const fileId: string | undefined = meta?.proposalFileId;
    if (!fileId) return res.status(404).json({ error: "proposal_not_found" });

    const f = await prisma.uploadedFile.findFirst({ where: { id: fileId, tenantId } });
    if (!f) return res.status(404).json({ error: "file_not_found" });

    const API_BASE = (
      process.env.APP_API_URL ||
      process.env.API_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${process.env.PORT || 4000}`
    ).replace(/\/$/, "");

    const token = jwt.sign({ t: tenantId, q: q.id }, env.APP_JWT_SECRET, { expiresIn: "30m" });
    const url = `${API_BASE}/files/${encodeURIComponent(f.id)}?jwt=${encodeURIComponent(token)}`;
    return res.json({ ok: true, url, name: f.name });
  } catch (e: any) {
    console.error("[/quotes/:id/proposal/signed] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// Basic HTML escape for PDF content
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Render optional sections configured under tenantSettings.quoteDefaults
function renderSections(qd: any) {
  const sections: Array<string> = [];
  const asList = (v: any): string[] => Array.isArray(v) ? v.map((x) => String(x)) : (typeof v === "string" && v.trim() ? v.split(/\n+/) : []);
  const block = (title: string, bodyHtml: string) => `
    <div class="section">
      <h2>${escapeHtml(title)}</h2>
      ${bodyHtml}
    </div>`;

  if (qd?.overview) {
    sections.push(block("Overview", `<div class=\"muted\">${escapeHtml(String(qd.overview))}</div>`));
  }
  const inclusions = asList(qd?.inclusions);
  if (inclusions.length) {
    sections.push(block("Inclusions", `<ul class=\"list\">${inclusions.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`));
  }
  const exclusions = asList(qd?.exclusions);
  if (exclusions.length) {
    sections.push(block("Exclusions", `<ul class=\"list\">${exclusions.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`));
  }
  if (qd?.leadTime || qd?.delivery || qd?.installation || qd?.warranty) {
    const bits: string[] = [];
    if (qd?.leadTime) bits.push(`<div><strong>Lead time:</strong> ${escapeHtml(String(qd.leadTime))}</div>`);
    if (qd?.delivery) bits.push(`<div><strong>Delivery:</strong> ${escapeHtml(String(qd.delivery))}</div>`);
    if (qd?.installation) bits.push(`<div><strong>Installation:</strong> ${escapeHtml(String(qd.installation))}</div>`);
    if (qd?.warranty) bits.push(`<div><strong>Warranty:</strong> ${escapeHtml(String(qd.warranty))}</div>`);
    if (bits.length) sections.push(block("Project details", `<div class=\"muted\">${bits.join("")}</div>`));
  }
  if (qd?.notes) {
    sections.push(block("Notes", `<div class=\"muted\">${escapeHtml(String(qd.notes))}</div>`));
  }
  return sections.join("");
}

/**
 * Fetch image files for quote lines and generate signed URLs
 * @param lines - Quote lines with potential imageFileId in meta
 * @param tenantId - Tenant ID for JWT signing
 * @returns Map of imageFileId to signed URL
 */
async function fetchLineImageUrls(lines: any[], tenantId: string): Promise<Record<string, string>> {
  const imageFileIds = lines
    .map(ln => {
      const meta = (ln.meta as any) || {};
      return meta.imageFileId;
    })
    .filter((id): id is string => typeof id === 'string');
  
  if (imageFileIds.length === 0) {
    return {};
  }
  
  // Fetch image files
  const imageFiles = await prisma.uploadedFile.findMany({
    where: {
      id: { in: imageFileIds },
      kind: "LINE_IMAGE" as FileKind,
    },
  });
  
  // Generate signed URLs for each image
  const API_BASE = (
    process.env.APP_API_URL ||
    process.env.API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 4000}`
  ).replace(/\/$/, "");
  
  const urlMap: Record<string, string> = {};
  for (const file of imageFiles) {
    const token = jwt.sign({ t: tenantId, f: file.id }, env.APP_JWT_SECRET, { expiresIn: '2h' });
    urlMap[file.id] = `${API_BASE}/files/${encodeURIComponent(file.id)}?jwt=${encodeURIComponent(token)}`;
  }
  
  return urlMap;
}

/**
 * Build a beautiful, multi-section Soho-style PDF proposal HTML
 * Shared by both /render-pdf and /render-proposal endpoints
 */
function buildQuoteProposalHtml(opts: {
  quote: any & { lines: any[]; tenant: any; lead: any | null };
  tenantSettings: any | null;
  currencyCode: string;
  currencySymbol: string;
  totals: { subtotal: number; vatAmount: number; totalGBP: number; vatRate: number; showVat: boolean };
  imageUrlMap?: Record<string, string>;  // NEW: Map of imageFileId to signed URL
}): string {
  const { quote, tenantSettings: ts, currencyCode: cur, currencySymbol: sym, totals } = opts;
  const { subtotal, vatAmount, totalGBP, vatRate, showVat } = totals;
  
  const quoteDefaults: any = (ts?.quoteDefaults as any) || {};
  const brand = (ts?.brandName || quote.tenant?.brandName || "Quotation").toString();
  const logoUrl = (ts?.logoUrl || "").toString();
  const phone = (ts?.phone || quoteDefaults?.phone || "").toString();
  const email = quoteDefaults?.email || ts?.email || "";
  const website = (ts?.website || (Array.isArray(ts?.links) ? undefined : (ts?.links as any)?.website) || "").toString();
  const address = quoteDefaults?.address || ts?.address || "";
  
  const client = quote.lead?.contactName || quote.lead?.email || "Client";
  const projectName = quote.title || `Project for ${client}`;
  const when = new Date().toLocaleDateString();
  const validDays = Number(quoteDefaults?.validDays ?? 30);
  const validUntil = new Date(Date.now() + Math.max(0, validDays) * 86400000).toLocaleDateString();
  const terms = (quoteDefaults?.terms as string) || "Prices are valid for 30 days and subject to site survey. Payment terms: 50% upfront, 50% on delivery unless agreed otherwise.";
  const tagline = quoteDefaults?.tagline || "Timber Joinery Specialists";
  
  const ref = `Q-${quote.id.slice(0, 8).toUpperCase()}`;
  const leadCustom: any = (quote.lead?.custom as any) || {};
  const jobNumber = (leadCustom?.refId as string) || ref;
  const deliveryAddress = (leadCustom?.address as string) || "";
  
  // Extract specifications
  const quoteMeta: any = (quote.meta as any) || {};
  const specifications = quoteMeta?.specifications || {};
  const timber = specifications.timber || quoteDefaults?.defaultTimber || "Engineered timber";
  const finish = specifications.finish || quoteDefaults?.defaultFinish || "Factory finished";
  const glazing = specifications.glazing || quoteDefaults?.defaultGlazing || "Low-energy double glazing";
  const fittings = specifications.fittings || quoteDefaults?.defaultFittings || "";
  const ventilation = specifications.ventilation || "";
  const compliance = specifications.compliance || quoteDefaults?.compliance || "Industry standards";
  
  // Project scope
  const scopeDescription = quoteMeta?.scopeDescription || 
    `This project involves supplying bespoke timber joinery products crafted to meet your specifications. All products are manufactured to the highest standards and comply with ${compliance}.`;
  
  // Build rows for table - CRITICAL: Use meta.sellTotalGBP directly when available
  const marginDefault = Number(quote.markupDefault ?? quoteDefaults?.defaultMargin ?? 0.25);
  const imageUrlMap = opts.imageUrlMap || {};
  
  const rows = quote.lines.map((ln: any) => {
    const qty = Number(ln.qty || 1);
    const metaAny: any = (ln.meta as any) || {};
    
    // CRITICAL FIX: If sellTotalGBP exists in meta (from /lines/save-processed or /price),
    // use it directly. Otherwise calculate from unitPrice + margin.
    let sellUnit: number;
    let total: number;
    
    if (metaAny?.sellTotalGBP != null && Number.isFinite(Number(metaAny.sellTotalGBP))) {
      // Use pre-calculated sell total from pricing
      total = Number(metaAny.sellTotalGBP);
      sellUnit = qty > 0 ? total / qty : 0;
    } else if (metaAny?.sellUnitGBP != null && Number.isFinite(Number(metaAny.sellUnitGBP))) {
      // Use pre-calculated sell unit price
      sellUnit = Number(metaAny.sellUnitGBP);
      total = sellUnit * qty;
    } else {
      // Fallback: calculate from unitPrice (which is in POUNDS, not pence in this system)
      const unitPriceGBP = Number(ln.unitPrice || 0);
      sellUnit = unitPriceGBP * (1 + marginDefault);
      total = sellUnit * qty;
    }
    
    // Enhanced: Build cleaner description from structured product data
    let description = "";
    const dimensions = metaAny?.dimensions || "";
    
    // If we have structured product data, use it to build a clean description
    if (metaAny?.productType || metaAny?.wood || metaAny?.finish) {
      const parts: string[] = [];
      if (metaAny.productType) parts.push(metaAny.productType);
      if (metaAny.wood) parts.push(`${metaAny.wood} wood`);
      if (metaAny.finish) parts.push(metaAny.finish);
      if (metaAny.glass) parts.push(`with ${metaAny.glass} glazing`);
      description = parts.join(", ");
    }
    
    // Fallback to original description if no structured data
    if (!description) {
      description = String(ln.description || "Item");
      // Remove any control characters or binary data
      description = description.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
      // Truncate very long descriptions
      if (description.length > 200) {
        description = description.substring(0, 197) + "...";
      }
    }
    
    // NEW: Get image URL if available
    const imageUrl = metaAny?.imageFileId ? imageUrlMap[metaAny.imageFileId] : undefined;
    
    return { description, qty, unit: sellUnit, total, dimensions, imageUrl };
  });
  
  const showLineItems = quoteDefaults?.showLineItems !== false;
  
  // Guarantees section
  const guarantees: any[] = Array.isArray(quoteDefaults?.guarantees) ? quoteDefaults.guarantees : [];
  const guaranteeTitle = quoteDefaults?.guaranteeTitle || `${brand} Guarantee`;
  const defaultGuarantees = [
    { title: "Delivered on Time", description: "We pride ourselves on punctual delivery to keep your project on schedule." },
    { title: "No Hidden Extras", description: "The price you see is the price you pay—transparent and honest pricing." },
    { title: "Fully Compliant", description: "All products meet or exceed industry standards and building regulations." }
  ];
  const displayGuarantees = guarantees.length > 0 ? guarantees.slice(0, 3) : defaultGuarantees;
  
  // About / Overview
  const overview = quoteDefaults?.overview || 
    `${brand} is a specialist in bespoke timber joinery, combining traditional craftsmanship with modern manufacturing techniques. We deliver high-quality windows, doors, and architectural joinery that meet the most exacting standards.`;
  
  // Testimonials
  const testimonials: any[] = Array.isArray(quoteDefaults?.testimonials) ? quoteDefaults.testimonials.slice(0, 3) : [];
  
  // Certifications / Accreditations
  const certifications: any[] = Array.isArray(quoteDefaults?.certifications) ? quoteDefaults.certifications : [];
  const defaultCertifications = [
    { name: "PAS 24", description: "Enhanced security performance for doors and windows" },
    { name: "FENSA Registered", description: "Competent Person Scheme for window installation" },
    { name: "FSC Certified", description: "Sustainably sourced timber from responsible forests" }
  ];
  const displayCertifications = certifications.length > 0 ? certifications : defaultCertifications;
  
  // Styles - Soho Premium Aesthetic
  const styles = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
        color: #1e293b; 
        line-height: 1.5;
        padding: 0;
        font-feature-settings: "kern" 1, "liga" 1;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      .page { 
        padding: 28px 36px; 
        max-width: 210mm;
      }
      
      /* Page 1: Header & Cover - Soho Style */
      .header { 
        border-bottom: 2px solid #0ea5e9; 
        padding-bottom: 18px; 
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .header-left { flex: 1; }
      .header-right { 
        text-align: right; 
        font-size: 10px; 
        color: #64748b; 
        line-height: 1.7;
        font-weight: 500;
      }
      .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
      .brand img { max-height: 48px; max-width: 180px; }
      .brand-name { 
        font-size: 22px; 
        font-weight: 700; 
        color: #0f172a; 
        letter-spacing: -0.3px;
      }
      .tagline { 
        font-size: 11px; 
        color: #64748b; 
        font-style: italic; 
        margin-bottom: 14px;
        font-weight: 500;
      }
      h1 { 
        font-size: 26px; 
        font-weight: 700; 
        color: #0f172a; 
        margin: 0 0 5px; 
        letter-spacing: -0.6px;
        line-height: 1.2;
      }
      .project-title { 
        font-size: 15px; 
        color: #0ea5e9; 
        font-weight: 600; 
        margin-bottom: 3px;
        letter-spacing: -0.2px;
      }
      .client-strip { 
        font-size: 13px; 
        color: #475569; 
        padding: 7px 0;
        border-top: 1px solid #e2e8f0;
        margin-top: 7px;
        font-weight: 500;
      }
      
      /* Project Overview Grid */
      .overview-grid { 
        display: grid; 
        grid-template-columns: 1fr 1fr 1fr; 
        gap: 24px; 
        margin: 28px 0;
        padding: 24px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }
      .overview-section h3 { 
        font-size: 12px; 
        font-weight: 700; 
        text-transform: uppercase; 
        color: #0ea5e9; 
        margin-bottom: 12px;
        letter-spacing: 0.5px;
      }
      .overview-section .detail-line { 
        font-size: 11px; 
        color: #475569; 
        margin-bottom: 6px;
        line-height: 1.5;
      }
      .overview-section .detail-line strong { 
        color: #0f172a; 
        font-weight: 600;
      }
      .project-scope { 
        font-size: 11px; 
        color: #475569; 
        line-height: 1.7;
      }
      
      /* Page 2: Quotation - Soho Style */
      .section-title {
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
        margin: 28px 0 10px;
        padding-bottom: 7px;
        border-bottom: 2px solid #e2e8f0;
        letter-spacing: -0.3px;
        text-transform: uppercase;
        font-size: 14px;
        letter-spacing: 0.5px;
      }
      .quotation-intro { 
        font-size: 12px; 
        color: #475569; 
        margin: 14px 0;
        line-height: 1.6;
        font-weight: 500;
      }
      
      /* Table - Soho Premium Style */
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin: 24px 0; 
        font-size: 11px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        table-layout: fixed;
      }
      thead th { 
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        color: #64748b;
        font-weight: 700; 
        text-transform: uppercase;
        font-size: 9.5px;
        letter-spacing: 0.8px;
        padding: 14px 12px;
        border-bottom: 2px solid #cbd5e1;
        text-align: left;
      }
      tbody td { 
        padding: 10px 12px; 
        border-bottom: 1px solid #f1f5f9; 
        vertical-align: middle;
        color: #334155;
        line-height: 1.5;
      }
      tbody tr { 
        transition: background-color 0.15s ease;
      }
      tbody tr:nth-child(even) { 
        background-color: #fafbfc;
      }
      tbody tr:hover {
        background-color: #f8fafc;
      }
      tbody tr:last-child td { border-bottom: none; }
      .right { text-align: right; }
      .amount-cell { 
        font-weight: 700; 
        color: #0f172a; 
        font-size: 12px;
      }
      
      /* Image cell styling */
      .image-cell {
        width: 60px;
        padding: 8px 10px;
        text-align: center;
        vertical-align: middle;
      }
      
      /* Line item thumbnails */
      .line-thumb {
        width: 50px;
        height: 50px;
        border-radius: 6px;
        display: block;
        object-fit: contain;
        border: 1px solid #e2e8f0;
        padding: 3px;
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        margin: 0 auto;
      }
      
      /* Placeholder for missing images */
      .thumb-placeholder {
        width: 50px;
        height: 50px;
        border-radius: 6px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 1px dashed #cbd5e1;
        display: block;
        margin: 0 auto;
      }
      
      /* Totals - Soho Premium */
      .totals-wrapper { 
        display: flex; 
        justify-content: flex-end; 
        margin: 20px 0;
      }
      .totals { 
        min-width: 300px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      }
      .totals .row { 
        display: flex; 
        justify-content: space-between; 
        padding: 12px 16px; 
        border-bottom: 1px solid #f1f5f9;
        font-size: 11.5px;
        font-weight: 500;
      }
      .totals .row:last-child { border-bottom: none; }
      .totals .row.subtotal { 
        background: #fafbfc; 
      }
      .totals .row.vat { 
        background: #ffffff; 
      }
      .totals .row.total { 
        background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
        color: white; 
        font-weight: 700;
        font-size: 14px;
        padding: 14px 16px;
        letter-spacing: 0.2px;
      }
      .totals .label { 
        color: #64748b; 
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.5px;
      }
      .totals .value { 
        font-weight: 700; 
        color: #0f172a; 
        font-size: 12.5px;
      }
      .totals .row.total .label,
      .totals .row.total .value { 
        color: white;
        font-size: 11px;
      }
      .totals .row.total .value {
        font-size: 15px;
      }
      
      /* Guarantee/Benefits Section */
      .guarantee-section {
        margin: 32px 0;
        padding: 28px;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border-radius: 8px;
        border: 1px solid #bae6fd;
        page-break-inside: avoid;
      }
      .guarantee-section h2 {
        font-size: 20px;
        font-weight: 700;
        color: #0c4a6e;
        margin-bottom: 20px;
        text-align: center;
      }
      .guarantee-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
      }
      .guarantee-item {
        text-align: center;
        padding: 16px;
        background: rgba(255,255,255,0.6);
        border-radius: 6px;
      }
      .guarantee-item h4 {
        font-size: 14px;
        font-weight: 700;
        color: #0369a1;
        margin-bottom: 10px;
      }
      .guarantee-item p {
        font-size: 11px;
        color: #475569;
        line-height: 1.6;
      }
      
      /* Page 3: About & Testimonials */
      .about-section {
        margin: 32px 0;
        page-break-inside: avoid;
      }
      .about-section h2 {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e2e8f0;
      }
      .about-section p {
        font-size: 12px;
        color: #475569;
        line-height: 1.8;
        margin-bottom: 16px;
      }
      
      .testimonials-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin: 24px 0;
      }
      .testimonial-card {
        padding: 20px;
        background: #f8fafc;
        border-left: 4px solid #0ea5e9;
        border-radius: 6px;
        page-break-inside: avoid;
      }
      .testimonial-quote {
        font-size: 12px;
        color: #334155;
        font-style: italic;
        line-height: 1.7;
        margin-bottom: 12px;
      }
      .testimonial-author {
        font-size: 11px;
        color: #64748b;
        font-weight: 600;
      }
      
      .certifications-section {
        margin: 32px 0;
        page-break-inside: avoid;
      }
      .certifications-section h3 {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 16px;
      }
      .certifications-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
      }
      .cert-item {
        padding: 16px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        page-break-inside: avoid;
      }
      .cert-item h5 {
        font-size: 12px;
        font-weight: 700;
        color: #0ea5e9;
        margin-bottom: 6px;
      }
      .cert-item p {
        font-size: 10px;
        color: #64748b;
        line-height: 1.5;
      }
      
      /* Page 4: Terms */
      .terms-section {
        margin: 32px 0;
        padding: 20px;
        background: #f8fafc;
        border-left: 4px solid #0ea5e9;
        border-radius: 6px;
        page-break-inside: avoid;
      }
      .terms-section h3 {
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        color: #0f172a;
        margin-bottom: 12px;
        letter-spacing: 0.5px;
      }
      .terms-section p {
        font-size: 11px;
        color: #475569;
        line-height: 1.8;
        white-space: pre-wrap;
      }
      .validity-note {
        margin-top: 16px;
        padding: 12px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        font-size: 11px;
        color: #334155;
      }
      
      /* Contact Footer */
      .contact-section {
        margin-top: 28px;
        padding: 20px;
        background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
        border-radius: 8px;
        text-align: center;
        page-break-inside: avoid;
      }
      .contact-section h4 {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 12px;
      }
      .contact-details {
        font-size: 11px;
        color: #475569;
        line-height: 1.8;
      }
      
      footer { 
        margin-top: 32px; 
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
        font-size: 10px; 
        color: #94a3b8;
        text-align: center;
        line-height: 1.6;
      }
      
      /* Legacy sections from renderSections */
      .section { margin: 24px 0; page-break-inside: avoid; }
      .section h2 { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
      .section .muted { font-size: 11px; color: #475569; line-height: 1.7; }
      .section ul.list { padding-left: 20px; margin: 8px 0; }
      .section ul.list li { font-size: 11px; color: #475569; margin-bottom: 4px; }
    </style>`;
  
  const html = `<!doctype html>
    <html>
    <head><meta charset="utf-8" />${styles}</head>
    <body>
      <div class="page">
        <!-- Page 1: Cover & Overview -->
        <header class="header">
          <div class="header-left">
            <div class="brand">
              ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(brand)}" />` : `<div class="brand-name">${escapeHtml(brand)}</div>`}
            </div>
            ${tagline ? `<div class="tagline">${escapeHtml(tagline)}</div>` : ""}
            <h1>Project Quotation</h1>
            <div class="project-title">${escapeHtml(projectName)}</div>
            <div class="client-strip">Client: ${escapeHtml(client)} • ${when}</div>
          </div>
          <div class="header-right">
            ${phone ? `<div><strong>Tel:</strong> ${escapeHtml(phone)}</div>` : ""}
            ${email ? `<div><strong>Email:</strong> ${escapeHtml(email)}</div>` : ""}
            ${website ? `<div><strong>Web:</strong> ${escapeHtml(website)}</div>` : ""}
            ${address ? `<div style="margin-top:8px;">${escapeHtml(address)}</div>` : ""}
          </div>
        </header>

        <!-- Project Overview Grid -->
        <div class="overview-grid">
          <div class="overview-section">
            <h3>Client Details</h3>
            <div class="detail-line"><strong>Client:</strong> ${escapeHtml(client)}</div>
            <div class="detail-line"><strong>Project:</strong> ${escapeHtml(projectName)}</div>
            ${leadCustom?.phone ? `<div class="detail-line"><strong>Phone:</strong> ${escapeHtml(leadCustom.phone)}</div>` : ""}
            ${quote.lead?.email ? `<div class="detail-line"><strong>Email:</strong> ${escapeHtml(quote.lead.email)}</div>` : ""}
            <div class="detail-line"><strong>Job Number:</strong> ${escapeHtml(jobNumber)}</div>
            <div class="detail-line"><strong>Date:</strong> ${when}</div>
            <div class="detail-line"><strong>Valid Until:</strong> ${validUntil}</div>
            ${deliveryAddress ? `<div class="detail-line"><strong>Site:</strong> ${escapeHtml(deliveryAddress)}</div>` : ""}
          </div>
          
          <div class="overview-section">
            <h3>Specification Summary</h3>
            <div class="detail-line"><strong>Timber:</strong> ${escapeHtml(timber)}</div>
            <div class="detail-line"><strong>Finish:</strong> ${escapeHtml(finish)}</div>
            <div class="detail-line"><strong>Glazing:</strong> ${escapeHtml(glazing)}</div>
            ${fittings ? `<div class="detail-line"><strong>Fittings:</strong> ${escapeHtml(fittings)}</div>` : ""}
            ${ventilation ? `<div class="detail-line"><strong>Ventilation:</strong> ${escapeHtml(ventilation)}</div>` : ""}
            <div class="detail-line"><strong>Compliance:</strong> ${escapeHtml(compliance)}</div>
            <div class="detail-line"><strong>Currency:</strong> ${cur}</div>
          </div>
          
          <div class="overview-section">
            <h3>Project Scope</h3>
            <div class="project-scope">${escapeHtml(scopeDescription)}</div>
          </div>
        </div>

        <!-- Page 2: Detailed Quotation -->
        <h2 class="section-title">Detailed Quotation</h2>
        <p class="quotation-intro">
          Following the technical specifications outlined above, this section provides a comprehensive 
          breakdown of the proposed investment for your project. The quotation details each component, 
          quantity, dimensions, and pricing.
        </p>

        <table>
          <thead>
            <tr>
              <th style="width:12%">IMAGE</th>
              <th style="width:40%">DESCRIPTION</th>
              <th class="right" style="width:10%">QTY</th>
              <th style="width:18%">DIMENSIONS</th>
              <th class="right" style="width:20%">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r: { description: string; qty: number; unit: number; total: number; dimensions: string; imageUrl?: string }) => `
                <tr>
                  <td class="image-cell">${r.imageUrl ? `<img src="${r.imageUrl}" class="line-thumb" alt="Product" />` : '<div class="thumb-placeholder"></div>'}</td>
                  <td>${escapeHtml(r.description || "-")}</td>
                  <td class="right">${r.qty.toLocaleString()}</td>
                  <td>${escapeHtml(r.dimensions)}</td>
                  <td class="right amount-cell">${showLineItems ? sym + r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Included"}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-wrapper">
          <div class="totals">
            <div class="row subtotal">
              <div class="label">Subtotal (Ex VAT)</div>
              <div class="value">${sym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            ${showVat ? `
            <div class="row vat">
              <div class="label">VAT (${(vatRate*100).toFixed(0)}%)</div>
              <div class="value">${sym}${vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>` : ""}
            <div class="row total">
              <div class="label">Grand Total (Incl VAT)</div>
              <div class="value">${sym}${totalGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        ${quoteDefaults?.delivery || quoteDefaults?.installation ? `
        <div style="margin:20px 0;padding:12px;background:#f8fafc;border-radius:6px;font-size:11px;color:#475569;">
          ${quoteDefaults.delivery ? `<div><strong>Delivery:</strong> ${escapeHtml(quoteDefaults.delivery)}</div>` : ""}
          ${quoteDefaults.installation ? `<div><strong>Installation:</strong> ${escapeHtml(quoteDefaults.installation)}</div>` : ""}
        </div>` : ""}

        <!-- Guarantee Section -->
        <div class="guarantee-section">
          <h2>${escapeHtml(guaranteeTitle)}</h2>
          <div class="guarantee-grid">
            ${displayGuarantees.map((g: any) => `
              <div class="guarantee-item">
                <h4>${escapeHtml(g.title || "")}</h4>
                <p>${escapeHtml(g.description || "")}</p>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Page 3: About & Testimonials/Certifications -->
        <div class="about-section">
          <h2>About ${escapeHtml(brand)}</h2>
          <p>${escapeHtml(overview)}</p>
        </div>

        ${testimonials.length > 0 ? `
        <div style="margin:32px 0;">
          <h3 style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:16px;">What Our Clients Say</h3>
          <div class="testimonials-grid">
            ${testimonials.map((t: any) => `
              <div class="testimonial-card">
                <div class="testimonial-quote">"${escapeHtml(t.quote || t.text || "")}"</div>
                <div class="testimonial-author">— ${escapeHtml(t.client || t.name || "Client")}${t.role ? `, ${escapeHtml(t.role)}` : ""}</div>
              </div>
            `).join("")}
          </div>
        </div>` : ""}

        <div class="certifications-section">
          <h3>Quality & Certifications</h3>
          <div class="certifications-grid">
            ${displayCertifications.map((c: any) => `
              <div class="cert-item">
                <h5>${escapeHtml(c.name || c.title || "")}</h5>
                <p>${escapeHtml(c.description || "")}</p>
              </div>
            `).join("")}
          </div>
        </div>

        ${renderSections(quoteDefaults)}

        <!-- Page 4: Terms & Conditions -->
        <div class="terms-section">
          <h3>Terms & Conditions</h3>
          <p>${escapeHtml(terms)}</p>
          <div class="validity-note">
            <strong>Quotation Validity:</strong> This quotation is valid until ${validUntil}. 
            Prices are subject to confirmation and may vary based on site survey findings.
          </div>
        </div>

        <!-- Contact Information -->
        <div class="contact-section">
          <h4>Get in Touch</h4>
          <div class="contact-details">
            <div><strong>${escapeHtml(brand)}</strong></div>
            ${address ? `<div>${escapeHtml(address)}</div>` : ""}
            ${phone ? `<div>Tel: ${escapeHtml(phone)}</div>` : ""}
            ${email ? `<div>Email: ${escapeHtml(email)}</div>` : ""}
            ${website ? `<div>Web: ${escapeHtml(website)}</div>` : ""}
            ${quoteDefaults?.businessHours ? `<div style="margin-top:8px;">Hours: ${escapeHtml(quoteDefaults.businessHours)}</div>` : ""}
          </div>
        </div>

        <footer>
          <div>Quote Reference: ${ref} • Valid until ${validUntil}</div>
          <div style="margin-top:4px;">Thank you for considering ${escapeHtml(brand)} for your project.</div>
          <div style="margin-top:8px;font-size:9px;">All prices in ${cur}. ${showVat ? "VAT included where applicable." : ""}</div>
        </footer>
      </div>
    </body>
    </html>`;
  
  return html;
}

/**
 * GET /quotes/:id/files/:fileId/signed
 * Returns a short-lived signed URL for the supplier file so users can verify streaming works.
 */
router.get("/:id/files/:fileId/signed", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const fileId = String(req.params.fileId);
    const quote = await prisma.quote.findFirst({ where: { id, tenantId }, include: { supplierFiles: true } });
    if (!quote) return res.status(404).json({ error: "not_found" });
    const f = quote.supplierFiles.find((x) => x.id === fileId);
    if (!f) return res.status(404).json({ error: "file_not_found" });

    const API_BASE = (
      process.env.APP_API_URL ||
      process.env.API_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${process.env.PORT || 4000}`
    ).replace(/\/$/, "");

    const token = jwt.sign({ t: tenantId, q: quote.id }, env.APP_JWT_SECRET, { expiresIn: "15m" });
    const url = `${API_BASE}/files/${encodeURIComponent(f.id)}?jwt=${encodeURIComponent(token)}`;
    return res.json({ ok: true, url });
  } catch (e: any) {
    console.error("[/quotes/:id/files/:fileId/signed] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /quotes/:id/lines/map
 * Body: { mappings: Array<{ lineId, questionKey }> } to map lines to questionnaire items.
 */
router.patch("/:id/lines/map", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const q = await prisma.quote.findFirst({ where: { id, tenantId } });
    if (!q) return res.status(404).json({ error: "not_found" });
    const mappings: Array<{ lineId: string; questionKey: string | null }> = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
    for (const m of mappings) {
      if (!m?.lineId) continue;
      await prisma.quoteLine.update({ where: { id: m.lineId }, data: { meta: { set: { ...(req.body?.meta || {}), questionKey: m.questionKey || null } } } as any });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[/quotes/:id/lines/map] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /quotes/:id/price
 * Body: { method: "margin" | "ml", margin?: number }
 */
router.post("/:id/price", requireAuth, async (req: any, res) => {
  try {
    const tenantId = await getTenantId(req);
    const id = String(req.params.id);
    const quote = await prisma.quote.findFirst({ where: { id, tenantId }, include: { lines: true, tenant: true, lead: true } });
    if (!quote) return res.status(404).json({ error: "not_found" });
    const method = String(req.body?.method || "margin");
    const margin = Number(req.body?.margin ?? quote.markupDefault ?? 0.25);

    if (method === "margin") {
      // apply simple margin over supplier unitPrice, but skip lines with manual overrides
      let totalGBP = 0;
      let skippedCount = 0;
      for (const ln of quote.lines) {
        const lineMeta: any = (ln.meta as any) || {};
        const isOverridden = lineMeta?.isOverridden === true;
        
        // Skip lines with manual overrides
        if (isOverridden) {
          skippedCount += 1;
          // Keep existing sell values for overridden lines
          const existingSellTotal = Number(lineMeta?.sellTotalGBP ?? ln.lineTotalGBP ?? 0);
          totalGBP += existingSellTotal;
          continue;
        }
        // Be resilient: if unitPrice wasn't set (older parses), derive from stored raw totals when available.
        const parsedQty = Math.max(1, Number(ln.qty || 1));
        let unitCostBase = Number(ln.unitPrice || 0);
        if (!(unitCostBase > 0)) {
          const raw = (lineMeta?.raw as any) || {};
          const altUnit = pickUnitCost(raw);
          const altTotal = pickLineTotal(raw);
          if (altUnit != null && altUnit > 0) unitCostBase = altUnit;
          else if (altTotal != null && altTotal > 0) unitCostBase = altTotal / parsedQty;
        }

        const sellUnit = unitCostBase * (1 + margin);
        const sellTotal = sellUnit * parsedQty;
        totalGBP += sellTotal;
        await prisma.quoteLine.update({ where: { id: ln.id }, data: { meta: { set: { ...(lineMeta || {}), sellUnitGBP: sellUnit, sellTotalGBP: sellTotal, pricingMethod: "margin", margin } } } as any });
      }
  await prisma.quote.update({ where: { id: quote.id }, data: { totalGBP: new Prisma.Decimal(totalGBP), markupDefault: new Prisma.Decimal(margin) } });
      return res.json({ ok: true, method, margin, totalGBP, skippedOverrides: skippedCount });
    }

    if (method === "ml") {
      // Force questionnaire-driven estimation only
      const preferQuestionnaire = true;

      // Call ML to get an estimated total based on questionnaire answers; then scale per-line proportions by cost
      const API_BASE = (
        process.env.APP_API_URL || process.env.API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`
      ).replace(/\/$/, "");
  const featuresRaw: any = (quote.lead?.custom as any) || {};
  const features: any = flattenQuestionnaireFeatures(featuresRaw);
  console.log(`[quotes/:id/price] ML estimate for quote ${quote.id}, features:`, JSON.stringify(features));
  const inputTypeRaw = typeof req.body?.inputType === "string" ? req.body.inputType : (preferQuestionnaire ? "questionnaire" : undefined);
      const inputType = inputTypeRaw === "supplier_pdf" ? "supplier_pdf" : "questionnaire";

      const inferenceModel = inputType === "supplier_pdf" ? "supplier_estimator" : "qa_estimator";

      let supplierLinesForHash: Array<any> = [];
      if (inputType === "supplier_pdf") {
        try {
          const parsed = await prisma.parsedSupplierLine.findMany({
            where: { tenantId, quoteId: quote.id },
            select: {
              rawText: true,
              qty: true,
              costUnit: true,
              lineTotal: true,
              currency: true,
              supplier: true,
              page: true,
            },
            orderBy: { createdAt: "asc" },
          });
          supplierLinesForHash = parsed;
        } catch (e: any) {
          console.warn(`[quotes] failed to load parsed lines for estimate hashing:`, e?.message || e);
        }
      }

      const hashPayloadBase =
        inputType === "supplier_pdf"
          ? { type: inputType, lines: normaliseSupplierLinesForHash(supplierLinesForHash) }
          : { type: inputType, questionnaire: normaliseQuestionnaireForHash(features) };
      const inputHash = sha256(stableJsonStringify(hashPayloadBase));

      let productionModelId: string | null = null;
      try {
        const productionModel = await prisma.modelVersion.findFirst({
          where: { model: inferenceModel, isProduction: true },
          orderBy: { createdAt: "desc" },
        });
        productionModelId = productionModel?.id ?? null;
      } catch (e: any) {
        console.warn(`[quotes] failed to load production model for ${inferenceModel}:`, e?.message || e);
      }

      const cacheSince = new Date(Date.now() - ESTIMATE_CACHE_DAYS * 24 * 60 * 60 * 1000);
      let cachedEstimate: any = null;
      if (productionModelId) {
        try {
          cachedEstimate = await prisma.estimate.findFirst({
            where: {
              tenantId,
              inputType,
              inputHash,
              modelVersionId: productionModelId,
              createdAt: { gte: cacheSince },
            },
            orderBy: { createdAt: "desc" },
          });
        } catch (e: any) {
          console.warn(`[quotes] failed to load cached estimate:`, e?.message || e);
        }
      }

      if (cachedEstimate && productionModelId) {
        const predictedTotalRaw = Number(cachedEstimate.estimatedTotal ?? 0);
        const predictedTotal = Number.isFinite(predictedTotalRaw) ? predictedTotalRaw : 0;
        const confidenceRaw = cachedEstimate.confidence;
        const confidence =
          confidenceRaw != null && Number.isFinite(Number(confidenceRaw)) ? Number(confidenceRaw) : null;
        const currency = normalizeCurrency(cachedEstimate.currency || quote.currency || "GBP");
        
        console.log(`[quotes/:id/price] Using cached estimate for quote ${quote.id}: predictedTotal=${predictedTotal}, confidence=${confidence}`);

        // If cached value is non-positive, treat as cache miss to allow retraining/updated logic
        if (predictedTotal <= 0) {
          console.warn(`[quotes/:id/price] Cached estimate has predictedTotal=${predictedTotal} for quote ${quote.id} – ignoring cache`);
          // proceed to live ML call by skipping cache branch
        } else {
          // If there are no lines yet, create a single placeholder line so totals aren't £0
          if (!quote.lines || quote.lines.length === 0) {
            const desc = (quote.title && `Estimated: ${quote.title}`) || "Estimated item";
            await prisma.quoteLine.create({
              data: {
                quoteId: quote.id,
                supplier: null as any,
                sku: undefined,
                description: desc,
                qty: 1,
                unitPrice: new Prisma.Decimal(0),
                currency,
                deliveryShareGBP: new Prisma.Decimal(0),
                lineTotalGBP: new Prisma.Decimal(predictedTotal),
                meta: {
                  pricingMethod: "ml_distribute",
                  sellUnitGBP: predictedTotal,
                  sellTotalGBP: predictedTotal,
                  predictedTotal,
                  estimateModelVersionId: productionModelId,
                } as any,
              },
            });
            await prisma.quote.update({ where: { id: quote.id }, data: { totalGBP: new Prisma.Decimal(predictedTotal) } });

            await logInferenceEvent({
              tenantId,
              model: inferenceModel,
              modelVersionId: productionModelId,
              inputHash,
              outputJson: { predictedTotal, currency, confidence, modelVersionId: productionModelId },
              confidence: confidence ?? undefined,
              latencyMs: 0,
              meta: { cacheHit: true, createdPlaceholderLine: true },
            });

            await logInsight({
              tenantId,
              module: inferenceModel,
              inputSummary: `quote:${quote.id}:${inputType}`,
              decision: productionModelId,
              confidence,
              userFeedback: {
                kind: inferenceModel,
                quoteId: quote.id,
                modelVersionId: productionModelId,
                estimatedTotal: predictedTotal,
                cacheHit: true,
                createdPlaceholderLine: true,
              },
            });

            return res.json({ ok: true, method, predictedTotal, totalGBP: predictedTotal, cacheHit: true, createdPlaceholderLine: true });
          }
          // Always distribute predicted total by quantity when using questionnaire-only mode
          let totalGBP = 0;
          const qtySum = quote.lines.reduce((s, ln) => s + Math.max(1, Number(ln.qty || 1)), 0);
          for (const ln of quote.lines) {
            const qty = Math.max(1, Number(ln.qty || 1));
            const sellTotal = predictedTotal > 0 ? (predictedTotal * qty) / Math.max(1, qtySum) : 0;
            const sellUnit = qty > 0 ? sellTotal / qty : 0;
            totalGBP += sellTotal;
            await prisma.quoteLine.update({
              where: { id: ln.id },
              data: {
                meta: {
                  set: {
                    ...(ln.meta as any || {}),
                    sellUnitGBP: sellUnit,
                    sellTotalGBP: sellTotal,
                    pricingMethod: "ml_distribute",
                    predictedTotal,
                    estimateModelVersionId: productionModelId,
                  },
                } as any,
              },
            });
          }
          await prisma.quote.update({ where: { id: quote.id }, data: { totalGBP: new Prisma.Decimal(totalGBP) } });

          const sanitizedEstimate: any = {
            predictedTotal,
            currency,
            confidence,
            modelVersionId: productionModelId,
          };

          await logInferenceEvent({
            tenantId,
            model: inferenceModel,
            modelVersionId: productionModelId,
            inputHash,
            outputJson: sanitizedEstimate,
            confidence: confidence ?? undefined,
            latencyMs: 0,
            meta: { cacheHit: true },
          });

          await logInsight({
            tenantId,
            module: inferenceModel,
            inputSummary: `quote:${quote.id}:${inputType}`,
            decision: productionModelId,
            confidence,
            userFeedback: {
              kind: inferenceModel,
              quoteId: quote.id,
              modelVersionId: productionModelId,
              estimatedTotal: predictedTotal,
              cacheHit: true,
            },
          });

          return res.json({ ok: true, method, predictedTotal, totalGBP, cacheHit: true });
        }
      }

      const startedAt = Date.now();
      const mlResp = await fetch(`${API_BASE}/ml/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(features),
      });
      const tookMs = Date.now() - startedAt;
      const mlText = await mlResp.text();
      let ml: any = {};
      try {
        ml = mlText ? JSON.parse(mlText) : {};
      } catch {
        ml = mlText ? { raw: mlText } : {};
      }

  const predictedTotal = safeNumber(ml?.predicted_total ?? ml?.predictedTotal ?? ml?.total) ?? 0;
      const confidenceRaw = safeNumber(ml?.confidence ?? ml?.probability ?? ml?.score);
      const confidence = confidenceRaw ?? 0;
      console.log(`[quotes/:id/price] ML response for quote ${quote.id}: predictedTotal=${predictedTotal}, confidence=${confidence}, raw:`, JSON.stringify(ml));
      
      if (predictedTotal <= 0) {
        console.warn(`[quotes/:id/price] ML predicted total is ${predictedTotal} for quote ${quote.id}, features:`, JSON.stringify(features));
      }
      
      let modelVersionId = extractModelVersionId(ml) || productionModelId || `external-${new Date().toISOString().slice(0, 10)}`;
      const currency = normalizeCurrency(ml?.currency || quote.currency || "GBP");

      // Fallback floor if ML prediction is non-positive
      let predictedTotalFinal = predictedTotal;
      let usedFallbackFloor = false;
      if (!(predictedTotalFinal > 0)) {
        predictedTotalFinal = MIN_ESTIMATE_GBP;
        usedFallbackFloor = true;
        modelVersionId = modelVersionId || "fallback-floor";
        console.warn(`[quotes/:id/price] ML predicted total non-positive; applying floor £${predictedTotalFinal} for quote ${quote.id}`);
      }

      // Only persist positive predictions to avoid poisoning the cache with zeros
      if (predictedTotalFinal > 0 && !usedFallbackFloor) {
        try {
          await prisma.estimate.create({
            data: {
              tenantId,
              quoteId: quote.id,
              inputType,
              inputHash,
              currency,
              estimatedTotal: predictedTotalFinal,
              confidence,
              modelVersionId,
            },
          });
        } catch (e: any) {
          console.warn(`[quotes] failed to persist Estimate for quote ${quote.id}:`, e?.message || e);
        }
      }

      // If there are no lines yet, create a single placeholder line so totals aren't £0
      let totalGBPForReturn = 0;
      if (!quote.lines || quote.lines.length === 0) {
        const currency = normalizeCurrency(ml?.currency || quote.currency || "GBP");
        const desc = (quote.title && `Estimated: ${quote.title}`) || "Estimated item";
        await prisma.quoteLine.create({
          data: {
            quoteId: quote.id,
            supplier: null as any,
            sku: undefined,
            description: desc,
            qty: 1,
            unitPrice: new Prisma.Decimal(0),
            currency,
            deliveryShareGBP: new Prisma.Decimal(0),
            lineTotalGBP: new Prisma.Decimal(predictedTotalFinal),
            meta: {
              pricingMethod: "ml_distribute",
              sellUnitGBP: predictedTotalFinal,
              sellTotalGBP: predictedTotalFinal,
              predictedTotal: predictedTotalFinal,
              estimateModelVersionId: modelVersionId,
            } as any,
          },
        });
        await prisma.quote.update({ where: { id: quote.id }, data: { totalGBP: new Prisma.Decimal(predictedTotalFinal) } });
        totalGBPForReturn = predictedTotalFinal;
      } else {
        // Always distribute by quantity in questionnaire-only mode
        let totalGBP = 0;
        const qtySum2 = quote.lines.reduce((s, ln) => s + Math.max(1, Number(ln.qty || 1)), 0);
        for (const ln of quote.lines) {
          const qty = Math.max(1, Number(ln.qty || 1));
          const sellTotal = predictedTotalFinal > 0 ? (predictedTotalFinal * qty) / Math.max(1, qtySum2) : 0;
          const sellUnit = qty > 0 ? sellTotal / qty : 0;
          totalGBP += sellTotal;
          await prisma.quoteLine.update({
            where: { id: ln.id },
            data: {
              meta: {
                set: {
                  ...(ln.meta as any || {}),
                  sellUnitGBP: sellUnit,
                  sellTotalGBP: sellTotal,
                  pricingMethod: "ml_distribute",
                  predictedTotal: predictedTotalFinal,
                  estimateModelVersionId: modelVersionId,
                },
              } as any,
            },
          });
        }
        await prisma.quote.update({ where: { id: quote.id }, data: { totalGBP: new Prisma.Decimal(totalGBP) } });
        totalGBPForReturn = totalGBP;
      }

      const sanitizedEstimate = {
        predictedTotal: predictedTotalFinal,
        currency,
        confidence,
        modelVersionId,
      } as any;
      if (ml?.metrics) sanitizedEstimate.metrics = ml.metrics;

      await logInferenceEvent({
        tenantId,
        model: inferenceModel,
        modelVersionId,
        inputHash,
        outputJson: sanitizedEstimate,
        confidence,
        latencyMs: tookMs,
      });

      await logInsight({
        tenantId,
        module: inferenceModel,
        inputSummary: `quote:${quote.id}:${inputType}`,
        decision: modelVersionId,
        confidence,
        userFeedback: {
          kind: inferenceModel,
          quoteId: quote.id,
          modelVersionId,
          latencyMs: tookMs,
          estimatedTotal: predictedTotal,
        },
      });

  return res.json({ ok: true, method, predictedTotal: predictedTotalFinal, totalGBP: totalGBPForReturn, fallbackFloor: usedFallbackFloor });
    }

    return res.status(400).json({ error: "invalid_method" });
  } catch (e: any) {
    console.error("[/quotes/:id/price] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /quotes/:id/delivery
 * Body: { amountGBP: number, method: "spread" | "single", lineId?: string }
 * Distributes delivery costs across quote lines.
 * - "spread": distributes proportionally across all lines by their sell total
 * - "single": applies entire delivery cost to a specific line (requires lineId)
 */
router.post("/:id/delivery", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const quote = await prisma.quote.findFirst({ where: { id, tenantId }, include: { lines: true } });
    if (!quote) return res.status(404).json({ error: "not_found" });

    const amountGBP = safeNumber(req.body?.amountGBP);
    if (amountGBP === null || amountGBP < 0) {
      return res.status(400).json({ error: "invalid_amount" });
    }

    const method = String(req.body?.method || "spread").toLowerCase();
    if (method !== "spread" && method !== "single") {
      return res.status(400).json({ error: "invalid_method" });
    }

    if (method === "single") {
      const lineId = String(req.body?.lineId || "");
      if (!lineId) return res.status(400).json({ error: "line_id_required" });
      
      const line = quote.lines.find((ln) => ln.id === lineId);
      if (!line) return res.status(404).json({ error: "line_not_found" });

      // Clear delivery from all other lines and apply full amount to target line
      for (const ln of quote.lines) {
        if (ln.id === lineId) {
          await prisma.quoteLine.update({
            where: { id: ln.id },
            data: { deliveryShareGBP: new Prisma.Decimal(amountGBP) },
          });
        } else {
          await prisma.quoteLine.update({
            where: { id: ln.id },
            data: { deliveryShareGBP: new Prisma.Decimal(0) },
          });
        }
      }

      return res.json({ ok: true, method: "single", amountGBP, lineId });
    }

    // Spread method: distribute proportionally by sellTotalGBP
    const totalSell = quote.lines.reduce((sum, ln) => {
      const lineMeta: any = (ln.meta as any) || {};
      const sellTotal = Number(lineMeta?.sellTotalGBP ?? ln.lineTotalGBP ?? 0);
      return sum + Math.max(0, sellTotal);
    }, 0);

    if (totalSell <= 0) {
      return res.status(400).json({ error: "no_sell_totals" });
    }

    let allocated = 0;
    const updates: Array<{ lineId: string; share: number }> = [];

    for (const ln of quote.lines) {
      const lineMeta: any = (ln.meta as any) || {};
      const sellTotal = Number(lineMeta?.sellTotalGBP ?? ln.lineTotalGBP ?? 0);
      const share = (sellTotal / totalSell) * amountGBP;
      allocated += share;
      updates.push({ lineId: ln.id, share });
    }

    // Apply updates
    for (const upd of updates) {
      await prisma.quoteLine.update({
        where: { id: upd.lineId },
        data: { deliveryShareGBP: new Prisma.Decimal(upd.share) },
      });
    }

    // Update quote deliveryCost
    await prisma.quote.update({
      where: { id: quote.id },
      data: { deliveryCost: new Prisma.Decimal(amountGBP) },
    });

    return res.json({ ok: true, method: "spread", amountGBP, allocated, lineCount: updates.length });
  } catch (e: any) {
    console.error("[/quotes/:id/delivery] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /quotes/:id/process-supplier
 * Process supplier PDFs with transformations:
 * - Currency conversion (if not GBP)
 * - Delivery cost distribution across line items
 * - Markup application from tenant settings
 * 
 * Body: {
 *   convertCurrency?: boolean;
 *   distributeDelivery?: boolean;
 *   hideDeliveryLine?: boolean;
 *   applyMarkup?: boolean;
 * }
 */
router.post("/:id/process-supplier", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const quoteId = String(req.params.id);
    
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: { supplierFiles: true, lines: true },
    });
    
    if (!quote) {
      return res.status(404).json({ error: "not_found" });
    }
    
    if (!quote.supplierFiles || quote.supplierFiles.length === 0) {
      return res.status(400).json({ error: "no_supplier_files" });
    }
    
    const {
      convertCurrency = true,
      distributeDelivery = true,
      hideDeliveryLine = true,
      applyMarkup = true,
    } = req.body || {};
    
    // Get tenant settings for markup percentage
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    
    const quoteDefaults: any = (tenantSettings?.quoteDefaults as any) || {};
    const markupPercent = Number(quoteDefaults?.defaultMargin ?? 0.25) * 100; // Convert to percentage
    
    // Parse supplier PDFs (reuse existing parse logic)
    const API_BASE = (
      process.env.APP_API_URL ||
      process.env.API_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${process.env.PORT || 4000}`
    ).replace(/\/$/, "");
    
  const parsedLines: any[] = [];
  let gibberishCount = 0;
  const skippedGibberishSamples: string[] = [];
    
    // Helper functions for robust field extraction (same as in parse endpoint)
    const pickQty = (ln: any): number | null => {
      const candidates = [ln?.qty, ln?.quantity];
      for (const c of candidates) {
        if (c != null) {
          const n = Number(c);
          if (Number.isFinite(n) && n > 0) return n;
        }
      }
      return null;
    };
    
    const pickUnitCost = (ln: any): number | null => {
      const candidates = [
        ln?.costUnit, ln?.unit_price, ln?.unitPrice, ln?.price,
        ln?.unit_cost, ln?.price_ex_vat, ln?.unit_price_ex_vat
      ];
      for (const c of candidates) {
        if (c != null) {
          const n = Number(c);
          if (Number.isFinite(n) && n >= 0) return n;
        }
      }
      return null;
    };
    
    const pickLineTotal = (ln: any): number | null => {
      const candidates = [
        ln?.lineTotal, ln?.line_total, ln?.total, ln?.price_ex_vat,
        ln?.amount, ln?.ex_vat_total
      ];
      for (const c of candidates) {
        if (c != null) {
          const n = Number(c);
          if (Number.isFinite(n) && n >= 0) return n;
        }
      }
      return null;
    };
    
    // Parse each supplier file
    for (const f of quote.supplierFiles) {
      if (!/pdf$/i.test(f.mimeType || "") && !/\.pdf$/i.test(f.name || "")) {
        continue;
      }
      
      const abs = path.isAbsolute(f.path) ? f.path : path.join(process.cwd(), f.path);
      let buffer: Buffer;
      
      try {
        buffer = await fs.promises.readFile(abs);
      } catch (err: any) {
        console.error(`[process-supplier] Failed to read file ${f.id}:`, err?.message);
        continue;
      }
      
      try {
        let parseResult = await parseSupplierPdf(buffer, {
          supplierHint: f.name ?? undefined,
          currencyHint: quote.currency || "GBP",
          supplierProfileId: quote.supplierProfileId ?? undefined,
        });

        // Fallback: if structured parser returns no lines, try simple fallback parser
        if (!parseResult?.lines || !Array.isArray(parseResult.lines) || parseResult.lines.length === 0) {
          try {
            const fb = await fallbackParseSupplierPdf(buffer);
            if (fb?.lines?.length) {
              parseResult = fb as any;
            }
          } catch (fallbackErr: any) {
            console.warn(
              `[process-supplier] Fallback parser failed for file ${f.id}:`,
              fallbackErr?.message || fallbackErr,
            );
          }
        }

        if (parseResult?.lines && Array.isArray(parseResult.lines)) {
          const sourceCurrency = parseResult.currency || quote.currency || "GBP";
          
          for (const ln of parseResult.lines) {
            const description = String(ln.description || (ln as any).desc || "Item");
            const pickedQty = pickQty(ln);
            const qty = Number.isFinite(Number(pickedQty)) && Number(pickedQty) > 0 ? Number(pickedQty) : 1;
            
            let unitPrice = pickUnitCost(ln);
            let lineTotalParsed = pickLineTotal(ln);
            
            if ((unitPrice == null || !(unitPrice > 0)) && lineTotalParsed != null && qty > 0) {
              unitPrice = lineTotalParsed / qty;
            }
            if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice < 0) {
              unitPrice = 0;
            }
            
            // Quality filtering to remove gibberish OCR lines
            const desc = String(description || "").trim();
            const quality = (() => {
              if (!desc) return 0;
              const len = desc.length;
              if (len < 3) return 0; // too short
              const printable = desc.replace(/[\r\n]/g, "").split("").filter(ch => /[\x20-\x7E]/.test(ch)).length;
              const asciiRatio = printable / len;
              const alphaNum = desc.replace(/[^A-Za-z0-9]/g, "").length / len;
              const weirdChars = desc.replace(/[A-Za-z0-9\s£€$.,\-\/()%]/g, "").length / len;
              let score = 0;
              if (asciiRatio > 0.85) score += 0.4; else if (asciiRatio > 0.7) score += 0.25;
              if (alphaNum > 0.4) score += 0.4; else if (alphaNum > 0.25) score += 0.25;
              if (weirdChars < 0.15) score += 0.2; else if (weirdChars < 0.3) score += 0.1;
              return Math.min(1, score);
            })();
            const isGibberish = quality < 0.5;
            if (isGibberish) {
              // Skip but record a sample for diagnostics (limit meta array growth)
              skippedGibberishSamples.push(desc.slice(0, 140));
              gibberishCount += 1;
              continue;
            }

            parsedLines.push({
              description: desc,
              qty,
              unitPrice,
              fileId: f.id,
              sourceCurrency,
              currency: sourceCurrency,
              meta: {
                source: "supplier-parser",
                raw: ln,
                qualityScore: quality,
              },
            });
          }
        }
      } catch (err: any) {
        console.error(`[process-supplier] Failed to parse file ${f.id}:`, err?.message);
        continue;
      }
    }
    
    if (parsedLines.length === 0) {
      return res.status(400).json({ error: "no_lines_parsed", gibberishSkipped: gibberishCount, gibberishSamples: skippedGibberishSamples.slice(0,5) });
    }
    
    // Step 1: Currency conversion
    if (convertCurrency) {
      for (const line of parsedLines) {
        if (line.sourceCurrency && line.sourceCurrency !== "GBP") {
          // Store original price in meta
          line.meta = line.meta || {};
          line.meta.originalCurrency = line.sourceCurrency;
          line.meta.originalPrice = line.unitPrice;
          
          // TODO: Implement actual currency conversion using exchange rate API
          // For now, using placeholder conversion rates
          const rates: Record<string, number> = {
            EUR: 1.17,
            USD: 1.27,
            GBP: 1.0,
          };
          
          const rate = rates[line.sourceCurrency] || 1.0;
          line.unitPrice = (line.unitPrice || 0) * rate;
          line.currency = "GBP";
        }
      }
    }
    
    // Step 2: Identify and distribute delivery costs
    let deliveryLines: any[] = [];
    let nonDeliveryLines: any[] = [];
    
    for (const line of parsedLines) {
      const desc = (line.description || "").toLowerCase();
      if (desc.includes("delivery") || desc.includes("shipping") || desc.includes("freight")) {
        deliveryLines.push(line);
      } else {
        nonDeliveryLines.push(line);
      }
    }
    
    if (distributeDelivery && deliveryLines.length > 0) {
      // Calculate total delivery cost
      const totalDelivery = deliveryLines.reduce((sum, line) => {
        return sum + ((line.unitPrice || 0) * (line.qty || 1));
      }, 0);
      
      // Calculate total value of non-delivery lines
      const totalValue = nonDeliveryLines.reduce((sum, line) => {
        return sum + ((line.unitPrice || 0) * (line.qty || 1));
      }, 0);
      
      if (totalValue > 0) {
        // Distribute delivery cost proportionally
        for (const line of nonDeliveryLines) {
          const lineValue = (line.unitPrice || 0) * (line.qty || 1);
          const proportion = lineValue / totalValue;
          const deliveryShare = totalDelivery * proportion;
          
          line.meta = line.meta || {};
          line.meta.deliveryDistributed = deliveryShare;
          line.meta.priceBeforeDelivery = line.unitPrice;
          
          // Add delivery share to unit price
          line.unitPrice = (line.unitPrice || 0) + (deliveryShare / (line.qty || 1));
        }
        
        // Remove delivery lines if requested
        if (hideDeliveryLine) {
          parsedLines.splice(0, parsedLines.length, ...nonDeliveryLines);
        }
      }
    }
    
    // Step 3: Apply markup
    if (applyMarkup) {
      for (const line of parsedLines) {
        // Skip delivery lines if they're still included
        const desc = (line.description || "").toLowerCase();
        if (!hideDeliveryLine && (desc.includes("delivery") || desc.includes("shipping"))) {
          continue;
        }
        
        line.meta = line.meta || {};
        line.meta.priceBeforeMarkup = line.unitPrice;
        line.meta.markupPercent = markupPercent;
        line.meta.markupAmount = (line.unitPrice || 0) * (markupPercent / 100);
        
        // Apply markup to create sell price
        const sellUnit = (line.unitPrice || 0) * (1 + markupPercent / 100);
        line.meta.sellUnitGBP = sellUnit;
        line.meta.sellTotalGBP = sellUnit * (line.qty || 1);
      }
    }
    
    // Save lines to database (with numeric sanitization to avoid overflow)
    const MAX_UNIT_PRICE = 100000; // Upper bound for realistic per-unit supplier costs
    const MAX_QTY = 10000;         // Guard against OCR producing huge quantities
    const sanitizeNumber = (raw: any, def = 0) => {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return def;
      if (n > 1e12) return def; // absolute hard cap (corrupt extraction)
      return n;
    };

    const cleanedLines = parsedLines
      .map((line) => {
        const originalQty = line.qty;
        const originalUnit = line.unitPrice;
        const qty = sanitizeNumber(originalQty, 1);
        let unit = sanitizeNumber(originalUnit, 0);

        // Clamp unrealistic values
        let clamped = false;
        if (qty > MAX_QTY) { clamped = true; }
        if (unit > MAX_UNIT_PRICE) { clamped = true; }
        const finalQty = Math.min(qty, MAX_QTY);
        const finalUnit = Math.min(unit, MAX_UNIT_PRICE);

        if (finalQty <= 0) return null; // discard nonsensical

        // Update meta with sanitization info
        line.meta = line.meta || {};
        if (clamped || finalQty !== originalQty || finalUnit !== originalUnit) {
          line.meta.sanitized = true;
          line.meta.originalValues = { qty: originalQty, unitPrice: originalUnit };
          line.meta.finalValues = { qty: finalQty, unitPrice: finalUnit };
        }

        return {
          quoteId: quote.id,
          description: line.description || "Item",
          qty: finalQty,
          unitPrice: finalUnit,
          currency: "GBP",
          meta: line.meta,
        };
      })
      .filter(Boolean) as Array<{
        quoteId: string;
        description: string;
        qty: number;
        unitPrice: number;
        currency: string;
        meta: any;
      }>;

    if (!cleanedLines.length) {
      return res.status(400).json({
        error: "parse_sanitized_empty",
        detail: "All parsed lines discarded due to invalid numeric values",
      });
    }

    const linesToSave = cleanedLines.map((line) => ({
      quoteId: line.quoteId,
      description: line.description,
      qty: new Prisma.Decimal(line.qty),
      unitPrice: new Prisma.Decimal(line.unitPrice),
      currency: line.currency,
      // Provide computed totals into meta; database lineTotalGBP will default or can be derived later
      meta: {
        ...(line.meta || {}),
        lineTotalComputedGBP: line.unitPrice * line.qty,
      },
    }));
    
    // Delete existing lines and insert new ones
    await prisma.quoteLine.deleteMany({
      where: { quoteId: quote.id },
    });
    
    await prisma.quoteLine.createMany({
      data: linesToSave,
    });
    
    // Update quote metadata
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        meta: {
          ...(quote.meta as any || {}),
          lastProcessedAt: new Date().toISOString(),
          processedWithMarkup: applyMarkup,
          processedWithDeliveryDistribution: distributeDelivery,
        },
      },
    });
    
    // Fetch updated lines
    const updatedLines = await prisma.quoteLine.findMany({
      where: { quoteId: quote.id },
    });
    
    // Log training data for ML improvement
    try {
      const inputHash = crypto
        .createHash("sha256")
        .update(`${tenantId}:${quoteId}:${Date.now()}`)
        .digest("hex")
        .slice(0, 16);
      
      await logInferenceEvent({
        tenantId,
        model: "supplier_processor",
        modelVersionId: `v1-${new Date().toISOString().slice(0, 10)}`,
        inputHash,
        outputJson: {
          linesProcessed: parsedLines.length,
          currencyConversions: parsedLines.filter(l => l.meta?.originalCurrency).length,
          deliveryLinesFound: deliveryLines.length,
          markupApplied: applyMarkup,
          markupPercent: applyMarkup ? markupPercent : null,
        },
        confidence: 1.0,
        meta: {
          quoteId: quote.id,
          supplierFileCount: quote.supplierFiles.length,
          convertCurrency,
          distributeDelivery,
          hideDeliveryLine,
          applyMarkup,
        },
      });
      
      await logInsight({
        tenantId,
        module: "supplier_processor",
        inputSummary: `quote:${quote.id}:process-supplier`,
        decision: `processed_${parsedLines.length}_lines`,
        confidence: 1.0,
        userFeedback: {
          kind: "supplier_processor",
          quoteId: quote.id,
          linesProcessed: parsedLines.length,
          markupPercent,
        },
      });
    } catch (err: any) {
      console.warn("[process-supplier] Training log failed:", err?.message);
    }
    
    return res.json({
      lines: updatedLines,
      count: updatedLines.length,
      gibberishSkipped: gibberishCount,
      gibberishSample: skippedGibberishSamples.slice(0,5),
    });
  } catch (e: any) {
    console.error("[/quotes/:id/process-supplier] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error", detail: e?.message });
  }
});

/**
 * POST /quotes/:id/send-email
 * Send quote PDF to client via email
 * 
 * Body: {
 *   to?: string;              // Override recipient email (defaults to lead.email)
 *   subject?: string;         // Override email subject
 *   includeAttachment?: boolean; // Include PDF attachment (default: true)
 * }
 */
router.post("/:id/send-email", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
    const quoteId = String(req.params.id);
    const userId = req.auth.userId as string;
    
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: {
        lead: true,
        tenant: true,
        lines: true,
      },
    });
    
    if (!quote) {
      return res.status(404).json({ error: "not_found" });
    }
    
    // Determine recipient email
    const recipientEmail = req.body?.to || quote.lead?.email;
    if (!recipientEmail) {
      return res.status(400).json({ 
        error: "no_email", 
        message: "No email address found for this lead" 
      });
    }
    
    // Check if PDF exists
    const pdfUrl = (quote.meta as any)?.proposalPdfUrl || null;
    if (!pdfUrl && req.body?.includeAttachment !== false) {
      return res.status(400).json({ 
        error: "no_pdf", 
        message: "Generate a PDF first before sending email" 
      });
    }
    
    // Get tenant settings
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
    
    const tenantName = quote.tenant?.name || "us";
    const clientName = quote.lead?.contactName || recipientEmail.split("@")[0];
    
    // Calculate totals for email
    const quoteDefaults: any = (tenantSettings?.quoteDefaults as any) || {};
    const marginDefault = Number(quote.markupDefault ?? quoteDefaults?.defaultMargin ?? 0.25);
    
    const subtotal = quote.lines.reduce((sum, ln) => {
      const lineMeta: any = (ln.meta as any) || {};
      const sellTotal = Number(lineMeta?.sellTotalGBP ?? 0);
      return sum + Math.max(0, sellTotal);
    }, 0);
    
    const vatRate = Number(quoteDefaults?.vatRate ?? 0.2);
    const showVat = quoteDefaults?.showVat !== false;
    const vatAmount = showVat ? subtotal * vatRate : 0;
    const totalGBP = subtotal + vatAmount;
    
    const currency = quote.currency || "GBP";
    const sym = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "USD" ? "$" : currency;
    
    // Build email content
    const subject = req.body?.subject || `Quote from ${tenantName}`;
    
    const bodyText = `
Hi ${clientName},

Please find attached your quote from ${tenantName}.

Quote Summary:
- Total: ${sym}${totalGBP.toFixed(2)}
- Line Items: ${quote.lines.length}
- Valid Until: 30 days from today

If you have any questions or would like to discuss this quote, please don't hesitate to contact us.

Best regards,
${tenantName}
    `.trim();
    
    const bodyHtml = `
      <p>Hi ${clientName},</p>
      <p>Please find attached your quote from ${tenantName}.</p>
      <h3>Quote Summary:</h3>
      <ul>
        <li><strong>Total:</strong> ${sym}${totalGBP.toFixed(2)}</li>
        <li><strong>Line Items:</strong> ${quote.lines.length}</li>
        <li><strong>Valid Until:</strong> 30 days from today</li>
      </ul>
      <p>If you have any questions or would like to discuss this quote, please don't hesitate to contact us.</p>
      <p>Best regards,<br/>${tenantName}</p>
    `;
    
    // Send email using existing email service
    const { sendEmailViaUser } = require("../services/email-sender");
    
    await sendEmailViaUser(userId, {
      to: recipientEmail,
      subject,
      body: bodyText,
      html: bodyHtml,
      fromName: tenantName,
    });
    
    // TODO: Log activity when proper activity model is available
    // Could use ActivityLog or create a QuoteActivity record
    
    // Update quote status if this is first send
    if (quote.status === "DRAFT" || !quote.status) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "SENT" },
      });
    }
    
    // Record quote for ML training when sent to client
    try {
      const { recordQuoteForTraining } = await import("../services/training");
      await recordQuoteForTraining(quote.id);
    } catch (trainingErr: any) {
      console.warn("[/quotes/:id/send-email] Failed to record for training:", trainingErr.message);
      // Don't fail the request if training recording fails
    }
    
    return res.json({
      success: true,
      sentTo: recipientEmail,
      sentAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[/quotes/:id/send-email] failed:", e?.message || e);
    return res.status(500).json({ 
      error: "internal_error", 
      detail: e?.message 
    });
  }
});

export default router;