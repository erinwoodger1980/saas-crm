// web/src/app/opportunities/OpportunityModal.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  return `${Math.round(value * 100)}%`;
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

/* ---------------- Component ---------------- */
export default function OpportunityModal({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadEmail,
  onAfterSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadName: string;
  leadEmail: string;
  onAfterSend?: () => void;
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
  const [autoMode, setAutoMode] = useState(false);
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

  const lastEmail = useMemo(() => {
    return history.find((log) => (log.channel || "email").toLowerCase() !== "phone");
  }, [history]);

  const load = useCallback(async () => {
    setRenderError(null);
    setLoading(true);
    try {
      const h = await apiFetch<{ logs: FollowUpLog[] }>(`/opportunities/${leadId}/followups`);
      const logs = h.logs || [];
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
      autoScheduleInitialised.current = false;
      void load();
      void loadReplies();
    }
  }, [open, load, loadReplies]);

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
    try {
      const resp = await apiFetch<{
        whenISO: string;
        subject: string;
        body: string;
        variant: string;
        source?: string;
        cps?: number | null;
        rationale?: string;
      }>(`/opportunities/${leadId}/next-followup`, {
        method: "POST",
        json: {},
      });
      setAutoMode(true);
      toast({
        title: "Next follow-up scheduled",
        description: `Planned for ${new Date(resp.whenISO).toLocaleString()}`,
      });
    } catch (e: any) {
      toast({
        title: "Scheduling failed",
        description: e?.message || "Please try again",
        variant: "destructive",
      });
    }
  }

  async function setStatus(next: "QUOTE_SENT" | "WON" | "LOST") {
    try {
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

      onAfterSend?.();
      await loadReplies();
    } catch (e: any) {
      toast({ title: "Failed to update status", description: e?.message, variant: "destructive" });
    }
  }

  const lastSent = lastEmail;

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
                {lastSent ? `Last sent ${new Date(lastSent.sentAt).toLocaleString()}` : "No previous follow-up"}
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
                    {lastReply.lastInboundAt ? new Date(lastReply.lastInboundAt).toLocaleString() : "—"}
                  </div>
                  {lastReply.snippet ? <div className="mt-1 line-clamp-2">{lastReply.snippet}</div> : null}
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => loadReplies()}>
                  Refresh
                </Button>
              </div>
            )}

            {/* Quick actions */}
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
              <span className="text-xs text-slate-600">Status:</span>
              <Button size="sm" variant="secondary" onClick={() => setStatus("QUOTE_SENT")}>
                Back to Quote Sent
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus("LOST")}>
                Mark Lost
              </Button>
              <Button size="sm" onClick={() => setStatus("WON")}>
                Mark Won 🎉
              </Button>
              <div className="ml-auto">
                <Button
                  size="sm"
                  variant={autoMode ? "secondary" : "outline"}
                  onClick={scheduleNext}
                >
                  {autoMode ? "Auto-scheduled ✓" : "Auto-schedule next"}
                </Button>
              </div>
            </div>

            {/* Two column layout on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Compose panel */}
              <section className="rounded-xl border p-4 bg-white/90 shadow-[0_10px_30px_-22px_rgba(2,6,23,0.45)]">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">AI suggestion</span>
                  {suggest?.variant && (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                      Variant {suggest.variant}
                    </span>
                  )}
                  {suggest?.learning?.sampleSize ? (
                    <span className="text-[11px] text-slate-500">
                      Learning from {suggest.learning.sampleSize} recent follow-ups
                    </span>
                  ) : null}
                </div>

                {suggest?.learning && (
                  <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
                    {suggest.learning.summary && (
                      <div className="text-slate-700">{suggest.learning.summary}</div>
                    )}
                    {suggest.rationale && (
                      <div className="text-slate-600">{suggest.rationale}</div>
                    )}
                    {suggest.learning.variants && suggest.learning.variants.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {suggest.learning.variants.slice(0, 2).map((stat) => (
                          <span
                            key={stat.variant}
                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600"
                          >
                            Variant {stat.variant}: {percentLabel(stat.replyRate)} replies · {percentLabel(stat.conversionRate)} won
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500">
                      Learning across the JoineryAI network to keep your follow-ups natural and effective.
                    </div>
                    {typeof suggest.learning.call?.avgDelayDays === "number" && (
                      <div className="text-[10px] text-slate-500">
                        Phone nudges average {Math.round(suggest.learning.call.avgDelayDays || 0)} day
                        {Math.round(suggest.learning.call.avgDelayDays || 0) === 1 ? "" : "s"} after send.
                      </div>
                    )}
                  </div>
                )}

                <label className="space-y-1.5 block">
                  <div className="text-xs text-slate-600">Subject</div>
                  <input
                    className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                  />
                </label>

                <label className="space-y-1.5 block mt-3">
                  <div className="text-xs text-slate-600">Body</div>
                  <textarea
                    className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2 min-h-[160px]"
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                  />
                </label>

                {typeof emailDelayDays === "number" && Number.isFinite(emailDelayDays) && (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Suggested rhythm: next follow-up in <b>{emailDelayDays}</b> day
                    {emailDelayDays === 1 ? "" : "s"}.
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" onClick={() => load()} disabled={loading}>
                    Refresh suggestion
                  </Button>
                  <Button onClick={send} disabled={sending || !draftSubject || !draftBody}>
                    {sending ? "Sending…" : "Send follow-up"}
                  </Button>
                </div>

                {phonePlan && (
                  <div className="mt-4 space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-blue-900">Recommended phone follow-up</span>
                      {phonePlan.confidence && (
                        <span className="rounded-full border border-blue-300 bg-white/70 px-2 py-0.5 text-[10px] text-blue-700 capitalize">
                          {phonePlan.confidence === "learned" ? "AI learned" : phonePlan.confidence}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-blue-900">
                      {upcomingCall
                        ? `Scheduled for ${formatDateTime(upcomingCall.scheduledFor) || "soon"}`
                        : phonePlan.scheduledForISO
                        ? `Suggested for ${formatDateTime(phonePlan.scheduledForISO)}`
                        : `Suggested in about ${phonePlan.callDelayDays} day${phonePlan.callDelayDays === 1 ? "" : "s"}`}
                    </div>
                    {phonePlan.reason && <div className="text-[11px]">{phonePlan.reason}</div>}
                    {phonePlan.script && (
                      <pre className="whitespace-pre-wrap rounded-md border border-blue-100 bg-white/70 p-2 text-[11px] text-blue-900">
                        {phonePlan.script}
                      </pre>
                    )}
                    {phonePlan.confidence && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-800">
                        {phonePlan.confidence === "learned"
                          ? callSampleSize
                            ? `Learned from ${callSampleSize} call${callSampleSize === 1 ? "" : "s"}`
                            : "Learning from recent calls"
                          : "Baseline timing while we learn"}
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-blue-900/80">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={Boolean(upcomingCall) || autoScheduleCall}
                          onChange={(e) => setAutoScheduleCall(e.target.checked)}
                          disabled={Boolean(upcomingCall)}
                        />
                        <span>Auto-schedule after sending</span>
                      </label>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => scheduleCall(false, phonePlan)}
                        disabled={schedulingCall || Boolean(upcomingCall)}
                      >
                        {upcomingCall ? "Call booked" : schedulingCall ? "Scheduling…" : "Schedule now"}
                      </Button>
                    </div>
                    {upcomingCall && (
                      <div className="text-[10px] text-blue-800">
                        Next call booked for {formatDateTime(upcomingCall.scheduledFor) || "soon"}.
                      </div>
                    )}
                  </div>
                )}

                {/* Live preview */}
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
                <div className="mb-2 text-xs font-semibold text-slate-600">History</div>
                {history.length === 0 ? (
                  <div className="text-xs text-slate-500">No follow-ups sent yet.</div>
                ) : (
                  <div className="space-y-3 max-h-[46vh] overflow-auto pr-1">
                    {history.map((h) => {
                      const meta = toPlainObject(h.metadata);
                      const isPhone = (h.channel || "email").toLowerCase() === "phone";
                      const sentLabel = formatDateTime(h.sentAt) || "Unknown";
                      const scheduledLabel = isPhone ? formatDateTime(h.scheduledFor) : null;

                      return (
                        <div key={h.id} className="rounded-md border p-3 hover:bg-slate-50">
                          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span>{scheduledLabel || sentLabel}</span>
                            <span className="rounded-full border bg-white px-2 py-0.5">
                              {isPhone ? "Phone" : `Variant ${h.variant}`}
                            </span>
                            {!isPhone && h.opened && <span className="text-green-700">· Opened</span>}
                            {!isPhone && h.replied && <span className="text-blue-700">· Replied</span>}
                            {!isPhone && h.converted && <span className="text-emerald-700">· Converted</span>}
                            {isPhone && sentLabel && (
                              <span className="text-slate-400">booked via AI {sentLabel}</span>
                            )}
                          </div>
                          <div className="text-sm font-medium">
                            {isPhone ? h.subject || "Phone follow-up" : h.subject}
                          </div>
                          {isPhone && scheduledLabel && (
                            <div className="text-[11px] text-slate-500">
                              Scheduled for {scheduledLabel}
                            </div>
                          )}
                          {h.body && (
                            <pre className="mt-1 whitespace-pre-wrap rounded-md bg-white/80 p-2 text-xs text-slate-700">
                              {h.body}
                            </pre>
                          )}
                          {meta.reason && (
                            <div className="mt-1 text-[11px] text-slate-500">Reason: {meta.reason}</div>
                          )}
                          {meta.callDelayDays !== undefined && (
                            <div className="text-[10px] text-slate-400">
                              Delay: {meta.callDelayDays} day{meta.callDelayDays === 1 ? "" : "s"}
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
              {lastSent ? `Last sent: ${new Date(lastSent.sentAt).toLocaleString()}` : "No previous follow-up"}
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