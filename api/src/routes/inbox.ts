import { Router } from "express";
import OpenAI from "openai";
import { load } from "cheerio";
import { prisma } from "../prisma";
import { fetchMessage, getAccessTokenForTenant as getGmailTokenForTenant } from "../services/gmail";
import { getAccessTokenForTenant as getMs365TokenForTenant, graphGet } from "../services/ms365";
import { getAdminGmailConnections, getAdminMs365Connections } from "../services/user-email";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
  };
}

async function getInboxLastReadAt(tenantId: string, userId: string) {
  const pref = await prisma.userPreference.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { notifications: true },
  });
  const raw = (pref?.notifications as any)?.inboxLastReadAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function setInboxLastReadAt(tenantId: string, userId: string, at: Date) {
  const pref = await prisma.userPreference.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { notifications: true },
  });
  const notifications = { ...(pref?.notifications as any) };
  notifications.inboxLastReadAt = at.toISOString();
  await prisma.userPreference.upsert({
    where: { tenantId_userId: { tenantId, userId } },
    update: { notifications },
    create: { tenantId, userId, notifications },
  });
}

async function getInboxSettings(tenantId: string) {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { inbox: true },
  });
  return ((settings?.inbox as any) || {}) as Record<string, any>;
}

function decodeMimeStr(input: string) {
  try {
    const b = Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    return b.toString("utf8");
  } catch {
    return input;
  }
}

function normalizePlainText(input: string) {
  if (!input) return "";
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
}

function htmlToPlainText(html: string) {
  if (!html) return "";
  try {
    const $ = load(html);
    $("br").replaceWith("\n");
    $("p").each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      if (text && !/\n$/.test(text)) {
        $el.append("\n\n");
      }
    });
    $("li").each((_, el) => {
      const $el = $(el);
      $el.prepend("- ");
      $el.append("\n");
    });
    const text = $.root().text();
    return normalizePlainText(text);
  } catch {
    return normalizePlainText(html.replace(/<[^>]+>/g, " "));
  }
}

function extractGmailBody(msg: any) {
  let bodyText = "";
  let bodyHtml: string | undefined;
  const walk = (p: any) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) {
      bodyText += decodeMimeStr(p.body.data) + "\n";
    }
    if (p.mimeType === "text/html" && p.body?.data && !bodyHtml) {
      bodyHtml = decodeMimeStr(p.body.data);
    }
    if (p.parts) p.parts.forEach(walk);
  };
  walk(msg.payload);
  if (!bodyText && msg.payload?.body?.data) bodyText = decodeMimeStr(msg.payload.body.data);
  if (!bodyText && bodyHtml) bodyText = htmlToPlainText(bodyHtml);
  bodyText = normalizePlainText(bodyText);
  if (!bodyText && bodyHtml) bodyText = htmlToPlainText(bodyHtml);
  return bodyText;
}

async function fetchGmailBody(tenantId: string, messageId: string): Promise<string | null> {
  try {
    const token = await getGmailTokenForTenant(tenantId);
    const msg = await fetchMessage(token, messageId, "full");
    return extractGmailBody(msg);
  } catch {}

  try {
    const conns = await getAdminGmailConnections(tenantId);
    for (const conn of conns) {
      try {
        const msg = await fetchMessage(conn.accessToken, messageId, "full");
        return extractGmailBody(msg);
      } catch {}
    }
  } catch {}

  return null;
}

async function fetchMs365Body(tenantId: string, messageId: string): Promise<string | null> {
  try {
    const token = await getMs365TokenForTenant(tenantId);
    const msg = await graphGet(token, `/me/messages/${encodeURIComponent(messageId)}?$select=body,bodyPreview`);
    const html = String(msg?.body?.content || "");
    const isHtml = String(msg?.body?.contentType || "").toLowerCase() === "html";
    const bodyText = isHtml ? htmlToPlainText(html) : normalizePlainText(html || msg?.bodyPreview || "");
    return bodyText;
  } catch {}

  try {
    const conns = await getAdminMs365Connections(tenantId);
    for (const conn of conns) {
      try {
        const msg = await graphGet(conn.accessToken, `/me/messages/${encodeURIComponent(messageId)}?$select=body,bodyPreview`);
        const html = String(msg?.body?.content || "");
        const isHtml = String(msg?.body?.contentType || "").toLowerCase() === "html";
        const bodyText = isHtml ? htmlToPlainText(html) : normalizePlainText(html || msg?.bodyPreview || "");
        return bodyText;
      } catch {}
    }
  } catch {}

  return null;
}

