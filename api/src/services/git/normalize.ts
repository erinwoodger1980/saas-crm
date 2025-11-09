import fs from 'fs';
import path from 'path';
import { buildRepoTreeIndex, findClosestPath, buildManifest } from '../repo/tree';
import { minimatch } from 'minimatch';

export interface NormalizeResult { diff: string; warnings: string[]; }
interface PathError extends Error { code: string; details?: any; }

// Configuration
const PATH_ALIAS_ENABLED = process.env.PATH_ALIAS_ENABLED !== 'false'; // default true
const PATH_ALIAS_FILE = process.env.PATH_ALIAS_FILE || '.saferun/path-aliases.json';
const PATH_MATCH_MAX_DISTANCE = Number(process.env.PATH_MATCH_MAX_DISTANCE || 2);

interface AliasConfig {
  aliases: Record<string, string>;
}

let aliasConfigCache: AliasConfig | null = null;

/**
 * Load path alias configuration from file.
 */
function loadAliasConfig(repoRoot: string): AliasConfig {
  if (aliasConfigCache) return aliasConfigCache;
  
  const configPath = path.join(repoRoot, PATH_ALIAS_FILE);
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    aliasConfigCache = JSON.parse(content);
    return aliasConfigCache!;
  } catch {
    // No config file or invalid JSON
    return { aliases: {} };
  }
}

/**
 * Apply alias map with multiple strategies to resolve a requested path.
 * Only returns a path if it exists in the manifest (allowlist enforced).
 */
