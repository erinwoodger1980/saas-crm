// api/src/routes/leads.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { gmailSend, getAccessTokenForTenant, gmailFetchAttachment } from "../services/gmail";
import { env } from "../env";

const router = Router();

/* ---------------- Status mapping (UI -> legacy DB enum) ---------------- */
function uiStatusToDb(status: string): "NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED" {
  switch (status.toUpperCase()) {
    case "NEW_ENQUIRY":    return "NEW";
    case "INFO_REQUESTED": return "CONTACTED";
    case "READY_TO_QUOTE": return "QUALIFIED";
    case "REJECTED":       return "DISQUALIFIED";
    // nearest buckets for the rest
    case "QUOTE_SENT":     return "QUALIFIED";
    case "WON":            return "QUALIFIED";
    case "LOST":           return "DISQUALIFIED";
    default:               return "NEW";
  }
}

/* ------------ filename helpers (ensure extension) ------------ */
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
  const hasExt = /\.[a-z0-9]{2,5}$/i.test(name);
  if (!hasExt) {
    const ext = EXT_FROM_MIME[mimeType] || ".bin";
    name += ext;
  }
  return name;
}

/** Quick mount check (GET /leads) */
router.get("/", (_req, res) => res.json({ ok: true, where: "/leads root" }));

/** Pull tenant/user from JWT that server.ts decoded into req.auth */
function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
    userId: req.auth?.userId as string | undefined,
    email: req.auth?.email as string | undefined,
  };
}

/* -------------------- FIELD DEFINITIONS -------------------- */
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

  const {
    id,
    key,
    label,
    type = "text",
    required = false,
    config,
    sortOrder = 0,
  } = req.body;

  if (!key || !label) {
    return res.status(400).json({ error: "key and label required" });
  }

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

/* -------------------- GROUPED (Kanban / Tabs) -------------------- */
const DEFAULT_BUCKETS = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DISQUALIFIED",
  "INFO_REQUESTED",
  "REJECTED",
  "READY_TO_QUOTE",
  "QUOTE_SENT",
  "WON",
  "LOST",
] as const;

router.get("/grouped", async (req, res) => {
  const { tenantId } = getAuth(req);
  if (!tenantId) return res.status(401).json({ error: "unauthorized" });

  const rows = await prisma.lead.findMany({
    where: { tenantId },
    orderBy: [{ capturedAt: "desc" }],
  });

  const grouped: Record<(typeof DEFAULT_BUCKETS)[number], any[]> = Object.fromEntries(
    DEFAULT_BUCKETS.map((s) => [s, []])
  ) as any;

  for (const l of rows) {
    const s = (l.status as (typeof DEFAULT_BUCKETS)[number]) || "NEW";
    if (grouped[s]) grouped[s].push(l);
    else grouped.NEW.push(l);
  }

  res.json(grouped);
});

/* ------------------------- LEADS CRUD ------------------------- */
/** Create lead (supports manual description) */
router.post("/", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  const {
    contactName,
    email,
    status,                 // UI status like NEW_ENQUIRY / INFO_REQUESTED / …
    custom = {},
    nextAction,
    nextActionAt,
    description,            // ← NEW: free text when not from an email
  } = req.body || {};

  if (!contactName) return res.status(400).json({ error: "contactName required" });

  try {
    const uiStatus = (status as string | undefined) || "NEW_ENQUIRY";
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        createdById: userId,
        contactName: String(contactName),
        email: email ?? "",
        status: uiStatusToDb(uiStatus),
        nextAction: nextAction ?? null,
        nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
        description: description ?? null,            // ← NEW
        custom: { ...(custom ?? {}), uiStatus },
      },
    });
    res.json(lead);
  } catch (e: any) {
    console.error("[leads POST] failed:", e?.message || e);
    res.status(400).json({ error: e?.message || "create failed" });
  }
});

