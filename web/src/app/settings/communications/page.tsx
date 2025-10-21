// web/src/app/settings/communications/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthIdsFromJwt } from "@/lib/auth";
import {
  DEFAULT_DECLINE_EMAIL_TEMPLATE,
  DeclineEmailTemplate,
  normalizeDeclineEmailTemplate,
} from "@/lib/decline-email";

export default function CommunicationsSettingsPage() {
  const [authIds] = useState(() => getAuthIdsFromJwt());
  const tenantId = authIds?.tenantId ?? "";
  const userId = authIds?.userId ?? "";

  const authHeaders = useMemo(() => {
    if (!tenantId || !userId) return undefined;
    return { "x-tenant-id": tenantId, "x-user-id": userId } as Record<string, string>;
  }, [tenantId, userId]);

  const [template, setTemplate] = useState<DeclineEmailTemplate>(DEFAULT_DECLINE_EMAIL_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    if (!tenantId || !authHeaders) {
      setLoading(false);
      setError("Missing tenant context.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await apiFetch<{ template?: Partial<DeclineEmailTemplate> }>(
        `/tenants/${tenantId}/decline-email`,
        { headers: authHeaders },
      );
      const normalized = normalizeDeclineEmailTemplate(response?.template);
      setTemplate(normalized);
    } catch (err: any) {
      setError(err?.message || "Failed to load template.");
      setTemplate(DEFAULT_DECLINE_EMAIL_TEMPLATE);
    } finally {
      setLoading(false);
    }
  }, [tenantId, authHeaders]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  async function handleSave() {
    if (!tenantId || !authHeaders) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await apiFetch<{ template?: Partial<DeclineEmailTemplate> }>(
        `/tenants/${tenantId}/decline-email`,
        {
          method: "PUT",
          headers: authHeaders,
          json: { template },
        },
      );
      const normalized = normalizeDeclineEmailTemplate(response?.template);
      setTemplate(normalized);
      setStatus("Saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!tenantId || !authHeaders) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await apiFetch<{ template?: Partial<DeclineEmailTemplate> }>(
        `/tenants/${tenantId}/decline-email/reset`,
        {
          method: "POST",
          headers: authHeaders,
        },
      );
      const normalized = normalizeDeclineEmailTemplate(response?.template);
      setTemplate(normalized);
      setStatus("Template reset to defaults.");
    } catch (err: any) {
      setError(err?.message || "Failed to reset template.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading…</div>;
  }

  if (!tenantId || !authHeaders) {
    return (
      <div className="p-6 text-sm text-red-600">
        Unable to determine tenant context. Please refresh after signing in.
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Communications</h1>
        <p className="text-sm text-slate-600">
          Manage the default copy used when declining enquiries.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Decline enquiry email</h2>
          <p className="text-sm text-slate-500">
            Gently declines the enquiry while keeping the door open for future projects.
          </p>
          <p className="text-xs text-slate-400">
            Available placeholders: [Project Name or Address], [Client’s Name], [Your Name], [Your Position],
            [Company Name], [Phone Number], [Email / Website]
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {status && !error && <p className="text-sm text-emerald-600">{status}</p>}

        <label className="block text-sm font-medium text-slate-700" htmlFor="decline-subject">
          Subject
        </label>
        <input
          id="decline-subject"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          value={template.subject}
          onChange={(event) => setTemplate((current) => ({ ...current, subject: event.target.value }))}
        />

        <label className="block text-sm font-medium text-slate-700" htmlFor="decline-body">
          Body
        </label>
        <textarea
          id="decline-body"
          className="mt-1 h-64 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          value={template.body}
          onChange={(event) => setTemplate((current) => ({ ...current, body: event.target.value }))}
        />

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset to defaults
          </button>
        </div>
      </section>
    </main>
  );
}
