// api/src/routes/ml-internal.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { getAccessTokenForTenant, fetchMessage } from "../services/gmail";
type GmailMessageRef = { id: string; threadId?: string };
type GmailListResponse = { messages?: GmailMessageRef[]; nextPageToken?: string };

const router = Router();

/**
 * POST /internal/ml/ingest-gmail
 * Body: { limit?: number }
 *
 * Finds the most recent Sent emails that look like quotes (PDF attachments),
 * and returns **signed URLs** for each attachment so the ML server can fetch
 * them through your API (no direct Gmail creds needed on the ML side).
 *
 * Response:
 * {
 *   ok: true,
 *   count: number,
 *   items: [
 *     {
 *       messageId, threadId, subject, sentAt,
 *       attachmentId, filename, url // (signed)
 *     }, ...
 *   ]
 * }
 */
router.post("/ingest-gmail", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    // 1) sanitize limit (1..500)
    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 500), 500));

    // 2) Gmail access token for this tenant
    const accessToken = await getAccessTokenForTenant(tenantId);

    // 3) Gmail search (Sent, has PDF attachments) — we’ll paginate until we reach `limit`
    const q = 'in:sent filename:pdf has:attachment';
    const maxPage = 100; // Gmail `maxResults` cap per call
    let nextPageToken: string | undefined = undefined;

    type Item = {
      messageId: string;
      threadId: string;
      subject: string | null;
      sentAt: string | null;
      attachmentId: string;
      filename: string;
      url: string; // signed download via your API
    };
    const out: Item[] = [];

    const baseApi =
      process.env.APP_URL?.replace(/\/$/, "") ||
      process.env.API_URL?.replace(/\/$/, "") ||
      process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "") ||
      "https://api.joineryai.app"; // sensible prod default

    while (out.length < limit) {
  const searchUrl: string =
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
    new URLSearchParams({
      q,
      maxResults: String(Math.min(limit - out.length, maxPage)),
      ...(nextPageToken ? { pageToken: nextPageToken } : {}),
    }).toString();

  const listRes: Response = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const listJson = (await listRes.json()) as GmailListResponse;

      if (!listRes.ok) {
        return res.status(listRes.status).json(listJson);
      }

      const msgs: Array<{ id: string; threadId?: string }> = listJson.messages || [];
      nextPageToken = listJson.nextPageToken;

      // 4) For each message, load full payload to discover attachments & metadata
      for (const m of msgs) {
        if (out.length >= limit) break;

        const msg = await fetchMessage(accessToken, m.id, "full");
        const headers = msg.payload?.headers || [];

        const subject =
          headers.find((h: any) => h.name?.toLowerCase?.() === "subject")?.value || null;
        const date =
          headers.find((h: any) => h.name?.toLowerCase?.() === "date")?.value || null;
        const threadId = msg.threadId || m.threadId || m.id;

        // collect only PDF attachments
        const pdfs: { attachmentId: string; filename: string }[] = [];
        const walk = (part: any) => {
          if (!part) return;
          const isPdf =
            part?.mimeType === "application/pdf" ||
            /\.pdf$/i.test(part?.filename || "");
          if (isPdf && part?.body?.attachmentId) {
            pdfs.push({
              attachmentId: part.body.attachmentId,
              filename: part.filename || "quote.pdf",
            });
          }
          if (Array.isArray(part?.parts)) part.parts.forEach(walk);
        };
        walk(msg.payload);

        // light heuristic: subject hints OR has pdfs
        const looksLikeQuote =
          /quote|estimate|proposal|quotation/i.test(subject || "") || pdfs.length > 0;

        if (!looksLikeQuote) continue;

        // 5) Build signed URLs that allow the ML server to fetch the attachment via your API
        //    We sign with a short-lived JWT that encodes the tenant id (no user context needed).
        const signed = (attachmentId: string) => {
          const token = jwt.sign(
            { tenantId, userId: "system", email: "system@local" },
            env.APP_JWT_SECRET,
            { expiresIn: "15m" }
          );
          const url =
            `${baseApi}/gmail/message/` +
            `${encodeURIComponent(m.id)}` +
            `/attachments/${encodeURIComponent(attachmentId)}` +
            `?jwt=${encodeURIComponent(token)}`;
          return url;
        };

        for (const a of pdfs) {
          if (out.length >= limit) break;
          out.push({
            messageId: m.id,
            threadId,
            subject,
            sentAt: date,
            attachmentId: a.attachmentId,
            filename: a.filename,
            url: signed(a.attachmentId),
          });
        }
      }

      if (!nextPageToken || msgs.length === 0) break; // no more pages
    }

    return res.json({ ok: true, count: out.length, items: out });
  } catch (e: any) {
    console.error("[internal/ml/ingest-gmail] failed:", e?.message || e);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;