/** PATCH /leads/:id — partial update (merges custom, supports description) */
router.patch("/:id", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({ error: "not found" });
    }

    const allowedStatuses = DEFAULT_BUCKETS;

    const {
      contactName,
      email,
      status,
      nextAction,
      nextActionAt,
      custom,
      description, // ← NEW
    } = (req.body ?? {}) as Record<string, unknown>;

    const data: any = {};

    if (contactName !== undefined) data.contactName = String(contactName);
    if (email !== undefined) data.email = email === null || email === "" ? null : String(email);

    if (status !== undefined) {
      const s = String(status).toUpperCase();
      if (!allowedStatuses.includes(s as any)) {
        return res.status(400).json({ error: `invalid status "${status}"` });
      }
      data.status = uiStatusToDb(s);
      const prevCustom = (existing.custom as Record<string, any>) || {};
      data.custom = { ...prevCustom, uiStatus: s };
    }

    if (nextAction !== undefined) {
      data.nextAction = nextAction === null || nextAction === "" ? null : String(nextAction);
    }

    if (nextActionAt !== undefined) {
      if (nextActionAt === null || nextActionAt === "") {
        data.nextActionAt = null;
      } else {
        const d = new Date(nextActionAt as any);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "invalid nextActionAt" });
        data.nextActionAt = d;
      }
    }

    if (description !== undefined) {
      data.description = description === "" ? null : String(description); // ← NEW
    }

    if (custom !== undefined) {
      const prev = (existing.custom as Record<string, any>) || {};
      const patch = (custom as Record<string, any>) || {};
      data.custom = { ...prev, ...patch };
    }

    const updated = await prisma.lead.update({ where: { id }, data });
    return res.json({ ok: true, lead: updated });
  } catch (err: any) {
    console.error("[leads PATCH] failed:", err);
    return res.status(500).json({ error: "update failed" });
  }
});

