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
import { seedStandardFieldsForTenant } from "../lib/seedStandardFields";
import {
  generateBOMForLine,
  generateBOMForQuote,
  storeBOMInQuoteLine,
  getComponentDetails,
  updateComponentInclusionRules,
  updateComponentQuantityFormula
} from "../services/bom-generator";
import FireDoorPricingService, { generateFireDoorBOM, type FireDoorConfig } from "../services/fire-door-pricing";

const DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT = "Questionnaire for your estimate";
const DEFAULT_QUESTIONNAIRE_EMAIL_BODY =
  "Hi {{contactName}},\n\n" +
  "Please fill in this short questionnaire so we can prepare your estimate:\n" +
  "{{link}}\n\n" +
  "Thanks,\n{{brandName}}";

const router = Router();
import multer from "multer";
import pdfParse from "pdf-parse";
import { putObject } from "../lib/storage";
// Safe JSON parsing helper - prevents JSON.parse errors from causing 500s
function safeParseJson<T = any>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (e) {
      console.warn('[safeParseJson] Failed to parse JSON:', e);
      return fallback;
    }
  }
  return fallback;
}


// Simple in-memory upload for small files like PDFs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Restore default product catalog (doors + windows) for the tenant
router.post("/tenant/product-types/restore", async (req: any, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  // Default catalog mirrors web ProductTypesSection INITIAL_PRODUCTS
  const defaultCatalog = [
    {
      id: "doors",
      label: "Doors",
      types: [
        {
          type: "entrance",
          label: "Entrance Door",
          options: [
            { id: "entrance-single", label: "Single Door", imagePath: "/diagrams/doors/entrance-single.svg" },
            { id: "entrance-double", label: "Double Door", imagePath: "/diagrams/doors/entrance-double.svg" },
          ],
        },
        {
          type: "bifold",
          label: "Bi-fold",
          options: [
            { id: "bifold-2-panel", label: "2 Panel", imagePath: "/diagrams/doors/bifold-2.svg" },
            { id: "bifold-3-panel", label: "3 Panel", imagePath: "/diagrams/doors/bifold-3.svg" },
            { id: "bifold-4-panel", label: "4 Panel", imagePath: "/diagrams/doors/bifold-4.svg" },
          ],
        },
        {
          type: "sliding",
          label: "Sliding",
          options: [
            { id: "sliding-single", label: "Single Slider", imagePath: "/diagrams/doors/sliding-single.svg" },
            { id: "sliding-double", label: "Double Slider", imagePath: "/diagrams/doors/sliding-double.svg" },
          ],
        },
        {
          type: "french",
          label: "French Door",
          options: [
            { id: "french-standard", label: "Standard French", imagePath: "/diagrams/doors/french-standard.svg" },
            { id: "french-extended", label: "Extended French", imagePath: "/diagrams/doors/french-extended.svg" },
          ],
        },
      ],
    },
    {
      id: "windows",
      label: "Windows",
      types: [
        {
          type: "sash-cord",
          label: "Sash (Cord)",
          options: [
            { id: "sash-cord-single", label: "Single Hung", imagePath: "/diagrams/windows/sash-cord-single.svg" },
            { id: "sash-cord-double", label: "Double Hung", imagePath: "/diagrams/windows/sash-cord-double.svg" },
          ],
        },
        {
          type: "sash-spring",
          label: "Sash (Spring)",
          options: [
            { id: "sash-spring-single", label: "Single Hung", imagePath: "/diagrams/windows/sash-spring-single.svg" },
            { id: "sash-spring-double", label: "Double Hung", imagePath: "/diagrams/windows/sash-spring-double.svg" },
          ],
        },
        {
          type: "casement",
          label: "Casement",
          options: [
            { id: "casement-single", label: "Single Casement", imagePath: "/diagrams/windows/casement-single.svg" },
            { id: "casement-double", label: "Double Casement", imagePath: "/diagrams/windows/casement-double.svg" },
          ],
        },
        {
          type: "stormproof",
          label: "Stormproof",
          options: [
            { id: "stormproof-single", label: "Single Stormproof", imagePath: "/diagrams/windows/stormproof-single.svg" },
            { id: "stormproof-double", label: "Double Stormproof", imagePath: "/diagrams/windows/stormproof-double.svg" },
          ],
        },
        {
          type: "alu-clad",
          label: "Alu-Clad",
          options: [
            {
              id: "alu-clad-casement",
              label: "Casement",
              imagePath: "/diagrams/windows/alu-clad.svg",
              svg: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"16\" y=\"16\" width=\"68\" height=\"68\" rx=\"2\"/><rect x=\"20\" y=\"20\" width=\"60\" height=\"60\" rx=\"2\" stroke-width=\"2\"/><rect x=\"24\" y=\"24\" width=\"52\" height=\"52\" rx=\"1\"/></svg>",
            },
            { id: "alu-clad-tilt-turn", label: "Tilt & Turn", imagePath: "/diagrams/windows/alu-clad-tilt-turn.svg" },
          ],
        },
      ],
    },
  ];

  try {
    const updated = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { productTypes: defaultCatalog },
      create: {
        tenantId,
        slug: `tenant-${tenantId.slice(0, 6).toLowerCase()}`,
        brandName: "Your Company",
        introHtml: "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
        links: [],
        taskPlaybook: DEFAULT_TASK_PLAYBOOK,
        questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
        questionnaire: [],
        productTypes: defaultCatalog,
      },
    });

    res.json({ ok: true, productTypes: updated.productTypes });
  } catch (err: any) {
    console.error("[POST /tenant/product-types/restore] Failed:", err?.message || err);
    res.status(500).json({ error: "restore_failed", message: err?.message || "unknown error" });
  }
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