router.get("/summary", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  try {
    const lastReadAt = await getInboxLastReadAt(tenantId, userId);

    const [openTasks, newEnquiries, unreadThreads] = await Promise.all([
      prisma.task.count({
        where: { tenantId, status: { notIn: ["DONE", "CANCELLED"] } },
      }),
      prisma.lead.count({
        where: {
          tenantId,
          OR: [
            { status: "NEW" },
            { custom: { path: ["uiStatus"], equals: "NEW_ENQUIRY" } },
          ],
        },
      }),
      prisma.emailThread.count({
        where: {
          tenantId,
          lastInboundAt: lastReadAt
            ? { gt: lastReadAt }
            : { not: null },
        },
      }),
    ]);

    return res.json({
      ok: true,
      counts: {
        inbox: unreadThreads,
        tasks: openTasks,
        leads: newEnquiries,
      },
      lastReadAt,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

router.post("/mark-read", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });
  const now = new Date();
  try {
    await setInboxLastReadAt(tenantId, userId, now);
    return res.json({ ok: true, lastReadAt: now.toISOString() });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

router.get("/accounts", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  try {
    const [gmailTenant, ms365Tenant, gmailUsers, ms365Users] = await Promise.all([
      prisma.gmailTenantConnection.findUnique({
        where: { tenantId },
        select: { id: true, gmailAddress: true, connectedById: true },
      }),
      prisma.ms365TenantConnection.findUnique({
        where: { tenantId },
        select: { id: true, ms365Address: true, connectedById: true },
      }),
      prisma.gmailUserConnection.findMany({
        where: { tenantId },
        select: { id: true, gmailAddress: true, userId: true, user: { select: { name: true, email: true } } },
      }),
      prisma.ms365UserConnection.findMany({
        where: { tenantId },
        select: { id: true, ms365Address: true, userId: true, user: { select: { name: true, email: true } } },
      }),
    ]);

    const accounts = [
      ...(gmailTenant?.gmailAddress
        ? [
            {
              id: gmailTenant.id,
              provider: "gmail",
              email: gmailTenant.gmailAddress,
              scope: "tenant",
            },
          ]
        : []),
      ...(ms365Tenant?.ms365Address
        ? [
            {
              id: ms365Tenant.id,
              provider: "ms365",
              email: ms365Tenant.ms365Address,
              scope: "tenant",
            },
          ]
        : []),
      ...gmailUsers.map((conn) => ({
        id: conn.id,
        provider: "gmail",
        email: conn.gmailAddress,
        scope: "user",
        userId: conn.userId,
        userName: conn.user?.name || conn.user?.email || conn.gmailAddress,
      })),
      ...ms365Users.map((conn) => ({
        id: conn.id,
        provider: "ms365",
        email: conn.ms365Address,
        scope: "user",
        userId: conn.userId,
        userName: conn.user?.name || conn.user?.email || conn.ms365Address,
      })),
    ];

    return res.json({ ok: true, accounts });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

router.get("/threads", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const account = typeof req.query.account === "string" ? req.query.account.trim() : "";
  const provider = typeof req.query.provider === "string" ? req.query.provider.trim() : "";
  const linked = typeof req.query.linked === "string" ? req.query.linked.trim() : "";
  const take = Math.max(1, Math.min(Number(req.query.take || 50), 100));
  const skip = Math.max(0, Number(req.query.skip || 0));

  const and: any[] = [];
  if (provider) {
    and.push({ provider });
  }
  if (linked === "linked") {
    and.push({ OR: [{ leadId: { not: null } }, { opportunityId: { not: null } }] });
  } else if (linked === "unlinked") {
    and.push({ leadId: null, opportunityId: null });
  }
  if (account) {
    and.push({
      messages: {
        some: {
          OR: [
            { toEmail: { contains: account, mode: "insensitive" } },
            { fromEmail: { contains: account, mode: "insensitive" } },
          ],
        },
      },
    });
  }
  if (q) {
    and.push({
      OR: [
        { subject: { contains: q, mode: "insensitive" } },
        {
          messages: {
            some: {
              OR: [
                { fromEmail: { contains: q, mode: "insensitive" } },
                { toEmail: { contains: q, mode: "insensitive" } },
                { snippet: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  try {
    const lastReadAt = await getInboxLastReadAt(tenantId, userId);
    const threads = await prisma.emailThread.findMany({
      where: {
        tenantId,
        ...(and.length ? { AND: and } : {}),
      },
      orderBy: [{ lastInboundAt: "desc" }, { updatedAt: "desc" }],
      take,
      skip,
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            email: true,
            number: true,
            clientAccountId: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
            number: true,
            stage: true,
            clientAccountId: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { sentAt: "desc" },
          select: {
            id: true,
            messageId: true,
            fromEmail: true,
            toEmail: true,
            subject: true,
            snippet: true,
            sentAt: true,
            direction: true,
            provider: true,
          },
        },
      },
    });

    const items = threads.map((thread) => {
      const lastInboundAt = thread.lastInboundAt;
      const unread = lastInboundAt
        ? lastReadAt
          ? lastInboundAt > lastReadAt
          : true
        : false;
      return {
        ...thread,
        unread,
        lastMessage: thread.messages[0] || null,
      };
    });

    return res.json({ ok: true, threads: items });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

router.get("/search", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!q) return res.json({ ok: true, items: [] });

  try {
    if (type === "lead") {
      const items = await prisma.lead.findMany({
        where: {
          tenantId,
          OR: [
            { contactName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { number: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { capturedAt: "desc" },
        take: 10,
        select: { id: true, contactName: true, email: true, number: true },
      });
      return res.json({ ok: true, items });
    }
    if (type === "opportunity") {
      const items = await prisma.opportunity.findMany({
        where: {
          tenantId,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { number: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, number: true, stage: true },
      });
      return res.json({ ok: true, items });
    }

    return res.status(400).json({ error: "invalid type" });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

async function parseThreadInternal(tenantId: string, userId: string, threadId: string) {
  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, tenantId },
    include: {
      lead: { select: { id: true } },
      opportunity: { select: { id: true } },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { id: true, messageId: true, bodyText: true, subject: true, snippet: true, provider: true },
      },
    },
  });
  if (!thread) throw new Error("thread not found");

  const msg = thread.messages[0];
  if (!msg) throw new Error("no message found");

  let bodyText = msg.bodyText || null;
  if (!bodyText) {
    bodyText = msg.provider === "ms365"
      ? await fetchMs365Body(tenantId, msg.messageId)
      : await fetchGmailBody(tenantId, msg.messageId);

    if (bodyText) {
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: { bodyText },
      });
    }
  }

  const body = bodyText || msg.snippet || "";
  if (!body) throw new Error("no body available");

  const prompt = `You are assisting a joinery business. Extract whether this email confirms a client is ready for delivery or install. If it suggests dates, extract them.

Return JSON with:
- isDeliveryConfirmed (boolean)
- installationStartDate (YYYY-MM-DD or null)
- installationEndDate (YYYY-MM-DD or null)
- taskTitle (string)
- taskDescription (string)
- confidence (0-1)

Email:
Subject: ${msg.subject || thread.subject || "(no subject)"}
Body:\n${body}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "inbox_delivery_suggestion",
        schema: {
          type: "object",
          additionalProperties: true,
          properties: {
            isDeliveryConfirmed: { type: "boolean" },
            installationStartDate: { type: ["string", "null"] },
            installationEndDate: { type: ["string", "null"] },
            taskTitle: { type: "string" },
            taskDescription: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["isDeliveryConfirmed", "taskTitle", "taskDescription"],
        },
      },
    },
  });

  const text = resp.choices[0]?.message?.content || "{}";
  const suggestion = JSON.parse(text);
  return {
    suggestion,
    linked: { leadId: thread.lead?.id || null, opportunityId: thread.opportunity?.id || null },
  };
}

async function applySuggestionInternal(tenantId: string, userId: string, threadId: string, suggestion: any) {
  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, tenantId },
    select: { leadId: true, opportunityId: true },
  });
  if (!thread) throw new Error("thread not found");

  const existing = await prisma.task.findFirst({
    where: {
      tenantId,
      meta: { path: ["inboxThreadId"], equals: threadId } as any,
    },
    select: { id: true },
  });
  if (existing?.id) return { taskId: existing.id, reused: true };

  const relatedType = thread.opportunityId ? "QUOTE" : thread.leadId ? "LEAD" : "OTHER";
  const relatedId = thread.opportunityId || thread.leadId || undefined;

  const dueAt = suggestion.installationStartDate ? new Date(suggestion.installationStartDate) : undefined;

  const task = await prisma.task.create({
    data: {
      tenantId,
      title: String(suggestion.taskTitle || "Delivery confirmed"),
      description: String(suggestion.taskDescription || ""),
      relatedType: relatedType as any,
      relatedId,
      status: "OPEN" as any,
      priority: "MEDIUM" as any,
      dueAt: dueAt || undefined,
      createdById: userId,
      meta: {
        source: "inbox_ai",
        inboxThreadId: threadId,
        installationStartDate: suggestion.installationStartDate || null,
        installationEndDate: suggestion.installationEndDate || null,
      } as any,
    },
  });

  if (thread.opportunityId && (suggestion.installationStartDate || suggestion.installationEndDate)) {
    await prisma.opportunity.update({
      where: { id: thread.opportunityId },
      data: {
        installationStartDate: suggestion.installationStartDate ? new Date(suggestion.installationStartDate) : undefined,
        installationEndDate: suggestion.installationEndDate ? new Date(suggestion.installationEndDate) : undefined,
      },
    });
  }

  if (thread.leadId && (suggestion.installationStartDate || suggestion.installationEndDate)) {
    const lead = await prisma.lead.findUnique({ where: { id: thread.leadId }, select: { custom: true } });
    const custom = { ...(lead?.custom as any) };
    if (suggestion.installationStartDate) custom.installationStartDate = suggestion.installationStartDate;
    if (suggestion.installationEndDate) custom.installationEndDate = suggestion.installationEndDate;
    await prisma.lead.update({
      where: { id: thread.leadId },
      data: { custom },
    });
  }

  return { taskId: task.id, reused: false };
}

router.post("/link", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const threadId = String(req.body?.threadId || "").trim();
  const leadId = typeof req.body?.leadId === "string" ? req.body.leadId.trim() : null;
  const opportunityId = typeof req.body?.opportunityId === "string" ? req.body.opportunityId.trim() : null;

  if (!threadId) return res.status(400).json({ error: "threadId required" });
  if (!leadId && !opportunityId) return res.status(400).json({ error: "leadId or opportunityId required" });

  try {
    const thread = await prisma.emailThread.findFirst({
      where: { id: threadId, tenantId },
      select: { id: true },
    });
    if (!thread) return res.status(404).json({ error: "thread not found" });

    await prisma.emailThread.update({
      where: { id: threadId },
      data: {
        leadId: leadId || undefined,
        opportunityId: opportunityId || undefined,
        updatedAt: new Date(),
      },
    });

    await prisma.emailMessage.updateMany({
      where: { tenantId, threadId },
      data: {
        leadId: leadId || undefined,
        opportunityId: opportunityId || undefined,
      },
    });

    let autoApplied: { taskId?: string; suggestion?: any } | null = null;
    try {
      const inbox = await getInboxSettings(tenantId);
      if (inbox.autoParseLinked) {
        const parsed = await parseThreadInternal(tenantId, userId || "system", threadId);
        const suggestion = parsed.suggestion || {};
        const confidence = typeof suggestion.confidence === "number" ? suggestion.confidence : 0;
        if (suggestion.isDeliveryConfirmed && confidence >= 0.6) {
          const applied = await applySuggestionInternal(tenantId, userId || "system", threadId, suggestion);
          autoApplied = { taskId: applied.taskId, suggestion };
        }
      }
    } catch {}

    return res.json({ ok: true, autoApplied });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

router.post("/parse-thread", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const threadId = String(req.body?.threadId || "").trim();
  if (!threadId) return res.status(400).json({ error: "threadId required" });

  try {
    const parsed = await parseThreadInternal(tenantId, userId, threadId);
    return res.json({ ok: true, ...parsed });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

router.post("/apply-suggestion", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const threadId = String(req.body?.threadId || "").trim();
  const suggestion = req.body?.suggestion || null;
  if (!threadId || !suggestion) return res.status(400).json({ error: "threadId and suggestion required" });

  try {
    const applied = await applySuggestionInternal(tenantId, userId, threadId, suggestion);
    return res.json({ ok: true, taskId: applied.taskId, reused: applied.reused });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

export default router;
