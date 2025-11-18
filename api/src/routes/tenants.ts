// api/src/routes/tenants.ts
import { Router } from "express";
import { prisma } from "../prisma";
import * as cheerio from "cheerio";
import { env } from "../env";
import { DEFAULT_TASK_PLAYBOOK, normalizeTaskPlaybook } from "../task-playbook";
import { initializeTenantWithSeedData } from "../services/seed-template";
import {
  QuestionnaireField,
  normalizeQuestionnaire,
  prepareQuestionnaireForSave,
} from "../lib/questionnaire";

const DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT = "Questionnaire for your estimate";
const DEFAULT_QUESTIONNAIRE_EMAIL_BODY =
  "Hi {{contactName}},\n\n" +
  "Please fill in this short questionnaire so we can prepare your estimate:\n" +
  "{{link}}\n\n" +
  "Thanks,\n{{brandName}}";

const router = Router();
import multer from "multer";
import pdfParse from "pdf-parse";

// Simple in-memory upload for small files like PDFs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ------------------------- helpers ------------------------- */
function authTenantId(req: any): string | null {
  return (req?.auth?.tenantId as string) || null;
}
function ensureHttps(u: string) {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function toPlainObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return { ...value };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...parsed };
      }
    } catch {
      // fall through
    }
  }
  return {};
}

function cleanOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || null;
}

async function syncLeadFieldDefs(tenantId: string, fields: QuestionnaireField[]) {
  const workspaceFields = fields.filter((field) => field.showOnLead);
  const showKeys = new Set(workspaceFields.map((field) => field.key));
  const questionnaireKeys = new Set(fields.map((field) => field.key));

  const existing = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    select: { id: true, key: true, config: true },
  });

  const deletableIds = existing
    .filter((row) => {
      if (showKeys.has(row.key)) return false;
      const cfg = (row.config as any) ?? null;
      const managed = cfg?.managedBy === "questionnaire";
      const isUnset = cfg == null || (typeof cfg === "object" && Object.keys(cfg).length === 0);
      if (managed) return true;
      if (isUnset && questionnaireKeys.has(row.key)) return true;
      return false;
    })
    .map((row) => row.id);

  if (deletableIds.length > 0) {
    await prisma.leadFieldDef.deleteMany({ where: { id: { in: deletableIds } } });
  }

  let order = 0;
  for (const field of workspaceFields) {
    const config: Record<string, any> = { managedBy: "questionnaire" };
    if (field.type === "select") {
      config.options = field.options;
    }
    if (field.type === "number") {
      config.kind = "number";
    } else if (field.type === "date") {
      config.kind = "date";
    } else if (field.type === "source") {
      config.kind = "source";
    } else if (field.type === "file") {
      config.kind = "file";
    }

    const data = {
      label: field.label,
      type: field.type,
      required: field.required,
      sortOrder: order++,
      config,
    } as const;

    await prisma.leadFieldDef.upsert({
      where: { tenantId_key: { tenantId, key: field.key } },
      update: data,
      create: { tenantId, key: field.key, ...data },
    });
  }
}

/** Build questionnaire fields from this tenant's LeadFieldDef rows (typically copied from demo template). */
async function buildQuestionnaireFromLeadFieldDefs(tenantId: string): Promise<QuestionnaireField[]> {
  const defs = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
    select: { key: true, label: true, type: true, required: true, config: true, sortOrder: true },
  });

  const mapped = defs.map((d, idx) => {
    const cfg = (d.config as any) || {};
    // Determine field type
    let qType: QuestionnaireField["type"] = "text";
    const typeLower = String(d.type || "").toLowerCase();
    if (typeLower === "select") qType = "select";
    else if (cfg.kind === "number") qType = "number";
    else if (cfg.kind === "date") qType = "date";
    else if (cfg.kind === "source") qType = "source";
    else if (cfg.kind === "file") qType = "file";
    else if (typeLower === "textarea") qType = "textarea";

    const options = qType === "select" && Array.isArray(cfg.options)
      ? cfg.options.map((o: any) => (typeof o === "string" ? o : String(o))).filter(Boolean)
      : [];

    const field: QuestionnaireField = {
      id: d.key,
      key: d.key,
      label: d.label,
      type: qType,
      required: !!d.required,
      options,
      askInQuestionnaire: true,
      showOnLead: true,
      sortOrder: Number.isFinite(d.sortOrder) ? (d.sortOrder as number) : idx,
    };
    return field;
  });

  return normalizeQuestionnaire(mapped);
}

