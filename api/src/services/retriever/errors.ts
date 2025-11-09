import path from 'path';

export interface ErrorHint {
  path: string;   // Normalized POSIX relative path
  line?: number;  // 1-indexed line number
  col?: number;   // 1-indexed column number
}

/**
 * Extract file paths and line numbers from TypeScript errors and stack traces.
 * Supports patterns like:
 * - "error TS2307: Cannot find module '...' (/path/to/file.ts:42:13)"
 * - "at Function.Module._load (/path/to/file.ts:123:5)"
 * - "/path/to/file.ts(42,13): error TS2307"
 */
export function extractErrorHints(logs: string): ErrorHint[] {
  const hints: ErrorHint[] = [];
  const seen = new Set<string>();
  
  // Pattern 1: TypeScript error format with parentheses
  // Example: /path/to/file.ts(42,13): error TS2307
  const tsParenPattern = /([^\s()]+\.tsx?)\((\d+),(\d+)\):/g;
  let match;
  
  while ((match = tsParenPattern.exec(logs)) !== null) {
    const [, filePath, line, col] = match;
    const normalized = normalizePath(filePath);
    const key = `${normalized}:${line}`;
    
    if (normalized && !seen.has(key)) {
      seen.add(key);
      hints.push({
        path: normalized,
        line: parseInt(line, 10),
        col: parseInt(col, 10),
      });
    }
  }
  
  // Pattern 2: Stack trace format
  // Example: at Function.Module._load (/path/to/file.ts:123:5)
  const stackPattern = /at\s+[^\(]*\(([^\)]+\.tsx?):(\d+):(\d+)\)/g;
  
  while ((match = stackPattern.exec(logs)) !== null) {
    const [, filePath, line, col] = match;
    const normalized = normalizePath(filePath);
    const key = `${normalized}:${line}`;
    
    if (normalized && !seen.has(key)) {
      seen.add(key);
      hints.push({
        path: normalized,
        line: parseInt(line, 10),
        col: parseInt(col, 10),
      });
    }
  }
  
  // Pattern 3: Simple path:line:col format
  // Example: src/file.ts:42:13 - error TS2307
  const simplePattern = /([^\s:]+\.tsx?):(\d+):(\d+)/g;
  
  while ((match = simplePattern.exec(logs)) !== null) {
    const [, filePath, line, col] = match;
    const normalized = normalizePath(filePath);
    const key = `${normalized}:${line}`;
    
    if (normalized && !seen.has(key)) {
      seen.add(key);
      hints.push({
        path: normalized,
        line: parseInt(line, 10),
        col: parseInt(col, 10),
      });
    }
  }
  
  // Pattern 4: Just file path with line number (no column)
  // Example: /path/to/file.ts:42
  const lineOnlyPattern = /([^\s:]+\.tsx?):(\d+)(?:[^\d]|$)/g;
  
  while ((match = lineOnlyPattern.exec(logs)) !== null) {
    const [, filePath, line] = match;
    const normalized = normalizePath(filePath);
    const key = `${normalized}:${line}`;
    
    if (normalized && !seen.has(key)) {
      seen.add(key);
      hints.push({
        path: normalized,
        line: parseInt(line, 10),
      });
    }
  }
  
  return hints;
}

/**
 * Normalize file path to POSIX relative format.
 * Strips common prefixes and converts to forward slashes.
 */
function normalizePath(filePath: string): string | null {
  try {
    // Remove leading/trailing whitespace
    let normalized = filePath.trim();
    
    // Convert backslashes to forward slashes
    normalized = normalized.split(path.sep).join('/');
    
    // Strip common prefixes
    const prefixes = ['file://', 'a/', 'b/', './'];
    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length);
      }
    }
    
    // If absolute path, try to make relative to common project roots
    if (normalized.startsWith('/')) {
      // Look for common project markers
      const markers = ['/saas-crm/', '/api/', '/web/', '/src/'];
      for (const marker of markers) {
        const idx = normalized.indexOf(marker);
        if (idx >= 0) {
          // Keep from marker onwards (strip leading /)
          normalized = normalized.slice(idx + 1);
          break;
        }
      }
    }
    
    // Skip if it's still an absolute path or invalid
    if (normalized.startsWith('/') || normalized.includes('node_modules')) {
      return null;
    }
    
    return normalized;
  } catch {
    return null;
  }
}
