// api/src/routes/tenant-decline-email.ts
import { Router } from "express";
import { prisma } from "../prisma";
import {
  DEFAULT_DECLINE_EMAIL_TEMPLATE,
  DeclineEmailTemplate,
  normalizeDeclineEmailTemplate,
} from "../lib/decline-email";

const router = Router();

function headerString(req: any, key: string): string | undefined {
  const raw = req.headers?.[key];
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

function getTenantId(req: any): string | null {
  return (
    (req.auth?.tenantId as string | undefined) ?? headerString(req, "x-tenant-id") ?? null
  );
}

function asPlainObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as any) : {};
}

async function readTemplateForTenant(tenantId: string): Promise<DeclineEmailTemplate> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { beta: true },
  });
  const raw = asPlainObject(settings?.beta).declineEmailTemplate;
  return normalizeDeclineEmailTemplate(raw);
}

async function writeTemplateForTenant(tenantId: string, template: DeclineEmailTemplate) {
  const existing = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { slug: true, brandName: true, beta: true },
  });

  const slug = existing?.slug ?? `tenant-${tenantId.slice(0, 6).toLowerCase()}`;
  const brandName = existing?.brandName ?? "Your Company";
  const mergedBeta = {
    ...asPlainObject(existing?.beta),
    declineEmailTemplate: template,
  };

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      slug,
      brandName,
      introHtml: null,
      website: null,
      phone: null,
      links: [],
      beta: mergedBeta,
    },
    update: {
      beta: mergedBeta,
    },
  });
}

function requireTenant(req: any, res: any): string | null {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const paramRaw = (req.params?.tenantId as string | undefined) ?? undefined;
  const paramId = paramRaw && paramRaw !== "default" ? paramRaw : undefined;
  if (paramId && paramId !== tenantId) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }

  return tenantId;
}

router.get("/:tenantId/decline-email", async (req, res) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;

    const template = await readTemplateForTenant(tenantId);
    res.json({ ok: true, template });
  } catch (err: any) {
    console.error("[tenant-decline-email:get]", err?.message || err);
    res.status(500).json({ error: "failed_to_load_template" });
  }
});

router.put("/:tenantId/decline-email", async (req, res) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;

    const incoming = req.body?.template as Partial<DeclineEmailTemplate> | undefined;
    const normalized = normalizeDeclineEmailTemplate(incoming);
    await writeTemplateForTenant(tenantId, normalized);
    res.json({ ok: true, template: normalized });
  } catch (err: any) {
    console.error("[tenant-decline-email:put]", err?.message || err);
    res.status(500).json({ error: "failed_to_save_template" });
  }
});

router.patch("/:tenantId/decline-email", async (req, res) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;

    const current = await readTemplateForTenant(tenantId);
    const incoming = req.body?.template as Partial<DeclineEmailTemplate> | undefined;
    const merged = normalizeDeclineEmailTemplate({ ...current, ...incoming });
    await writeTemplateForTenant(tenantId, merged);
    res.json({ ok: true, template: merged });
  } catch (err: any) {
    console.error("[tenant-decline-email:patch]", err?.message || err);
    res.status(500).json({ error: "failed_to_save_template" });
  }
});

router.post("/:tenantId/decline-email/reset", async (req, res) => {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;

    await writeTemplateForTenant(tenantId, DEFAULT_DECLINE_EMAIL_TEMPLATE);
    res.json({ ok: true, template: DEFAULT_DECLINE_EMAIL_TEMPLATE });
  } catch (err: any) {
    console.error("[tenant-decline-email:reset]", err?.message || err);
    res.status(500).json({ error: "failed_to_reset_template" });
  }
});

export default router;
