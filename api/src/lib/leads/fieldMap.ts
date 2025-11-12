export type CsvFieldTarget = {
  leadKey?: string;
  qKey?: string;
  transform?: (value: string) => any;
};

export type CanonicalFieldConfig = {
  type: "number" | "date";
};

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function fromParts(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

export function parseFlexibleDate(raw: string): Date | null {
  const value = (raw || "").trim();
  if (!value) return null;

  const isoMatch = value.match(/^([0-9]{4})[-\/\s]?([0-9]{1,2})[-\/\s]?([0-9]{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return fromParts(year, month - 1, day);
    }
  }

  const dmyMatch = value.match(/^([0-9]{1,2})[\/-]([0-9]{1,2})[\/-]([0-9]{2,4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    let year = Number(dmyMatch[3]);
    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return fromParts(year, month - 1, day);
    }
  }

  const monthNameMatch = value.match(/^([0-9]{1,2})[\/-\s]([A-Za-z]{3,9})[\/-\s]([0-9]{2,4})$/);
  if (monthNameMatch) {
    const day = Number(monthNameMatch[1]);
    const monthRaw = monthNameMatch[2].toLowerCase();
    const monthIndex = MONTH_MAP[monthRaw];
    if (monthIndex != null) {
      let year = Number(monthNameMatch[3]);
      if (year < 100) {
        year += year >= 70 ? 1900 : 2000;
      }
      if (day >= 1 && day <= 31) {
        return fromParts(year, monthIndex, day);
      }
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}

export function toISODate(raw: string): string | null {
  const parsed = parseFlexibleDate(raw);
  if (!parsed) return null;
  return parsed.toISOString();
}

export function toNumberGBP(raw: string): number | null {
  const value = (raw || "").trim();
  if (!value) return null;
  const cleaned = value
    .replace(/GBP/gi, "")
    .replace(/£/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  return number;
}

export const CSV_FIELD_MAP: Record<string, CsvFieldTarget> = {
  "estimated value": { leadKey: "estimatedValue", qKey: "estimatedValue", transform: toNumberGBP },
  "quoted value": { leadKey: "quotedValue", qKey: "quotedValue", transform: toNumberGBP },
  "date quote sent": { leadKey: "dateQuoteSent", qKey: "dateQuoteSent", transform: toISODate },
};

export const CANONICAL_FIELD_CONFIG: Record<string, CanonicalFieldConfig> = {
  estimatedValue: { type: "number" },
  quotedValue: { type: "number" },
  dateQuoteSent: { type: "date" },
  startDate: { type: "date" },
  deliveryDate: { type: "date" },
};

export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase();
}

export function lookupCsvField(header: string): CsvFieldTarget | null {
  const key = normaliseHeader(header);
  return CSV_FIELD_MAP[key] || null;
}