/* ============================================================
   SETTINGS
============================================================ */

/** Get current tenant settings (create defaults if missing) */
router.get("/settings", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    let s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!s) {
      // Prefer seeding from Demo Tenant template so new tenants start with the demo client's questionnaire
      let preparedQuestions: any[] | null = null;
      try {
        await initializeTenantWithSeedData(tenantId);
        const demoQ = await buildQuestionnaireFromLeadFieldDefs(tenantId);
        preparedQuestions = prepareQuestionnaireForSave(demoQ);
      } catch (e) {
      // Fall back to a sensible default if template not available
      const fallback = normalizeQuestionnaire([
        { id: "contact_name", key: "contact_name", label: "Your name", type: "text", required: true, askInQuestionnaire: true, showOnLead: true, sortOrder: 0 },
        { id: "email", key: "email", label: "Email", type: "text", required: true, askInQuestionnaire: true, showOnLead: true, sortOrder: 1 },
        { id: "phone", key: "phone", label: "Phone", type: "text", required: false, askInQuestionnaire: true, showOnLead: true, sortOrder: 2 },
        { id: "project_type", key: "project_type", label: "Project type", type: "select", options: ["Windows","Doors","Staircase","Kitchen","Wardrobes","Alcove Units","Other"], required: true, askInQuestionnaire: true, showOnLead: true, group: "Project", sortOrder: 3 },
        { id: "dimensions", key: "dimensions", label: "Sizes / dimensions (optional)", type: "textarea", required: false, askInQuestionnaire: true, showOnLead: true, group: "Project", sortOrder: 4 },
        { id: "budget", key: "budget", label: "Estimated budget (optional)", type: "number", required: false, askInQuestionnaire: true, showOnLead: true, group: "Project", sortOrder: 5 },
        { id: "timeframe", key: "timeframe", label: "Ideal timeframe", type: "select", options: ["ASAP","1-2 months","3-6 months","Flexible"], required: false, askInQuestionnaire: true, showOnLead: true, group: "Project", sortOrder: 6 },
        { id: "photos", key: "photos", label: "Photos / drawings (optional)", type: "file", required: false, askInQuestionnaire: true, showOnLead: true, group: "Project", sortOrder: 7 },
        { id: "notes", key: "notes", label: "Anything else we should know?", type: "textarea", required: false, askInQuestionnaire: true, showOnLead: true, sortOrder: 8 },
      ]);
      preparedQuestions = prepareQuestionnaireForSave(fallback);
    }

    s = await prisma.tenantSettings.create({
      data: {
        tenantId,
        slug: `tenant-${tenantId.slice(0, 6).toLowerCase()}`,
        brandName: "Your Company",
        introHtml:
          "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
        links: [],
        taskPlaybook: DEFAULT_TASK_PLAYBOOK,
        questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
        questionnaire: preparedQuestions || [],
      },
    });
  }

  const normalizedPlaybook = normalizeTaskPlaybook(s?.taskPlaybook as any);
  const normalizedQuestionnaire = normalizeQuestionnaire((s as any)?.questionnaire ?? []);
  const beta = toPlainObject((s as any)?.beta);
  const ownerFirstName = cleanOptionalString(beta.ownerFirstName);
  const ownerLastName = cleanOptionalString(beta.ownerLastName);
  const aiLearning = toPlainObject(beta.aiFollowupLearning);
  res.json({
    ...s,
    taskPlaybook: normalizedPlaybook,
    questionnaire: normalizedQuestionnaire,
    questionnaireEmailSubject: s?.questionnaireEmailSubject ?? DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
    questionnaireEmailBody: s?.questionnaireEmailBody ?? DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
    ownerFirstName,
    ownerLastName,
    aiFollowupLearning: {
      crossTenantOptIn: aiLearning.crossTenantOptIn !== false,
      lastUpdatedISO: aiLearning.lastUpdatedISO || null,
    },
  });
  } catch (error: any) {
    console.error('[GET /tenant/settings] Failed:', {
      tenantId,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ 
      error: 'settings_fetch_failed',
      message: process.env.NODE_ENV === 'production' ? 'Failed to load settings' : error.message
    });
  }
});
/** Partial update for tenant settings (e.g. inboxWatchEnabled, inbox, questionnaire, quoteDefaults, brandName, links) */
async function updateSettings(req: any, res: any) {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const {
    inboxWatchEnabled,
    inbox,
    questionnaire,
    quoteDefaults,
    brandName,
    slug,
    links,
    introHtml,
    website,
    phone,
    logoUrl,
    taskPlaybook,
    questionnaireEmailSubject,
    questionnaireEmailBody,
    ownerFirstName,
    ownerLastName,
    aiFollowupLearning,
  } = req.body || {};

  try {
    // Ensure a row exists (mirrors your GET /settings bootstrap)
    let existing = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!existing) {
      existing = await prisma.tenantSettings.create({
        data: {
          tenantId,
          slug: `tenant-${tenantId.slice(0, 6).toLowerCase()}`,
          brandName: "Your Company",
          introHtml:
            "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
          links: [],
          taskPlaybook: DEFAULT_TASK_PLAYBOOK,
          questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
          questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
        },
      });
    }

    // Whitelist fields
    const update: any = { updatedAt: new Date() };
    const existingBeta = toPlainObject(existing?.beta);
    const nextBeta = { ...existingBeta };
    let betaChanged = false;
    let sanitizedQuestionnaire: QuestionnaireField[] | null = null;

    if (inboxWatchEnabled !== undefined) update.inboxWatchEnabled = !!inboxWatchEnabled;
    if (inbox !== undefined) update.inbox = inbox;
    if (questionnaire !== undefined) {
      sanitizedQuestionnaire = normalizeQuestionnaire(questionnaire ?? []);
      const prepared = prepareQuestionnaireForSave(sanitizedQuestionnaire);
      update.questionnaire = prepared.length ? prepared : [];
    }
    if (quoteDefaults !== undefined) update.quoteDefaults = quoteDefaults;
    if (brandName !== undefined) update.brandName = brandName || "Your Company";
    if (slug !== undefined) {
      const cleanedSlug = sanitizeSlug(slug);
      if (!cleanedSlug) {
        return res
          .status(400)
          .json({ error: "invalid_slug", detail: "Slug must contain letters, numbers or hyphens." });
      }
      update.slug = cleanedSlug;
    }
    if (links !== undefined) update.links = Array.isArray(links) ? links : [];
    if (introHtml !== undefined) update.introHtml = introHtml ?? null;
    if (website !== undefined) update.website = website ?? null;
    if (phone !== undefined) update.phone = phone ?? null;
    if (logoUrl !== undefined) update.logoUrl = logoUrl ?? null;
    if (taskPlaybook !== undefined) update.taskPlaybook = normalizeTaskPlaybook(taskPlaybook);
    if (questionnaireEmailSubject !== undefined) {
      const val = typeof questionnaireEmailSubject === "string" ? questionnaireEmailSubject.trim() : "";
      update.questionnaireEmailSubject = val || null;
    }
    if (questionnaireEmailBody !== undefined) {
      const val = typeof questionnaireEmailBody === "string" ? questionnaireEmailBody.trim() : "";
      update.questionnaireEmailBody = val || null;
    }

    if (ownerFirstName !== undefined) {
      betaChanged = true;
      const val = cleanOptionalString(ownerFirstName);
      if (val) nextBeta.ownerFirstName = val;
      else delete nextBeta.ownerFirstName;
    }
    if (ownerLastName !== undefined) {
      betaChanged = true;
      const val = cleanOptionalString(ownerLastName);
      if (val) nextBeta.ownerLastName = val;
      else delete nextBeta.ownerLastName;
    }

    if (aiFollowupLearning !== undefined) {
      betaChanged = true;
      const requested = toPlainObject(aiFollowupLearning);
      const previous = toPlainObject(existingBeta.aiFollowupLearning);
      const optIn = requested.crossTenantOptIn === false ? false : true;
      const changed = previous.crossTenantOptIn !== optIn;
      nextBeta.aiFollowupLearning = {
        ...previous,
        crossTenantOptIn: optIn,
        lastUpdatedISO: changed
          ? new Date().toISOString()
          : previous.lastUpdatedISO || new Date().toISOString(),
      };
    }

    if (betaChanged) {
      update.beta = nextBeta;
    }

    const saved = await prisma.tenantSettings.update({
      where: { tenantId },
      data: update,
    });

    if (sanitizedQuestionnaire) {
      await syncLeadFieldDefs(tenantId, sanitizedQuestionnaire);
    }

    const normalizedPlaybook = normalizeTaskPlaybook(saved.taskPlaybook as any);
    const normalizedQuestionnaire = normalizeQuestionnaire((saved as any).questionnaire ?? []);
    const savedBeta = toPlainObject((saved as any)?.beta);
    const savedOwnerFirstName = cleanOptionalString(savedBeta.ownerFirstName);
    const savedOwnerLastName = cleanOptionalString(savedBeta.ownerLastName);
    const savedAiLearning = toPlainObject(savedBeta.aiFollowupLearning);
    return res.json({
      ...saved,
      taskPlaybook: normalizedPlaybook,
      questionnaire: normalizedQuestionnaire,
      questionnaireEmailSubject: saved.questionnaireEmailSubject ?? DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
      questionnaireEmailBody: saved.questionnaireEmailBody ?? DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
      ownerFirstName: savedOwnerFirstName,
      ownerLastName: savedOwnerLastName,
      aiFollowupLearning: {
        crossTenantOptIn: savedAiLearning.crossTenantOptIn !== false,
        lastUpdatedISO: savedAiLearning.lastUpdatedISO || null,
      },
    });
  } catch (e: any) {
    console.error("[tenant/settings PATCH] failed:", e?.message || e);
    return res.status(500).json({ error: "update_failed", detail: e?.message || String(e) });
  }
}

