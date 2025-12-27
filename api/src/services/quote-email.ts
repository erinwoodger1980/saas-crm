// api/src/services/quote-email.ts
import type { Quote, QuoteLine, TenantSettings } from "@prisma/client";
import { recalculateQuoteTotals } from "./quote-totals";

type QuoteWithLines = Quote & {
  lines: QuoteLine[];
  lead?: { contactName?: string | null; email?: string | null } | null;
  tenant?: { name?: string | null } | null;
};

export type QuoteEmailPayload = {
  subject: string;
  bodyText: string;
  bodyHtml: string;
  summary: {
    total: number;
    currencySymbol: string;
    leadTime?: string | null;
    validUntil: string;
    lineItems: number;
  };
};

export function buildQuoteEmailPayload(params: {
  quote: QuoteWithLines;
  tenantSettings?: TenantSettings | null;
  recipientEmail: string;
}): QuoteEmailPayload {
  const { quote, tenantSettings, recipientEmail } = params;
  const totals = recalculateQuoteTotals({ quote, tenantSettings });
  const quoteDefaults: any = (tenantSettings?.quoteDefaults as any) || {};
  const tenantName = quote.tenant?.name || tenantSettings?.brandName || "JoineryAI";
  const clientName = quote.lead?.contactName || recipientEmail.split("@")[0] || "there";
  const validDays = Number(quoteDefaults?.validDays ?? 30);
  const validUntil = new Date(Date.now() + Math.max(0, validDays) * 86400000).toLocaleDateString();
  const leadTime = quoteDefaults?.leadTime || null;
  const subject = `Quotation – ${quote.title || "Your project"} (${tenantName})`;

  const leadTimeLine = leadTime ? `- Lead time: ${leadTime}\n` : "";
  const leadTimeHtml = leadTime ? `<li><strong>Lead time:</strong> ${leadTime}</li>` : "";

  const bodyText = `
Hi ${clientName},

Thank you for your enquiry. Please find your quotation from ${tenantName} attached.

Quote summary:
- Total: ${totals.currencySymbol}${totals.totalGBP.toFixed(2)}
- Line items: ${quote.lines.length}
${leadTimeLine}- Valid until: ${validUntil}

If you have any questions or would like to make changes, just reply to this email.

Best regards,
${tenantName}
  `.trim();

  const bodyHtml = `
    <p>Hi ${clientName},</p>
    <p>Thank you for your enquiry. Please find your quotation from ${tenantName} attached.</p>
    <h3>Quote summary:</h3>
    <ul>
      <li><strong>Total:</strong> ${totals.currencySymbol}${totals.totalGBP.toFixed(2)}</li>
      <li><strong>Line items:</strong> ${quote.lines.length}</li>
      ${leadTimeHtml}
      <li><strong>Valid until:</strong> ${validUntil}</li>
    </ul>
    <p>If you have any questions or would like to make changes, just reply to this email.</p>
    <p>Best regards,<br/>${tenantName}</p>
  `;

  return {
    subject,
    bodyText,
    bodyHtml,
    summary: {
      total: totals.totalGBP,
      currencySymbol: totals.currencySymbol,
      leadTime,
      validUntil,
      lineItems: quote.lines.length,
    },
  };
}
