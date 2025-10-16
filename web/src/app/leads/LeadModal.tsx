// web/src/app/leads/LeadModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import LeadSourcePicker from "@/components/leads/LeadSourcePicker";
import { useToast } from "@/components/ui/use-toast";

const API_URL =
  (process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "http://localhost:4000")!.replace(/\/$/, "");

type LeadStatus =
  | "NEW_ENQUIRY"
  | "INFO_REQUESTED"
  | "DISQUALIFIED"
  | "REJECTED"
  | "READY_TO_QUOTE"
  | "QUOTE_SENT"
  | "WON"
  | "LOST";

export type Lead = {
  id: string;
  contactName: string;
  email?: string | null;
  status: LeadStatus;
  nextAction?: string | null;
  nextActionAt?: string | null;
  custom?: Record<string, any>;
};

export type FieldDef = {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  required: boolean;
  sortOrder: number;
  config?: { options?: string[] };
};

type QField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required?: boolean;
  options?: string[];
};

type TenantSettings = {
  brandName: string;
  questionnaire?: QField[] | null;
};

type EmailDetails = {
  bodyText?: string;
  bodyHtml?: string;
  subject?: string;
  from?: string;
  date?: string;
  attachments?: { filename: string; size?: number; attachmentId: string }[];
  threadId?: string;
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW_ENQUIRY: "New enquiry",
  INFO_REQUESTED: "Info requested",
  DISQUALIFIED: "Disqualified",
  REJECTED: "Rejected",
  READY_TO_QUOTE: "Ready to quote",
  QUOTE_SENT: "Quote sent",
  WON: "Won",
  LOST: "Lost",
};

function attachmentUrl(messageId: string, attachmentId: string) {
  const bust = Date.now();
  return `${API_URL}/gmail/message/${encodeURIComponent(
    messageId
  )}/attachments/${encodeURIComponent(attachmentId)}?v=${bust}`;
}

