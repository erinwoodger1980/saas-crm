// api/src/routes/opportunities.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { getAccessTokenForTenant, gmailSend } from "../services/gmail";
import { env } from "../env";
import fetch from "node-fetch";

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
    email: req.auth?.email as string | undefined,
  };
}

/**
 * GET /opportunities/:id/followups
 * Returns the sent follow-ups (most recent first)
 */
router.get("/:id/followups", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

  const logs = await prisma.followUpLog.findMany({
    where: { tenantId, leadId: id },
    orderBy: { sentAt: "desc" },
  });

  res.json({ logs });
});

/**
 * POST /opportunities/:id/send-followup
 * Body: { variant, subject, body }
 * Sends email via Gmail (if connected) and logs a FollowUpLog row.
 */
router.post("/:id/send-followup", async (req, res) => {
  try {
    const { tenantId, email: fromEmail } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "not found" });
    }
    if (!lead.email) return res.status(400).json({ error: "lead has no email" });

    const { variant = "A", subject, body } = (req.body || {}) as {
      variant?: string;
      subject?: string;
      body?: string;
    };
    if (!subject || !body) return res.status(400).json({ error: "subject and body required" });

    const accessToken = await getAccessTokenForTenant(tenantId);
    const fromHeader = fromEmail || "me";
    const rfc822 =
      `From: ${fromHeader}\r\n` +
      `To: ${lead.email}\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${body}\r\n`;

    await gmailSend(accessToken, rfc822);

    await prisma.followUpLog.create({
      data: {
        tenantId,
        leadId: id,
        variant: String(variant || "A"),
        subject,
        body,
        delayDays: null,
      },
    });

    await prisma.lead.update({
      where: { id },
      data: {
        nextAction: "Await client reply",
        nextActionAt: new Date(),
      },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[opportunities send-followup] failed:", e);
    return res.status(500).json({ error: e?.message || "send failed" });
  }
});

/**
 * POST /opportunities/:id/next-followup
 * Body: { variant?: "A" | "B" }
 * Returns: { whenISO, subject, body, variant, rationale }
 */
router.post("/:id/next-followup", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const opp = await prisma.opportunity.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!opp || opp.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

    const source = (opp.lead?.custom as any)?.source || "Unknown";

    const from = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);
    const leads = await prisma.lead.findMany({
      where: { tenantId, capturedAt: { gte: from } },
      select: { status: true, custom: true },
    });
    const spends = await prisma.leadSourceSpend.findMany({ where: { tenantId, month: { gte: from } } });

    let wins = 0, spend = 0;
    for (const l of leads) {
      if (((l.custom as any)?.source || "Unknown") === source && String(l.status).toUpperCase() === "WON") wins++;
    }
    for (const s of spends) {
      if (s.source === source) spend += Number(s.amountGBP || 0);
    }
    const cps = wins ? spend / wins : null;

    const baseDaysA = cps && cps < 400 ? 2 : 4;
    const baseDaysB = cps && cps < 400 ? 3 : 6;
    const variant = (req.body?.variant as "A" | "B") || (Math.random() < 0.5 ? "A" : "B");
    const days = variant === "A" ? baseDaysA : baseDaysB;
    const when = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    let subject = `Re: Your quote – ${opp.title}`;
    let body = `Hi ${opp.lead?.contactName || ""},\n\nJust checking you received the quote and if you had any questions.\n\nBest,\nSales`;
    let rationale = "Default heuristic";

    if (env.OPENAI_API_KEY) {
      const prompt = `
You are a sales assistant writing a short follow-up to a customer who received a quote.
Keep tone warm, concise, UK English. Variant=${variant}.
Inputs:
- Lead name: ${opp.lead?.contactName || "-"}
- Opportunity title: ${opp.title}
- Source: ${source}
- Performance: CPS=${cps ?? "unknown"} (lower is better)
Write a subject and 80–140 word body. JSON keys: subject, body, rationale.
`;
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", input: prompt, response_format: { type: "json_object" } }),
      });
      const j = await r.json();
      const text = j?.output_text || j?.choices?.[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(String(text));
        subject = parsed.subject || subject;
        body = parsed.body || body;
        rationale = parsed.rationale || rationale;
      } catch {}
    }

    await prisma.followupExperiment.create({
      data: {
        tenantId,
        opportunityId: opp.id,
        variant,
        suggestedAt: new Date(),
        whenISO: when.toISOString(),
        subject,
        body,
        source,
      },
    });

    res.json({ whenISO: when.toISOString(), subject, body, variant, rationale, source, cps });
  } catch (e: any) {
    console.error("[opportunities next-followup] failed:", e);
    res.status(500).json({ error: e?.message || "failed" });
  }
});

export default router;
