// api/src/routes/followups.ts
import { Router } from "express";
import type { LeadStatus, Prisma } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { FOLLOWUPS_ENABLED } from "../lib/followups-feature";

dayjs.extend(utc);
dayjs.extend(timezone);

type BusinessWindow = { startMinutes: number; endMinutes: number };

type LeadRow = {
  id: string;
  status: LeadStatus;
  capturedAt: Date;
  custom: Prisma.JsonValue | null;
};

type TemplateRow = {
  id: string;
  key: string;
  variant: string;
  delayDays: number;
};

const DEFAULT_DELAY_DAYS = Number.isFinite(Number(process.env.FOLLOWUPS_DEFAULT_DELAY_DAYS))
  ? Number(process.env.FOLLOWUPS_DEFAULT_DELAY_DAYS)
  : 2;
const BUSINESS_TZ = process.env.FOLLOWUPS_LOCAL_TZ || "Europe/London";
const BUSINESS_WINDOWS = parseBusinessHours(process.env.FOLLOWUPS_BUSINESS_HOURS || "09:00-17:00");

if (BUSINESS_WINDOWS.length === 0) {
  BUSINESS_WINDOWS.push({ startMinutes: 9 * 60, endMinutes: 17 * 60 });
}

const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wwAAn8B9gWf3gAAAABJRU5ErkJggg==",
  "base64",
);

const router = Router();

router.get("/pixel/:token", async (req, res) => {
  if (!FOLLOWUPS_ENABLED) {
    return res.status(404).end();
  }

  const { token } = req.params;

  if (token) {
    try {
      await prisma.followUpEvent.updateMany({
        where: { pixelToken: token, openedAt: null },
        data: { openedAt: new Date() },
      });
    } catch (err: any) {
      console.error("[followups:pixel]", err?.message || err);
    }
  }

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  return res.send(TRANSPARENT_PIXEL);
});

router.use(requireAuth);