/** List users for current tenant (id, name, email) */
router.get("/users", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });
  try {
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    res.json(users);
  } catch (e: any) {
    console.error("[/tenant/users] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

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
        
          // Seed standard ML training fields for new tenant
          await seedStandardFieldsForTenant(tenantId);
        
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

    // Robust settings creation with slug collision handling
    const candidateSlugs = [
      `tenant-${tenantId.slice(0, 6).toLowerCase()}`,
      `tenant-${tenantId.slice(0, 8).toLowerCase()}`,
      tenantId.toLowerCase(),
      `tenant-${tenantId.slice(0, 6).toLowerCase()}-${Date.now().toString().slice(-4)}`,
    ];
    let created: any = null;
    for (const cand of candidateSlugs) {
      try {
        created = await prisma.tenantSettings.create({
          data: {
            tenantId,
            slug: cand,
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
        break; // success
      } catch (createErr: any) {
        // Unique violation -> try next slug; otherwise rethrow
        if (createErr?.code === "P2002") {
          console.warn(`[tenant/settings] slug collision for '${cand}', trying next candidate`);
          continue;
        } else {
          console.error("[tenant/settings] create failed", createErr?.message || createErr);
          throw createErr;
        }
      }
    }
    if (!created) {
      // Last resort: return ephemeral (not persisted) minimal settings so UI can still render
      console.error("[tenant/settings] All slug candidates exhausted; returning ephemeral settings");
      created = {
        tenantId,
        slug: `tenant-${tenantId.slice(0, 6).toLowerCase()}-ephemeral`,
        brandName: "Your Company",
        introHtml: "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
        links: [],
        taskPlaybook: DEFAULT_TASK_PLAYBOOK,
        questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
        questionnaire: preparedQuestions || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    s = created;
  }

    // Safe parsing of all JSON fields with fallbacks to prevent crashes
    const normalizedPlaybook = normalizeTaskPlaybook(safeParseJson(s?.taskPlaybook, {}));
    const normalizedQuestionnaire = normalizeQuestionnaire(safeParseJson(s?.questionnaire, []));
    const beta = toPlainObject(safeParseJson(s?.beta, {}));
    const ownerFirstName = cleanOptionalString(beta.ownerFirstName);
    const ownerLastName = cleanOptionalString(beta.ownerLastName);
    const aiLearning = toPlainObject(beta.aiFollowupLearning || {});
    
    // Safe quote defaults parsing - critical for settings page
    const quoteDefaults = safeParseJson(s?.quoteDefaults, {});
    const productTypes = safeParseJson(s?.productTypes, []);
    
    console.log('[GET /tenant/settings] Response data:', {
      tenantId,
      hasProductTypes: !!s?.productTypes,
      productTypesRaw: s?.productTypes,
      productTypesParsed: productTypes,
      productTypesLength: productTypes?.length
    });
    
    res.json({
      ...s,
      quoteDefaults,
      productTypes,
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
      errorCode: error.code,
      errorName: error.name,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({ 
      error: 'settings_fetch_failed',
      message: error.message,
      details: process.env.NODE_ENV === 'production' ? undefined : {
        code: error.code,
        name: error.name
      }
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
    isFireDoorManufacturer,
    isGroupCoachingMember,
    productTypes,
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
    if (inbox !== undefined) {
      const parsedInbox = safeParseJson(inbox, {});
      update.inbox = parsedInbox;
    }
    if (questionnaire !== undefined) {
      const parsedQ = safeParseJson(questionnaire, []);
      sanitizedQuestionnaire = normalizeQuestionnaire(parsedQ ?? []);
      const prepared = prepareQuestionnaireForSave(sanitizedQuestionnaire);
      update.questionnaire = prepared.length ? prepared : [];
    }
    if (quoteDefaults !== undefined) {
      const parsed = safeParseJson(quoteDefaults, {});
      update.quoteDefaults = parsed;
    }
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
    if (links !== undefined) {
      const parsedLinks = safeParseJson(links, []);
      update.links = Array.isArray(parsedLinks) ? parsedLinks : [];
    }
    if (introHtml !== undefined) update.introHtml = introHtml ?? null;
    if (website !== undefined) update.website = website ?? null;
    if (phone !== undefined) update.phone = phone ?? null;
    if (logoUrl !== undefined) update.logoUrl = logoUrl ?? null;
    if (taskPlaybook !== undefined) {
      const parsedPlaybook = safeParseJson(taskPlaybook, {});
      update.taskPlaybook = normalizeTaskPlaybook(parsedPlaybook);
    }
    if (questionnaireEmailSubject !== undefined) {
      const val = typeof questionnaireEmailSubject === "string" ? questionnaireEmailSubject.trim() : "";
      update.questionnaireEmailSubject = val || null;
    }
    if (questionnaireEmailBody !== undefined) {
      const val = typeof questionnaireEmailBody === "string" ? questionnaireEmailBody.trim() : "";
      update.questionnaireEmailBody = val || null;
    }
    if (isFireDoorManufacturer !== undefined) {
      update.isFireDoorManufacturer = !!isFireDoorManufacturer;
    }
    if (isGroupCoachingMember !== undefined) {
      update.isGroupCoachingMember = !!isGroupCoachingMember;
    }
    if (productTypes !== undefined) {
      // productTypes is Json type in Prisma, accept array or string
      if (Array.isArray(productTypes)) {
        update.productTypes = productTypes;
      } else if (typeof productTypes === 'string') {
        const parsed = safeParseJson(productTypes, []);
        update.productTypes = Array.isArray(parsed) ? parsed : [];
      } else {
        update.productTypes = [];
      }
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
      const requested = toPlainObject(safeParseJson(aiFollowupLearning, {}));
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

    const saved = await prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        slug: `tenant-${tenantId.slice(0, 6).toLowerCase()}`,
        brandName: "Your Company",
        introHtml: "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
        links: [],
        taskPlaybook: DEFAULT_TASK_PLAYBOOK,
        questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
        questionnaire: [],
        ...update,
      },
      update,
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
    const savedQuoteDefaults = safeParseJson((saved as any)?.quoteDefaults, {});
    return res.json({
      ...saved,
      quoteDefaults: savedQuoteDefaults,
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

      // Seed standard ML training fields
      await seedStandardFieldsForTenant(tenantId);
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

      // Extract certifications/accreditations
      const certifications: string[] = [];
      $('[class*="cert"], [class*="accred"], [class*="member"], [class*="award"], [class*="badge"]')
        .slice(0, 15)
        .each((_i, el) => {
          const text = $(el).text().trim().replace(/\s+/g, " ").slice(0, 200);
          if (text.length > 10) certifications.push(text);
        });

      // Extract about/guarantee sections
      const aboutSections: string[] = [];
      $('[class*="about"], [class*="why-choose"], [class*="guarantee"], [class*="warranty"], [class*="promise"]')
        .slice(0, 8)
        .each((_i, el) => {
          const text = $(el).text().trim().replace(/\s+/g, " ").slice(0, 500);
          if (text.length > 30) aboutSections.push(text);
        });

      const prompt = `
Extract comprehensive company information from this website and return as JSON.

Required structure:
{
  "brandName": "Company Name",
  "phone": "contact phone",
  "address": "full business address with postcode",
  "logoUrl": "best quality logo URL",
  "links": [{label: "Nav Label", url: "URL"}],  // max 6 useful nav links
  "introSuggestion": "Brief greeting for customer enquiries",
  "quoteDefaults": {
    "tagline": "company tagline/slogan",
    "email": "contact email for quotes",
    "businessHours": "opening hours",
    "overview": "2-3 sentence company description highlighting expertise",
    "defaultTimber": "default wood species if joinery company",
    "defaultFinish": "default finish option",
    "defaultGlazing": "default glazing type",
    "defaultFittings": "default hardware/fittings",
    "defaultMarginPercent": <number if standard markup mentioned>,
    "defaultVatRate": 20,  // UK VAT rate
    "delivery": "delivery information and typical timeframes",
    "installation": "installation services description",
    "terms": "payment terms and quote validity period",
    "guarantees": [{title: "Guarantee Name", description: "What's covered"}],  // max 3
    "testimonials": [{quote: "Customer feedback", client: "Client Name", role: "Position/Company"}],  // max 3
    "certifications": [{name: "Certification/Membership", description: "Details"}]  // max 5
  }
}

IMPORTANT: Extract ALL information thoroughly and comprehensively:
- Look for "About Us", "Why Choose Us", "Our Guarantee", "Services", "What We Do" sections
- Find ALL testimonials/reviews/customer feedback on the page
- Identify ANY certifications, memberships, trade associations, insurance details, accreditations
- Extract COMPLETE business address including street, town, county, and POSTCODE
- Find VAT number, company registration number, business registration details
- Look for warranty/guarantee information, quality promises, satisfaction guarantees
- Extract typical lead times, delivery areas, service coverage, installation details
- Find payment terms, deposit requirements, quote validity periods
- Look for opening hours, contact methods, response times
- Extract any standard materials, finishes, glazing types, hardware used
- Find typical markup/margin percentages if mentioned
- Look for environmental commitments, sustainable practices
- Extract any awards, recognitions, years in business, experience highlights

Be EXTREMELY thorough - extract every detail you can find. Use UK English spelling throughout.
If specific information isn't found, omit that field entirely. Don't make up information.
Prioritize accuracy and completeness over speed.

SCRAPED DATA:
- Page Title: ${seed.brandName}
- Phone Found: ${seed.phone || "Not found"}
- JSON-LD Address: ${JSON.stringify(seed.address)}
- Logo Candidate: ${seed.logoUrl || "Not found"}
- Testimonials Found: ${testimonials.length > 0 ? testimonials.slice(0, 3).join(" | ") : "None found"}

NAVIGATION LINKS (${navLinks.length} found):
${navLinks.map((l) => `- ${l.label} -> ${l.url}`).join("\n")}

CERTIFICATIONS/ACCREDITATIONS FOUND:
${certifications.length > 0 ? certifications.join("\n") : "None found"}

ABOUT/GUARANTEE SECTIONS:
${aboutSections.length > 0 ? aboutSections.join("\n\n") : "None found"}

FULL PAGE CONTENT (analyze thoroughly for all company details):
${text.slice(0, 12000)}
`;

      // Add timeout to OpenAI API call to prevent hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20 second timeout for thorough analysis
      
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
            messages: [
              { 
                role: "system", 
                content: "You are an expert at extracting comprehensive business information from websites. Be thorough and extract every detail you can find." 
              },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1, // Low temperature for consistent, accurate extraction
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
Extract company information from this PDF quote/proposal and return as JSON.

Required structure:
{
  "brandName": "Company Name",
  "phone": "contact number",
  "email": "contact email",
  "address": "full business address",
  "quoteDefaults": {
    "tagline": "company tagline or slogan",
    "businessHours": "opening hours",
    "overview": "2-3 sentence company description",
    "delivery": "delivery information and timeframes",
    "installation": "installation services offered",
    "terms": "payment terms and quote validity",
    "defaultMarginPercent": <number if mentioned>,
    "defaultVatRate": <number if VAT rate is stated, e.g. 20>,
    "guarantees": [{title: "Guarantee Name", description: "Details"}],  // max 3
    "testimonials": [{quote: "Testimonial text", client: "Client Name", role: "Position/Company"}],  // max 3
    "certifications": [{name: "Certification Name", description: "Details"}]  // max 5
  }
}

Extract ALL information present. For guarantees, look for warranties, quality promises, satisfaction guarantees.
For testimonials, look for customer reviews, feedback, recommendations.
For certifications, look for accreditations, memberships, qualifications, insurance details.
Use UK English spelling. If information is not found, omit the field or use null.

PDF TEXT:
${text}
`;

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
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

/**
 * POST /tenant/settings/upload-logo
 * Upload a logo image as base64 and update tenant settings
 */
router.post("/settings/upload-logo", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { logoBase64 } = req.body;

  if (!logoBase64 || typeof logoBase64 !== 'string') {
    return res.status(400).json({ error: "logoBase64 data is required" });
  }

  // Validate it's a data URL
  if (!logoBase64.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image data format' });
  }

  try {
    // Validate file size (base64 is ~33% larger than binary)
    const sizeInBytes = (logoBase64.length * 3) / 4;
    if (sizeInBytes > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Maximum size is 2MB' });
    }

    // Get tenant slug for create
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Update tenant settings with base64 logo
    const updated = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { logoUrl: logoBase64 },
      create: {
        tenantId,
        slug: tenant.slug,
        brandName: "Your Company",
        logoUrl: logoBase64,
        questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
      },
    });

    res.json({ ok: true, logoUrl: logoBase64, settings: updated });
  } catch (e: any) {
    console.error("[upload-logo] failed", e);
    res.status(500).json({ error: e?.message || "upload failed" });
  }
});

/**
 * POST /tenant/settings/testimonials/:index/photo
 * Multipart: field name 'photo'
 * Stores a testimonial photo and updates quoteDefaults.testimonials[index].photoUrl
 */
router.post("/settings/testimonials/:index/photo", upload.single("photo"), async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });
  const rawIndex = String(req.params.index || "").trim();
  const idx = Number(rawIndex);
  if (!Number.isInteger(idx) || idx < 0) return res.status(400).json({ error: "invalid_index" });
  if (!req.file || !req.file.buffer) return res.status(400).json({ error: "photo_required" });
  try {
    // Resolve tenant slug for storage path
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, id: true } });
    if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'settings_not_found' });
    const quoteDefaults = (settings as any).quoteDefaults || {};
    const testimonials: any[] = Array.isArray(quoteDefaults.testimonials) ? quoteDefaults.testimonials : [];
    if (idx >= testimonials.length) return res.status(404).json({ error: 'testimonial_not_found' });

    // Derive extension
    const original = req.file.originalname || 'photo.jpg';
    const ext = original.split('.').pop()?.toLowerCase() || 'jpg';
    if (!['jpg','jpeg','png','webp','gif'].includes(ext)) return res.status(400).json({ error: 'unsupported_type' });

    // Store object (re-use existing storage abstraction)
    const { publicUrl } = await putObject({ tenantSlug: tenant.slug, buffer: req.file.buffer, ext });

    // Update testimonial entry
    const updatedEntry = { ...testimonials[idx] }; // preserve existing fields
    delete (updatedEntry as any).photoDataUrl; // Remove inline base64 if present
    updatedEntry.photoUrl = publicUrl;
    testimonials[idx] = updatedEntry;
    const nextQuoteDefaults = { ...quoteDefaults, testimonials };

    const saved = await prisma.tenantSettings.update({
      where: { tenantId },
      data: { quoteDefaults: nextQuoteDefaults, updatedAt: new Date() },
    });
    return res.json({ ok: true, photoUrl: publicUrl, testimonial: updatedEntry, quoteDefaults: nextQuoteDefaults });
  } catch (e: any) {
    console.error('[testimonial photo upload] failed', e);
    return res.status(500).json({ error: e?.message || 'upload_failed' });
  }
});

/**
 * POST /tenant/settings/testimonials/:index/clear-photo
 * Clears photoUrl/photoDataUrl for a given testimonial index and persists.
 */
router.post("/settings/testimonials/:index/clear-photo", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });
  const rawIndex = String(req.params.index || "").trim();
  const idx = Number(rawIndex);
  if (!Number.isInteger(idx) || idx < 0) return res.status(400).json({ error: "invalid_index" });
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'settings_not_found' });
    const quoteDefaults = (settings as any).quoteDefaults || {};
    const testimonials: any[] = Array.isArray(quoteDefaults.testimonials) ? quoteDefaults.testimonials : [];
    if (idx >= testimonials.length) return res.status(404).json({ error: 'testimonial_not_found' });
    const entry = { ...testimonials[idx] } as any;
    delete entry.photoUrl;
    delete entry.photoDataUrl;
    testimonials[idx] = entry;
    const nextQuoteDefaults = { ...quoteDefaults, testimonials };
    await prisma.tenantSettings.update({ where: { tenantId }, data: { quoteDefaults: nextQuoteDefaults, updatedAt: new Date() } });
    return res.json({ ok: true, testimonial: entry });
  } catch (e: any) {
    console.error('[testimonial clear-photo] failed', e);
    return res.status(500).json({ error: e?.message || 'clear_failed' });
  }
});

/**
 * POST /tenant/settings/testimonials/migrate-photos
 * Converts any testimonials with photoDataUrl (base64) to stored objects with photoUrl.
 */
router.post("/settings/testimonials/migrate-photos", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'settings_not_found' });
    const quoteDefaults = (settings as any).quoteDefaults || {};
    const testimonials: any[] = Array.isArray(quoteDefaults.testimonials) ? quoteDefaults.testimonials : [];
    const updated: any[] = [...testimonials];
    let migrated = 0;

    for (let i = 0; i < updated.length; i++) {
      const t = updated[i] || {};
      const dataUrl: string | undefined = t.photoDataUrl;
      if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
        // Parse base64 data URL
        const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
        if (!m) continue;
        const mime = m[1];
        const b64 = m[2];
        const buffer = Buffer.from(b64, 'base64');
        // ext from mime
        const ext = mime.includes('jpeg') ? 'jpg' : mime.split('/').pop() || 'jpg';
        const { publicUrl } = await putObject({ tenantSlug: tenant.slug, buffer, ext });
        const next = { ...t };
        delete (next as any).photoDataUrl;
        next.photoUrl = publicUrl;
        updated[i] = next;
        migrated++;
      }
    }

    const nextQuoteDefaults = { ...quoteDefaults, testimonials: updated };
    const saved = await prisma.tenantSettings.update({ where: { tenantId }, data: { quoteDefaults: nextQuoteDefaults, updatedAt: new Date() } });
    return res.json({ ok: true, migrated, quoteDefaults: nextQuoteDefaults });
  } catch (e: any) {
    console.error('[migrate testimonial photos] failed', e);
    return res.status(500).json({ error: e?.message || 'migrate_failed' });
  }
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

// ============================================================================
// CONFIGURED PRODUCT SYSTEM - Phase 2 Endpoints
// ============================================================================

/**
 * Seeds the ConfiguredProduct starter library for a tenant
 * Creates: Attributes, ProductTypes, Questions, QuestionSets, Components
 */
router.post("/tenant/configured-product/seed", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    
    const { seedConfiguredProductStarter } = require('../../prisma/seeds/configured-product-starter');
    const result = await seedConfiguredProductStarter({ tenantId });
    
    res.json({
      success: true,
      message: 'ConfiguredProduct starter library seeded successfully',
      ...result
    });
  } catch (error: any) {
    console.error('Failed to seed ConfiguredProduct starter:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Seed failed'
    });
  }
});

/**
 * Creates LegacyQuestionMapping entries for existing QuestionnaireFields
 * Bridges legacy questionnaire system to canonical Attributes
 */
router.post("/tenant/configured-product/create-mappings", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    
    const { createLegacyMappingsForTenant } = await import('../services/configured-product-sync');
    const mappingCount = await createLegacyMappingsForTenant(tenantId);
    
    res.json({
      success: true,
      message: `Created ${mappingCount} legacy mappings`,
      mappingCount
    });
  } catch (error: any) {
    console.error('Failed to create legacy mappings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Mapping creation failed'
    });
  }
});

/**
 * Syncs existing QuestionnaireResponse data to ConfiguredProduct
 * Retroactively populates configuredProduct.selections from legacy answers
 */
router.post("/tenant/configured-product/sync-responses", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    const { quoteIds } = req.body; // Optional: sync specific quotes only
    
    const { syncResponseToConfiguredProduct } = await import('../services/configured-product-sync');
    
    // Get all responses for this tenant
    const where: any = { tenantId };
    if (quoteIds && Array.isArray(quoteIds)) {
      where.quoteId = { in: quoteIds };
    }
    
    const responses = await prisma.questionnaireResponse.findMany({
      where,
      select: { id: true, quoteId: true }
    });
    
    let syncedCount = 0;
    for (const response of responses) {
      try {
        await syncResponseToConfiguredProduct(response.id);
        syncedCount++;
      } catch (error) {
        console.error(`Failed to sync response ${response.id}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Synced ${syncedCount} of ${responses.length} responses`,
      syncedCount,
      totalResponses: responses.length
    });
  } catch (error: any) {
    console.error('Failed to sync responses:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sync failed'
    });
  }
});

/**
 * Gets the ConfiguredProduct migration status for a tenant
 */
router.get("/tenant/configured-product/status", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    
    const [
      attributeCount,
      productTypeCount,
      questionCount,
      questionSetCount,
      mappingCount,
      quotesWithConfig,
      totalQuotes
    ] = await Promise.all([
      prisma.attribute.count({ where: { tenantId } }),
      prisma.productType.count({ where: { tenantId } }),
      prisma.question.count({ where: { tenantId } }),
      prisma.questionSet.count({ where: { tenantId } }),
      prisma.legacyQuestionMapping.count({ where: { tenantId } }),
      prisma.quoteLine.count({
        where: {
          quote: { tenantId },
          configuredProduct: { not: null as any }
        }
      }),
      prisma.quote.count({ where: { tenantId } })
    ]);
    
    res.json({
      success: true,
      status: {
        attributes: attributeCount,
        productTypes: productTypeCount,
        questions: questionCount,
        questionSets: questionSetCount,
        legacyMappings: mappingCount,
        quotesWithConfiguredProduct: quotesWithConfig,
        totalQuotes,
        migrationProgress: totalQuotes > 0 ? Math.round((quotesWithConfig / totalQuotes) * 100) : 0
      }
    });
  } catch (error: any) {
    console.error('Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Status check failed'
    });
  }
});

/**
 * POST /tenant/bom/generate-for-line
 * Phase 5: Generate BOM for a specific quote line
 * Body: { quoteId, lineId }
 */
router.post("/tenant/bom/generate-for-line", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    
    const { quoteId, lineId } = req.body || {};
    if (!quoteId || !lineId) {
      return res.status(400).json({ error: 'quoteId and lineId required' });
    }

    // Verify ownership
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { tenantId: true }
    });
    if (!quote || quote.tenantId !== tenantId) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    // Get line with configured product
    const line = await prisma.quoteLine.findUnique({
      where: { id: lineId }
    });
    if (!line || line.quoteId !== quoteId) {
      return res.status(404).json({ error: 'line_not_found' });
    }

    // Generate BOM
    const config = line.configuredProduct as any;
    const selections = config?.selections || {};
    const productTypeId = config?.productTypeId;

    const bom = await generateBOMForLine(quoteId, lineId, selections, productTypeId);

    // Store in quoteLine.configuredProduct.derived
    await storeBOMInQuoteLine(lineId, bom);

    res.json({ success: true, bom });
  } catch (error: any) {
    console.error('Failed to generate BOM:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'BOM generation failed'
    });
  }
});

/**
 * POST /tenant/bom/generate-for-quote
 * Phase 5: Generate BOMs for all lines in a quote
 * Body: { quoteId }
 */
router.post("/tenant/bom/generate-for-quote", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    
    const { quoteId } = req.body || {};
    if (!quoteId) {
      return res.status(400).json({ error: 'quoteId required' });
    }

    // Verify ownership
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: { tenantId: true }
    });
    if (!quote || quote.tenantId !== tenantId) {
      return res.status(404).json({ error: 'quote_not_found' });
    }

    // Generate BOMs for all lines
    const boms = await generateBOMForQuote(quoteId);

    // Store each BOM
    for (const bom of boms) {
      await storeBOMInQuoteLine(bom.lineId, bom);
    }

    res.json({
      success: true,
      bomsGenerated: boms.length,
      boms
    });
  } catch (error: any) {
    console.error('Failed to generate BOMs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'BOM generation failed'
    });
  }
});

/**
 * GET /tenant/bom/component/:componentId
 * Phase 5: Get component details with evaluation
 * Query: ?selections=json (optional selections to evaluate rules)
 */
router.get("/tenant/bom/component/:componentId", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    
    const { componentId } = req.params;
    let selections: any = null;
    
    if (req.query.selections) {
      try {
        selections = typeof req.query.selections === 'string' 
          ? JSON.parse(req.query.selections)
          : req.query.selections;
      } catch (e) {
        console.warn('Failed to parse selections:', e);
      }
    }

    const details = await getComponentDetails(componentId, selections);
    res.json({ success: true, component: details });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    console.error('Failed to get component details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get component'
    });
  }
});

/**
 * POST /tenant/bom/component/:componentId/inclusion-rules
 * Phase 5: Update component inclusion rules
 * Body: { inclusionRules: { attributeCode: { operator, value } } | null }
 */
router.post("/tenant/bom/component/:componentId/inclusion-rules", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    
    const { componentId } = req.params;
    const { inclusionRules } = req.body || {};

    // Verify component exists and belongs to tenant (via ComponentLookup -> Tenant relation)
    const component = await prisma.componentLookup.findUnique({
      where: { id: componentId },
      select: { tenantId: true }
    });
    if (!component || component.tenantId !== tenantId) {
      return res.status(404).json({ error: 'component_not_found' });
    }

    await updateComponentInclusionRules(componentId, inclusionRules);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update inclusion rules:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Update failed'
    });
  }
});

/**
 * POST /tenant/bom/component/:componentId/quantity-formula
 * Phase 5: Update component quantity formula
 * Body: { quantityFormula: string | null }
 */
router.post("/tenant/bom/component/:componentId/quantity-formula", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    
    const { componentId } = req.params;
    const { quantityFormula } = req.body || {};

    // Verify component exists and belongs to tenant
    const component = await prisma.componentLookup.findUnique({
      where: { id: componentId },
      select: { tenantId: true }
    });
    if (!component || component.tenantId !== tenantId) {
      return res.status(404).json({ error: 'component_not_found' });
    }

    await updateComponentQuantityFormula(componentId, quantityFormula);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update quantity formula:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Update failed'
    });
  }
});

/**
 * POST /tenant/fire-door/calculate-price
 * Calculate complete price breakdown for a fire door configuration
 * Uses imported component and material data
 * 
 * Body: FireDoorConfig (dimensions, fire rating, materials, etc.)
 * Query: ?overheadPercent=15&marginPercent=25&shopRatePerHour=45
 */
router.post("/tenant/fire-door/calculate-price", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });

    const config: FireDoorConfig = req.body;
    const {
      overheadPercent,
      marginPercent,
      shopRatePerHour,
      includeLabour = true
    } = req.query;

    // Validate required fields
    if (!config.masterLeafWidth || !config.masterLeafHeight || !config.leafThickness) {
      return res.status(400).json({
        error: 'Missing required dimensions: masterLeafWidth, masterLeafHeight, leafThickness'
      });
    }

    if (!config.quantity || config.quantity < 1) {
      return res.status(400).json({
        error: 'quantity must be at least 1'
      });
    }

    const service = new FireDoorPricingService(prisma, tenantId);
    const breakdown = await service.calculatePrice(config, {
      overheadPercent: overheadPercent ? parseFloat(overheadPercent) : undefined,
      marginPercent: marginPercent ? parseFloat(marginPercent) : undefined,
      shopRatePerHour: shopRatePerHour ? parseFloat(shopRatePerHour) : undefined,
      includeLabour: includeLabour === 'true' || includeLabour === true,
    });

    res.json({
      success: true,
      breakdown
    });
  } catch (error: any) {
    console.error('Fire door pricing failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Pricing calculation failed'
    });
  }
});

/**
 * POST /tenant/fire-door/generate-bom
 * Generate BOM from fire door configuration
 * Returns line items that can be saved to a quote
 * 
 * Body: FireDoorConfig
 */
router.post("/tenant/fire-door/generate-bom", async (req: any, res) => {
  try {
    const tenantId = authTenantId(req);
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });

    const config: FireDoorConfig = req.body;

    // Validate required fields
    if (!config.masterLeafWidth || !config.masterLeafHeight || !config.leafThickness) {
      return res.status(400).json({
        error: 'Missing required dimensions'
      });
    }

    const bom = await generateFireDoorBOM(tenantId, config, prisma);

    res.json({
      success: true,
      bom
    });
  } catch (error: any) {
    console.error('Fire door BOM generation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'BOM generation failed'
    });
  }
});

export default router;