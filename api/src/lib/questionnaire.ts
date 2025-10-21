import { randomUUID } from "crypto";

export type QuestionnaireFieldType =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "email"
  | "phone"
  | "checkbox"
  | "multi_select"
  | string;

export type QuestionnaireOptionInput =
  | string
  | number
  | boolean
  | null
  | undefined
  | { value?: unknown; label?: unknown };

export type QuestionnaireFieldInput = {
  id?: unknown;
  key?: unknown;
  label?: unknown;
  type?: unknown;
  required?: unknown;
  options?: unknown;
};

export type QuestionnaireField = {
  id: string;
  key: string;
  label: string;
  type: QuestionnaireFieldType;
  required: boolean;
  options?: string[];
};

function normalizeOption(option: QuestionnaireOptionInput, index: number): string {
  if (typeof option === "string") {
    return option.trim();
  }

  if (typeof option === "number" || typeof option === "boolean") {
    return option.toString();
  }

  if (option && typeof option === "object") {
    const valueRaw = (option as { value?: unknown }).value;
    const labelRaw = (option as { label?: unknown }).label;
    const value = typeof valueRaw === "string" ? valueRaw.trim() : undefined;
    const label = typeof labelRaw === "string" ? labelRaw.trim() : undefined;

    if (value) return value;
    if (label) return label;
  }

  return "";
}

function normalizeKey(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  return trimmed || fallback;
}

function normalizeType(raw: unknown): QuestionnaireFieldType {
  if (typeof raw !== "string") return "text";
  const trimmed = raw.trim();
  if (!trimmed) return "text";

  const allowed = new Set([
    "text",
    "textarea",
    "select",
    "number",
    "email",
    "phone",
    "checkbox",
    "multi_select",
  ]);

  return allowed.has(trimmed) ? (trimmed as QuestionnaireFieldType) : trimmed;
}

export function normalizeQuestionnaireField(
  input: QuestionnaireFieldInput,
  index: number
): QuestionnaireField | null {
  if (!input || typeof input !== "object") return null;

  const fallbackKey = `field_${index + 1}`;
  const idRaw = (input as { id?: unknown }).id;
  const labelRaw = (input as { label?: unknown }).label;

  const key = normalizeKey((input as { key?: unknown }).key, fallbackKey);
  const label = normalizeKey(labelRaw, key || fallbackKey);
  const idSource =
    typeof idRaw === "string" && idRaw.trim() ? idRaw.trim() : key || safeRandomId(index);

  const type = normalizeType((input as { type?: unknown }).type);
  const required = Boolean((input as { required?: unknown }).required);

  const optionsRaw = (input as { options?: unknown }).options;
  const options = Array.isArray(optionsRaw)
    ? optionsRaw
        .slice(0, 50)
        .map((opt: unknown, optIndex: number) =>
          normalizeOption(opt as QuestionnaireOptionInput, optIndex)
        )
        .map((value) => value.trim())
        .filter((value): value is string => value.length > 0)
    : undefined;

  const field: QuestionnaireField = {
    id: idSource || fallbackKey,
    key,
    label,
    type,
    required,
  };

  if (options && options.length > 0) {
    field.options = options;
  }

  return field;
}

function safeRandomId(index: number): string {
  try {
    return randomUUID();
  } catch {
    return `field_${Date.now()}_${index}`;
  }
}

export function normalizeQuestionnaireFields(input: unknown): QuestionnaireField[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => normalizeQuestionnaireField(item as QuestionnaireFieldInput, index))
    .filter((item): item is QuestionnaireField => Boolean(item));
}
