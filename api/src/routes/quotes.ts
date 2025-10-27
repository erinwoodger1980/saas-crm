// api/src/routes/quotes.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { openai } from "../ai";

const router = Router();

type QuoteParseSuccess = {
  source: "openai" | "ml";
  parsed: any;
  supplier?: string;
  currency?: string;
  details?: Record<string, any> | null;
};

type QuoteParseFailure = {
  source: "openai" | "ml";
  error: any;
};

const OPENAI_QUOTE_MODEL = process.env.OPENAI_QUOTE_MODEL || "gpt-4.1-mini";

const quoteStructuredOutputSchema = {
  type: "json_schema",
  json_schema: {
    name: "SupplierQuote",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        supplier: { type: "string", description: "Supplier or vendor name on the quote." },
        currency: {
          type: "string",
          description: "Three letter currency code found on the quote (e.g. GBP, EUR, USD).",
        },
        detected_total: {
          anyOf: [
            { type: "number" },
            { type: "string" },
            { type: "null" },
          ],
          description: "Grand total of the quote if explicitly stated.",
        },
        lines: {
          type: "array",
          description: "Individual line items listed on the supplier quote.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["description"],
            properties: {
              description: { type: "string", description: "Line item description" },
              quantity: {
                anyOf: [
                  { type: "number" },
                  { type: "string" },
                  { type: "null" },
                ],
                description: "Quantity for the line item.",
              },
              unit_price: {
                anyOf: [
                  { type: "number" },
                  { type: "string" },
                  { type: "null" },
                ],
                description: "Unit price for the line item.",
              },
              total_price: {
                anyOf: [
                  { type: "number" },
                  { type: "string" },
                  { type: "null" },
                ],
                description: "Total price for the line item if provided.",
              },
              currency: {
                type: "string",
                description: "Currency noted for the specific line, if different from the document currency.",
              },
              sku: { type: "string", description: "SKU or product identifier if present." },
              notes: { type: "string", description: "Any notes, delivery info or additional context for the item." },
            },
          },
        },
      },
      required: ["lines"],
    },
  },
} as const;

