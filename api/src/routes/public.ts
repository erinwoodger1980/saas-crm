// api/src/routes/public.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { normalizeQuestionnaire } from "../lib/questionnaire";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { prisma } from "../prisma";

const router = Router();

/* ---------- helpers ---------- */
function filterCustom(custom: any) {
  const c = (typeof custom === "object" && custom) ? (custom as Record<string, any>) : {};
  const out: Record<string, any> = {};
  Object.keys(c).forEach((k) => {
    if (
      ![
        "provider",
        "messageId",
        "subject",
        "from",
        "summary",
        "full",
        "body",
        "date",
        "uiStatus",
        "description",
      ].includes(k)
    ) {
      out[k] = c[k];
    }
  });
  return out;
}

function uiStatusToDb(status: string):
  | "NEW"
  | "INFO_REQUESTED"
  | "DISQUALIFIED"
  | "REJECTED"
  | "READY_TO_QUOTE"
  | "QUOTE_SENT"
  | "WON"
  | "LOST" {
  switch (status.toUpperCase()) {
    case "NEW_ENQUIRY":
    case "NEW":
      return "NEW";
    case "INFO_REQUESTED":
    case "CONTACTED":
      return "INFO_REQUESTED";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    case "REJECTED":
      return "REJECTED";
    case "READY_TO_QUOTE":
      return "READY_TO_QUOTE";
    case "QUOTE_SENT":
      return "QUOTE_SENT";
    case "WON":
      return "WON";
    case "LOST":
      return "LOST";
    default:
      return "NEW";
  }
}

/* ---------- PUBLIC: tenant settings by slug ---------- */
/** GET /public/tenant/by-slug/:slug
 *  Used by the public questionnaire page (no auth).
 *  Returns a safe subset of tenant settings.
 */
router.get("/tenant/by-slug/:slug", async (req, res) => {
  const slug = String(req.params.slug);
  const s = await prisma.tenantSettings.findUnique({ where: { slug } });
  if (!s) return res.status(404).json({ error: "not found" });

  // Only return the bits needed on the public page
  return res.json({
    tenantId: s.tenantId,
    slug: s.slug,
    brandName: s.brandName,
    introHtml: s.introHtml,
    website: (s as any).website ?? null,
    phone: (s as any).phone ?? null,
    logoUrl: (s as any).logoUrl ?? null,
    links: (s as any).links ?? [],
    questionnaire: normalizeQuestionnaire((s as any).questionnaire ?? []),
  });
});

/* ---------- PUBLIC: read minimal lead for form ---------- */
/** GET /public/leads/:id */
router.get("/leads/:id", async (req, res) => {
  const id = String(req.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return res.status(404).json({ error: "not found" });
  return res.json({
    lead: {
      id: lead.id,
      contactName: lead.contactName,
      custom: filterCustom(lead.custom),
    },
  });
});

/* ---------- PUBLIC: submit questionnaire ---------- */
// POST /public/leads/:id/submit-questionnaire
router.post("/leads/:id/submit-questionnaire", async (req, res) => {
  try {
    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ error: "not found" });

    // Accept answers + optional uploads = [{ filename, mimeType, base64 }]
    const { answers = {}, uploads = [] } = (req.body ?? {}) as {
      answers?: Record<string, any>;
      uploads?: Array<{ filename: string; mimeType: string; base64: string }>;
    };

    const prev = (typeof lead.custom === "object" && lead.custom) ? (lead.custom as any) : {};

    // Safely merge (do not explode if uploads missing)
    const merged = {
      ...prev,
      ...answers,
      questionnaireSubmittedAt: new Date().toISOString(),
      // append uploads (if any) – keep a short list
      uploads: [
        ...(Array.isArray(prev.uploads) ? prev.uploads : []),
        ...uploads.map(u => ({
          filename: String(u.filename || "file"),
          mimeType: String(u.mimeType || "application/octet-stream"),
          base64: String(u.base64 || ""),
          sizeKB: Math.round((Buffer.byteLength(u.base64 || "", "base64") / 1024) * 10) / 10,
          addedAt: new Date().toISOString(),
        })),
      ].slice(-20), // keep last 20
      uiStatus: "READY_TO_QUOTE",
    };

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: "READY_TO_QUOTE",
        custom: merged,
        nextAction: "Prepare quote",
        nextActionAt: new Date(),
      },
    });

    return res.json({ ok: true, lead: { id: updated.id } });
  } catch (e: any) {
    console.error("[public submit-questionnaire] failed:", e);
    return res.status(500).json({ error: e?.message || "submit failed" });
  }
});

