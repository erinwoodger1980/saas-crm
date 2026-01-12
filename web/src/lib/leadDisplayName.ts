export function buildLeadDisplayName(params: {
  contactName?: string | null;
  number?: string | null;
  description?: string | null;
  custom?: any;
  fallbackLabel: string;
}): string {
  const contactName = typeof params.contactName === "string" ? params.contactName.trim() : "";
  const number = typeof params.number === "string" ? params.number.trim() : "";
  const description = typeof params.description === "string" ? params.description.trim() : "";
  const base = contactName || description || params.fallbackLabel;

  const withNumber = number ? `${base} - ${number}` : base;

  const custom = params.custom;
  const isSplitChild =
    custom && typeof custom === "object" && !Array.isArray(custom) && Boolean((custom as any).splitParentOpportunityId);

  // Only show description alongside contact name for split children.
  // Otherwise keep the legacy behavior (contactName + number only).
  const shouldAppendDescription = Boolean(contactName) && Boolean(description) && description !== contactName && isSplitChild;

  return shouldAppendDescription ? `${withNumber} · ${description}` : withNumber;
}
