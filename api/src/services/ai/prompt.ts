import path from 'path';
import { expandAllowlistToPaths } from '../git/normalize';
import { listFilesWithAllowlist, readExcerpt, searchByKeywords } from '../retriever/fs';
import { extractErrorHints } from '../retriever/errors';
import { buildOrLoadIndex, queryIndex } from '../retriever/embeddings';
import { ensurePosixRelative } from '../guard/filters';
import { DIFF_CONTRACT_INSTRUCTIONS } from './diffContract';

// Constants
const FILE_MANIFEST_LIMIT = Number(process.env.FILE_MANIFEST_LIMIT || 500);
const MAX_FILE_EXCERPTS = Number(process.env.MAX_FILE_EXCERPTS || 10);
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES || 20000);
const LOGS_TRUNCATE = Number(process.env.LOGS_TRUNCATE || 20000);
const MAX_KEYWORD_MATCHES = Number(process.env.MAX_KEYWORD_MATCHES || 6);
const TOPK_EMBEDDINGS = Number(process.env.TOPK_EMBEDDINGS || 5);
const EMBEDDINGS_ENABLED = process.env.EMBEDDINGS_ENABLED === 'true';

export interface FeatureLike { id: string; title: string; description: string; allowedFiles: any; priority: number | null; }

export interface ContextBundle {
  manifest: string[];
  excerpts: Array<{ path: string; text: string; clipped: boolean }>;
  errorsExcerpt: string;
}

/**
 * Build a context bundle with file manifest, relevant excerpts, and error snippets.
 */
export async function buildContextBundle(opts: {
  taskKey?: string;
  description: string;
  allowGlobs: string[] | null;
  logs?: string;
  keywords?: string[];
  repoRoot: string;
}): Promise<ContextBundle> {
  const { description, allowGlobs, logs = '', keywords = [], repoRoot } = opts;
  
  // 1. Build file manifest
  const allFiles = await listFilesWithAllowlist(repoRoot, allowGlobs);
  const manifest = allFiles.slice(0, FILE_MANIFEST_LIMIT);
  
  // 2. Extract error hints from logs
  const errorHints = extractErrorHints(logs).slice(0, 5); // Top 5 errors
  
  // 3. Extract keywords from description and logs
  const allKeywords = [
    ...keywords,
    ...extractKeywords(description),
    ...extractKeywords(logs),
  ];
  
  // 4. Find files by keywords
  const keywordPaths = searchByKeywords(manifest, allKeywords, MAX_KEYWORD_MATCHES);
  
  // 5. Semantic search (if enabled)
  let semanticPaths: string[] = [];
  if (EMBEDDINGS_ENABLED) {
    try {
      const index = await buildOrLoadIndex(manifest, repoRoot);
      semanticPaths = await queryIndex(description, TOPK_EMBEDDINGS, index);
    } catch {
      // Embeddings failed, continue without
    }
  }
  
  // 6. Gather unique paths from all sources
  const excerptPaths = new Set<string>();
  
  // Add error hint paths (highest priority)
  for (const hint of errorHints) {
    if (excerptPaths.size >= MAX_FILE_EXCERPTS) break;
    excerptPaths.add(hint.path);
  }
  
  // Add keyword paths
  for (const p of keywordPaths) {
    if (excerptPaths.size >= MAX_FILE_EXCERPTS) break;
    excerptPaths.add(p);
  }
  
  // Add semantic paths
  for (const p of semanticPaths) {
    if (excerptPaths.size >= MAX_FILE_EXCERPTS) break;
    excerptPaths.add(p);
  }
  
  // 7. Read excerpts
  const excerpts: Array<{ path: string; text: string; clipped: boolean }> = [];
  
  for (const p of excerptPaths) {
    try {
      const fullPath = path.join(repoRoot, p);
      
      // Find if this path has an error hint with line number
      const hint = errorHints.find(h => h.path === p);
      
      let opts: Parameters<typeof readExcerpt>[1];
      if (hint?.line) {
        // Read excerpt around error line (±80 lines)
        opts = {
          start: Math.max(1, hint.line - 80),
          end: hint.line + 80,
          maxBytes: MAX_FILE_BYTES,
        };
      } else {
        // Read first part of file
        opts = { maxBytes: MAX_FILE_BYTES };
      }
      
      const excerpt = await readExcerpt(fullPath, opts);
      excerpts.push({ path: p, ...excerpt });
    } catch {
      // Skip files that can't be read
    }
  }
  
  // 8. Truncate error logs
  const errorsExcerpt = logs.slice(0, LOGS_TRUNCATE);
  
  return { manifest, excerpts, errorsExcerpt };
}

/**
 * Extract keywords from text (simple word extraction).
 */
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && w.length <= 20);
  
  // Return unique words
  return Array.from(new Set(words));
}

/**
 * Build initial prompt with context bundle (async version).
 */
