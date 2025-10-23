// web/src/app/leads/DeclineEnquiryButton.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, API_BASE, getJwt } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import {
  DEFAULT_DECLINE_EMAIL_TEMPLATE,
  DeclineEmailTemplate,
  normalizeDeclineEmailTemplate,
  personalizeDeclineTemplate,
} from "@/lib/decline-email";

type LeadLite = {
  id: string;
  contactName?: string | null;
  email?: string | null;
  title?: string | null;
  description?: string | null;
  custom?: Record<string, any> | null;
};

type Props = {
  lead: LeadLite;
  disabled?: boolean;
  authHeaders?: HeadersInit;
  onMarkedRejected?: () => Promise<boolean | void> | boolean | void;
  brandName?: string | null;
  className?: string;
};

function normalizeHeaders(source?: HeadersInit): Record<string, string> | undefined {
  if (!source) return undefined;
  if (source instanceof Headers) {
    const out: Record<string, string> = {};
    source.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(source)) {
    const out: Record<string, string> = {};
    for (const [key, value] of source) {
      if (key) out[key] = value;
    }
    return out;
  }
  return { ...(source as Record<string, string>) };
}

function firstString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function inferProjectName(lead: LeadLite): string {
  const custom = lead.custom ?? {};
  return firstString(
    lead.title,
    custom.projectName,
    custom.project,
    custom.projectTitle,
    custom.project_address,
    custom.projectAddress,
    custom.address,
    custom.siteAddress,
    custom.site_address,
    custom.location,
    custom.subject,
    lead.description,
  );
}

