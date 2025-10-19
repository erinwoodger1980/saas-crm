// api/src/routes/ml-internal.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { getAccessTokenForTenant, fetchMessage } from "../services/gmail";
import { prisma } from "../db"; // <- ensure this exports a singleton PrismaClient

type GmailMessageRef = { id: string; threadId?: string };
type GmailListResponse = { messages?: GmailMessageRef[]; nextPageToken?: string };

const router = Router();

/**
 * POST /internal/ml/ingest-gmail
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

    const baseApi =
      process.env.APP_URL?.replace(/\/$/, "") ||
      process.env.API_URL?.replace(/\/$/, "") ||
      process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "") ||
      "https://api.joineryai.app";

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
            `${baseApi}/gmail/message/` +
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

/**
 * POST /internal/ml/save-samples
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

      // NOTE: For compound unique constraints Prisma expects the
      // concatenated field name: tenantId_messageId_attachmentId
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

/**
 * GET /internal/ml/samples
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

export default router;