// TypeScript shim for ml/pdf_parser
// Provides JS/TS exports so TypeScript and Node can resolve 'ml/pdf_parser'.
// TODO: Wire to Python implementation in ml/pdf_parser.py if/when needed.

export function _is_gibberish(text: string): boolean {
  if (!text || text.length < 20) return true;

  const clean = text.replace(/[\s\r\n\t]/g, "");
  if (!clean) return true;

  const alphaCount = Array.from(clean).reduce((acc, c) => (/[\p{L}\p{N}]/u.test(c) ? acc + 1 : acc), 0);
  const alphaRatio = alphaCount / clean.length;
  if (alphaRatio < 0.6) return true;

  const extendedAsciiCount = Array.from(clean).reduce((acc, c) => (c.codePointAt(0)! > 127 ? acc + 1 : acc), 0);
  const extendedAsciiRatio = extendedAsciiCount / clean.length;
  if (extendedAsciiRatio > 0.3) return true;

  const delimiterCount = Array.from(text).reduce((acc, c) => (" .,;:'\"".includes(c) ? acc + 1 : acc), 0);
  const delimiterRatio = delimiterCount / text.length;
  if (delimiterRatio < 0.05) return true;

  return false;
}

export function extract_text_from_pdf_bytes(bytes: Uint8Array): string {
  // Try to call Python implementation (ml/pdf_parser.py) if available.
  try {
    const cp = require('child_process') as typeof import('child_process');
    const path = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');

    const base64Input = Buffer.from(bytes).toString('base64');

    // Inline Python to import ml.pdf_parser and call extract_text_from_pdf_bytes
    const pyCode = [
      'import sys, base64',
      'from ml.pdf_parser import extract_text_from_pdf_bytes',
      'data = base64.b64decode(sys.stdin.read())',
      'out = extract_text_from_pdf_bytes(data) or ""',
      'sys.stdout.write(out)'
    ].join('\n');

    // Heuristic to find repo root that contains ml/pdf_parser.py
    const candidates = [
      path.resolve(__dirname, '../../..'),
      path.resolve(process.cwd(), '..'),
      process.cwd(),
    ];
    let cwd = candidates.find((d) => fs.existsSync(path.join(d, 'ml', 'pdf_parser.py')));
    if (!cwd) {
      cwd = process.cwd();
    }

    const pythonCmd = process.env.PYTHON || 'python3';
    const res = cp.spawnSync(pythonCmd, ['-c', pyCode], {
      input: base64Input,
      encoding: 'utf-8',
      cwd,
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (res.error) {
      return "";
    }
    if (typeof res.status === 'number' && res.status !== 0) {
      return "";
    }
    return (res.stdout || '').toString();
  } catch {
    // Fallback to empty string when Python is unavailable
    return "";
  }
}
