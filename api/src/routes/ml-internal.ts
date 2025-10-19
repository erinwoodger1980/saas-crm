
// api/src/routes/ml-internal.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { getAccessTokenForTenant, fetchMessage } from "../services/gmail";

/* -------- Types -------- */
type GmailMessageRef = { id: string; threadId?: string };
type GmailListResponse = { messages?: GmailMessageRef[]; nextPageToken?: string };

const router = Router();

/**
 * POST /internal/ml/ingest-gmail
 * Body: { limit?: number }
 *
 * Finds recent Sent emails with PDF quote attachments, and returns
 * **signed API URLs** for each attachment so the ML server can fetch them
 * without direct Gmail credentials.
 */
router.post("/ingest-gmail", async (req: any, res) => {
  try {
    const tenantId = req.auth?.tenantId as string | undefined;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const limit = Math.max(1, Math.min(Number(req.body?.limit ?? 500), 500));

    // Access token for this tenant's Gmail connection
    const accessToken = await getAccessTokenForTenant(tenantId);

    // Gmail search query: Sent + has PDF attachments
    const q = "in:sent filename:pdf has:attachment";
    const maxPage = 100; // Gmail cap per page
    let nextPageToken: string | undefined;

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

    // IMPORTANT: always use your **API** origin for signed links
    const baseApi = (
      process.env.APP_API_URL ||
      process.env.API_PUBLIC_ORIGIN ||
      "https://api.joineryai.app"
    ).replace(/\/$/, "");

    while (out.length < limit) {
      const searchUrl: string =
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
        new URLSearchParams({
          q,
          maxResults: String(Math.min(limit - out.length, maxPage)),
          ...(nextPageToken ? { pageToken: nextPageToken } : {}),
        }).toString();

      const listRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const listJson: GmailListResponse = await listRes.json();

      if (!listRes.ok) {
        return res.status(listRes.status).json(listJson);
      }

      const msgs: GmailMessageRef[] = listJson.messages || [];
      nextPageToken = listJson.nextPageToken;

      // For each message, fetch "full" to find attachments + headers
      for (const m of msgs) {
        if (out.length >= limit) break;

        const msg = await fetchMessage(accessToken, m.id, "full");
        const headers = msg.payload?.headers || [];

        const subject =
          headers.find((h: any) => h.name?.toLowerCase?.() === "subject")?.value || null;
        const date =
          headers.find((h: any) => h.name?.toLowerCase?.() === "date")?.value || null;
        const threadId = msg.threadId || m.threadId || m.id;

        // Gather only PDF attachments
        const pdfs: { attachmentId: string; filename: string }[] = [];
        const walk = (part: any) => {
          if (!part) return;
          const isPdf =
            part?.mimeType === "application/pdf" || /\.pdf$/i.test(part?.filename || "");
          if (isPdf && part?.body?.attachmentId) {
            pdfs.push({
              attachmentId: part.body.attachmentId,
              filename: part.filename || "quote.pdf",
            });
          }
          if (Array.isArray(part?.parts)) part.parts.forEach(walk);
        };
        walk(msg.payload);

        // Simple heuristic: subject suggests a quote OR there are PDFs
        const looksLikeQuote =
          /quote|estimate|proposal|quotation/i.test(subject || "") || pdfs.length > 0;
        if (!looksLikeQuote) continue;

        // Build short-lived signed URLs (JWT) to download via your API
        const signedUrl = (attachmentId: string) => {
          const token = jwt.sign(
            { tenantId, userId: "system", email: "system@local" },
            env.APP_JWT_SECRET,
            { expiresIn: "15m" }
          );
          return (
            `${baseApi}/gmail/message/` +
            `${encodeURIComponent(m.id)}` +
            `/attachments/${encodeURIComponent(attachmentId)}` +
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
            filename: a.filename,
            url: signedUrl(a.attachmentId),
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