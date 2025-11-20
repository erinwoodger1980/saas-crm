"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PhotoMeasurementField } from "@/components/questionnaire/PhotoMeasurementField";

/* -------- Tiny public fetch helpers (no auth cookie required) -------- */
async function getJSON<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { credentials: "omit" });
}
async function postJSON<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", json: body, credentials: "omit" });
}

/* ---------------- Types ---------------- */
type QField = {
  id?: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "source" | "file";
  required?: boolean;
  options?: string[];
  askInQuestionnaire?: boolean;
  internalOnly?: boolean;
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
    contactName: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    custom: Record<string, any>;
  };
};

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLDivElement;

type ItemPayload = {
  itemNumber: number;
  photos: { filename: string; mimeType: string; base64: string; itemIndex: number }[];
} & Record<string, any>;

const WIDTH_FIELD_CANDIDATES = [
  "estimated_width_mm",
  "photo_width_mm",
  "rough_width_mm",
  "approx_width_mm",
  "approx_width",
  "door_width_mm",
  "width_mm",
  "width",
];

const HEIGHT_FIELD_CANDIDATES = [
  "estimated_height_mm",
  "photo_height_mm",
  "rough_height_mm",
  "approx_height_mm",
  "approx_height",
  "door_height_mm",
  "height_mm",
  "height",
];

const OPENING_TYPE_FIELD_KEYS = ["opening_type", "door_type", "window_type", "item_type", "product_type"];
const FLOOR_LEVEL_FIELD_KEYS = ["floor_level", "installation_floor", "storey", "floor", "level"];
const NOTES_FIELD_KEYS = ["notes", "additional_notes", "description", "comments"];
/* ---------------- Normalizers ---------------- */
function normalizeQuestions(raw: any): QField[] {
  const out: QField[] = [];
  const list = Array.isArray(raw) ? raw : [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;

    const key = typeof item.key === "string" && item.key.trim() ? item.key.trim() : "";
    if (!key) continue;

    const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : key;
    const typeRaw = typeof item.type === "string" && item.type.trim() ? item.type.trim() : "text";
  const allowed: QField["type"][] = ["text", "textarea", "select", "number", "date", "source", "file"];
    const type = allowed.includes(typeRaw as QField["type"]) ? (typeRaw as QField["type"]) : "text";

    const options =
      type === "select" && Array.isArray(item.options)
        ? item.options.map((opt: any) => String(opt || "").trim()).filter(Boolean)
        : undefined;

    out.push({
      id: typeof item.id === "string" ? item.id : undefined,
      key,
      label,
      type,
      required: Boolean(item.required),
      options,
      askInQuestionnaire: item.askInQuestionnaire !== false,
      internalOnly: item.internalOnly === true,
    });
  }

  return out;
}

