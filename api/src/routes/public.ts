// api/src/routes/public.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { normalizeQuestionnaire } from "../lib/questionnaire";

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

export default router;