/* ---------------- REQUEST: supplier quote (AI + attachments) ---------------- */
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

    const sub = subject || `Quote request for ${lead.contactName || "lead"} (${lead.id.slice(0, 8)})`;

    // Build summary lines
    const lines: string[] = [];
    lines.push("Lead details:");
    lines.push(`- Name: ${lead.contactName || "-"}`);
    lines.push(`- Email: ${lead.email || "-"}`);
    lines.push(`- Status: ${lead.status}`);
    const summary =
      typeof lead.custom === "object" && lead.custom && "summary" in (lead.custom as any)
        ? (lead.custom as any).summary
        : "-";
    lines.push(`- Summary: ${summary}`);
    lines.push("");

    if (fields && typeof fields === "object") {
      lines.push("Questionnaire:");
      Object.entries(fields).forEach(([k, v]) => lines.push(`- ${k}: ${v ?? "-"}`));
      lines.push("");
    }

    if (text) {
      lines.push("Notes:");
      lines.push(text);
      lines.push("");
    }

    /* -------- AI formatting (optional) -------- */
    let finalSubject = sub;
    let finalBody: string | null = null;

    if (env.OPENAI_API_KEY) {
      try {
        const originalBody =
          typeof lead.custom === "object" && lead.custom && (lead.custom as any).full
            ? String((lead.custom as any).full)
            : (typeof lead.custom === "object" && lead.custom && (lead.custom as any).body
                ? String((lead.custom as any).body)
                : "");

        const aiPrompt = `
You are drafting a clean, professional supplier quote request email.
Write a concise subject (<= 80 chars) and a tidy plain-text body.

LEAD:
- Name: ${lead.contactName || "-"}
- Email: ${lead.email || "-"}
- Status: ${lead.status}

SUMMARY: ${summary || "-"}

QUESTIONNAIRE (key: value):
${Object.entries(fields || {}).map(([k,v]) => `- ${k}: ${v ?? "-"}`).join("\n") || "(none)"}

ORIGINAL EMAIL (for context, plain text):
${originalBody || "(not available)"}

ADDITIONAL NOTES FROM USER:
${(text || "").trim() || "(none)"}

Return JSON with keys: subject, body. Keep body plain text.
`;

        const resp = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            input: aiPrompt,
            response_format: { type: "json_object" },
          }),
        });

        const json = await resp.json();
        const textOut =
          json?.output_text ||
          json?.choices?.[0]?.message?.content ||
          json?.choices?.[0]?.output_text ||
          "";

        try {
          const parsed = JSON.parse(String(textOut));
          if (parsed?.subject) finalSubject = String(parsed.subject);
          if (parsed?.body) finalBody = String(parsed.body);
        } catch {
          // fallback to manual template
        }
      } catch (e) {
        console.warn("AI formatting skipped:", e);
      }
    }

    const subToUse = finalSubject;
    const bodyText =
      finalBody ??
      `Hi,

Please provide a quote for the following enquiry.

${lines.join("\n")}

Thanks,
${fromEmail || "CRM"}
`;

    /* -------- Gather attachments -------- */
    const acc: Array<{ filename: string; mimeType: string; buffer: Buffer }> = [];
    const accessToken = await getAccessTokenForTenant(tenantId);

    if (Array.isArray(attachments)) {
      for (const a of attachments) {
        if ((a as any).source === "gmail") {
          const g = a as { source: "gmail"; messageId: string; attachmentId: string };
          const { buffer, filename, mimeType } = await gmailFetchAttachment(
            accessToken,
            g.messageId,
            g.attachmentId
          );
          const safeName = ensureFilenameWithExt(filename, mimeType);
          acc.push({ filename: safeName, mimeType, buffer });
        } else if ((a as any).source === "upload") {
          const u = a as { source: "upload"; filename: string; mimeType: string; base64: string };
          const buffer = Buffer.from(u.base64, "base64");
          const safeName = ensureFilenameWithExt(u.filename, u.mimeType);
          acc.push({ filename: safeName, mimeType: u.mimeType, buffer });
        }
      }
    }

    /* -------- Build multipart RFC-822 -------- */
    const boundary = "mixed_" + Math.random().toString(36).slice(2);
    const fromHeader = fromEmail || "me";

    const head =
      `From: ${fromHeader}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${subToUse}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    let mime = "";
    // Text part
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: text/plain; charset="UTF-8"\r\n`;
    mime += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    mime += `${bodyText}\r\n`;

    // Attachments
    for (const file of acc) {
      const b64 = file.buffer.toString("base64").replace(/.{76}(?=.)/g, "$&\r\n");
      mime += `--${boundary}\r\n`;
      mime += `Content-Type: ${file.mimeType}; name="${file.filename}"\r\n`;
      mime += `Content-Disposition: attachment; filename="${file.filename}"\r\n`;
      mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
      mime += `${b64}\r\n`;
    }
    mime += `--${boundary}--\r\n`;

    // Send via Gmail
    const sent = await gmailSend(accessToken, head + mime);

    // Save breadcrumb
    const safeCustom =
      typeof lead.custom === "object" && lead.custom !== null ? (lead.custom as any) : {};
    await prisma.lead.update({
      where: { id },
      data: {
        nextAction: "Await supplier quote",
        nextActionAt: new Date(),
        custom: {
          ...safeCustom,
          lastSupplierEmailTo: to,
          lastSupplierEmailSubject: subToUse,
          lastSupplierFields: fields || null,
          lastSupplierAttachmentCount: acc.length,
        },
      },
    });

    return res.json({ ok: true, sent });
  } catch (e: any) {
    console.error("[leads] request-supplier-quote failed:", e);
    return res.status(500).json({ error: e?.message || "send failed" });
  }
});

/* ------------------------ READ ONE (modal) ------------------------ */
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

  res.json({ lead, fields });
});

