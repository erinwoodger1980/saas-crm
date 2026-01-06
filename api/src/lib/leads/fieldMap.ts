export type CsvFieldTarget = {
  leadKey?: string;
  clientKey?: string;
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
  // Lead fields
  "estimated value": { leadKey: "estimatedValue", qKey: "estimatedValue", transform: toNumberGBP },
  "quoted value": { leadKey: "quotedValue", qKey: "quotedValue", transform: toNumberGBP },
  "quote value": { leadKey: "quotedValue", qKey: "quote_value", transform: toNumberGBP },
  "quote ref": { qKey: "quote_ref" },
  "quoted by": { qKey: "quoted_by" },
  "enquiry date": { leadKey: "capturedAt", qKey: "date_of_enquiry", transform: toISODate },
  "date received": { leadKey: "capturedAt", qKey: "date_of_enquiry", transform: toISODate },
  "captured at": { leadKey: "capturedAt", qKey: "date_of_enquiry", transform: toISODate },
  "date of enquiry": { leadKey: "capturedAt", qKey: "date_of_enquiry", transform: toISODate },
  "date created": { leadKey: "capturedAt", qKey: "date_of_enquiry", transform: toISODate },
  "created date": { leadKey: "capturedAt", qKey: "date_of_enquiry", transform: toISODate },
  "created at": { leadKey: "capturedAt", qKey: "date_of_enquiry", transform: toISODate },
  "date quote sent": { qKey: "date_quote_sent", transform: toISODate },
  "date order placed": { qKey: "date_order_placed", transform: toISODate },
  "start date": { qKey: "startDate", transform: toISODate },
  "delivery date": { qKey: "deliveryDate", transform: toISODate },
  "workshop start date": { qKey: "startDate", transform: toISODate },
  "preferred installation date": { qKey: "preferred_installation_date", transform: toISODate },
  
  // Client profile fields
  "contact name": { leadKey: "contactName", qKey: "contact_name" },
  "your name": { leadKey: "contactName", qKey: "contact_name" },
  "name": { leadKey: "contactName", qKey: "contact_name" },
  "company": { leadKey: "company", qKey: "company" },
  "email": { leadKey: "email", qKey: "email" },
  "email address": { leadKey: "email", qKey: "email" },
  "phone": { leadKey: "phone", qKey: "phone" },
  "phone number": { leadKey: "phone", qKey: "phone" },
  // Source is stored canonically on Client
  "lead source": { clientKey: "source", qKey: "lead_source" },
  "source": { clientKey: "source", qKey: "source" },
  "region": { qKey: "region" },
  "project location": { qKey: "region" },
  "timeframe": { qKey: "timeframe" },
  "project timeframe": { qKey: "timeframe" },
  "listed building": { qKey: "property_listed" },
  "budget range": { qKey: "budget_range" },
  "additional notes": { qKey: "additional_notes" },
  "additional details": { qKey: "additional_notes" },
  "new build/existing": { qKey: "new_build_existing" },
  "installation required": { qKey: "installation_required" },
  
  // Public questionnaire fields
  "glazing type": { qKey: "glazing_type" },
  "curved or arched": { qKey: "has_curves" },
  "has curves": { qKey: "has_curves" },
  "window style": { qKey: "window_style" },
  "door type": { qKey: "door_type" },
  "timber type": { qKey: "timber_type" },
  "timber": { qKey: "timber" },
  "finish": { qKey: "finish" },
  "ironmongery level": { qKey: "ironmongery_level" },
  "ironmongery description": { qKey: "ironmongery_description" },
  "quantity": { qKey: "quantity" },
  "project description": { leadKey: "description", qKey: "project_description" },
  "height mm": { qKey: "height_mm" },
  "height": { qKey: "height_mm" },
  "width mm": { qKey: "width_mm" },
  "width": { qKey: "width_mm" },
  "glazing bars": { qKey: "glazing_bars" },
  
  // Internal fields
  "area m2": { qKey: "area_m2" },
  "project type": { qKey: "project_type" },
  "site visit required": { qKey: "site_visit_required" },
};

export const CANONICAL_FIELD_CONFIG: Record<string, CanonicalFieldConfig> = {
  estimatedValue: { type: "number" },
  quotedValue: { type: "number" },
  quote_value: { type: "number" },
  dateQuoteSent: { type: "date" },
  date_quote_sent: { type: "date" },
  capturedAt: { type: "date" },
  date_of_enquiry: { type: "date" },
  date_order_placed: { type: "date" },
  startDate: { type: "date" },
  deliveryDate: { type: "date" },
  preferred_installation_date: { type: "date" },
  installationStartDate: { type: "date" },
  installationEndDate: { type: "date" },
  area_m2: { type: "number" },
  height_mm: { type: "number" },
  width_mm: { type: "number" },
  quantity: { type: "number" },
  projected_hours: { type: "number" },
};

export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase();
}

export function lookupCsvField(header: string): CsvFieldTarget | null {
  const key = normaliseHeader(header);
  return CSV_FIELD_MAP[key] || null;
}
