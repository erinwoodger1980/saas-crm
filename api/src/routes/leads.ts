// api/src/routes/leads.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { gmailSend, getAccessTokenForTenant, gmailFetchAttachment } from "../services/gmail";
import { logInsight, logEvent } from "../services/training";
import { UiStatus, loadTaskPlaybook, ensureTaskFromRecipe, TaskPlaybook } from "../task-playbook";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { randomUUID } from "crypto";

const router = Router();

/* ------------------------------------------------------------------ */
/* Helpers: auth + status mapping                                      */
/* ------------------------------------------------------------------ */

function headerString(req: any, key: string): string | undefined {
  const raw = req.headers?.[key];
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

function getAuth(req: any) {
  return {
    tenantId:
      (req.auth?.tenantId as string | undefined) ?? headerString(req, "x-tenant-id"),
    userId:
      (req.auth?.userId as string | undefined) ?? headerString(req, "x-user-id"),
    email: (req.auth?.email as string | undefined) ?? headerString(req, "x-user-email"),
  };
}

// Stored enum values (supports both legacy + new names)
type DbStatus =
  | "NEW"
  | "CONTACTED"
  | "INFO_REQUESTED"
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "REJECTED"
  | "READY_TO_QUOTE"
  | "QUOTE_SENT"
  | "WON"
  | "LOST";

function uiToDb(s: UiStatus): DbStatus {
  switch (s) {
    case "NEW_ENQUIRY":
      return "NEW";
    case "INFO_REQUESTED":
      return "INFO_REQUESTED";
    case "READY_TO_QUOTE":
      return "READY_TO_QUOTE";
    case "QUOTE_SENT":
      return "QUOTE_SENT";
    case "WON":
      return "WON";
    case "REJECTED":
      return "REJECTED";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    case "LOST":
      return "LOST";
  }
  return "NEW";
}

function dbToUi(db: string): UiStatus {
  switch (String(db).toUpperCase()) {
    case "NEW":
      return "NEW_ENQUIRY";
    case "CONTACTED":
      return "INFO_REQUESTED";
    case "INFO_REQUESTED":
      return "INFO_REQUESTED";
    case "QUALIFIED":
      return "READY_TO_QUOTE";
    case "READY_TO_QUOTE":
      return "READY_TO_QUOTE";
    case "QUOTE_SENT":
      return "QUOTE_SENT";
    case "REJECTED":
      return "REJECTED";
    case "DISQUALIFIED":
      return "DISQUALIFIED";
    case "WON":
      return "WON";
    case "LOST":
      return "LOST";
    default:
      return "NEW_ENQUIRY";
  }
}

function monthStartUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/* ------------------------------------------------------------------ */
/* Task helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Create follow-up tasks when status transitions happen.
 * We *proactively* create tasks so the user can do the action next.
 */
async function handleStatusTransition(opts: {
  tenantId: string;
  leadId: string;
  prevUi: UiStatus | null;
  nextUi: UiStatus;
  actorId?: string | null;
  playbook?: TaskPlaybook;
}) {
  const { tenantId, leadId, nextUi } = opts;
  const playbook = opts.playbook ?? (await loadTaskPlaybook(tenantId));
  const recipes = playbook.status[nextUi] || [];

  for (const recipe of recipes) {
    await ensureTaskFromRecipe({
      tenantId,
      recipe,
      relatedId: leadId,
      relatedType: recipe.relatedType ?? "LEAD",
      uniqueKey: `${recipe.id}:${leadId}`,
      actorId: opts.actorId ?? null,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Field defs                                                          */
/* ------------------------------------------------------------------ */

router.get("/fields", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const defs = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });
  res.json(defs);
});

router.post("/fields", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const { id, key, label, type = "text", required = false, config, sortOrder = 0 } = req.body;
  if (!key || !label) return res.status(400).json({ error: "key and label required" });

  const data = { tenantId, key, label, type, required, config, sortOrder };
  const def = id
    ? await prisma.leadFieldDef.update({ where: { id }, data })
    : await prisma.leadFieldDef.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: data,
        create: data,
      });

  res.json(def);
});

/* ------------------------------------------------------------------ */
/* Grouped list for Leads board                                        */
/* ------------------------------------------------------------------ */

