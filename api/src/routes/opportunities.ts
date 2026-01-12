// api/src/routes/opportunities.ts
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getAccessTokenForTenant, gmailSend } from "../services/gmail";
import { env } from "../env";
import fetch from "node-fetch";
import { FOLLOWUPS_ENABLED } from "../lib/followups-feature";
import { linkOpportunityToClientAccount } from "../lib/clientAccount";
import { evaluateAutomationRules } from "./automation-rules";
import { completeTasksOnRecordChangeByLinks } from "../services/field-link";

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
  if (!FOLLOWUPS_ENABLED) {
    return res.status(403).json({ error: "followups_disabled" });
  }

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
    if (!FOLLOWUPS_ENABLED) {
      return res.status(403).json({ error: "followups_disabled" });
    }

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
    if (!FOLLOWUPS_ENABLED) {
      return res.status(403).json({ error: "followups_disabled" });
    }

    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);

    // Allow callers to provide either a lead id or an opportunity id.
    let lead = await prisma.lead.findUnique({
      where: { id },
      include: { client: { select: { source: true } } },
    });
    let opportunity = lead
      ? await prisma.opportunity.findFirst({
          where: { tenantId, leadId: id },
          orderBy: { createdAt: "desc" },
          include: { lead: { include: { client: { select: { source: true } } } } },
        })
      : null;

    if (!lead || lead.tenantId !== tenantId) {
      const oppById = await prisma.opportunity.findUnique({
        where: { id },
        include: { lead: { include: { client: { select: { source: true } } } } },
      });
      if (!oppById || oppById.tenantId !== tenantId) {
        return res.status(404).json({ error: "not found" });
      }
      opportunity = oppById;
      lead = oppById.lead as any;
    }

    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "not found" });
    }

    const source =
      lead.client?.source ||
      ((lead.custom as any) || {}).source ||
      opportunity?.lead?.client?.source ||
      (opportunity?.lead?.custom as any)?.source ||
      "Unknown";

    // Look back 2 months
    const from = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1);

    const leads = await prisma.lead.findMany({
      where: { tenantId, capturedAt: { gte: from } },
      select: { status: true, custom: true, client: { select: { source: true } } },
    });

    const spends = await prisma.leadSourceSpend.findMany({
      where: { tenantId, month: { gte: from } },
    });

    let wins = 0;
    let spend = 0;

    for (const l of leads) {
      const src = l.client?.source || (l.custom as any)?.source || "Unknown";
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

    const oppTitle = opportunity?.title || lead.contactName || "Your quote";
    const leadName = lead.contactName || opportunity?.lead?.contactName || "";

    let subject = `Re: Your quote – ${oppTitle}`;
    let body = `Hi ${leadName || ""},\n\nJust checking you received the quote and if you had any questions.\n\nBest,\nSales`;
    let rationale = "Default heuristic";

    if (env.OPENAI_API_KEY) {
      const prompt = `
You are a sales assistant writing a short follow-up to a customer who received a quote.
Keep tone warm, concise, UK English. Variant=${variant}.
Inputs:
- Lead name: ${leadName || "-"}
- Opportunity title: ${oppTitle}
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

    const leadId = lead.id;
    const anyPrisma = prisma as any;
    await anyPrisma.followupExperiment?.create?.({
      data: {
        tenantId,
        opportunityId: opportunity?.id ?? null,
        variant,
        suggestedAt: new Date(),
        whenISO: when.toISOString(),
        subject,
        body,
        source,
      },
    });

    const futureWindow = new Date(Date.now() - 5 * 60 * 1000);
    const sentAtNullFilter = {
      equals: null,
    } as unknown as Prisma.DateTimeFilter<"FollowUpLog">;

    const existingFuture = await prisma.followUpLog.findFirst({
      where: {
        tenantId,
        leadId,
        channel: "email",
        sentAt: sentAtNullFilter,
        scheduledFor: { gt: futureWindow },
      },
      orderBy: { scheduledFor: "desc" },
    });

    const metadata = {
      ...(existingFuture?.metadata as any),
      autoScheduled: true,
      planner: "ai-followup",
      variant,
      source,
      cps,
      rationale,
    } as Record<string, any>;

    let log;
    if (existingFuture) {
      log = await prisma.followUpLog.update({
        where: { id: existingFuture.id },
        data: {
          subject,
          body,
          delayDays: days,
          scheduledFor: when,
          metadata,
        },
      });
    } else {
      log = await prisma.followUpLog.create({
        data: {
          tenantId,
          leadId,
          variant: String(variant || "A"),
          subject,
          body,
          delayDays: days,
          channel: "email",
          scheduledFor: when,
          metadata,
        },
      });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        nextAction: "AI follow-up scheduled",
        nextActionAt: when,
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
      logId: log.id,
      leadId,
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

/**
 * GET /opportunities/by-lead/:leadId
 * Returns the most recent opportunity for a given lead (if any)
 * NOTE: This MUST come before the generic /:id route or Express will match /by-lead as an id
 */
router.get("/by-lead/:leadId", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const leadId = String(req.params.leadId);

  // Ensure the lead belongs to tenant
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.tenantId !== tenantId) {
    return res.status(404).json({ error: "lead_not_found" });
  }

  const opportunity = await prisma.opportunity.findFirst({
    where: { tenantId, leadId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      stage: true,
      valueGBP: true,
      startDate: true,
      deliveryDate: true,
      installationStartDate: true,
      installationEndDate: true,
      // Material tracking
      timberOrderedAt: true,
      timberExpectedAt: true,
      timberReceivedAt: true,
      timberNotApplicable: true,
      glassOrderedAt: true,
      glassExpectedAt: true,
      glassReceivedAt: true,
      glassNotApplicable: true,
      ironmongeryOrderedAt: true,
      ironmongeryExpectedAt: true,
      ironmongeryReceivedAt: true,
      ironmongeryNotApplicable: true,
      paintOrderedAt: true,
      paintExpectedAt: true,
      paintReceivedAt: true,
      paintNotApplicable: true,
  createdAt: true,
    },
  });

  res.json({ ok: true, opportunity });
});

/**
 * GET /opportunities/:id
 * Returns a single opportunity by ID
 */
router.get("/:id", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);

  const opportunity = await prisma.opportunity.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      leadId: true,
      title: true,
      stage: true,
      valueGBP: true,
      startDate: true,
      deliveryDate: true,
      installationStartDate: true,
      installationEndDate: true,
      // Material tracking
      timberOrderedAt: true,
      timberExpectedAt: true,
      timberReceivedAt: true,
      timberNotApplicable: true,
      glassOrderedAt: true,
      glassExpectedAt: true,
      glassReceivedAt: true,
      glassNotApplicable: true,
      ironmongeryOrderedAt: true,
      ironmongeryExpectedAt: true,
      ironmongeryReceivedAt: true,
      ironmongeryNotApplicable: true,
      paintOrderedAt: true,
      paintExpectedAt: true,
      paintReceivedAt: true,
      paintNotApplicable: true,
      createdAt: true,
    },
  });

  if (!opportunity) {
    return res.status(404).json({ error: "opportunity_not_found" });
  }

  res.json({ ok: true, opportunity });
});

/**
 * GET /opportunities/:id/children
 * Returns split sub-projects for a parent opportunity.
 */
router.get("/:id/children", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);

  const children = await prisma.opportunity.findMany({
    where: { tenantId, parentOpportunityId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      stage: true,
      valueGBP: true,
      createdAt: true,
    },
  });

  res.json({ ok: true, children });
});

/**
 * POST /opportunities/ensure-for-lead/:leadId
 * Idempotently returns the opportunity for a given lead, creating one if missing.
 */
router.post("/ensure-for-lead/:leadId", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const leadId = String(req.params.leadId);

  // Ensure the lead exists and belongs to tenant
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.tenantId !== tenantId) {
    return res.status(404).json({ error: "lead_not_found" });
  }

  // If an Opportunity already exists for this lead, return it
  let opportunity = await prisma.opportunity.findFirst({
    where: { tenantId, leadId },
    orderBy: { createdAt: "desc" },
  });

  if (!opportunity) {
    // Create a minimal opportunity for this lead
    const title = lead.contactName?.trim() ? `${lead.contactName} – Project` : `Project for ${lead.id.slice(0, 6)}`;
    opportunity = await prisma.opportunity.create({
      data: {
        tenantId,
        leadId,
        title,
        // Leave start/delivery/value null by default
      },
    });
    // Link opportunity to ClientAccount
    linkOpportunityToClientAccount(opportunity.id).catch((err: any) => 
      console.warn("[opportunities] Failed to link to ClientAccount:", err)
    );
  }

  res.json({ ok: true, opportunity });
});

/**
 * PATCH /opportunities/:id
 * Update opportunity fields (startDate, deliveryDate, valueGBP, etc.)
 */
router.patch("/:id", async (req: any, res: any) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const updates = req.body || {};

  console.log('[opportunities.patch] incoming updates:', { id, updates });

  // Verify opportunity belongs to tenant
  const opp = await prisma.opportunity.findFirst({
    where: { id, tenantId },
  });

  if (!opp) {
    return res.status(404).json({ error: "opportunity_not_found" });
  }

  // Build update object with proper type conversions
  const data: any = {};
  
  // Date fields
  const dateFields = [
    'startDate', 'deliveryDate', 'installationStartDate', 'installationEndDate',
    'createdAt', 'wonAt', 'lostAt',
    'timberOrderedAt', 'timberExpectedAt', 'timberReceivedAt',
    'glassOrderedAt', 'glassExpectedAt', 'glassReceivedAt',
    'ironmongeryOrderedAt', 'ironmongeryExpectedAt', 'ironmongeryReceivedAt',
    'paintOrderedAt', 'paintExpectedAt', 'paintReceivedAt'
  ];
  
  for (const field of dateFields) {
    if (field in updates) {
      const raw = updates[field];
      if (!raw) {
        data[field] = null;
        continue;
      }
      let parsed: Date | null = null;
      try {
        if (typeof raw === 'string') {
          // Accept YYYY-MM-DD or DD/MM/YYYY
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            parsed = new Date(raw + 'T00:00:00Z');
          } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
            const [d,m,y] = raw.split('/');
            parsed = new Date(`${y}-${m}-${d}T00:00:00Z`);
          } else {
            const tmp = new Date(raw);
            if (!isNaN(tmp.getTime())) parsed = tmp; else parsed = null;
          }
        } else if (raw instanceof Date) {
          parsed = raw;
        }
      } catch (e) {
        console.warn('[opportunities.patch] failed to parse date field', field, raw, (e as any)?.message);
        parsed = null;
      }
      data[field] = parsed;
    }
  }
  
  // Numeric fields
  if ('valueGBP' in updates) {
    data.valueGBP = updates.valueGBP != null ? Number(updates.valueGBP) : null;
  }
  
  // Boolean fields
  const booleanFields = [
    'timberNotApplicable', 'glassNotApplicable', 
    'ironmongeryNotApplicable', 'paintNotApplicable'
  ];
  
  for (const field of booleanFields) {
    if (field in updates) {
      data[field] = Boolean(updates[field]);
    }
  }
  
  // String fields
  const stringFields = ['title', 'stage', 'clientAccountId', 'clientId', 'number', 'description'];
  
  for (const field of stringFields) {
    if (field in updates) {
      data[field] = updates[field];
    }
  }

  console.log('[opportunities.patch] Prisma update data object:', JSON.stringify(data, null, 2));

  const updated = await prisma.opportunity.update({
    where: { id },
    data,
  });

  console.log('[opportunities.patch] updated fields:', data);
  console.log('[opportunities.patch] resulting opportunity dates:', {
    startDate: updated.startDate,
    deliveryDate: updated.deliveryDate,
    installationStartDate: updated.installationStartDate,
    installationEndDate: updated.installationEndDate,
  });

  // Evaluate automation rules for this opportunity update
  try {
    const changedFields = Object.keys(data);
    const oldValues: Record<string, any> = {};
    for (const field of changedFields) {
      oldValues[field] = (opp as any)[field];
    }
    
    await evaluateAutomationRules({
      tenantId,
      entityType: 'OPPORTUNITY',
      entityId: id,
      entity: updated,
      changedFields,
      oldValues,
      userId: req.auth?.userId,
    });
  } catch (autoErr) {
    console.error('[opportunities.patch] Automation evaluation error:', autoErr);
    // Don't fail the request if automation fails
  }

  // Trigger generic Field ↔ Task link auto-completion on relevant field changes
  try {
    const changed: Record<string, any> = {};
    for (const k of Object.keys(data)) {
      changed[k] = (updated as any)[k];
    }
    if (Object.keys(changed).length > 0) {
      await completeTasksOnRecordChangeByLinks({
        tenantId,
        model: "Opportunity",
        recordId: id,
        changed,
        newRecord: updated,
      });
    }
  } catch (e) {
    console.warn("[opportunities.patch] field-link sync failed:", (e as any)?.message || e);
  }

  res.json({ ok: true, opportunity: updated });
});

/**
 * POST /opportunities
 * Create a new opportunity (project) directly without requiring a lead
 * Body: { title, clientId?, valueGBP?, startDate?, deliveryDate?, stage?, description? }
 */
router.post("/", async (req: any, res: any) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const {
    title,
    clientId,
    valueGBP,
    startDate,
    deliveryDate,
    stage = "WON", // Default to WON for direct project creation
    description,
    contactName,
    email,
    phone,
  } = req.body || {};

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  try {
    // Create the opportunity directly (leadId is now optional)
    const data: any = {
      tenantId,
      title,
      stage,
      clientId: clientId || undefined,
      valueGBP: valueGBP ? parseFloat(valueGBP) : undefined,
      description: description || undefined,
    };

    // Set wonAt if stage is WON
    if (stage === "WON") {
      data.wonAt = new Date();
    }

    // Parse dates
    if (startDate) {
      try {
        data.startDate = new Date(startDate);
      } catch (e) {
        console.warn("[opportunities.post] Invalid startDate:", startDate);
      }
    }
    if (deliveryDate) {
      try {
        data.deliveryDate = new Date(deliveryDate);
      } catch (e) {
        console.warn("[opportunities.post] Invalid deliveryDate:", deliveryDate);
      }
    }

    // If contact info provided but no clientId, we could create a client
    // For now, just create the opportunity
    const opportunity = await prisma.opportunity.create({
      data,
      include: {
        client: true,
        lead: true,
      },
    });

    // Link to ClientAccount if clientId provided
    if (clientId) {
      linkOpportunityToClientAccount(opportunity.id).catch((err: any) => 
        console.warn("[opportunities.post] Failed to link to ClientAccount:", err)
      );
    }

    res.json({ ok: true, opportunity });
  } catch (err: any) {
    console.error("[opportunities.post] Error creating opportunity:", err);
    res.status(500).json({ error: err.message || "failed_to_create_opportunity" });
  }
});

/**
 * POST /opportunities/:id/split
 * Split an opportunity into multiple child opportunities (e.g., windows vs doors)
 * Body: { splits: [{ title, description?, valueGBP? }] }
 */
router.post("/:id/split", async (req: any, res: any) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const { splits } = req.body || {};

  if (!splits || !Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ error: "splits array is required" });
  }

  try {
    // Verify parent opportunity exists
    const parent = await prisma.opportunity.findFirst({
      where: { id, tenantId },
      include: { client: true, lead: true, clientAccount: true },
    });

    if (!parent) {
      return res.status(404).json({ error: "opportunity_not_found" });
    }

    const baseLeadCustom = (() => {
      const c = (parent as any)?.lead?.custom;
      if (c && typeof c === "object" && !Array.isArray(c)) return c as any;
      return null;
    })();

    // Create child opportunities (each child gets its own Lead so it shows up in lead-driven lists)
    const children = await Promise.all(
      splits.map(async (split: any) => {
        const childTitle = split.title || `${parent.title} - Split`;
        const childDescription = split.description || parent.description || childTitle;
        const inferredContactName =
          (parent as any)?.lead?.contactName ||
          (parent as any)?.clientAccount?.primaryContact ||
          (parent as any)?.clientAccount?.companyName ||
          parent.title ||
          "Project";
        const inferredEmail =
          (parent as any)?.lead?.email || (parent as any)?.clientAccount?.email || null;

        const childLead = await prisma.lead.create({
          data: {
            tenantId,
            createdById: userId,
            clientId: (parent as any)?.lead?.clientId || parent.clientId || null,
            clientAccountId: (parent as any)?.lead?.clientAccountId || parent.clientAccountId || null,
            contactName: inferredContactName,
            email: inferredEmail,
            phone: (parent as any)?.lead?.phone || null,
            address: (parent as any)?.lead?.address || null,
            deliveryAddress: (parent as any)?.lead?.deliveryAddress || null,
            number: (parent as any)?.lead?.number || null,
            description: childTitle,
            status: (parent as any)?.lead?.status || "WON",
            custom: {
              ...(baseLeadCustom ? { ...(baseLeadCustom as any) } : {}),
              splitParentOpportunityId: id,
            },
          },
        });

        return prisma.opportunity.create({
          data: {
            tenantId,
            parentOpportunityId: id,
            leadId: childLead.id,
            // IMPORTANT: Opportunity.leadId is unique, so child opportunities cannot reuse
            // the parent's leadId. Each child gets its own lead (above).
            clientId: parent.clientId,
            clientAccountId: parent.clientAccountId,
            title: childTitle,
            description: childDescription,
            valueGBP: split.valueGBP ? parseFloat(split.valueGBP) : undefined,
            stage: parent.stage,
            wonAt: parent.wonAt,
            startDate: parent.startDate,
            deliveryDate: parent.deliveryDate,
          },
        });
      })
    );

    res.json({ ok: true, parent, children });
  } catch (err: any) {
    console.error("[opportunities.split] Error splitting opportunity:", err);
    res.status(500).json({ error: err.message || "failed_to_split_opportunity" });
  }
});

export default router;