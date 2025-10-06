import { Router } from "express";
import { prisma } from "../prisma";
import OpenAI from "openai";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
  };
}

/**
 * POST /mail/ingest
 * Body: { provider, messageId, from, subject, body }
 * Idempotent per (tenantId, provider, messageId)
 */
router.post("/ingest", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const {
    provider = "local",
    messageId,
    from,
    subject = "",
    body = "",
  } = req.body || {};

  if (!messageId) return res.status(400).json({ error: "messageId required" });
  if (!from || !subject || !body) {
    return res.status(400).json({ error: "from, subject and body are required" });
  }

  try {
    // Idempotency: use the unique key (tenantId, provider, messageId)
    const existing = await prisma.emailIngest.findUnique({
      where: { tenantId_provider_messageId: { tenantId, provider, messageId } },
    });
    if (existing?.leadId) {
      // already processed and lead created
      return res.json({ ok: true, alreadyIngested: true, leadId: existing.leadId });
    }
    if (existing) {
      // recorded but not processed into a lead (very unlikely), treat as done
      return res.json({ ok: true, alreadyIngested: true });
    }

    // Extract structured fields via OpenAI (fail open with fallback)
    let extracted: {
      contactName?: string;
      email?: string;
      phone?: string;
      projectType?: string;
      summary?: string;
    } = {};

    try {
      const prompt = `
Extract a JSON object from the email text with:
- contactName: string
- email: string
- phone: string
- projectType: string
- summary: short summary (<= 200 chars)

Headers:
From: ${from}
Subject: ${subject}

Body:
${body}

Return ONLY JSON.
`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const text = completion.choices[0]?.message?.content?.trim() || "{}";
      try {
        extracted = JSON.parse(text);
      } catch {
        extracted = {
          contactName: from.split("@")[0],
          email: from,
          projectType: subject,
          summary: body.slice(0, 200),
        };
      }
    } catch {
      extracted = {
        contactName: from.split("@")[0],
        email: from,
        projectType: subject,
        summary: body.slice(0, 200),
      };
    }

    const snippet = body.replace(/\s+/g, " ").slice(0, 200);

    // Create EmailIngest + Lead in a transaction; the unique will keep it idempotent
    const out = await prisma.$transaction(async (tx) => {
      const ingest = await tx.emailIngest.create({
        data: {
          tenantId,
          provider,
          messageId,
          fromEmail: from,
          subject,
          snippet,
          processedAt: new Date(),
        },
      });

      const lead = await tx.lead.create({
        data: {
          tenantId,
          createdById: userId,
          contactName: extracted.contactName || from,
          email: extracted.email || from,
          status: "NEW",
          nextAction: "Review enquiry",
          custom: {
            provider,
            messageId,
            from,
            subject,
            phone: extracted.phone,
            projectType: extracted.projectType,
            summary: extracted.summary ?? snippet,
          },
        },
      });

      // back-reference (optional)
      await tx.emailIngest.update({
        where: { id: ingest.id },
        data: { leadId: lead.id },
      });

      return lead;
    });

    return res.json({ ok: true, lead: out });
  } catch (err: any) {
    // If we hit the unique constraint on (tenantId, provider, messageId)
    if ((err?.code || "").toString() === "P2002") {
      return res.json({ ok: true, alreadyIngested: true });
    }
    console.error("[mail/ingest] failed:", err);
    return res.status(500).send(err?.message || "ingest failed");
  }
});

export default router;