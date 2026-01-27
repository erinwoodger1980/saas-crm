// api/src/routes/evidence.ts
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
    if (typeof req.query?.networkId === "string") where.networkId = req.query.networkId;
    if (typeof req.query?.kind === "string") where.kind = req.query.kind;

    const items = await db.evidence.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    });

    return res.json({ ok: true, items });
  } catch (e: any) {
    console.error("[/evidence] list failed:", e?.message || e);
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

    const item = await db.evidence.create({
      data: {
        tenantId,
        networkId: body.networkId ? String(body.networkId) : undefined,
        productTypeId: body.productTypeId ? String(body.productTypeId) : undefined,
        kind: String(body.kind || "OTHER"),
        title: body.title ? String(body.title) : undefined,
        description: body.description ? String(body.description) : undefined,
        metadata: body.metadata ?? undefined,
        fileId: body.fileId ? String(body.fileId) : undefined,
        issuedAt: body.issuedAt ? new Date(String(body.issuedAt)) : undefined,
        expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined,
      },
    });

    return res.json({ ok: true, item });
  } catch (e: any) {
    console.error("[/evidence] create failed:", e?.message || e);
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

    const existing = await db.evidence.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: "not_found" });

    const item = await db.evidence.update({
      where: { id },
      data: {
        kind: body.kind ? String(body.kind) : undefined,
        title: body.title !== undefined ? String(body.title) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        metadata: body.metadata !== undefined ? body.metadata : undefined,
        fileId: body.fileId !== undefined ? (body.fileId ? String(body.fileId) : null) : undefined,
        issuedAt: body.issuedAt !== undefined ? (body.issuedAt ? new Date(String(body.issuedAt)) : null) : undefined,
        expiresAt: body.expiresAt !== undefined ? (body.expiresAt ? new Date(String(body.expiresAt)) : null) : undefined,
      },
    });

    return res.json({ ok: true, item });
  } catch (e: any) {
    console.error("[/evidence] update failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "unauthorized" });

    const { tenantId } = auth;
    const authz = await checkTjnAuthorised(tenantId);
    if (!authz.ok) return res.status(403).json({ error: "tjn_not_authorised" });
    const id = String(req.params.id);

    const existing = await db.evidence.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: "not_found" });

    await db.evidence.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[/evidence] delete failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