/* ---------- PUBLIC: supplier RFQ (view + upload) ---------- */

function verifySupplierToken(raw: string): null | { tenantId: string; leadId: string; email: string; rfqId: string } {
  try {
    const decoded: any = jwt.verify(raw, env.APP_JWT_SECRET);
    const t = typeof decoded?.t === "string" ? decoded.t : null;
    const l = typeof decoded?.l === "string" ? decoded.l : null;
    const e = typeof decoded?.e === "string" ? decoded.e : null;
    const r = typeof decoded?.r === "string" ? decoded.r : null;
    if (t && l && e && r) return { tenantId: t, leadId: l, email: e, rfqId: r };
    return null;
  } catch {
    return null;
  }
}

// GET /public/supplier/rfq/:token
router.get("/supplier/rfq/:token", async (req, res) => {
  const token = String(req.params.token || "");
  const claims = verifySupplierToken(token);
  if (!claims) return res.status(401).json({ error: "invalid_token" });

  const lead = await prisma.lead.findFirst({ where: { id: claims.leadId, tenantId: claims.tenantId } });
  if (!lead) return res.status(404).json({ error: "not_found" });

  const custom = (lead.custom as any) || {};
  const rfqs: any[] = Array.isArray(custom.supplierRfqs) ? custom.supplierRfqs : [];
  const entry = rfqs.find((r) => r?.rfqId === claims.rfqId && typeof r?.supplierEmail === "string");

  res.json({
    ok: true,
    lead: { id: lead.id, contactName: lead.contactName },
    supplierEmail: claims.email,
    rfqId: claims.rfqId,
    alreadyUploaded: !!entry?.uploadedAt,
  });
});

// POST /public/supplier/rfq/:token/upload
// Body: { files: [{ filename, mimeType, base64 }] }
router.post("/supplier/rfq/:token/upload", async (req, res) => {
  const token = String(req.params.token || "");
  const claims = verifySupplierToken(token);
  if (!claims) return res.status(401).json({ error: "invalid_token" });

  const files = Array.isArray(req.body?.files) ? (req.body.files as any[]) : [];
  if (!files.length) return res.status(400).json({ error: "no_files" });

  const lead = await prisma.lead.findFirst({ where: { id: claims.leadId, tenantId: claims.tenantId } });
  if (!lead) return res.status(404).json({ error: "not_found" });

  // Ensure a draft Quote exists for this supplier RFQ on first upload
  let quoteId: string | null = null;
  const custom = ((lead.custom as any) || {}) as any;
  const rfqs: any[] = Array.isArray(custom.supplierRfqs) ? custom.supplierRfqs : [];
  const idx = rfqs.findIndex((r) => r?.rfqId === claims.rfqId);
  if (idx >= 0 && rfqs[idx]?.quoteId) quoteId = String(rfqs[idx].quoteId);

  if (!quoteId) {
    const q = await prisma.quote.create({
      data: {
        tenantId: claims.tenantId,
        leadId: lead.id,
        title: `Supplier Quote — ${claims.email}`,
        status: "DRAFT" as any,
      },
      select: { id: true },
    });
    quoteId = q.id;
  }

  // Save files as UploadedFile rows
  const saved = [] as any[];
  for (const f of files) {
    const filename = typeof f?.filename === "string" && f.filename.trim() ? f.filename.trim() : "attachment";
    const mimeType = typeof f?.mimeType === "string" && f.mimeType.trim() ? f.mimeType : "application/octet-stream";
    const b64 = typeof f?.base64 === "string" ? f.base64 : "";
    if (!b64) continue;
    const row = await prisma.uploadedFile.create({
      data: {
        tenantId: claims.tenantId,
        quoteId: quoteId!,
        kind: "SUPPLIER_QUOTE" as any,
        name: filename,
        path: `inline:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        mimeType,
        sizeBytes: Math.floor((Buffer.from(b64, "base64").length) || 0),
      },
      select: { id: true, name: true, mimeType: true, sizeBytes: true },
    });
    saved.push(row);
  }

  // Update RFQ entry
  if (idx >= 0) {
    rfqs[idx] = { ...(rfqs[idx] || {}), quoteId, uploadedAt: new Date().toISOString() };
  } else {
    rfqs.push({ rfqId: claims.rfqId, supplierEmail: claims.email, quoteId, uploadedAt: new Date().toISOString() });
  }
  await prisma.lead.update({
    where: { id: lead.id },
    data: { custom: { ...custom, supplierRfqs: rfqs } },
  });

  res.json({ ok: true, files: saved, quoteId });
});

export default router;