router.patch("/settings", updateSettings);
router.put("/settings", updateSettings);

/** Apply the Demo Tenant's questionnaire to the current tenant (idempotent). */
router.post("/settings/apply-demo-questionnaire", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    // Ensure settings row exists
    let settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) {
      settings = await prisma.tenantSettings.create({
        data: {
          tenantId,
          slug: `tenant-${tenantId.slice(0, 6).toLowerCase()}`,
          brandName: "Your Company",
          links: [],
          taskPlaybook: DEFAULT_TASK_PLAYBOOK,
          questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
          questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
        },
      });
    }

    // Copy from demo template into this tenant (LeadFieldDef, tasks, rules)
    await initializeTenantWithSeedData(tenantId);

    // Build questionnaire from the copied LeadFieldDefs
    const q = await buildQuestionnaireFromLeadFieldDefs(tenantId);
    const prepared = prepareQuestionnaireForSave(q);

    const saved = await prisma.tenantSettings.update({
      where: { tenantId },
      data: { questionnaire: prepared, updatedAt: new Date() },
    });

    // Keep LeadFieldDef in sync with questionnaire (adds managedBy metadata/options)
    await syncLeadFieldDefs(tenantId, q);

    res.json({ ok: true, settings: { ...saved, questionnaire: q } });
  } catch (e: any) {
    console.error("[tenant/apply-demo-questionnaire] failed:", e);
    res.status(500).json({ error: "apply_failed", detail: e?.message || String(e) });
  }
});

