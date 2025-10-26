// api/src/routes/quotes.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../env";

const router = Router();

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
      const fails: Array<{ fileId: string; name?: string | null; status?: number; error?: any }>= [];
      const TIMEOUT_MS = Math.max(2000, Number(process.env.ML_TIMEOUT_MS || (process.env.NODE_ENV === "production" ? 6000 : 10000)));
      const filesToParse = [...quote.supplierFiles]
        .filter((x) => /pdf$/i.test(x.mimeType || "") || /\.pdf$/i.test(x.name || ""))
        .sort((a: any, b: any) => new Date(b.uploadedAt || b.createdAt || 0).getTime() - new Date(a.uploadedAt || a.createdAt || 0).getTime())
        .slice(0, 1);

      for (const f of filesToParse) {
        const token = jwt.sign({ t: tenantId, q: quote.id }, env.APP_JWT_SECRET, { expiresIn: "30m" });
        const url = `${API_BASE}/files/${encodeURIComponent(f.id)}?jwt=${encodeURIComponent(token)}`;
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
        let resp: Response;
        try {
          resp = await fetch(`${API_BASE}/ml/parse-quote`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: req.headers.authorization || "" },
            body: JSON.stringify({ url, filename: f.name || undefined }),
            signal: ctl.signal as any,
          } as any);
        } catch (err: any) {
          clearTimeout(t);
          const msg = err?.name === "AbortError" ? `timeout_${TIMEOUT_MS}ms` : err?.message || String(err);
          fails.push({ fileId: f.id, name: f.name, status: 504, error: { error: msg } });
          continue;
        } finally {
          clearTimeout(t);
        }

        const text = await resp.text();
        let parsed: any = {};
        try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
        if (!resp.ok) {
          fails.push({ fileId: f.id, name: f.name, status: resp.status, error: parsed });
          continue;
        }

        // Recent ML responses wrap the useful payload under `parsed`; older
        // versions returned the fields at the top level. Normalise here so we
        // can continue handling both shapes without breaking the UI.
        const normalized = parsed && typeof parsed === "object" && parsed.parsed
          ? parsed.parsed
          : parsed;

        const normalizedQuote = normalized && typeof normalized === "object" && !Array.isArray(normalized)
          ? (typeof (normalized as any).quote === "object" && !Array.isArray((normalized as any).quote)
              ? (normalized as any).quote
              : null)
          : null;

        const pickLines = (...candidates: any[]): any[] => {
          for (const candidate of candidates) {
            if (Array.isArray(candidate) && candidate.length > 0) return candidate;
          }
          for (const candidate of candidates) {
            if (Array.isArray(candidate)) return candidate;
          }
          return [];
        };

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

        const resolveSupplier = (src: any): string | undefined => {
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
        };

        const resolveCurrency = (src: any): string | undefined => {
          if (!src || typeof src !== "object") return undefined;
          const candidates = [
            src.currency,
            src.currency_code,
            src.currencyCode,
          ];
          const found = candidates.find((v) => typeof v === "string" && v.trim());
          return found ? String(found).trim().toUpperCase() : undefined;
        };

        const supplier = resolveSupplier(normalizedQuote) || resolveSupplier(normalized);
        const currency = resolveCurrency(normalizedQuote) || resolveCurrency(normalized);

        for (const ln of lines) {
          if (!ln || typeof ln !== "object") continue;
          const description = String(
            ln.description || ln.item || ln.name || ln.title || f.name || "Line",
          );
          const qtyRaw = ln.qty ?? ln.quantity ?? ln.units ?? 1;
          const qty = Number(qtyRaw);
          const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
          const unitRaw = ln.unit_price ?? ln.unitPrice ?? ln.price_each ?? ln.priceEach ?? ln.price ?? ln.unit;
          let unit = Number(unitRaw);
          if (!Number.isFinite(unit) || unit < 0) {
            const totalRaw = ln.total ?? ln.total_price ?? ln.totalPrice;
            const total = Number(totalRaw);
            if (Number.isFinite(total) && safeQty > 0) {
              unit = total / safeQty;
            }
          }
          const safeUnit = Number.isFinite(unit) ? unit : 0;
          const currencySource = resolveCurrency(ln) || currency || parsed?.currency || quote.currency || "GBP";
          const lineCurrency = String(currencySource || "GBP").toUpperCase();
          const row = await prisma.quoteLine.create({
            data: {
              quoteId: quote.id,
              supplier: (resolveSupplier(ln) || supplier || parsed?.supplier || undefined) as any,
              sku: typeof ln.sku === "string" ? ln.sku : undefined,
              description,
              qty: safeQty,
              unitPrice: new Prisma.Decimal(safeUnit),
              currency: lineCurrency,
              deliveryShareGBP: new Prisma.Decimal(0),
              lineTotalGBP: new Prisma.Decimal(0),
              meta: normalized
                ? { source: "ml-parse", raw: ln, parsed: normalized, quote: normalizedQuote || undefined }
                : parsed
                  ? { source: "ml-parse", raw: ln, parsed }
                  : undefined,
            },
          });
          created.push(row);
        }
      }

      if (created.length === 0) return { error: "parse_failed", created: 0, fails } as const;
      return { ok: true, created: created.length, fails: 0 } as const;
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