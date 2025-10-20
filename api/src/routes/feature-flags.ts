import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
    email: req.auth?.email as string | undefined,
  };
}

function asPlainObject(v: any): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

/**
 * GET /feature-flags
 * Returns the current beta flags blob for this tenant.
 */
router.get("/", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { beta: true },
    });

    return res.json({ beta: asPlainObject(settings?.beta ?? {}) });
  } catch (e: any) {
    console.error("[feature-flags GET] failed:", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

/**
 * PATCH /feature-flags
 * Body can be either { beta: {...} } or a plain object (we'll treat as beta).
 * Upserts TenantSettings with required fields on create (slug, brandName).
 */
router.patch("/", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // Accept either { beta: {...} } or raw object as beta
    const raw = req.body?.beta !== undefined ? req.body.beta : req.body;
    const incoming = asPlainObject(raw);

    // Fetch existing for required fields
    const existing = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: {
        tenantId: true,
        slug: true,
        brandName: true,
        beta: true,
      },
    });

    const mergedBeta = {
      ...(asPlainObject(existing?.beta)),
      ...incoming,
    };

    const slug = existing?.slug ?? `tenant-${tenantId.slice(0, 6)}`;
    const brandName = existing?.brandName ?? "Your Brand";

    const saved = await prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        slug,
        brandName,
        introHtml: null,
        website: null,
        phone: null,
        links: {},
        quoteDefaults: {},
        beta: mergedBeta,
      },
      update: {
        beta: mergedBeta,
      },
      select: { beta: true },
    });

    return res.json({ ok: true, beta: asPlainObject(saved.beta) });
  } catch (e: any) {
    console.error("[feature-flags PATCH] failed:", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

export default router;