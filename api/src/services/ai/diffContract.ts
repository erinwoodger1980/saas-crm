// Unified diff contract utilities

export function isUnifiedDiff(txt: string): boolean {
  const lines = txt.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    if (/^---\s+a\//.test(lines[i])) {
      if (i + 1 < lines.length && /^\+\+\+\s+b\//.test(lines[i + 1])) {
        for (let j = i + 2; j < lines.length; ++j) {
          if (/^@@\s+[-+0-9, ]+\s@@/.test(lines[j])) {
            return true;
          }
        }
      }
    }
    i++;
  }
  return false;
}

export function ensureDiffPrefixes(txt: string): string {
  return txt.replace(/^(---\s+)(?!a\/)([^\s]+)/gm, '$1a/$2')
            .replace(/^(\+\+\+\s+)(?!b\/)([^\s]+)/gm, '$1b/$2');
}

export const DIFF_CONTRACT_INSTRUCTIONS = `
CONTRACT:
- Output ONLY a POSIX unified diff.
- Use headers:
  --- a/<path>
  +++ b/<path>
- Include at least one hunk header: @@ -<old> +<new> @@
- No prose, no fences, no JSON. Edit ONLY files from File Manifest.
`;