/* ============================ Page ============================ */
export default function PublicQuestionnairePage() {
  const router = useRouter();
  const { tenant: slug = "", id: leadId = "" } = (useParams() as { tenant?: string; id?: string }) ?? {};

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [lead, setLead] = useState<PublicLead["lead"] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Global additional files (not per-item)
  const [files, setFiles] = useState<File[]>([]);

  // Per-item states
  const [itemAnswers, setItemAnswers] = useState<Record<string, any>[]>([{}]);
  const [itemErrors, setItemErrors] = useState<Record<string, string>[]>([{}]);
  const [itemFiles, setItemFiles] = useState<File[][]>([[]]);
  // Per-item, per-question file uploads (for questions of type 'file')
  const [itemQuestionFiles, setItemQuestionFiles] = useState<Record<string, File[]>[]>([{}]);

  const fieldRefs = useRef<Record<string, FieldElement | null>>({});

  /* ---------------- Load settings & lead ---------------- */
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

        // Pre-fill items from existing custom.items (if any)
        const custom = (l.lead && typeof l.lead.custom === "object" && l.lead.custom) || {};
        const existingItems = Array.isArray((custom as any).items) ? (custom as any).items : [];
        const answers = existingItems.map((existing: any) => {
          if (existing && typeof existing === "object") {
            const copy = { ...(existing as Record<string, any>) };
            delete copy.photos;
            delete copy.itemNumber;
            return copy;
          }
          return {};
        });
        if (!answers.length) answers.push({});

        setItemAnswers(answers);
        setItemErrors(Array.from({ length: answers.length }, () => ({})));
  setItemFiles(Array.from({ length: answers.length }, () => []));
  setItemQuestionFiles(Array.from({ length: answers.length }, () => ({})));
        fieldRefs.current = {};
      } catch (e: any) {
        setBanner(e?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug, leadId]);

  /* ---------------- Derived ---------------- */
  // Standard contact fields that appear once at the top
  const STANDARD_FIELDS = ['contact_name', 'email', 'phone', 'address', 'description', 'notes'];
  
  const allQuestions: QField[] = useMemo(
    () => normalizeQuestions((settings as any)?.questionnaire ?? [])
      .filter((q) => q.askInQuestionnaire !== false && q.internalOnly !== true),
    [settings]
  );

  // Split questions into contact fields (shown once) and item fields (repeated per item)
  const contactFields = useMemo(
    () => allQuestions.filter(q => STANDARD_FIELDS.includes(q.key)),
    [allQuestions]
  );
  
  const questions = useMemo(
    () => allQuestions.filter(q => !STANDARD_FIELDS.includes(q.key)),
    [allQuestions]
  );

  const measurementFieldMeta = useMemo(() => {
    if (!questions.length) return null;
    const widthKey = findMeasurementFieldKey(questions, WIDTH_FIELD_CANDIDATES, ["width"]);
    const heightKey = findMeasurementFieldKey(questions, HEIGHT_FIELD_CANDIDATES, ["height"]);
    if (!widthKey || !heightKey) return null;
    return {
      widthKey,
      heightKey,
      widthQuestion: questions.find((q) => q.key === widthKey) ?? null,
      heightQuestion: questions.find((q) => q.key === heightKey) ?? null,
    };
  }, [questions]);

  const measurementKeys = measurementFieldMeta ? [measurementFieldMeta.widthKey, measurementFieldMeta.heightKey] : [];
  const measurementKeysLower = measurementFieldMeta
    ? [measurementFieldMeta.widthKey.toLowerCase(), measurementFieldMeta.heightKey.toLowerCase()]
    : [];

  // Contact field answers (not per-item, just global)
  const [contactAnswers, setContactAnswers] = useState<Record<string, any>>({});
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!lead || !contactFields.length) return;
    const defaults: Record<string, any> = {
      contact_name: lead.contactName ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      address: lead.address ?? null,
    };
    const appliedKeys: string[] = [];
    setContactAnswers((prev) => {
      let mutated = false;
      const next = { ...prev };
      contactFields.forEach((field) => {
        const defaultValue = defaults[field.key];
        if (!isEmptyValue(defaultValue) && isEmptyValue(prev[field.key])) {
          next[field.key] = defaultValue;
          appliedKeys.push(field.key);
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });

    if (appliedKeys.length) {
      setContactErrors((prev) => {
        let changed = false;
        const next = { ...prev };
        appliedKeys.forEach((key) => {
          if (next[key]) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [lead, contactFields]);

  const getLeadSummaryValue = (key: string, fallback?: string | null) => {
    const normalize = (val: any) => {
      if (val == null) return "";
      const str = String(val).trim();
      return str;
    };
    const fromAnswers = normalize(contactAnswers[key]);
    if (fromAnswers) return fromAnswers;
    const fromFallback = normalize(fallback);
    return fromFallback || "Not provided";
  };

  /* ---------------- Refs & field helpers ---------------- */
  const registerFieldRef = (fieldKey: string) =>
    (el: FieldElement | null) => {
      if (el) fieldRefs.current[fieldKey] = el;
      else delete fieldRefs.current[fieldKey];
    };

  const setContactField = (key: string, value: any) => {
    setContactAnswers((prev) => ({ ...prev, [key]: value }));
    setContactErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applyItemPatch = useCallback((itemIndex: number, patch: Record<string, any>) => {
    setItemAnswers((prev) => prev.map((it, i) => (i === itemIndex ? { ...it, ...patch } : it)));
    setItemErrors((prev) =>
      prev.map((errs, i) => {
        if (i !== itemIndex) return errs;
        const keys = Object.keys(patch);
        const hasError = keys.some((key) => errs[key]);
        if (!hasError) return errs;
        const next = { ...errs };
        for (const key of keys) {
          if (next[key]) delete next[key];
        }
        return next;
      })
    );
  }, []);

  const setItemField = (itemIndex: number, key: string, value: any) => {
    applyItemPatch(itemIndex, { [key]: value });
  };

  const handleItemFileChange = (itemIndex: number, fileList: FileList | null) => {
    const next = fileList ? Array.from(fileList).slice(0, 1) : [];
    setItemFiles((prev) => prev.map((arr, i) => (i === itemIndex ? next : arr)));
  };
  const clearItemFiles = (itemIndex: number) => {
    setItemFiles((prev) => prev.map((arr, i) => (i === itemIndex ? [] : arr)));
  };

  const setItemQuestionFile = (itemIndex: number, key: string, fileList: FileList | null) => {
    const nextFiles = fileList ? Array.from(fileList) : [];
    setItemQuestionFiles((prev) => prev.map((rec, i) => (i === itemIndex ? { ...(rec ?? {}), [key]: nextFiles } : rec)));
    // also clear any previous answer error for that key
    setItemErrors((prev) =>
      prev.map((errs, i) => {
        if (i !== itemIndex || !errs[key]) return errs;
        const next = { ...errs };
        delete next[key];
        return next;
      })
    );
  };

  const clearItemQuestionFiles = (itemIndex: number, key: string) => {
    setItemQuestionFiles((prev) => prev.map((rec, i) => (i === itemIndex ? { ...(rec ?? {}), [key]: [] } : rec)));
  };

  const addItem = () => {
    setItemAnswers((prev) => {
      const last = prev[prev.length - 1] ?? {};
      const entries = Object.entries(last).filter(([k]) => {
        const lower = k.toLowerCase();
        if (lower.includes("size")) return false;
        if (measurementKeysLower.includes(lower)) return false;
        return true;
      });
      const base = Object.fromEntries(entries);
      return [...prev, base];
    });
    setItemErrors((prev) => [...prev, {}]);
    setItemFiles((prev) => [...prev, []]);
  };

  const hasItemContent = (idx: number) => {
    const item = itemAnswers[idx] ?? {};
    const hasValues = Object.values(item).some((v) => !isEmptyValue(v));
    const hasPhotos = (itemFiles[idx]?.length ?? 0) > 0;
    return hasValues || hasPhotos;
  };

  const makeFieldKey = (itemIndex: number, key: string) => `item-${itemIndex}-${key}`;

  /* ---------------- Validation ---------------- */
  function validate(): boolean {
    // Validate contact fields first
    const nextContactErrors: Record<string, string> = {};
    let firstInvalidKey: string | null = null;

    for (const q of contactFields) {
      const val = contactAnswers[q.key];
      if (q.required && isEmptyValue(val)) {
        nextContactErrors[q.key] = "This field is required.";
        if (!firstInvalidKey) firstInvalidKey = `contact-${q.key}`;
      }
    }

    setContactErrors(nextContactErrors);

    // Validate item fields
    if (questions.length === 0) {
      setItemErrors(itemAnswers.map(() => ({})));
      if (Object.keys(nextContactErrors).length > 0) {
        const el = fieldRefs.current[firstInvalidKey!];
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

    const next = itemAnswers.map(() => ({} as Record<string, string>));

    itemAnswers.forEach((_, itemIdx) => {
      const shouldValidate = itemIdx === 0 || hasItemContent(itemIdx);
      if (!shouldValidate) return;

      for (const q of questions) {
        const val = itemAnswers[itemIdx]?.[q.key];
        // if file question, check itemQuestionFiles
        const fileVal = q.type === "file" ? (itemQuestionFiles[itemIdx]?.[q.key] ?? []) : null;
        if (q.required && (q.type === "file" ? (Array.isArray(fileVal) ? fileVal.length === 0 : true) : isEmptyValue(val))) {
          next[itemIdx][q.key] = "This field is required.";
          if (!firstInvalidKey) firstInvalidKey = makeFieldKey(itemIdx, q.key);
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

  /* ---------------- File helpers ---------------- */
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

  /* ---------------- Submit ---------------- */
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

      // Convert per-question file uploads to base64 and include alongside general uploads
      const rawItemQuestionUploads = await Promise.all(
        itemQuestionFiles.map(async (rec, idx) => {
          if (!rec || typeof rec !== "object") return [];
          const keys = Object.keys(rec);
          const all: Array<{ filename: string; mimeType: string; base64: string; itemIndex?: number; qKey?: string }> = [];
          for (const key of keys) {
            const fl = rec[key] ?? [];
            if (!Array.isArray(fl) || fl.length === 0) continue;
            const conv = await filesToBase64(fl);
            for (let i = 0; i < conv.length; i++) {
              const c = conv[i];
              const rawName = c.filename?.trim() || "";
              const label = `Item ${idx + 1} - ${key}`;
              const fallback = `${label} file ${i + 1}`;
              all.push({ filename: rawName ? `${label} - ${rawName}` : fallback, mimeType: c.mimeType, base64: c.base64, itemIndex: idx + 1, qKey: key });
            }
          }
          return all;
        })
      );
      const itemQuestionUploads = rawItemQuestionUploads.map((a) => a || []);

      const itemsPayload: ItemPayload[] = itemAnswers
  .map((item, idx) => {
    const trimmedEntries = Object.entries(item).filter(([, val]) => !isEmptyValue(val));
    const photos = itemUploads[idx] ?? [];
    // include per-question file references as separate fields if present
    const questionFiles = itemQuestionUploads[idx] ?? [];
    for (const qf of questionFiles) {
      // attach as a field like `${qKey}Files` containing filenames (metadata stored in uploads)
      const k = `${qf.qKey}Files`;
      const existing = Array.isArray((item as any)[k]) ? (item as any)[k] : [];
      (item as any)[k] = [...existing, qf.filename];
    }
    if (trimmedEntries.length === 0 && photos.length === 0) return null;

    const base = Object.fromEntries(trimmedEntries);
    return {
      itemNumber: idx + 1,
      ...base,
      photos,
    };
  })
  .filter((item): item is ItemPayload => item !== null);

      // flatten uploads: general, per-item photos, per-question files
      const flattenedUploads = [
        ...generalUploads,
        ...itemUploads.flat(),
        ...itemQuestionUploads.flat().map((u) => ({ filename: u.filename, mimeType: u.mimeType, base64: u.base64 })),
      ];

      await postJSON(`/public/leads/${encodeURIComponent(lead.id)}/submit-questionnaire`, {
        answers: { 
          ...contactAnswers,  // Include contact fields at top level
          items: itemsPayload 
        },
        uploads: flattenedUploads,
      });

      router.push(`/q/thank-you?tenant=${encodeURIComponent(slug)}`);
    } catch (e: any) {
      setBanner(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- UI ---------------- */
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
                // eslint-disable-next-line @next/next/no-img-element
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
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead contact</div>
              <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Name</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {getLeadSummaryValue("contact_name", lead.contactName ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Email</dt>
                  <dd className="text-sm font-medium text-slate-900 break-words">
                    {getLeadSummaryValue("email", lead.email ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Phone</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {getLeadSummaryValue("phone", lead.phone ?? null)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase text-slate-500">Address</dt>
                  <dd className="text-sm font-medium text-slate-900 whitespace-pre-line">
                    {getLeadSummaryValue(
                      "address",
                      (lead.address as string | null) ?? (lead.custom?.address as string | null) ?? null
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your contact information</h2>
              <p className="text-sm text-slate-500">
                Please provide your details so we can get in touch with you.
              </p>
            </div>

            {/* Contact Fields Section */}
            {contactFields.length > 0 && (
              <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-5">
                {contactFields.map((q) => {
                  const fieldId = `contact-${q.key}`;
                  const hasErr = !!contactErrors[q.key];
                  const inputClass = `${baseInputClasses} ${hasErr ? "border-rose-300 focus:ring-rose-300" : ""}`;
                  const commonProps = {
                    ref: registerFieldRef(fieldId),
                    "aria-invalid": hasErr || undefined,
                    "aria-describedby": hasErr ? `${fieldId}-err` : undefined,
                  } as any;

                  return (
                    <div key={q.key} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        {q.label || q.key}
                        {q.required ? <span className="text-rose-500"> *</span> : null}
                      </label>

                      {q.type === "textarea" ? (
                        <textarea
                          {...commonProps}
                          className={`${inputClass} min-h-[100px]`}
                          value={valueOrEmpty(contactAnswers[q.key])}
                          onChange={(e) => setContactField(q.key, e.target.value)}
                          placeholder={q.key === 'address' ? 'Your full address including postcode' : undefined}
                        />
                      ) : q.type === "select" ? (
                        <select
                          {...commonProps}
                          className={inputClass}
                          value={valueOrEmpty(contactAnswers[q.key])}
                          onChange={(e) => setContactField(q.key, e.target.value)}
                        >
                          <option value="">Select…</option>
                          {(q.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          {...commonProps}
                          type={q.type === "number" ? "number" : q.type === "date" ? "date" : q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"}
                          className={inputClass}
                          value={valueOrEmpty(contactAnswers[q.key])}
                          onChange={(e) => setContactField(q.key, e.target.value)}
                          placeholder={
                            q.key === 'contact_name' ? 'Your full name' :
                            q.key === 'email' ? 'your.email@example.com' :
                            q.key === 'phone' ? 'Your phone number' :
                            undefined
                          }
                        />
                      )}

                      {hasErr ? (
                        <p id={`${fieldId}-err`} className="text-sm text-rose-600">
                          {contactErrors[q.key]}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Project Details Section */}
            <div className="pt-4">
              <h2 className="text-lg font-semibold text-slate-900">Your project details</h2>
              <p className="text-sm text-slate-500">
                Tell us about what you need. You can add multiple items if you have different requirements.
              </p>
            </div>

            <div className="space-y-5">
              {questions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
                  No project questions configured yet.
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-xs text-slate-500">
                    Start with the first item. Use the button below to add more items — new items copy your previous answers
                    (except the size) so you can tweak what&apos;s different.
                  </p>

                  {itemAnswers.map((_, itemIdx) => {
                    const itemData = itemAnswers[itemIdx] ?? {};
                    const itemErr = itemErrors[itemIdx] ?? {};
                    const sectionLabel = `Item ${itemIdx + 1}`;
                    const measurementValue =
                      measurementFieldMeta
                        ? {
                            widthMm: toNumericValue(itemData[measurementFieldMeta.widthKey]),
                            heightMm: toNumericValue(itemData[measurementFieldMeta.heightKey]),
                            measurementSource:
                              typeof itemData.measurement_source === "string" ? itemData.measurement_source : null,
                            measurementConfidence: toNumericValue(itemData.measurement_confidence),
                          }
                        : null;
                    const measurementContext =
                      measurementFieldMeta
                        ? {
                            openingType: pickFirstStringValue(itemData, OPENING_TYPE_FIELD_KEYS),
                            floorLevel: pickFirstStringValue(itemData, FLOOR_LEVEL_FIELD_KEYS),
                            notes: pickFirstStringValue(itemData, NOTES_FIELD_KEYS),
                          }
                        : null;
                    const measurementWidthError =
                      measurementFieldMeta ? itemErr[measurementFieldMeta.widthKey] : null;
                    const measurementHeightError =
                      measurementFieldMeta ? itemErr[measurementFieldMeta.heightKey] : null;
                    const registerMeasurementRef =
                      measurementFieldMeta
                        ? (el: HTMLDivElement | null) => {
                            const widthFieldId = makeFieldKey(itemIdx, measurementFieldMeta.widthKey);
                            const heightFieldId = makeFieldKey(itemIdx, measurementFieldMeta.heightKey);
                            if (el) {
                              fieldRefs.current[widthFieldId] = el;
                              fieldRefs.current[heightFieldId] = el;
                            } else {
                              delete fieldRefs.current[widthFieldId];
                              delete fieldRefs.current[heightFieldId];
                            }
                          }
                        : undefined;

                    return (
                      <div
                        key={sectionLabel}
                        className="space-y-4 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-5"
                      >
                        <div className="flex items-baseline justify-between">
                          <h3 className="text-base font-semibold text-slate-900">{sectionLabel}</h3>
                          {itemIdx > 0 ? <span className="text-xs text-slate-400">Optional</span> : null}
                        </div>

                        <div className="space-y-4">
                          {questions.map((q) => {
                            if (measurementFieldMeta && measurementKeys.includes(q.key)) {
                              return null;
                            }
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

                                {q.type === "file" ? (
                                  <div>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="text-sm"
                                      onChange={(e) => setItemQuestionFile(itemIdx, q.key, e.currentTarget.files)}
                                    />
                                    {Array.isArray(itemQuestionFiles[itemIdx]?.[q.key]) && itemQuestionFiles[itemIdx][q.key].length ? (
                                      <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <span>
                                          {itemQuestionFiles[itemIdx][q.key].length} file{itemQuestionFiles[itemIdx][q.key].length > 1 ? "s" : ""} ready to upload
                                        </span>
                                        <button
                                          type="button"
                                          className="text-xs font-medium text-rose-500 hover:underline"
                                          onClick={() => clearItemQuestionFiles(itemIdx, q.key)}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-400">Attach a file for this question.</div>
                                    )}
                                  </div>
                                ) : q.type === "textarea" ? (
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
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
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

                        {measurementFieldMeta ? (
                          <div
                            ref={registerMeasurementRef}
                            tabIndex={-1}
                            className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand))]/40"
                          >
                            <div className="text-sm font-medium text-slate-700">
                              {measurementFieldMeta.widthQuestion?.label || "Width"} &amp;{" "}
                              {measurementFieldMeta.heightQuestion?.label || "Height"}
                              {measurementFieldMeta.widthQuestion?.required || measurementFieldMeta.heightQuestion?.required ? (
                                <span className="text-rose-500"> *</span>
                              ) : null}
                            </div>
                            <PhotoMeasurementField
                              value={measurementValue || undefined}
                              context={measurementContext || undefined}
                              disabled={submitting}
                              widthField={measurementFieldMeta.widthKey}
                              heightField={measurementFieldMeta.heightKey}
                              widthLabel={measurementFieldMeta.widthQuestion?.label || "Estimated width (mm)"}
                              heightLabel={measurementFieldMeta.heightQuestion?.label || "Estimated height (mm)"}
                              helperText="Take or upload a quick photo and we'll auto-fill rough sizes. We'll confirm exact measurements on survey."
                              onChange={(patch) => applyItemPatch(itemIdx, patch)}
                              className="bg-white"
                            />
                            {(measurementWidthError || measurementHeightError) && (
                              <p className="text-xs text-rose-600">
                                {measurementWidthError || measurementHeightError || "Please provide rough measurements."}
                              </p>
                            )}
                          </div>
                        ) : null}

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
                                {itemFiles[itemIdx].length} photo{itemFiles[itemIdx].length > 1 ? "s" : ""} ready to
                                upload
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
                accept="image/*,application/pdf"
                capture="environment"
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

function findMeasurementFieldKey(questions: QField[], candidates: string[], keywords: string[]): string | null {
  const normalized = candidates.map((candidate) => candidate.toLowerCase());
  for (const question of questions) {
    const key = question.key.toLowerCase();
    if (normalized.includes(key)) {
      return question.key;
    }
  }
  for (const question of questions) {
    const key = question.key.toLowerCase();
    if (keywords.some((keyword) => key.includes(keyword))) {
      return question.key;
    }
  }
  return null;
}

function toNumericValue(value: any): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickFirstStringValue(record: Record<string, any>, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }
  return null;
}

/* ---------------- Small helpers ---------------- */
function isEmptyValue(v: any) {
  return v === undefined || v === null || String(v).trim() === "";
}
function valueOrEmpty(v: any) {
  return v == null ? "" : String(v);
}

/* ---------------- Shell layout ---------------- */
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