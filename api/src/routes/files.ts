import { Router } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";

const router = Router();

/**
 * GET /files
 * Lists recent uploaded files for the authenticated tenant. Optional query:
 *   - kind: string (e.g., SUPPLIER_QUOTE)
 *   - limit: number (default 25, max 100)
 */
router.get("/", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 25), 100));

    const where: any = { tenantId };
    if (kind) where.kind = kind as any;

    const items = await prisma.uploadedFile.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        kind: true,
        quoteId: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
      },
    });

    res.json({ ok: true, count: items.length, items });
  } catch (e: any) {
    console.error("[/files] list failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

async function resolveFileRequest(req: any, res: any) {
  const id = String(req.params.id);
  const token = String((req.query?.jwt as string) || "");
  if (!token) {
    res.status(401).json({ error: "missing_jwt" });
    return null;
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, env.APP_JWT_SECRET);
  } catch {
    res.status(401).json({ error: "invalid_jwt" });
    return null;
  }

  const tenantId = typeof decoded?.t === "string" ? decoded.t : null;
  const quoteIdFromToken = typeof decoded?.q === "string" ? decoded.q : null;
  if (!tenantId) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }

  const file = await prisma.uploadedFile.findFirst({
    where: { id, tenantId },
    select: { id: true, path: true, name: true, mimeType: true, quoteId: true, sizeBytes: true },
  });
  if (!file) {
    res.status(404).json({ error: "not_found" });
    return null;
  }

  if (quoteIdFromToken && file.quoteId && file.quoteId !== quoteIdFromToken) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }

  const abs = path.isAbsolute(file.path) ? file.path : path.join(process.cwd(), file.path);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ error: "missing_file" });
    return null;
  }

  const stat = fs.statSync(abs);
  return { file, abs, stat } as const;
}

async function sendFile(req: any, res: any, mode: "GET" | "HEAD") {
  try {
    const resolved = await resolveFileRequest(req, res);
    if (!resolved) return;

    const { file, abs, stat } = resolved;
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${file.name}"`);
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "private, max-age=0, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    if (mode === "HEAD") {
      res.status(200).end();
      return;
    }

    const stream = fs.createReadStream(abs);
    stream.on("error", (err) => {
      console.error("[/files/:id] stream error", err?.message || err);
      if (!res.headersSent) res.status(500).json({ error: "stream_error" });
      else res.end();
    });
    stream.pipe(res);
  } catch (e: any) {
    console.error(`[/files/${req.params?.id}] failed:`, e?.message || e);
    if (!res.headersSent) res.status(500).json({ error: "internal_error" });
  }
}

/**
 * HEAD /files/:id
 * Allows external services (e.g., ML parsers) to verify the signed URL before downloading.
 */
router.head("/:id", async (req, res) => {
  await sendFile(req, res, "HEAD");
});

/**
 * GET /files/:id?jwt=...
 * Streams an uploaded file by id when provided a valid signed JWT.
 * The token payload must include { t: tenantId } and optionally { q: quoteId }.
 */
router.get("/:id", async (req, res) => {
  await sendFile(req, res, "GET");
});

export default router;
