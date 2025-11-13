// api/src/routes/ml-internal.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { getAccessTokenForTenant, fetchMessage } from "../services/gmail";
import {
  getAccessTokenForTenant as getMsAccessToken,
  listSentWithAttachments as msListSentWithAttachments,
  listAttachments as msListAttachments,
} from "../services/ms365";
import { prisma } from "../db"; // singleton PrismaClient
import { recordTrainingOutcome } from "../services/training";

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

const SAMPLE_LOOKBACK_DAYS = Math.max(
  1,
  Number(process.env.ML_TRAIN_SAMPLE_LOOKBACK_DAYS || process.env.ML_TRAIN_LOOKBACK_DAYS || 14),
);

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithBackoff(
  url: string,
  init: Parameters<typeof fetch>[1],
  label: string,
  maxAttempts = 5
) {
  let attempt = 0;
  let delayMs = 500;
  while (attempt < maxAttempts) {
    try {
      const res = await fetch(url, init);
      if (res.ok || !RETRYABLE_STATUSES.has(res.status)) {
        return res;
      }
      if (attempt === maxAttempts - 1) {
        return res;
      }
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 16000);
      attempt += 1;
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 16000);
      attempt += 1;
    }
  }
  throw new Error(`[${label}] fetchWithBackoff exhausted attempts`);
}

async function withBackoff<T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> {
  let attempt = 0;
  let delayMs = 500;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 16000);
      attempt += 1;
    }
  }
  throw new Error(`[${label}] withBackoff exhausted attempts`);
}

const CHECKPOINT_SOURCES = {
  gmail: "gmail",
  ms365: "ms365",
} as const;

let collectorCheckpointEnsured = false;

