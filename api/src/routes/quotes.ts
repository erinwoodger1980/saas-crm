// api/src/routes/quotes.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../env";

import { callMlWithSignedUrl, callMlWithUpload, normaliseMlPayload } from "../lib/ml";
import { fallbackParseSupplierPdf } from "../lib/pdf/fallback";
import { parseSupplierPdf } from "../lib/supplier/parse";
import type { SupplierParseResult } from "../types/parse";
import { logInsight, logInferenceEvent } from "../services/training";
import { redactSupplierLine } from "../lib/ml/redact";
import { sendParserErrorAlert, sendParserFallbackAlert } from "../lib/ops/alerts";

const router = Router();

type ParserStageName = NonNullable<SupplierParseResult["usedStages"]>[number];

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

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
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
  };
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
    const tenantId = req.auth.tenantId as string;
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
    }));

    return res.json(out);
  } catch (e: any) {
    console.error("[/quotes/:id/lines] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /quotes/:id/lines/:lineId
 * Body: { qty?: number | null; unitPrice?: number | null; meta?: Record<string, any> }
 * Updates a single quote line allowing inline editing from the quote builder.
 * - Validates ownership (tenant + quote)
 * - Recalculates sellUnitGBP & sellTotalGBP if margin/pricing info present
 * - Applies markupDefault from quote when pricingMethod === 'margin' and margin not provided
 */
router.patch("/:id/lines/:lineId", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.auth.tenantId as string;
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

    // Determine pricing/sell values. Priority:
    // 1. Explicit sellUnitGBP/sellTotalGBP in incoming meta
    // 2. Margin-based calculation if pricingMethod === 'margin'
    // 3. Preserve existing sell values
    let sellUnitGBP: number | null = safeNumber(incomingMeta?.sellUnitGBP ?? incomingMeta?.sell_unit);
    let sellTotalGBP: number | null = safeNumber(incomingMeta?.sellTotalGBP ?? incomingMeta?.sell_total);
    const pricingMethod = String(mergedMeta?.pricingMethod || existingMeta?.pricingMethod || "") || null;

    if (sellUnitGBP == null && pricingMethod === "margin") {
      const margin = safeNumber(incomingMeta?.margin ?? existingMeta?.margin) ?? Number(quote.markupDefault ?? 0.25);
      if (Number.isFinite(margin) && margin >= 0) {
        sellUnitGBP = Number(unitPrice) * (1 + margin);
        sellTotalGBP = sellUnitGBP * Number(qty);
        mergedMeta.margin = margin;
        mergedMeta.pricingMethod = "margin";
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
  const tenantId = req.auth.tenantId as string;
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
  const tenantId = req.auth.tenantId as string;
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
  res.json(q);
});

/** GET /quotes/:id */
router.get("/:id", requireAuth, async (req: any, res) => {
  const tenantId = req.auth.tenantId as string;
  const id = String(req.params.id);
  const q = await prisma.quote.findFirst({
    where: { id, tenantId },
    include: { lines: true, supplierFiles: true },
  });
  if (!q) return res.status(404).json({ error: "not_found" });
  res.json(q);
});

/** POST /quotes/:id/files  (multipart form-data: files[]) */
router.post("/:id/files", requireAuth, upload.array("files", 10), async (req: any, res) => {
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
        kind: "SUPPLIER_QUOTE",
        name: f.originalname,
        path: path.relative(process.cwd(), f.path),
        mimeType: f.mimetype,
        sizeBytes: f.size,
      },
    });
    saved.push(row);
  }

  // TODO: parse PDFs, extract tables → quote lines
  // For now, return files and leave lines empty.
  res.json({ ok: true, files: saved });
});

