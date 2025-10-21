import { randomUUID } from "crypto";

export type QuestionnaireFieldType = "text" | "textarea" | "select" | "number" | "date" | "source";

export type QuestionnaireField = {
  id: string;
  key: string;
  label: string;
  type: QuestionnaireFieldType;
  required: boolean;
  options: string[];
  askInQuestionnaire: boolean;
  showOnLead: boolean;
  sortOrder: number;
};

const FIELD_TYPES: QuestionnaireFieldType[] = ["text", "textarea", "select", "number", "date", "source"];

function makeId() {
  try {
    return randomUUID();
  } catch {
    return `field-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function toArray(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && Array.isArray(raw.questions)) return raw.questions;
  return [];
}

function sanitizeType(value: any): QuestionnaireFieldType {
  const str = typeof value === "string" ? value.trim().toLowerCase() : "";
  const match = FIELD_TYPES.find((t) => t === str);
  return match ?? "text";
}

export function normalizeQuestionnaire(raw: any): QuestionnaireField[] {
  const seenKeys = new Set<string>();
  const list = toArray(raw);

  const normalized = list
    .map((item: any, idx: number) => {
      if (!item || typeof item !== "object") return null;

      const keyRaw = typeof item.key === "string" ? item.key : typeof item.id === "string" ? item.id : "";
      const key = keyRaw.trim();
      if (!key) return null;
      if (seenKeys.has(key)) return null;
      seenKeys.add(key);

      const idRaw = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
      const id = idRaw || makeId();

      const labelRaw = typeof item.label === "string" && item.label.trim() ? item.label.trim() : key;
      const type = sanitizeType(item.type);
      const required = Boolean(item.required);
      const askInQuestionnaire = item.askInQuestionnaire === false ? false : true;
      const showOnLead = item.showOnLead !== undefined
        ? Boolean(item.showOnLead)
        : Boolean((item as any).showInternally || (item as any).workspace);

      const options =
        type === "select"
          ? Array.isArray(item.options)
            ? item.options
                .map((opt: unknown) =>
                  typeof opt === "string" ? opt.trim() : String(opt ?? "").trim(),
                )
                .filter(Boolean)
            : []
          : [];

      const sortOrder =
        typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
          ? item.sortOrder
          : idx;

      return {
        id,
        key,
        label: labelRaw,
        type,
        required,
        options,
        askInQuestionnaire,
        showOnLead,
        sortOrder,
      } as QuestionnaireField;
    })
    .filter((item): item is QuestionnaireField => Boolean(item));

  normalized.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return normalized.map((field, idx) => ({ ...field, sortOrder: idx }));
}

export function prepareQuestionnaireForSave(fields: QuestionnaireField[]): any[] {
  return fields.map((field, idx) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.type === "select" ? field.options : undefined,
    askInQuestionnaire: field.askInQuestionnaire,
    showOnLead: field.showOnLead,
    sortOrder: idx,
  }));
}