/** Quick update: brand / website */
router.patch("/settings/basic", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { brandName, website } = (req.body || {}) as {
    brandName?: string;
    website?: string;
  };

  const existing = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { slug: true },
  });
  const slug = existing?.slug || `tenant-${tenantId.slice(0, 6).toLowerCase()}`;

  const row = await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: {
      ...(brandName !== undefined ? { brandName: brandName || "Your Company" } : {}),
      ...(website !== undefined ? { website: website || null } : {}),
    },
    create: {
      tenantId,
      slug,
      brandName: brandName || "Your Company",
      website: website || null,
      introHtml:
        "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
      links: [],
    },
  });

  res.json(row);
});

/**
 * POST /tenant/settings/enrich
 * Body: { website: string }
 * Scrapes the site, extracts brand + logo + phone, optionally refines via OpenAI,
 * and upserts TenantSettings (including logoUrl and links).
 */
router.post("/settings/enrich", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  let { website } = (req.body || {}) as { website?: string };
  if (!website) return res.status(400).json({ error: "website required" });

  try {
    website = ensureHttps(website);

    const resp = await fetch(website, {
      redirect: "follow",
      headers: { "User-Agent": "JoineryAI/1.0" },
    } as RequestInit);
    if (!resp.ok) {
      return res
        .status(400)
        .json({ error: `failed to fetch ${website} (${resp.status})` });
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    // Brand
    const brandName =
      $(`meta[property='og:site_name']`).attr("content") ||
      $("title").first().text() ||
      "Your Company";

    // Icons / logo candidates
    const candidates: string[] = [];
    $(
      "link[rel*='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']"
    ).each((_i, el) => {
      const href = $(el).attr("href");
      if (href) candidates.push(new URL(href, website!).href);
    });
    const ogImg = $(`meta[property='og:image']`).attr("content");
    if (ogImg) candidates.push(new URL(ogImg, website!).href);
    candidates.push(new URL("/favicon.ico", website!).href); // fallback
    const logoUrl = candidates[0] || null;

    // Phone (simple regex as a backup)
    const text = $("body").text().replace(/\s+/g, " ").slice(0, 15000);
    const phone = (text.match(/(\+?\d[\d\s().-]{7,}\d)/g) || [])[0]?.trim() || null;

    // JSON-LD org
    let orgJson: any = null;
    $(`script[type='application/ld+json']`).each((_i, el) => {
      try {
        const parsed = JSON.parse($(el).text());
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const org = arr.find((x) =>
          x && typeof x === "object"
            ? ["Organization", "LocalBusiness"].includes(x["@type"])
            : false
        );
        if (org && !orgJson) orgJson = org;
      } catch {}
    });

    // Seed before AI
    const seed = {
      brandName,
      website,
      phone: orgJson?.telephone || phone || null,
      address: orgJson?.address || null,
      logoUrl,
      links: [] as { label: string; url: string }[],
      introSuggestion: "",
    };

    // Optional AI clean-up (nice links + intro + quote defaults)
    let enriched = { ...seed };
    if (env.OPENAI_API_KEY) {
      const origin = new URL(website).origin;
      const navLinks = $("a[href]")
        .slice(0, 120)
        .map((_i, a) => {
          const href = $(a).attr("href") || "";
          const label = ($(a).text() || "").trim().replace(/\s+/g, " ");
          const abs = new URL(href, website!).href;
          if (!label || !abs.startsWith(origin) || label.length > 60) return null;
          return { label, url: abs };
        })
        .get()
        .filter(Boolean)
        .slice(0, 20) as { label: string; url: string }[];

      // Extract testimonials/reviews from page
      const testimonials: string[] = [];
      $('blockquote, .testimonial, .review, [class*="testimonial"], [class*="review"]')
        .slice(0, 10)
        .each((_i, el) => {
          const text = $(el).text().trim().replace(/\s+/g, " ").slice(0, 300);
          if (text.length > 20) testimonials.push(text);
        });

      const prompt = `
Return JSON with: brandName, phone, address, logoUrl, links (<=6 {label,url}),
introSuggestion (short plain text greeting for enquiries),
and quoteDefaults with: tagline, email, businessHours, overview (2-3 sentences about the company),
defaultTimber, defaultFinish, defaultGlazing, defaultFittings (if joinery/construction),
delivery (estimated timeframe), installation (if offered),
terms (brief payment/validity terms),
guarantees (array of {title, description} max 3),
testimonials (array of {quote, client, role} max 3 from scraped testimonials),
certifications (array of {name, description} if mentioned).

UK English. Be concise and professional.

SCRAPED:
- Title/og: ${seed.brandName}
- Phone: ${seed.phone || "-"}
- JSON-LD address: ${JSON.stringify(seed.address)}
- Candidate logo: ${seed.logoUrl || "-"}
- Found testimonials: ${testimonials.slice(0, 3).join(" | ")}

NAV LINKS:
${navLinks.map((l) => `- ${l.label} -> ${l.url}`).join("\n")}

BODY TEXT SAMPLE:
${text.slice(0, 2000)}
`;

      // Add timeout to OpenAI API call to prevent hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      let ai;
      try {
        ai = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        
        if (!ai.ok) {
          console.warn(`[tenant enrich] OpenAI API failed: ${ai.status}, falling back to scraped data`);
          // Continue with seed data (enriched already set to seed)
        } else {
          const data = await ai.json();
          const textOut =
            data?.output_text ||
            data?.choices?.[0]?.message?.content ||
            data?.choices?.[0]?.output_text ||
            "{}";

          try {
            const p = JSON.parse(String(textOut));
            enriched = {
              brandName: p.brandName || seed.brandName,
              phone: p.phone ?? seed.phone,
              website,
              logoUrl: p.logoUrl || seed.logoUrl || null,
              links: Array.isArray(p.links) ? p.links.slice(0, 6) : [],
              introSuggestion: p.introSuggestion || "",
              address: p.address ?? seed.address,
              quoteDefaults: p.quoteDefaults || {},
            } as any;
          } catch (parseError) {
            console.warn('[tenant enrich] Failed to parse OpenAI response, using seed data');
            // keep seed
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (fetchError.name === 'AbortError') {
          console.warn('[tenant enrich] OpenAI API timeout, falling back to scraped data');
        } else {
          console.warn('[tenant enrich] OpenAI API error:', fetchError.message, '- falling back to scraped data');
        }
        // Continue with seed data (enriched already set to seed)
      }
    }

    // Merge quoteDefaults with existing
    const existingSettings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const existingQuoteDefaults = ((existingSettings as any)?.quoteDefaults as any) || {};
    const incomingQD = (enriched as any).quoteDefaults || {};
    const mergedQuoteDefaults = {
      ...existingQuoteDefaults,
      ...incomingQD,
      // Prefer explicit enriched fields when available
      address: enriched.address || existingQuoteDefaults.address || null,
      guarantees: incomingQD.guarantees || existingQuoteDefaults.guarantees || [],
      testimonials: incomingQD.testimonials || existingQuoteDefaults.testimonials || [],
      certifications: incomingQD.certifications || existingQuoteDefaults.certifications || [],
    };

    // Upsert settings
    const saved = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: {
        brandName: enriched.brandName || "Your Company",
        website: enriched.website,
        phone: enriched.phone,
        logoUrl: enriched.logoUrl,
        links: enriched.links || [],
        quoteDefaults: mergedQuoteDefaults,
        ...(enriched.introSuggestion ? { introHtml: enriched.introSuggestion } : {}),
      },
      create: {
        tenantId,
        slug: `tenant-${tenantId.slice(0, 6)}`,
        brandName: enriched.brandName || "Your Company",
        website: enriched.website,
        phone: enriched.phone,
        logoUrl: enriched.logoUrl,
        links: enriched.links || [],
        introHtml: enriched.introSuggestion || null,
        quoteDefaults: mergedQuoteDefaults,
        questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
      },
    });

    res.json({ ok: true, settings: saved, enriched });
  } catch (e: any) {
    console.error("[tenant enrich] failed", e);
    res.status(500).json({ error: e?.message || "enrich failed" });
  }
});

