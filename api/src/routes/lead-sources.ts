// api/src/routes/lead-sources.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

const router = Router();

type AuthedReq = Request & { auth?: { tenantId?: string } };
function getAuth(req: AuthedReq) {
  return { tenantId: req.auth?.tenantId as string | undefined };
}

const upsertSchema = z.object({
  source: z.string().min(1),
  scalable: z.coerce.boolean().optional().default(true),
});

router.get("/", async (req: AuthedReq, res: Response) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const rows = await prisma.leadSourceConfig.findMany({
      where: { tenantId },
      orderBy: { source: "asc" },
      select: { id: true, source: true, scalable: true },
    });

    res.json(rows);
  } catch (err) {
    console.error("GET /lead-sources error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/", async (req: AuthedReq, res: Response) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const parsed = upsertSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const source = parsed.data.source.trim();
    if (!source) return res.status(400).json({ error: "invalid_source" });

    // Avoid case-variant duplicates (unique index is case-sensitive in Postgres by default)
    const existing = await prisma.leadSourceConfig.findFirst({
      where: { tenantId, source: { equals: source, mode: "insensitive" } },
      select: { id: true },
    });

    const row = existing
      ? await prisma.leadSourceConfig.update({
          where: { id: existing.id },
          data: { source, scalable: parsed.data.scalable },
          select: { id: true, source: true, scalable: true },
        })
      : await prisma.leadSourceConfig.create({
          data: { tenantId, source, scalable: parsed.data.scalable },
          select: { id: true, source: true, scalable: true },
        });

    res.json(row);
  } catch (err) {
    console.error("POST /lead-sources error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.delete("/:id", async (req: AuthedReq, res: Response) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);

    const result = await prisma.leadSourceConfig.deleteMany({
      where: { tenantId, id },
    });

    if (result.count === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /lead-sources/:id error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
