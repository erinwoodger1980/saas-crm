import path from 'path';
import { minimatch } from 'minimatch';

export { expandAllowlistToPaths } from '../git/normalize';

/**
 * Ensure path is POSIX relative format (no leading slash, forward slashes).
 */
export function ensurePosixRelative(filePath: string): string {
  // Remove leading slash if present
  let normalized = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  
  // Convert backslashes to forward slashes
  normalized = normalized.split(path.sep).join('/');
  
  return normalized;
}

/**
 * Filter paths to only those matching allowGlobs.
 * If allowGlobs is null or empty, returns all paths.
 */
export function filterAllowed(
  paths: string[],
  allowGlobs: string[] | null
): string[] {
  if (!allowGlobs || allowGlobs.length === 0) {
    return paths;
  }
  
  return paths.filter(p => {
    const posixPath = ensurePosixRelative(p);
    return allowGlobs.some(glob => minimatch(posixPath, glob));
  });
}
