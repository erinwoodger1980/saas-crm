"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";

/* Public API helper (no auth) */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

async function getJSON<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return (await r.json()) as T;
}
async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
  return (await r.json()) as T;
}

/* Types */
type QField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  required?: boolean;
  options?: string[];
};
type TenantSettings = {
  tenantId: string;
  slug: string;
  brandName: string;
  introHtml?: string | null;
  website?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  links?: { label: string; url: string }[] | null;
  questionnaire?: QField[] | null;
};
type PublicLead = {
  lead: {
    id: string;
    contactName: string;
    custom: Record<string, any>;
  };
};

export default function PublicQuestionnairePage() {
  const router = useRouter();
  const { tenant: slug = "", id: leadId = "" } = useParams<{ tenant: string; id: string }>() ?? {};

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [lead, setLead] = useState<PublicLead["lead"] | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const firstErrorRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!slug || !leadId) return;
    let mounted = true;
    (async () => {
      try {
        setBanner(null);
        setLoading(true);
        const [s, l] = await Promise.all([
          getJSON<TenantSettings>(`/public/tenant/by-slug/${encodeURIComponent(slug)}`),
          getJSON<PublicLead>(`/public/leads/${encodeURIComponent(leadId)}`),
        ]);
        if (!mounted) return;
        setSettings(s);
        setLead(l.lead);
        setAnswers(l.lead?.custom ?? {});
      } catch (e: any) {
        setBanner(e?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, leadId]);

  const questions: QField[] = useMemo(
    () => (settings?.questionnaire ?? []).filter(Boolean),
    [settings]
  );

  function set(k: string, v: any) {
    setAnswers((prev) => ({ ...prev, [k]: v }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const q of questions) {
      const val = answers[q.key];
      if (q.required && (val === undefined || val === null || String(val).trim() === "")) {
        next[q.key] = "This field is required.";
      }
    }
    setErrors(next);

    // Focus + scroll to first invalid field
    if (Object.keys(next).length > 0 && firstErrorRef.current) {
      firstErrorRef.current.focus();
      firstErrorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setBanner(Object.keys(next).length ? "Please fix the highlighted fields." : null);
    return Object.keys(next).length === 0;
  }

  async function filesToBase64(list: File[]): Promise<
    Array<{ filename: string; mimeType: string; base64: string }>
  > {
    const reads = list.map(
      (f) =>
        new Promise<{ filename: string; mimeType: string; base64: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || "");
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve({ filename: f.name, mimeType: f.type || "application/octet-stream", base64 });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(f);
        })
    );
    return Promise.all(reads);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || !lead) return;

    if (!validate()) return;

    try {
      setSubmitting(true);
      setBanner(null);

      const uploads = await filesToBase64(files);
      await postJSON(`/public/leads/${encodeURIComponent(lead.id)}/submit-questionnaire`, {
        answers,
        uploads, // optional
      });

      router.push("/thank-you");
    } catch (e: any) {
      setBanner(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  /* UI */
  if (!slug || !leadId) return <Shell><div className="text-sm text-slate-600">Preparing…</div></Shell>;
  if (loading) return <Shell><div className="text-sm text-slate-600">Loading…</div></Shell>;

  return (
    <Shell>
      {settings && (
        <>
          <div className="flex items-center gap-3 mb-2">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={`${settings.brandName} logo`}
                className="h-12 w-12 rounded-md border object-contain bg-white"
              />
            ) : (
              <div className="h-12 w-12 rounded-md border grid place-items-center text-slate-400 bg-white">
                Logo
              </div>
            )}
            <h1 className="text-2xl font-semibold">
              {settings.brandName || "Company"} – Project Questionnaire
            </h1>
          </div>
          <div className="h-px bg-slate-200 mb-6" />
          {settings.introHtml ? (
            <div
              className="prose prose-sm max-w-none mb-6 text-slate-700"
              dangerouslySetInnerHTML={{ __html: settings.introHtml }}
            />
          ) : null}
        </>
      )}

      {banner ? (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {banner}
        </div>
      ) : null}

      {lead ? (
        <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
          <fieldset className="rounded-xl border bg-white p-4 space-y-4">
            <legend className="px-1 text-sm font-medium text-slate-700">
              Your project details
            </legend>

            {questions.length === 0 ? (
              <div className="text-sm text-slate-500">No questions yet.</div>
            ) : (
              questions.map((q, idx) => {
                const hasErr = !!errors[q.key];
                const commonProps = {
                  ref: idx === 0 ? firstErrorRef : null,
                  "aria-invalid": hasErr || undefined,
                  "aria-describedby": hasErr ? `${q.key}-err` : undefined,
                } as any;

                return (
                  <div key={q.key} className="space-y-1.5">
                    <label className="block text-sm text-slate-700">
                      {q.label || q.key}
                      {q.required ? <span className="text-red-500"> *</span> : null}
                    </label>

                    {q.type === "textarea" ? (
                      <textarea
                        {...commonProps}
                        className={`input min-h-[120px] ${hasErr ? "border-red-300 focus:ring-red-300" : ""}`}
                        value={valueOrEmpty(answers[q.key])}
                        onChange={(e) => set(q.key, e.target.value)}
                      />
                    ) : q.type === "select" ? (
                      <select
                        {...commonProps}
                        className={`input ${hasErr ? "border-red-300 focus:ring-red-300" : ""}`}
                        value={valueOrEmpty(answers[q.key])}
                        onChange={(e) => set(q.key, e.target.value)}
                      >
                        <option value="">Select…</option>
                        {(q.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...commonProps}
                        type={q.type === "number" ? "number" : "text"}
                        className={`input ${hasErr ? "border-red-300 focus:ring-red-300" : ""}`}
                        value={valueOrEmpty(answers[q.key])}
                        onChange={(e) => set(q.key, e.target.value)}
                      />
                    )}

                    {hasErr ? (
                      <div id={`${q.key}-err`} className="text-xs text-red-600">
                        {errors[q.key]}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </fieldset>

          {/* Uploads */}
          <fieldset className="rounded-xl border bg-white p-4 space-y-2">
            <legend className="px-1 text-sm font-medium text-slate-700">
              Supporting files (photos, drawings)
            </legend>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.currentTarget.files || []))}
            />
            {!!files.length && (
              <div className="text-xs text-slate-600">
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </div>
            )}
            <div className="text-xs text-slate-500">
              Max few files for now; we’ll attach them to your enquiry.
            </div>
          </fieldset>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[rgb(var(--brand))] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
            <a href={settings?.website || "#"} className="rounded-md border px-4 py-2 text-sm">
              Cancel
            </a>
          </div>
        </form>
      ) : (
        <div className="text-sm text-red-600">Unknown lead.</div>
      )}

      <style jsx global>{`
        .input { @apply w-full rounded-md border bg-white p-2 text-sm outline-none focus:ring-2; }
      `}</style>
    </Shell>
  );
}

/* helpers */
function valueOrEmpty(v: any) { return v == null ? "" : String(v); }
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto p-6">{children}</div>
    </div>
  );
}