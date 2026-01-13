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

/**
 * POST /files/sign
 * Returns a signed relative URL for a file that the ML service (via API) can access.
 * Body: { fileId: string, quoteId?: string }
 */
router.post("/sign", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const fileId = String(req.body?.fileId || "").trim();
    const quoteId = req.body?.quoteId ? String(req.body.quoteId) : undefined;
    if (!fileId) return res.status(400).json({ error: "missing_fileId" });

    const file = await prisma.uploadedFile.findFirst({ where: { id: fileId, tenantId }, select: { id: true } });
    if (!file) return res.status(404).json({ error: "not_found" });

    const payload: Record<string, string> = { t: tenantId };
    if (quoteId) payload.q = quoteId;
    const token = jwt.sign(payload, env.APP_JWT_SECRET, { expiresIn: "30m" });

    // Return a relative path – the frontend can prefix with API base
    const signedPath = `/files/${encodeURIComponent(fileId)}?jwt=${encodeURIComponent(token)}`;
    return res.json({ ok: true, url: signedPath });
  } catch (e: any) {
    console.error("[/files/sign] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

type ResolvedDiskFile = {
  source: "disk";
  file: { id: string; path: string; name: string; mimeType: string | null; quoteId: string | null; sizeBytes: number | null };
  abs: string;
  stat: fs.Stats;
};

type ResolvedDbFile = {
  source: "db";
  file: { id: string; path: string; name: string; mimeType: string | null; quoteId: string | null; sizeBytes: number | null };
  length: number;
  content?: Buffer;
};

function uploadsStoreInDb(): boolean {
  return String(process.env.UPLOADS_STORE_IN_DB ?? "true").toLowerCase() !== "false";
}

function uploadsDbMaxBytes(): number {
  const raw = Number(process.env.UPLOADS_DB_MAX_BYTES);
  // Keep this aligned with the upload path defaults.
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 8 * 1024 * 1024;
}

async function resolveFileRequest(req: any, res: any, mode: "GET" | "HEAD"): Promise<ResolvedDiskFile | ResolvedDbFile | null> {
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

  const p = String(file.path || "");
  const abs = p && (path.isAbsolute(p) ? p : path.join(process.cwd(), p));
  if (abs && fs.existsSync(abs)) {
    const stat = fs.statSync(abs);
    return { source: "disk", file: file as any, abs, stat };
  }

  // Render can lose local disk between restarts; fall back to DB blob storage when enabled.
  if (!uploadsStoreInDb()) {
    res.status(404).json({ error: "missing_file" });
    return null;
  }

  try {
    // Avoid selecting the blob unless we actually need to stream it.
    const lenRows = await prisma.$queryRaw<Array<{ len: number | null }>>`
      SELECT octet_length("content")::int AS len
      FROM "UploadedFile"
      WHERE id = ${id} AND "tenantId" = ${tenantId}
      LIMIT 1
    `;
    const len = Number(lenRows?.[0]?.len ?? 0);
    if (!len || len <= 0) {
      res.status(404).json({ error: "missing_file" });
      return null;
    }
    if (len > uploadsDbMaxBytes()) {
      console.warn("[/files/:id] DB content exceeds max; refusing to stream", { id, tenantId, len });
      res.status(413).json({ error: "file_too_large" });
      return null;
    }

    if (mode === "HEAD") {
      return { source: "db", file: file as any, length: len };
    }

    const row = await prisma.uploadedFile.findFirst({
      where: { id, tenantId },
      select: { content: true },
    });
    const content = (row as any)?.content as Buffer | null | undefined;
    if (!content || !Buffer.isBuffer(content) || content.length === 0) {
      res.status(404).json({ error: "missing_file" });
      return null;
    }
    return { source: "db", file: file as any, length: content.length, content };
  } catch (err: any) {
    console.error("[/files/:id] DB fallback failed", err?.message || err);
    res.status(500).json({ error: "internal_error" });
    return null;
  }
}

async function sendFile(req: any, res: any, mode: "GET" | "HEAD") {
  try {
    const resolved = await resolveFileRequest(req, res, mode);
    if (!resolved) return;

    const file = resolved.file;
    const size = resolved.source === "disk" ? resolved.stat.size : resolved.length;
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${file.name}"`);
    res.setHeader("Content-Length", String(size));
    res.setHeader("Cache-Control", "private, max-age=0, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    if (mode === "HEAD") {
      res.status(200).end();
      return;
    }

    if (resolved.source === "db") {
      // When falling back to DB we already have the content as a Buffer.
      res.status(200).end(resolved.content);
      return;
    }

    const stream = fs.createReadStream(resolved.abs);
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

/**
 * DELETE /files/:id
 * Deletes an uploaded file for the authenticated tenant.
 * This removes the DB record and best-effort removes the underlying file on disk.
 */
router.delete("/:id", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "missing_id" });

    const file = await prisma.uploadedFile.findFirst({
      where: { id, tenantId },
      select: { id: true, path: true },
    });

    if (!file) return res.status(404).json({ error: "not_found" });

    const abs = path.isAbsolute(file.path) ? file.path : path.join(process.cwd(), file.path);
    let fileDeleted = false;
    try {
      await fs.promises.unlink(abs);
      fileDeleted = true;
    } catch (err: any) {
      // Best-effort: allow DB cleanup even if file missing or locked.
      if (err?.code !== "ENOENT") {
        console.warn("[/files/:id] unlink failed:", err?.message || err);
      }
    }

    await prisma.uploadedFile.delete({ where: { id } });

    return res.json({ ok: true, fileDeleted });
  } catch (e: any) {
    console.error("[/files/:id] delete failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