export default function LeadModal({
  open,
  onOpenChange,
  leadPreview,
  onAutoSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadPreview: Lead | null;
  onAutoSave: (id: string, patch: Partial<Lead>) => Promise<void>;
}) {
  const { toast } = useToast();

  const [details, setDetails] = useState<Lead | null>(null);
  const [form, setForm] = useState<{
    contactName: string;
    email: string;
    status: LeadStatus;
    nextAction: string;
    nextActionAt: string;
    custom: Record<string, any>;
  } | null>(null);

  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [tenantQ, setTenantQ] = useState<QField[]>([]);
  const [emailDetails, setEmailDetails] = useState<EmailDetails | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotePrep, setQuotePrep] = useState(false);

  // action states
  const [sendingInfo, setSendingInfo] = useState(false);
  const [sendingSupplier, setSendingSupplier] = useState(false);

  // fetch authoritative details when opened
  useEffect(() => {
    if (!open || !leadPreview) return;

    // seed form from preview for instant UI
    setForm({
      contactName: leadPreview.contactName ?? "",
      email: (leadPreview.email ?? "") as string,
      status: leadPreview.status,
      nextAction: leadPreview.nextAction ?? "",
      nextActionAt: leadPreview.nextActionAt
        ? new Date(leadPreview.nextActionAt).toISOString().slice(0, 16)
        : "",
      custom: { ...(leadPreview.custom || {}) },
    });

    (async () => {
      try {
        const raw = await apiFetch<any>(`/leads/${leadPreview.id}`);
        const d: Lead = (raw && (raw.lead ?? raw)) as Lead;
        setDetails(d);
        setForm({
          contactName: d.contactName ?? "",
          email: d.email ?? "",
          status: d.status,
          nextAction: d.nextAction ?? "",
          nextActionAt: d.nextActionAt
            ? new Date(d.nextActionAt).toISOString().slice(0, 16)
            : "",
          custom: { ...(d.custom || {}) },
        });

        const defs = await apiFetch<FieldDef[]>("/leads/fields");
        setFieldDefs(defs);

        const s = await apiFetch<TenantSettings>("/tenant/settings");
        setTenantQ((s.questionnaire ?? []) as QField[]);

        const provider = d.custom?.provider;
        const messageId = d.custom?.messageId as string | undefined;
        if (provider === "gmail" && messageId) {
          try {
            setLoadingEmail(true);
            const msg = await apiFetch<EmailDetails>(`/gmail/message/${messageId}`);
            setEmailDetails(msg);
          } catch {
            setEmailDetails(null);
          } finally {
            setLoadingEmail(false);
          }
        } else {
          setEmailDetails(null);
        }
      } catch (e) {
        console.error("LeadModal load failed:", e);
      }
    })();
  }, [open, leadPreview]);

  useEffect(() => {
    setQuotePrep((form?.status ?? leadPreview?.status) === "READY_TO_QUOTE");
  }, [form?.status, leadPreview?.status]);

  const allLabeledFields = useMemo(() => {
    const map = new Map<string, string>();
    fieldDefs.forEach((f) => map.set(f.key, f.label));
    (tenantQ || []).forEach((q) => {
      if (!map.has(q.key)) map.set(q.key, q.label || q.key);
    });
    return map;
  }, [fieldDefs, tenantQ]);

  // -------- helper: compute missing required questionnaire keys (above early return) --------
  const missingRequiredQ = useMemo(() => {
    const required = (tenantQ || []).filter((q) => q.required);
    const custom = form?.custom || {};
    return required
      .filter((q) => {
        const v = custom[q.key];
        return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
      })
      .map((q) => q.key);
  }, [tenantQ, form?.custom]);

  if (!open || !leadPreview || !form) return null;

  async function commit(patch: Partial<Lead>) {
    setSaving(true);
    await onAutoSave(leadPreview!.id, patch);
    setSaving(false);
  }

  /* ---------- ACTIONS (exact endpoints) ---------- */

  async function handleRequestInfo() {
    if (!details?.id) return;
    setSendingInfo(true);
    try {
      // Call API (no body required by your server)
      await apiFetch(`/leads/${encodeURIComponent(details.id)}/request-info`, {
        method: "POST",
        json: {},
      });

      // Update local state + DB status
      if (form?.status !== "INFO_REQUESTED") {
        await commit({ status: "INFO_REQUESTED" });
        setForm((f) => (f ? { ...f, status: "INFO_REQUESTED" } : f));
      }

      toast({
        title: "Info request sent",
        description:
          missingRequiredQ.length
            ? `Asked for: ${missingRequiredQ.join(", ")}`
            : "Asked client to complete the questionnaire.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Failed to send info request",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingInfo(false);
    }
  }

  async function handleSendOutsourcingEmail() {
    if (!details?.id) return;
    setSendingSupplier(true);
    try {
      // Get 'to' address (required by API)
      let to: string | null =
        (form?.custom?.lastSupplierEmailTo as string | undefined)?.trim() || null;
      if (!to) {
        // Ask the user just once if not remembered
        to = window.prompt("Supplier email to send the quote request to?")?.trim() || null;
      }
      if (!to) throw new Error("Supplier email is required.");

      // Optional fields payload
      const fields = form?.custom?.lastSupplierFields || undefined;

      // Optional attachments (Gmail)
      const messageId = (form?.custom?.messageId as string | undefined) || undefined;
      const gmailAtts = (emailDetails?.attachments || []).map((a) => ({
        source: "gmail" as const,
        messageId: messageId!,
        attachmentId: a.attachmentId!,
      }));
      const attachments =
        messageId && gmailAtts.length ? gmailAtts : undefined;

      // POST to the exact route your API exposes
      await apiFetch(`/leads/${encodeURIComponent(details.id)}/request-supplier-quote`, {
        method: "POST",
        json: { to, fields, attachments },
      });

      // Persist breadcrumbs locally (subject may be set server-side)
      await commit({
        custom: {
          ...(form?.custom || {}),
          lastSupplierEmailTo: to,
          lastSupplierEmailSubject:
            (form?.custom?.lastSupplierEmailSubject as string) || undefined,
          lastSupplierFields: fields || null,
        } as any,
      });

      toast({
        title: "Outsourcing email sent",
        description: `Sent to ${to}`,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Failed to send outsourcing email",
        description: e?.message || "Please check details and try again.",
        variant: "destructive",
      });
    } finally {
      setSendingSupplier(false);
    }
  }

  /* ---------- RENDER ---------- */

  function renderCustomGrid(style: "compact" | "spacious" = "compact") {
    const systemKeys = new Set([
      "provider",
      "messageId",
      "subject",
      "from",
      "summary",
      "full",
      "body",
      "date",
      "uiStatus",
      "lastSupplierEmailTo",
      "lastSupplierEmailSubject",
      "lastSupplierFields",
      "lastSupplierAttachmentCount",
      "description",
      "threadId",
    ]);

    const entries = Object.entries(form!.custom || {}).filter(([k]) => !systemKeys.has(k));
    if (!entries.length) {
      return <div className="text-xs text-slate-500">No extra fields yet.</div>;
    }

    const gridClass =
      style === "spacious"
        ? "grid grid-cols-1 md:grid-cols-2 gap-4"
        : "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3";

    return (
      <div className={gridClass}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              {allLabeledFields.get(k) || k}
            </div>
            <div className="text-sm text-slate-900 max-w-[22rem] break-words">{String(v)}</div>
          </div>
        ))}
      </div>
    );
  }

  const bodyText =
    emailDetails?.bodyText ??
    (form?.custom?.full as string | undefined) ??
    (form?.custom?.body as string | undefined) ??
    "";

  const LeadSourceBlock = () => {
    const current = (form?.custom?.source as string | undefined) ?? null;
    const leadId = details?.id ?? leadPreview.id;

    const handleSaved = (next: string | null) => {
      const updated: Record<string, any> = { ...(form?.custom || {}) };
      if (next && next.trim()) updated.source = next;
      else delete updated.source;
      setForm((f) => (f ? { ...f, custom: updated } : f));
    };

    return (
      <div className="mt-5">
        <div className="mb-1 text-xs text-slate-600">Lead Source</div>
        <LeadSourcePicker leadId={leadId} value={current} onSaved={handleSaved} />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl p-0 overflow-hidden rounded-2xl shadow-2xl">
        {/* HEADER STRIP */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-500/10 to-fuchsia-500/10" />
          <DialogHeader className="relative p-5 md:p-6">
            <DialogTitle className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-semibold shadow">
                {avatarText(form.contactName)}
              </span>

              <div className="flex-1 min-w-0">
                <input
                  className="w-full max-w-full rounded-lg border bg-white/90 p-2 text-base outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Name"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f!, contactName: e.target.value }))}
                  onBlur={(e) => commit({ contactName: e.target.value })}
                />
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                  <span>{saving ? "Saving…" : "Auto-saved"}</span>
                  <span className="text-slate-400">•</span>
                  {/* Status pill (readable) + select control */}
                  <span className="rounded-full border px-2 py-0.5 bg-white text-slate-700">
                    {STATUS_LABELS[form.status]}
                  </span>
                  <select
                    className="ml-2 rounded-md border bg-white p-1.5 text-xs outline-none focus:ring-2"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f!, status: e.target.value as LeadStatus }))}
                    onBlur={(e) => commit({ status: e.target.value as LeadStatus })}
                  >
                    {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    className="ml-auto h-7 px-2 text-xs"
                    onClick={() => setQuotePrep((v) => !v)}
                  >
                    {quotePrep ? "Standard View" : "Quote Prep View"}
                  </Button>
                </div>
              </div>
            </DialogTitle>

            <DialogDescription className="sr-only">
              Lead details, email context, questionnaire fields and actions.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* BODY */}
        <div className="px-5 md:px-6 pb-6 overflow-y-auto max-h-[75vh]">
          {quotePrep ? (
            <>
              <Section title="Customer">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LabeledInput
                    label="Email"
                    value={form.email}
                    onChange={(v) => setForm((f) => ({ ...f!, email: v }))}
                    onBlurCommit={(v) => commit({ email: v || null })}
                    type="email"
                  />
                  <LabeledInput
                    label="Next Action"
                    value={form.nextAction}
                    onChange={(v) => setForm((f) => ({ ...f!, nextAction: v }))}
                    onBlurCommit={(v) => commit({ nextAction: v || null })}
                  />
                  <LabeledInput
                    label="Next Action At"
                    value={form.nextActionAt}
                    onChange={(v) => setForm((f) => ({ ...f!, nextActionAt: v }))}
                    onBlurCommit={(v) =>
                      commit({ nextActionAt: v ? new Date(v).toISOString() : null })
                    }
                    type="datetime-local"
                  />
                </div>
                <LeadSourceBlock />
              </Section>

              <Section title="Project / Questionnaire">{renderCustomGrid("spacious")}</Section>

              <Section title="Files">
                <AttachmentsGrid
                  messageId={(form.custom?.messageId as string | undefined) || ""}
                  attachments={emailDetails?.attachments || []}
                />
              </Section>

              <Section title="Email Thread">
                <EmailMeta emailDetails={emailDetails} form={form} />
                <EmailBody bodyText={bodyText} loading={loadingEmail} />
              </Section>
            </>
          ) : (
            <>
              <Section title="Email">
                <EmailMeta emailDetails={emailDetails} form={form} />
                <EmailBody bodyText={bodyText} loading={loadingEmail} />
                <AttachmentsGrid
                  messageId={(form.custom?.messageId as string | undefined) || ""}
                  attachments={emailDetails?.attachments || []}
                />
              </Section>

              <Section title="Contact">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LabeledInput
                    label="Email"
                    value={form.email}
                    onChange={(v) => setForm((f) => ({ ...f!, email: v }))}
                    onBlurCommit={(v) => commit({ email: v || null })}
                    type="email"
                  />
                  <LabeledInput
                    label="Next Action"
                    value={form.nextAction}
                    onChange={(v) => setForm((f) => ({ ...f!, nextAction: v }))}
                    onBlurCommit={(v) => commit({ nextAction: v || null })}
                  />
                  <LabeledInput
                    label="Next Action At"
                    value={form.nextActionAt}
                    onChange={(v) => setForm((f) => ({ ...f!, nextActionAt: v }))}
                    onBlurCommit={(v) =>
                      commit({ nextActionAt: v ? new Date(v).toISOString() : null })
                    }
                    type="datetime-local"
                  />
                </div>
                <LeadSourceBlock />
              </Section>

              <Section title="All Fields">{renderCustomGrid("compact")}</Section>
            </>
          )}
        </div>

        {/* FOOTER */}
        <DialogFooter className="gap-2 p-4 border-t bg-white/90 backdrop-blur">
          {/* Request Info */}
          <Button
            variant="secondary"
            className="shadow-sm"
            onClick={handleRequestInfo}
            disabled={sendingInfo || saving}
          >
            {sendingInfo ? "Sending…" : "Request Info"}
          </Button>

          {/* Send Outsourcing Email */}
          <Button
            variant="default"
            className="shadow-sm"
            onClick={handleSendOutsourcingEmail}
            disabled={sendingSupplier || saving}
          >
            {sendingSupplier ? "Emailing…" : "Send Outsourcing Email"}
          </Button>

          {/* Reject */}
          {form.status !== "REJECTED" && (
            <Button
              variant="destructive"
              className="shadow-sm"
              onClick={() => commit({ status: "REJECTED" })}
            >
              ✕ Reject
            </Button>
          )}

          <div className="flex-1" />
          <Button onClick={() => onOpenChange(false)} className="shadow-sm">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* —————— UI bits —————— */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white/90 shadow-[0_12px_30px_-18px_rgba(2,6,23,0.35)] p-4 md:p-5 mb-4">
      <div className="mb-3 text-[11px] font-semibold tracking-wide uppercase text-slate-600">
        {title}
      </div>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  type = "text",
  value,
  onChange,
  onBlurCommit,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onBlurCommit?: (v: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <input
        className="w-full max-w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlurCommit?.(e.target.value)}
      />
    </label>
  );
}

