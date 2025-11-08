import { expandAllowlistToPaths } from '../git/normalize';

export interface FeatureLike { id: string; title: string; description: string; allowedFiles: any; priority: number | null; }

export function buildInitialPrompt(taskKey: string, fr: FeatureLike, extra: string, repoRoot: string): string {
  const allowGlobs = Array.isArray(fr.allowedFiles) ? fr.allowedFiles as string[] : null;
  const manifest = expandAllowlistToPaths(allowGlobs, repoRoot).slice(0, Number(process.env.FILE_MANIFEST_LIMIT || 500));
  const truncated = manifest.length >= Number(process.env.FILE_MANIFEST_LIMIT || 500);
  return [
    `TASK_KEY: ${taskKey}`,
    `TITLE: ${fr.title}`,
    `DESCRIPTION: ${fr.description}`,
    `PRIORITY: ${fr.priority ?? 'n/a'}`,
    `EXTRA: ${extra}`,
    '',
    'File Manifest (read-only, allowlisted):',
    ...manifest,
    truncated ? '...(truncated)' : '',
    '',
    'Constraints:',
    '- Use ONLY paths from File Manifest.',
    '- Prefer Next.js App Router convention: routeDir/page.tsx rather than inventing dashboard.tsx.',
    '- Do not create new top-level folders unless explicitly allowlisted.',
    '- Output ONLY unified git diffs.'
  ].filter(Boolean).join('\n');
}

export function buildFollowupPrompt(previousPrompt: string): string {
  return previousPrompt + '\nREMINDER: Stick strictly to manifest paths; avoid hallucinated filenames.';
}