const UI_BUCKETS: UiStatus[] = [
  "NEW_ENQUIRY",
  "INFO_REQUESTED",
  "DISQUALIFIED",
  "REJECTED",
  "READY_TO_QUOTE",
  "QUOTE_SENT",
  "WON",
  "LOST",
];

router.get("/grouped", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const rows = await prisma.lead.findMany({
    where: { tenantId },
    orderBy: [{ capturedAt: "desc" }],
  });

  const grouped: Record<UiStatus, any[]> = Object.fromEntries(
    UI_BUCKETS.map((s) => [s, [] as any[]])
  ) as any;

  for (const l of rows) {
    const ui = (l.custom as any)?.uiStatus as UiStatus | undefined;
    const bucket = ui ?? dbToUi(l.status);
    (grouped[bucket] || grouped.NEW_ENQUIRY).push(l);
  }

  res.json(grouped);
});

/* ------------------------------------------------------------------ */
/* Create lead                                                         */
/* ------------------------------------------------------------------ */

router.post("/", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const {
    contactName,
    email,
    status,
    custom = {},
    description,
  }: {
    contactName: string;
    email?: string;
    status?: UiStatus;
    custom?: any;
    description?: string;
  } = req.body || {};

  if (!contactName) return res.status(400).json({ error: "contactName required" });

  const uiStatus: UiStatus = status || "NEW_ENQUIRY";

  const playbook = await loadTaskPlaybook(tenantId);

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      createdById: userId,
      contactName: String(contactName),
      email: email ?? "",
      status: uiToDb(uiStatus),
      description: description ?? null,
      custom: { ...(custom ?? {}), uiStatus },
    },
  });

  // Proactive first task
  await handleStatusTransition({ tenantId, leadId: lead.id, prevUi: null, nextUi: uiStatus, actorId: userId, playbook });

  res.json(lead);
});

/* ------------------------------------------------------------------ */
/* Update lead (partial) + task side-effects on status change          */
/* ------------------------------------------------------------------ */

