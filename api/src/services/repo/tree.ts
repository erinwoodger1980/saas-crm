import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';

export interface RepoTreeIndex {
  paths: Set<string>; // POSIX relative paths
  generatedAt: number;
}

let cached: RepoTreeIndex | null = null;
let cachedAllow: string[] | null = null;

const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);

function toPosix(p: string) {
  return p.split(path.sep).join('/');
}

export function buildRepoTreeIndex(repoRoot: string, allowGlobs: string[] | null, ttlMs = 60_000): RepoTreeIndex {
  const now = Date.now();
  const normalizedAllow = allowGlobs ? allowGlobs.slice().sort() : [];
  if (cached && cachedAllow && JSON.stringify(cachedAllow) === JSON.stringify(normalizedAllow) && (now - cached.generatedAt) < ttlMs) return cached;

  const paths = new Set<string>();
  function isAllowed(rel: string): boolean {
    if (!allowGlobs || allowGlobs.length === 0) return true;
    return normalizedAllow.some(g => minimatch(rel, g, { nocase: true }));
  }
  function walk(dir: string) {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const rel = toPosix(path.relative(repoRoot, full));
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        if (isAllowed(rel)) paths.add(rel);
      }
    }
  }
  walk(repoRoot);
  cached = { paths, generatedAt: now };
  cachedAllow = normalizedAllow;
  return cached;
}

export interface ClosestPathResult { requested: string; resolved: string; distance: number; reason: string; }

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

const STRIP_PREFIXES = ['web/src/', 'src/', 'packages/web/', 'apps/web/'];

export function findClosestPath(requested: string, index: RepoTreeIndex, maxDistance = Number(process.env.PATH_MATCH_MAX_DISTANCE || 3)): ClosestPathResult | null {
  const reqPosix = requested.replace(/\\/g, '/').replace(/^\.\//, '');
  const paths = index.paths;
  if (paths.has(reqPosix)) return { requested, resolved: reqPosix, distance: 0, reason: 'exact' };
  for (const pref of STRIP_PREFIXES) {
    if (reqPosix.startsWith(pref)) {
      const stripped = reqPosix.slice(pref.length);
      if (paths.has(stripped)) return { requested, resolved: stripped, distance: 0, reason: 'prefix-strip' };
    }
  }
  const lower = reqPosix.toLowerCase();
  for (const p of paths) if (p.toLowerCase() === lower) return { requested, resolved: p, distance: 0, reason: 'case-insensitive' };
  const last = path.posix.basename(reqPosix);
  const baseNoExt = last.replace(/\.[^.]+$/, '');
  if (last.endsWith('.tsx')) {
    const candidate = Array.from(paths).find(p => p.endsWith(`/${baseNoExt}/page.tsx`));
    if (candidate) return { requested, resolved: candidate, distance: 1, reason: 'filename->route-page' };
  }
  // Only attempt fuzzy filename match if the requested directory exists in the index
  const dirReq = path.posix.dirname(reqPosix);
  const dirExists = Array.from(paths).some(p => p.startsWith(dirReq.endsWith('/') ? dirReq : dirReq + '/'));
  if (!dirExists) return null;
  let best: ClosestPathResult | null = null;
  for (const p of paths) {
    if (!p.startsWith(dirReq.endsWith('/') ? dirReq : dirReq + '/')) continue; // restrict to same dir
    const seg = path.posix.basename(p);
    const d = levenshtein(last, seg);
    if (d <= maxDistance) if (!best || d < best.distance) best = { requested, resolved: p, distance: d, reason: 'levenshtein-last-segment' };
  }
  return best;
}

/**
 * Build a Set of allowlisted paths for quick lookup.
 * Convenience wrapper around buildRepoTreeIndex for normalizer use.
 */
export function buildManifest(repoRoot: string, allowGlobs: string[] | null): Set<string> {
  const index = buildRepoTreeIndex(repoRoot, allowGlobs);
  return index.paths;
}
