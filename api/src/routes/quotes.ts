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

const router = Router();

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
    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
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

        if (!parseResult || parseResult.lines.length === 0) {
          fails.push({
            fileId: f.id,
            name: f.name,
            status: 422,
            error: {
              error: parseResult?.error || "no_lines_detected",
              mlErrors,
              warnings: parseResult?.warnings,
            },
          });
          summaries.push(info);
          continue;
        }

        const currency = normalizeCurrency(parseResult.currency || quote.currency || "GBP");
        const supplier = parseResult.supplier || undefined;
        const usedStages = Array.isArray(parseResult.usedStages)
          ? parseResult.usedStages.join(",")
          : info.usedFallback
          ? "fallback"
          : null;

        const hashSource = buffer ? buffer : Buffer.from(url);
        const inputHash = sha256(tenantId, ":", quote.id, ":", f.id, ":", hashSource);
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
          if ((out as any).error) console.warn(`[parse async] quote ${id} failed:`, out);
        } catch (e: any) {
          console.error(`[parse async] quote ${id} crashed:`, e?.message || e);
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
        }
      });
      return res.json({ ok: true, async: true });
    }

    const out = await doParse();
    if ((out as any).error) {
      const status = (out as any).error === "no_files" ? 400 : 502;
      return res.status(status).json(out);
    }
    return res.json(out);
  } catch (e: any) {
    console.error("[/quotes/:id/parse] failed:", e?.message || e);
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
    const subtotal = rows.reduce((s, r) => s + (Number.isFinite(r.total) ? r.total : 0), 0);
    const vatAmount = showVat ? subtotal * vatRate : 0;
    const computedTotal = subtotal + vatAmount;
    // Prefer explicit quote.totalGBP if set (from pricing), else computed
    const totalGBP = Number(quote.totalGBP ?? computedTotal);

    const styles = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 28px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .muted { color: #64748b; }
        .meta { color: #475569; font-size: 12px; }
        .grid { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .brand { display:flex; align-items:center; gap:12px; }
        .brand img { max-height: 40px; }
        .ref { font-size: 12px; color:#334155; }
        .section { margin-top: 16px; }
        .section h2 { font-size: 14px; margin: 0 0 6px; color:#0f172a; }
        .list { margin: 0; padding-left: 18px; font-size:12px; color:#334155; }
        .box { border:1px solid #e2e8f0; border-radius:6px; padding:10px; background:#f8fafc; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        th { background: #f8fafc; font-weight: 600; }
        tfoot td { border-top: 2px solid #0ea5e9; font-weight: 700; }
        .right { text-align: right; }
        .totals { margin-top: 8px; width: 50%; margin-left:auto; }
        .totals .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed #e2e8f0; }
        .totals .row.total { border-bottom: none; font-weight:700; }
        footer { margin-top: 18px; font-size: 11px; color:#475569; }
      </style>`;

    const ref = `Q-${quote.id.slice(0, 8).toUpperCase()}`;

    const html = `<!doctype html>
      <html>
      <head><meta charset="utf-8" />${styles}</head>
      <body>
        <header class="grid">
          <div class="brand">
            ${logoUrl ? `<img src="${logoUrl}" alt="logo" />` : ""}
            <div>
              <h1>${escapeHtml(brand)}</h1>
              <div class="meta">${website || phone ? `${escapeHtml(website)}${website && phone ? " · " : ""}${escapeHtml(phone)}` : ""}</div>
            </div>
          </div>
          <div class="meta right">
            <div class="ref"><strong>Quote Ref:</strong> ${ref}</div>
            <div><strong>Date:</strong> ${when}</div>
            <div><strong>Valid until:</strong> ${validUntil}</div>
            <div><strong>Currency:</strong> ${cur}</div>
          </div>
        </header>

        <div class="section">
          <div class="meta"><strong>To:</strong> ${escapeHtml(client)}</div>
          <div class="meta"><strong>Title:</strong> ${escapeHtml(title)}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:60%">Description</th>
              <th class="right" style="width:10%">Qty</th>
              <th class="right" style="width:15%">Unit</th>
              <th class="right" style="width:15%">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
                <tr>
                  <td>${escapeHtml(r.description || "-")}</td>
                  <td class="right">${r.qty.toLocaleString()}</td>
                  <td class="right">${sym}${r.unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td class="right">${sym}${r.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="section">
          <div class="box muted">Prices shown include our standard margin${Number.isFinite(marginDefault) && marginDefault>0 ? ` of ${(marginDefault*100).toFixed(0)}%` : ""}.</div>
        </div>
        <div class="totals">
          <div class="row"><div>Subtotal</div><div>${sym}${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
          ${showVat ? `<div class="row"><div>VAT (${(vatRate*100).toFixed(0)}%)</div><div>${sym}${vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>` : ""}
          <div class="row total"><div>Total</div><div>${sym}${totalGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
        </div>
        ${renderSections(quoteDefaults)}
        <footer>
          <div><strong>Terms</strong></div>
          <div class="muted">${escapeHtml(terms)}</div>
          <div class="muted" style="margin-top:8px;">Thank you for your business.</div>
        </footer>
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
      // Call ML to get an estimated total based on questionnaire answers; then scale per-line proportions by cost
      const API_BASE = (
        process.env.APP_API_URL || process.env.API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 4000}`
      ).replace(/\/$/, "");
      const features: any = (quote.lead?.custom as any) || {};
      const inputTypeRaw = typeof req.body?.inputType === "string" ? req.body.inputType : undefined;
      const inputType = inputTypeRaw === "supplier_pdf" ? "supplier_pdf" : "questionnaire";

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
      const modelVersionId = extractModelVersionId(ml) || `external-${new Date().toISOString().slice(0, 10)}`;
      const currency = normalizeCurrency(ml?.currency || quote.currency || "GBP");

      let hashPayload: any = features;
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
            },
            orderBy: { createdAt: "asc" },
          });
          hashPayload = parsed;
        } catch (e: any) {
          console.warn(`[quotes] failed to load parsed lines for estimate hashing:`, e?.message || e);
        }
      }

      const inputHash = sha256(
        tenantId,
        ":",
        quote.id,
        ":",
        inputType,
        ":",
        JSON.stringify(hashPayload ?? {}),
      );

      try {
        await prisma.estimate.create({
          data: {
            tenantId,
            quoteId: quote.id,
            inputType,
            inputHash,
            currency,
            estimatedTotal: predictedTotal,
            confidence,
            modelVersionId,
          },
        });
      } catch (e: any) {
        console.warn(`[quotes] failed to persist Estimate for quote ${quote.id}:`, e?.message || e);
      }

      const costSum = quote.lines.reduce((s, ln) => s + Number(ln.unitPrice) * Number(ln.qty), 0);
      const scale = costSum > 0 && predictedTotal > 0 ? predictedTotal / costSum : 1;
      let totalGBP = 0;
      for (const ln of quote.lines) {
        const costUnit = Number(ln.unitPrice);
        const sellUnit = costUnit * scale;
        const sellTotal = sellUnit * Number(ln.qty);
        totalGBP += sellTotal;
        await prisma.quoteLine.update({
          where: { id: ln.id },
          data: {
            meta: {
              set: {
                ...(ln.meta as any || {}),
                sellUnitGBP: sellUnit,
                sellTotalGBP: sellTotal,
                pricingMethod: "ml",
                scale,
                predictedTotal,
                estimateModelVersionId: modelVersionId,
              },
            } as any,
          },
        });
      }
      await prisma.quote.update({ where: { id: quote.id }, data: { totalGBP: new Prisma.Decimal(totalGBP) } });

      const inferenceModel = inputType === "supplier_pdf" ? "supplier_estimator" : "qa_estimator";
      const sanitizedEstimate = {
        predictedTotal,
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

      return res.json({ ok: true, method, predictedTotal, totalGBP });
    }

    return res.status(400).json({ error: "invalid_method" });
  } catch (e: any) {
    console.error("[/quotes/:id/price] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});