export async function buildInitialPromptWithContext(
  taskKey: string,
  fr: FeatureLike,
  extra: string,
  repoRoot: string
): Promise<string> {
  const allowGlobs = Array.isArray(fr.allowedFiles) ? fr.allowedFiles as string[] : null;
  
  // Build context bundle
  const bundle = await buildContextBundle({
    taskKey,
    description: `${fr.title}\n${fr.description}\n${extra}`,
    allowGlobs,
    logs: '',
    repoRoot,
  });
  
  const truncated = bundle.manifest.length >= FILE_MANIFEST_LIMIT;
  
  const sections = [
    DIFF_CONTRACT_INSTRUCTIONS.trim(),
    '',
    'Example:',
    '--- a/app/example.txt',
    '+++ b/app/example.txt',
    '@@ -1,2 +1,3 @@',
    '-old line',
    '+new line',
    ' unchanged',
    '',
    `TASK_KEY: ${taskKey}`,
    `TITLE: ${fr.title}`,
    `DESCRIPTION: ${fr.description}`,
    `PRIORITY: ${fr.priority ?? 'n/a'}`,
    `EXTRA: ${extra}`,
    '',
    'File Manifest (read-only, allowlisted):',
    ...bundle.manifest,
    truncated ? '...(truncated)' : '',
  ];
  
  // Add path hints for common locations
  const dashboardPath = bundle.manifest.find(p => p.includes('(admin)/dashboard/page.tsx'));
  if (dashboardPath) {
    sections.push('', `Hint: Admin dashboard is at ${dashboardPath}`);
  }
  
  // Add relevant excerpts if any
  if (bundle.excerpts.length > 0) {
    sections.push('', 'Relevant Code Excerpts:');
    for (const { path, text, clipped } of bundle.excerpts) {
      sections.push(`--- FILE: ${path} (clipped=${clipped}) ---`);
      sections.push(text);
      sections.push('');
    }
  }
  
  sections.push(
    'Constraints:',
    '- Use ONLY paths from File Manifest.',
    '- Prefer Next.js App Router convention: routeDir/page.tsx rather than inventing dashboard.tsx.',
    '- Do not create new top-level folders unless explicitly allowlisted.',
    '- Output ONLY unified git diffs; no prose.',
    '- Keep changes minimal; preserve public exports and existing behavior.'
  );
  
  return sections.filter(Boolean).join('\n');
}

/**
 * Build followup prompt with error context (async version).
 */
export async function buildFollowupPromptWithContext(
  previousPrompt: string,
  logs: string,
  allowGlobs: string[] | null,
  repoRoot: string
): Promise<string> {
  // Build context bundle with error logs
  const bundle = await buildContextBundle({
    description: 'Fix errors from previous attempt',
    allowGlobs,
    logs,
    repoRoot,
  });
  
  const sections = [
    DIFF_CONTRACT_INSTRUCTIONS.trim(),
    '',
    'Example:',
    '--- a/app/example.txt',
    '+++ b/app/example.txt',
    '@@ -1,2 +1,3 @@',
    '-old line',
    '+new line',
    ' unchanged',
    '',
    previousPrompt,
    '',
    '=== PREVIOUS ATTEMPT FAILED ===',
    '',
    'Recent Errors (truncated):',
    bundle.errorsExcerpt,
  ];
  
  // Add error-specific excerpts
  if (bundle.excerpts.length > 0) {
    sections.push('', 'Code Around Errors:');
    for (const { path, text, clipped } of bundle.excerpts) {
      sections.push(`--- FILE: ${path} (clipped=${clipped}) ---`);
      sections.push(text);
      sections.push('');
    }
  }
  
  sections.push(
    '',
    'INSTRUCTIONS:',
    '- Produce a MINIMAL correction unified diff.',
    '- Touch as few files as possible.',
    '- NO commentary; ONLY diff output.',
    '- Stick strictly to manifest paths; avoid hallucinated filenames.'
  );
  
  return sections.join('\n');
}

/**
 * Legacy synchronous version (kept for backward compatibility).
 * For new code, use buildInitialPromptWithContext instead.
 */
export function buildInitialPrompt(taskKey: string, fr: FeatureLike, extra: string, repoRoot: string): string {
  const allowGlobs = Array.isArray(fr.allowedFiles) ? fr.allowedFiles as string[] : null;
  const manifest = expandAllowlistToPaths(allowGlobs, repoRoot).slice(0, FILE_MANIFEST_LIMIT);
  const truncated = manifest.length >= FILE_MANIFEST_LIMIT;
  
  const sections = [
    DIFF_CONTRACT_INSTRUCTIONS.trim(),
    '',
    'Example:',
    '--- a/app/example.txt',
    '+++ b/app/example.txt',
    '@@ -1,2 +1,3 @@',
    '-old line',
    '+new line',
    ' unchanged',
    '',
    `TASK_KEY: ${taskKey}`,
    `TITLE: ${fr.title}`,
    `DESCRIPTION: ${fr.description}`,
    `PRIORITY: ${fr.priority ?? 'n/a'}`,
    `EXTRA: ${extra}`,
    '',
    'File Manifest (read-only, allowlisted):',
    ...manifest,
    truncated ? '...(truncated)' : '',
  ];
  
  // Add path hint for admin dashboard if it exists
  const dashboardPath = manifest.find(p => p.includes('(admin)/dashboard/page.tsx'));
  if (dashboardPath) {
    sections.push('', `Hint: Admin dashboard is at ${dashboardPath}`);
  }
  
  sections.push(
    '',
    'Constraints:',
    '- Use ONLY paths from File Manifest.',
    '- Prefer Next.js App Router convention: routeDir/page.tsx rather than inventing dashboard.tsx.',
    '- Do not create new top-level folders unless explicitly allowlisted.',
    '- Output ONLY unified git diffs.'
  );
  
  return sections.filter(Boolean).join('\n');
}

/**
 * Legacy synchronous version (kept for backward compatibility).
 */
export function buildFollowupPrompt(previousPrompt: string): string {
  return [
    DIFF_CONTRACT_INSTRUCTIONS.trim(),
    '',
    'Example:',
    '--- a/app/example.txt',
    '+++ b/app/example.txt',
    '@@ -1,2 +1,3 @@',
    '-old line',
    '+new line',
    ' unchanged',
    '',
    previousPrompt,
    'REMINDER: Stick strictly to manifest paths; avoid hallucinated filenames.'
  ].join('\n');
}
