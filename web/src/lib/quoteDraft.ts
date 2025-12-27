export type QuoteDraft = {
  quoteNumber: string;
  issueDate: string;
  expiryDate: string;
  currency: string;
  vatRate: number;
  showVat: boolean;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  address: string | null;
  siteAddress: string | null;
  warnings: string[];
};

export function normalizeQuoteDraft(params: {
  quote: any;
  lead: any | null;
  tenantSettings?: any | null;
}): QuoteDraft {
  const { quote, lead, tenantSettings } = params;
  const quoteDefaults = (tenantSettings?.quoteDefaults as any) || {};
  const issueDate = new Date(
    (quote?.meta as any)?.issueDate || quote?.createdAt || new Date().toISOString(),
  );
  const validDays = Number(quoteDefaults?.validDays ?? 30);
  const expiryDate = new Date(
    (quote?.meta as any)?.expiryDate || issueDate.getTime() + Math.max(0, validDays) * 86400000,
  );

  const clientName = lead?.contactName || lead?.name || "Client";
  const clientEmail = lead?.email || lead?.contactEmail || null;
  const clientPhone = lead?.phone || lead?.contactPhone || null;
  const address = lead?.address || lead?.location || null;
  const siteAddress = lead?.siteAddress || lead?.projectAddress || null;

  const warnings: string[] = [];
  if (!clientEmail) warnings.push("Missing client email");
  if (!clientPhone) warnings.push("Missing client phone");
  if (!address) warnings.push("Missing client address");
  if (!quote?.id) warnings.push("Quote number unavailable");

  return {
    quoteNumber: quote?.quoteNumber || `Q-${String(quote?.id || "").slice(0, 8).toUpperCase()}`,
    issueDate: issueDate.toLocaleDateString(),
    expiryDate: expiryDate.toLocaleDateString(),
    currency: quote?.currency || quoteDefaults?.currency || "GBP",
    vatRate: Number(quoteDefaults?.vatRate ?? 0.2),
    showVat: quoteDefaults?.showVat !== false,
    clientName,
    clientEmail,
    clientPhone,
    address,
    siteAddress,
    warnings,
  };
}