function EmailMeta({ emailDetails, form }: { emailDetails: EmailDetails | null; form: any }) {
  const from = emailDetails?.from ?? form?.custom?.from;
  const date = emailDetails?.date ?? form?.custom?.date;
  const subject = emailDetails?.subject ?? form?.custom?.subject;
  return from || date || subject || form?.custom?.description ? (
    <div className="mb-2 text-[11px] text-slate-600 space-y-0.5">
      {subject && <div><span className="text-slate-500">Subject:</span> {subject}</div>}
      {from && <div><span className="text-slate-500">From:</span> {from}</div>}
      {date && <div><span className="text-slate-500">Date:</span> {date}</div>}
      {form?.custom?.description && (
        <div className="italic text-slate-500">Description: {form.custom.description}</div>
      )}
    </div>
  ) : null;
}

function EmailBody({ bodyText, loading }: { bodyText: string; loading: boolean }) {
  const [show, setShow] = useState(false);
  if (loading) {
    return <div className="text-xs text-slate-500">Loading email…</div>;
  }
  if (!bodyText) return null;
  return (
    <div className="mb-4">
      <button
        className="text-xs text-blue-600 underline mb-2 hover:text-blue-700"
        onClick={() => setShow((v) => !v)}
      >
        {show ? "Hide full email" : "Show full email"}
      </button>
      {show && (
        <div className="rounded-lg border bg-white p-3 text-sm leading-relaxed shadow-inner max-h-[50vh] overflow-auto whitespace-pre-wrap break-words">
          {bodyText}
        </div>
      )}
    </div>
  );
}

function AttachmentsGrid({
  messageId,
  attachments,
}: {
  messageId?: string;
  attachments: { attachmentId?: string; filename?: string; size?: number }[];
}) {
  if (!messageId || !attachments?.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {attachments.map((att, i) => {
        const attachmentId = att.attachmentId;
        if (!attachmentId) return null;
        const href = attachmentUrl(messageId, attachmentId);
        const sizeLabel =
          typeof att.size === "number" ? ` • ${Math.round(att.size / 1024)} KB` : "";
        return (
          <a
            key={`${attachmentId}-${i}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-xl border bg-white ring-1 ring-slate-200 hover:ring-blue-300/60 hover:bg-blue-50/40 hover:shadow-[0_10px_25px_-12px_rgba(37,99,235,0.35)] transition-all"
            title={att.filename || "Attachment"}
          >
            <div className="flex items-center gap-2 p-2">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow">
                📎
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-slate-800">
                  {att.filename || "Attachment"}
                </div>
                <div className="text-[11px] text-slate-500">{sizeLabel}</div>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function avatarText(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}