"use client";

/**
 * PublicQuestionnairePage currently supports invite-style links (/q/[tenant]/[leadId]) only.
 * It loads TenantSettings + an existing Lead, renders a single long form (contact → global specs → items),
 * then posts answers/uploads to /public/leads/:id/submit-questionnaire where they merge into lead.custom
 * and the lead's global spec columns. Tenant branding here is limited to brandName, introHtml, website,
 * phone, logoUrl and links; no colours, galleries or testimonials exist yet, and there is no live pricing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PhotoMeasurementField } from "@/components/questionnaire/PhotoMeasurementField";
import { InspirationUploadField } from "@/components/questionnaire/InspirationUploadField";
import {
  buildOpeningDescription,
  DESCRIPTION_AUTO_MODE,
  DESCRIPTION_MANUAL_MODE,
  type GlobalSpecs as DescriptionGlobalSpecs,
  type StructuralInfo,
} from "@/lib/buildOpeningDescription";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    global_timber_spec?: string | null;
    global_glass_spec?: string | null;
    global_ironmongery_spec?: string | null;
    global_finish_spec?: string | null;
    custom: Record<string, any>;
  };
};

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLDivElement;

type ItemPayload = {
  itemNumber: number;
  photos: { filename: string; mimeType: string; base64: string; itemIndex: number }[];
  inspiration_photos?: { filename: string; mimeType: string; base64: string; itemIndex: number }[];
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

const GLOBAL_SPEC_KEYS = [
  "global_timber_spec",
  "global_glass_spec",
  "global_ironmongery_spec",
  "global_finish_spec",
] as const;
type GlobalSpecKey = (typeof GLOBAL_SPEC_KEYS)[number];

type GlobalSpecState = Record<GlobalSpecKey, string>;

const DEFAULT_GLOBAL_SPECS: GlobalSpecState = {
  global_timber_spec: "",
  global_glass_spec: "",
  global_ironmongery_spec: "",
  global_finish_spec: "",
};

const CORE_CONTACT_KEYS = ["contact_name", "email", "phone", "address"] as const;

const CONTACT_FIELD_FALLBACKS: Record<(typeof CORE_CONTACT_KEYS)[number], QField> = {
  contact_name: { key: "contact_name", label: "Your name", type: "text", required: true },
  email: { key: "email", label: "Email", type: "text", required: true },
  phone: { key: "phone", label: "Phone number", type: "text", required: false },
  address: { key: "address", label: "Project address", type: "textarea", required: false },
};

const TIMBER_OPTIONS = [
  "Accoya (painted)",
  "Softwood (painted)",
  "Oak (stained)",
  "uPVC",
  "Aluminium",
];

const GLASS_OPTIONS = [
  "Double glazed",
  "Triple glazed",
  "Acoustic glass",
  "Laminated glass",
  "Heritage slimline glazing",
];

const IRONMONGERY_OPTIONS = [
  "Satin chrome",
  "Polished brass",
  "Black antique",
  "Oil-rubbed bronze",
];

const FINISH_OPTIONS = [
  "Factory-painted RAL 9016",
  "Factory-painted RAL 7016",
  "Stained",
  "Primed only",
];

const UNSET_SPEC_VALUE = "__unset__";
const CUSTOM_SPEC_VALUE = "__custom__";

const GLOBAL_SPEC_FIELD_CONFIG: Array<{
  key: GlobalSpecKey;
  label: string;
  helper: string;
  placeholder: string;
  options: string[];
}> = [
  {
    key: "global_timber_spec",
    label: "Timber / base material",
    helper: "Used for every opening unless you override an item",
    placeholder: "e.g. Accoya, oak, aluminium",
    options: TIMBER_OPTIONS,
  },
  {
    key: "global_glass_spec",
    label: "Glass specification",
    helper: "Applies across all glazing descriptions",
    placeholder: "e.g. Double glazed acoustic",
    options: GLASS_OPTIONS,
  },
  {
    key: "global_ironmongery_spec",
    label: "Ironmongery / hardware",
    helper: "We’ll mention this in each description",
    placeholder: "e.g. Satin chrome handles",
    options: IRONMONGERY_OPTIONS,
  },
  {
    key: "global_finish_spec",
    label: "Finish",
    helper: "Adds the finishing statement to each item",
    placeholder: "e.g. Factory-painted RAL 7016",
    options: FINISH_OPTIONS,
  },
];

const PRODUCT_TYPE_FIELD_KEYS = [
  "product_type",
  "opening_type",
  "item_type",
  "vision_product_type",
];
const OPENING_CONFIG_FIELD_KEYS = ["opening_config", "configuration", "sash_configuration", "vision_opening_config"];
const GLAZING_STYLE_FIELD_KEYS = ["glazing_style", "bar_layout", "grid_pattern"];
const GLASS_FIELD_KEYS = ["glass", "glass_type", "glazing_type", "vision_glass_type"];
const COLOUR_FIELD_KEYS = ["colour", "color", "finish_colour", "finish_color", "vision_colour", "vision_color"];
const MATERIAL_FIELD_KEYS = ["material", "frame_material", "vision_material"];
const FINISH_FIELD_KEYS = ["finish", "finish_type", "coating", "vision_finish"];
const IRONMONGERY_FIELD_KEYS = ["ironmongery", "hardware_finish", "handle_finish", "vision_ironmongery"];

const STRUCTURAL_FIELD_KEYS = new Set([
  ...PRODUCT_TYPE_FIELD_KEYS,
  ...OPENING_CONFIG_FIELD_KEYS,
  ...GLAZING_STYLE_FIELD_KEYS,
  ...GLASS_FIELD_KEYS,
  ...COLOUR_FIELD_KEYS,
  ...MATERIAL_FIELD_KEYS,
  ...FINISH_FIELD_KEYS,
  ...IRONMONGERY_FIELD_KEYS,
]);

const DESCRIPTION_FIELD_KEYS = new Set(["description", "item_description", "opening_description"]);
const DESCRIPTION_KEY_PRIORITY = ["opening_description", "item_description", "description"] as const;
const MAX_SPEC_INPUT_LENGTH = 280;
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
  const [itemInspirationFiles, setItemInspirationFiles] = useState<File[][]>([[]]);
  // Per-item, per-question file uploads (for questions of type 'file')
  const [itemQuestionFiles, setItemQuestionFiles] = useState<Record<string, File[]>[]>([{}]);
  const [globalSpecs, setGlobalSpecs] = useState<GlobalSpecState>(DEFAULT_GLOBAL_SPECS);

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
        setGlobalSpecs({
          global_timber_spec: normalizeGlobalSpecValue(
            (l.lead as any)?.global_timber_spec ?? (custom as any)?.global_timber_spec ?? ""
          ),
          global_glass_spec: normalizeGlobalSpecValue(
            (l.lead as any)?.global_glass_spec ?? (custom as any)?.global_glass_spec ?? ""
          ),
          global_ironmongery_spec: normalizeGlobalSpecValue(
            (l.lead as any)?.global_ironmongery_spec ?? (custom as any)?.global_ironmongery_spec ?? ""
          ),
          global_finish_spec: normalizeGlobalSpecValue(
            (l.lead as any)?.global_finish_spec ?? (custom as any)?.global_finish_spec ?? ""
          ),
        });
        const existingItems = Array.isArray((custom as any).items) ? (custom as any).items : [];
        const answers = existingItems.map((existing: any) => {
          if (existing && typeof existing === "object") {
            const copy = { ...(existing as Record<string, any>) };
            delete copy.photos;
            delete copy.itemNumber;
            copy.description_mode = typeof copy.description_mode === "string" ? copy.description_mode : DESCRIPTION_AUTO_MODE;
            return copy;
          }
          return {};
        });
        if (!answers.length) answers.push({});

          setItemAnswers(answers);
          setItemErrors(Array.from({ length: answers.length }, () => ({})));
          setItemFiles(Array.from({ length: answers.length }, () => []));
          setItemInspirationFiles(Array.from({ length: answers.length }, () => []));
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

  const rawContactFields = useMemo(
    () => allQuestions.filter((q) => STANDARD_FIELDS.includes(q.key)),
    [allQuestions]
  );

  const contactFields = useMemo(() => {
    const configuredMap = new Map(rawContactFields.map((field) => [field.key, field]));
    const ordered: QField[] = [];
    CORE_CONTACT_KEYS.forEach((key) => {
      const field = configuredMap.get(key) ?? CONTACT_FIELD_FALLBACKS[key];
      if (field) ordered.push(field);
      configuredMap.delete(key);
    });
    configuredMap.forEach((field) => ordered.push(field));
    return ordered;
  }, [rawContactFields]);

  const rawItemQuestions = useMemo(
    () => allQuestions.filter((q) => !STANDARD_FIELDS.includes(q.key)),
    [allQuestions]
  );

  const descriptionQuestion = useMemo(
    () => rawItemQuestions.find((q) => DESCRIPTION_FIELD_KEYS.has(q.key)),
    [rawItemQuestions]
  );

  const descriptionFieldKey = descriptionQuestion?.key ?? "description";

  const questions = useMemo(
    () => rawItemQuestions.filter((q) => !DESCRIPTION_FIELD_KEYS.has(q.key)),
    [rawItemQuestions]
  );

  const normalizedGlobalSpecs = useMemo<DescriptionGlobalSpecs>(
    () => ({
      timber: specValueOrNull(globalSpecs.global_timber_spec),
      glass: specValueOrNull(globalSpecs.global_glass_spec),
      ironmongery: specValueOrNull(globalSpecs.global_ironmongery_spec),
      finish: specValueOrNull(globalSpecs.global_finish_spec),
    }),
    [globalSpecs]
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

  useEffect(() => {
    setItemAnswers((prev) =>
      prev.map((item) => {
        const mode: string = typeof item.description_mode === "string" ? item.description_mode : DESCRIPTION_AUTO_MODE;
        if (mode === DESCRIPTION_MANUAL_MODE) return item;
        const recomposed = buildOpeningDescription(extractStructuralInfo(item), normalizedGlobalSpecs);
        const currentDescription = getItemDescriptionValue(item);
        if (recomposed === currentDescription && mode === (item.description_mode ?? DESCRIPTION_AUTO_MODE)) {
          return item;
        }
        return applyDescriptionValue({ ...item, description_mode: DESCRIPTION_AUTO_MODE }, recomposed, descriptionFieldKey);
      })
    );
  }, [normalizedGlobalSpecs, descriptionFieldKey]);

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

  const applyItemPatch = useCallback(
    (itemIndex: number, patch: Record<string, any>, options?: { forceDescriptionRefresh?: boolean }) => {
      setItemAnswers((prev) =>
        prev.map((it, i) => {
          if (i !== itemIndex) return it;
          let next = { ...it, ...patch };
          const mode: string = typeof next.description_mode === "string" ? next.description_mode : DESCRIPTION_AUTO_MODE;
          const touchedStructural = Object.keys(patch).some((key) => STRUCTURAL_FIELD_KEYS.has(key));
          if ((options?.forceDescriptionRefresh || touchedStructural) && mode !== DESCRIPTION_MANUAL_MODE) {
            const recomposed = buildOpeningDescription(extractStructuralInfo(next), normalizedGlobalSpecs);
            next = applyDescriptionValue(next, recomposed, descriptionFieldKey);
            next.description_mode = DESCRIPTION_AUTO_MODE;
          }
          return next;
        })
      );
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
    },
    [normalizedGlobalSpecs, descriptionFieldKey]
  );

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

  const handleInspirationFileChange = (itemIndex: number, fileList: FileList | null) => {
    const next = fileList ? Array.from(fileList).slice(0, 1) : [];
    setItemInspirationFiles((prev) => prev.map((arr, i) => (i === itemIndex ? next : arr)));
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

  const handleGlobalSpecSelect = useCallback(
    (key: GlobalSpecKey, selection: string, options: string[]) => {
      setGlobalSpecs((prev) => {
        if (selection === UNSET_SPEC_VALUE) {
          return { ...prev, [key]: "" };
        }
        if (selection === CUSTOM_SPEC_VALUE) {
          const preserved = options.includes(prev[key]) ? "" : prev[key];
          return { ...prev, [key]: normalizeGlobalSpecValue(preserved) };
        }
        return { ...prev, [key]: normalizeGlobalSpecValue(selection) };
      });
    },
    []
  );

  const handleGlobalSpecInput = useCallback((key: GlobalSpecKey, value: string) => {
    setGlobalSpecs((prev) => ({ ...prev, [key]: normalizeGlobalSpecValue(value) }));
  }, []);

  const handleDescriptionChange = useCallback(
    (itemIndex: number, value: string) => {
      setItemAnswers((prev) =>
        prev.map((item, idx) => {
          if (idx !== itemIndex) return item;
          return applyDescriptionValue({ ...item, description_mode: DESCRIPTION_MANUAL_MODE }, value, descriptionFieldKey);
        })
      );
      setItemErrors((prev) =>
        prev.map((errs, idx) => {
          if (idx !== itemIndex || !errs[descriptionFieldKey]) return errs;
          const next = { ...errs };
          delete next[descriptionFieldKey];
          return next;
        })
      );
    },
    [descriptionFieldKey]
  );

  const handleDescriptionModeToggle = useCallback(
    (itemIndex: number, nextMode: typeof DESCRIPTION_AUTO_MODE | typeof DESCRIPTION_MANUAL_MODE) => {
      setItemAnswers((prev) =>
        prev.map((item, idx) => {
          if (idx !== itemIndex) return item;
          if (nextMode === DESCRIPTION_MANUAL_MODE) {
            return { ...item, description_mode: DESCRIPTION_MANUAL_MODE };
          }
          const recomposed = buildOpeningDescription(extractStructuralInfo(item), normalizedGlobalSpecs);
          return applyDescriptionValue({ ...item, description_mode: DESCRIPTION_AUTO_MODE }, recomposed, descriptionFieldKey);
        })
      );
      if (nextMode === DESCRIPTION_AUTO_MODE) {
        setItemErrors((prev) =>
          prev.map((errs, idx) => {
            if (idx !== itemIndex || !errs[descriptionFieldKey]) return errs;
            const next = { ...errs };
            delete next[descriptionFieldKey];
            return next;
          })
        );
      }
    },
    [normalizedGlobalSpecs, descriptionFieldKey]
  );

  const addItem = () => {
    setItemAnswers((prev) => {
      const last = prev[prev.length - 1] ?? {};
      const entries = Object.entries(last).filter(([k]) => {
        const lower = k.toLowerCase();
        if (lower.includes("size")) return false;
        if (measurementKeysLower.includes(lower)) return false;
        return true;
      });
      let base = Object.fromEntries(entries);
      const mode: string = typeof base.description_mode === "string" ? base.description_mode : DESCRIPTION_AUTO_MODE;
      base.description_mode = mode;
      if (mode !== DESCRIPTION_MANUAL_MODE) {
        const recomposed = buildOpeningDescription(extractStructuralInfo(base), normalizedGlobalSpecs);
        base = applyDescriptionValue(base, recomposed, descriptionFieldKey);
      }
      return [...prev, base];
    });
    setItemErrors((prev) => [...prev, {}]);
    setItemFiles((prev) => [...prev, []]);
    setItemInspirationFiles((prev) => [...prev, []]);
  };

  const hasItemContent = (idx: number) => {
    const item = itemAnswers[idx] ?? {};
    const hasValues = Object.values(item).some((v) => !isEmptyValue(v));
    const hasPhotos = (itemFiles[idx]?.length ?? 0) > 0;
    const hasInspirationPhotos = (itemInspirationFiles[idx]?.length ?? 0) > 0;
    return hasValues || hasPhotos || hasInspirationPhotos;
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
        continue;
      }
      if (q.key === "email" && !isEmptyValue(val) && !looksLikeEmail(String(val))) {
        nextContactErrors[q.key] = "Enter a valid email address.";
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

      if (descriptionQuestion?.required) {
        const descVal = getItemDescriptionValue(itemAnswers[itemIdx] ?? {});
        if (isEmptyValue(descVal)) {
          next[itemIdx][descriptionFieldKey] = "This field is required.";
          if (!firstInvalidKey) firstInvalidKey = makeFieldKey(itemIdx, descriptionFieldKey);
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
      const rawItemInspirationUploads = await Promise.all(itemInspirationFiles.map((list) => filesToBase64(list)));
      const itemInspirationUploads = rawItemInspirationUploads.map((uploads, idx) =>
        uploads.map((upload, photoIdx) => {
          const rawName = upload.filename?.trim() || "";
          const label = `Item ${idx + 1} inspiration`;
          const fallback = `${label} ${photoIdx + 1}.jpg`;
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
    const measurementPhotos = itemUploads[idx] ?? [];
    const inspirationPhotos = itemInspirationUploads[idx] ?? [];
    const photos = [...measurementPhotos, ...inspirationPhotos];
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
      inspiration_photos: inspirationPhotos.length ? inspirationPhotos : undefined,
    };
  })
  .filter((item): item is ItemPayload => item !== null);

      // flatten uploads: general, per-item photos, per-question files
      const flattenedUploads = [
        ...generalUploads,
        ...itemUploads.flat(),
        ...itemInspirationUploads.flat(),
        ...itemQuestionUploads.flat().map((u) => ({ filename: u.filename, mimeType: u.mimeType, base64: u.base64 })),
      ];

      const normalizedContacts = normalizeContactAnswers(contactAnswers);

      const answersPayload = {
        ...normalizedContacts,
        ...globalSpecs,
        items: itemsPayload,
      };

      await postJSON(`/public/leads/${encodeURIComponent(lead.id)}/submit-questionnaire`, {
        answers: answersPayload,
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
              <p className="text-xs text-slate-500">We send your estimate to this email, so double-check it.</p>
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
                  const labelText = q.key === "contact_name" ? "Full name" : q.label || q.key;
                  const textInputPlaceholder =
                    q.key === "contact_name"
                      ? "Your full name"
                      : q.key === "email"
                      ? "your.email@example.com"
                      : q.key === "phone"
                      ? "Your phone number"
                      : undefined;
                  const inputType =
                    q.type === "number"
                      ? "number"
                      : q.type === "date"
                      ? "date"
                      : q.key === "email" || q.type === "email"
                      ? "email"
                      : q.key === "phone" || q.type === "phone"
                      ? "tel"
                      : "text";

                  return (
                    <div key={q.key} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">
                        {labelText}
                        {q.required ? <span className="text-rose-500"> *</span> : null}
                      </label>

                      {q.type === "textarea" ? (
                        <textarea
                          {...commonProps}
                          className={`${inputClass} min-h-[100px]`}
                          value={valueOrEmpty(contactAnswers[q.key])}
                          onChange={(e) => setContactField(q.key, e.target.value)}
                          placeholder={q.key === "address" ? "Your full address including postcode" : undefined}
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
                          type={inputType}
                          className={inputClass}
                          value={valueOrEmpty(contactAnswers[q.key])}
                          onChange={(e) => setContactField(q.key, e.target.value)}
                          placeholder={textInputPlaceholder}
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

            <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Project-wide specifications</h2>
                <p className="text-sm text-slate-500">
                  Set the timber, glazing, finish and hardware that apply to every opening. We&rsquo;ll auto-populate
                  each description unless you switch an item to manual mode.
                </p>
              </div>

              <div className="grid gap-4">
                {GLOBAL_SPEC_FIELD_CONFIG.map((spec) => {
                  const selectValue = getSpecSelectValue(globalSpecs[spec.key], spec.options);
                  const showCustomInput = selectValue === CUSTOM_SPEC_VALUE;
                  return (
                    <div key={spec.key} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor={`global-${spec.key}`} className="text-sm font-medium text-slate-700">
                          {spec.label}
                        </Label>
                        <span className="text-xs text-slate-400">{spec.helper}</span>
                      </div>
                      <Select value={selectValue} onValueChange={(val) => handleGlobalSpecSelect(spec.key, val, spec.options)}>
                        <SelectTrigger className="w-full rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3 text-left text-sm shadow-sm">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNSET_SPEC_VALUE}>Not sure yet</SelectItem>
                          {spec.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_SPEC_VALUE}>Custom value…</SelectItem>
                        </SelectContent>
                      </Select>
                      {showCustomInput ? (
                        <Input
                          id={`global-${spec.key}`}
                          className={baseInputClasses}
                          value={valueOrEmpty(globalSpecs[spec.key])}
                          onChange={(e) => handleGlobalSpecInput(spec.key, e.target.value)}
                          placeholder={spec.placeholder}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

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
                    const descriptionLabel = descriptionQuestion?.label || "Opening description";
                    const descriptionRequired = Boolean(descriptionQuestion?.required);
                    const descriptionMode =
                      typeof itemData.description_mode === "string" ? itemData.description_mode : DESCRIPTION_AUTO_MODE;
                    const isAutoMode = descriptionMode !== DESCRIPTION_MANUAL_MODE;
                    const descriptionFieldId = makeFieldKey(itemIdx, descriptionFieldKey);
                    const descriptionValue = getItemDescriptionValue(itemData);
                    const descriptionError = itemErr[descriptionFieldKey];

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

                        <div className="space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {descriptionLabel}
                                {descriptionRequired ? <span className="text-rose-500"> *</span> : null}
                              </p>
                              <p className="text-xs text-slate-500">
                                {isAutoMode
                                  ? "Auto-updates from your project specs."
                                  : "Locked to your wording for this item."}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-semibold text-[rgb(var(--brand))] underline-offset-2 hover:underline"
                              onClick={() =>
                                handleDescriptionModeToggle(
                                  itemIdx,
                                  isAutoMode ? DESCRIPTION_MANUAL_MODE : DESCRIPTION_AUTO_MODE
                                )
                              }
                            >
                              {isAutoMode ? "Switch to manual edit" : "Revert to auto text"}
                            </button>
                          </div>
                          <textarea
                            id={descriptionFieldId}
                            ref={registerFieldRef(descriptionFieldId)}
                            className={`${baseInputClasses} min-h-[140px] ${isAutoMode ? "bg-slate-50" : "bg-white"}`}
                            value={valueOrEmpty(descriptionValue)}
                            readOnly={isAutoMode}
                            onChange={(e) => handleDescriptionChange(itemIdx, e.target.value)}
                            aria-invalid={descriptionError ? true : undefined}
                            aria-describedby={descriptionError ? `${descriptionFieldId}-err` : undefined}
                          />
                          {isAutoMode ? (
                            <p className="text-xs text-slate-500">
                              Need tweaks? Switch to manual, edit the text, and we&rsquo;ll remember it for this item.
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Manual descriptions stay exactly as you type, even if the global specs change.
                            </p>
                          )}
                          {descriptionError ? (
                            <p id={`${descriptionFieldId}-err`} className="text-xs text-rose-600">
                              {descriptionError}
                            </p>
                          ) : null}
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

                        <InspirationUploadField
                          className="bg-white/80"
                          disabled={submitting}
                          files={itemInspirationFiles[itemIdx] ?? []}
                          attributes={(itemAnswers[itemIdx]?.inspiration_attributes as Record<string, any>) ?? null}
                          onFilesChange={(fileList) => handleInspirationFileChange(itemIdx, fileList)}
                          onResult={(result) =>
                            applyItemPatch(itemIdx, {
                              inspiration_attributes: result.attributes,
                              inspiration_description: result.attributes?.description ?? null,
                              inspiration_confidence: result.confidence ?? null,
                              inspiration_source: "INSPIRATION_PHOTO",
                              vision_source: "INSPIRATION_PHOTO",
                              inference_source: "INSPIRATION_PHOTO",
                            })
                          }
                        />

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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function isEmptyValue(v: any) {
  return v === undefined || v === null || String(v).trim() === "";
}
function valueOrEmpty(v: any) {
  return v == null ? "" : String(v);
}

function looksLikeEmail(value: any): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return EMAIL_REGEX.test(trimmed);
}

function normalizeContactAnswers(answers: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  Object.keys(answers || {}).forEach((key) => {
    const val = answers[key];
    normalized[key] = typeof val === "string" ? val.trim() : val;
  });
  return normalized;
}

function normalizeGlobalSpecValue(raw: any): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.length > MAX_SPEC_INPUT_LENGTH ? trimmed.slice(0, MAX_SPEC_INPUT_LENGTH) : trimmed;
}

function specValueOrNull(value: string): string | null {
  const normalized = normalizeGlobalSpecValue(value);
  return normalized || null;
}

function getSpecSelectValue(value: string, options: string[]): string {
  if (!value) return UNSET_SPEC_VALUE;
  return options.includes(value) ? value : CUSTOM_SPEC_VALUE;
}

function getItemDescriptionValue(item: Record<string, any>): string {
  if (!item || typeof item !== "object") return "";
  for (const key of DESCRIPTION_KEY_PRIORITY) {
    const raw = item[key as keyof typeof item];
    if (typeof raw === "string" && raw.trim()) {
      return raw;
    }
  }
  const fallback = item.description;
  return typeof fallback === "string" ? fallback : "";
}

function applyDescriptionValue(item: Record<string, any>, value: string, preferredKey: string): Record<string, any> {
  const normalized = typeof value === "string" ? value : "";
  const next = { ...item, [preferredKey]: normalized };
  if (preferredKey !== "description") {
    next.description = normalized;
  }
  return next;
}

function extractStructuralInfo(item: Record<string, any>): StructuralInfo {
  return {
    productType: pickFirstStringValue(item, PRODUCT_TYPE_FIELD_KEYS),
    openingConfig: pickFirstStringValue(item, OPENING_CONFIG_FIELD_KEYS),
    glazingStyle: pickFirstStringValue(item, GLAZING_STYLE_FIELD_KEYS),
    glassType: pickFirstStringValue(item, GLASS_FIELD_KEYS),
    colour: pickFirstStringValue(item, COLOUR_FIELD_KEYS),
    color: pickFirstStringValue(item, ["color", "vision_color", "finish_color"]),
    material: pickFirstStringValue(item, MATERIAL_FIELD_KEYS),
    finish: pickFirstStringValue(item, FINISH_FIELD_KEYS),
    ironmongery: pickFirstStringValue(item, IRONMONGERY_FIELD_KEYS),
    description: getItemDescriptionValue(item),
  };
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