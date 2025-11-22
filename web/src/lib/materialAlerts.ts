import type { ParsedLineDto } from "@/lib/api/quotes";

export interface MaterialCostEntry {
  id: string;
  materialCode: string | null;
  materialLabel: string | null;
  supplierName: string | null;
  previousUnitPrice: number | null;
  currentUnitPrice: number | null;
  changePercent: number | null;
  currency: string | null;
  changedAt: string | null;
}

export interface DerivedAlert extends MaterialCostEntry {
  matchedTokens: string[];
  matchedCode: boolean;
  significant: boolean;
  severity: 'minor' | 'moderate' | 'major';
}

const STOP_WORDS = new Set([
  "the","and","for","with","from","into","inch","mm","per","each","unit","pcs","piece","pieces","to","of","at","on"
]);

// Simple caches to avoid re-tokenizing identical strings during a render cycle
const tokenCache = new Map<string, string[]>();
const setCache = new Map<string, Set<string>>();

function tokenize(value: string): string[] {
  const key = `t:${value}`;
  if (tokenCache.has(key)) return tokenCache.get(key)!;
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  tokenCache.set(key, tokens);
  return tokens;
}

function descriptionTokens(desc: string): Set<string> {
  const key = `s:${desc}`;
  if (setCache.has(key)) return setCache.get(key)!;
  const set = new Set(tokenize(desc));
  setCache.set(key, set);
  return set;
}

function labelTokens(label: string | null): string[] {
  if (!label) return [];
  return tokenize(label);
}
// --- Fuzzy matching helpers ---
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const dp: number[] = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) dp[j] = j;
  for (let i = 1; i <= al; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bl; j++) {
      const tmp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      }
      prev = tmp;
    }
  }
  return dp[bl];
}

function similarity(a: string, b: string): number {
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

/**
 * Derive material alerts relevant to provided line descriptions.
 * Criteria:
 * - Code match (exact token) OR ≥1 label token match OR fuzzy token/phrase match
 * - Significant change: |changePercent| >= minPercent OR code match
 * Fuzzy token similarity via Levenshtein (default threshold 0.82)
 */
export function deriveLineMaterialAlerts(
  lines: ParsedLineDto[] | undefined | null,
  recentCosts: MaterialCostEntry[] | undefined | null,
  options: { minPercent?: number; fuzzyThreshold?: number } = {}
): DerivedAlert[] {
  if (!lines || lines.length === 0 || !recentCosts || recentCosts.length === 0) return [];
  const minPercent = options.minPercent ?? 3;
  const fuzzyThreshold = options.fuzzyThreshold ?? 0.82;

  const lineTokenSets = lines.map(l => descriptionTokens(l.description || ""));
  const lineDescriptions = lines.map(l => (l.description || "").toLowerCase());

  return recentCosts
    .map(cost => {
      const code = (cost.materialCode || "").toLowerCase();
      const label = (cost.materialLabel || cost.materialCode || "").toLowerCase();
      const tokens = labelTokens(label);
      let matchedCode = false;
      let matchedTokens: string[] = [];
      let fuzzyTokens: string[] = [];
      let fuzzyPhrase = false;
      for (let i = 0; i < lineTokenSets.length; i++) {
        const set = lineTokenSets[i];
        const desc = lineDescriptions[i];
        if (code && set.has(code)) matchedCode = true;
        const exactMatches = tokens.filter(t => set.has(t));
        if (exactMatches.length) matchedTokens = Array.from(new Set([...matchedTokens, ...exactMatches]));
        for (const t of tokens) {
          if (matchedTokens.includes(t)) continue;
          for (const lineTok of set) {
            if (lineTok === t) continue;
            if (Math.abs(lineTok.length - t.length) > Math.max(2, Math.round(t.length * 0.5))) continue;
            const sim = similarity(lineTok, t);
            if (sim >= fuzzyThreshold) {
              fuzzyTokens.push(`${t}~${lineTok}`);
              break;
            }
          }
        }
        if (!fuzzyPhrase && tokens.length > 1) {
          let present = 0;
          for (const t of tokens) {
            if (set.has(t)) present++;
            else if (fuzzyTokens.some(ft => ft.startsWith(t + '~'))) present++;
          }
          if (present / tokens.length >= 0.7) fuzzyPhrase = true;
        }
      }
      const hasAnyMatch = matchedCode || matchedTokens.length > 0 || fuzzyTokens.length > 0 || fuzzyPhrase;
      if (!hasAnyMatch) return null;
      const change = cost.changePercent ?? 0;
      const significant = matchedCode || Math.abs(change) >= minPercent;
      const allTokens = Array.from(new Set([...matchedTokens, ...fuzzyTokens]));
      // Severity scoring
      let severity: 'minor' | 'moderate' | 'major' = 'minor';
      const absChange = Math.abs(change);
      if (matchedCode && absChange >= 15) severity = 'major';
      else if (absChange >= 20) severity = 'major';
      else if (matchedCode && absChange >= 5) severity = 'moderate';
      else if (absChange >= 10) severity = 'moderate';
      // Code match with tiny change still minor
      return { ...cost, matchedTokens: allTokens, matchedCode, significant, severity } as DerivedAlert;
    })
    .filter(Boolean) as DerivedAlert[]
    .sort((a, b) => {
      const rank = (s: 'minor' | 'moderate' | 'major') => (s === 'major' ? 3 : s === 'moderate' ? 2 : 1);
      const rDiff = rank(b.severity) - rank(a.severity);
      if (rDiff !== 0) return rDiff;
      const aChange = Math.abs(a.changePercent ?? 0);
      const bChange = Math.abs(b.changePercent ?? 0);
      return bChange - aChange;
    });
}

// Group duplicate materials (same code or normalized label) aggregating suppliers & max change
export interface GroupedAlert extends Omit<DerivedAlert, 'supplierName'> {
  suppliers: string[];
}

export function groupAlerts(alerts: DerivedAlert[]): GroupedAlert[] {
  const map = new Map<string, GroupedAlert>();
  for (const a of alerts) {
    const key = (a.materialCode || (a.materialLabel || '')).toLowerCase();
    if (!map.has(key)) {
      map.set(key, { ...a, suppliers: a.supplierName ? [a.supplierName] : [] });
      continue;
    }
    const existing = map.get(key)!;
    if (a.supplierName && !existing.suppliers.includes(a.supplierName)) existing.suppliers.push(a.supplierName);
    // Prefer alert with higher severity or larger absolute change
    const rank = (s: 'minor' | 'moderate' | 'major') => (s === 'major' ? 3 : s === 'moderate' ? 2 : 1);
    const existingChange = Math.abs(existing.changePercent ?? 0);
    const newChange = Math.abs(a.changePercent ?? 0);
    if (rank(a.severity) > rank(existing.severity) || newChange > existingChange) {
      map.set(key, { ...a, suppliers: existing.suppliers });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const rank = (s: 'minor' | 'moderate' | 'major') => (s === 'major' ? 3 : s === 'moderate' ? 2 : 1);
    const rDiff = rank(b.severity) - rank(a.severity);
    if (rDiff !== 0) return rDiff;
    return Math.abs((b.changePercent ?? 0)) - Math.abs((a.changePercent ?? 0));
  });
}