function applyAliasMap(
  requestedPath: string,
  repoRoot: string,
  manifest: Set<string>
): { resolved: string; reason: string } | null {
  if (!PATH_ALIAS_ENABLED) return null;
  
  const reqPosix = requestedPath.replace(/\\/g, '/').replace(/^\.\//, '');
  
  // Strategy A: Static alias map from config
  const config = loadAliasConfig(repoRoot);
  
  // Check exact match first
  if (config.aliases[reqPosix]) {
    const target = config.aliases[reqPosix];
    if (manifest.has(target)) {
      return { resolved: target, reason: 'alias-exact' };
    }
  }
  
  // Check wildcard patterns
  for (const [pattern, targetPattern] of Object.entries(config.aliases)) {
    if (pattern.includes('**')) {
      if (minimatch(reqPosix, pattern)) {
        // Replace ** with matched portion
        const regex = new RegExp(pattern.replace('**', '(.*)'));
        const match = reqPosix.match(regex);
        if (match && match[1]) {
          const target = targetPattern.replace('**', match[1]);
          if (manifest.has(target)) {
            return { resolved: target, reason: 'alias-wildcard' };
          }
        }
      }
    }
  }
  
  // Strategy B: Common prefix stripping
  const prefixRules = [
    { prefix: 'web/src/', strip: 'web/src/' },
    { prefix: 'src/', strip: 'src/' },
    { prefix: 'packages/web/', strip: 'packages/web/', replace: 'app/' },
    { prefix: 'apps/web/', strip: 'apps/web/', replace: 'app/' },
  ];
  
  for (const rule of prefixRules) {
    if (reqPosix.startsWith(rule.prefix)) {
      const stripped = reqPosix.slice(rule.prefix.length);
      const target = rule.replace ? rule.replace + stripped : stripped;
      if (manifest.has(target)) {
        return { resolved: target, reason: 'prefix-strip' };
      }
    }
  }
  
  // Strategy C: Filename canonicalization for Next.js App Router
  // e.g., "dashboard.tsx" -> "app/(admin)/dashboard/page.tsx"
  const basename = path.posix.basename(reqPosix);
  const basenameNoExt = basename.replace(/\.(tsx?|jsx?)$/, '');
  
  if (basename.match(/\.(tsx?|jsx?)$/)) {
    // Look for App Router pattern: <name>/page.tsx
    for (const p of manifest) {
      if (p.endsWith(`/${basenameNoExt}/page.tsx`)) {
        return { resolved: p, reason: 'filename-to-route' };
      }
    }
  }
  
  // Strategy D: Case-insensitive match
  const lower = reqPosix.toLowerCase();
  for (const p of manifest) {
    if (p.toLowerCase() === lower) {
      return { resolved: p, reason: 'case-insensitive' };
    }
  }
  
  // Strategy E: Levenshtein on last segment (fuzzy match)
  // Only if parent directory matches
  const dirReq = path.posix.dirname(reqPosix);
  const lastSegment = path.posix.basename(reqPosix);
  
  let bestMatch: { resolved: string; distance: number } | null = null;
  
  for (const p of manifest) {
    const dirP = path.posix.dirname(p);
    if (dirP !== dirReq) continue; // Must be in same directory
    
    const lastP = path.posix.basename(p);
    const dist = levenshteinDistance(lastSegment, lastP);
    
    if (dist <= PATH_MATCH_MAX_DISTANCE) {
      if (!bestMatch || dist < bestMatch.distance) {
        bestMatch = { resolved: p, distance: dist };
      }
    }
  }
  
  if (bestMatch) {
    return { resolved: bestMatch.resolved, reason: `fuzzy-match-dist-${bestMatch.distance}` };
  }
  
  return null;
}

/**
 * Levenshtein distance for fuzzy matching.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

export function normalizeDiffPaths(diffText: string, allowGlobs: string[] | null, repoRoot: string): NormalizeResult {
  const warnings: string[] = [];
  if (!diffText.trim()) return { diff: diffText, warnings };
  
  // Build manifest Set for fast lookups
  const manifest = buildManifest(repoRoot, allowGlobs);
  const index = buildRepoTreeIndex(repoRoot, allowGlobs);
  const lines = diffText.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('--- ')) {
      const next = lines[i + 1] || '';
      if (next.startsWith('+++ ')) {
        const aRaw = line.slice(4).trim();
        const bRaw = next.slice(4).trim();
        let aPath = aRaw.replace(/^a\//, '').replace(/^\.\//, '');
        let bPath = bRaw.replace(/^b\//, '').replace(/^\.\//, '');
        const aNew = aPath === '/dev/null';
        const bNew = bPath === '/dev/null';

        const isCreateAttempt = !aNew && !manifest.has(aPath) && !manifest.has(bPath);
        if (isCreateAttempt) {
          // Try alias map first for create attempts
          const aliasResult = applyAliasMap(bPath, repoRoot, manifest);
          if (aliasResult) {
            warnings.push(`normalized: "${bPath}" -> "${aliasResult.resolved}" (${aliasResult.reason})`);
            bPath = aliasResult.resolved;
          } else {
            // Fall back to existing close match logic
            const close = findClosestPath(bPath, index);
            if (!close) {
              // Only allow creating new files when an explicit allowlist is provided and matches the directory
              const dir = path.posix.dirname(bPath);
              const dirOk = Array.isArray(allowGlobs) && allowGlobs.length > 0 && allowGlobs.some(g => minimatch(dir + '/', g.replace(/\*$|\*\*$|$/,'/'), { nocase: true }));
              if (dirOk) {
                warnings.push(`Converted invented file '${bPath}' to new file patch.`);
                out.push('--- /dev/null');
                out.push('+++ b/' + bPath);
                i++; continue;
              }
            }
          }
        }
        
        function resolve(p: string): string {
          if (p === '/dev/null') return p;
          if (manifest.has(p)) return p;
          
          // Try alias map first
          const aliasResult = applyAliasMap(p, repoRoot, manifest);
          if (aliasResult) {
            warnings.push(`normalized: "${p}" -> "${aliasResult.resolved}" (${aliasResult.reason})`);
            return aliasResult.resolved;
          }
          
          // Fall back to existing close match logic
          const c = findClosestPath(p, index);
          if (c) {
            if (c.resolved !== p) warnings.push(`Rewrote '${p}' -> '${c.resolved}' (${c.reason})`);
            return c.resolved;
          }
          return p;
        }
        
        const resolvedA = resolve(aPath);
        const resolvedB = resolve(bPath);
        
        if (!aNew && !manifest.has(resolvedA)) {
          const err: PathError = new Error(`Path '${aPath}' not found and no safe match.`) as PathError; 
          err.code='PATH_NOT_FOUND'; 
          err.details={requested:aPath,tried:resolvedA}; 
          throw err;
        }
        if (!bNew && !manifest.has(resolvedB) && resolvedB !== '/dev/null') {
          const err: PathError = new Error(`Path '${bPath}' not found and no safe match.`) as PathError; 
          err.code='PATH_NOT_FOUND'; 
          err.details={requested:bPath,tried:resolvedB}; 
          throw err;
        }
        
        out.push((aNew? '--- /dev/null' : '--- a/' + resolvedA));
        out.push((bNew? '+++ /dev/null' : '+++ b/' + resolvedB));
        i++; continue;
      }
    }
    out.push(line);
  }
  return { diff: out.join('\n'), warnings };
}

export function expandAllowlistToPaths(globs: string[] | null, repoRoot: string): string[] {
  const index = buildRepoTreeIndex(repoRoot, globs);
  return Array.from(index.paths).sort();
}
