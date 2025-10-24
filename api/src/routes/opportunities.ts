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
router.get("/:id/followups", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

  const logs = await prisma.followUpLog.findMany({
    where: { tenantId, leadId: id },
    orderBy: [{ scheduledFor: "desc" }, { sentAt: "desc" }],
  });

  res.json({ logs });
});

/**
 * POST /opportunities/:id/send-followup
 * Body: { variant, subject, body }
 * Sends email via Gmail (if connected), upserts EmailThread, logs EmailMessage + FollowUpLog.
 */
router.post("/:id/send-followup", async (req: any, res: any) => {
  try {
    const { tenantId, email: fromEmail } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "not found" });
    }
    if (!lead.email) return res.status(400).json({ error: "lead has no email" });

    const {
      variant = "A",
      subject,
      body,
      suggestionId,
      plan,
      rationale,
    } = (req.body || {}) as {
      variant?: string;
      subject?: string;
      body?: string;
      suggestionId?: string;
      plan?: any;
      rationale?: string;
    };
    if (!subject || !body) return res.status(400).json({ error: "subject and body required" });

    // 1) Find the existing Gmail thread for this lead (if any)
    const thread = await prisma.emailThread.findFirst({
      where: { tenantId, leadId: id, provider: "gmail" },
      orderBy: { updatedAt: "desc" },
    });

    // 2) Send with Gmail
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

    // NOTE: gmailSend(accessToken, rfc822) — two args in your project
    const sent = await gmailSend(accessToken, rfc822);

    // 3) Ensure we have an EmailThread row
    const providerThreadId =
      (sent as any).threadId || thread?.threadId || `single:${(sent as any).id}`;

    const threadRow = await prisma.emailThread.upsert({
      where: {
        tenantId_provider_threadId: {
          tenantId,
          provider: "gmail",
          threadId: providerThreadId,
        },
      },
      update: {
        subject: subject || undefined,
        leadId: id,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        provider: "gmail",
        threadId: providerThreadId,
        subject: subject || null,
        leadId: id,
      },
    });

    // 4) Log an outbound EmailMessage (idempotent on (tenantId, provider, messageId))
    await prisma.emailMessage.upsert({
      where: {
        tenantId_provider_messageId: {
          tenantId,
          provider: "gmail",
          messageId: (sent as any).id,
        },
      },
      update: {
        threadId: threadRow.id,
        direction: "outbound",
        fromEmail: fromEmail || null,
        toEmail: lead.email,
        subject,
        snippet: null,
        bodyText: body,
        sentAt: new Date(),
        leadId: id,
      },
      create: {
        tenantId,
        provider: "gmail",
        messageId: (sent as any).id,
        threadId: threadRow.id,
        direction: "outbound",
        fromEmail: fromEmail || null,
        toEmail: lead.email,
        subject,
        snippet: null,
        bodyText: body,
        sentAt: new Date(),
        leadId: id,
      },
    });

    // Follow-up log + next action
    const metadata: Record<string, any> = {};
    if (suggestionId) metadata.suggestionId = suggestionId;
    if (plan) metadata.plan = plan;
    if (rationale) metadata.rationale = rationale;

    const log = await prisma.followUpLog.create({
      data: {
        tenantId,
        leadId: id,
        variant: String(variant || "A"),
        subject,
        body,
        delayDays:
          typeof plan?.email?.delayDays === "number" && Number.isFinite(plan.email.delayDays)
            ? Math.round(plan.email.delayDays)
            : null,
        channel: "email",
        metadata: Object.keys(metadata).length ? metadata : undefined,
      },
    });

    await prisma.lead.update({
      where: { id },
      data: {
        nextAction: "Await client reply",
        nextActionAt: new Date(),
      },
    });

    return res.json({
      ok: true,
      threadId: providerThreadId,
      messageId: (sent as any).id,
      logId: log.id,
    });
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
router.post("/:id/next-followup", async (req: any, res: any) => {
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

    // Look back 2 months
    const from = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);

    const leads = await prisma.lead.findMany({
      where: { tenantId, capturedAt: { gte: from } },
      select: { status: true, custom: true },
    });

    const spends = await prisma.leadSourceSpend.findMany({
      where: { tenantId, month: { gte: from } },
    });

    let wins = 0;
    let spend = 0;

    for (const l of leads) {
      const src = (l.custom as any)?.source || "Unknown";
      if (src === source && String(l.status).toUpperCase() === "WON") wins++;
    }
    for (const s of spends) {
      if ((s as any).source === source) {
        spend += Number((s as any).amountGBP) || 0;
      }
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

      // --- OpenAI Responses API call (typed + defensive) ---
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: prompt,
          response_format: { type: "json_object" },
        }),
      });

      if (!r.ok) {
        console.warn(
          "[opportunities] OpenAI responses API failed:",
          r.status,
          await r.text().catch(() => "")
        );
      } else {
        // Cast to any so TS doesn't treat it as {} and flag property access
        const j: any = await r.json();

        const rawText: string =
          (j?.output_text as string | undefined) ??
          (j?.choices?.[0]?.message?.content as string | undefined) ??
          "{}";

        try {
          const parsed = JSON.parse(rawText);
          if (parsed && typeof parsed === "object") {
            if (typeof parsed.subject === "string") subject = parsed.subject;
            if (typeof parsed.body === "string") body = parsed.body;
            if (typeof parsed.rationale === "string") rationale = parsed.rationale;
          }
        } catch {
          // keep defaults on parse error
        }
      }
    }

    // Optional: log suggestion into followupExperiment if the model/table exists
    const anyPrisma = prisma as any;
    await anyPrisma.followupExperiment?.create?.({
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

    res.json({
      whenISO: when.toISOString(),
      subject,
      body,
      variant,
      rationale,
      source,
      cps,
    });
  } catch (e: any) {
    console.error("[opportunities next-followup] failed:", e);
    res.status(500).json({ error: e?.message || "failed" });
  }
});