router.patch("/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const id = String(req.params.id);
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

  const body = (req.body ?? {}) as {
    contactName?: string | null;
    email?: string | null;
    status?: UiStatus;
    description?: string | null;
    custom?: Record<string, any>;
  };

  const prevCustom = ((existing.custom as any) || {}) as Record<string, any>;
  const prevUi: UiStatus = (prevCustom.uiStatus as UiStatus) ?? dbToUi(existing.status);

  const nextCustom = { ...prevCustom, ...(body.custom || {}) };
  let nextUi: UiStatus = prevUi;

  const data: any = {};

  if (body.contactName !== undefined) data.contactName = body.contactName || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.description !== undefined) data.description = body.description || null;

  if (body.status !== undefined) {
    nextUi = body.status;
    data.status = uiToDb(nextUi);
    nextCustom.uiStatus = nextUi;
  }

  data.custom = nextCustom;

  const updated = await prisma.lead.update({ where: { id }, data });

  if (nextUi !== prevUi) {
    const actorId = (req.auth?.userId as string | undefined) ?? null;
    const playbook = await loadTaskPlaybook(tenantId);
    await handleStatusTransition({ tenantId, leadId: id, prevUi, nextUi, actorId, playbook });

    // Learning signal: when users move a lead to certain buckets, label the originating ingests
    const positive: UiStatus[] = [
      "INFO_REQUESTED",
      "READY_TO_QUOTE",
      "QUOTE_SENT",
      "WON",
    ];
    const negative: UiStatus[] = ["DISQUALIFIED", "REJECTED", "LOST"];
    try {
      if (positive.includes(nextUi)) {
        await prisma.emailIngest.updateMany({
          where: { tenantId, leadId: id },
          data: { userLabelIsLead: true, userLabeledAt: new Date() },
        });
      } else if (negative.includes(nextUi)) {
        await prisma.emailIngest.updateMany({
          where: { tenantId, leadId: id },
          data: { userLabelIsLead: false, userLabeledAt: new Date() },
        });
      }
    } catch {}

    // Also log transparent training insights so the AI Training page reflects this acceptance/rejection
    try {
      const becameAccepted = positive.includes(nextUi);
      const becameRejected = negative.includes(nextUi);
      if (becameAccepted || becameRejected) {
        const decision = becameAccepted ? "accepted" : "rejected";

        // Link to originating emails if any; else log against the lead itself
        const ingests = await prisma.emailIngest.findMany({
          where: { tenantId, leadId: id },
          select: { provider: true, messageId: true },
          take: 20,
        });

        if (ingests.length > 0) {
          for (const g of ingests) {
            if (!g.provider || !g.messageId) continue;
            await logInsight({
              tenantId,
              module: "lead_classifier",
              inputSummary: `email:${g.provider}:${g.messageId}`,
              decision,
              confidence: null,
              userFeedback: { byStatusChange: true, status: nextUi, actorId },
            });
          }
        } else {
          await logInsight({
            tenantId,
            module: "lead_classifier",
            inputSummary: `lead:${id}:${nextUi}`,
            decision,
            confidence: null,
            userFeedback: { byStatusChange: true, status: nextUi, actorId },
          });
        }

        // Audit trail event
        await logEvent({
          tenantId,
          module: "lead_classifier",
          kind: "FEEDBACK",
          payload: { source: "lead_status_change", leadId: id, to: nextUi, from: prevUi, decision },
          actorId,
        });
      }
    } catch (e) {
      console.warn("[leads] status→training log failed:", (e as any)?.message || e);
    }

    // Auto-complete the initial "Review enquiry" task when moving off NEW_ENQUIRY
    try {
      if (prevUi === "NEW_ENQUIRY" && nextUi !== "NEW_ENQUIRY") {
        const key = `status:new-review:${id}`;
        const reviewTask = await prisma.task.findFirst({
          where: {
            tenantId,
            relatedType: "LEAD" as any,
            relatedId: id,
            status: { notIn: ["DONE", "CANCELLED"] as any },
            meta: { path: ["key"], equals: key } as any,
          },
          select: { id: true },
        });
        if (reviewTask) {
          await prisma.task.update({
            where: { id: reviewTask.id },
            data: { status: "DONE" as any, completedAt: new Date(), updatedById: actorId ?? undefined },
          });
        }
      }
    } catch (e) {
      console.warn("[leads] auto-complete review task failed:", (e as any)?.message || e);
    }
  }

  // Adjust source conversions when toggling WON on/off (optional; keep if you used this before)
  const prevWon = prevUi === "WON";
  const nextWon = nextUi === "WON";
  if (prevWon !== nextWon) {
    const source = (nextCustom.source ?? prevCustom.source ?? "Unknown").toString().trim() || "Unknown";
    const cap = existing.capturedAt instanceof Date ? existing.capturedAt : new Date(existing.capturedAt as any);
    const m = monthStartUTC(cap);
    await prisma.leadSourceCost.upsert({
      where: { tenantId_source_month: { tenantId, source, month: m } },
      update: { conversions: { increment: nextWon ? 1 : -1 } },
      create: { tenantId, source, month: m, spend: 0, leads: 0, conversions: nextWon ? 1 : 0, scalable: true },
    });
  }

  res.json({ ok: true, lead: updated });
});

/* ------------------------------------------------------------------ */
/* Read one (for modal)                                               */
/* ------------------------------------------------------------------ */

router.get("/:id", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const lead = await prisma.lead.findFirst({
    where: { id: req.params.id, tenantId },
  });
  if (!lead) return res.status(404).json({ error: "not found" });

  const fields = await prisma.leadFieldDef.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  res.json({
    lead: {
      id: lead.id,
      contactName: lead.contactName,
      email: lead.email,
      description: lead.description,
      status: (lead.custom as any)?.uiStatus || dbToUi(lead.status),
      custom: lead.custom,
    },
    fields,
  });
});

/* ------------------------------------------------------------------ */
/* Send questionnaire (email link). Does NOT create a task.           */
/* ------------------------------------------------------------------ */

