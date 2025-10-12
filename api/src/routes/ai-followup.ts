import { Router } from "express";
import { prisma } from "../prisma";
import { env } from "../env";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
  };
}

/**
 * POST /ai/followup/suggest
 * Body: { leadId, status, history, context }
 * Returns: { variant, subject, body, delayDays }
 */
router.post("/followup/suggest", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { leadId, status, history = [], context = {} } = req.body || {};
    const lead = await prisma.lead.findUnique({ where: { id: String(leadId) } });
    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    // Simple A/B alternation: look at last variant and flip; fallback to "A"
    const last = await prisma.followUpLog.findFirst({
      where: { tenantId, leadId: lead.id },
      orderBy: { sentAt: "desc" },
    });
    const nextVariant = last?.variant === "A" ? "B" : "A";

    // Defaults if no OpenAI configured
    let suggestion = {
      variant: nextVariant,
      subject: `Quick follow-up on your quote`,
      body:
        `Hi ${lead.contactName || "there"},\n\n` +
        `Just checking whether the quote we sent over answered everything you needed. ` +
        `If anything is unclear, I can tweak the spec or pricing.\n\n` +
        `Would you like me to put a provisional slot in the diary?\n\nThanks,\n${context?.brand || "Sales"}`,
      delayDays: 3,
    };

    // If you have OPENAI_API_KEY, craft a nicer suggestion
    if (env.OPENAI_API_KEY) {
      try {
        const input = `
You are crafting a short, friendly sales follow-up for a quote.
Return JSON { subject, body, delayDays }.
Keep body plain text. UK English. Avoid emojis. Be concise and helpful.

LEAD:
- Name: ${lead.contactName || "-"}
- Email: ${lead.email || "-"}

STATUS: ${status || lead.status}
CONTEXT: ${JSON.stringify(context || {})}
HISTORY: ${JSON.stringify(history || [])}

Variant to output: ${nextVariant}. Keep tone consistent across variants but with different subject/body wording.
`;
        const r = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            input,
            response_format: { type: "json_object" },
          }),
        });
        const j = await r.json();
        const text =
          j?.output_text ||
          j?.choices?.[0]?.message?.content ||
          j?.choices?.[0]?.output_text ||
          "{}";
        const parsed = JSON.parse(String(text));
        suggestion = {
          variant: nextVariant,
          subject: parsed.subject || suggestion.subject,
          body: parsed.body || suggestion.body,
          delayDays:
            typeof parsed.delayDays === "number" ? parsed.delayDays : suggestion.delayDays,
        };
      } catch (e) {
        // keep defaults
      }
    }

    return res.json(suggestion);
  } catch (e: any) {
    console.error("[/ai/followup/suggest] failed:", e);
    return res.status(500).json({ error: e?.message || "suggest failed" });
  }
});

/**
 * POST /ai/followup/feedback
 * Body: { leadId, variant, opened, replied, converted, delayDays }
 */
router.post("/followup/feedback", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { leadId, variant, opened, replied, converted, delayDays } = req.body || {};
    const lead = await prisma.lead.findUnique({ where: { id: String(leadId) } });
    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    await prisma.followUpLog.create({
      data: {
        tenantId,
        leadId: lead.id,
        variant: String(variant || "A"),
        subject: "(feedback-only)", // not required for analytics here
        body: "",
        opened: opened ?? null,
        replied: replied ?? null,
        converted: converted ?? null,
        delayDays: typeof delayDays === "number" ? delayDays : null,
      },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[/ai/followup/feedback] failed:", e);
    return res.status(500).json({ error: e?.message || "feedback failed" });
  }
});

export default router;