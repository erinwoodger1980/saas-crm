"use client";

import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type FollowupPlannerProps = {
  title?: string;
  initialLeadName?: string;
  initialLeadEmail?: string;
  initialBrand?: string;
  initialOwnerFirstName?: string;
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

type AiSuggestion = {
  suggestionId: string;
  variant: string;
  subject: string;
  body: string;
  delayDays: number;
  plan?: { email: AiEmailPlan; phoneCall?: AiPhonePlan };
  learning?: any;
  rationale?: string;
};

function makeSuggestionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sug-${Math.random().toString(36).slice(2, 10)}`;
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
        : new Date(Date.now() + callDelay * 24 * 60 * 60 * 1000).toISOString();
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

export function FollowupPlanner({
  title = "Follow-up planner",
  initialLeadName = "Acme",
  initialLeadEmail = "customer@example.com",
  initialBrand = "Your company",
  initialOwnerFirstName = "Alex",
}: FollowupPlannerProps) {
  const [leadName, setLeadName] = useState(initialLeadName);
  const [leadEmail, setLeadEmail] = useState(initialLeadEmail);
  const [brand, setBrand] = useState(initialBrand);
  const [ownerFirstName, setOwnerFirstName] = useState(initialOwnerFirstName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<AiSuggestion | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const emailDelayDays = suggest?.plan?.email?.delayDays ?? suggest?.delayDays;

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiFetch<any>("/ai/followup/suggest", {
        method: "POST",
        json: {
          status: "QUOTE_SENT",
          context: { brand: brand || undefined, ownerFirstName: ownerFirstName || undefined },
          lead: { name: leadName || undefined, email: leadEmail || undefined },
          history: [],
        },
      });
      const normalised = normaliseSuggestion(raw);
      setSuggest(normalised);
      setDraftSubject(normalised.subject || "");
      setDraftBody(normalised.body || "");
    } catch (e: any) {
      setError(e?.message || "Failed to generate suggestion");
    } finally {
      setLoading(false);
    }
  }, [brand, ownerFirstName, leadName, leadEmail]);

  const copyBoth = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${draftSubject}\n\n${draftBody}`.trim());
    } catch {}
  }, [draftSubject, draftBody]);

  const callBadge = useMemo(() => {
    const phoneCall = suggest?.plan?.phoneCall;
    if (!phoneCall) return null;
    const when = phoneCall.scheduledForISO ? new Date(phoneCall.scheduledForISO) : null;
    const label = when ? when.toLocaleString() : `${phoneCall.callDelayDays} day(s)`;
    return <Badge variant="secondary" className="text-[10px]">Phone: {label}</Badge>;
  }, [suggest?.plan?.phoneCall]);

  return (
    <section className="rounded-2xl border p-4 bg-white">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-700">{title}</div>
        {callBadge}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-600">Lead name
              <input className="mt-1 w-full rounded-md border p-2 text-sm" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
            </label>
            <label className="text-xs text-slate-600">Lead email
              <input className="mt-1 w-full rounded-md border p-2 text-sm" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-600">Brand
              <input className="mt-1 w-full rounded-md border p-2 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label className="text-xs text-slate-600">Owner first name
              <input className="mt-1 w-full rounded-md border p-2 text-sm" value={ownerFirstName} onChange={(e) => setOwnerFirstName(e.target.value)} />
            </label>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={generate} disabled={loading}>{loading ? "Generating…" : (suggest ? "Regenerate" : "Generate")}</Button>
            {emailDelayDays != null && (
              <span className="rounded-full border bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">Suggested timing: ~{emailDelayDays} day(s)</span>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-600">Subject
            <input className="mt-1 w-full rounded-md border p-2 text-sm" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">Body
            <textarea className="mt-1 w-full min-h-[160px] rounded-md border p-2 text-sm" value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(draftSubject)}>Copy subject</Button>
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(draftBody)}>Copy body</Button>
            <Button size="sm" onClick={copyBoth}>Copy both</Button>
          </div>
          {(draftSubject || draftBody) && (
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="mb-1 text-[11px] text-slate-500">Preview</div>
              <div className="mb-1 text-sm font-medium">{draftSubject || "(no subject)"}</div>
              <pre className="whitespace-pre-wrap text-xs text-slate-700">{draftBody}</pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
