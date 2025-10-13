// web/src/app/opportunities/OpportunityModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

type FollowUpLog = {
  id: string;
  variant: "A" | "B" | string;
  subject: string;
  body: string;
  sentAt: string;
  opened?: boolean | null;
  replied?: boolean | null;
  converted?: boolean | null;
};

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

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<FollowUpLog[]>([]);
  const [suggest, setSuggest] = useState<{
    variant: "A" | "B" | string;
    subject: string;
    body: string;
    delayDays: number;
  } | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [sending, setSending] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Last reply banner
  const [lastReply, setLastReply] = useState<{ lastInboundAt: string | null; snippet: string | null } | null>(null);

  async function load() {
    setRenderError(null);
    setLoading(true);
    try {
      const h = await apiFetch<{ logs: FollowUpLog[] }>(`/opportunities/${leadId}/followups`);
      setHistory(h.logs || []);
      const s = await apiFetch<{
        variant: "A" | "B" | string;
        subject: string;
        body: string;
        delayDays: number;
      }>("/ai/followup/suggest", {
        method: "POST",
        json: { leadId, status: "QUOTE_SENT", history: h.logs, context: { brand: "Sales" } },
      });
      setSuggest(s);
      setDraftSubject(s.subject || "");
      setDraftBody(s.body || "");
    } catch (e: any) {
      setRenderError(e?.message || "Failed to load follow-up suggestion");
    } finally {
      setLoading(false);
    }
  }

  async function loadReplies() {
    try {
      const j = await apiFetch<{ lastInboundAt: string | null; snippet: string | null }>(
        `/opportunities/${leadId}/replies`
      );
      setLastReply(j);
    } catch {
      setLastReply(null);
    }
  }

  useEffect(() => {
    if (open) {
      void load();
      void loadReplies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  async function send() {
    if (!draftSubject || !draftBody) return;
    try {
      setSending(true);
      await apiFetch(`/opportunities/${leadId}/send-followup`, {
        method: "POST",
        json: {
          variant: suggest?.variant || "A",
          subject: draftSubject,
          body: draftBody,
        },
      });
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

  const lastSent = useMemo(() => history[0], [history]);

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
                <div className="mb-2 text-xs font-semibold text-slate-600">
                  AI suggestion {suggest?.variant ? `(Variant ${suggest.variant})` : ""}
                </div>

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

                {suggest?.delayDays !== undefined && (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Suggested rhythm: next follow-up in <b>{suggest.delayDays} days</b>.
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
                    {history.map((h) => (
                      <div key={h.id} className="rounded-md border p-3 hover:bg-slate-50">
                        <div className="text-[11px] text-slate-500 mb-1 flex items-center gap-2">
                          <span>{new Date(h.sentAt).toLocaleString()}</span>
                          <span className="rounded-full border bg-white px-2 py-0.5">
                            Variant {h.variant}
                          </span>
                          {h.opened && <span className="text-green-700">· Opened</span>}
                          {h.replied && <span className="text-blue-700">· Replied</span>}
                          {h.converted && <span className="text-emerald-700">· Converted</span>}
                        </div>
                        <div className="text-sm font-medium">{h.subject}</div>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap mt-1">{h.body}</pre>
                      </div>
                    ))}
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