router.post("/:id/request-info", async (req, res) => {
  try {
    const { tenantId, email: fromEmail } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });
    if (!lead.email) return res.status(400).json({ error: "lead has no email" });

    const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
    const ts = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const slug = ts?.slug || ("tenant-" + tenantId.slice(0, 6));
    const qUrl = `${WEB_ORIGIN}/q/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`;

    const fromHeader = fromEmail || "me";
    const subject = `More details needed – ${lead.contactName || "your enquiry"}`;
    const body =
      `Hi ${lead.contactName || ""},\n\n` +
      `To prepare an accurate quote we need a few more details.\n` +
      `Please fill in this short form: ${qUrl}\n\n` +
      `Thanks,\n${fromEmail || "CRM"}`;

    const rfc822 =
      `From: ${fromHeader}\r\n` +
      `To: ${lead.email}\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${body}\r\n`;

    const accessToken = await getAccessTokenForTenant(tenantId);
    await gmailSend(accessToken, rfc822);

    // Move to INFO_REQUESTED, but do NOT create a task now
    const prevCustom = ((lead.custom as any) || {}) as Record<string, any>;
    await prisma.lead.update({
      where: { id },
      data: {
        status: uiToDb("INFO_REQUESTED"),
        custom: { ...prevCustom, uiStatus: "INFO_REQUESTED" },
      },
    });

    // Task creation happens when questionnaire is actually submitted
    return res.json({ ok: true, url: qUrl });
  } catch (e: any) {
    console.error("[leads] request-info failed:", e);
    return res.status(500).json({ error: e?.message || "request-info failed" });
  }
});

/* ------------------------------------------------------------------ */
/* Questionnaire submit → create “Review questionnaire” task only     */
/* (keep status at INFO_REQUESTED so owner can decide next step)      */
/* ------------------------------------------------------------------ */

router.post("/:id/submit-questionnaire", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

    const answers = (req.body?.answers ?? {}) as Record<string, any>;
    const prev = (lead.custom as any) || {};
    const merged = { ...prev, ...answers, uiStatus: "INFO_REQUESTED" as UiStatus };

    await prisma.lead.update({
      where: { id },
      data: {
        status: uiToDb("INFO_REQUESTED"),
        custom: merged,
      },
    });

    const playbook = await loadTaskPlaybook(tenantId);
    const recipe = playbook.manual?.questionnaire_followup ?? null;

    await ensureTaskFromRecipe({
      tenantId,
      recipe,
      relatedId: id,
      relatedType: recipe?.relatedType ?? "QUESTIONNAIRE",
      uniqueKey: `manual:questionnaire_followup:${id}`,
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[leads] submit-questionnaire failed:", e);
    return res.status(500).json({ error: e?.message || "submit failed" });
  }
});

/* ------------------------------------------------------------------ */
/* Supplier quote request (kept — unchanged core, trimmed comments)    */
/* ------------------------------------------------------------------ */

const EXT_FROM_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/tiff": ".tif",
  "application/zip": ".zip",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.dwg": ".dwg",
  "image/vnd.dxf": ".dxf",
  "application/octet-stream": ".bin",
};
function ensureFilenameWithExt(filename: string | undefined, mimeType: string) {
  let name = (filename || "attachment").trim();
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += EXT_FROM_MIME[mimeType] || ".bin";
  return name;
}