/**
 * POST /tenant/settings/import-quote-pdf
 * Multipart form: field name 'pdfFile'
 * Extracts company info and quote defaults from an existing proposal PDF.
 */
router.post("/settings/import-quote-pdf", upload.single("pdfFile"), async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: "pdfFile is required" });
  }

  try {
    const parsed = await pdfParse(req.file.buffer);
    const text = String(parsed?.text || "").replace(/\s+/g, " ").slice(0, 200000);

    if (!env.OPENAI_API_KEY) {
      return res.status(400).json({ error: "OpenAI not configured on server" });
    }

    const prompt = `
Return JSON with keys: brandName, phone, email, address, quoteDefaults.
quoteDefaults contains: tagline, businessHours, overview, delivery, installation, terms,
guarantees (<=3 {title, description}), testimonials (<=3 {quote, client, role}), certifications (<=5 {name, description}).
If not present, omit or leave as null. UK English.

PDF TEXT (truncated):
${text}
`;

    const ai = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: prompt,
        response_format: { type: "json_object" },
      }),
    });
    const data = await ai.json();
    const textOut =
      data?.output_text ||
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.output_text ||
      "{}";

    let extracted: any = {};
    try {
      extracted = JSON.parse(String(textOut));
    } catch {}

    // Merge into existing settings
    const existing = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const existingQD = ((existing as any)?.quoteDefaults as any) || {};
    const qd = extracted?.quoteDefaults || {};
    const mergedQD = {
      ...existingQD,
      ...qd,
      email: extracted?.email || existingQD.email || null,
      address: extracted?.address || existingQD.address || null,
      guarantees: qd.guarantees || existingQD.guarantees || [],
      testimonials: qd.testimonials || existingQD.testimonials || [],
      certifications: qd.certifications || existingQD.certifications || [],
    };

    const saved = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: {
        brandName: extracted?.brandName || existing?.brandName || undefined,
        phone: extracted?.phone || existing?.phone || undefined,
        quoteDefaults: mergedQD,
      },
      create: {
        tenantId,
        slug: `tenant-${tenantId.slice(0, 6)}`,
        brandName: extracted?.brandName || "Your Company",
        phone: extracted?.phone || null,
        website: existing?.website || null,
        logoUrl: (existing as any)?.logoUrl || null,
        links: (existing as any)?.links || [],
        quoteDefaults: mergedQD,
        questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
      },
    });

    res.json({ ok: true, settings: saved, extracted });
  } catch (e: any) {
    console.error("[tenant import-quote-pdf] failed", e);
    res.status(500).json({ error: e?.message || "failed to parse PDF" });
  }
});