/* ------------------------ Request more info ------------------------ */
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

    const already = typeof lead.custom === "object" && lead.custom ? (lead.custom as any) : {};
    const importantKeys = Object.keys(already).filter((k) =>
      !["provider","messageId","subject","from","summary","full","body","date","uiStatus"].includes(k)
    );

    const accessToken = await getAccessTokenForTenant(tenantId);
    const fromHeader = fromEmail || "me";
    const subject = `More details needed – ${lead.contactName || "your enquiry"}`;
    const body = `Hi ${lead.contactName || ""},

Thanks for your enquiry. To prepare an accurate quote we need a few more details.
Please fill in (or confirm) this short form: ${qUrl}

We’ll auto-fill anything you already provided:
${importantKeys.length ? importantKeys.map((k) => `- ${k}: ${already[k] ?? "-"}`).join("\n") : "- (no fields captured yet)"}

Thanks,
${fromEmail || "CRM"}`;

    const rfc822 =
      `From: ${fromHeader}\r\n` +
      `To: ${lead.email}\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${body}\r\n`;

    await gmailSend(accessToken, rfc822);

    await prisma.lead.update({
      where: { id },
      data: {
        status: uiStatusToDb("INFO_REQUESTED"),
        custom: { ...already, uiStatus: "INFO_REQUESTED" },
        nextAction: "Await questionnaire",
        nextActionAt: new Date(),
      },
    });

    await prisma.leadTrainingExample.create({
      data: {
        tenantId,
        provider: already.provider || "gmail",
        messageId: already.messageId || "",
        label: "needs_more_info",
        extracted: { subject: already.subject ?? null, summary: already.summary ?? null } as any,
      },
    });

    return res.json({ ok: true, url: qUrl });
  } catch (e: any) {
    console.error("[leads] request-info failed:", e);
    return res.status(500).json({ error: e?.message || "request-info failed" });
  }
});

/* ------------------------ Questionnaire submit ------------------------ */
router.post("/:id/submit-questionnaire", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const id = String(req.params.id);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.tenantId !== tenantId) return res.status(404).json({ error: "not found" });

    const answers = (req.body?.answers ?? {}) as Record<string, any>;

    const prev = typeof lead.custom === "object" && lead.custom ? (lead.custom as any) : {};
    const merged = { ...prev, ...answers, uiStatus: "READY_TO_QUOTE" };

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: uiStatusToDb("READY_TO_QUOTE"),
        custom: merged,
        nextAction: "Prepare quote",
        nextActionAt: new Date(),
      },
    });

    await prisma.leadTrainingExample.create({
      data: {
        tenantId,
        provider: prev.provider || "gmail",
        messageId: prev.messageId || "",
        label: "ready_to_quote",
        extracted: { answers },
      },
    });

    return res.json({ ok: true, lead: updated });
  } catch (e: any) {
    console.error("[leads] submit-questionnaire failed:", e);
    return res.status(500).json({ error: e?.message || "submit failed" });
  }
});

/* ------------------------ AI feedback (training) ------------------------ */
router.post("/ai/feedback", async (req, res) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

    const { provider = "gmail", messageId = "", leadId, isLead, snapshot } = req.body || {};
    if (!leadId || typeof isLead !== "boolean") {
      return res.status(400).json({ error: "leadId and isLead required" });
    }

    // 🔎 Pull source from the lead’s custom fields to teach the model
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const custom = (lead?.custom as any) || {};
    const source = typeof custom.source === "string" ? custom.source : (snapshot?.source || null);

    await prisma.leadTrainingExample.create({
      data: {
        tenantId,
        provider,
        messageId: messageId || "",
        label: isLead ? "lead" : "not_lead",
        extracted: {
          ...(snapshot || {}),
          source: source || null,
          statusAtTime: lead?.status || null,
        } as any,
      },
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[leads] ai/feedback failed:", e);
    return res.status(500).json({ error: e?.message || "feedback failed" });
  }
});


/* ------------------------ DEMO SEED (optional) ------------------------ */
router.post("/seed-demo", async (req, res) => {
  const { tenantId, userId } = getAuth(req);
  if (!tenantId || !userId) return res.status(401).json({ error: "unauthorized" });

  await prisma.leadFieldDef.upsert({
    where: { tenantId_key: { tenantId, key: "company" } },
    update: {},
    create: { tenantId, key: "company", label: "Company", type: "text", required: false, sortOrder: 1 },
  });
  await prisma.leadFieldDef.upsert({
    where: { tenantId_key: { tenantId, key: "phone" } },
    update: {},
    create: { tenantId, key: "phone", label: "Phone", type: "text", required: false, sortOrder: 2 },
  });

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      createdById: userId,
      contactName: "Taylor Example",
      email: "taylor@example.com",
      status: "NEW",
      nextAction: "Intro call",
      nextActionAt: new Date(),
      custom: { company: "Acme Co", phone: "+1 555 0100", uiStatus: "NEW_ENQUIRY" },
    },
  });

  res.json({ ok: true, lead });
});

export default router;