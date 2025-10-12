// api/src/routes/tenants.ts
import { Router } from "express";
import { prisma } from "../prisma";
import * as cheerio from "cheerio";
import { env } from "../env";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
  };
}

/** Get current tenant settings (by auth); create defaults if missing */
router.get("/settings", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  let s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  if (!s) {
    const defaultSlug = "tenant-" + tenantId.slice(0, 6).toLowerCase();
    s = await prisma.tenantSettings.create({
      data: {
        tenantId,
        slug: defaultSlug,
        brandName: "Your Company",
        introHtml: "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
        links: [],
      },
    });
  }
  res.json(s);
});

/**
 * POST /tenant/settings/enrich
 * Body: { website: string }
 */
router.post("/settings/enrich", async (req, res) => {
  try {
    const { tenantId } = getAuth(req as any);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    let { website } = (req.body || {}) as { website?: string };
    if (!website) return res.status(400).json({ error: "website required" });

    // Normalize URL
    if (!/^https?:\/\//i.test(website)) website = "https://" + website;

    // Fetch homepage (Node 18+ has global fetch)
    const resp = await fetch(website, {
      redirect: "follow",
      headers: { "User-Agent": "JoineryAI/1.0" },
    } as RequestInit);
    if (!resp.ok) {
      return res.status(400).json({ error: `failed to fetch ${website} (${resp.status})` });
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    // Candidate brand name
    const title =
      ($("meta[property='og:site_name']").attr("content") || $("title").first().text() || "").trim();

    // Logos / icons
    const logoCandidates: string[] = [];
    $("link[rel*='icon'], link[rel='apple-touch-icon'], link[rel='shortcut icon']").each(
      (_idx: number, el: any) => {
        const href = $(el).attr("href");
        if (href) logoCandidates.push(new URL(href, website!).href);
      }
    );
    const ogImg = $("meta[property='og:image']").attr("content");
    if (ogImg) logoCandidates.push(new URL(ogImg, website!).href);
    logoCandidates.push(new URL("/favicon.ico", website!).href); // last resort
    const logoUrl = logoCandidates[0] || null;

    // Phone (quick regex across body text)
    const textSample = $("body").text().replace(/\s+/g, " ").slice(0, 12000);
    const phoneMatches = textSample.match(/(\+?\d[\d\s().-]{7,}\d)/g) || [];
    const phone = phoneMatches[0]?.trim() || null;

    // Try to extract Organization/LocalBusiness from JSON-LD
    let orgJson: any = null;
    $("script[type='application/ld+json']").each((_i: number, el: any) => {
      try {
        const raw = $(el).text();
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const org = arr.find(
          (x: any) => x && typeof x === "object" && ["Organization", "LocalBusiness"].includes(x["@type"])
        );
        if (org && !orgJson) orgJson = org;
      } catch {
        // ignore
      }
    });

    const initialDraft = {
      brandName: title || orgJson?.name || "Your Company",
      website,
      phone: orgJson?.telephone || phone || null,
      address: orgJson?.address || null,
      logoUrl,
      links: [] as { label: string; url: string }[],
      introSuggestion: "",
    };

    // Optionally refine with OpenAI
    let aiOut = { ...initialDraft };
    if (env.OPENAI_API_KEY) {
      const origin = new URL(website!).origin;
      const navLinks = $("a[href]")
        .slice(0, 120)
        .map((_i: number, a: any) => {
          const href = $(a).attr("href") || "";
          const label = ($(a).text() || "").trim().replace(/\s+/g, " ");
          const abs = new URL(href, website!).href;
          if (!label || !abs.startsWith(origin)) return null;
          if (label.length > 60) return null;
          return { label, url: abs };
        })
        .get()
        .filter(Boolean)
        .slice(0, 20) as { label: string; url: string }[];

      const prompt = `
From the following scraped details, output a compact JSON object with:
brandName, phone (single string or null), address (one line or null), logoUrl (a URL or null),
links (up to 6 helpful on-site links as {label,url}), and a short plain-text "introSuggestion"
that greets a new enquiry and points to the main product pages. Keep it UK-English. Avoid emojis.

SCRAPED:
- Title/og: ${initialDraft.brandName}
- Phone (regex): ${phone || "-"}
- JSON-LD name: ${orgJson?.name || "-"}
- JSON-LD telephone: ${orgJson?.telephone || "-"}
- JSON-LD address: ${JSON.stringify(orgJson?.address || null)}
- Candidate logo: ${logoUrl || "-"}

NAV LINKS (label -> url):
${navLinks.map((l) => `- ${l.label} -> ${l.url}`).join("\n")}
`;

      const respAi = await fetch("https://api.openai.com/v1/responses", {
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

      const json = await respAi.json();
      const textOut =
        json?.output_text ||
        json?.choices?.[0]?.message?.content ||
        json?.choices?.[0]?.output_text ||
        "{}";

      try {
        const parsed = JSON.parse(String(textOut));
        aiOut = {
          brandName: parsed.brandName || initialDraft.brandName,
          phone: parsed.phone ?? initialDraft.phone ?? null,
          website: website!,
          logoUrl: parsed.logoUrl || initialDraft.logoUrl || null,
          links: Array.isArray(parsed.links) ? parsed.links.slice(0, 6) : [],
          introSuggestion: parsed.introSuggestion || "",
          address: parsed.address ?? null,
        } as any;
      } catch {
        // fall back to initialDraft if parsing fails
      }
    }

    // Upsert TenantSettings
    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: {
        brandName: aiOut.brandName || "Your Company",
        website: aiOut.website,
        phone: aiOut.phone,
        logoUrl: aiOut.logoUrl,
        links: aiOut.links || [],
        // Seed intro if currently empty
        introHtml: aiOut.introSuggestion ? (aiOut.introSuggestion as string) : undefined,
      },
      create: {
        tenantId,
        slug: "tenant-" + tenantId.slice(0, 6),
        brandName: aiOut.brandName || "Your Company",
        website: aiOut.website,
        phone: aiOut.phone,
        logoUrl: aiOut.logoUrl,
        links: aiOut.links || [],
        introHtml: aiOut.introSuggestion || null,
      },
    });

    return res.json({ ok: true, settings });
  } catch (e: any) {
    console.error("[tenant enrich] failed:", e);
    return res.status(500).json({ error: e?.message || "enrich failed" });
  }
});

/** Update current tenant settings */
router.put("/settings", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const {
    slug,
    brandName,
    introHtml,
    website,
    phone,
    links,
    logoUrl,          // optional, if you added it
    questionnaire,    // ✅ persist this
  } = req.body || {};

  if (!slug || !brandName) {
    return res.status(400).json({ error: "slug and brandName required" });
  }

  // (Optional) light validation to avoid nuking your data with junk
  let qToSave: any = null;
  if (Array.isArray(questionnaire)) {
    // Each item: { id, key, label, type, required?, options? }
    qToSave = questionnaire.map((f: any) => ({
      id: String(f.id || crypto.randomUUID?.() || Date.now()),
      key: String(f.key || "").trim(),
      label: String(f.label || "").trim(),
      type: String(f.type || "text"),
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options.slice(0, 50) : undefined,
    }));
  }

  try {
    const updated = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: {
        slug,
        brandName,
        introHtml: introHtml ?? null,
        website: website ?? null,
        phone: phone ?? null,
        logoUrl: logoUrl ?? undefined,        // only if your schema has logoUrl
        links: Array.isArray(links) ? links : [],
        questionnaire: qToSave ?? undefined,  // ✅ save questionnaire when provided
      },
      create: {
        tenantId,
        slug,
        brandName,
        introHtml: introHtml ?? null,
        website: website ?? null,
        phone: phone ?? null,
        logoUrl: logoUrl ?? undefined,        // only if in schema
        links: Array.isArray(links) ? links : [],
        questionnaire: qToSave ?? null,       // ✅ seed questionnaire
      },
    });
    res.json(updated); // ✅ return it so the UI keeps state after save
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "save failed" });
  }
});