/** Public lookup by slug */
router.get("/settings/by-slug/:slug", async (req, res) => {
  const slug = String(req.params.slug || "").toLowerCase().trim();
  if (!slug) return res.status(400).json({ error: "slug required" });

  const s = await prisma.tenantSettings.findFirst({ where: { slug } });
  if (!s) return res.status(404).json({ error: "unknown tenant" });

  res.json({
    tenantId: s.tenantId,
    slug: s.slug,
    brandName: s.brandName,
    introHtml: s.introHtml ?? null,
    website: s.website ?? null,
    phone: s.phone ?? null,
    logoUrl: (s as any).logoUrl ?? null,
    links: (s.links as any) ?? [],
  });
});

/* ============================================================
   INBOX WATCH
============================================================ */
router.get("/inbox", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const inbox = (s?.inbox as any) || {};
  res.json({
    gmail: !!inbox.gmail,
    ms365: !!inbox.ms365,
    intervalMinutes:
      typeof inbox.intervalMinutes === "number" ? inbox.intervalMinutes : 10,
  });
});

router.put("/inbox", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { gmail = false, ms365 = false, intervalMinutes = 10 } = req.body || {};
  const s = await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: {
      inbox: {
        gmail: !!gmail,
        ms365: !!ms365,
        intervalMinutes: Number(intervalMinutes) || 10,
      },
    },
    create: {
      tenantId,
      slug: `tenant-${tenantId.slice(0, 6)}`,
      brandName: "Your Company",
      inbox: {
        gmail: !!gmail,
        ms365: !!ms365,
        intervalMinutes: Number(intervalMinutes) || 10,
      },
    },
  });
  res.json({ ok: true, inbox: s.inbox });
});

