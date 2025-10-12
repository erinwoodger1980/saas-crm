"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<FollowUpLog[]>([]);
  const [suggest, setSuggest] = useState<{ variant: "A" | "B" | string; subject: string; body: string; delayDays: number } | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const h = await apiFetch<{ logs: FollowUpLog[] }>(`/opportunities/${leadId}/followups`);
      setHistory(h.logs || []);
      const s = await apiFetch<any>("/ai/followup/suggest", {
        method: "POST",
        json: { leadId, status: "QUOTE_SENT", history: h.logs, context: { brand: "Sales" } },
      });
      setSuggest(s);
      setDraftSubject(s.subject || "");
      setDraftBody(s.body || "");
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

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
    } catch (e) {
      alert("Send failed");
    } finally {
      setSending(false);
    }
  }

  const lastSent = useMemo(() => history[0], [history]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl p-0">
        <div className="max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="p-5 pb-2">
            <DialogTitle className="text-lg">
              Follow up – {leadName}
              <span className="ml-2 text-xs text-slate-500">{leadEmail || ""}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-5 overflow-y-auto">
            {/* AI Suggestion */}
            <section className="rounded-xl border p-4 mb-4 bg-white">
              <div className="mb-2 text-xs font-semibold text-slate-600">
                AI suggestion {suggest?.variant ? `(Variant ${suggest.variant})` : ""}
              </div>
              <div className="grid grid-cols-1 gap-3">
                <label className="space-y-1.5">
                  <div className="text-xs text-slate-600">Subject</div>
                  <input
                    className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="text-xs text-slate-600">Body</div>
                  <textarea
                    className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2 min-h-[140px]"
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                  />
                </label>
                {suggest?.delayDays !== undefined && (
                  <div className="text-[11px] text-slate-500">
                    Suggested rhythm: next follow-up in <b>{suggest.delayDays} days</b>.
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => load()} disabled={loading}>
                  Refresh suggestion
                </Button>
                <Button onClick={send} disabled={sending || !draftSubject || !draftBody}>
                  {sending ? "Sending…" : "Send follow-up"}
                </Button>
              </div>
            </section>

            {/* History */}
            <section className="rounded-xl border p-4 bg-white">
              <div className="mb-2 text-xs font-semibold text-slate-600">History</div>
              {history.length === 0 ? (
                <div className="text-xs text-slate-500">No follow-ups sent yet.</div>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="rounded-md border p-3">
                      <div className="text-[11px] text-slate-500 mb-1">
                        {new Date(h.sentAt).toLocaleString()} · Variant {h.variant}
                        {h.opened ? " · Opened" : ""}{h.replied ? " · Replied" : ""}
                        {h.converted ? " · Converted" : ""}
                      </div>
                      <div className="text-sm font-medium">{h.subject}</div>
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap mt-1">{h.body}</pre>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <DialogFooter className="gap-2 p-4 border-t bg-white">
            <div className="flex-1 text-xs text-slate-500">
              {lastSent ? `Last sent: ${new Date(lastSent.sentAt).toLocaleString()}` : "No previous follow-up"}
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}