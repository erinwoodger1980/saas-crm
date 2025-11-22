// api/src/routes/public.ts
import { Router } from "express";
import fs from "fs";
import path from "path";
import { normalizeQuestionnaire } from "../lib/questionnaire";
import {
  extractGlobalSpecsFromAnswers,
  normalizeLeadGlobalSpecs,
  specsToPrismaData,
} from "../lib/globalSpecs";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

const router = Router();
import fetch from "node-fetch";
import crypto from "crypto";
import { redisGetJSON, redisSetJSON } from '../services/redis';
import { calibrateConfidence, combineConfidence } from '../services/vision/calibration';
import { buildAiTelemetry, getPersistedVisionTelemetry } from '../services/vision/telemetry';

/**
 * Current public questionnaire surface:
 * - GET /tenant/by-slug/:slug exposes brandName, introHtml, website, phone, logoUrl, links and questionnaire schema.
 * - GET /leads/:id returns invite-only lead contact info + normalized global specs for prefilling.
 * - POST /leads/:id/submit-questionnaire merges answers/uploads into lead.custom, updates lead global spec columns
 *   and vision inference rows.
 * There is no public pricing preview or project session storage yet; everything writes directly to the Lead record.
 */
const WIDTH_FIELD_CANDIDATES = [
  "estimated_width_mm",
  "photo_width_mm",
  "rough_width_mm",
  "approx_width_mm",
  "approx_width",
  "door_width_mm",
  "width_mm",
  "width",
];

const HEIGHT_FIELD_CANDIDATES = [
  "estimated_height_mm",
  "photo_height_mm",
  "rough_height_mm",
  "approx_height_mm",
  "approx_height",
  "door_height_mm",
  "height_mm",
  "height",
];

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(record: Record<string, any>, keys: string[]): number | null {
  if (!record || typeof record !== "object") return null;
  for (const key of keys) {
    if (key in record) {
      const value = toNumber(record[key]);
      if (value != null) return value;
    }
  }
  return null;
}

function stringOrNull(value: any): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function firstPhotoLabel(item: Record<string, any>, opts?: { inspiration?: boolean }): string | null {
  const pickLabel = (list: any[]): string | null => {
    if (!Array.isArray(list) || !list.length) return null;
    const first = list.find((entry) => entry && typeof entry === "object" && typeof entry.filename === "string");
    if (first) {
      const trimmed = first.filename.trim();
      if (trimmed) return trimmed;
    }
    return null;
  };

  if (opts?.inspiration) {
    const explicit = pickLabel(Array.isArray(item?.inspiration_photos) ? item.inspiration_photos : []);
    if (explicit) return explicit;
    const inspirationFromPhotos = Array.isArray(item?.photos)
      ? item.photos.filter((photo: any) => typeof photo?.filename === "string" && /inspiration/i.test(photo.filename))
      : [];
    const fallback = pickLabel(inspirationFromPhotos);
    if (fallback) return fallback;
  }

  const general = pickLabel(Array.isArray(item?.photos) ? item.photos : []);
  return general;
}

function resolveInferenceSource(raw: any): "MEASUREMENT" | "INSPIRATION" {
  const label = typeof raw === "string" ? raw.toLowerCase() : "";
  if (label.includes("inspiration")) return "INSPIRATION";
  return "MEASUREMENT";
}

function pickAttributes(record: any, key: string): Record<string, any> | null {
  if (!record || typeof record !== "object") return null;
  const raw = (record as any)[key];
  if (raw && typeof raw === "object") return raw as Record<string, any>;
  return null;
}

function buildMeasurementInference(item: Record<string, any>, params: { tenantId: string; leadId: string; itemNumber: number }): Prisma.LeadVisionInferenceCreateManyInput | null {
  const attributes = pickAttributes(item, "measurement_attributes");
  const widthMm = pickNumber(item, WIDTH_FIELD_CANDIDATES);
  const heightMm = pickNumber(item, HEIGHT_FIELD_CANDIDATES);
  const confidence = toNumber(item.measurement_confidence ?? item.inference_confidence ?? item.vision_confidence);
  if (!attributes && widthMm == null && heightMm == null && confidence == null) {
    return null;
  }

  const description =
    stringOrNull(item.measurement_description) ||
    (attributes ? stringOrNull((attributes as any).description) : null);
  const notes = attributes ? stringOrNull((attributes as any).notes ?? (attributes as any).reasoning) : null;
  const sourceLabel = item.measurement_source ?? item.inference_source ?? item.vision_source ?? "measurement";

  return {
    tenantId: params.tenantId,
    leadId: params.leadId,
    itemNumber: params.itemNumber,
    source: resolveInferenceSource(sourceLabel),
    widthMm: widthMm ?? null,
    heightMm: heightMm ?? null,
    confidence: confidence ?? null,
    attributes: attributes ? (attributes as Prisma.InputJsonValue) : Prisma.JsonNull,
    description: description ?? null,
    notes: notes ?? null,
    photoLabel: firstPhotoLabel(item) ?? null,
  };
}

