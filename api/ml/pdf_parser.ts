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

export function extract_text_from_pdf_bytes(_bytes: Uint8Array): string {
  // This TypeScript shim requires a Python bridge implementation.
  // The ML service should be used instead for production PDF parsing.
  throw new Error("extract_text_from_pdf_bytes is not implemented - use ML service API for PDF parsing");
}
