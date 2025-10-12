"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

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

  const [quotePrep, setQuotePrep] = useState(false); // special layout when READY_TO_QUOTE

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
        // 1) Lead (full)
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

        // 2) Lead field defs
        const defs = await apiFetch<FieldDef[]>("/leads/fields");
        setFieldDefs(defs);

        // 3) Tenant questionnaire (private settings)
        const s = await apiFetch<TenantSettings>("/tenant/settings");
        setTenantQ((s.questionnaire ?? []) as QField[]);

        // 4) Email details (if gmail source)
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
    // auto switch to quote prep view when status is READY_TO_QUOTE
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

if (!open || !leadPreview || !form) return null;


  async function commit(patch: Partial<Lead>) {
    setSaving(true);
    await onAutoSave(leadPreview!.id, patch);
    setSaving(false);
  }

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
      "description", // we *do* show this elsewhere in email/summary area
    ]);

    const entries = Object.entries(form!.custom || {}).filter(([k]) => !systemKeys.has(k));
    if (!entries.length) {
      return <div className="text-xs text-slate-500">No extra fields yet.</div>;
    }

    const gridClass =
      style === "spacious"
        ? "grid grid-cols-1 md:grid-cols-2 gap-3"
        : "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2";

    return (
      <div className={gridClass}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3">
            <div className="text-xs text-slate-500">{allLabeledFields.get(k) || k}</div>
            <div className="text-sm text-slate-900 max-w-[18rem] break-words">{String(v)}</div>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl p-0">
        <div className="max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="p-4 md:p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium">
                {avatarText(form.contactName)}
              </span>
              <input
                className="w-full max-w-full rounded-md border p-2 text-base outline-none focus:ring-2"
                placeholder="Name"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f!, contactName: e.target.value }))}
                onBlur={(e) => commit({ contactName: e.target.value })}
              />
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {saving ? "Saving…" : "Changes are saved automatically"}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-600">Status: {STATUS_LABELS[form.status]}</span>
              <Button
                variant="outline"
                className="ml-2 h-7 px-2 text-xs"
                onClick={() => setQuotePrep((v) => !v)}
              >
                {quotePrep ? "Standard View" : "Quote Prep View"}
              </Button>
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 md:px-6 pb-6 overflow-y-auto">
            {quotePrep ? (
              <>
                {/* QUOTE PREP VIEW */}
                <Section title="Customer">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                </Section>

                <Section title="Project / Questionnaire">
                  {renderCustomGrid("spacious")}
                </Section>

                <Section title="Files">
                  <AttachmentsGrid
                    messageId={(form.custom?.messageId as string | undefined) || ""}
                    attachments={emailDetails?.attachments || []}
                  />
                </Section>

                <Section title="Email Thread">
                  <EmailMeta emailDetails={emailDetails} form={form} />
                  <EmailBody bodyText={bodyText} />
                </Section>
              </>
            ) : (
              <>
                {/* STANDARD VIEW */}
                <Section title="Email">
                  <EmailMeta emailDetails={emailDetails} form={form} />
                  <EmailBody bodyText={bodyText} />
                  <AttachmentsGrid
                    messageId={(form.custom?.messageId as string | undefined) || ""}
                    attachments={emailDetails?.attachments || []}
                  />
                </Section>

                <Section title="Contact">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <LabeledInput
                      label="Email"
                      value={form.email}
                      onChange={(v) => setForm((f) => ({ ...f!, email: v }))}
                      onBlurCommit={(v) => commit({ email: v || null })}
                      type="email"
                    />
                    <LabeledSelect
                      label="Status"
                      value={form.status}
                      options={(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => ({
                        label: STATUS_LABELS[s],
                        value: s,
                      }))}
                      onChange={(v) => setForm((f) => ({ ...f!, status: v as LeadStatus }))}
                      onCommit={(v) => commit({ status: v as LeadStatus })}
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
                </Section>

                <Section title="All Fields">
                  {renderCustomGrid("compact")}
                </Section>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 p-4 border-t bg-white">
            {form.status !== "REJECTED" && (
              <Button variant="destructive" onClick={() => commit({ status: "REJECTED" })}>
                ✕ Reject
              </Button>
            )}
            {form.status !== "INFO_REQUESTED" && (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await apiFetch(`/leads/${leadPreview.id}/request-info`, { method: "POST" });
                    await commit({ status: "INFO_REQUESTED" });
                  } catch {
                    // ignore
                  }
                }}
              >
                📋 Request Info
              </Button>
            )}
            {form.status !== "READY_TO_QUOTE" && (
              <Button variant="secondary" onClick={() => commit({ status: "READY_TO_QUOTE" })}>
                ✅ Ready to Quote
              </Button>
            )}
            <div className="flex-1" />
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* —————— dumb UI bits —————— */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-3 mb-3">
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-600">{title}</div>
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

function LabeledSelect({
  label,
  value,
  options,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="text-xs text-slate-600">{label}</div>
      <select
        className="w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit?.(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmailMeta({ emailDetails, form }: { emailDetails: EmailDetails | null; form: any }) {
  const from = emailDetails?.from ?? form?.custom?.from;
  const date = emailDetails?.date ?? form?.custom?.date;
  const subject = emailDetails?.subject ?? form?.custom?.subject;
  return (from || date || subject || form?.custom?.description) ? (
    <div className="mb-2 text-[11px] text-slate-600 space-y-0.5">
      {subject && <div>Subject: {subject}</div>}
      {from && <div>From: {from}</div>}
      {date && <div>Date: {date}</div>}
      {form?.custom?.description && (
        <div className="italic text-slate-500">Description: {form.custom.description}</div>
      )}
    </div>
  ) : null;
}

function EmailBody({ bodyText }: { bodyText: string }) {
  const [show, setShow] = useState(false);
  if (!bodyText) return null;
  return (
    <div className="mb-3">
      <button className="text-xs text-blue-600 underline mb-2" onClick={() => setShow((v) => !v)}>
        {show ? "Hide full email" : "Show full email"}
      </button>
      {show && (
        <div className="rounded-md border bg-white/60 p-3 text-sm leading-relaxed shadow-inner max-h-[50vh] overflow-auto whitespace-pre-wrap break-words">
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
  attachments: { id?: string; attachmentId?: string; filename?: string; size?: number }[];
}) {
  if (!messageId || !attachments?.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {attachments.map((att) => {
        const attachmentId = att.attachmentId || att.id;
        if (!attachmentId) return null;
        const href = attachmentUrl(messageId, attachmentId);
        const sizeLabel =
          typeof att.size === "number" ? ` (${Math.round(att.size / 1024)} KB)` : "";
        return (
          <a
            key={attachmentId}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border p-2 hover:bg-slate-50"
            title={att.filename || "Attachment"}
          >
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-slate-100">
              📎
            </span>
            <span className="truncate text-xs">
              {att.filename || "Attachment"}
              {sizeLabel}
            </span>
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