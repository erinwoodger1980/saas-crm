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
  id?: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "source";
  required?: boolean;
  options?: string[];
  askInQuestionnaire?: boolean;
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

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function normalizeQuestions(raw: any): QField[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item: any) => {
      if (!item || typeof item !== "object") return null;
      const key = typeof item.key === "string" && item.key.trim() ? item.key.trim() : "";
      if (!key) return null;
      const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : key;
      const typeRaw = typeof item.type === "string" && item.type.trim() ? item.type.trim() : "text";
      const allowed: QField["type"][] = ["text", "textarea", "select", "number", "date", "source"];
      const type = allowed.includes(typeRaw as QField["type"]) ? (typeRaw as QField["type"]) : "text";
      const options =
        type === "select" && Array.isArray(item.options)
          ? item.options.map((opt: any) => String(opt || "").trim()).filter(Boolean)
          : undefined;
      return {
        id: typeof item.id === "string" ? item.id : undefined,
        key,
        label,
        type,
        required: Boolean(item.required),
        options,
        askInQuestionnaire: item.askInQuestionnaire !== false,
      } satisfies QField;
    })
    .filter((field): field is QField => Boolean(field?.key));
}

export default function PublicQuestionnairePage() {
  const router = useRouter();
  const { tenant: slug = "", id: leadId = "" } = useParams<{ tenant: string; id: string }>() ?? {};

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [lead, setLead] = useState<PublicLead["lead"] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [itemAnswers, setItemAnswers] = useState<Record<string, any>[]>(() => [
    {} as Record<string, any>,
  ]);
  const [itemErrors, setItemErrors] = useState<Record<string, string>[]>(() => [
    {} as Record<string, string>,
  ]);
  const [itemFiles, setItemFiles] = useState<File[][]>(() => [[]]);
  const fieldRefs = useRef<Record<string, FieldElement | null>>({});

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
        const custom =
          l.lead && typeof l.lead.custom === "object" && l.lead.custom !== null ? (l.lead.custom as any) : {};
        const existingItems = Array.isArray(custom.items) ? custom.items : [];
        const answers = existingItems.map((existing) => {
          if (existing && typeof existing === "object") {
            const rest = { ...(existing as Record<string, any>) };
            delete rest.photos;
            delete rest.itemNumber;
            return rest;
          }
          return {} as Record<string, any>;
        });
        if (!answers.length) {
          answers.push({} as Record<string, any>);
        }
        setItemAnswers(answers);
        setItemErrors(Array.from({ length: answers.length }, () => ({} as Record<string, string>)));
        setItemFiles(Array.from({ length: answers.length }, () => [] as File[]));
        fieldRefs.current = {};
      } catch (e: any) {
        setBanner(e?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, leadId]);

  const questions: QField[] = useMemo(
    () => normalizeQuestions((settings as any)?.questionnaire ?? []).filter((q) => q.askInQuestionnaire !== false),
    [settings]
  );

  const registerFieldRef = (fieldKey: string) => (el: FieldElement | null) => {
    if (el) {
      fieldRefs.current[fieldKey] = el;
    } else {
      delete fieldRefs.current[fieldKey];
    }
  };

  const setItemField = (itemIndex: number, key: string, value: any) => {
    setItemAnswers((prev) =>
      prev.map((item, idx) => (idx === itemIndex ? { ...item, [key]: value } : item))
    );
    setItemErrors((prev) =>
      prev.map((errs, idx) => {
        if (idx !== itemIndex || !errs[key]) return errs;
        const next = { ...errs };
        delete next[key];
        return next;
      })
    );
  };

  const handleItemFileChange = (itemIndex: number, fileList: FileList | null) => {
    const next = fileList ? Array.from(fileList).slice(0, 1) : [];
    setItemFiles((prev) => prev.map((files, idx) => (idx === itemIndex ? next : files)));
  };

  const clearItemFiles = (itemIndex: number) => {
    setItemFiles((prev) => prev.map((files, idx) => (idx === itemIndex ? [] : files)));
  };

  const addItem = () => {
    setItemAnswers((prev) => {
      const last = prev[prev.length - 1] ?? {};
      const entries = Object.entries(last).filter(([key]) => !key.toLowerCase().includes("size"));
      const base = Object.fromEntries(entries) as Record<string, any>;
      return [...prev, base];
    });
    setItemErrors((prev) => [...prev, {} as Record<string, string>]);
    setItemFiles((prev) => [...prev, [] as File[]]);
  };

  const hasItemContent = (idx: number) => {
    const item = itemAnswers[idx] ?? {};
    const hasValues = Object.values(item).some((val) => !isEmptyValue(val));
    const hasPhotos = (itemFiles[idx]?.length ?? 0) > 0;
    return hasValues || hasPhotos;
  };

  function makeFieldKey(itemIndex: number, key: string) {
    return `item-${itemIndex}-${key}`;
  }

  function validate(): boolean {
    if (questions.length === 0) {
      setItemErrors(itemAnswers.map(() => ({} as Record<string, string>)));
      setBanner(null);
      return true;
    }

    const next = itemAnswers.map(() => ({} as Record<string, string>));
    let firstInvalidKey: string | null = null;

    itemAnswers.forEach((_, itemIdx) => {
      const shouldValidate = itemIdx === 0 || hasItemContent(itemIdx);
      if (!shouldValidate) return;

      for (const q of questions) {
        const val = itemAnswers[itemIdx]?.[q.key];
        if (q.required && isEmptyValue(val)) {
          next[itemIdx][q.key] = "This field is required.";
          if (!firstInvalidKey) {
            firstInvalidKey = makeFieldKey(itemIdx, q.key);
          }
        }
      }
    });

    setItemErrors(next);

    if (firstInvalidKey) {
      const el = fieldRefs.current[firstInvalidKey];
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setBanner("Please fix the highlighted fields.");
      return false;
    }

    setBanner(null);
    return true;
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

      const generalUploads = await filesToBase64(files);
      const rawItemUploads = await Promise.all(itemFiles.map((list) => filesToBase64(list)));
      const itemUploads = rawItemUploads.map((uploads, idx) =>
        uploads.map((upload, photoIdx) => {
          const rawName = upload.filename?.trim() || "";
          const label = `Item ${idx + 1}`;
          const fallback = `${label} photo ${photoIdx + 1}.jpg`;
          return {
            ...upload,
            filename: rawName ? `${label} - ${rawName}` : fallback,
            itemIndex: idx + 1,
          };
        })
      );

      const itemsPayload = itemAnswers
        .map((item, idx) => {
          const trimmedEntries = Object.entries(item).filter(([, val]) => !isEmptyValue(val));
          const photos = itemUploads[idx] ?? [];
          if (trimmedEntries.length === 0 && photos.length === 0) {
            return null;
          }
          const base = Object.fromEntries(trimmedEntries);
          return {
            itemNumber: idx + 1,
            ...base,
            photos,
          };
        })
        .filter((item): item is Record<string, any> => item !== null);

      const combinedUploads = [...generalUploads, ...itemUploads.flat()];

      await postJSON(`/public/leads/${encodeURIComponent(lead.id)}/submit-questionnaire`, {
        answers: { items: itemsPayload },
        uploads: combinedUploads,
      });

      router.push(`/q/thank-you?tenant=${encodeURIComponent(slug)}`);
    } catch (e: any) {
      setBanner(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  /* UI */
  if (!slug || !leadId) return <Shell><div className="text-sm text-slate-600">Preparing…</div></Shell>;
  if (loading) return <Shell><div className="text-sm text-slate-600">Loading…</div></Shell>;

  const baseInputClasses =
    "w-full rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand))]/40";
  const cardClasses =
    "rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_-35px_rgba(30,64,175,0.35)] backdrop-blur";
  const brandName = settings?.brandName || "Your company";
  const websiteHref = settings?.website || "#";

  return (
    <Shell>
      <div className="space-y-8">
        {settings && (
          <section className={`${cardClasses} space-y-4`}>
            <div className="flex flex-wrap items-center gap-4">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={`${brandName} logo`}
                  className="h-16 w-16 rounded-2xl border border-slate-200/70 bg-white object-contain"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-slate-200/70 bg-white text-sm font-semibold text-slate-400">
                  {brandName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-slate-900">
                  {brandName} · Project questionnaire
                </h1>
                {settings.phone ? (
                  <p className="text-sm text-slate-500">{settings.phone}</p>
                ) : null}
              </div>
            </div>

            {settings.introHtml ? (
              <div
                className="prose prose-sm max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: settings.introHtml }}
              />
            ) : (
              <p className="text-sm text-slate-600">
                Tell us a little about your project and we’ll be in touch with next steps.
              </p>
            )}
          </section>
        )}

        {banner ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 shadow">
            {banner}
          </div>
        ) : null}

        {lead ? (
          <form onSubmit={onSubmit} className={`${cardClasses} space-y-6 max-w-3xl`}>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your project details</h2>
              <p className="text-sm text-slate-500">
                We’ll use this to prepare your estimate and follow up with any questions.
              </p>
            </div>

            <div className="space-y-5">
              {questions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
                  No questions yet.
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-xs text-slate-500">
                    Start with the first item. Use the button below to add more items—new items copy your previous answers
                    (except the size) so you can tweak what&apos;s different.
                  </p>
                  {itemAnswers.map((_, itemIdx) => {
                    const itemErr = itemErrors[itemIdx] ?? {};
                    const sectionLabel = `Item ${itemIdx + 1}`;
                    return (
                      <div
                        key={sectionLabel}
                        className="space-y-4 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-5"
                      >
                        <div className="flex items-baseline justify-between">
                          <h3 className="text-base font-semibold text-slate-900">{sectionLabel}</h3>
                          {itemIdx > 0 ? (
                            <span className="text-xs text-slate-400">Optional</span>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          {questions.map((q) => {
                            const fieldId = makeFieldKey(itemIdx, q.key);
                            const hasErr = !!itemErr[q.key];
                            const inputClass = `${baseInputClasses} ${hasErr ? "border-rose-300 focus:ring-rose-300" : ""}`;
                            const commonProps = {
                              ref: registerFieldRef(fieldId),
                              "aria-invalid": hasErr || undefined,
                              "aria-describedby": hasErr ? `${fieldId}-err` : undefined,
                            } as any;

                            return (
                              <div key={`${sectionLabel}-${q.key}`} className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">
                                  {q.label || q.key}
                                  {q.required ? <span className="text-rose-500"> *</span> : null}
                                </label>

                                {q.type === "textarea" ? (
                                  <textarea
                                    {...commonProps}
                                    className={`${inputClass} min-h-[140px]`}
                                    value={valueOrEmpty(itemAnswers[itemIdx]?.[q.key])}
                                    onChange={(e) => setItemField(itemIdx, q.key, e.target.value)}
                                  />
                                ) : q.type === "select" ? (
                                  <select
                                    {...commonProps}
                                    className={inputClass}
                                    value={valueOrEmpty(itemAnswers[itemIdx]?.[q.key])}
                                    onChange={(e) => setItemField(itemIdx, q.key, e.target.value)}
                                  >
                                    <option value="">Select…</option>
                                    {(q.options ?? []).map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    {...commonProps}
                                    type={q.type === "number" ? "number" : q.type === "date" ? "date" : "text"}
                                    className={inputClass}
                                    value={valueOrEmpty(itemAnswers[itemIdx]?.[q.key])}
                                    onChange={(e) => setItemField(itemIdx, q.key, e.target.value)}
                                  />
                                )}

                                {hasErr ? (
                                  <div id={`${fieldId}-err`} className="text-xs text-rose-600">
                                    {itemErr[q.key]}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div className="space-y-2 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-4">
                          <div className="text-sm font-medium text-slate-700">{sectionLabel} photo</div>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[rgb(var(--brand))]/10 px-4 py-2 text-sm font-medium text-[rgb(var(--brand))] transition hover:bg-[rgb(var(--brand))]/15">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="sr-only"
                              onChange={(e) => handleItemFileChange(itemIdx, e.currentTarget.files)}
                            />
                            <span>Take or upload a photo</span>
                          </label>
                          {itemFiles[itemIdx]?.length ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span>
                                {itemFiles[itemIdx].length} photo{itemFiles[itemIdx].length > 1 ? "s" : ""} ready to upload
                              </span>
                              <button
                                type="button"
                                className="text-xs font-medium text-rose-500 hover:underline"
                                onClick={() => clearItemFiles(itemIdx)}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">
                              Use your camera or photo library to add a reference image for this item.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div>
                    <button
                      type="button"
                      onClick={addItem}
                      className={[
                        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2",
                        "text-sm font-medium text-[rgb(var(--brand))] transition hover:bg-[rgb(var(--brand))]/10",
                      ].join(" ")}
                    >
                      <span className="text-base leading-none">+</span>
                      <span>Add another item</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-4">
              <div className="text-sm font-medium text-slate-700">Additional supporting files (optional)</div>
              <input
                type="file"
                multiple
                className="text-sm"
                onChange={(e) => setFiles(Array.from(e.currentTarget.files || []))}
              />
              {!!files.length && (
                <div className="text-xs text-slate-600">
                  {files.length} file{files.length > 1 ? "s" : ""} selected
                </div>
              )}
              <div className="text-xs text-slate-500">
                We’ll attach them to your enquiry. High-res photos and drawings are welcome.
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--brand))] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Send questionnaire"}
              </button>
              <a
                href={websiteHref}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-6 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white"
              >
                Back to {brandName}
              </a>
            </div>
          </form>
        ) : (
          <div className={`${cardClasses} text-sm text-rose-600`}>Unknown lead.</div>
        )}
      </div>
    </Shell>
  );
}

/* helpers */
function isEmptyValue(v: any) {
  return v === undefined || v === null || String(v).trim() === "";
}
function valueOrEmpty(v: any) { return v == null ? "" : String(v); }
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-[-10%] h-72 w-72 rounded-full bg-[rgb(var(--brand))/0.12] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-[-15%] h-80 w-80 rounded-full bg-indigo-200/20 blur-3xl" />
      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="space-y-10">{children}</div>
      </div>
    </div>
  );
}