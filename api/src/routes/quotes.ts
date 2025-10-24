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
      id: true, title: true, status: true, totalGBP: true,
      createdAt: true, leadId: true,
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

  const created: any[] = [];
  const fails: Array<{ fileId: string; name?: string | null; status?: number; error?: any }>= [];
    for (const f of quote.supplierFiles) {
      // Only attempt to parse PDFs
      if (!/pdf$/i.test(f.mimeType || "") && !/\.pdf$/i.test(f.name || "")) continue;
      const token = jwt.sign({ t: tenantId, q: quote.id }, env.APP_JWT_SECRET, { expiresIn: "30m" });
      const url = `${API_BASE}/files/${encodeURIComponent(f.id)}?jwt=${encodeURIComponent(token)}`;

      const resp = await fetch(`${API_BASE}/ml/parse-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.authorization || "" },
        body: JSON.stringify({ url, filename: f.name || undefined }),
      });
      const text = await resp.text();
      let parsed: any = {};
      try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
      if (!resp.ok) {
        // Keep going for other files, but record the failure
        fails.push({ fileId: f.id, name: f.name, status: resp.status, error: parsed });
        continue;
      }

      const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
      for (const ln of lines) {
        const description = String(ln.description || ln.item || ln.name || f.name || "Line");
        const qty = Number(ln.qty ?? ln.quantity ?? 1) || 1;
        const unit = Number(ln.unit_price ?? ln.price ?? ln.unit ?? 0) || 0;
        const currency = String(parsed.currency || ln.currency || quote.currency || "GBP").toUpperCase();
        const row = await prisma.quoteLine.create({
          data: {
            quoteId: quote.id,
            supplier: (parsed?.supplier || undefined) as any,
            sku: typeof ln.sku === "string" ? ln.sku : undefined,
            description,
            qty,
            unitPrice: new Prisma.Decimal(unit),
            currency,
            deliveryShareGBP: new Prisma.Decimal(0),
            lineTotalGBP: new Prisma.Decimal(0),
            meta: parsed ? { source: "ml-parse", raw: ln } : undefined,
          },
        });
        created.push(row);
      }
    }

    // If everything failed or produced no lines, surface an error
    if (created.length === 0) {
      return res.status(502).json({ error: "parse_failed", created: 0, fails });
    }

    return res.json({ ok: true, created: created.length, fails: fails.length });
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