// api/src/lib/followups-feature.ts

const DISABLED_VALUES = new Set(["false", "0", "no", "off", "disabled"]);

function normalize(value: string | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase();
}

export function isFollowupsEnabled(): boolean {
  const normalized = normalize(process.env.FOLLOWUPS_ENABLED ?? "true");
  if (!normalized) return true;
  return !DISABLED_VALUES.has(normalized);
}

export const FOLLOWUPS_ENABLED = isFollowupsEnabled();
