// web/src/app/opportunities/OpportunityModal.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useTenantBrand } from "@/lib/use-tenant-brand";
import { Badge } from "@/components/ui/badge";

type FollowUpLog = {
  id: string;
  variant: "A" | "B" | string;
  subject: string;
  body: string;
  sentAt: string;
  scheduledFor?: string | null;
  channel?: string | null;
  opened?: boolean | null;
  replied?: boolean | null;
  converted?: boolean | null;
  delayDays?: number | null;
  metadata?: any;
};

type AiEmailPlan = {
  variant: string;
  subject: string;
  body: string;
  delayDays: number;
};

type AiPhonePlan = {
  callDelayDays: number;
  scheduledForISO?: string;
  script: string;
  reason: string;
  confidence?: string;
};

type AiVariantStat = {
  variant: string;
  sampleSize: number;
  replyRate?: number;
  conversionRate?: number;
  avgDelayDays?: number | null;
  successScore?: number;
};

type AiLearning = {
  summary?: string;
  sampleSize?: number;
  variants?: AiVariantStat[];
  call?: {
    sampleSize?: number;
    avgDelayDays?: number | null;
    conversionRate?: number | null;
  };
  lastUpdatedISO?: string | null;
};

type AiSuggestion = {
  suggestionId: string;
  variant: string;
  subject: string;
  body: string;
  delayDays: number;
  plan?: {
    email: AiEmailPlan;
    phoneCall?: AiPhonePlan;
  };
  learning?: AiLearning;
  rationale?: string;
};

type LeadStatus = "QUOTE_SENT" | "WON" | "LOST";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeSuggestionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sug-${Math.random().toString(36).slice(2, 10)}`;
}

function toPlainObject(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return { ...value };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { ...parsed };
    } catch {
      // ignore
    }
  }
  return {};
}

function normaliseSuggestion(raw: any): AiSuggestion {
  const suggestionId =
    typeof raw?.suggestionId === "string" && raw.suggestionId ? raw.suggestionId : makeSuggestionId();
  const variant = typeof raw?.variant === "string" && raw.variant ? raw.variant : "A";
  const fallbackSubject = typeof raw?.subject === "string" ? raw.subject : "Quick follow-up on your quote";
  const fallbackBody = typeof raw?.body === "string" ? raw.body : "";
  const rawDelay = raw?.delayDays;
  const delayDays =
    typeof rawDelay === "number" && Number.isFinite(rawDelay) ? Math.max(0, Math.round(rawDelay)) : 3;

  const emailRaw = raw?.plan?.email || {};
  const emailPlan: AiEmailPlan = {
    variant,
    subject: typeof emailRaw.subject === "string" ? emailRaw.subject : fallbackSubject,
    body: typeof emailRaw.body === "string" ? emailRaw.body : fallbackBody,
    delayDays:
      typeof emailRaw.delayDays === "number" && Number.isFinite(emailRaw.delayDays)
        ? Math.max(0, Math.round(emailRaw.delayDays))
        : delayDays,
  };

  const phoneRaw = raw?.plan?.phoneCall;
  let phonePlan: AiPhonePlan | undefined;
  if (phoneRaw) {
    const callDelay =
      typeof phoneRaw.callDelayDays === "number" && Number.isFinite(phoneRaw.callDelayDays)
        ? Math.max(1, Math.round(phoneRaw.callDelayDays))
        : 2;
    const scheduledISO =
      typeof phoneRaw.scheduledForISO === "string" && phoneRaw.scheduledForISO
        ? phoneRaw.scheduledForISO
        : new Date(Date.now() + callDelay * DAY_MS).toISOString();
    phonePlan = {
      callDelayDays: callDelay,
      scheduledForISO: scheduledISO,
      script: typeof phoneRaw.script === "string" ? phoneRaw.script : "",
      reason: typeof phoneRaw.reason === "string" ? phoneRaw.reason : "Check the quote landed.",
      confidence: typeof phoneRaw.confidence === "string" ? phoneRaw.confidence : undefined,
    };
  }

  return {
    suggestionId,
    variant,
    subject: emailPlan.subject,
    body: emailPlan.body,
    delayDays: emailPlan.delayDays,
    plan: { email: emailPlan, phoneCall: phonePlan },
    learning: raw?.learning,
    rationale: typeof raw?.rationale === "string" ? raw.rationale : undefined,
  };
}

function percentLabel(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "–";
  const pct = value * 100;
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${Math.round(pct * 10) / 10}%`;
}

