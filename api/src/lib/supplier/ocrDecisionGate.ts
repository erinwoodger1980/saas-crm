import type { ExtractionSummary } from "../pdf/extract";

export type OcrGateDebug = {
  samplePages: number;
  charCount: number;
  alphaNumRatio: number;
  containsMoneyTokens: boolean;
  containsLineItemPattern: boolean;
  useOcr: boolean;
  reasons: string[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function alphaNumRatio(text: string): number {
  const s = String(text || "");
  if (!s) return 0;
  const nonWs = (s.match(/\S/g) || []).length;
  if (!nonWs) return 0;
  const an = (s.match(/[A-Za-z0-9]/g) || []).length;
  return clamp01(an / nonWs);
}

function containsMoneyTokens(text: string): boolean {
  const s = String(text || "");
  if (!s) return false;
  // Keep this broad: we care about invoice-like PDFs.
  return /[£€$]|\bvat\b|\bsubtotal\b|\btotal\b|\bgrand total\b/i.test(s);
}

function containsLineItemPattern(text: string): boolean {
  const lines = String(text || "")
    .split(/\r?\n+/g)
    .map((l) => l.trim())
    .filter(Boolean);

  // Look for common patterns: qty + money on same line, or money decimals.
  const money = /(?:[£€$]\s*\d[\d,]*\.?\d{0,2}|\b\d[\d,]*\.\d{2}\b)/;
  const qty = /\bqty\b\s*[:]?\s*\d{1,4}\b|\b\d{1,4}\b/;

  for (const ln of lines.slice(0, 250)) {
    if (ln.length < 8) continue;
    if (/(page\s+\d+|invoice\s+no|quotation\s+no|terms|conditions)/i.test(ln)) continue;

    const hasMoney = money.test(ln);
    const hasQty = qty.test(ln);
    if (hasMoney && hasQty) return true;

    // Another very common pattern: multiple money-ish values on one line.
    const moneyHits = ln.match(/\b\d[\d,]*\.\d{2}\b/g) || [];
    if (moneyHits.length >= 2) return true;
  }

  return false;
}

export function explainShouldUseOcr(
  extractionSummary: ExtractionSummary,
  rawTextByPage: string[],
): OcrGateDebug {
  const pages = Array.isArray(rawTextByPage) && rawTextByPage.length
    ? rawTextByPage.slice(0, 2)
    : [String(extractionSummary?.rawText || "")];

  const joined = pages.join("\n\n");
  const charCount = joined.replace(/\s+/g, "").length;
  const anRatio = alphaNumRatio(joined);
  const moneyTokens = containsMoneyTokens(joined);
  const lineItem = containsLineItemPattern(joined);

  const reasons: string[] = [];

  // Decision rules (intentionally conservative: avoid OCR when text looks usable).
  // - If there is substantial text and it looks like an invoice/quote, do NOT OCR.
  // - If text is near-empty, low-quality, or lacks invoice-like structure, OCR is likely needed.
  const looksEmpty = charCount < 120;
  const looksLowQuality = anRatio < 0.35;
  const looksInvoiceLike = moneyTokens || lineItem;

  let useOcr = false;
  if (looksEmpty) {
    // If even a small sample clearly looks like a quote (money tokens / line item patterns),
    // treat it as usable and avoid OCR.
    useOcr = !looksInvoiceLike;
    reasons.push(`low_char_count:${charCount}`);
    if (looksInvoiceLike) reasons.push("invoice_tokens_present");
  } else if (looksLowQuality && !looksInvoiceLike) {
    useOcr = true;
    reasons.push(`low_alphaNumRatio:${anRatio.toFixed(3)}`);
    reasons.push("no_invoice_tokens");
  } else if (!looksInvoiceLike && charCount < 900) {
    useOcr = true;
    reasons.push("no_invoice_tokens");
    reasons.push(`moderate_char_count:${charCount}`);
  } else {
    useOcr = false;
    reasons.push("text_looks_usable");
  }

  return {
    samplePages: pages.length,
    charCount,
    alphaNumRatio: anRatio,
    containsMoneyTokens: moneyTokens,
    containsLineItemPattern: lineItem,
    useOcr,
    reasons,
  };
}

// Required by spec: boolean-returning function.
export function shouldUseOcr(extractionSummary: ExtractionSummary, rawTextByPage: string[]): boolean {
  return explainShouldUseOcr(extractionSummary, rawTextByPage).useOcr;
}
