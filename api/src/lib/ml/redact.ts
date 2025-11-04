const SHOULD_REDACT = String(process.env.ML_REDACT_PII ?? "true").toLowerCase() !== "false";

const EMAIL_TOKEN = "<EMAIL>";
const PHONE_TOKEN = "<PHONE>";
const URL_TOKEN = "<URL>";
const POSTCODE_TOKEN = "<POSTCODE>";

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
const PHONE_REGEX = /\+?\d[\d\s().-]{7,}\d/g;
const POSTCODE_REGEX = /\b(?:[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi;

function maskText(text: string): string {
  let out = text;
  out = out.replace(EMAIL_REGEX, EMAIL_TOKEN);
  out = out.replace(URL_REGEX, URL_TOKEN);
  out = out.replace(POSTCODE_REGEX, POSTCODE_TOKEN);
  out = out.replace(PHONE_REGEX, PHONE_TOKEN);
  return out;
}

export function redactEmailBody(input: unknown): string {
  if (!SHOULD_REDACT) return typeof input === "string" ? input : String(input ?? "");
  if (typeof input !== "string") return typeof input === "number" ? String(input) : "";
  return maskText(input);
}

export function redactSupplierLine(input: unknown): string {
  if (!SHOULD_REDACT) return typeof input === "string" ? input : String(input ?? "");
  if (typeof input !== "string") return typeof input === "number" ? String(input) : "";
  return maskText(input);
}
