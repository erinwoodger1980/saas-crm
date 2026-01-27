// api/src/routes/dop.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { checkTjnAuthorised } from "../lib/tjn";

const router = Router();
const db = prisma as any;

function getAuth(req: any) {
  const tenantId = req.auth?.tenantId as string | undefined;
  const userId = req.auth?.userId as string | undefined;
  if (!tenantId || !userId) return null;
  return { tenantId, userId };
}

router.get("/", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { tenantId } = auth;
    const authz = await checkTjnAuthorised(tenantId);
    if (!authz.ok) return res.status(403).json({ error: "tjn_not_authorised" });
    const effectiveTenantId = authz.isOwner ? tenantId : authz.network?.tenantId || tenantId;
    const where: any = { tenantId: effectiveTenantId };
    if (typeof req.query?.productTypeId === "string") where.productTypeId = req.query.productTypeId;
    if (typeof req.query?.status === "string") where.status = req.query.status;

    const items = await db.doP.findMany({
      where,
      include: { evidences: { include: { evidence: true } } },
      orderBy: [{ createdAt: "desc" }],
    });

    return res.json({ ok: true, items });
  } catch (e: any) {
    console.error("[/dop] list failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { tenantId } = auth;
    const authz = await checkTjnAuthorised(tenantId);
    if (!authz.ok) return res.status(403).json({ error: "tjn_not_authorised" });
    const body = req.body || {};
    const productTypeId = String(body.productTypeId || "");
    const version = String(body.version || "");
    if (!productTypeId || !version) {
      return res.status(400).json({ error: "productTypeId_and_version_required" });
    }

    const evidenceIds = Array.isArray(body.evidenceIds) ? body.evidenceIds.map(String) : [];

    const item = await db.doP.create({
      data: {
        tenantId,
        productTypeId,
        status: body.status ? String(body.status) : "DRAFT",
        version,
        issuedAt: body.issuedAt ? new Date(String(body.issuedAt)) : undefined,
        expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined,
        performance: body.performance ?? undefined,
        metadata: body.metadata ?? undefined,
        evidences: evidenceIds.length
          ? {
              create: evidenceIds.map((evidenceId: string) => ({ evidenceId })),
            }
          : undefined,
      },
      include: { evidences: { include: { evidence: true } } },
    });

    return res.json({ ok: true, item });
  } catch (e: any) {
    console.error("[/dop] create failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { tenantId } = auth;
    const authz = await checkTjnAuthorised(tenantId);
    if (!authz.ok) return res.status(403).json({ error: "tjn_not_authorised" });
    const id = String(req.params.id);
    const body = req.body || {};

    const existing = await db.doP.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: "not_found" });

    const evidenceIds = Array.isArray(body.evidenceIds) ? body.evidenceIds.map(String) : null;

    const item = await db.$transaction(async (tx: any) => {
      if (evidenceIds) {
        await tx.doPEvidence.deleteMany({ where: { dopId: id } });
      }
      return tx.doP.update({
        where: { id },
        data: {
          status: body.status !== undefined ? String(body.status) : undefined,
          version: body.version !== undefined ? String(body.version) : undefined,
          issuedAt: body.issuedAt !== undefined ? (body.issuedAt ? new Date(String(body.issuedAt)) : null) : undefined,
          expiresAt: body.expiresAt !== undefined ? (body.expiresAt ? new Date(String(body.expiresAt)) : null) : undefined,
          performance: body.performance !== undefined ? body.performance : undefined,
          metadata: body.metadata !== undefined ? body.metadata : undefined,
          evidences: evidenceIds
            ? {
                create: evidenceIds.map((evidenceId: string) => ({ evidenceId })),
              }
            : undefined,
        },
        include: { evidences: { include: { evidence: true } } },
      });
    });

    return res.json({ ok: true, item });
  } catch (e: any) {
    console.error("[/dop] update failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