async function ensureCollectorCheckpointTable() {
  if (collectorCheckpointEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CollectorCheckpoint" (
      "tenantId" text NOT NULL,
      "source" text NOT NULL,
      "pageToken" text,
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT collectorcheckpoint_pkey PRIMARY KEY ("tenantId", "source")
    );
  `);
  collectorCheckpointEnsured = true;
}

async function getCollectorCheckpoint(tenantId: string, source: string) {
  await ensureCollectorCheckpointTable();
  const rows = await prisma.$queryRaw<Array<{ pageToken: string | null }>>`
    SELECT "pageToken" FROM "CollectorCheckpoint"
    WHERE "tenantId" = ${tenantId} AND "source" = ${source}
    LIMIT 1
  `;
  return rows[0]?.pageToken ?? null;
}

async function setCollectorCheckpoint(tenantId: string, source: string, pageToken: string | null) {
  await ensureCollectorCheckpointTable();
  await prisma.$executeRaw`
    INSERT INTO "CollectorCheckpoint" ("tenantId", "source", "pageToken", "updatedAt")
    VALUES (${tenantId}, ${source}, ${pageToken}, now())
    ON CONFLICT ("tenantId", "source") DO UPDATE
    SET "pageToken" = EXCLUDED."pageToken", "updatedAt" = now()
  `;
}

function summariseTrainingPayload(raw: any) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const meta = obj.meta && typeof obj.meta === "object" ? obj.meta : {};
  const metrics =
    (obj.metrics && typeof obj.metrics === "object"
      ? obj.metrics
      : meta.metrics && typeof meta.metrics === "object"
      ? meta.metrics
      : {}) || {};
  const datasetHash =
    obj.datasetHash ||
    obj.dataset_hash ||
    meta.datasetHash ||
    meta.dataset_hash ||
    "unknown";
  const model = obj.model || obj.modelName || meta.model || "lead_classifier";
  const modelLabel =
    obj.modelLabel ||
    obj.model_label ||
    obj.version ||
    meta.modelLabel ||
    meta.model_label ||
    meta.label ||
    undefined;
  let versionId: any =
    obj.versionId ||
    obj.modelVersionId ||
    obj.model_version_id ||
    meta.versionId ||
    meta.modelVersionId ||
    meta.model_version_id ||
    undefined;
  if (!versionId && obj.modelVersion && typeof obj.modelVersion === "object") {
    versionId = (obj.modelVersion as any).id || (obj.modelVersion as any).versionId || undefined;
  }
  const datasetSize =
    typeof obj.datasetSize === "number"
      ? obj.datasetSize
      : typeof metrics.dataset_size === "number"
      ? metrics.dataset_size
      : typeof metrics.samples === "number"
      ? metrics.samples
      : undefined;

  return {
    model: String(model || "lead_classifier"),
    datasetHash: String(datasetHash || "unknown"),
    modelLabel: modelLabel ? String(modelLabel) : undefined,
    versionId: versionId ? String(versionId) : undefined,
    metrics,
    datasetSize: typeof datasetSize === "number" ? datasetSize : undefined,
  } as const;
}

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

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 100), 500));
  const accessToken = await getAccessTokenForTenant(tenantId);

    const requestedPageToken =
      typeof req.body?.pageToken === "string" ? req.body.pageToken.trim() : "";
    const explicitPageToken = requestedPageToken || undefined;
    const startPageToken = explicitPageToken ?? (await getCollectorCheckpoint(tenantId, CHECKPOINT_SOURCES.gmail));

  const q = "in:sent filename:pdf has:attachment";
    const maxPage = 100;
    let pageToken: string | null = startPageToken || null;
    let nextPageToken: string | null = null;

    type Item = {
      messageId: string;
      threadId: string;
      subject: string | null;
      sentAt: string | null;
      attachmentId: string;
      url: string;
    };
    const out: Item[] = [];
    const seen = new Set<string>();

    while (out.length < limit) {
      const searchUrl =
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
        new URLSearchParams({
          q,
          maxResults: String(Math.min(limit - out.length, maxPage)),
          ...(pageToken ? { pageToken } : {}),
        }).toString();

      const listRes = await fetchWithBackoff(
        searchUrl,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        "gmail:list"
      );

      const listJson = (await listRes.json()) as GmailListResponse;
      if (!listRes.ok) return res.status(listRes.status).json(listJson);

      const msgs = listJson.messages || [];
      nextPageToken = listJson.nextPageToken ?? null;

      for (const m of msgs) {
        if (out.length >= limit) break;

        const msg = await withBackoff(() => fetchMessage(accessToken, m.id, "full"), "gmail:message");
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
          const key = `tenant::${m.id}::${a.attachmentId}`;
          if (seen.has(key)) continue;
          seen.add(key);
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
      if (out.length >= limit) break;
      pageToken = nextPageToken;
    }

    try {
      await setCollectorCheckpoint(tenantId, CHECKPOINT_SOURCES.gmail, nextPageToken);
    } catch (err) {
      console.error("[internal/ml/ingest-gmail] checkpoint save failed:", (err as any)?.message || err);
    }

    // Also collect from ALL admin user Gmail connections (user-level)
    try {
      const { getAdminGmailConnections } = await import("../services/user-email");
      const conns = await getAdminGmailConnections(tenantId);
      // Iterate each connection and pull a single page of results each (no checkpoint yet)
      for (const c of conns) {
        if (out.length >= limit) break;
        const userSearchUrl =
          "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
          new URLSearchParams({ q, maxResults: String(Math.min(limit - out.length, maxPage)) }).toString();
        const listRes = await fetchWithBackoff(
          userSearchUrl,
          { headers: { Authorization: `Bearer ${c.accessToken}` } },
          "gmail:list:user"
        );
        const listJson = (await listRes.json()) as GmailListResponse;
        if (!listRes.ok) continue;
        const msgs = listJson.messages || [];
        const signedUser = (messageId: string, attachmentId: string) => {
          const token = jwt.sign({ t: tenantId, u: "system" }, env.APP_JWT_SECRET, { expiresIn: "15m" });
          return (
            `${API_BASE}/gmail/u/${encodeURIComponent(c.connectionId)}/message/` +
            `${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}?jwt=${encodeURIComponent(token)}`
          );
        };
        for (const m of msgs) {
          if (out.length >= limit) break;
          const msg = await withBackoff(() => fetchMessage(c.accessToken, m.id, "full"), "gmail:message:user");
          const headers = msg.payload?.headers || [];
          const subject = headers.find((h: any) => h.name?.toLowerCase?.() === "subject")?.value || null;
          const date = headers.find((h: any) => h.name?.toLowerCase?.() === "date")?.value || null;
          const threadId = msg.threadId || m.threadId || m.id;
          const pdfs: { attachmentId: string }[] = [];
          const walk = (part: any) => {
            if (!part) return;
            const isPdf = part?.mimeType === "application/pdf" || /\.pdf$/i.test(part?.filename || "");
            if (isPdf && part?.body?.attachmentId) pdfs.push({ attachmentId: part.body.attachmentId });
            if (Array.isArray(part?.parts)) part.parts.forEach(walk);
          };
          walk(msg.payload);
          const looksLikeQuote = /quote|estimate|proposal|quotation/i.test(subject || "") || pdfs.length > 0;
          if (!looksLikeQuote) continue;
          for (const a of pdfs) {
            if (out.length >= limit) break;
            const key = `user:${c.connectionId}::${m.id}::${a.attachmentId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              messageId: m.id,
              threadId,
              subject,
              sentAt: date,
              attachmentId: a.attachmentId,
              url: signedUser(m.id, a.attachmentId),
            });
          }
        }
      }
    } catch (e) {
      console.warn("[internal/ml/ingest-gmail] user-level aggregation failed:", (e as any)?.message || e);
    }

    return res.json({
      ok: true,
      count: out.length,
      items: out,
      nextPageToken,
      startedFromPageToken: startPageToken ?? null,
    });
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

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 100), 500));
    const pageTokenRaw = typeof req.body?.pageToken === "string" ? req.body.pageToken.trim() : "";
    const pageToken = pageTokenRaw || undefined;

    // 1) Collect signed attachment URLs via our own endpoint
    const ingestResp = await fetch(`${API_BASE}/internal/ml/ingest-gmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: JSON.stringify({ limit, ...(pageToken ? { pageToken } : {}) }),
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

    const nextPageToken = typeof ingestJson.nextPageToken === "string" ? ingestJson.nextPageToken : null;
    const startedFromPageTokenRaw = ingestJson.startedFromPageToken;
    const startedFromPageToken =
      typeof startedFromPageTokenRaw === "string" || startedFromPageTokenRaw === null
        ? startedFromPageTokenRaw
        : null;

    type TrainingItem = {
      sourceType: "supplier_quote" | "client_quote";
      messageId: string | null;
      attachmentId: string | null;
      quoteId: string | null;
      fileId: string | null;
      url: string;
      filename?: string | null;
      quotedAt?: string | null;
    };

    const isPdf = (mime?: string | null, name?: string | null) => {
      if (mime && /pdf/i.test(mime)) return true;
      if (name && /\.pdf$/i.test(name)) return true;
      return false;
    };

    const sampleKey = (item: TrainingItem) => {
      if (item.quoteId) return `quote:${item.quoteId}`;
      const mid = item.messageId ?? "";
      const aid = item.attachmentId ?? item.fileId ?? "";
      return `${mid}::${aid}`;
    };

    const seenSamples = new Set<string>();
    const seenFileIds = new Set<string>();

    const emailSamples: TrainingItem[] = Array.isArray(ingestJson.items)
      ? ingestJson.items
          .filter((it: any) => it?.messageId && it?.attachmentId && it?.url)
          .map((it: any) => ({
            sourceType: "supplier_quote",
            messageId: String(it.messageId),
            attachmentId: String(it.attachmentId),
            quoteId: null,
            fileId: null,
            url: String(it.url),
            filename: it.filename ?? null,
            quotedAt: it.sentAt ?? null,
          }))
      : [];

    const lookback = new Date(Date.now() - SAMPLE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const clientQuoteSamples: TrainingItem[] = [];
    const fileIdMap = new Map<string, { quoteId: string; createdAt: Date }>();

    const recentQuotes = await prisma.quote.findMany({
      where: {
        tenantId,
        updatedAt: { gte: lookback },
      },
      select: { id: true, proposalPdfUrl: true, meta: true, createdAt: true },
    });

    for (const quote of recentQuotes) {
      const meta = (quote.meta as any) || {};
      const proposalFileId = typeof meta?.proposalFileId === "string" ? meta.proposalFileId : null;
      const createdAt = new Date(quote.createdAt as any);
      if (proposalFileId) {
        fileIdMap.set(proposalFileId, { quoteId: quote.id, createdAt });
        continue;
      }

      const proposalUrl = typeof quote.proposalPdfUrl === "string" ? quote.proposalPdfUrl.trim() : "";
      if (proposalUrl) {
        clientQuoteSamples.push({
          sourceType: "client_quote",
          messageId: `quote:${quote.id}`,
          attachmentId: `quote:${quote.id}`,
          quoteId: quote.id,
          fileId: null,
          url: proposalUrl,
          filename: null,
          quotedAt: createdAt.toISOString(),
        });
      }
    }

    if (fileIdMap.size) {
      const fileRows = await prisma.uploadedFile.findMany({
        where: { tenantId, id: { in: Array.from(fileIdMap.keys()) } },
        select: { id: true, name: true, uploadedAt: true, quoteId: true },
      });

      for (const file of fileRows) {
        const mapping = fileIdMap.get(file.id);
        if (!mapping) continue;
        const token = jwt.sign(
          { t: tenantId, q: mapping.quoteId },
          env.APP_JWT_SECRET,
          { expiresIn: "30m" }
        );
        const signedUrl = `${API_BASE}/files/${encodeURIComponent(file.id)}?jwt=${encodeURIComponent(token)}`;
        const uploadedAt = file.uploadedAt ? new Date(file.uploadedAt as any) : mapping.createdAt;
        clientQuoteSamples.push({
          sourceType: "client_quote",
          messageId: `quote:${mapping.quoteId}`,
          attachmentId: file.id,
          quoteId: mapping.quoteId,
          fileId: file.id,
          url: signedUrl,
          filename: file.name ?? null,
          quotedAt: uploadedAt.toISOString(),
        });
        seenFileIds.add(file.id);
      }
    }

    const standaloneSupplierFiles = await prisma.uploadedFile.findMany({
      where: {
        tenantId,
        uploadedAt: { gte: lookback },
        quoteId: { not: null },
        mimeType: { contains: "pdf", mode: "insensitive" },
      },
      select: { id: true, name: true, uploadedAt: true, mimeType: true, quoteId: true },
    });

    for (const file of standaloneSupplierFiles) {
      if (seenFileIds.has(file.id)) continue;
      if (!isPdf(file.mimeType, file.name)) continue;
      const relatedQuoteId = file.quoteId ?? fileIdMap.get(file.id)?.quoteId ?? null;
      const payload: Record<string, string> = { t: tenantId };
      if (relatedQuoteId) payload.q = relatedQuoteId;
      const token = jwt.sign(payload, env.APP_JWT_SECRET, { expiresIn: "30m" });
      const signedUrl = `${API_BASE}/files/${encodeURIComponent(file.id)}?jwt=${encodeURIComponent(token)}`;
      const uploadedAt = file.uploadedAt ? new Date(file.uploadedAt as any) : new Date();
      clientQuoteSamples.push({
        sourceType: relatedQuoteId ? "client_quote" : "supplier_quote",
        messageId: relatedQuoteId ? `quote:${relatedQuoteId}` : `uploaded:${file.id}`,
        attachmentId: file.id,
        quoteId: relatedQuoteId,
        fileId: file.id,
        url: signedUrl,
        filename: file.name ?? null,
        quotedAt: uploadedAt.toISOString(),
      });
      seenFileIds.add(file.id);
    }

    const collected = emailSamples.length;
    const mergedItems: TrainingItem[] = [...emailSamples, ...clientQuoteSamples];
    const trainingItems: TrainingItem[] = [];
    for (const item of mergedItems) {
      const key = sampleKey(item);
      if (seenSamples.has(key)) continue;
      seenSamples.add(key);
      trainingItems.push(item);
    }

    // 2) Save to DB (upsert on tenantId+messageId+attachmentId or tenantId+quoteId)
    let saved = 0;
    for (const data of trainingItems) {
      if (data.quoteId) {
        await prisma.mLTrainingSample.upsert({
          where: { tenantId_quoteId: { tenantId, quoteId: data.quoteId } },
          create: {
            tenantId,
            messageId: data.messageId ?? data.quoteId,
            attachmentId: data.attachmentId ?? data.quoteId,
            url: data.url,
            quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
            sourceType: data.sourceType,
            quoteId: data.quoteId,
            fileId: data.fileId ?? null,
          },
          update: {
            url: data.url,
            quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
            sourceType: data.sourceType,
            fileId: data.fileId ?? null,
          },
        });
      } else if (data.messageId && data.attachmentId) {
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
            sourceType: data.sourceType,
          },
          update: {
            url: data.url,
            quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
            sourceType: data.sourceType,
          },
        });
      }
      saved += 1;
    }

    const datasetCount = trainingItems.length;
    const startedAt = new Date();

    // 3) Trigger ML /train
    const trainResp = await fetch(`${ML_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        items: trainingItems.map((it) => ({
          messageId: it.messageId,
          attachmentId: it.attachmentId,
          quoteId: it.quoteId,
          url: it.url,
          filename: it.filename ?? null,
          quotedAt: it.quotedAt ?? null,
          sourceType: it.sourceType,
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

    const finishedAt = new Date();
    const summary = summariseTrainingPayload(trainJson);
    const modelName =
      summary.model && summary.model !== "lead_classifier" ? summary.model : "supplier_estimator";
    const recorded = await recordTrainingOutcome({
      tenantId,
      model: modelName,
      status: trainResp.ok ? "succeeded" : "failed",
      datasetHash: summary.datasetHash,
      metrics: summary.metrics,
      modelLabel: summary.modelLabel,
      datasetSize: summary.datasetSize,
      datasetCount,
      versionId: summary.versionId,
      startedAt,
      finishedAt,
    });

    if (!trainResp.ok) {
      return res
        .status(trainResp.status)
        .json({
          error: "ml_train_failed",
          detail: trainJson,
          saved,
          datasetCount,
          modelVersionId: recorded?.modelVersionId ?? null,
          awaitingApproval: recorded?.awaitingApproval ?? false,
          nextPageToken,
          startedFromPageToken,
        });
    }

    return res.json({
      ok: true,
      tenantId,
      requested: limit,
      collected,
      saved,
      datasetCount,
      ml: trainJson,
      metrics: summary.metrics,
      modelVersionId: recorded?.modelVersionId ?? null,
      promoted: recorded?.promoted ?? false,
      awaitingApproval: recorded?.awaitingApproval ?? false,
      nextPageToken,
      startedFromPageToken,
    });
  } catch (e: any) {
    console.error("[internal/ml/collect-train-save] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
// -----------------------------
// POST /internal/ml/save-train-from-uploaded
// -----------------------------
/**
 * Body: { uploadedFileIds: string[] }
 *
 * For a set of already-uploaded supplier quote files, this will:
 * 1) Build signed file URLs accessible to the ML service via our /files route
 * 2) Upsert rows into MLTrainingSample (so we retain provenance/history)
 * 3) Trigger the ML service /train with those items
 */
router.post("/save-train-from-uploaded", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const ids = Array.isArray(req.body?.uploadedFileIds)
      ? (req.body.uploadedFileIds as any[]).map((x) => String(x)).filter(Boolean)
      : [];
    if (!ids.length) return res.status(400).json({ error: "no_files" });

    const files = await prisma.uploadedFile.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true, uploadedAt: true },
    });
    if (!files.length) return res.status(404).json({ error: "not_found" });

    // Build signed URLs via our public files router
    const token = jwt.sign(
      { tenantId, userId: "system", email: "system@local" },
      env.APP_JWT_SECRET,
      { expiresIn: "30m" }
    );

    type Item = {
      messageId: string;
      attachmentId: string;
      url: string;
      filename?: string | null;
      quotedAt?: string | null;
    };

    const items: Item[] = files.map((f) => ({
      messageId: `uploaded:${f.id}`,
      attachmentId: f.id,
      url: `${API_BASE}/files/${encodeURIComponent(f.id)}?jwt=${encodeURIComponent(token)}`,
      filename: f.name || null,
      quotedAt: f.uploadedAt ? new Date(f.uploadedAt as any).toISOString() : null,
    }));

    // Save to DB (upsert on tenantId+messageId+attachmentId)
    let saved = 0;
    for (const it of items) {
      await prisma.mLTrainingSample.upsert({
        where: {
          tenantId_messageId_attachmentId: {
            tenantId,
            messageId: it.messageId,
            attachmentId: it.attachmentId,
          },
        },
        create: {
          tenantId,
          messageId: it.messageId,
          attachmentId: it.attachmentId,
          url: it.url,
          quotedAt: it.quotedAt ? new Date(it.quotedAt) : null,
        },
        update: {
          url: it.url,
          quotedAt: it.quotedAt ? new Date(it.quotedAt) : null,
        },
      });
      saved += 1;
    }

    // Trigger ML /train with these items (acts as a signal; ML service may also read DB)
    const trainResp = await fetch(`${ML_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, items }),
    });

    const trainText = await trainResp.text();
    let trainJson: any = {};
    try { trainJson = trainText ? JSON.parse(trainText) : {}; } catch { trainJson = { raw: trainText }; }
    const summary = summariseTrainingPayload(trainJson);
    const recorded = await recordTrainingOutcome({
      tenantId,
      model: summary.model,
      status: trainResp.ok ? "succeeded" : "failed",
      datasetHash: summary.datasetHash,
      metrics: summary.metrics,
      modelLabel: summary.modelLabel,
      datasetSize: summary.datasetSize,
    });
    if (!trainResp.ok) {
      return res.status(trainResp.status).json({
        error: "ml_train_failed",
        detail: trainJson,
        saved,
        modelVersionId: recorded?.modelVersionId ?? null,
        awaitingApproval: recorded?.awaitingApproval ?? false,
      });
    }

    return res.json({
      ok: true,
      tenantId,
      saved,
      ml: trainJson,
      modelVersionId: recorded?.modelVersionId ?? null,
      promoted: recorded?.promoted ?? false,
      awaitingApproval: recorded?.awaitingApproval ?? false,
    });
  } catch (e: any) {
    console.error("[/internal/ml/save-train-from-uploaded] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});
// -----------------------------
// POST /internal/ml/ingest-ms365
// -----------------------------
/**
 * Body: { limit?: number }
 * Collect Sent items with PDF attachments (Microsoft 365) and return signed URLs.
 */
router.post("/ingest-ms365", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 100), 500));
  const accessToken = await getMsAccessToken(tenantId);

    const requestedPageToken =
      typeof req.body?.pageToken === "string" ? req.body.pageToken.trim() : "";
    const explicitPageToken = requestedPageToken || undefined;
    const startPageToken = explicitPageToken ?? (await getCollectorCheckpoint(tenantId, CHECKPOINT_SOURCES.ms365));

    type Item = {
      messageId: string;
      attachmentId: string;
      url: string;
      subject: string | null;
      quotedAt: string | null;
    };
  const out: Item[] = [];
  const seen = new Set<string>();

    let pageToken: string | null = startPageToken || null;
    let nextLink: string | null = null;
    while (out.length < limit) {
      const page = await withBackoff(
        () => msListSentWithAttachments(accessToken, Math.min(limit - out.length, 50), pageToken || undefined),
        "ms365:list"
      );
      const messages = Array.isArray(page.value) ? page.value : [];
      nextLink = (page["@odata.nextLink"] as string | undefined) ?? null;

      for (const m of messages) {
        if (out.length >= limit) break;
        if (!m?.id) continue;
        if (!m?.hasAttachments) continue;
        const subject = (m?.subject as string | undefined) || null;
        const sentDate = (m?.sentDateTime as string | undefined) || null;

        const atts = await withBackoff(() => msListAttachments(accessToken, m.id), "ms365:attachments");
        const arr = Array.isArray(atts.value) ? atts.value : [];
        for (const a of arr) {
          if (out.length >= limit) break;
          const name = (a?.name as string | undefined) || "";
          const ct = (a?.contentType as string | undefined) || "";
          const isPdf = /pdf$/i.test(name) || /application\/pdf/i.test(ct);
          if (!isPdf || !a?.id) continue;

          const token = jwt.sign(
            { tenantId, userId: "system", email: "system@local" },
            env.APP_JWT_SECRET,
            { expiresIn: "15m" }
          );
          const url = `${API_BASE}/ms365/message/${encodeURIComponent(m.id)}/attachments/${encodeURIComponent(a.id)}?jwt=${encodeURIComponent(token)}`;
          const key = `tenant::${m.id}::${a.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ messageId: m.id, attachmentId: a.id, url, subject, quotedAt: sentDate });
          }
        }
      }

      if (!nextLink || messages.length === 0) break;
      if (out.length >= limit) break;
      pageToken = nextLink;
    }

    try {
      await setCollectorCheckpoint(tenantId, CHECKPOINT_SOURCES.ms365, nextLink);
    } catch (err) {
      console.error("[internal/ml/ingest-ms365] checkpoint save failed:", (err as any)?.message || err);
    }

    // Also collect from ALL admin user MS365 connections (user-level)
    try {
      const { getAdminMs365Connections } = await import("../services/user-email");
      const conns = await getAdminMs365Connections(tenantId);
      for (const c of conns) {
        if (out.length >= limit) break;
        let next: string | undefined = undefined;
        const page = await withBackoff(
          () => msListSentWithAttachments(c.accessToken, Math.min(limit - out.length, 50), next),
          "ms365:list:user"
        );
        const messages = Array.isArray(page.value) ? page.value : [];
        const signedUser = (messageId: string, attachmentId: string) => {
          const token = jwt.sign({ t: tenantId, u: "system" }, env.APP_JWT_SECRET, { expiresIn: "15m" });
          return `${API_BASE}/ms365/u/${encodeURIComponent(c.connectionId)}/message/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}?jwt=${encodeURIComponent(token)}`;
        };
        for (const m of messages) {
          if (out.length >= limit) break;
          if (!m?.id || !m?.hasAttachments) continue;
          const subject = (m?.subject as string | undefined) || null;
          const sentDate = (m?.sentDateTime as string | undefined) || null;
          const atts = await withBackoff(() => msListAttachments(c.accessToken, m.id), "ms365:attachments:user");
          const arr = Array.isArray(atts.value) ? atts.value : [];
          for (const a of arr) {
            if (out.length >= limit) break;
            const name = (a?.name as string | undefined) || "";
            const ct = (a?.contentType as string | undefined) || "";
            const isPdf = /pdf$/i.test(name) || /application\/pdf/i.test(ct);
            if (!isPdf || !a?.id) continue;
            const key = `user:${c.connectionId}::${m.id}::${a.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ messageId: m.id, attachmentId: a.id, url: signedUser(m.id, a.id), subject, quotedAt: sentDate });
          }
        }
      }
    } catch (e) {
      console.warn("[internal/ml/ingest-ms365] user-level aggregation failed:", (e as any)?.message || e);
    }

    return res.json({
      ok: true,
      count: out.length,
      items: out,
      nextPageToken: nextLink,
      startedFromPageToken: startPageToken ?? null,
    });
  } catch (e: any) {
    console.error("[internal/ml/ingest-ms365] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// -----------------------------
// POST /internal/ml/collect-train-save-ms365
// -----------------------------
router.post("/collect-train-save-ms365", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });
    if (!ML_URL) return res.status(503).json({ error: "ml_unavailable" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 100), 500));
    const pageTokenRaw = typeof req.body?.pageToken === "string" ? req.body.pageToken.trim() : "";
    const pageToken = pageTokenRaw || undefined;

    const ingestResp = await fetch(`${API_BASE}/internal/ml/ingest-ms365`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: JSON.stringify({ limit, ...(pageToken ? { pageToken } : {}) }),
    });

    const ingestText = await ingestResp.text();
    let ingestJson: any = {};
    try { ingestJson = ingestText ? JSON.parse(ingestText) : {}; } catch { ingestJson = { raw: ingestText }; }
    if (!ingestResp.ok) return res.status(ingestResp.status).json({ error: "ingest_failed", detail: ingestJson });

    const nextPageToken = typeof ingestJson.nextPageToken === "string" ? ingestJson.nextPageToken : null;
    const startedFromPageTokenRaw = ingestJson.startedFromPageToken;
    const startedFromPageToken =
      typeof startedFromPageTokenRaw === "string" || startedFromPageTokenRaw === null
        ? startedFromPageTokenRaw
        : null;

    type Item = { messageId: string; attachmentId: string; url: string; quotedAt?: string | null };
    const items: Item[] = Array.isArray(ingestJson.items)
      ? ingestJson.items
          .filter((it: any) => it?.messageId && it?.attachmentId && it?.url)
          .map((it: any) => ({
            messageId: String(it.messageId),
            attachmentId: String(it.attachmentId),
            url: String(it.url),
            quotedAt: it.quotedAt ?? null,
          }))
      : [];

    let saved = 0;
    for (const data of items) {
      await prisma.mLTrainingSample.upsert({
        where: { tenantId_messageId_attachmentId: { tenantId, messageId: data.messageId, attachmentId: data.attachmentId } },
        create: {
          tenantId,
          messageId: data.messageId,
          attachmentId: data.attachmentId,
          url: data.url,
          quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
          sourceType: "supplier_quote",
        },
        update: {
          url: data.url,
          quotedAt: data.quotedAt ? new Date(data.quotedAt) : null,
          sourceType: "supplier_quote",
        },
      });
      saved += 1;
    }

    const datasetCount = items.length;
    const startedAt = new Date();

    const trainResp = await fetch(`${ML_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        items: items.map((it) => ({
          messageId: it.messageId,
          attachmentId: it.attachmentId,
          url: it.url,
          quotedAt: it.quotedAt ?? null,
          sourceType: "supplier_quote",
        })),
      }),
    });

    const trainText = await trainResp.text();
    let trainJson: any = {};
    try { trainJson = trainText ? JSON.parse(trainText) : {}; } catch { trainJson = { raw: trainText }; }
    const finishedAt = new Date();
    const summary = summariseTrainingPayload(trainJson);
    const modelName =
      summary.model && summary.model !== "lead_classifier" ? summary.model : "supplier_estimator";
    const recorded = await recordTrainingOutcome({
      tenantId,
      model: modelName,
      status: trainResp.ok ? "succeeded" : "failed",
      datasetHash: summary.datasetHash,
      metrics: summary.metrics,
      modelLabel: summary.modelLabel,
      datasetSize: summary.datasetSize,
      datasetCount,
      versionId: summary.versionId,
      startedAt,
      finishedAt,
    });
    if (!trainResp.ok) {
      return res.status(trainResp.status).json({
        error: "ml_train_failed",
        detail: trainJson,
        saved,
        datasetCount,
        modelVersionId: recorded?.modelVersionId ?? null,
        awaitingApproval: recorded?.awaitingApproval ?? false,
        nextPageToken,
        startedFromPageToken,
      });
    }

    return res.json({
      ok: true,
      tenantId,
      requested: limit,
      collected: items.length,
      saved,
      datasetCount,
      ml: trainJson,
      metrics: summary.metrics,
      modelVersionId: recorded?.modelVersionId ?? null,
      promoted: recorded?.promoted ?? false,
      awaitingApproval: recorded?.awaitingApproval ?? false,
      nextPageToken,
      startedFromPageToken,
    });
  } catch (e: any) {
    console.error("[internal/ml/collect-train-save-ms365] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});