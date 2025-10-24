import { Router } from "express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { env } from "../env";

const router = Router();

/**
 * GET /files/:id?jwt=...
 * Streams an uploaded file by id when provided a valid signed JWT.
 * The token payload must include { t: tenantId } and optionally { q: quoteId }.
 */
router.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const token = String((req.query?.jwt as string) || "");
    if (!token) return res.status(401).json({ error: "missing_jwt" });

    let decoded: any;
    try { decoded = jwt.verify(token, env.APP_JWT_SECRET); } catch {
      return res.status(401).json({ error: "invalid_jwt" });
    }
    const tenantId = typeof decoded?.t === "string" ? decoded.t : null;
    const quoteIdFromToken = typeof decoded?.q === "string" ? decoded.q : null;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const f = await prisma.uploadedFile.findFirst({ where: { id, tenantId }, select: { id: true, path: true, name: true, mimeType: true, quoteId: true } });
    if (!f) return res.status(404).json({ error: "not_found" });
    if (quoteIdFromToken && f.quoteId && f.quoteId !== quoteIdFromToken) {
      return res.status(403).json({ error: "forbidden" });
    }

    const abs = path.isAbsolute(f.path) ? f.path : path.join(process.cwd(), f.path);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: "missing_file" });

    res.setHeader("Content-Type", f.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${f.name}"`);
    fs.createReadStream(abs).pipe(res);
  } catch (e: any) {
    console.error("[/files/:id] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