router.post("/:id/schedule-call", async (req: any, res: any) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "not found" });
    }

    const {
      scheduledForISO,
      callDelayDays,
      script,
      reason,
      suggestionId,
      priority = "HIGH",
    } = req.body || {};

    const target = scheduledForISO
      ? new Date(String(scheduledForISO))
      : new Date(Date.now() + Math.max(1, Number(callDelayDays) || 2) * 24 * 60 * 60 * 1000);
    if (!target || Number.isNaN(target.getTime())) {
      return res.status(400).json({ error: "invalid schedule" });
    }
    if (target.getTime() < Date.now() - 5 * 60 * 1000) {
      return res.status(400).json({ error: "schedule must be in the future" });
    }

    const callTitle = `Call ${lead.contactName || "lead"} about their quote`;
    const meta: Record<string, any> = {
      channel: "phone",
      origin: "ai-followup",
    };
    if (suggestionId) meta.suggestionId = suggestionId;
    if (reason) meta.reason = reason;
    if (script) meta.script = script;
    if (callDelayDays !== undefined) meta.callDelayDays = callDelayDays;

    const task = await prisma.task.create({
      data: {
        tenantId,
        title: callTitle,
        relatedType: "LEAD" as any,
        relatedId: id,
        dueAt: target,
        priority: String(priority || "HIGH") as any,
        autocreated: true,
        meta,
        assignees: userId
          ? {
              create: [{ userId, role: "OWNER" as any }],
            }
          : undefined,
      },
    });

    const delayFromNow = Math.max(0, Math.round((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const callDelayNumber = Number(callDelayDays);
    const logMeta: Record<string, any> = {
      ...meta,
      taskId: task.id,
    };

    await prisma.followUpLog.create({
      data: {
        tenantId,
        leadId: id,
        variant: "CALL",
        subject: callTitle,
        body: script || "Call lead to discuss their quote",
        delayDays: Number.isFinite(callDelayNumber) ? Math.round(callDelayNumber) : delayFromNow,
        channel: "phone",
        scheduledFor: target,
        metadata: logMeta,
      },
    });

    await prisma.lead.update({
      where: { id },
      data: {
        nextAction: "Phone follow-up scheduled",
        nextActionAt: target,
      },
    });

    res.json({ ok: true, scheduledForISO: target.toISOString(), taskId: task.id });
  } catch (e: any) {
    console.error("[opportunities schedule-call] failed:", e);
    res.status(500).json({ error: e?.message || "failed" });
  }
});

