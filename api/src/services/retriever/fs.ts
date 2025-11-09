import fs from 'fs/promises';
import path from 'path';
import { minimatch } from 'minimatch';

const IGNORE_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo'];

/**
 * List all files in repoRoot that match allowGlobs (or all if allowGlobs is null).
 * Excludes common ignored directories.
 */
export async function listFilesWithAllowlist(
  repoRoot: string,
  allowGlobs: string[] | null
): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relative = path.relative(repoRoot, fullPath);
        
        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          // Convert to POSIX for glob matching
          const posixRelative = relative.split(path.sep).join('/');
          
          // If no allowlist, include all files
          if (!allowGlobs || allowGlobs.length === 0) {
            files.push(posixRelative);
          } else {
            // Check if file matches any glob pattern
            const matches = allowGlobs.some(glob => minimatch(posixRelative, glob));
            if (matches) {
              files.push(posixRelative);
            }
          }
        }
      }
    } catch (err) {
      // Skip inaccessible directories
    }
  }
  
  await walk(repoRoot);
  return files.sort();
}

/**
 * Read a file excerpt with optional line range or byte limit.
 * Returns the text and a flag indicating if content was clipped.
 */
export async function readExcerpt(
  filePath: string,
  opts: {
    start?: number;    // 1-indexed line number
    end?: number;      // 1-indexed line number
    maxBytes?: number; // byte limit
  } = {}
): Promise<{ text: string; clipped: boolean }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let start = opts.start ? Math.max(1, opts.start) : 1;
    let end = opts.end ? Math.min(lines.length, opts.end) : lines.length;
    
    // Extract line range (convert to 0-indexed)
    let excerpt = lines.slice(start - 1, end).join('\n');
    let clipped = start > 1 || end < lines.length;
    
    // Apply byte limit if specified
    if (opts.maxBytes && excerpt.length > opts.maxBytes) {
      excerpt = excerpt.slice(0, opts.maxBytes);
      clipped = true;
    }
    
    return { text: excerpt, clipped };
  } catch (err) {
    return { text: `[Error reading file: ${err}]`, clipped: false };
  }
}

/**
 * Search for files by keywords using simple heuristics.
 * Ranks by: filename contains keyword > path contains keyword > fuzzy match.
 * Returns up to maxMatches results.
 */
export function searchByKeywords(
  paths: string[],
  keywords: string[],
  maxMatches: number
): string[] {
  if (!keywords || keywords.length === 0) return [];
  
  const scored: Array<{ path: string; score: number }> = [];
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  for (const p of paths) {
    const lowerPath = p.toLowerCase();
    const filename = path.basename(p).toLowerCase();
    let score = 0;
    
    for (const kw of lowerKeywords) {
      // Exact filename match (highest priority)
      if (filename.includes(kw)) {
        score += 10;
      }
      // Path contains keyword
      else if (lowerPath.includes(kw)) {
        score += 5;
      }
      // Levenshtein-like fuzzy match (simple approximation)
      else if (levenshteinDistance(filename, kw) <= 2) {
        score += 2;
      }
    }
    
    if (score > 0) {
      scored.push({ path: p, score });
    }
  }
  
  // Sort by score descending and return top matches
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxMatches).map(s => s.path);
}

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}