router.get("/summary", async (req, res) => {
  if (!FOLLOWUPS_ENABLED) {
    return res.status(403).json({ error: "followups_disabled" });
  }

  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const rawDays = Number(req.query.days);
    const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(90, Math.floor(rawDays))) : 28;
    const since = dayjs().subtract(days, "day").toDate();

    const logs = await prisma.followUpLog.findMany({
      where: {
        tenantId,
        sentAt: { gte: since },
      },
      select: {
        variant: true,
        opened: true,
        replied: true,
        converted: true,
        delayDays: true,
      },
    });

    const totalSent = logs.length;
    const totalOpened = logs.filter((log) => log.opened === true).length;
    const totalReplied = logs.filter((log) => log.replied === true).length;
    const totalConverted = logs.filter((log) => log.converted === true).length;

    const variants = new Map<
      string,
      {
        label: string;
        sent: number;
        opened: number;
        replied: number;
        converted: number;
      }
    >();

    const delayRows = new Map<
      number | "__none__",
      { sent: number; opened: number; replied: number; converted: number }
    >();

    for (const log of logs) {
      const variantKey = (log.variant || "").trim() || "Unknown";
      const normalizedVariant = variantKey.toUpperCase();
      const existingVariant = variants.get(normalizedVariant) || {
        label: variantKey,
        sent: 0,
        opened: 0,
        replied: 0,
        converted: 0,
      };
      existingVariant.sent += 1;
      if (log.opened) existingVariant.opened += 1;
      if (log.replied) existingVariant.replied += 1;
      if (log.converted) existingVariant.converted += 1;
      variants.set(normalizedVariant, existingVariant);

      const delayKey = typeof log.delayDays === "number" && Number.isFinite(log.delayDays)
        ? log.delayDays
        : "__none__";
      const existingDelay = delayRows.get(delayKey) || { sent: 0, opened: 0, replied: 0, converted: 0 };
      existingDelay.sent += 1;
      if (log.opened) existingDelay.opened += 1;
      if (log.replied) existingDelay.replied += 1;
      if (log.converted) existingDelay.converted += 1;
      delayRows.set(delayKey, existingDelay);
    }

    const computeRate = (numerator: number, denominator: number) =>
      denominator > 0 ? numerator / denominator : null;

    const variantStats = Array.from(variants.entries()).map(([key, data]) => ({
      key,
      label: data.label,
      sent: data.sent,
      openRate: computeRate(data.opened, data.sent),
      replyRate: computeRate(data.replied, data.sent),
      conversionRate: computeRate(data.converted, data.sent),
    }));

    variantStats.sort((a, b) => a.label.localeCompare(b.label));

    let winner: string | null = null;
    let bestRate = -1;
    for (const variant of variantStats) {
      if (variant.conversionRate == null) continue;
      if (variant.conversionRate > bestRate) {
        bestRate = variant.conversionRate;
        winner = variant.key;
      }
    }

    const delayStats = Array.from(delayRows.entries())
      .map(([key, data]) => ({
        delayDays: key === "__none__" ? null : (key as number),
        sent: data.sent,
        openRate: computeRate(data.opened, data.sent),
        replyRate: computeRate(data.replied, data.sent),
        conversionRate: computeRate(data.converted, data.sent),
      }))
      .sort((a, b) => {
        if (a.delayDays == null && b.delayDays == null) return 0;
        if (a.delayDays == null) return 1;
        if (b.delayDays == null) return -1;
        return a.delayDays - b.delayDays;
      });

    return res.json({
      ok: true,
      days,
      totals: {
        sent: totalSent,
        openRate: computeRate(totalOpened, totalSent),
        replyRate: computeRate(totalReplied, totalSent),
        conversionRate: computeRate(totalConverted, totalSent),
      },
      variants: variantStats,
      winner,
      rows: delayStats,
    });
  } catch (err) {
    console.error("[followups:summary]", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

router.post("/schedule", async (req, res) => {
  if (!FOLLOWUPS_ENABLED) {
    return res.status(403).json({ error: "followups_disabled" });
  }

  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const delayDays = sanitizeDelayDays(process.env.FOLLOWUPS_DEFAULT_DELAY_DAYS, DEFAULT_DELAY_DAYS);
    const now = dayjs();
    const thresholdDate = now.subtract(delayDays, "day").toDate();
    const sevenDaysAgo = now.subtract(7, "day").toDate();

    const templates = await prisma.followUpTemplate.findMany({
      where: {
        tenantId,
        isActive: true,
        delayDays,
      },
      select: {
        id: true,
        key: true,
        variant: true,
        delayDays: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!templates.length) {
      return res.json({
        ok: true,
        scheduled: 0,
        processed: 0,
        reason: "no_active_templates_for_delay",
      });
    }

    const templateByVariant = new Map<string, TemplateRow>();
    for (const tpl of templates) {
      templateByVariant.set(normalizeVariant(tpl.variant), tpl);
      templateByVariant.set(normalizeVariant(tpl.key), tpl);
    }

    const candidateLeads = await prisma.lead.findMany({
      where: {
        tenantId,
        OR: [
          { custom: { path: ["uiStatus"], equals: "NEW_ENQUIRY" } },
          { custom: { path: ["uiStatus"], equals: "new_enquiry" } },
          { custom: { path: ["uiStatus"], equals: "ENQUIRY" } },
          { custom: { path: ["uiStatus"], equals: "enquiry" } },
          { custom: { path: ["uiStatus"], equals: "READY_TO_QUOTE" } },
          { custom: { path: ["uiStatus"], equals: "ready_to_quote" } },
          { status: { in: ["NEW", "READY_TO_QUOTE"] as LeadStatus[] } },
        ],
      },
      select: {
        id: true,
        status: true,
        capturedAt: true,
        custom: true,
      },
    });

    if (!candidateLeads.length) {
      return res.json({
        ok: true,
        scheduled: 0,
        processed: 0,
        reason: "no_candidate_leads",
      });
    }

    const leadIds = candidateLeads.map((lead) => lead.id);

    const inboundMessages = await prisma.emailMessage.findMany({
      where: {
        tenantId,
        leadId: { in: leadIds },
        direction: "inbound",
      },
      select: { leadId: true, sentAt: true },
      orderBy: { sentAt: "desc" },
    });

    const inboundByLead = new Map<string, Date>();
    for (const msg of inboundMessages) {
      const leadId = msg.leadId;
      if (!leadId) continue;
      if (!inboundByLead.has(leadId)) {
        inboundByLead.set(leadId, msg.sentAt);
      }
    }

    const recentEvents = await prisma.followUpEvent.findMany({
      where: {
        tenantId,
        leadId: { in: leadIds },
        scheduledAt: { gte: sevenDaysAgo },
      },
      select: { leadId: true, variant: true, templateKey: true },
    });

    const recentLogs = await prisma.followUpLog.findMany({
      where: {
        tenantId,
        leadId: { in: leadIds },
        sentAt: { gte: sevenDaysAgo },
      },
      select: { leadId: true, variant: true },
    });

    const seenVariant = new Set<string>();
    const seenTemplate = new Set<string>();
    for (const e of recentEvents) {
      seenVariant.add(`${e.leadId}:${normalizeVariant(e.variant)}`);
      seenTemplate.add(`${e.leadId}:${e.templateKey}`);
    }
    for (const log of recentLogs) {
      seenVariant.add(`${log.leadId}:${normalizeVariant(log.variant)}`);
    }

    const createdEvents: string[] = [];
    const skipped: Array<{ leadId: string; reason: string }> = [];

    for (const lead of candidateLeads) {
      const uiStatus = getUiStatus(lead);
      if (uiStatus !== "enquiry" && uiStatus !== "ready_to_quote") {
        skipped.push({ leadId: lead.id, reason: "status_mismatch" });
        continue;
      }

      const variant = assignVariant(lead.id);
      const variantKey = normalizeVariant(variant);
      const template = findTemplateForVariant(variantKey, templates, templateByVariant);
      if (!template) {
        skipped.push({ leadId: lead.id, reason: "no_template_for_variant" });
        continue;
      }

      const duplicateKey = `${lead.id}:${variantKey}`;
      if (seenVariant.has(duplicateKey) || seenTemplate.has(`${lead.id}:${template.key}`)) {
        skipped.push({ leadId: lead.id, reason: "duplicate_recent_followup" });
        continue;
      }

      const lastInbound = inboundByLead.get(lead.id) ?? null;
      const lastStatusChange = extractLastStatusChange(lead.custom);

      let lastActivity = lead.capturedAt;
      if (lastInbound && lastInbound > lastActivity) lastActivity = lastInbound;
      if (lastStatusChange && lastStatusChange > lastActivity) lastActivity = lastStatusChange;

      if (lastActivity > thresholdDate) {
        skipped.push({ leadId: lead.id, reason: "within_delay_window" });
        continue;
      }

      const scheduledAt = nextBusinessSlot(new Date(), BUSINESS_WINDOWS, BUSINESS_TZ);
      const meta: Prisma.JsonObject = {
        triggeredAt: new Date().toISOString(),
        triggeredBy: req.auth?.userId ?? null,
        lastInboundAt: lastInbound ? lastInbound.toISOString() : null,
        lastStatusChangeAt: lastStatusChange ? lastStatusChange.toISOString() : null,
        delayDays: template.delayDays,
        variantAssigned: variantKey,
        defaultDelayDays: delayDays,
      };

      const event = await prisma.followUpEvent.create({
        data: {
          tenantId,
          leadId: lead.id,
          variant: variantKey,
          templateKey: template.key,
          scheduledAt,
          source: "auto_schedule",
          meta,
        },
        select: { id: true },
      });

      createdEvents.push(event.id);
      seenVariant.add(duplicateKey);
      seenTemplate.add(`${lead.id}:${template.key}`);
    }

    return res.json({
      ok: true,
      scheduled: createdEvents.length,
      processed: candidateLeads.length,
      createdEventIds: createdEvents,
      skipped,
    });
  } catch (err: any) {
    console.error("[followups:schedule]", err?.message || err);
    return res.status(500).json({ error: "failed_to_schedule_followups" });
  }
});

export default router;

function sanitizeDelayDays(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}

function parseBusinessHours(raw: string): BusinessWindow[] {
  const parts = raw
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const windows: BusinessWindow[] = [];
  for (const part of parts) {
    const [startRaw, endRaw] = part.split("-").map((p) => p.trim());
    const start = parseTimeToMinutes(startRaw);
    const end = parseTimeToMinutes(endRaw);
    if (start === null || end === null) continue;
    if (end <= start) continue;
    windows.push({ startMinutes: start, endMinutes: end });
  }

  windows.sort((a, b) => a.startMinutes - b.startMinutes);
  return windows;
}

function parseTimeToMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function nextBusinessSlot(reference: Date, windows: BusinessWindow[], tz: string): Date {
  let local = dayjs(reference).tz(tz);
  if (local.second() !== 0 || local.millisecond() !== 0) {
    local = local.add(1, "minute").startOf("minute");
  } else {
    local = local.startOf("minute");
  }

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const dayBase = local.add(dayOffset, "day").startOf("day");
    for (const window of windows) {
      const windowStart = dayBase.add(window.startMinutes, "minute");
      const windowEnd = dayBase.add(window.endMinutes, "minute");

      if (dayOffset === 0) {
        if (local.isAfter(windowEnd.subtract(1, "minute"))) {
          continue;
        }
        const candidate = local.isAfter(windowStart) ? local : windowStart;
        if (candidate.isBefore(windowEnd)) {
          return candidate.toDate();
        }
      } else {
        return windowStart.toDate();
      }
    }
  }

  return local.toDate();
}

function assignVariant(leadId: string): "A" | "B" {
  const hashed = hashString(leadId);
  return hashed % 2 ? "A" : "B";
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return Math.abs(hash);
}

function normalizeVariant(raw: string | null | undefined): string {
  return raw ? String(raw).trim().toUpperCase() : "";
}

function findTemplateForVariant(
  variant: string,
  templates: TemplateRow[],
  byVariant: Map<string, TemplateRow>,
): TemplateRow | undefined {
  if (byVariant.has(variant)) return byVariant.get(variant);
  return templates.find((tpl) => {
    const variantNorm = normalizeVariant(tpl.variant);
    const keyNorm = normalizeVariant(tpl.key);
    return variantNorm.endsWith(variant) || keyNorm.endsWith(variant);
  });
}

function getUiStatus(lead: LeadRow): string | null {
  const custom = asPlainObject(lead.custom);
  const raw = custom.uiStatus;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().toLowerCase();
  }

  const fallbackMap: Record<LeadStatus, string> = {
    NEW: "enquiry",
    CONTACTED: "info_requested",
    QUALIFIED: "ready_to_quote",
    DISQUALIFIED: "disqualified",
    INFO_REQUESTED: "info_requested",
    REJECTED: "rejected",
    READY_TO_QUOTE: "ready_to_quote",
    QUOTE_SENT: "quote_sent",
    WON: "won",
    LOST: "lost",
  };

  return fallbackMap[lead.status] ?? null;
}

function asPlainObject(value: Prisma.JsonValue | null): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function extractLastStatusChange(customValue: Prisma.JsonValue | null): Date | null {
  const custom = asPlainObject(customValue);
  const candidates: Date[] = [];

  const directKeys = [
    "statusChangedAt",
    "statusUpdatedAt",
    "uiStatusChangedAt",
    "uiStatusUpdatedAt",
    "lastStatusChangeAt",
  ];

  for (const key of directKeys) {
    const parsed = parseDate(custom[key]);
    if (parsed) candidates.push(parsed);
  }

  const historyArrays = [custom.statusHistory, custom.statusTimeline, custom.timeline];
  for (const arr of historyArrays) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (!entry || typeof entry !== "object") continue;
      const parsed =
        parseDate((entry as any).at) ||
        parseDate((entry as any).changedAt) ||
        parseDate((entry as any).updatedAt) ||
        parseDate((entry as any).timestamp) ||
        parseDate((entry as any).date);
      if (parsed) candidates.push(parsed);
    }
  }

  if (!candidates.length) return null;
  return candidates.reduce((latest, current) => (current > latest ? current : latest));
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = dayjs(value);
    if (parsed.isValid()) return parsed.toDate();
  }
  return null;
}

export { router as followupsRouter };
