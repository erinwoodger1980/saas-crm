// api/src/routes/ml-samples.ts
import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../db";

// Fields that actually exist on MLTrainingSample (avoid selecting non-existent columns)
const SAMPLE_SELECT = {
  id: true,
  tenantId: true,
  messageId: true,
  attachmentId: true,
  url: true,
  quotedAt: true,
  sourceType: true,
  quoteId: true,
  fileId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const router = Router();

/**
 * GET /internal/ml/samples
 * Query params:
 *   - limit?: number (default 25, max 100)
 *   - cursor?: string (opaque ID cursor; returns items before this ID by createdAt desc)
 *   - q?: string (search filename/subject/url/messageId/attachmentId)
 *   - after?: ISO date (filter quotedAt >= after)
 *   - before?: ISO date (filter quotedAt <= before)
 */
router.get("/samples", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const limit = Math.max(1, Math.min(Number(req.query.limit ?? 25), 100));
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

    const after = typeof req.query.after === "string" ? new Date(req.query.after) : undefined;
    const before = typeof req.query.before === "string" ? new Date(req.query.before) : undefined;

    const where: any = { tenantId };
    // Date filters on quotedAt (if present)
    if (after || before) {
      where.quotedAt = {};
      if (after && !isNaN(after.getTime())) where.quotedAt.gte = after;
      if (before && !isNaN(before.getTime())) where.quotedAt.lte = before;
    }

    // Simple broad search (tune to your schema)
    if (q) {
      where.OR = [
        { filename: { contains: q, mode: "insensitive" } },
        { url: { contains: q, mode: "insensitive" } },
        { messageId: { contains: q, mode: "insensitive" } },
        { attachmentId: { contains: q, mode: "insensitive" } },
      ];
    }

    // Cursor pagination by createdAt desc / id desc
    const take = limit + 1;
    const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

    const items = await prisma.mLTrainingSample.findMany({
      where,
      select: SAMPLE_SELECT,
      orderBy,
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items[items.length - 1];
      nextCursor = nextItem.id;
      items.pop();
    }

    return res.json({ ok: true, count: items.length, nextCursor, items });
  } catch (e: any) {
    console.error("[ml-samples] list failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// Bulk status update: POST /internal/ml/samples/bulk-status { ids: string[]; status: 'PENDING'|'APPROVED'|'REJECTED' }
router.post('/samples/bulk-status', async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((v: any) => typeof v === 'string') : [];
    const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
    if (!ids.length) return res.status(400).json({ error: 'no_ids' });
    if (!['PENDING','APPROVED','REJECTED'].includes(status)) return res.status(400).json({ error: 'invalid_status' });
    const updated = await prisma.mLTrainingSample.updateMany({
      where: { id: { in: ids }, tenantId },
      data: { status },
    });
    return res.json({ ok: true, updated: updated.count, status });
  } catch (e: any) {
    console.error('[ml-samples] bulk-status failed:', e?.message || e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Preview (re-parse) a sample's PDF via ML service without altering status
// GET /internal/ml/samples/:id/preview
router.get('/samples/:id/preview', async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
    const id = req.params.id;
    const sample = await prisma.mLTrainingSample.findUnique({ where: { id }, select: { id: true, tenantId: true, fileId: true, messageId: true } });
    if (!sample) return res.status(404).json({ error: 'not_found' });
    if (sample.tenantId !== tenantId) return res.status(403).json({ error: 'forbidden' });
    if (!sample.fileId) return res.status(400).json({ error: 'no_file' });
    const file = await prisma.uploadedFile.findUnique({ where: { id: sample.fileId }, select: { path: true, name: true } });
    if (!file) return res.status(404).json({ error: 'file_missing' });
    const absPath = path.isAbsolute(file.path) ? file.path : path.join(process.cwd(), file.path);
    const buffer = await fs.promises.readFile(absPath);
    const base64 = buffer.toString('base64');
    const ML_ENDPOINT = (process.env.ML_URL || process.env.ML_API_URL || '').replace(/\/$/, '');
    let mlResp: any = null;
    let mlError: string | null = null;
    // Local parse stats
    let localChars: number | null = null;
    let localTotal: number | null = null;
    try {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(buffer).catch(() => null);
      if (parsed && typeof parsed.text === 'string') {
        const text = parsed.text;
        localChars = text.length;
        const lines = text.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
        let candidate: number | null = null;
        for (const line of lines) {
          if (/total/i.test(line)) {
            const nums = line.match(/\b\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b/g);
            if (nums) {
              for (const n of nums) {
                const value = parseFloat(n.replace(/[,\s]/g,''));
                if (!isNaN(value)) {
                  if (candidate == null || value > candidate) candidate = value;
                }
              }
            }
          }
        }
        localTotal = candidate;
      }
    } catch {}
    if (ML_ENDPOINT) {
      try {
        const resp = await fetch(`${ML_ENDPOINT}/upload-quote-training`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64, quoteType: 'client', tenantId }),
        });
        const txt = await resp.text();
        try { mlResp = txt ? JSON.parse(txt) : {}; } catch { mlResp = { raw: txt }; }
        if (!resp.ok) mlError = mlResp?.error || `ml_status_${resp.status}`;
      } catch (e: any) {
        mlError = e?.message || 'ml_forward_failed';
      }
    }
    return res.json({ ok: true, sampleId: sample.id, messageId: sample.messageId, mlError, ml: mlResp, local: { chars: localChars, total: localTotal } });
  } catch (e: any) {
    console.error('[ml-samples] preview failed:', e?.message || e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * PATCH /internal/ml/samples/:id
 * Body can include a subset of { notes?: string, label?: string, status?: 'PENDING'|'APPROVED'|'REJECTED' }
 */
router.patch("/samples/:id", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = req.params.id;
    const { notes, label, status } = req.body ?? {};

    const data: any = {};
    if (typeof notes === "string") data.notes = notes;
    if (typeof label === "string") data.label = label;
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      data.status = status;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "no_updates" });
    }

    const updated = await prisma.mLTrainingSample.update({
      where: { id },
      data,
      select: SAMPLE_SELECT,
    });

    // enforce tenant ownership
    if (updated.tenantId !== tenantId) {
      return res.status(403).json({ error: "forbidden" });
    }

    return res.json({ ok: true, sample: updated });
  } catch (e: any) {
    console.error("[ml-samples] patch failed:", e?.message || e);
    if (e?.code === "P2025") return res.status(404).json({ error: "not_found" });
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /internal/ml/samples/:id/status
 * Body: { status: 'PENDING' | 'APPROVED' | 'REJECTED' }
 * Quick endpoint for approval workflow
 */
router.patch("/samples/:id/status", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = req.params.id;
    const { status } = req.body ?? {};

    if (!status || !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    // Verify tenant ownership first
    const existing = await prisma.mLTrainingSample.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });

    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.tenantId !== tenantId) return res.status(403).json({ error: "forbidden" });

    const updated = await prisma.mLTrainingSample.update({
      where: { id },
      data: { status },
      select: SAMPLE_SELECT,
    });

    return res.json({ ok: true, sample: updated });
  } catch (e: any) {
    console.error("[ml-samples] status update failed:", e?.message || e);
    if (e?.code === "P2025") return res.status(404).json({ error: "not_found" });
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * DELETE /internal/ml/samples/:id
 */
router.delete("/samples/:id", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // fetch first to verify tenant
    const existing = await prisma.mLTrainingSample.findUnique({
      where: { id: req.params.id },
      select: { id: true, tenantId: true },
    });
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.tenantId !== tenantId) return res.status(403).json({ error: "forbidden" });

    await prisma.mLTrainingSample.delete({ where: { id: existing.id } });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[ml-samples] delete failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;