function buildInspirationInference(item: Record<string, any>, params: { tenantId: string; leadId: string; itemNumber: number }): Prisma.LeadVisionInferenceCreateManyInput | null {
  const attributes = pickAttributes(item, "inspiration_attributes");
  if (!attributes) return null;
  const confidence = toNumber(item.inspiration_confidence ?? item.vision_confidence ?? item.inference_confidence);
  const description = stringOrNull(item.inspiration_description) || stringOrNull((attributes as any).description);
  const notes = stringOrNull((attributes as any).notes ?? (attributes as any).story ?? (attributes as any).reasoning);
  const sourceLabel = item.inspiration_source ?? item.vision_source ?? "inspiration";

  return {
    tenantId: params.tenantId,
    leadId: params.leadId,
    itemNumber: params.itemNumber,
    source: resolveInferenceSource(sourceLabel || "inspiration"),
    widthMm: null,
    heightMm: null,
    confidence: confidence ?? null,
    attributes: attributes ? (attributes as Prisma.InputJsonValue) : Prisma.JsonNull,
    description: description ?? null,
    notes: notes ?? null,
    photoLabel: firstPhotoLabel(item, { inspiration: true }) ?? null,
  };
}

function buildVisionInferenceInputs(params: {
  tenantId: string;
  leadId: string;
  items: any[] | undefined;
}): Prisma.LeadVisionInferenceCreateManyInput[] {
  const items = Array.isArray(params.items) ? params.items : [];
  const out: Prisma.LeadVisionInferenceCreateManyInput[] = [];
  items.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const base = { tenantId: params.tenantId, leadId: params.leadId, itemNumber: idx + 1 };
    const measurement = buildMeasurementInference(item, base);
    if (measurement) out.push(measurement);
    const inspiration = buildInspirationInference(item, base);
    if (inspiration) out.push(inspiration);
  });
  return out;
}

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

/** GET /public/tenant/:tenantSlug/branding
 *  Enhanced endpoint for public estimator with premium branding + social proof.
 */
router.get("/tenant/:tenantSlug/branding", async (req, res) => {
  const slug = String(req.params.tenantSlug || "").trim();
  if (!slug) return res.status(400).json({ error: "slug_required" });
  try {
    const s = await prisma.tenantSettings.findUnique({ where: { slug } });
    if (!s) return res.status(404).json({ error: "unknown_tenant" });

    return res.json({
      tenantId: s.tenantId,
      slug: s.slug,
      brandName: s.brandName,
      logoUrl: (s as any).logoUrl ?? null,
      website: (s as any).website ?? null,
      phone: (s as any).phone ?? null,
      // Premium branding (all optional)
      primaryColor: (s as any).primaryColor ?? null,
      secondaryColor: (s as any).secondaryColor ?? null,
      heroImageUrl: (s as any).heroImageUrl ?? null,
      galleryImageUrls: Array.isArray((s as any).galleryImageUrls) ? (s as any).galleryImageUrls : [],
      // Social proof
      testimonials: (s as any).testimonials ?? null,
      reviewScore: (s as any).reviewScore ?? null,
      reviewCount: (s as any).reviewCount ?? null,
      reviewSourceLabel: (s as any).reviewSourceLabel ?? null,
      serviceArea: (s as any).serviceArea ?? null,
      // Form structure
      questionnaire: normalizeQuestionnaire((s as any).questionnaire ?? []),
    });
  } catch (err: any) {
    console.error('[public branding] failed', {
      slug,
      error: err?.message,
      code: err?.code,
      stack: err?.stack?.split('\n').slice(0,4).join('\n'),
      timestamp: new Date().toISOString(),
    });
    // If it's a known prisma missing column error, surface a clearer message
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('column') && msg.includes('does not exist')) {
      return res.status(500).json({ error: 'branding_schema_out_of_sync', message: 'Branding unavailable - run migrations' });
    }
    return res.status(500).json({ error: 'branding_fetch_failed' });
  }
});