router.post("/:id/request-supplier-quote", async (req, res) => {
  try {
    const { tenantId, email: fromEmail } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

    const { to, subject, text, fields, attachments } = (req.body ?? {}) as {
      to?: string;
      subject?: string;
      text?: string;
      fields?: Record<string, any>;
      attachments?: Array<
        | { source: "gmail"; messageId: string; attachmentId: string }
        | { source: "upload"; filename: string; mimeType: string; base64: string }
      >;
    };

    if (!to) return res.status(400).json({ error: "to is required" });

    // Build body quickly (AI formatting removed for brevity)
    const summary =
      typeof lead.custom === "object" && lead.custom && "summary" in (lead.custom as any)
        ? (lead.custom as any).summary
        : "-";

    const lines: string[] = [];
    lines.push("Lead details:");
    lines.push(`- Name: ${lead.contactName || "-"}`);
    lines.push(`- Email: ${lead.email || "-"}`);
    lines.push(`- Status: ${lead.status}`);
    lines.push(`- Summary: ${summary}`);
    if (fields && Object.keys(fields).length) {
      lines.push("");
      lines.push("Questionnaire:");
      Object.entries(fields).forEach(([k, v]) => lines.push(`- ${k}: ${v ?? "-"}`));
    }

    // Create a public supplier upload link (JWT token with limited claims)
    const ts = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const slug = ts?.slug || ("tenant-" + tenantId.slice(0, 6));
    const rfqId = randomUUID();
    const token = jwt.sign(
      { t: tenantId, l: id, e: to, r: rfqId },
      env.APP_JWT_SECRET,
      { expiresIn: "90d" }
    );
    const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
    const uploadUrl = `${WEB_ORIGIN}/sup/${encodeURIComponent(slug)}/${encodeURIComponent(token)}`;

    const sub = subject || `Quote request for ${lead.contactName || "lead"} (${lead.id.slice(0, 8)})`;
    const bodyText =
      `Hi,\n\nPlease provide a price for the following enquiry.\n\n` +
      `${lines.join("\n")}\n\nUpload your quote here: ${uploadUrl}\n\nThanks,\n${fromEmail || "CRM"}`;

    const boundary = "mixed_" + Math.random().toString(36).slice(2);
    const fromHeader = fromEmail || "me";

    const head =
      `From: ${fromHeader}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${sub}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    let mime = "";
    mime += `--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: 7bit\r\n\r\n${bodyText}\r\n`;

    const acc: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];
    const accessToken = await getAccessTokenForTenant(tenantId);
    if (Array.isArray(attachments)) {
      for (const a of attachments) {
        if ((a as any).source === "gmail") {
          const g = a as { source: "gmail"; messageId: string; attachmentId: string };
          const x = await gmailFetchAttachment(accessToken, g.messageId, g.attachmentId);
          acc.push({ filename: ensureFilenameWithExt(x.filename, x.mimeType), mimeType: x.mimeType, buffer: x.buffer });
        } else {
          const u = a as { source: "upload"; filename: string; mimeType: string; base64: string };
          acc.push({ filename: ensureFilenameWithExt(u.filename, u.mimeType), mimeType: u.mimeType, buffer: Buffer.from(u.base64, "base64") });
        }
      }
    }
    for (const f of acc) {
      const b64 = f.buffer.toString("base64").replace(/.{76}(?=.)/g, "$&\r\n");
      mime += `--${boundary}\r\nContent-Type: ${f.mimeType}; name="${f.filename}"\r\nContent-Disposition: attachment; filename="${f.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}\r\n`;
    }
    mime += `--${boundary}--\r\n`;

    await gmailSend(accessToken, head + mime);

    // Breadcrumb
    const safeCustom = ((lead.custom as any) || {}) as Record<string, any>;
    const rfqs: any[] = Array.isArray((safeCustom as any).supplierRfqs) ? (safeCustom as any).supplierRfqs : [];
    rfqs.push({ rfqId, supplierEmail: to, uploadUrl, tokenPreview: token.slice(0, 16) + "…", createdAt: new Date().toISOString() });
    await prisma.lead.update({
      where: { id },
      data: {
        custom: {
          ...safeCustom,
          lastSupplierEmailTo: to,
          lastSupplierEmailSubject: sub,
          supplierRfqs: rfqs,
        },
      },
    });

    res.json({ ok: true });
  } catch (e: any) {
    console.error("[leads] request-supplier-quote failed:", e);
    res.status(500).json({ error: e?.message || "send failed" });
  }
});

/* ------------------------------------------------------------------ */
/* Demo seed (optional)                                                */
/* ------------------------------------------------------------------ */

router.post("/seed-demo", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  await prisma.leadFieldDef.upsert({
    where: { tenantId_key: { tenantId, key: "company" } },
    update: {},
    create: { tenantId, key: "company", label: "Company", type: "text", required: false, sortOrder: 1 },
  });

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      createdById: userId,
      contactName: "Taylor Example",
      email: "taylor@example.com",
      status: "NEW",
      description: "Test enquiry details here.",
      custom: { uiStatus: "NEW_ENQUIRY" as UiStatus },
    },
  });

  const playbook = await loadTaskPlaybook(tenantId);
  const nextUi: UiStatus = "NEW_ENQUIRY";
  await handleStatusTransition({
    tenantId,
    leadId: lead.id,
    prevUi: null,
    nextUi,
    actorId: userId,
    playbook,
  });

  res.json({ ok: true, lead });
});

export default router;