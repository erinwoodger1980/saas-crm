import { Router } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { env } from "../env";
import {
  computeFollowupInsights,
  selectVariantFromInsights,
  buildLearningSummary,
} from "../services/followup-learning";

const DAY_MS = 24 * 60 * 60 * 1000;

const router = Router();

function getAuth(req: any) {
  return {
    tenantId: req.auth?.tenantId as string | undefined,
  };
}

function toPlainObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return { ...value };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...parsed };
      }
    } catch {
      // ignore parse errors
    }
  }
  return {};
}

/**
 * POST /ai/followup/suggest
 * Body: { leadId, status, history, context }
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

    const insights = await computeFollowupInsights(prisma);

    const last = await prisma.followUpLog.findFirst({
      where: { tenantId, leadId: lead.id, channel: "email" },
      orderBy: { sentAt: "desc" },
    });

    const nextVariant = selectVariantFromInsights(insights, last?.variant);
    const suggestionId = randomUUID();

    const variantStats = insights.variants.find((v) => v.variant === nextVariant);
    const defaultDelayDays = Math.max(1, Math.round(variantStats?.avgDelayDays ?? 3));
    const callDelayDefault = Math.max(
      1,
      Math.round(
        insights.call.avgDelayDays ?? (defaultDelayDays > 1 ? defaultDelayDays - 1 : 2),
      ),
    );

    const fallbackSubject = `Quick follow-up on your quote`;
    const fallbackBody =
      `Hi ${lead.contactName || "there"},\n\n` +
      `Just checking whether the quote we sent over answered everything you needed. ` +
      `If anything is unclear, I can tweak the spec or pricing.\n\n` +
      `Would you like me to put a provisional slot in the diary?\n\nThanks,\n${context?.brand || "Sales"}`;
    const fallbackCallReason = "Check the quote landed and invite any questions.";
    const fallbackCallScript =
      `Hi ${lead.contactName || "there"}, it’s ${context?.ownerFirstName || context?.brand || "our team"} ` +
      `following up on the quote we emailed. I wanted to see if anything needs clarifying or if you’d like to walk through the ` +
      `spec together.`;

    const callDelayDays = callDelayDefault;
    const scheduledForISO = new Date(Date.now() + callDelayDays * DAY_MS).toISOString();

    let rationale =
      variantStats && variantStats.sampleSize
        ? `Variant ${nextVariant} has the strongest conversion lift across recent sends.`
        : "We’ll keep things warm with a helpful tone and clear next step.";

    const suggestion: any = {
      suggestionId,
      variant: nextVariant,
      subject: fallbackSubject,
      body: fallbackBody,
      delayDays: defaultDelayDays,
      plan: {
        email: {
          variant: nextVariant,
          subject: fallbackSubject,
          body: fallbackBody,
          delayDays: defaultDelayDays,
        },
        phoneCall: {
          callDelayDays,
          scheduledForISO,
          script: fallbackCallScript,
          reason: fallbackCallReason,
          confidence: insights.call.sampleSize ? "learned" : "baseline",
        },
      },
      learning: {
        summary: buildLearningSummary(insights),
        sampleSize: insights.totalSamples,
        variants: insights.variants.map((v) => ({
          variant: v.variant,
          sampleSize: v.sampleSize,
          replyRate: v.replyRate,
          conversionRate: v.conversionRate,
          avgDelayDays: v.avgDelayDays,
          successScore: v.successScore,
          lastSentAtISO: v.lastSentAt ? v.lastSentAt.toISOString() : null,
        })),
        call: {
          sampleSize: insights.call.sampleSize,
          avgDelayDays: insights.call.avgDelayDays,
          conversionRate: insights.call.conversionRate,
        },
        lastUpdatedISO: insights.lastUpdatedAt ? insights.lastUpdatedAt.toISOString() : null,
      },
    };

    const promptContext = {
      lead: {
        name: lead.contactName || null,
        email: lead.email || null,
      },
      status: status || lead.status,
      history,
      brand: context?.brand || null,
      insights: suggestion.learning,
    };

    if (env.OPENAI_API_KEY) {
      try {
        const input = `You are a considerate UK sales assistant following up after a bespoke joinery quote.\n` +
          `Return JSON with keys: email, phoneCall, rationale.\n` +
          `email: { subject: string, body: string, delayDays: number }\n` +
          `phoneCall: { callDelayDays: number, script: string, reason: string }\n` +
          `Tone warm, trustworthy, concise. Avoid emojis.\n` +
          `Global insight: ${suggestion.learning.summary}\n` +
          `Suggested call delay baseline (days): ${callDelayDays}.\n` +
          `LEAD CONTEXT: ${JSON.stringify(promptContext)}\n` +
          `Variant to craft: ${nextVariant}. Keep variants distinct but on-brand.`;

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

        if (r.ok) {
          const j: any = await r.json();
          const text =
            j?.output_text || j?.choices?.[0]?.message?.content || j?.choices?.[0]?.output_text || "{}";
          const parsed = JSON.parse(String(text));

          const parsedEmail = parsed?.email ?? parsed;
          if (parsedEmail) {
            if (typeof parsedEmail.subject === "string") {
              suggestion.subject = parsedEmail.subject;
              suggestion.plan.email.subject = parsedEmail.subject;
            }
            if (typeof parsedEmail.body === "string") {
              suggestion.body = parsedEmail.body;
              suggestion.plan.email.body = parsedEmail.body;
            }
            if (typeof parsedEmail.delayDays === "number" && Number.isFinite(parsedEmail.delayDays)) {
              const d = Math.max(1, Math.round(parsedEmail.delayDays));
              suggestion.delayDays = d;
              suggestion.plan.email.delayDays = d;
            }
          }

          const parsedCall = parsed?.phoneCall ?? parsed?.call;
          if (parsedCall) {
            if (typeof parsedCall.script === "string") {
              suggestion.plan.phoneCall.script = parsedCall.script;
            }
            if (typeof parsedCall.reason === "string") {
              suggestion.plan.phoneCall.reason = parsedCall.reason;
            }
            if (
              typeof parsedCall.callDelayDays === "number" &&
              Number.isFinite(parsedCall.callDelayDays)
            ) {
              const cd = Math.max(1, Math.round(parsedCall.callDelayDays));
              suggestion.plan.phoneCall.callDelayDays = cd;
              suggestion.plan.phoneCall.scheduledForISO = new Date(
                Date.now() + cd * DAY_MS,
              ).toISOString();
            }
          }

          if (typeof parsed?.rationale === "string") {
            rationale = parsed.rationale;
          }
        } else {
          console.warn(
            "[/ai/followup/suggest] OpenAI responses API failed:",
            r.status,
            await r.text().catch(() => ""),
          );
        }
      } catch (e) {
        console.warn("[/ai/followup/suggest] OpenAI parse failed", e);
      }
    }

    suggestion.rationale = rationale;
    return res.json(suggestion);
  } catch (e: any) {
    console.error("[/ai/followup/suggest] failed:", e);
    return res.status(500).json({ error: e?.message || "suggest failed" });
  }
});

/**
 * POST /ai/followup/feedback
 * Body: { leadId, logId?, suggestionId?, channel?, variant?, opened, replied, converted, delayDays }
 */