export default router;

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
    return res.json({ ok: true, quote: saved });
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
        try {
          const hybrid = await parseSupplierPdf(buffer, {
            supplierHint: supplierHint ?? f.name ?? undefined,
            currencyHint: quote.currency || "GBP",
          });
          parseResult = hybrid;
          info.hybrid = { used: true, confidence: hybrid.confidence, stages: hybrid.usedStages };
          if (hybrid.warnings) hybrid.warnings.forEach((w: string) => warnings.add(w));
        } catch (err: any) {
          info.hybrid = { used: false, error: err?.message || String(err) };
          warnings.add(`Hybrid parser failed for ${f.name || f.id}: ${err?.message || err}`);
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

        if (!parseResult || parseResult.lines.length === 0) {
          const fallback = await fallbackParseSupplierPdf(buffer);
          parseResult = fallback;
          info.usedFallback = true;
          fallbackUsed += 1;
          console.warn(`[parse] quote ${quote.id} file ${f.id} using fallback parser (mlErrors=${mlErrors.length})`);
          if (fallback.warnings) fallback.warnings.forEach((w) => warnings.add(w));
          if (mlErrors.length) {
            warnings.add(`ML parser failed for ${f.name || f.id}; fallback parser applied.`);
          }
        } else if (parseResult.warnings) {
          parseResult.warnings.forEach((w) => warnings.add(w));
        }

        info.warnings = parseResult?.warnings || [];
        if (parseResult?.confidence != null) info.confidence = parseResult.confidence;
        if (parseResult?.detected_totals) info.detected_totals = parseResult.detected_totals;
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

        let lineIndex = 0;
        for (const ln of parseResult.lines) {
          lineIndex += 1;
          const description = String(ln.description || `${f.name || "Line"} ${lineIndex}`);
          const qtyRaw = Number(ln.qty ?? 1);
          const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
          let unitPrice = Number(ln.costUnit ?? (ln.lineTotal != null ? ln.lineTotal / qty : 0));
          if (!Number.isFinite(unitPrice) || unitPrice < 0) unitPrice = 0;

          const meta: any = {
            source: info.usedFallback ? "fallback-parser" : "ml-parse",
            raw: ln,
            parsed: parseResult,
            fallback: info.usedFallback,
            confidence: parseResult.confidence ?? null,
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

          parsedLinesForDb.push({
            tenantId,
            quoteId: quote.id,
            page: (ln as any)?.page ?? null,
            rawText: String((ln as any)?.rawText ?? description ?? ""),
            description: description ?? null,
            qty: safeNumber(ln.qty),
            costUnit: safeNumber(ln.costUnit),
            lineTotal: safeNumber(ln.lineTotal),
            currency,
            supplier: supplier ?? null,
            confidence: safeNumber((ln as any)?.confidence) ?? inferredConfidence,
            usedStages,
          });
        }

        info.lineCount = parseResult.lines.length;
        info.currency = currency;
        info.supplier = supplier;
        summaries.push(info);

        const sanitizedOutput = sanitiseParseResult(parseResult, supplier, currency);
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
      return {
        ok: true,
        created: created.length,
        fails,
        fallbackUsed,
        summaries,
        warnings: warningsArr,
        timeoutMs: TIMEOUT_MS,
        message: fallbackUsed ? "ML could not parse some files. Fallback parser applied." : undefined,
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
 * Renders a simple PDF proposal for the quote lines using Puppeteer and stores it as an UploadedFile.
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
      return res.status(500).json({ error: "render_failed", reason: "puppeteer_not_installed" });
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
    const brand = (ts?.brandName || (quote.tenant as any)?.brandName || "Quotation").toString();
    const logoUrl = (ts?.logoUrl || "").toString();
    const phone = (ts?.phone || quoteDefaults?.phone || "").toString();
    const website = (ts?.website || (Array.isArray(ts?.links) ? undefined : (ts?.links as any)?.website) || "").toString();
    const client = quote.lead?.contactName || quote.lead?.email || "Client";
    const title = quote.title || `Estimate for ${client}`;
    const when = new Date().toLocaleDateString();
    const validDays = Number(quoteDefaults?.validDays ?? 30);
    const validUntil = new Date(Date.now() + Math.max(0, validDays) * 86400000).toLocaleDateString();
    const vatRate = Number(quoteDefaults?.vatRate ?? 0.2);
    const showVat = quoteDefaults?.showVat !== false; // default true for UK
    const terms = (quoteDefaults?.terms as string) || "Prices are valid for 30 days and subject to site survey. Payment terms: 50% upfront, 50% on delivery unless agreed otherwise.";

    // Summaries
    const marginDefault = Number(quote.markupDefault ?? quoteDefaults?.defaultMargin ?? 0.25);
    const rows = quote.lines.map((ln) => {
      const qty = Number(ln.qty || 1);
      // Prefer previously priced sellUnitGBP; otherwise apply default margin over supplier unitPrice
      const metaAny: any = (ln.meta as any) || {};
      const sellUnit = Number(metaAny?.sellUnitGBP ?? (Number(ln.unitPrice || 0) * (1 + marginDefault)));
      const total = qty * sellUnit;
      return {
        description: ln.description,
        qty,
        unit: sellUnit,
        total,
      };
    });
    let subtotal = rows.reduce((s, r) => s + (Number.isFinite(r.total) ? r.total : 0), 0);
    // Fallback: if line totals are not populated yet but quote.totalGBP exists, use it for totals
    if (!(subtotal > 0)) {
      const fallbackSubtotal = Number(quote.totalGBP ?? 0);
      if (Number.isFinite(fallbackSubtotal) && fallbackSubtotal > 0) {
        subtotal = fallbackSubtotal;
      }
    }
    const vatAmount = showVat ? subtotal * vatRate : 0;
    const computedTotal = subtotal + vatAmount;
    // Always use computed total (subtotal + VAT) for display consistency
    const totalGBP = computedTotal;

    const styles = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          color: #1e293b; 
          line-height: 1.6;
          padding: 0;
        }
        .page { padding: 32px 40px; max-width: 210mm; }
        
        /* Header Section */
        .header { 
          border-bottom: 3px solid #0ea5e9; 
          padding-bottom: 20px; 
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .header-left { flex: 1; }
        .header-right { text-align: right; font-size: 11px; color: #64748b; line-height: 1.8; }
        .brand { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
        .brand img { max-height: 50px; }
        .brand-name { font-size: 24px; font-weight: 700; color: #0f172a; }
        .tagline { font-size: 12px; color: #64748b; font-style: italic; margin-bottom: 16px; }
        h1 { 
          font-size: 26px; 
          font-weight: 700; 
          color: #0f172a; 
          margin: 0 0 4px; 
          letter-spacing: -0.5px;
        }
        .project-title { font-size: 16px; color: #0ea5e9; font-weight: 600; }
        .client-name { font-size: 14px; color: #475569; margin-top: 4px; }
        
        /* Project Overview Grid */
        .overview-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr 1fr; 
          gap: 20px; 
          margin: 24px 0;
          padding: 20px;
          background: #f8fafc;
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
          line-height: 1.6;
        }
        
        /* Detailed Quotation Section */
        .quotation-intro { 
          font-size: 13px; 
          color: #475569; 
          margin: 28px 0 16px;
          line-height: 1.7;
        }
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 28px 0 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e2e8f0;
        }
        
        /* Table Styles */
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 16px 0; 
          font-size: 11px;
          background: white;
        }
        thead th { 
          background: #f1f5f9; 
          color: #475569;
          font-weight: 600; 
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.5px;
          padding: 12px 14px;
          border-bottom: 2px solid #cbd5e1;
          text-align: left;
        }
        tbody td { 
          padding: 12px 14px; 
          border-bottom: 1px solid #e2e8f0; 
          vertical-align: top;
          color: #334155;
        }
        tbody tr:hover { background: #fafafa; }
        .right { text-align: right; }
        .amount-cell { font-weight: 600; color: #0f172a; }
        
        /* Totals Section */
        .totals-wrapper { 
          display: flex; 
          justify-content: flex-end; 
          margin: 20px 0;
        }
        .totals { 
          min-width: 300px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .totals .row { 
          display: flex; 
          justify-content: space-between; 
          padding: 12px 16px; 
          border-bottom: 1px solid #e2e8f0;
          font-size: 12px;
        }
        .totals .row:last-child { border-bottom: none; }
        .totals .row.subtotal { background: #f8fafc; }
        .totals .row.total { 
          background: #0ea5e9; 
          color: white; 
          font-weight: 700;
          font-size: 14px;
        }
        .totals .label { color: #64748b; }
        .totals .value { font-weight: 600; color: #0f172a; }
        .totals .row.total .label,
        .totals .row.total .value { color: white; }
        
        /* Guarantee/Benefits Section */
        .guarantee-section {
          margin: 32px 0;
          padding: 24px;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 8px;
          border: 1px solid #bae6fd;
        }
        .guarantee-section h2 {
          font-size: 18px;
          font-weight: 700;
          color: #0c4a6e;
          margin-bottom: 16px;
          text-align: center;
        }
        .guarantee-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .guarantee-item {
          text-align: center;
          padding: 16px;
        }
        .guarantee-item h4 {
          font-size: 13px;
          font-weight: 700;
          color: #0369a1;
          margin-bottom: 8px;
        }
        .guarantee-item p {
          font-size: 11px;
          color: #475569;
          line-height: 1.6;
        }
        
        /* Terms & Footer */
        .terms-section {
          margin-top: 28px;
          padding: 16px;
          background: #f8fafc;
          border-left: 4px solid #0ea5e9;
          border-radius: 4px;
        }
        .terms-section h3 {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .terms-section p {
          font-size: 11px;
          color: #475569;
          line-height: 1.7;
        }
        footer { 
          margin-top: 32px; 
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 10px; 
          color: #94a3b8;
          text-align: center;
        }
      </style>`;

  const ref = `Q-${quote.id.slice(0, 8).toUpperCase()}`;
  // Lead model doesn't include refId/location/meta; use custom JSON for optional fields
  const leadCustom: any = (quote.lead?.custom as any) || {};
  const jobNumber = (leadCustom?.refId as string) || ref;
  const projectName = quote.title || `Project for ${client}`;
  const address = (leadCustom?.address as string) || "";
    const tagline = quoteDefaults?.tagline || "Timber Joinery Specialists";
    
    // Extract specifications from quote meta or lines
    const quoteMeta: any = (quote.meta as any) || {};
    const specifications = quoteMeta?.specifications || {};
    const timber = specifications.timber || quoteDefaults?.defaultTimber || "Engineered timber";
    const finish = specifications.finish || quoteDefaults?.defaultFinish || "Factory finished";
    const glazing = specifications.glazing || quoteDefaults?.defaultGlazing || "Low-energy double glazing";
    const compliance = specifications.compliance || quoteDefaults?.compliance || "Industry standards";
    
    // Project scope description
    const scopeDescription = quoteMeta?.scopeDescription || 
      `This project involves supplying bespoke timber joinery products crafted to meet your specifications. All products are manufactured to the highest standards and comply with ${compliance}.`;

    const html = `<!doctype html>
      <html>
      <head><meta charset="utf-8" />${styles}</head>
      <body>
        <div class="page">
          <!-- Header Section -->
          <header class="header">
            <div class="header-left">
              <div class="brand">
                ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(brand)}" />` : `<div class="brand-name">${escapeHtml(brand)}</div>`}
              </div>
              ${tagline ? `<div class="tagline">${escapeHtml(tagline)}</div>` : ""}
              <h1>Project Quotation</h1>
              <div class="project-title">${escapeHtml(projectName)}</div>
              <div class="client-name">Client: ${escapeHtml(client)} • ${when}</div>
            </div>
            <div class="header-right">
              ${phone ? `<div>Telephone: ${escapeHtml(phone)}</div>` : ""}
              ${quoteDefaults?.email ? `<div>Email: ${escapeHtml(quoteDefaults.email)}</div>` : ""}
              ${address ? `<div>Address: ${escapeHtml(address)}</div>` : ""}
            </div>
          </header>

          <!-- Project Overview Section -->
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
              ${address ? `<div class="detail-line"><strong>Delivery:</strong> ${escapeHtml(address)}</div>` : ""}
            </div>
            
            <div class="overview-section">
              <h3>Specification Summary</h3>
              <div class="detail-line"><strong>Timber:</strong> ${escapeHtml(timber)}</div>
              <div class="detail-line"><strong>Finish:</strong> ${escapeHtml(finish)}</div>
              <div class="detail-line"><strong>Glazing:</strong> ${escapeHtml(glazing)}</div>
              ${specifications.fittings ? `<div class="detail-line"><strong>Fittings:</strong> ${escapeHtml(specifications.fittings)}</div>` : ""}
              ${specifications.ventilation ? `<div class="detail-line"><strong>Ventilation:</strong> ${escapeHtml(specifications.ventilation)}</div>` : ""}
              <div class="detail-line"><strong>Compliance:</strong> ${escapeHtml(compliance)}</div>
              <div class="detail-line"><strong>Currency:</strong> ${cur}</div>
            </div>
            
            <div class="overview-section">
              <h3>Project Scope</h3>
              <div class="project-scope">${escapeHtml(scopeDescription)}</div>
            </div>
          </div>

          <!-- Detailed Quotation Section -->
          <h2 class="section-title">Detailed Quotation</h2>
          <p class="quotation-intro">
            Following the technical specifications outlined above, this section provides a comprehensive 
            breakdown of the proposed investment for your project. The quotation details each component, 
            quantity, and dimensions, culminating in the total project cost.
          </p>

          <table>
            <thead>
              <tr>
                <th style="width:50%">Item Description</th>
                <th class="right" style="width:12%">Quantity</th>
                <th style="width:18%">Dimensions</th>
                <th class="right" style="width:20%">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r) => {
                    const lineMeta: any = (quote.lines.find(ln => ln.description === r.description)?.meta as any) || {};
                    const dimensions = lineMeta?.dimensions || "";
                    const showAmount = quoteDefaults?.showLineItems !== false;
                    return `
                    <tr>
                      <td>${escapeHtml(r.description || "-")}</td>
                      <td class="right">${r.qty.toLocaleString()}</td>
                      <td>${escapeHtml(dimensions)}</td>
                      <td class="right amount-cell">${showAmount ? sym + r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Included"}</td>
                    </tr>`;
                  }
                )
                .join("")}
            </tbody>
          </table>

          <!-- Totals Section -->
          <div class="totals-wrapper">
            <div class="totals">
              <div class="row subtotal">
                <div class="label">Subtotal (Ex VAT)</div>
                <div class="value">${sym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              ${showVat ? `
              <div class="row">
                <div class="label">VAT (${(vatRate*100).toFixed(0)}%)</div>
                <div class="value">${sym}${vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>` : ""}
              <div class="row total">
                <div class="label">Grand Total (Incl VAT)</div>
                <div class="value">${sym}${totalGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <!-- Guarantee/Benefits Section (if configured) -->
          ${quoteDefaults?.guarantees && Array.isArray(quoteDefaults.guarantees) && quoteDefaults.guarantees.length > 0 ? `
          <div class="guarantee-section">
            <h2>${escapeHtml(quoteDefaults.guaranteeTitle || brand + " Guarantee")}</h2>
            <div class="guarantee-grid">
              ${quoteDefaults.guarantees.slice(0, 3).map((g: any) => `
                <div class="guarantee-item">
                  <h4>${escapeHtml(g.title || "")}</h4>
                  <p>${escapeHtml(g.description || "")}</p>
                </div>
              `).join("")}
            </div>
          </div>` : ""}

          ${renderSections(quoteDefaults)}

          <!-- Terms Section -->
          <div class="terms-section">
            <h3>Terms & Conditions</h3>
            <p>${escapeHtml(terms)}</p>
          </div>

          <footer>
            <div>Quote Reference: ${ref} • Valid until ${validUntil}</div>
            ${website || phone ? `<div>${escapeHtml(website)}${website && phone ? " • " : ""}${escapeHtml(phone)}</div>` : ""}
            <div style="margin-top:8px;">Thank you for considering ${escapeHtml(brand)} for your project.</div>
          </footer>
        </div>
      </body>
      </html>`;

    let browser: any;
    let firstLaunchError: any;
    try {
      // Prefer Puppeteer's resolved executable if available; fall back to env
      const resolvedExec = typeof puppeteer.executablePath === "function" ? puppeteer.executablePath() : undefined;
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
      console.warn("[/quotes/:id/render-pdf] puppeteer launch failed; trying @sparticuz/chromium fallback:", err?.message || err);
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
        console.error("[/quotes/:id/render-pdf] chromium fallback launch failed:", fallbackErr?.message || fallbackErr);
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
      pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
      await browser.close();
    } catch (err: any) {
      try { if (browser) await browser.close(); } catch {}
      console.error("[/quotes/:id/render-pdf] pdf generation failed:", err?.message || err);
      return res.status(500).json({ error: "render_failed", reason: "pdf_generation_failed" });
    }

    const filenameSafe = (title || `Quote ${quote.id}`).replace(/[^\w.\-]+/g, "_");
    const filename = `${filenameSafe}.pdf`;
    const filepath = path.join(UPLOAD_DIR, `${Date.now()}__${filename}`);
    try {
      fs.writeFileSync(filepath, pdfBuffer);
    } catch (err: any) {
      console.error("[/quotes/:id/render-pdf] write file failed:", err?.message || err);
      return res.status(500).json({ error: "render_failed", reason: "write_failed" });
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
    await prisma.quote.update({ where: { id: quote.id }, data: { proposalPdfUrl: null, meta: { ...(meta0 || {}), proposalFileId: fileRow.id } as any } as any });
    return res.json({ ok: true, fileId: fileRow.id, name: fileRow.name });
  } catch (e: any) {
    console.error("[/quotes/:id/render-pdf] failed:", e?.message || e);
    return res.status(500).json({ error: "render_failed", reason: "unknown" });
  }
});

/**
 * POST /quotes/:id/render-proposal
 * Alias for /render-pdf - generates and saves the beautiful proposal PDF
 * (Complete duplicate implementation to ensure frontend compatibility)
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
      return res.status(500).json({ error: "render_failed", reason: "puppeteer_not_installed" });
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
    const brand = (ts?.brandName || (quote.tenant as any)?.brandName || "Quotation").toString();
    const logoUrl = (ts?.logoUrl || "").toString();
    const phone = (ts?.phone || quoteDefaults?.phone || "").toString();
    const website = (ts?.website || (Array.isArray(ts?.links) ? undefined : (ts?.links as any)?.website) || "").toString();
    const client = quote.lead?.contactName || quote.lead?.email || "Client";
    const title = quote.title || `Estimate for ${client}`;
    const when = new Date().toLocaleDateString();
    const validDays = Number(quoteDefaults?.validDays ?? 30);
    const validUntil = new Date(Date.now() + Math.max(0, validDays) * 86400000).toLocaleDateString();
    const vatRate = Number(quoteDefaults?.vatRate ?? 0.2);
    const showVat = quoteDefaults?.showVat !== false; // default true for UK
    const terms = (quoteDefaults?.terms as string) || "Prices are valid for 30 days and subject to site survey. Payment terms: 50% upfront, 50% on delivery unless agreed otherwise.";

    // Summaries
    const marginDefault = Number(quote.markupDefault ?? quoteDefaults?.defaultMargin ?? 0.25);
    const rows = quote.lines.map((ln) => {
      const qty = Number(ln.qty || 1);
      // Prefer previously priced sellUnitGBP; otherwise apply default margin over supplier unitPrice
      const metaAny: any = (ln.meta as any) || {};
      const sellUnit = Number(metaAny?.sellUnitGBP ?? (Number(ln.unitPrice || 0) * (1 + marginDefault)));
      const total = qty * sellUnit;
      return {
        description: ln.description,
        qty,
        unit: sellUnit,
        total,
      };
    });
    let subtotal = rows.reduce((s, r) => s + (Number.isFinite(r.total) ? r.total : 0), 0);
    // Fallback: if line totals are not populated yet but quote.totalGBP exists, use it for totals
    if (!(subtotal > 0)) {
      const fallbackSubtotal = Number(quote.totalGBP ?? 0);
      if (Number.isFinite(fallbackSubtotal) && fallbackSubtotal > 0) {
        subtotal = fallbackSubtotal;
      }
    }
    const vatAmount = showVat ? subtotal * vatRate : 0;
    const computedTotal = subtotal + vatAmount;
    // Always use computed total (subtotal + VAT) for display consistency
    const totalGBP = computedTotal;

    const styles = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          color: #1e293b; 
          line-height: 1.6;
          padding: 0;
        }
        .page { padding: 32px 40px; max-width: 210mm; }
        
        /* Header Section */
        .header { 
          border-bottom: 3px solid #0ea5e9; 
          padding-bottom: 20px; 
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .header-left { flex: 1; }
        .header-right { text-align: right; font-size: 11px; color: #64748b; line-height: 1.8; }
        .brand { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
        .brand img { max-height: 50px; }
        .brand-name { font-size: 24px; font-weight: 700; color: #0f172a; }
        .tagline { font-size: 12px; color: #64748b; font-style: italic; margin-bottom: 16px; }
        h1 { 
          font-size: 26px; 
          font-weight: 700; 
          color: #0f172a; 
          margin: 0 0 4px; 
          letter-spacing: -0.5px;
        }
        .project-title { font-size: 16px; color: #0ea5e9; font-weight: 600; }
        .client-name { font-size: 14px; color: #475569; margin-top: 4px; }
        
        /* Project Overview Grid */
        .overview-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr 1fr; 
          gap: 20px; 
          margin: 24px 0;
          padding: 20px;
          background: #f8fafc;
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
          line-height: 1.6;
        }
        
        /* Detailed Quotation Section */
        .quotation-intro { 
          font-size: 13px; 
          color: #475569; 
          margin: 28px 0 16px;
          line-height: 1.7;
        }
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 28px 0 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e2e8f0;
        }
        
        /* Table Styles */
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 16px 0; 
          font-size: 11px;
          background: white;
        }
        thead th { 
          background: #f1f5f9; 
          color: #475569;
          font-weight: 600; 
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.5px;
          padding: 12px 14px;
          border-bottom: 2px solid #cbd5e1;
          text-align: left;
        }
        tbody td { 
          padding: 12px 14px; 
          border-bottom: 1px solid #e2e8f0; 
          vertical-align: top;
          color: #334155;
        }
        tbody tr:hover { background: #fafafa; }
        .right { text-align: right; }
        .amount-cell { font-weight: 600; color: #0f172a; }
        
        /* Totals Section */
        .totals-wrapper { 
          display: flex; 
          justify-content: flex-end; 
          margin: 20px 0;
        }
        .totals { 
          min-width: 300px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .totals .row { 
          display: flex; 
          justify-content: space-between; 
          padding: 12px 16px; 
          border-bottom: 1px solid #e2e8f0;
          font-size: 12px;
        }
        .totals .row:last-child { border-bottom: none; }
        .totals .row.subtotal { background: #f8fafc; }
        .totals .row.total { 
          background: #0ea5e9; 
          color: white; 
          font-weight: 700;
          font-size: 14px;
        }
        .totals .label { color: #64748b; }
        .totals .value { font-weight: 600; color: #0f172a; }
        .totals .row.total .label,
        .totals .row.total .value { color: white; }
        
        /* Guarantee/Benefits Section */
        .guarantee-section {
          margin: 32px 0;
          padding: 24px;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 8px;
          border: 1px solid #bae6fd;
        }
        .guarantee-section h2 {
          font-size: 18px;
          font-weight: 700;
          color: #0c4a6e;
          margin-bottom: 16px;
          text-align: center;
        }
        .guarantee-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .guarantee-item {
          text-align: center;
          padding: 16px;
        }
        .guarantee-item h4 {
          font-size: 13px;
          font-weight: 700;
          color: #0369a1;
          margin-bottom: 8px;
        }
        .guarantee-item p {
          font-size: 11px;
          color: #475569;
          line-height: 1.6;
        }
        
        /* Terms & Footer */
        .terms-section {
          margin-top: 28px;
          padding: 16px;
          background: #f8fafc;
          border-left: 4px solid #0ea5e9;
          border-radius: 4px;
        }
        .terms-section h3 {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .terms-section p {
          font-size: 11px;
          color: #475569;
          line-height: 1.7;
        }
        footer { 
          margin-top: 32px; 
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
          font-size: 10px; 
          color: #94a3b8;
          text-align: center;
        }
      </style>`;

  const ref = `Q-${quote.id.slice(0, 8).toUpperCase()}`;
  // Lead model doesn't include refId/location/meta; use custom JSON for optional fields
  const leadCustom: any = (quote.lead?.custom as any) || {};
  const jobNumber = (leadCustom?.refId as string) || ref;
  const projectName = quote.title || `Project for ${client}`;
  const address = (leadCustom?.address as string) || "";
    const tagline = quoteDefaults?.tagline || "Timber Joinery Specialists";
    
    // Extract specifications from quote meta or lines
    const quoteMeta: any = (quote.meta as any) || {};
    const specifications = quoteMeta?.specifications || {};
    const timber = specifications.timber || quoteDefaults?.defaultTimber || "Engineered timber";
    const finish = specifications.finish || quoteDefaults?.defaultFinish || "Factory finished";
    const glazing = specifications.glazing || quoteDefaults?.defaultGlazing || "Low-energy double glazing";
    const compliance = specifications.compliance || quoteDefaults?.compliance || "Industry standards";
    
    // Project scope description
    const scopeDescription = quoteMeta?.scopeDescription || 
      `This project involves supplying bespoke timber joinery products crafted to meet your specifications. All products are manufactured to the highest standards and comply with ${compliance}.`;

    const html = `<!doctype html>
      <html>
      <head><meta charset="utf-8" />${styles}</head>
      <body>
        <div class="page">
          <!-- Header Section -->
          <header class="header">
            <div class="header-left">
              <div class="brand">
                ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(brand)}" />` : `<div class="brand-name">${escapeHtml(brand)}</div>`}
              </div>
              ${tagline ? `<div class="tagline">${escapeHtml(tagline)}</div>` : ""}
              <h1>Project Quotation</h1>
              <div class="project-title">${escapeHtml(projectName)}</div>
              <div class="client-name">Client: ${escapeHtml(client)} • ${when}</div>
            </div>
            <div class="header-right">
              ${phone ? `<div>Telephone: ${escapeHtml(phone)}</div>` : ""}
              ${quoteDefaults?.email ? `<div>Email: ${escapeHtml(quoteDefaults.email)}</div>` : ""}
              ${address ? `<div>Address: ${escapeHtml(address)}</div>` : ""}
            </div>
          </header>

          <!-- Project Overview Section -->
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
              ${address ? `<div class="detail-line"><strong>Delivery:</strong> ${escapeHtml(address)}</div>` : ""}
            </div>
            
            <div class="overview-section">
              <h3>Specification Summary</h3>
              <div class="detail-line"><strong>Timber:</strong> ${escapeHtml(timber)}</div>
              <div class="detail-line"><strong>Finish:</strong> ${escapeHtml(finish)}</div>
              <div class="detail-line"><strong>Glazing:</strong> ${escapeHtml(glazing)}</div>
              ${specifications.fittings ? `<div class="detail-line"><strong>Fittings:</strong> ${escapeHtml(specifications.fittings)}</div>` : ""}
              ${specifications.ventilation ? `<div class="detail-line"><strong>Ventilation:</strong> ${escapeHtml(specifications.ventilation)}</div>` : ""}
              <div class="detail-line"><strong>Compliance:</strong> ${escapeHtml(compliance)}</div>
              <div class="detail-line"><strong>Currency:</strong> ${cur}</div>
            </div>
            
            <div class="overview-section">
              <h3>Project Scope</h3>
              <div class="project-scope">${escapeHtml(scopeDescription)}</div>
            </div>
          </div>

          <!-- Detailed Quotation Section -->
          <h2 class="section-title">Detailed Quotation</h2>
          <p class="quotation-intro">
            Following the technical specifications outlined above, this section provides a comprehensive 
            breakdown of the proposed investment for your project. The quotation details each component, 
            quantity, and dimensions, culminating in the total project cost.
          </p>

          <table>
            <thead>
              <tr>
                <th style="width:50%">Item Description</th>
                <th class="right" style="width:12%">Quantity</th>
                <th style="width:18%">Dimensions</th>
                <th class="right" style="width:20%">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r) => {
                    const lineMeta: any = (quote.lines.find(ln => ln.description === r.description)?.meta as any) || {};
                    const dimensions = lineMeta?.dimensions || "";
                    const showAmount = quoteDefaults?.showLineItems !== false;
                    return `
                    <tr>
                      <td>${escapeHtml(r.description || "-")}</td>
                      <td class="right">${r.qty.toLocaleString()}</td>
                      <td>${escapeHtml(dimensions)}</td>
                      <td class="right amount-cell">${showAmount ? sym + r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Included"}</td>
                    </tr>`;
                  }
                )
                .join("")}
            </tbody>
          </table>

          <!-- Totals Section -->
          <div class="totals-wrapper">
            <div class="totals">
              <div class="row subtotal">
                <div class="label">Subtotal (Ex VAT)</div>
                <div class="value">${sym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              ${showVat ? `
              <div class="row">
                <div class="label">VAT (${(vatRate*100).toFixed(0)}%)</div>
                <div class="value">${sym}${vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>` : ""}
              <div class="row total">
                <div class="label">Grand Total (Incl VAT)</div>
                <div class="value">${sym}${totalGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <!-- Guarantee/Benefits Section (if configured) -->
          ${quoteDefaults?.guarantees && Array.isArray(quoteDefaults.guarantees) && quoteDefaults.guarantees.length > 0 ? `
          <div class="guarantee-section">
            <h2>${escapeHtml(quoteDefaults.guaranteeTitle || brand + " Guarantee")}</h2>
            <div class="guarantee-grid">
              ${quoteDefaults.guarantees.slice(0, 3).map((g: any) => `
                <div class="guarantee-item">
                  <h4>${escapeHtml(g.title || "")}</h4>
                  <p>${escapeHtml(g.description || "")}</p>
                </div>
              `).join("")}
            </div>
          </div>` : ""}

          ${renderSections(quoteDefaults)}

          <!-- Terms Section -->
          <div class="terms-section">
            <h3>Terms & Conditions</h3>
            <p>${escapeHtml(terms)}</p>
          </div>

          <footer>
            <div>Quote Reference: ${ref} • Valid until ${validUntil}</div>
            ${website || phone ? `<div>${escapeHtml(website)}${website && phone ? " • " : ""}${escapeHtml(phone)}</div>` : ""}
            <div style="margin-top:8px;">Thank you for considering ${escapeHtml(brand)} for your project.</div>
          </footer>
        </div>
      </body>
      </html>`;

    let browser: any;
    let firstLaunchError: any;
    try {
      // Prefer Puppeteer's resolved executable if available; fall back to env
      const resolvedExec = typeof puppeteer.executablePath === "function" ? puppeteer.executablePath() : undefined;
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
      console.warn("[/quotes/:id/render-proposal] puppeteer launch failed; trying @sparticuz/chromium fallback:", err?.message || err);
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
        console.error("[/quotes/:id/render-proposal] chromium fallback launch failed:", fallbackErr?.message || fallbackErr);
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
      pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
      await browser.close();
    } catch (err: any) {
      try { if (browser) await browser.close(); } catch {}
      console.error("[/quotes/:id/render-proposal] pdf generation failed:", err?.message || err);
      return res.status(500).json({ error: "render_failed", reason: "pdf_generation_failed" });
    }

    const filenameSafe = (title || `Quote ${quote.id}`).replace(/[^\w.\-]+/g, "_");
    const filename = `${filenameSafe}.pdf`;
    const filepath = path.join(UPLOAD_DIR, `${Date.now()}__${filename}`);
    try {
      fs.writeFileSync(filepath, pdfBuffer);
    } catch (err: any) {
      console.error("[/quotes/:id/render-proposal] write file failed:", err?.message || err);
      return res.status(500).json({ error: "render_failed", reason: "write_failed" });
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
    await prisma.quote.update({ where: { id: quote.id }, data: { proposalPdfUrl: null, meta: { ...(meta0 || {}), proposalFileId: fileRow.id } as any } as any });
    return res.json({ ok: true, fileId: fileRow.id, name: fileRow.name });
  } catch (e: any) {
    console.error("[/quotes/:id/render-proposal] failed:", e?.message || e);
    return res.status(500).json({ error: "render_failed", reason: "unknown" });
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
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const quote = await prisma.quote.findFirst({ where: { id, tenantId }, include: { lines: true, tenant: true, lead: true } });
    if (!quote) return res.status(404).json({ error: "not_found" });
    const method = String(req.body?.method || "margin");
    const margin = Number(req.body?.margin ?? quote.markupDefault ?? 0.25);

    if (method === "margin") {
      // apply simple margin over supplier unitPrice
      let totalGBP = 0;
      for (const ln of quote.lines) {
        const cost = Number(ln.unitPrice) * Number(ln.qty);
        const sellUnit = Number(ln.unitPrice) * (1 + margin);
        const sellTotal = sellUnit * Number(ln.qty);
        totalGBP += sellTotal;
        await prisma.quoteLine.update({ where: { id: ln.id }, data: { meta: { set: { ...(ln.meta as any || {}), sellUnitGBP: sellUnit, sellTotalGBP: sellTotal, pricingMethod: "margin", margin } } } as any });
      }
  await prisma.quote.update({ where: { id: quote.id }, data: { totalGBP: new Prisma.Decimal(totalGBP), markupDefault: new Prisma.Decimal(margin) } });
      return res.json({ ok: true, method, margin, totalGBP });
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