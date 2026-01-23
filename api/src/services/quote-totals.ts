// api/src/services/quote-totals.ts
// Shared quote totals + validation helpers for PDF/email generation.

import type { Quote, QuoteLine, TenantSettings } from "@prisma/client";

export type QuoteTotals = {
  subtotal: number;
  vatAmount: number;
  totalGBP: number;
  vatRate: number;
  showVat: boolean;
  currencyCode: string;
  currencySymbol: string;
};

type QuoteWithLines = Quote & {
  lines: QuoteLine[];
  lead?: { contactName?: string | null; email?: string | null } | null;
  tenant?: { name?: string | null } | null;
};

function normalizeCurrency(input: any): string {
  const raw = String(input || "").trim();
  if (!raw) return "GBP";
  const upper = raw.toUpperCase();
  if (upper === "£" || upper === "GBP" || upper === "GB POUND" || upper === "POUND") return "GBP";
  if (upper === "$" || upper === "USD" || upper === "US DOLLAR") return "USD";
  if (upper === "EUR" || upper === "€" || upper === "EURO") return "EUR";
  return upper;
}

function currencySymbol(code: string | undefined): string {
  switch ((code || "GBP").toUpperCase()) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return "";
  }
}

function safeNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function recalculateQuoteTotals(params: {
  quote: QuoteWithLines;
  tenantSettings?: TenantSettings | null;
}): QuoteTotals {
  const { quote, tenantSettings } = params;
  const quoteDefaults: any = (tenantSettings?.quoteDefaults as any) || {};
  const currencyCode = normalizeCurrency(quote.currency || quoteDefaults?.currency || "GBP");
  const currencySymbolValue = currencySymbol(currencyCode);
  const vatRateOverrideRaw = safeNumber(((quote.meta as any) || {})?.vatRateOverride);
  const vatRateOverride =
    vatRateOverrideRaw != null && Number.isFinite(vatRateOverrideRaw)
      ? Math.min(1, Math.max(0, vatRateOverrideRaw))
      : null;
  const vatRate = vatRateOverride ?? Number(quoteDefaults?.vatRate ?? 0.2);
  const showVat = quoteDefaults?.showVat !== false;
  const marginDefault = Number(
    quote.markupDefault ?? quoteDefaults?.defaultMargin ?? 0.25,
  );

  const subtotal = quote.lines.reduce((sum, ln) => {
    const qty = Math.max(1, Number(ln.qty || 1));
    const metaAny: any = (ln.meta as any) || {};

    if (metaAny?.sellTotalGBP != null && Number.isFinite(Number(metaAny.sellTotalGBP))) {
      return sum + Number(metaAny.sellTotalGBP);
    }
    if (metaAny?.sellUnitGBP != null && Number.isFinite(Number(metaAny.sellUnitGBP))) {
      return sum + Number(metaAny.sellUnitGBP) * qty;
    }
    const lineTotal = safeNumber((ln as any)?.lineTotalGBP);
    if (lineTotal != null && Number.isFinite(lineTotal)) {
      return sum + lineTotal;
    }
    const unitPrice = Number(ln.unitPrice || 0);
    const sellUnit = unitPrice * (1 + marginDefault);
    return sum + sellUnit * qty;
  }, 0);

  const fallbackSubtotal = Number(quote.totalGBP ?? 0);
  const finalSubtotal =
    subtotal > 0 && Number.isFinite(subtotal) ? subtotal : Number.isFinite(fallbackSubtotal) ? fallbackSubtotal : 0;
  const vatAmount = showVat ? finalSubtotal * vatRate : 0;
  const totalGBP = finalSubtotal + vatAmount;

  return {
    subtotal: finalSubtotal,
    vatAmount,
    totalGBP,
    vatRate,
    showVat,
    currencyCode,
    currencySymbol: currencySymbolValue,
  };
}

export function validateQuoteForPdf(quote: QuoteWithLines): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!quote.lines || quote.lines.length === 0) {
    issues.push("Add at least one line item before generating a PDF.");
  }
  if (!quote.lead?.contactName && !quote.lead?.email) {
    warnings.push("Client contact details are missing; PDF will use a generic placeholder.");
  }
  if (!quote.title) {
    warnings.push("Quote title is missing; PDF will use a default title.");
  }

  return { issues, warnings };
}

export function validateQuoteForEmail(params: {
  quote: QuoteWithLines;
  recipientEmail?: string | null;
}): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (!params.recipientEmail) {
    issues.push("Client email address is required to send a quote.");
  }
  if (!params.quote.lines || params.quote.lines.length === 0) {
    issues.push("Add at least one line item before sending a quote.");
  }
  if (!params.quote.meta || !(params.quote.meta as any)?.proposalFileId) {
    warnings.push("Quote PDF has not been generated yet.");
  }
  return { issues, warnings };
}