router.post("/followup/feedback", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const { leadId, logId, suggestionId, channel, variant, opened, replied, converted, delayDays } =
      req.body || {};

    const lead = await prisma.lead.findUnique({ where: { id: String(leadId) } });
    if (!lead || lead.tenantId !== tenantId) {
      return res.status(404).json({ error: "lead not found" });
    }

    const updates: any = {
      opened: opened ?? null,
      replied: replied ?? null,
      converted: converted ?? null,
    };

    if (typeof delayDays === "number" && Number.isFinite(delayDays)) {
      updates.delayDays = delayDays;
    }

    if (logId) {
      const log = await prisma.followUpLog.findUnique({ where: { id: String(logId) } });
      if (!log || log.tenantId !== tenantId) {
        return res.status(404).json({ error: "follow-up log not found" });
      }
      const nextMeta = suggestionId
        ? { ...(toPlainObject(log.metadata)), suggestionId }
        : toPlainObject(log.metadata);
      await prisma.followUpLog.update({
        where: { id: log.id },
        data: {
          ...updates,
          metadata: Object.keys(nextMeta).length ? nextMeta : undefined,
        },
      });
    } else {
      await prisma.followUpLog.create({
        data: {
          tenantId,
          leadId: lead.id,
          variant: String(variant || "A"),
          subject: "(feedback-only)",
          body: "",
          channel: String(channel || "email"),
          metadata: suggestionId ? { suggestionId } : undefined,
          ...updates,
        },
      });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[/ai/followup/feedback] failed:", e);
    return res.status(500).json({ error: e?.message || "feedback failed" });
  }
});

router.get("/followup/learning", async (req, res) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ error: "unauthorized" });

    const insights = await computeFollowupInsights(prisma);
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { beta: true },
    });
    const beta = toPlainObject(settings?.beta);
    const aiLearning = toPlainObject(beta.aiFollowupLearning);
    const optIn = aiLearning.crossTenantOptIn !== false;

    return res.json({
      optIn,
      summary: buildLearningSummary(insights),
      sampleSize: insights.totalSamples,
      variants: insights.variants.map((v) => ({
        variant: v.variant,
        sampleSize: v.sampleSize,
        replyRate: v.replyRate,
        conversionRate: v.conversionRate,
        avgDelayDays: v.avgDelayDays,
        successScore: v.successScore,
      })),
      call: {
        sampleSize: insights.call.sampleSize,
        avgDelayDays: insights.call.avgDelayDays,
        conversionRate: insights.call.conversionRate,
      },
      lastUpdatedISO: insights.lastUpdatedAt ? insights.lastUpdatedAt.toISOString() : null,
    });
  } catch (e: any) {
    console.error("[/ai/followup/learning] failed:", e);
    return res.status(500).json({ error: e?.message || "failed" });
  }
});

export default router;