/* ============================================================
   LEAD SOURCE COSTS
============================================================ */
router.get("/costs", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { from, to } = req.query as { from?: string; to?: string };
  const where: any = { tenantId };
  if (from || to) {
    where.month = {};
    if (from) where.month.gte = new Date(from);
    if (to) where.month.lte = new Date(to);
  }
  const rows = await prisma.leadSourceCost.findMany({
    where,
    orderBy: [{ month: "desc" }, { source: "asc" }],
  });
  res.json(rows);
});

router.post("/costs", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { source, month, spend, leads, conversions, scalable } = req.body || {};
  if (!source || !month)
    return res
      .status(400)
      .json({ error: "source and month required (YYYY-MM-01)" });

  const monthDate = new Date(month);
  const row = await prisma.leadSourceCost.upsert({
    where: {
      tenantId_source_month: { tenantId, source, month: monthDate },
    },
    update: {
      spend: Number(spend) || 0,
      leads: Number(leads) || 0,
      conversions: Number(conversions) || 0,
      scalable: !!scalable,
    },
    create: {
      tenantId,
      source,
      month: monthDate,
      spend: Number(spend) || 0,
      leads: Number(leads) || 0,
      conversions: Number(conversions) || 0,
      scalable: !!scalable,
    },
  });
  res.json(row);
});