/** Public lookup by slug (for /q/:slug/:id) */
router.get("/settings/by-slug/:slug", async (req, res) => {
  const slug = String(req.params.slug || "").toLowerCase().trim();
  if (!slug) return res.status(400).json({ error: "slug required" });

  const s = await prisma.tenantSettings.findFirst({ where: { slug } });
  if (!s) return res.status(404).json({ error: "unknown tenant" });

  // Return only public-safe fields
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
// ========== INBOX WATCH (GET/PUT) ==========
router.get("/inbox", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const s = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const inbox = (s?.inbox as any) || {};
  res.json({
    gmail: !!inbox.gmail,
    ms365: !!inbox.ms365,
    intervalMinutes: typeof inbox.intervalMinutes === "number" ? inbox.intervalMinutes : 10,
  });
});

router.put("/inbox", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { gmail = false, ms365 = false, intervalMinutes = 10 } = req.body || {};
  const s = await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: { inbox: { gmail: !!gmail, ms365: !!ms365, intervalMinutes: Number(intervalMinutes) || 10 } },
    create: {
      tenantId,
      slug: "tenant-" + tenantId.slice(0, 6),
      brandName: "Your Company",
      inbox: { gmail: !!gmail, ms365: !!ms365, intervalMinutes: Number(intervalMinutes) || 10 },
    },
  });
  res.json({ ok: true, inbox: s.inbox });
});

// ========== LEAD SOURCE COSTS ==========
router.get("/costs", async (req, res) => {
  const { tenantId } = getAuth(req);
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
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { source, month, spend, leads, conversions, scalable } = req.body || {};
  if (!source || !month) return res.status(400).json({ error: "source and month required (YYYY-MM-01)" });

  const monthDate = new Date(month); // pass first-of-month
  const row = await prisma.leadSourceCost.upsert({
    where: { tenantId_source_month: { tenantId, source, month: monthDate } },
    update: { spend: Number(spend) || 0, leads: Number(leads) || 0, conversions: Number(conversions) || 0, scalable: !!scalable },
    create: { tenantId, source, month: monthDate, spend: Number(spend) || 0, leads: Number(leads) || 0, conversions: Number(conversions) || 0, scalable: !!scalable },
  });
  res.json(row);
});

router.delete("/costs/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });
  const id = String(req.params.id);
  const row = await prisma.leadSourceCost.findUnique({ where: { id } });
  if (!row || row.tenantId !== tenantId) return res.status(404).json({ error: "not found" });
  await prisma.leadSourceCost.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;