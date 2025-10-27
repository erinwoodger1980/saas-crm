export function formatDaysLabel(value: number | string | null | undefined): string {
  if (value == null) return "–";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || Number.isNaN(numeric) || !Number.isFinite(numeric)) return "–";
  const days = numeric;
  if (days <= 0) return "Same day";
  if (days < 1) {
    const hours = Math.max(1, Math.round(days * 24));
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }
  const rounded = Math.round(days * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    const wholeDays = Math.max(1, Math.round(rounded));
    return `${wholeDays} day${wholeDays === 1 ? "" : "s"}`;
  }
  return `${rounded} days`;
}