// GET /opportunities/replied-since?days=30
// Returns: { replied: [{ leadId, at }] } where "at" is the last inbound email timestamp.
router.get("/replied-since", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const days = Math.max(1, Math.min(90, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const ingests = await prisma.emailIngest.findMany({
    where: { tenantId, createdAt: { gte: since } },
    select: { leadId: true, fromEmail: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const allLeads = await prisma.lead.findMany({
    where: { tenantId },
    select: { id: true, email: true },
  });
  const emailToLead = new Map<string, string>();
  for (const l of allLeads) {
    if (l.email) emailToLead.set(l.email.toLowerCase(), l.id);
  }

  const latest = new Map<string, Date>();
  for (const it of ingests) {
    const leadId =
      it.leadId || (it.fromEmail ? emailToLead.get(String(it.fromEmail).toLowerCase()) : undefined);
    if (!leadId) continue;
    const prev = latest.get(leadId);
    if (!prev || it.createdAt > prev) latest.set(leadId, it.createdAt);
  }

  res.json({
    replied: Array.from(latest.entries()).map(([leadId, at]) => ({
      leadId,
      at: at.toISOString(),
    })),
  });
});

// POST /opportunities/reconcile-replies
// Links orphan ingests to leads via fromEmail and marks recent followups as replied.
router.post("/reconcile-replies", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const orphans = await prisma.emailIngest.findMany({
    where: { tenantId, leadId: null },
    select: { id: true, fromEmail: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (!orphans.length) return res.json({ ok: true, linked: 0, repliedMarked: 0 });

  const leads = await prisma.lead.findMany({
    where: { tenantId, email: { not: null } },
    select: { id: true, email: true },
  });
  const emailToLead = new Map<string, string>();
  for (const l of leads) {
    if (l.email) emailToLead.set(l.email.toLowerCase(), l.id);
  }

  let linked = 0;
  let repliedMarked = 0;

  for (const ing of orphans) {
    const addr = String(ing.fromEmail || "").toLowerCase().trim();
    if (!addr) continue;

    const leadId = emailToLead.get(addr);
    if (!leadId) continue;

    await prisma.emailIngest.update({
      where: { id: ing.id },
      data: { leadId },
    });
    linked++;

    const lastFU = await prisma.followUpLog.findFirst({
      where: { tenantId, leadId },
      orderBy: { sentAt: "desc" },
    });
    if (lastFU && lastFU.sentAt <= ing.createdAt && !lastFU.replied) {
      await prisma.followUpLog.update({
        where: { id: lastFU.id },
        data: { replied: true },
      });
      repliedMarked++;
    }
  }

  res.json({ ok: true, linked, repliedMarked });
});

// GET /opportunities/:id/replies
router.get("/:id/replies", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

  const lastInbound = await prisma.emailIngest.findFirst({
    where: { tenantId, leadId: id },
    select: { createdAt: true, snippet: true, subject: true, fromEmail: true },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    lastInboundAt: lastInbound?.createdAt?.toISOString() ?? null,
    snippet: lastInbound?.snippet ?? null,
    subject: lastInbound?.subject ?? null,
    fromEmail: lastInbound?.fromEmail ?? null,
  });
});

export default router;