function pickLines(...candidates: any[]): any[] {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function resolveSupplier(src: any): string | undefined {
  if (!src || typeof src !== "object") return undefined;
  const candidates = [
    src.supplier,
    src.supplier_name,
    src.supplierName,
    src.vendor,
    src.vendor_name,
    src.vendorName,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.trim());
  return found ? String(found).trim() : undefined;
}

function resolveCurrency(src: any): string | undefined {
  if (!src || typeof src !== "object") return undefined;
  const candidates = [src.currency, src.currency_code, src.currencyCode];
  const found = candidates.find((v) => typeof v === "string" && v.trim());
  return found ? String(found).trim().toUpperCase() : undefined;
}

type ParsedQuoteSummary = {
  normalized: any;
  normalizedQuote: any;
  lines: any[];
  supplier?: string;
  currency?: string;
};

interface ParsedLine {
  code?: string;
  description?: string;
  item?: string;
  name?: string;
  title?: string;
  notes?: string;
  qty?: number | string;
  quantity?: number | string;
  units?: number | string;
  unit_price?: number | string;
  unitPrice?: number | string;
  price_each?: number | string;
  priceEach?: number | string;
  price?: number | string;
  rate?: number | string;
  unit?: string;
  total?: number | string;
  total_price?: number | string;
  totalPrice?: number | string;
  currency?: string;
  sku?: string;
  [key: string]: unknown;
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[, ]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const safeQty = (value: unknown): number => {
  const quantity = toNumber(value);
  return quantity > 0 ? quantity : 1;
};

const safeUnit = (value: unknown): string => {
  return typeof value === "string" && value.trim() ? value.trim() : "unit";
};

function normaliseParsedQuote(parsed: any): ParsedQuoteSummary {
  const normalized = parsed && typeof parsed === "object" && parsed.parsed ? parsed.parsed : parsed;
  const normalizedQuote =
    normalized && typeof normalized === "object" && !Array.isArray(normalized)
      ? typeof (normalized as any).quote === "object" && !Array.isArray((normalized as any).quote)
        ? (normalized as any).quote
        : null
      : null;

  const lines = pickLines(
    (normalizedQuote as any)?.lines,
    (normalizedQuote as any)?.line_items,
    (normalizedQuote as any)?.lineItems,
    (normalizedQuote as any)?.items,
    (normalized as any)?.lines,
    (normalized as any)?.line_items,
    (normalized as any)?.lineItems,
    (normalized as any)?.items,
  );

  const supplier = resolveSupplier(normalizedQuote) || resolveSupplier(normalized);
  const currency = resolveCurrency(normalizedQuote) || resolveCurrency(normalized);

  return { normalized, normalizedQuote, lines, supplier, currency };
}

async function parseQuoteWithOpenAI(filePath: string, filename: string): Promise<QuoteParseSuccess | QuoteParseFailure> {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch (err: any) {
    return { source: "openai", error: { message: "file_unreadable", detail: err?.message || String(err) } };
  }

  try {
    const uploaded = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "assistants",
    });

    try {
      const systemPrompt =
        "You are an expert assistant that extracts structured line items from supplier PDF quotes. " +
        "Return accurate quantities, unit prices, totals, currencies and supplier details.";
      const userPrompt =
        `The attached supplier quote is named "${filename}". ` +
        "Extract every purchasable line item from the document. " +
        "Infer missing quantities or unit prices when possible, and include totals if present. " +
        "Respond using the provided JSON schema. Do not invent line items.";

      const response = await openai.responses.parse({
        model: OPENAI_QUOTE_MODEL,
        temperature: 0,
        max_output_tokens: 2000,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: userPrompt },
              { type: "input_file", file_id: uploaded.id, filename },
            ],
          },
        ],
        response_format: quoteStructuredOutputSchema as any,
      });

      const parsed = response.output_parsed;
      if (parsed && typeof parsed === "object") {
        const norm = normaliseParsedQuote(parsed);
        return {
          source: "openai",
          parsed,
          supplier: norm.supplier,
          currency: norm.currency,
          details: {
            model: OPENAI_QUOTE_MODEL,
            responseId: response.id,
            usage: response.usage || null,
          },
        };
      }
      return {
        source: "openai",
        parsed,
        supplier: undefined,
        currency: undefined,
        details: {
          model: OPENAI_QUOTE_MODEL,
          responseId: response.id,
          usage: response.usage || null,
        },
      };
    } finally {
      try {
        await openai.files.del(uploaded.id);
      } catch (cleanupErr) {
        console.warn("[quotes:openai] failed to delete uploaded file", cleanupErr);
      }
    }
  } catch (err: any) {
    return {
      source: "openai",
      error: {
        message: err?.message || String(err),
        type: err?.type || undefined,
        code: err?.code || undefined,
      },
    };
  }
}

