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
      // Fall through to classification if we want to upgrade fields; but keep idempotent behavior
      // For safety, keep as already ingested
      return res.json({ ok: true, alreadyIngested: true });
    }

    // 1) Create a lightweight EmailIngest row first (so repeated calls are idempotent)
    const snippet = body.replace(/\s+/g, " ").slice(0, 200);
    // Avoid race-condition unique errors by using createMany with skipDuplicates.
    const createRes = await prisma.emailIngest.createMany({
      data: [
        {
          tenantId,
          provider,
          messageId,
          fromEmail: from,
          subject,
          snippet,
        },
      ],
      skipDuplicates: true,
    });

    // 2) Classify as lead vs not lead using OpenAI with explicit subject + full body
    let ai: any = null;
    try {
      const systemPrompt =
        "You triage inbound emails for a bespoke joinery/carpentry business. Decide if the email is a NEW SALES ENQUIRY from a potential customer. When unsure, prefer NOT a lead.";
      const userContent = `Subject: ${subject || "(no subject)"}\nFrom: ${from}\nBody:\n${body.slice(0, 6000)}`;
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lead_classification",
            schema: {
              type: "object",
              additionalProperties: true,
              properties: {
                isLead: { type: "boolean" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string" },
                contactName: { type: ["string", "null"] },
                email: { type: ["string", "null"] },
                phone: { type: ["string", "null"] },
                projectType: { type: ["string", "null"] },
                summary: { type: ["string", "null"] },
              },
              required: ["isLead", "reason"],
            },
          },
        },
      });
      const text = resp.choices[0]?.message?.content || "{}";
      ai = JSON.parse(text);
    } catch (e) {
      ai = null;
    }

    const aiIsLead =
      typeof ai?.isLead === "boolean"
        ? ai.isLead
        : typeof ai?.isLead === "string"
        ? ai.isLead.toLowerCase() === "true"
        : null;
    const aiConfidence = typeof ai?.confidence === "number" ? Math.max(0, Math.min(1, ai.confidence)) : null;
    const decidedLead = aiIsLead === true && (aiConfidence ?? 0) >= 0.55; // slightly conservative

    // 3) If NOT a lead → mark processed with prediction and return
    if (!decidedLead) {
      try {
        await prisma.emailIngest.update({
          where: { tenantId_provider_messageId: { tenantId, provider, messageId } },
          data: { processedAt: new Date(), aiPredictedIsLead: aiIsLead ?? false },
        });
      } catch {}

      // Record training example for learning
      try {
        await prisma.leadTrainingExample.upsert({
          where: { tenantId_provider_messageId: { tenantId, provider, messageId } as any },
          update: {
            label: "rejected",
            extracted: { subject, snippet, from, body: body.slice(0, 4000), ai },
          },
          create: {
            tenantId,
            provider,
            messageId,
            label: "rejected",
            extracted: { subject, snippet, from, body: body.slice(0, 4000), ai },
          },
        } as any);
      } catch {}

      return res.json({ ok: true, classified: { isLead: false, confidence: aiConfidence ?? null } });
    }

    // 4) Extract structured fields via OpenAI (fail open with fallback)
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

    // 5) Create EmailIngest + Lead in a transaction; the unique will keep it idempotent
    const out = await prisma.$transaction(async (tx) => {
      // Update ingest with processed + prediction
      const ingest = await tx.emailIngest.update({
        where: { tenantId_provider_messageId: { tenantId, provider, messageId } },
        data: { processedAt: new Date(), aiPredictedIsLead: true },
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
            enquiryDate: new Date().toISOString().split('T')[0],
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

    // Record positive example
    try {
      await prisma.leadTrainingExample.upsert({
        where: { tenantId_provider_messageId: { tenantId, provider, messageId } as any },
        update: {
          label: "accepted",
          extracted: { subject, snippet, from, body: body.slice(0, 4000), ai },
        },
        create: {
          tenantId,
          provider,
          messageId,
          label: "accepted",
          extracted: { subject, snippet, from, body: body.slice(0, 4000), ai },
        },
      } as any);
    } catch {}

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