function formatDaysLabelLocal(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "–";
  const days = Number(value);
  if (!Number.isFinite(days)) return "–";
  if (days <= 0) return "Same day";
  if (days < 1) {
    const hrs = Math.max(1, Math.round(days * 24));
    return `${hrs} hr${hrs === 1 ? "" : "s"}`;
  }
  const rounded = Math.round(days * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    const whole = Math.max(1, Math.round(rounded));
    return `${whole} day${whole === 1 ? "" : "s"}`;
  }
  return `${rounded} days`;
}

function formatRelativeFuture(date?: Date | null) {
  if (!date) return "–";
  const diffDays = (date.getTime() - Date.now()) / DAY_MS;
  if (!Number.isFinite(diffDays)) return "–";
  if (diffDays <= -0.5) return "Overdue";
  if (diffDays < 0.5) return "Ready now";
  if (diffDays < 1) return "Later today";
  if (diffDays < 2) return "Tomorrow";
  return `In ${Math.round(diffDays)} days`;
}

function formatAgoDays(days?: number | null) {
  if (days == null || Number.isNaN(days)) return "–";
  if (days < 0.5) return "Today";
  if (days < 1.5) return "1 day ago";
  return `${Math.round(days)} days ago`;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

/* ---------------- Confetti (renders above modal) ---------------- */
async function fireConfettiAboveModal() {
  const { default: confetti } = await import("canvas-confetti");
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "999999",
  } as CSSStyleDeclaration);
  document.body.appendChild(canvas);

  const shoot = confetti.create(canvas, { resize: true, useWorker: true });
  shoot({ particleCount: 160, spread: 70, startVelocity: 45, origin: { y: 0.6 } });
  shoot({ particleCount: 120, spread: 60, startVelocity: 35, origin: { x: 0.15, y: 0.7 }, scalar: 0.9 });

  setTimeout(() => { try { canvas.remove(); } catch {} }, 1500);
}

function FollowupStat({
  icon,
  label,
  value,
  hint,
}: {
  icon?: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_12px_35px_-28px_rgba(2,6,23,0.65)]">
      {icon ? <div className="text-lg">{icon}</div> : null}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-slate-500 leading-snug">{hint}</div> : null}
    </div>
  );
}

