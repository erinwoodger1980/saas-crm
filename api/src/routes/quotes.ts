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
  let resp: any;
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

        // Accept multiple possible ML shapes for line items
        const candidateArrays: any[] = [];
        if (Array.isArray((normalized as any)?.lines)) candidateArrays.push((normalized as any).lines);
        if (Array.isArray((normalized as any)?.items)) candidateArrays.push((normalized as any).items);
        if (Array.isArray((normalized as any)?.line_items)) candidateArrays.push((normalized as any).line_items);
        if (Array.isArray((normalized as any)?.rows)) candidateArrays.push((normalized as any).rows);
        if (Array.isArray((normalized as any)?.table)) candidateArrays.push((normalized as any).table);
        if ((normalized as any)?.table && Array.isArray((normalized as any).table.rows)) candidateArrays.push((normalized as any).table.rows);
        const lines: any[] = candidateArrays.find((a) => Array.isArray(a) && a.length > 0) || [];

        if (lines.length === 0) {
          // Fallback: create a single umbrella line when we only have totals.
          const candidates: number[] = [];
          const est = Number((normalized as any)?.estimated_total ?? (parsed as any)?.estimated_total);
          if (Number.isFinite(est) && est > 0) candidates.push(est);
          const totalsArr = Array.isArray((normalized as any)?.detected_totals)
            ? (normalized as any).detected_totals
            : Array.isArray((parsed as any)?.detected_totals)
            ? (parsed as any).detected_totals
            : [];
          for (const v of totalsArr) {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) candidates.push(n);
          }
          const single = candidates.sort((a, b) => b - a)[0];
          if (!single) {
            fails.push({
              fileId: f.id,
              name: f.name,
              status: 200,
              error: { error: "no_lines_detected", keys: Object.keys(normalized || {}), hint: "Ensure the PDF has a clear table or try another file." },
            });
            continue;
          }
          const currency = normalizeCurrency((normalized as any)?.currency || (parsed as any)?.currency || quote.currency || "GBP");
          const row = await prisma.quoteLine.create({
            data: {
              quoteId: quote.id,
              supplier: (normalized as any)?.supplier || (parsed as any)?.supplier || undefined,
              sku: undefined,
              description: `Supplier total — ${f.name || "PDF"}`,
              qty: 1,
              unitPrice: new Prisma.Decimal(single),
              currency,
              deliveryShareGBP: new Prisma.Decimal(0),
              lineTotalGBP: new Prisma.Decimal(0),
              meta: { source: "ml-parse", parsed: normalized || parsed, fallback: true },
            },
          });
          created.push(row);
          continue;
        }

        for (const ln of lines) {
          const description = String(ln.description || ln.item || ln.name || f.name || "Line");
          const qty = toNumber(ln.qty ?? ln.quantity ?? ln.count ?? ln.units ?? 1) || 1;
          const unit = toNumber(ln.unit_price ?? ln.unitPrice ?? ln.price ?? ln.unit_cost ?? ln.unit ?? 0) || 0;
          const currency = normalizeCurrency(
            normalized?.currency || parsed?.currency || ln.currency || quote.currency || "GBP",
          );
          const row = await prisma.quoteLine.create({
            data: {
              quoteId: quote.id,
              supplier: (normalized?.supplier || parsed?.supplier || undefined) as any,
              sku: typeof ln.sku === "string" ? ln.sku : undefined,
              description,
              qty,
              unitPrice: new Prisma.Decimal(unit),
              currency,
              deliveryShareGBP: new Prisma.Decimal(0),
              lineTotalGBP: new Prisma.Decimal(0),
              meta: normalized
                ? { source: "ml-parse", raw: ln, parsed: normalized }
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
 * POST /quotes/:id/render-pdf
 * Renders a simple PDF proposal for the quote lines using Puppeteer and stores it as an UploadedFile.
 * Returns: { ok: true, fileId, name }
 */
router.post("/:id/render-pdf", requireAuth, async (req: any, res) => {
  try {
    // Dynamically load puppeteer to avoid type issues if not installed yet
    // @ts-ignore
    const puppeteer = require("puppeteer");
    const tenantId = req.auth.tenantId as string;
    const id = String(req.params.id);
    const quote = await prisma.quote.findFirst({
      where: { id, tenantId },
      include: { lines: true, tenant: true, lead: true },
    });
    if (!quote) return res.status(404).json({ error: "not_found" });

    const cur = normalizeCurrency(quote.currency || "GBP");
    const sym = currencySymbol(cur);
    const brand = (quote.tenant as any)?.brandName || "Quote";
    const client = quote.lead?.contactName || quote.lead?.email || "Client";
    const title = quote.title || `Estimate for ${client}`;
    const when = new Date().toLocaleDateString();

    // Summaries
    const rows = quote.lines.map((ln) => {
      const qty = Number(ln.qty || 1);
      const unit = Number(ln.unitPrice || 0);
      const total = qty * unit;
      return {
        description: ln.description,
        qty,
        unit,
        total,
      };
    });
    const subtotal = rows.reduce((s, r) => s + r.total, 0);
    const totalGBP = Number(quote.totalGBP ?? subtotal);

    const styles = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 24px; }
        h1 { font-size: 22px; margin: 0 0 8px; }
        .meta { color: #475569; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        th { background: #f8fafc; font-weight: 600; }
        tfoot td { border-top: 2px solid #0ea5e9; font-weight: 700; }
        .right { text-align: right; }
        .muted { color: #64748b; }
      </style>`;

    const html = `<!doctype html>
      <html>
      <head><meta charset="utf-8" />${styles}</head>
      <body>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
          <div>
            <h1>${brand}</h1>
            <div class="meta">Quotation for ${client}</div>
          </div>
          <div class="meta right">
            <div><strong>Date:</strong> ${when}</div>
            <div><strong>Currency:</strong> ${cur}</div>
          </div>
        </div>
        <div class="meta" style="margin-top:4px;"><strong>Title:</strong> ${title}</div>
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
          <tfoot>
            <tr>
              <td colspan="3" class="right">Total</td>
              <td class="right">${sym}${totalGBP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
        <div class="muted" style="margin-top:16px;">Thank you for your business.</div>
      </body>
      </html>`;

    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
    await browser.close();

    const filenameSafe = (title || `Quote ${quote.id}`).replace(/[^\w.\-]+/g, "_");
    const filename = `${filenameSafe}.pdf`;
    const filepath = path.join(UPLOAD_DIR, `${Date.now()}__${filename}`);
    fs.writeFileSync(filepath, pdfBuffer);

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
    return res.status(500).json({ error: "internal_error" });
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