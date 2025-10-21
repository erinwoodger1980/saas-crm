// api/src/routes/tenants.ts
import { Router } from "express";
import { prisma } from "../prisma";
import * as cheerio from "cheerio";
import { env } from "../env";
import { DEFAULT_TASK_PLAYBOOK, normalizeTaskPlaybook } from "../task-playbook";
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

/* ------------------------- helpers ------------------------- */
function authTenantId(req: any): string | null {
  return (req?.auth?.tenantId as string) || null;
}
function ensureHttps(u: string) {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
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

/* ============================================================
   SETTINGS
============================================================ */

/** Get current tenant settings (create defaults if missing) */
router.get("/settings", async (req, res) => {
  const tenantId = authTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  let s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!s) {
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
      },
    });
  }

  const normalizedPlaybook = normalizeTaskPlaybook(s?.taskPlaybook as any);
  const normalizedQuestionnaire = normalizeQuestionnaire((s as any)?.questionnaire ?? []);
  res.json({
    ...s,
    taskPlaybook: normalizedPlaybook,
    questionnaire: normalizedQuestionnaire,
    questionnaireEmailSubject: s?.questionnaireEmailSubject ?? DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
    questionnaireEmailBody: s?.questionnaireEmailBody ?? DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
  });
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

    const saved = await prisma.tenantSettings.update({
      where: { tenantId },
      data: update,
    });

    if (sanitizedQuestionnaire) {
      await syncLeadFieldDefs(tenantId, sanitizedQuestionnaire);
    }

    const normalizedPlaybook = normalizeTaskPlaybook(saved.taskPlaybook as any);
    const normalizedQuestionnaire = normalizeQuestionnaire((saved as any).questionnaire ?? []);
    return res.json({
      ...saved,
      taskPlaybook: normalizedPlaybook,
      questionnaire: normalizedQuestionnaire,
      questionnaireEmailSubject: saved.questionnaireEmailSubject ?? DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
      questionnaireEmailBody: saved.questionnaireEmailBody ?? DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
    });
  } catch (e: any) {
    console.error("[tenant/settings PATCH] failed:", e?.message || e);
    return res.status(500).json({ error: "update_failed", detail: e?.message || String(e) });
  }
}

router.patch("/settings", updateSettings);
router.put("/settings", updateSettings);

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

    // Optional AI clean-up (nice links + intro)
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

      const prompt = `
Return JSON with: brandName, phone, address, logoUrl, links (<=6 {label,url}),
and introSuggestion (short plain text greeting for enquiries). UK English.

SCRAPED:
- Title/og: ${seed.brandName}
- Phone: ${seed.phone || "-"}
- JSON-LD address: ${JSON.stringify(seed.address)}
- Candidate logo: ${seed.logoUrl || "-"}

NAV LINKS:
${navLinks.map((l) => `- ${l.label} -> ${l.url}`).join("\n")}
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
        } as any;
      } catch {
        // keep seed
      }
    }

    // Upsert settings
    const saved = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: {
        brandName: enriched.brandName || "Your Company",
        website: enriched.website,
        phone: enriched.phone,
        logoUrl: enriched.logoUrl,
        links: enriched.links || [],
        ...(enriched.introSuggestion
          ? { introHtml: enriched.introSuggestion }
          : {}),
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
        questionnaireEmailSubject: DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT,
        questionnaireEmailBody: DEFAULT_QUESTIONNAIRE_EMAIL_BODY,
      },
    });

    res.json({ ok: true, settings: saved });
  } catch (e: any) {
    console.error("[tenant enrich] failed", e);
    res.status(500).json({ error: e?.message || "enrich failed" });
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

export default router;