/* ---------------- Component ---------------- */
export default function OpportunityModal({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadEmail,
  leadStatus,
  opportunityId,
  onAfterSend,
  onStatusChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadStatus: LeadStatus;
  opportunityId?: string | null;
  onAfterSend?: () => void;
  onStatusChange?: (next: LeadStatus) => void;
}) {
  const { toast } = useToast();
  const {
    brandName: tenantBrandName,
    shortName: tenantShortName,
    ownerFirstName: tenantOwnerFirstName,
  } = useTenantBrand();

  const followupBrand = useMemo(() => {
    const brand = (tenantBrandName || "").trim();
    if (brand && brand.toLowerCase() !== "your company") return brand;
    const short = (tenantShortName || "").trim();
    if (short && short.toLowerCase() !== "your") return short;
    return "Sales team";
  }, [tenantBrandName, tenantShortName]);

  const followupOwnerFirst = useMemo(() => {
    const owner = (tenantOwnerFirstName || "").trim();
    if (owner) return owner;
    const firstWord = followupBrand.split(/\s+/)[0] || "";
    if (firstWord && firstWord.toLowerCase() !== "sales") return firstWord;
    return null;
  }, [tenantOwnerFirstName, followupBrand]);

  const followupContext = useMemo(() => {
    const ctx: { brand: string; ownerFirstName?: string } = { brand: followupBrand };
    if (followupOwnerFirst) ctx.ownerFirstName = followupOwnerFirst;
    return ctx;
  }, [followupBrand, followupOwnerFirst]);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<FollowUpLog[]>([]);
  const [suggest, setSuggest] = useState<AiSuggestion | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatusState] = useState<LeadStatus>(leadStatus);
  const [statusUpdating, setStatusUpdating] = useState<LeadStatus | null>(null);
  const [autoMode, setAutoMode] = useState(false);
  const [autoPlan, setAutoPlan] = useState<{
    whenISO: string | null;
    subject?: string | null;
    body?: string | null;
    variant?: string | null;
    rationale?: string | null;
    logId?: string | null;
  } | null>(null);
  const [schedulingNext, setSchedulingNext] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [schedulingCall, setSchedulingCall] = useState(false);
  const [autoScheduleCall, setAutoScheduleCall] = useState(true);
  const autoScheduleInitialised = useRef(false);

  // Last reply banner
  const [lastReply, setLastReply] = useState<{ lastInboundAt: string | null; snippet: string | null } | null>(null);

  const emailDelayDays = suggest?.plan?.email?.delayDays ?? suggest?.delayDays;
  const phonePlan = suggest?.plan?.phoneCall;
  const callSampleSize = suggest?.learning?.call?.sampleSize ?? 0;
  const upcomingCall = useMemo(() => {
    const now = Date.now();
    return history.find((log) => {
      const channel = (log.channel || "email").toLowerCase();
      if (channel !== "phone") return false;
      if (!log.scheduledFor) return false;
      const ts = new Date(log.scheduledFor).getTime();
      return !Number.isNaN(ts) && ts >= now;
    });
  }, [history]);

  const lastSentEmail = useMemo(() => {
    return history.find(
      (log) => (log.channel || "email").toLowerCase() !== "phone" && Boolean(log.sentAt),
    );
  }, [history]);

  const cadenceStats = useMemo(() => {
    const emailEvents = history
      .filter((log) => (log.channel || "email").toLowerCase() !== "phone")
      .map((log) => new Date(log.sentAt).getTime())
      .filter((ts) => !Number.isNaN(ts))
      .sort((a, b) => b - a);

    if (emailEvents.length === 0) {
      return { total: 0, averageGap: null as number | null, lastGap: null as number | null, sinceLast: null as number | null };
    }

    const diffs: number[] = [];
    for (let i = 0; i < emailEvents.length - 1; i += 1) {
      const diffDays = (emailEvents[i] - emailEvents[i + 1]) / DAY_MS;
      if (Number.isFinite(diffDays) && diffDays >= 0) diffs.push(diffDays);
    }

    const sinceLastDays = (Date.now() - emailEvents[0]) / DAY_MS;

    return {
      total: emailEvents.length,
      averageGap: diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null,
      lastGap: diffs.length ? diffs[0] : null,
      sinceLast: Number.isFinite(sinceLastDays) && sinceLastDays >= 0 ? sinceLastDays : null,
    };
  }, [history]);

  const nextSuggestedDate = useMemo(() => {
    if (!lastSentEmail?.sentAt || typeof emailDelayDays !== "number") return null;
    const lastTs = new Date(lastSentEmail.sentAt).getTime();
    if (Number.isNaN(lastTs)) return null;
    const nextTs = lastTs + emailDelayDays * DAY_MS;
    if (!Number.isFinite(nextTs)) return null;
    return new Date(nextTs);
  }, [lastSentEmail, emailDelayDays]);

  const topVariant = useMemo(() => {
    if (!suggest?.learning?.variants || suggest.learning.variants.length === 0) return null;
    const ordered = [...suggest.learning.variants].sort(
      (a, b) => (b.successScore ?? 0) - (a.successScore ?? 0),
    );
    return ordered[0];
  }, [suggest?.learning?.variants]);

  const callAvgDelayDays: number | undefined =
    typeof suggest?.learning?.call?.avgDelayDays === "number"
      ? suggest.learning.call.avgDelayDays
      : undefined;

  const callAvgLabel = useMemo(() => {
    return typeof callAvgDelayDays === "number" ? formatDaysLabelLocal(callAvgDelayDays) : "–";
  }, [callAvgDelayDays]);

  const lastEmailDate = lastSentEmail?.sentAt ? new Date(lastSentEmail.sentAt) : null;
  const sampleSize = suggest?.learning?.sampleSize ?? 0;
  const nextStatValue = nextSuggestedDate
    ? formatRelativeFuture(nextSuggestedDate)
    : typeof emailDelayDays === "number"
    ? `Every ${formatDaysLabelLocal(emailDelayDays)}`
    : "Let AI decide";
  const nextStatHint = nextSuggestedDate
    ? nextSuggestedDate.toLocaleString()
    : typeof emailDelayDays === "number"
    ? "Based on recent wins"
    : "AI will recommend timing";
  const sinceStatValue = lastEmailDate ? formatAgoDays(cadenceStats.sinceLast) : "First follow-up";
  const sinceStatHint = lastEmailDate ? lastEmailDate.toLocaleString() : "No previous emails";
  const avgStatValue = cadenceStats.averageGap != null ? formatDaysLabelLocal(cadenceStats.averageGap) : "Learning";
  const avgStatHint =
    cadenceStats.total > 1
      ? `From ${cadenceStats.total} email${cadenceStats.total === 1 ? "" : "s"}`
      : "Send two follow-ups to tune cadence";
  const sampleStatValue = sampleSize ? sampleSize.toLocaleString() : "Gathering";
  const sampleStatHint = sampleSize
    ? topVariant
      ? `Variant ${topVariant.variant} is winning`
      : "Variants rotating"
    : "Send follow-ups to unlock insights";

  const load = useCallback(async () => {
    setRenderError(null);
    setLoading(true);
    try {
      const h = await apiFetch<{ logs: FollowUpLog[] }>(`/opportunities/${leadId}/followups`);
      const logs = h.logs || [];

      const upcomingEmail = logs.find((log) => {
        if ((log.channel || "email").toLowerCase() === "phone") return false;
        if (log.sentAt) return false;
        if (!log.scheduledFor) return false;
        const ts = new Date(log.scheduledFor).getTime();
        return Number.isFinite(ts) && ts >= Date.now() - 60_000;
      });

      if (upcomingEmail) {
        const meta = toPlainObject(upcomingEmail.metadata);
        const planMeta = toPlainObject(meta.plan);
        const whenISO =
          upcomingEmail.scheduledFor ||
          (typeof planMeta.scheduledForISO === "string" ? planMeta.scheduledForISO : null) ||
          (typeof planMeta.whenISO === "string" ? planMeta.whenISO : null);
        setAutoPlan({
          whenISO: whenISO || null,
          subject: upcomingEmail.subject ?? (typeof planMeta.subject === "string" ? planMeta.subject : null),
          body: upcomingEmail.body ?? (typeof planMeta.body === "string" ? planMeta.body : null),
          variant: upcomingEmail.variant ?? (typeof planMeta.variant === "string" ? planMeta.variant : null),
          rationale:
            typeof meta.rationale === "string"
              ? meta.rationale
              : typeof planMeta.rationale === "string"
              ? planMeta.rationale
              : undefined,
          logId: upcomingEmail.id,
        });
        setAutoMode(true);
      } else {
        setAutoPlan(null);
        setAutoMode(false);
      }

      setHistory(logs);

      const upcoming = logs.find((log) => {
        if ((log.channel || "email").toLowerCase() !== "phone") return false;
        if (!log.scheduledFor) return false;
        const ts = new Date(log.scheduledFor).getTime();
        return !Number.isNaN(ts) && ts > Date.now();
      });
      if (!autoScheduleInitialised.current) {
        setAutoScheduleCall(!upcoming);
        autoScheduleInitialised.current = true;
      }

      const raw = await apiFetch<any>("/ai/followup/suggest", {
        method: "POST",
        json: { leadId, status: "QUOTE_SENT", history: logs, context: { ...followupContext } },
      });
      const normalised = normaliseSuggestion(raw);
      setSuggest(normalised);
      setDraftSubject(normalised.subject || "");
      setDraftBody(normalised.body || "");
    } catch (e: any) {
      setRenderError(e?.message || "Failed to load follow-up suggestion");
    } finally {
      setLoading(false);
    }
  }, [leadId, followupContext]);

  const loadReplies = useCallback(async () => {
    try {
      const j = await apiFetch<{ lastInboundAt: string | null; snippet: string | null }>(
        `/opportunities/${leadId}/replies`
      );
      setLastReply(j);
    } catch {
      setLastReply(null);
    }
  }, [leadId]);

  useEffect(() => {
    if (open) {
      setStatusState(leadStatus);
      setStatusUpdating(null);
      setAutoPlan(null);
      setAutoMode(false);
      autoScheduleInitialised.current = false;
      void load();
      void loadReplies();
    }
  }, [open, leadStatus, load, loadReplies]);

  async function send() {
    if (!draftSubject || !draftBody) return;
    try {
      setSending(true);
      const callPlan = autoScheduleCall ? suggest?.plan?.phoneCall : null;
      await apiFetch(`/opportunities/${leadId}/send-followup`, {
        method: "POST",
        json: {
          variant: suggest?.variant || "A",
          subject: draftSubject,
          body: draftBody,
          suggestionId: suggest?.suggestionId,
          plan: suggest?.plan,
          rationale: suggest?.rationale,
        },
      });
      if (callPlan) {
        await scheduleCall(true, callPlan, { skipReload: true });
      }
      onAfterSend?.();
      await load();
      await loadReplies();
      toast({ title: "Follow-up sent" });
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function scheduleCall(
    autoTriggered = false,
    overridePlan?: AiPhonePlan,
    options: { skipReload?: boolean } = {},
  ) {
    const plan = overridePlan ?? suggest?.plan?.phoneCall;
    if (!plan) return false;

    const scheduledForISO =
      plan.scheduledForISO || new Date(Date.now() + plan.callDelayDays * DAY_MS).toISOString();

    try {
      setSchedulingCall(true);
      const resp = await apiFetch<{ scheduledForISO: string }>(
        `/opportunities/${leadId}/schedule-call`,
        {
          method: "POST",
          json: {
            scheduledForISO,
            callDelayDays: plan.callDelayDays,
            script: plan.script,
            reason: plan.reason,
            suggestionId: suggest?.suggestionId,
          },
        },
      );

      if (!options.skipReload) {
        await load();
        await loadReplies();
      }

      setAutoScheduleCall(false);
      const when = formatDateTime(resp?.scheduledForISO || scheduledForISO);
      toast({
        title: autoTriggered ? "Call scheduled automatically" : "Call scheduled",
        description: when ? `We'll ring ${leadName} around ${when}.` : undefined,
      });
      return true;
    } catch (e: any) {
      toast({
        title: "Couldn’t schedule call",
        description: e?.message || "Please try again",
        variant: "destructive",
      });
      return false;
    } finally {
      setSchedulingCall(false);
    }
  }

  async function scheduleNext() {
    const idForSchedule = opportunityId || leadId;
    try {
      setSchedulingNext(true);
      const resp = await apiFetch<{
        whenISO: string;
        subject: string;
        body: string;
        variant: string;
        source?: string;
        cps?: number | null;
        rationale?: string;
        logId?: string;
      }>(`/opportunities/${idForSchedule}/next-followup`, {
        method: "POST",
        json: {},
      });
      setAutoMode(true);
      setAutoPlan({
        whenISO: resp.whenISO || null,
        subject: resp.subject ?? null,
        body: resp.body ?? null,
        variant: resp.variant ?? null,
        rationale: resp.rationale,
        logId: resp.logId ?? null,
      });
      toast({
        title: "Next follow-up scheduled",
        description: resp.whenISO ? `Planned for ${formatDateTime(resp.whenISO) || resp.whenISO}` : undefined,
      });
      await load();
      onAfterSend?.();
    } catch (e: any) {
      toast({
        title: "Scheduling failed",
        description: e?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSchedulingNext(false);
    }
  }

  async function updateStatus(next: LeadStatus) {
    try {
      setStatusUpdating(next);
      await apiFetch(`/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        json: { status: next },
      });

      if (next === "WON") {
        await fireConfettiAboveModal();
        toast({ title: "Marked as WON 🎉" });
      } else if (next === "LOST") {
        toast({ title: "Marked as LOST" });
      } else {
        toast({ title: "Back to Quote Sent" });
      }

      setStatusState(next);
      onStatusChange?.(next);
      onAfterSend?.();
      await loadReplies();
    } catch (e: any) {
      toast({ title: "Failed to update status", description: e?.message, variant: "destructive" });
    } finally {
      setStatusUpdating(null);
    }
  }

  const lastSent = lastSentEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* forceMount ensures content node exists (helps with confetti zIndex) */}
      <DialogContent
        forceMount
        className="w-[96vw] max-w-5xl p-0 rounded-2xl shadow-[0_24px_70px_-30px_rgba(2,6,23,0.5)]"
      >
        <div className="max-h-[85vh] overflow-hidden flex flex-col bg-white rounded-2xl">
          {/* Header */}
          <DialogHeader className="p-5 pb-3 border-b bg-gradient-to-b from-white to-slate-50">
            <DialogTitle className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-700 shadow-sm">
                {avatarText(leadName)}
              </span>
              <div className="min-w-0">
                <div className="text-base font-semibold leading-tight truncate">
                  Follow up — {leadName}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{leadEmail || ""}</div>
              </div>
              <span className="ml-auto rounded-full border bg-white px-2 py-0.5 text-[11px] text-slate-600">
                {lastSent
                  ? `Last sent ${formatDateTime(lastSent.sentAt) || "recently"}`
                  : "No previous follow-up"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Body */}
          <div className="px-5 pt-4 pb-5 overflow-y-auto">
            {renderError && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {renderError}
              </div>
            )}

            {/* Reply banner */}
            {lastReply && (lastReply.lastInboundAt || lastReply.snippet) && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <div className="mt-0.5">📬</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    Last customer reply:{" "}
                    {lastReply.lastInboundAt ? formatDateTime(lastReply.lastInboundAt) || "—" : "—"}
                  </div>
                  {lastReply.snippet ? <div className="mt-1 line-clamp-2">{lastReply.snippet}</div> : null}
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => loadReplies()}>
                  Refresh
                </Button>
              </div>
            )}

            {/* Status actions */}
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
              <span className="text-xs text-slate-600">Status:</span>
              <Button
                size="sm"
                variant={status === "QUOTE_SENT" ? "default" : "secondary"}
                onClick={() => updateStatus("QUOTE_SENT")}
                disabled={statusUpdating !== null}
              >
                {statusUpdating === "QUOTE_SENT" ? "Updating…" : "Back to Quote Sent"}
              </Button>
              <Button
                size="sm"
                variant={status === "LOST" ? "destructive" : "outline"}
                onClick={() => updateStatus("LOST")}
                disabled={statusUpdating !== null}
              >
                {statusUpdating === "LOST" ? "Updating…" : "Mark Lost"}
              </Button>
              <Button
                size="sm"
                variant={status === "WON" ? "default" : "outline"}
                onClick={() => updateStatus("WON")}
                disabled={statusUpdating !== null}
              >
                {statusUpdating === "WON" ? "Marking…" : "Mark Won 🎉"}
              </Button>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Compose panel */}
              <section className="rounded-xl border p-4 bg-white/90 shadow-sm">
                <div className="mb-3 text-sm font-semibold text-slate-900">
                  Send Follow-up Email
                </div>

                <label className="space-y-1.5 block">
                  <div className="text-xs text-slate-600">Subject</div>
                  <input
                    className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                    placeholder="Follow-up on your quote"
                  />
                </label>

                <label className="space-y-1.5 block mt-3">
                  <div className="text-xs text-slate-600">Message</div>
                  <textarea
                    className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2 min-h-[160px]"
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    placeholder="Hi {leadName},

I wanted to follow up on the quote I sent. Do you have any questions about the proposal?

Let me know if you'd like to discuss next steps.

Best regards"
                  />
                </label>

                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" onClick={() => load()} disabled={loading}>
                    {loading ? "Loading..." : "Generate AI suggestion"}
                  </Button>
                  <Button onClick={send} disabled={sending || !draftSubject || !draftBody}>
                    {sending ? "Sending…" : "Send follow-up"}
                  </Button>
                </div>

                {/* Simple preview */}
                {(draftSubject || draftBody) && (
                  <div className="mt-4 rounded-lg border bg-slate-50 p-3">
                    <div className="text-[11px] text-slate-500 mb-1">Preview</div>
                    <div className="text-sm font-medium mb-1">{draftSubject || "(no subject)"}</div>
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap">{draftBody}</pre>
                  </div>
                )}
              </section>

              {/* History panel */}
              <section className="rounded-xl border p-4 bg-white">
                <div className="mb-2 text-sm font-semibold text-slate-900">Follow-up History</div>
                {history.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">No follow-ups sent yet.</div>
                ) : (
                  <div className="space-y-3 max-h-[46vh] overflow-auto pr-1">
                    {history.map((h) => {
                      const meta = toPlainObject(h.metadata);
                      const channel = (h.channel || "email").toLowerCase();
                      const isPhone = channel === "phone";
                      const sentLabel = h.sentAt ? formatDateTime(h.sentAt) : null;
                      const scheduledLabel = h.scheduledFor ? formatDateTime(h.scheduledFor) : null;
                      const whenLabel = sentLabel || (scheduledLabel ? `Scheduled ${scheduledLabel}` : "Unknown");

                      return (
                        <div key={h.id} className="rounded-md border p-3 hover:bg-slate-50">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span>{whenLabel}</span>
                            <span className="rounded-full border bg-white px-2 py-0.5">
                              {isPhone ? "📞 Phone" : "📧 Email"}
                            </span>
                            {!isPhone && h.opened && <span className="text-green-700">• Opened</span>}
                            {!isPhone && h.replied && <span className="text-blue-700">• Replied</span>}
                            {!isPhone && h.converted && <span className="text-emerald-700">• Converted</span>}
                          </div>
                          <div className="text-sm font-medium">
                            {isPhone ? h.subject || "Phone follow-up" : h.subject}
                          </div>
                          {h.body && (
                            <div className="mt-1 rounded-md bg-slate-50 p-2 text-xs text-slate-700 line-clamp-3">
                              {h.body}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="gap-2 p-4 border-t bg-white">
            <div className="flex-1 text-xs text-slate-500">
              {lastSent
                ? `Last sent: ${formatDateTime(lastSent.sentAt) || "recently"}`
                : "No previous follow-up"}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- helpers ---------------- */
function avatarText(name?: string | null) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}