/* ---------- PUBLIC: read minimal lead for form ---------- */
/** GET /public/leads/:id */
router.get("/leads/:id", async (req, res) => {
  const id = String(req.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return res.status(404).json({ error: "not found" });

  const filteredCustom = filterCustom(lead.custom);
  const extractString = (keys: string[]): string | null => {
    for (const key of keys) {
      const raw = (filteredCustom as any)?.[key];
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    }
    return null;
  };

  const phone = extractString(["phone", "contactPhone", "contact_phone", "tel"]);
  const address =
    extractString(["address", "address_line", "address1", "address_line1", "location"]) ??
    ((lead as any).location ?? null);

  const normalizedSpecs = normalizeLeadGlobalSpecs(lead as any);

  return res.json({
    lead: {
      id: lead.id,
      contactName: lead.contactName,
      email: lead.email ?? null,
      phone,
      address,
      global_timber_spec: normalizedSpecs.timber || null,
      global_glass_spec: normalizedSpecs.glass || null,
      global_ironmongery_spec: normalizedSpecs.ironmongery || null,
      global_finish_spec: normalizedSpecs.finish || null,
      custom: filteredCustom,
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
    const globalSpecs = extractGlobalSpecsFromAnswers(answers);

    // Extract individual field values from items structure for LeadModal compatibility
    const individualFieldValues: Record<string, any> = {};
    
    if (answers.items && Array.isArray(answers.items)) {
      // Get the tenant settings to understand the questionnaire structure
      const tenantSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: lead.tenantId }
      });
      
      const questionnaire = normalizeQuestionnaire((tenantSettings as any)?.questionnaire ?? []);
      
      // Extract values from the first item (most common case)
      const firstItem = answers.items[0];
      if (firstItem && typeof firstItem === "object") {
        questionnaire.forEach((field: any) => {
          if (field.key && firstItem.hasOwnProperty(field.key)) {
            individualFieldValues[field.key] = firstItem[field.key];
          }
        });
      }
    }

    // Safely merge (do not explode if uploads missing)
    const visionInferences = buildVisionInferenceInputs({
      tenantId: lead.tenantId,
      leadId: lead.id,
      items: Array.isArray(answers.items) ? answers.items : [],
    });

    const merged = {
      ...prev,
      ...answers,
      ...individualFieldValues, // Add individual field values for LeadModal
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

    const updated = await prisma.$transaction(async (tx) => {
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status: "READY_TO_QUOTE",
          custom: merged,
          nextAction: "Prepare quote",
          nextActionAt: new Date(),
          ...specsToPrismaData(globalSpecs),
        },
      });

      await tx.leadVisionInference.deleteMany({ where: { leadId: id } });
      if (visionInferences.length) {
        await tx.leadVisionInference.createMany({ data: visionInferences });
      }

      return updatedLead;
    });

    return res.json({ ok: true, lead: { id: updated.id } });
  } catch (e: any) {
    console.error("[public submit-questionnaire] failed:", e);
    return res.status(500).json({ error: e?.message || "submit failed" });
  }
});

/* ---------- PUBLIC: project save/restore ---------- */
/** POST /public/projects - Create or update a public project session */
router.post("/projects", async (req, res) => {
  try {
    const { tenantId, leadId, entryMode, sourceInfo, payload, projectId, needsManualQuote, manualQuoteReason } = req.body as {
      tenantId: string;
      leadId?: string;
      entryMode: 'AD' | 'INVITE';
      sourceInfo?: Record<string, any>;
      payload: Record<string, any>;
      projectId?: string;
      needsManualQuote?: boolean;
      manualQuoteReason?: string;
    };

    if (!tenantId || !entryMode || !payload) {
      return res.status(400).json({ error: "tenantId, entryMode and payload required" });
    }

    // Add manual quote flag to payload if needed
    const enrichedPayload = {
      ...payload,
      ...(needsManualQuote && { needsManualQuote, manualQuoteReason }),
    };

    // Update existing or create new
    if (projectId) {
      const updated = await prisma.publicProject.update({
        where: { id: projectId },
        data: {
          payload: enrichedPayload,
          leadId: leadId || null,
          updatedAt: new Date(),
        },
      });

      // If linked to a lead and needs manual quote, flag the lead
      if (leadId && needsManualQuote) {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { custom: true },
        });
        if (lead) {
          const custom = (lead.custom as any) || {};
          await prisma.lead.update({
            where: { id: leadId },
            data: {
              custom: {
                ...custom,
                needsManualQuote: true,
                manualQuoteReason,
                manualQuoteFlaggedAt: new Date().toISOString(),
              },
            },
          });
          // Fire-and-forget internal notification (email/log). Wrap in try so save isn't blocked.
          try {
            await import('../services/notifyManualQuote').then(m => m.notifyManualQuote?.({
              leadId,
              tenantId,
              reason: manualQuoteReason || 'unspecified',
              scope: 'update'
            })).catch(()=>{});
          } catch {}
        }
      }

      return res.json({ projectId: updated.id, url: `/estimate/${updated.id}` });
    }

    const created = await prisma.publicProject.create({
      data: {
        tenantId,
        leadId: leadId || null,
        entryMode: entryMode === 'INVITE' ? 'INVITE' : 'AD',
        sourceInfo: sourceInfo || Prisma.JsonNull,
        payload: enrichedPayload,
      },
    });

    // If linked to a lead and needs manual quote, flag the lead
    if (leadId && needsManualQuote) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { custom: true },
      });
      if (lead) {
        const custom = (lead.custom as any) || {};
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            custom: {
              ...custom,
              needsManualQuote: true,
              manualQuoteReason,
              manualQuoteFlaggedAt: new Date().toISOString(),
            },
          },
        });
        try {
          await import('../services/notifyManualQuote').then(m => m.notifyManualQuote?.({
            leadId,
            tenantId,
            reason: manualQuoteReason || 'unspecified',
            scope: 'create'
          })).catch(()=>{});
        } catch {}
      }
    }

    return res.json({ projectId: created.id, url: `/estimate/${created.id}` });
  } catch (e: any) {
    console.error("[public projects] create/update failed:", e);
    return res.status(500).json({ error: e?.message || "failed to save project" });
  }
});