function readLocalStorage(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function collectPersonalisation(lead: LeadLite, brandName?: string | null) {
  const inferredProject = inferProjectName(lead);
  const contactName = firstString(lead.contactName, lead.email?.split("@")[0]);

  return {
    project: inferredProject,
    clientName: contactName,
    yourName: firstString(readLocalStorage("userName")),
    yourPosition: firstString(readLocalStorage("userPosition")),
    company: firstString(brandName, readLocalStorage("companyName")),
    phone: firstString(readLocalStorage("companyPhone")),
    emailOrSite: firstString(readLocalStorage("companyEmailOrSite")),
  };
}

export default function DeclineEnquiryButton({
  lead,
  disabled,
  authHeaders,
  onMarkedRejected,
  brandName,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<DeclineEmailTemplate>(
    () => ({ ...DEFAULT_DECLINE_EMAIL_TEMPLATE }),
  );
  const [draft, setDraft] = useState<DeclineEmailTemplate>(() => ({ ...DEFAULT_DECLINE_EMAIL_TEMPLATE }));
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateRef = useRef<DeclineEmailTemplate>({ ...DEFAULT_DECLINE_EMAIL_TEMPLATE });
  useEffect(() => {
    templateRef.current = template;
  }, [template]);

  const baseHeaders = useMemo(() => normalizeHeaders(authHeaders), [authHeaders]);
  const [authIds, setAuthIds] = useState(() => getAuthIdsFromJwt());

  useEffect(() => {
    if (open) {
      setAuthIds(getAuthIdsFromJwt());
    }
  }, [open]);

  const tenantId = useMemo(() => {
    const fromHeader = baseHeaders?.["x-tenant-id"];
    return fromHeader || authIds?.tenantId || "";
  }, [baseHeaders, authIds]);

  const userId = useMemo(() => {
    const fromHeader = baseHeaders?.["x-user-id"];
    return fromHeader || authIds?.userId || "";
  }, [baseHeaders, authIds]);

  const effectiveHeaders = useMemo(() => {
    if (!baseHeaders && !tenantId && !userId) return undefined;
    const out: Record<string, string> = { ...(baseHeaders ?? {}) };
    if (tenantId) out["x-tenant-id"] = tenantId;
    if (userId) out["x-user-id"] = userId;
    return Object.keys(out).length ? out : undefined;
  }, [baseHeaders, tenantId, userId]);

  const loadTemplate = useCallback(async () => {
    setLoadingTemplate(true);
    setError(null);
    const personalization = collectPersonalisation(lead, brandName);

    try {
      if (!tenantId || !effectiveHeaders) {
        const fallback = { ...templateRef.current };
        setTemplate(fallback);
        setDraft(personalizeDeclineTemplate(fallback, personalization));
        return;
      }

      const response = await apiFetch<{ template?: Partial<DeclineEmailTemplate> }>(
        `/tenants/${tenantId}/decline-email`,
        { headers: effectiveHeaders },
      );
      const normalized = normalizeDeclineEmailTemplate(response?.template);
      setTemplate(normalized);
      setDraft(personalizeDeclineTemplate(normalized, personalization));
    } catch (err: any) {
      const fallback = { ...DEFAULT_DECLINE_EMAIL_TEMPLATE };
      setTemplate(fallback);
      setDraft(personalizeDeclineTemplate(fallback, personalization));
      setError(err?.message || "Using default decline template.");
    } finally {
      setLoadingTemplate(false);
    }
  }, [tenantId, effectiveHeaders, lead, brandName]);

  useEffect(() => {
    if (!open) return;
    void loadTemplate();
  }, [open, loadTemplate]);

  const buttonClasses = useMemo(() => {
    const base =
      "flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-semibold shadow-sm hover:bg-white";
    return className ? `${base} ${className}` : base;
  }, [className]);

  function handleOpen() {
    if (disabled) return;
    const personalization = collectPersonalisation(lead, brandName);
    const preview = personalizeDeclineTemplate(template, personalization);
    setDraft(preview);
    setError(null);
    setOpen(true);
  }

  async function sendMailViaBackend(subject: string, body: string) {
    if (!lead.email) throw new Error("Lead has no email address.");
    const jwt = getJwt();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(effectiveHeaders ?? {}),
    };
    if (jwt) headers.Authorization = `Bearer ${jwt}`;

    // apiFetch will throw on non-ok responses and supports sending custom headers
    await apiFetch(`${API_BASE}/mail/send`, {
      method: "POST",
      headers,
      credentials: "omit",
      json: { to: lead.email, subject, text: body },
    });
  }

  async function markLeadRejected() {
    if (!lead.id) throw new Error("Missing lead id.");
    if (onMarkedRejected) {
      const result = await onMarkedRejected();
      if (result === false) {
        throw new Error("Lead update cancelled.");
      }
      return;
    }
    if (!effectiveHeaders) throw new Error("Missing tenant context.");
    await apiFetch(`/leads/${lead.id}`, {
      method: "PATCH",
      headers: effectiveHeaders,
      json: { status: "REJECTED", nextAction: null },
    });
  }

  async function handleConfirm() {
    if (!lead.email) {
      setError("Lead has no email address.");
      return;
    }

    const subject = (draft.subject || template.subject).trim() || template.subject;
    const body = (draft.body || template.body).trim() || template.body;

    setSending(true);
    setError(null);
    try {
      try {
        await sendMailViaBackend(subject, body);
      } catch {
        const to = encodeURIComponent(lead.email ?? "");
        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);
        window.location.href = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
      }

      await markLeadRejected();
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to send decline email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || !lead?.email || !lead?.id}
        className={buttonClasses}
        title="Gently declines the enquiry while keeping the door open for future projects."
      >
        <span aria-hidden="true">🛑</span>
        Gently decline enquiry
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!sending) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Review decline email</h3>
            <p className="text-sm text-slate-500">We’ll send this email and mark the lead as rejected.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="decline-to">
                  To
                </label>
                <input
                  id="decline-to"
                  value={lead.email ?? ""}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="decline-review-subject">
                  Subject
                </label>
                <input
                  id="decline-review-subject"
                  value={draft.subject}
                  onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="decline-review-body">
                  Body
                </label>
                <textarea
                  id="decline-review-body"
                  value={draft.body}
                  onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                  className="mt-1 h-64 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              {loadingTemplate && (
                <p className="text-xs text-slate-400">Loading saved template…</p>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setOpen(false)}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleConfirm}
                disabled={sending || !lead?.email}
              >
                {sending ? "Sending…" : "Send & mark rejected"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