async function parseQuoteWithLegacyML(
  apiBase: string,
  fileId: string,
  token: string,
  filename: string | null,
  authHeader: string,
  timeoutMs: number,
): Promise<QuoteParseSuccess | QuoteParseFailure> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${apiBase}/ml/parse-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader || "" },
      body: JSON.stringify({
        url: `${apiBase}/files/${encodeURIComponent(fileId)}?jwt=${encodeURIComponent(token)}`,
        filename: filename || undefined,
      }),
      signal: ctl.signal as any,
    } as any);

    const text = await resp.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    if (!resp.ok) {
      return {
        source: "ml",
        error: {
          status: resp.status,
          body: parsed,
        },
      };
    }

    const norm = normaliseParsedQuote(parsed);
    return {
      source: "ml",
      parsed,
      supplier: norm.supplier,
      currency: norm.currency,
      details: { status: resp.status },
    };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? `timeout_${timeoutMs}ms` : err?.message || String(err);
    return { source: "ml", error: { message: msg } };
  } finally {
    clearTimeout(timer);
  }
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.tenantId) return res.status(401).json({ error: "unauthorized" });
  next();
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
  try {
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const quote = await prisma.quote.findFirst({ where: { id, tenantId }, include: { supplierFiles: true } });
    if (!quote) return res.status(404).json({ error: "not_found" });

    // Build base URL for serving files
    const API_BASE = (
      process.env.APP_API_URL ||
      process.env.API_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${process.env.PORT || 4000}`
    ).replace(/\/$/, "");

    // Worker to perform parsing
    const doParse = async () => {
      const created: any[] = [];
      const fails: Array<{ fileId: string; name?: string | null; error?: any }> = [];
      const TIMEOUT_MS = Math.max(
        2000,
        Number(process.env.ML_TIMEOUT_MS || (process.env.NODE_ENV === "production" ? 6000 : 10000)),
      );
      const filesToParse = [...quote.supplierFiles]
        .filter((x) => /pdf$/i.test(x.mimeType || "") || /\.pdf$/i.test(x.name || ""))
        .sort(
          (a: any, b: any) =>
            new Date(b.uploadedAt || b.createdAt || 0).getTime() -
            new Date(a.uploadedAt || a.createdAt || 0).getTime(),
        )
        .slice(0, 1);

      for (const f of filesToParse) {
        const attemptErrors: QuoteParseFailure[] = [];
        let selected: QuoteParseSuccess | null = null;

        const absPath = path.isAbsolute(f.path) ? f.path : path.join(process.cwd(), f.path);
        const aiAttempt = await parseQuoteWithOpenAI(absPath, f.name || "supplier-quote.pdf");
        if ("parsed" in aiAttempt) {
          const { lines } = normaliseParsedQuote(aiAttempt.parsed);
          if (Array.isArray(lines) && lines.length > 0) {
            selected = aiAttempt;
          } else {
            attemptErrors.push({ source: "openai", error: { message: "no_lines", parsed: aiAttempt.parsed } });
          }
        } else {
          attemptErrors.push(aiAttempt);
        }

        if (!selected) {
          const token = jwt.sign({ t: tenantId, q: quote.id }, env.APP_JWT_SECRET, { expiresIn: "30m" });
          const mlAttempt = await parseQuoteWithLegacyML(
            API_BASE,
            f.id,
            token,
            f.name || null,
            req.headers.authorization || "",
            TIMEOUT_MS,
          );
          if ("parsed" in mlAttempt) {
            const { lines } = normaliseParsedQuote(mlAttempt.parsed);
            if (Array.isArray(lines) && lines.length > 0) {
              selected = mlAttempt;
            } else {
              attemptErrors.push({ source: "ml", error: { message: "no_lines", parsed: mlAttempt.parsed } });
            }
          } else {
            attemptErrors.push(mlAttempt);
          }
        }

        if (!selected) {
          fails.push({ fileId: f.id, name: f.name, error: { attempts: attemptErrors } });
          continue;
        }

        const parsedSummary = normaliseParsedQuote(selected.parsed);
        const parsedPayload = parsedSummary.normalized;
        const parsedQuote = parsedSummary.normalizedQuote;
        const supplierFromParse = parsedSummary.supplier;
        const currencyFromParse = parsedSummary.currency;
        const lines = Array.isArray(parsedSummary.lines) ? parsedSummary.lines : [];

        for (const ln of lines) {
          if (!ln || typeof ln !== "object") continue;

          const parsed = ln as ParsedLine;
          const description = String(
            parsed.description || parsed.item || parsed.name || parsed.title || f.name || "Line",
          );

          const quantityValue = parsed.qty ?? parsed.quantity ?? parsed.units ?? 1;
          const qty = safeQty(quantityValue);

          const unitRaw =
            parsed.unit_price ?? parsed.unitPrice ?? parsed.price_each ?? parsed.priceEach ?? parsed.price ?? parsed.rate;
          let unitPrice = toNumber(unitRaw);
          if (!(unitPrice > 0)) {
            const totalRaw = parsed.total ?? parsed.total_price ?? parsed.totalPrice;
            const total = toNumber(totalRaw);
            if (total > 0 && qty > 0) {
              unitPrice = total / qty;
            }
          }
          const safeUnitPrice = unitPrice > 0 && Number.isFinite(unitPrice) ? unitPrice : 0;

          const currencySource =
            resolveCurrency(parsed) || currencyFromParse || selected.currency || quote.currency || "GBP";
          const lineCurrency = String(currencySource || "GBP").toUpperCase();

          const lineSupplier =
            resolveSupplier(parsed) || supplierFromParse || selected.supplier || (quote as any).supplier || undefined;

          const metaPayload: Record<string, any> = {
            source: selected.source === "openai" ? "openai-parse" : "ml-parse",
            raw: parsed,
            parsed: parsedPayload || undefined,
            quote: parsedQuote || undefined,
          };
          if (typeof parsed.unit === "string" && parsed.unit.trim()) {
            metaPayload.unit = safeUnit(parsed.unit);
          }
          if (selected.details) metaPayload.details = selected.details;

          const row = await prisma.quoteLine.create({
            data: {
              quoteId: quote.id,
              supplier: lineSupplier as any,
              sku: typeof parsed.sku === "string" && parsed.sku.trim() ? parsed.sku : undefined,
              description,
              qty,
              unitPrice: new Prisma.Decimal(safeUnitPrice),
              currency: lineCurrency,
              deliveryShareGBP: new Prisma.Decimal(0),
              lineTotalGBP: new Prisma.Decimal(0),
              meta: metaPayload,
            },
          });
          created.push(row);
        }
      }

      if (created.length === 0) return { error: "parse_failed", created: 0, fails } as const;
      return { ok: true, created: created.length, fails } as const;
    };

    const preferAsync = (process.env.NODE_ENV === "production") && String(req.query.async ?? "1") !== "0";
    if (preferAsync) {
      // Record that a parse started (so UI can surface status)
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
          if ((out as any).error) console.warn(`[parse async] quote ${id} failed:`, out);
        } catch (e: any) {
          console.error(`[parse async] quote ${id} crashed:`, e?.message || e);
          try {
            await prisma.quote.update({
              where: { id: quote.id },
              data: { meta: { ...((quote.meta as any) || {}), lastParse: { state: "error", finishedAt: new Date().toISOString(), error: String(e?.message || e) } } as any },
            } as any);
          } catch {}
        }
      });
      return res.json({ ok: true, async: true });
    }

    const out = await doParse();
    if ((out as any).error) return res.status(502).json(out);
    return res.json(out);
  } catch (e: any) {
    console.error("[/quotes/:id/parse] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

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
      // Call ML to get an estimated total based on questionnaire answers; then scale per-line proportions by cost
      const API_BASE = (
        process.env.APP_API_URL || process.env.API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`
      ).replace(/\/$/, "");
      const features: any = (quote.lead?.custom as any) || {};
      const mlResp = await fetch(`${API_BASE}/ml/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(features) });
      let ml: any = {};
      try { ml = await mlResp.json(); } catch {}
      const predictedTotal = Number(ml?.predicted_total ?? 0) || 0;
      const costSum = quote.lines.reduce((s, ln) => s + Number(ln.unitPrice) * Number(ln.qty), 0);
      const scale = costSum > 0 && predictedTotal > 0 ? predictedTotal / costSum : 1;
      let totalGBP = 0;
      for (const ln of quote.lines) {
        const costUnit = Number(ln.unitPrice);
        const sellUnit = costUnit * scale;
        const sellTotal = sellUnit * Number(ln.qty);
        totalGBP += sellTotal;
        await prisma.quoteLine.update({ where: { id: ln.id }, data: { meta: { set: { ...(ln.meta as any || {}), sellUnitGBP: sellUnit, sellTotalGBP: sellTotal, pricingMethod: "ml", scale, predictedTotal } } } as any });
      }
  await prisma.quote.update({ where: { id: quote.id }, data: { totalGBP: new Prisma.Decimal(totalGBP) } });
      return res.json({ ok: true, method, predictedTotal, totalGBP });
    }

    return res.status(400).json({ error: "invalid_method" });
  } catch (e: any) {
    console.error("[/quotes/:id/price] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});