/** GET /public/projects/:id - Load a saved project */
router.get("/projects/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const project = await prisma.publicProject.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: "project not found" });

    return res.json({
      projectId: project.id,
      tenantId: project.tenantId,
      leadId: project.leadId,
      entryMode: project.entryMode,
      sourceInfo: project.sourceInfo,
      payload: project.payload,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (e: any) {
    console.error("[public projects] load failed:", e);
    return res.status(500).json({ error: e?.message || "failed to load project" });
  }
});

/** GET /public/projects/by-lead/:leadId - Load latest saved project for a lead */
router.get("/projects/by-lead/:leadId", async (req, res) => {
  try {
    const leadId = String(req.params.leadId);
    if (!leadId) return res.status(400).json({ error: "leadId required" });
    const project = await prisma.publicProject.findFirst({
      where: { leadId },
      orderBy: { updatedAt: "desc" },
    });
    if (!project) return res.json({ ok: true, project: null });
    return res.json({
      ok: true,
      project: {
        projectId: project.id,
        tenantId: project.tenantId,
        leadId: project.leadId,
        entryMode: project.entryMode,
        sourceInfo: project.sourceInfo,
        payload: project.payload,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (e: any) {
    console.error("[public projects] by-lead failed:", e);
    return res.status(500).json({ error: e?.message || "failed to load project" });
  }
});

/* ---------- PUBLIC: pricing preview ---------- */
/** POST /public/estimates/preview - Get live price estimate for in-progress questionnaire */
router.post("/estimates/preview", async (req, res) => {
  try {
    const { tenantId, items, globalSpecs } = req.body as {
      tenantId: string;
      items: Array<{
        description: string;
        widthMm?: number;
        heightMm?: number;
        openingType?: string;
        specs?: Record<string, string>;
      }>;
      globalSpecs?: Record<string, string>;
    };

    if (!tenantId || !Array.isArray(items)) {
      return res.status(400).json({ error: "tenantId and items array required" });
    }

    // Import estimate service (inline for now to avoid circular deps)
    const { estimateQuote } = await import("../services/pricing/estimateQuote");
    const estimate = await estimateQuote({ tenantId, items, globalSpecs });

    // Ensure aggregate totals present (some legacy implementations omitted them)
    if (Array.isArray((estimate as any).items)) {
      const sumNet = (estimate as any).items.reduce((s: number, it: any) => s + (Number(it.netGBP) || 0), 0);
      const sumVat = (estimate as any).items.reduce((s: number, it: any) => s + (Number(it.vatGBP) || 0), 0);
      const sumGross = (estimate as any).items.reduce((s: number, it: any) => s + (Number(it.totalGBP) || (Number(it.netGBP)||0)+(Number(it.vatGBP)||0)), 0);
      if (!((estimate as any).totalNet > 0)) (estimate as any).totalNet = sumNet;
      if (!((estimate as any).totalVat > 0)) (estimate as any).totalVat = sumVat;
      if (!((estimate as any).totalGross > 0)) (estimate as any).totalGross = sumGross;
    }

    return res.json(estimate);
  } catch (e: any) {
    console.error("[public estimates preview] failed:", e);
    return res.status(500).json({ error: e?.message || "estimate failed" });
  }
});

/** POST /public/vision/analyze-photo - AI-assisted dimension + description inference from a single image (base64) */
router.post("/vision/analyze-photo", async (req, res) => {
  try {
    const { imageBase64, imageHeadBase64, fileName, openingType, aspectRatio, exif } = req.body as any;
    const rawB64 = imageHeadBase64 || imageBase64;
    if (!rawB64) return res.status(400).json({ error: "imageBase64 required" });
    const cleaned = rawB64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    // Cache layer (in-memory TTL). Uses SHA1 of cleaned head.
    const hash = crypto.createHash("sha1").update(cleaned).digest("hex");
    const now = Date.now();
    // Try Redis first (24h TTL), fallback to in-memory (5m TTL)
    const redisKey = `vision:${hash}`;
    const redisHit = await redisGetJSON<any>(redisKey);
    if (redisHit) {
      return res.json({ ...redisHit, cached: true, cacheLayer: 'redis' });
    }
    const existingMem = (global as any).__visionCache?.get(hash);
    if (existingMem && existingMem.expires > now) {
      return res.json({ ...existingMem.data, cached: true, cacheLayer: 'memory' });
    }
    if (!(global as any).__visionCache) (global as any).__visionCache = new Map<string, { data: any; expires: number }>();
    // Heuristic pixel analysis (dimensions)
    let widthPx: number | null = null;
    let heightPx: number | null = null;
    try {
      // Lightweight decode using Buffer length (rough estimation impossible without actual decode); keep null
      // Real implementation could pass through to ML service for precise bounding box detection.
    } catch {}
    // Fallback approximate dimensions using aspect ratio assumption via inline canvas on client side; here we rely on AI.
    let aiText: string | null = null;
    let aiWidth: number | null = null;
    let aiHeight: number | null = null;
    let aiConfidence: number | null = null;
    try {
      if (process.env.OPENAI_API_KEY) {
        const { send } = await import("../services/ai/openai");
        const prompt = `You are a joinery estimator. Analyze a ${openingType || 'opening'} photo (${fileName || 'photo'}). Aspect ratio: ${aspectRatio || 'n/a'}. EXIF: ${exif ? JSON.stringify(exif) : 'none'}. Provide JSON ONLY: {"description":"...","width_mm":number,"height_mm":number,"confidence":number}. Use realistic UK dimensions (external door ~1980x838mm). If uncertain, give best estimate with lowered confidence. No extra text.`;
        const b64Snippet = cleaned.slice(0, 4000);
        const messages = [
          { role: 'system', content: 'Return ONLY valid JSON.' },
          { role: 'user', content: `${prompt}\nIMAGE_BASE64_HEAD:${b64Snippet}` }
        ] as any;
        const startMs = Date.now();
        let lastErr: any = null; let result: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            result = await send(process.env.OPENAI_MODEL || 'gpt-4o-mini', messages, { temperature: 0.2, max_tokens: 400 });
            lastErr = null; break;
          } catch (err) {
            lastErr = err;
            await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
          }
        }
        if (!lastErr && result) {
          const raw = result.text.trim();
          const jsonStart = raw.indexOf('{');
          const jsonEnd = raw.lastIndexOf('}');
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const parsed: any = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
            aiText = typeof parsed.description === 'string' ? parsed.description : null;
            aiWidth = typeof parsed.width_mm === 'number' ? parsed.width_mm : null;
            aiHeight = typeof parsed.height_mm === 'number' ? parsed.height_mm : null;
            aiConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : null;
          }
          await buildAiTelemetry(startMs, false, result, null);
        } else {
          await buildAiTelemetry(startMs, false, undefined, lastErr);
        }
      }
    } catch (e: any) {
      console.warn('[vision/analyze-photo] AI inference failed, falling back', e?.message);
    }
    // Heuristic fallback if AI missing dims
    if (!aiWidth || !aiHeight) {
      // Assume external door standard if portrait-like
      aiWidth = aiWidth || 900;
      aiHeight = aiHeight || 2000;
      aiConfidence = aiConfidence || 0.3;
      aiText = aiText || 'Estimated external opening';
    }
    // Ensemble blending with heuristic aspect ratio estimation
    let heuristicWidth: number | null = null;
    let heuristicHeight: number | null = null;
    if (aspectRatio && aspectRatio > 0) {
      // Simple heuristic: door-like if portrait (<0.9), else window/panel
      if (aspectRatio < 0.9) {
        heuristicWidth = 900;
        heuristicHeight = Math.round(heuristicWidth / aspectRatio);
      } else if (aspectRatio < 1.2) {
        heuristicWidth = 900;
        heuristicHeight = Math.round(heuristicWidth / aspectRatio);
      } else {
        heuristicHeight = 1300;
        heuristicWidth = Math.round(heuristicHeight * aspectRatio);
      }
    }
    let finalWidth = aiWidth;
    let finalHeight = aiHeight;
    let finalConfidence = aiConfidence;
    if (heuristicWidth && heuristicHeight && aiWidth && aiHeight) {
      const diffW = Math.abs(aiWidth - heuristicWidth) / heuristicWidth;
      const diffH = Math.abs(aiHeight - heuristicHeight) / heuristicHeight;
      // Blend if large divergence to temper extremes
      if (diffW > 0.25 || diffH > 0.25) {
        finalWidth = Math.round(aiWidth * 0.7 + heuristicWidth * 0.3);
        finalHeight = Math.round(aiHeight * 0.7 + heuristicHeight * 0.3);
        finalConfidence = (finalConfidence || 0.4) * 0.9; // slight reduction due to correction
      } else {
        // Minor divergence: gentle blend improves robustness
        finalWidth = Math.round(aiWidth * 0.85 + heuristicWidth * 0.15);
        finalHeight = Math.round(aiHeight * 0.85 + heuristicHeight * 0.15);
        finalConfidence = Math.min(0.95, (finalConfidence || 0.4) + 0.05);
      }
    }
    // Calibrate confidence post-size plausibility
    const calibrated = calibrateConfidence(openingType, finalWidth, finalHeight, finalConfidence);
    const payload = {
      width_mm: finalWidth,
      height_mm: finalHeight,
      description: aiText,
      confidence: calibrated,
    };
    // Store in cache (5 min TTL)
    (global as any).__visionCache.set(hash, { data: payload, expires: Date.now() + 5 * 60 * 1000 });
    // Persist to Redis (24h TTL) if available
    redisSetJSON(redisKey, payload, 60 * 60 * 24).catch(()=>{});
    return res.json(payload);
  } catch (e: any) {
    console.error('[public vision analyze-photo] failed:', e);
    return res.status(500).json({ error: e?.message || 'vision_inference_failed' });
  }
});

/** POST /public/vision/depth-analyze - Stub LiDAR/depth-based inference */
router.post('/vision/depth-analyze', async (req, res) => {
  try {
    const { points, openingType, anchorWidthMm } = req.body as { points?: Array<{x:number;y:number;z:number}>; openingType?: string; anchorWidthMm?: number };
    const pts = Array.isArray(points) ? points : [];
    if (!pts.length) return res.status(400).json({ error: 'points required' });
    // PCA-based oriented bounding box in XY plane
    const xy = pts.map(p => [p.x, p.y]);
    const n = xy.length;
    const meanX = xy.reduce((s,v)=>s+v[0],0)/n;
    const meanY = xy.reduce((s,v)=>s+v[1],0)/n;
    const covXX = xy.reduce((s,v)=>s+(v[0]-meanX)*(v[0]-meanX),0)/n;
    const covYY = xy.reduce((s,v)=>s+(v[1]-meanY)*(v[1]-meanY),0)/n;
    const covXY = xy.reduce((s,v)=>s+(v[0]-meanX)*(v[1]-meanY),0)/n;
    // Eigen decomposition of 2x2 matrix [[covXX,covXY],[covXY,covYY]]
    const trace = covXX + covYY;
    const det = covXX*covYY - covXY*covXY;
    const temp = Math.sqrt(Math.max(0, trace*trace/4 - det));
    const lambda1 = trace/2 + temp;
    const lambda2 = trace/2 - temp;
    // Principal eigenvector for lambda1
    let vx = 1, vy = 0;
    if (covXY !== 0) { vx = lambda1 - covYY; vy = covXY; }
    const norm = Math.sqrt(vx*vx + vy*vy) || 1;
    vx /= norm; vy /= norm;
    // Project points onto principal axes
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (const [x,y] of xy) {
      const dx = x - meanX; const dy = y - meanY;
      const a = dx*vx + dy*vy;
      const b = -dx*vy + dy*vx; // orthogonal
      if (a < minA) minA = a; if (a > maxA) maxA = a;
      if (b < minB) minB = b; if (b > maxB) maxB = b;
    }
    let spanA = maxA - minA; let spanB = maxB - minB;
    if (spanA <= 0 || spanB <= 0) {
      spanA = Math.abs(xy[0][0]-meanX); spanB = Math.abs(xy[0][1]-meanY);
    }
    // Base scaling: assume one axis is width. If portrait, width is smaller axis.
    let widthMm: number; let heightMm: number;
    const portrait = spanA < spanB;
    const rawW = portrait ? spanA : spanB;
    const rawH = portrait ? spanB : spanA;
    if (anchorWidthMm && anchorWidthMm > 400) {
      const scale = anchorWidthMm / rawW;
      widthMm = anchorWidthMm;
      heightMm = Math.round(rawH * scale);
    } else {
      // naive scale mapping raw units to mm ranges
      const scale = 900 / (rawW || 1);
      widthMm = Math.round(rawW * scale);
      heightMm = Math.round(rawH * scale);
    }
    let baseConf = Math.min(0.8, 0.3 + Math.log10(n + 1)/5);
    const calibrated = calibrateConfidence(openingType, widthMm, heightMm, baseConf);
    return res.json({ width_mm: widthMm, height_mm: heightMm, description: `Depth inferred ${openingType || 'opening'}`, confidence: calibrated });
  } catch (e: any) {
    /* ---------- INTERNAL: vision telemetry ---------- */
    router.get('/internal/vision/telemetry', async (req, res) => {
      try {
        const adminToken = process.env.ADMIN_API_TOKEN || '';
        const headerToken = String(req.headers['x-admin-token'] || '');
        if (!adminToken || headerToken !== adminToken) {
          return res.status(401).json({ error: 'unauthorized' });
        }
        const limit = Math.min(500, Number(req.query.limit) || 100);
        const persisted = await getPersistedVisionTelemetry(limit);
        return res.json({ ok: true, persistedCount: persisted.length, persisted, note: process.env.VISION_TELEMETRY_PERSIST === '1' ? 'persistence enabled' : 'persistence disabled' });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || 'telemetry_fetch_failed' });
      }
    });

    // Summary rollup (secured similarly)
    router.get('/internal/vision/telemetry/summary', async (req, res) => {
      try {
        const adminToken = process.env.ADMIN_API_TOKEN || '';
        const headerToken = String(req.headers['x-admin-token'] || '');
        if (!adminToken || headerToken !== adminToken) {
          return res.status(401).json({ error: 'unauthorized' });
        }
        const limit = Math.min(1000, Number(req.query.limit) || 500);
        const rows = await getPersistedVisionTelemetry(limit);
        const count = rows.length;
        const totalMs = rows.reduce((s,r)=>s+r.ms,0);
        const avgMs = count ? +(totalMs / count).toFixed(2) : 0;
        const totalCost = rows.reduce((s,r)=>s+(r.costUsd||0),0);
        const errors = rows.filter(r=>!!r.error).length;
        const errorRate = count ? +(errors / count).toFixed(3) : 0;
        const byModel: Record<string,{count:number;avgMs:number;cost:number}> = {};
        for (const r of rows) {
          const m = r.model || 'unknown';
          if (!byModel[m]) byModel[m] = { count:0, avgMs:0, cost:0 };
          byModel[m].count += 1; byModel[m].avgMs += r.ms; byModel[m].cost += r.costUsd||0;
        }
        Object.keys(byModel).forEach(k => {
          byModel[k].avgMs = +(byModel[k].avgMs / byModel[k].count).toFixed(2);
          byModel[k].cost = +byModel[k].cost.toFixed(4);
        });
        return res.json({ ok: true, count, avgMs, totalCost: +totalCost.toFixed(4), errorRate, byModel });
      } catch (e: any) {
        return res.status(500).json({ error: e?.message || 'telemetry_summary_failed' });
      }
    });
    console.error('[vision depth-analyze] failed', e);
    return res.status(500).json({ error: e?.message || 'depth_inference_failed' });
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

function signSupplierSessionToken(tenantId: string, email: string): string {
  return jwt.sign({ t: tenantId, e: email, scope: "supplier" }, env.APP_JWT_SECRET, {
    expiresIn: "90d",
  });
}
function verifySupplierSessionToken(raw: string): null | { tenantId: string; email: string } {
  try {
    const decoded: any = jwt.verify(raw, env.APP_JWT_SECRET);
    const t = typeof decoded?.t === "string" ? decoded.t : null;
    const e = typeof decoded?.e === "string" ? decoded.e : null;
    const scope = decoded?.scope;
    if (t && e && scope === "supplier") return { tenantId: t, email: e };
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
        quoteSourceType: null,
      },
      select: { id: true },
    });
    quoteId = q.id;
  }

  // Save files as UploadedFile rows (persist to disk so ML can parse)
  const saved = [] as any[];
  const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}
  for (const f of files) {
    const filename = typeof f?.filename === "string" && f.filename.trim() ? f.filename.trim() : "attachment";
    const mimeType = typeof f?.mimeType === "string" && f.mimeType.trim() ? f.mimeType : "application/octet-stream";
    const b64 = typeof f?.base64 === "string" ? f.base64 : "";
    if (!b64) continue;
    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    const stamp = Date.now();
    const diskName = `${stamp}__${safeName}`;
    const absPath = path.join(UPLOAD_DIR, diskName);
    try {
      const buf = Buffer.from(b64, "base64");
      fs.writeFileSync(absPath, buf);
    } catch (e) {
      console.error("[supplier/upload] failed to write file", e);
      continue;
    }
    const row = await prisma.uploadedFile.create({
      data: {
        tenantId: claims.tenantId,
        quoteId: quoteId!,
        kind: "SUPPLIER_QUOTE" as any,
        name: filename,
        path: path.relative(process.cwd(), absPath),
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

// POST /public/supplier/session-from/:rfqToken
router.post("/supplier/session-from/:token", async (req, res) => {
  const token = String(req.params.token || "");
  const claims = verifySupplierToken(token);
  if (!claims) return res.status(401).json({ error: "invalid_token" });
  const sessionToken = signSupplierSessionToken(claims.tenantId, claims.email);
  res.json({ ok: true, sessionToken });
});

// GET /public/supplier/list?token=...
router.get("/supplier/list", async (req, res) => {
  const token = String((req.query?.token as string) || "");
  const sess = verifySupplierSessionToken(token);
  if (!sess) return res.status(401).json({ error: "invalid_token" });

  // Fetch leads for this tenant; filter RFQs by supplier email
  const leads = await prisma.lead.findMany({
    where: { tenantId: sess.tenantId },
    select: { id: true, contactName: true, custom: true },
    orderBy: { capturedAt: "desc" },
    take: 500,
  });

  const entries: Array<{ leadId: string; leadName: string; rfqId: string; createdAt?: string; uploadedAt?: string; quoteId?: string | null }> = [];
  for (const l of leads) {
    const c: any = (l.custom as any) || {};
    const rfqs: any[] = Array.isArray(c.supplierRfqs) ? c.supplierRfqs : [];
    for (const r of rfqs) {
      if (!r || typeof r !== "object") continue;
      if (String(r.supplierEmail || "").toLowerCase() !== sess.email.toLowerCase()) continue;
      entries.push({
        leadId: l.id,
        leadName: l.contactName || l.id,
        rfqId: String(r.rfqId || ""),
        createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
        uploadedAt: typeof r.uploadedAt === "string" ? r.uploadedAt : undefined,
        quoteId: r.quoteId ? String(r.quoteId) : null,
      });
    }
  }

  // Attach quote status where available
  const quoteIds = entries.map((e) => e.quoteId).filter((v): v is string => !!v);
  const uniqueQuoteIds = Array.from(new Set(quoteIds));
  const quotes = uniqueQuoteIds.length
    ? await prisma.quote.findMany({ where: { id: { in: uniqueQuoteIds } }, select: { id: true, status: true, totalGBP: true, title: true } })
    : [];
  const quoteMap = new Map(quotes.map((q) => [q.id, q]));

  const items = entries.map((e) => {
    const q = e.quoteId ? quoteMap.get(e.quoteId) : null;
    const uploadToken = jwt.sign({ t: sess.tenantId, l: e.leadId, e: sess.email, r: e.rfqId }, env.APP_JWT_SECRET, { expiresIn: "90d" });
    return {
      leadId: e.leadId,
      leadName: e.leadName,
      rfqId: e.rfqId,
      createdAt: e.createdAt || null,
      uploadedAt: e.uploadedAt || null,
      quoteId: e.quoteId || null,
      quoteStatus: q?.status || null,
      quoteTitle: q?.title || null,
      uploadToken,
    };
  });

  res.json({ ok: true, items });
});

/**
 * GET /public/ml/health
 * Public endpoint to check ML service health and target URL without auth.
 */
router.get("/ml/health", async (_req, res) => {
  const ML_URL = (process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000")
    .trim()
    .replace(/\/$/, "");
  try {
    const r = await fetch(`${ML_URL}/`, { method: "GET" } as any);
    const text = await r.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    res.status(r.ok ? 200 : r.status).json({
      ok: r.ok,
      target: ML_URL,
      status: r.status,
      body: json ?? (text ? text.slice(0, 500) : null),
    });
  } catch (e: any) {
    res.status(502).json({ ok: false, target: ML_URL, error: e?.message || String(e) });
  }
});

/* ---------- PUBLIC: interaction tracking ---------- */
/** POST /public/interactions - Track lead interaction events */
router.post("/interactions", async (req, res) => {
  try {
    const { projectId, leadId, type, metadata } = req.body as {
      projectId?: string;
      leadId?: string;
      type: string;
      metadata?: Record<string, any>;
    };

    if (!type) {
      return res.status(400).json({ error: "type required" });
    }

    // At least one identifier required
    if (!projectId && !leadId) {
      return res.status(400).json({ error: "projectId or leadId required" });
    }

    // Get tenantId from project or lead
    let tenantId: string | null = null;
    if (projectId) {
      const project = await prisma.publicProject.findUnique({
        where: { id: projectId },
        select: { tenantId: true },
      });
      tenantId = project?.tenantId || null;
    } else if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { tenantId: true },
      });
      tenantId = lead?.tenantId || null;
    }

    if (!tenantId) {
      return res.status(404).json({ error: "tenant not found" });
    }

    // Merge projectId into metadata if present
    const metadataWithProject = metadata ? { ...metadata } : {};
    if (projectId) {
      metadataWithProject.projectId = projectId;
    }

    await prisma.leadInteraction.create({
      data: {
        tenantId,
        leadId: leadId || null,
        type: type as any, // Type validated by enum constraint
        metadata: Object.keys(metadataWithProject).length > 0 ? metadataWithProject : Prisma.JsonNull,
      },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[public interactions] create failed:", e);
    return res.status(500).json({ error: e?.message || "failed to track interaction" });
  }
});

export default router;