router.delete("/costs/:id", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const row = await prisma.leadSourceCost.findUnique({ where: { id } });
  if (!row || row.tenantId !== tenantId)
    return res.status(404).json({ error: "not found" });
  await prisma.leadSourceCost.delete({ where: { id } });
  res.json({ ok: true });
});

router.post("/images/import", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { slug, url, limit } = req.body || {};
  if (!slug || !url) {
    return res.status(400).json({ error: "slug and url required" });
  }

  try {
    // Import the script function dynamically
    const { execSync } = await import("child_process");
    const path = await import("path");
    
    const scriptPath = path.resolve(__dirname, "../../scripts/import_tenant_images.ts");
    const imageLimit = parseInt(limit) || 12;
    
    // Execute the import script
    const command = `npx tsx "${scriptPath}" --slug "${slug}" --url "${url}" --limit ${imageLimit}`;
    const output = execSync(command, {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf-8",
      timeout: 120000, // 2 minute timeout
    });

    // Parse the output to extract results
    const imagesMatch = output.match(/(\d+) images saved/);
    const imagesImported = imagesMatch ? parseInt(imagesMatch[1]) : 0;
    
    const manifestPath = `/src/data/tenants/${slug}_gallery.json`;
    const outputDir = `/tenants/${slug}/`;

    res.json({
      success: true,
      imagesImported,
      manifestPath,
      outputDir,
      message: output.includes("Complete!") ? "Import completed successfully" : output,
    });
  } catch (error: any) {
    console.error("Image import failed:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Import failed",
      imagesImported: 0,
    });
  }
});

export default router;