import path from 'path';
import { buildRepoTreeIndex, findClosestPath } from '../repo/tree';
import { minimatch } from 'minimatch';

export interface NormalizeResult { diff: string; warnings: string[]; }
interface PathError extends Error { code: string; details?: any; }

export function normalizeDiffPaths(diffText: string, allowGlobs: string[] | null, repoRoot: string): NormalizeResult {
  const warnings: string[] = [];
  if (!diffText.trim()) return { diff: diffText, warnings };
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

        const isCreateAttempt = !aNew && !index.paths.has(aPath) && !index.paths.has(bPath);
        if (isCreateAttempt) {
          // Prefer resolving to an existing file if a close match exists
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
        function resolve(p: string): string {
          if (p === '/dev/null') return p;
          if (index.paths.has(p)) return p;
          const c = findClosestPath(p, index);
            if (c) {
              if (c.resolved !== p) warnings.push(`Rewrote '${p}' -> '${c.resolved}' (${c.reason})`);
              return c.resolved;
            }
          return p;
        }
        const resolvedA = resolve(aPath);
        const resolvedB = resolve(bPath);
        if (!aNew && !index.paths.has(resolvedA)) {
          const err: PathError = new Error(`Path '${aPath}' not found and no safe match.`) as PathError; err.code='PATH_NOT_FOUND'; err.details={requested:aPath,tried:resolvedA}; throw err;
        }
        if (!bNew && !index.paths.has(resolvedB) && resolvedB !== '/dev/null') {
          const err: PathError = new Error(`Path '${bPath}' not found and no safe match.`) as PathError; err.code='PATH_NOT_FOUND'; err.details={requested:bPath,tried:resolvedB}; throw err;
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
