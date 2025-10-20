// api/src/routes/ml-internal.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { getAccessTokenForTenant, fetchMessage } from "../services/gmail";
import { prisma } from "../db"; // singleton PrismaClient

type GmailMessageRef = { id: string; threadId?: string };
type GmailListResponse = { messages?: GmailMessageRef[]; nextPageToken?: string };

const router = Router();

// External ML base URL
const ML_URL = (process.env.ML_URL || process.env.NEXT_PUBLIC_ML_URL || "http://localhost:8000")
  .trim()
  .replace(/\/$/, "");

// Our public API base (used for signed-URL building and internal calls)
const API_BASE =
  (process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.API_URL?.replace(/\/$/, "") ||
    process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "") ||
    "https://api.joineryai.app");

// -----------------------------
// POST /internal/ml/ingest-gmail
// -----------------------------
/**
 * Body: { limit?: number }
 *
 * Finds recent Sent emails with PDF attachments and returns **signed URLs**
 * your ML service can fetch via your API (no Gmail creds on the ML side).
 */
router.post("/ingest-gmail", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 500), 500));
    const accessToken = await getAccessTokenForTenant(tenantId);

    const q = "in:sent filename:pdf has:attachment";
    const maxPage = 100;
    let nextPageToken: string | undefined;

    type Item = {
      messageId: string;
      threadId: string;
      subject: string | null;
      sentAt: string | null;
      attachmentId: string;
      url: string;
    };
    const out: Item[] = [];

    while (out.length < limit) {
      const searchUrl =
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
        new URLSearchParams({
          q,
          maxResults: String(Math.min(limit - out.length, maxPage)),
          ...(nextPageToken ? { pageToken: nextPageToken } : {}),
        }).toString();

      const listRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const listJson = (await listRes.json()) as GmailListResponse;
      if (!listRes.ok) return res.status(listRes.status).json(listJson);

      const msgs = listJson.messages || [];
      nextPageToken = listJson.nextPageToken;

      for (const m of msgs) {
        if (out.length >= limit) break;

        const msg = await fetchMessage(accessToken, m.id, "full");
        const headers = msg.payload?.headers || [];

        const subject =
          headers.find((h: any) => h.name?.toLowerCase?.() === "subject")?.value || null;
        const date =
          headers.find((h: any) => h.name?.toLowerCase?.() === "date")?.value || null;
        const threadId = msg.threadId || m.threadId || m.id;

        const pdfs: { attachmentId: string }[] = [];
        const walk = (part: any) => {
          if (!part) return;
          const isPdf =
            part?.mimeType === "application/pdf" ||
            /\.pdf$/i.test(part?.filename || "");
          if (isPdf && part?.body?.attachmentId) {
            pdfs.push({ attachmentId: part.body.attachmentId });
          }
          if (Array.isArray(part?.parts)) part.parts.forEach(walk);
        };
        walk(msg.payload);

        const looksLikeQuote =
          /quote|estimate|proposal|quotation/i.test(subject || "") || pdfs.length > 0;
        if (!looksLikeQuote) continue;

        const signed = (attachmentId: string) => {
          const token = jwt.sign(
            { tenantId, userId: "system", email: "system@local" },
            env.APP_JWT_SECRET,
            { expiresIn: "15m" }
          );
          return (
            `${API_BASE}/gmail/message/` +
            `${encodeURIComponent(m.id)}/attachments/${encodeURIComponent(attachmentId)}` +
            `?jwt=${encodeURIComponent(token)}`
          );
        };

        for (const a of pdfs) {
          if (out.length >= limit) break;
          out.push({
            messageId: m.id,
            threadId,
            subject,
            sentAt: date,
            attachmentId: a.attachmentId,
            url: signed(a.attachmentId),
          });
        }
      }

      if (!nextPageToken || msgs.length === 0) break;
    }

    return res.json({ ok: true, count: out.length, items: out });
  } catch (e: any) {
    console.error("[internal/ml/ingest-gmail] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// -----------------------------
// POST /internal/ml/save-samples
// -----------------------------
/**
 * Body: { items: Array<{ tenantId, messageId, attachmentId, url, quotedAt? }> }
 * Writes rows to MLTrainingSample via upsert on (tenantId, messageId, attachmentId).
 */
router.post("/save-samples", async (req: any, res) => {
  try {
    const tenantIdFromAuth = req.auth?.tenantId as string | undefined;
    if (!tenantIdFromAuth) return res.status(401).json({ error: "unauthorized" });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.json({ ok: true, wrote: 0 });

    let wrote = 0;

    for (const raw of items) {
      const tenantId = raw.tenantId ?? tenantIdFromAuth;
      const data = {
        tenantId: String(tenantId),
        messageId: String(raw.messageId),
        attachmentId: String(raw.attachmentId),
        url: String(raw.url),
        quotedAt: raw.quotedAt ? new Date(raw.quotedAt) : null,
      };

      // Compound unique on (tenantId, messageId, attachmentId)
      await prisma.mLTrainingSample.upsert({
        where: {
          tenantId_messageId_attachmentId: {
            tenantId: data.tenantId,
            messageId: data.messageId,
            attachmentId: data.attachmentId,
          },
        },
        update: {
          url: data.url,
          quotedAt: data.quotedAt ?? undefined,
        },
        create: {
          tenantId: data.tenantId,
          messageId: data.messageId,
          attachmentId: data.attachmentId,
          url: data.url,
          quotedAt: data.quotedAt,
        },
      });

      wrote += 1;
    }

    return res.json({ ok: true, wrote });
  } catch (e: any) {
    console.error("[internal/ml/save-samples] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// -----------------------------
// GET /internal/ml/samples
// -----------------------------
/**
 * Returns recent MLTrainingSample rows for the current tenant (verify writes).
 */
router.get("/samples", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const rows = await prisma.mLTrainingSample.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        tenantId: true,
        messageId: true,
        attachmentId: true,
        url: true,
        quotedAt: true,
        createdAt: true,
      },
    });

    res.json({ ok: true, count: rows.length, items: rows });
  } catch (e: any) {
    console.error("[internal/ml/samples] failed:", e?.message || e);
    res.status(500).json({ error: "internal_error" });
  }
});

// -----------------------------
// POST /internal/ml/collect-train-save
// -----------------------------
/**
 * Body: { limit?: number }
 *
 * 1) Calls our own /internal/ml/ingest-gmail to collect signed PDF URLs
 * 2) Upserts them into MLTrainingSample
 * 3) Sends those items to the ML server /train
 */
router.post("/collect-train-save", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 50), 500));

    // 1) Collect signed attachment URLs via our own endpoint
    const ingestResp = await fetch(`${API_BASE}/internal/ml/ingest-gmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: JSON.stringify({ limit }),
    });

    const ingestText = await ingestResp.text();
    let ingestJson: any = {};
    try {
      ingestJson = ingestText ? JSON.parse(ingestText) : {};
    } catch {
      ingestJson = { raw: ingestText };
    }
    if (!ingestResp.ok) {
      return res.status(ingestResp.status).json({ error: "ingest_failed", detail: ingestJson });
    }

    type Item = {
      messageId: string;
      attachmentId: string;
      url: string;
      filename?: string | null;
      quotedAt?: string | null;
    };

    const items: Item[] = Array.isArray(ingestJson.items)
      ? ingestJson.items
          .filter((it: any) => it?.messageId && it?.attachmentId && it?.url)
          .map((it: any) => ({
            messageId: String(it.messageId),
            attachmentId: String(it.attachmentId),
            url: String(it.url),
            filename: it.filename ?? null,
            quotedAt: it.sentAt ?? null, // carry Date header if present
          }))
      : [];

    // 2) Save to DB (upsert on tenantId+messageId+attachmentId)
    let saved = 0;
    for (const data of items) {
      await prisma.mLTrainingSample.upsert({
        where: {
          tenantId_messageId_attachmentId: {
            tenantId,
            messageId: data.messageId,
            attachmentId: data.attachmentId,
          },
        },
        create: {
          tenantId,
          messageId: data.messageId,
          attachmentId: data.attachmentId,
          url: data.url,
          quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
        },
        update: {
          url: data.url,
          quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
        },
      });
      saved += 1;
    }

    // 3) Trigger ML /train
    const trainResp = await fetch(`${ML_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        items: items.map((it) => ({
          messageId: it.messageId,
          attachmentId: it.attachmentId,
          url: it.url,
          filename: it.filename ?? null,
          quotedAt: it.quotedAt ?? null,
        })),
      }),
    });

    const trainText = await trainResp.text();
    let trainJson: any = {};
    try {
      trainJson = trainText ? JSON.parse(trainText) : {};
    } catch {
      trainJson = { raw: trainText };
    }

    if (!trainResp.ok) {
      return res
        .status(trainResp.status)
        .json({ error: "ml_train_failed", detail: trainJson, saved });
    }

    return res.json({
      ok: true,
      tenantId,
      requested: limit,
      collected: items.length,
      saved,
      ml: trainJson,
    });
  } catch (e: any) {
    console.error("[internal/ml/collect-train-save] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;