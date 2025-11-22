import fs from 'fs';
import path from 'path';

// Lazy require to avoid loading pdf-parse until needed
function getPdfParse() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('pdf-parse');
}

export interface LocalParsedQuoteStats {
  chars: number | null;
  total: number | null;
  currency: string | null;
  items: Array<{ raw: string; amount: number | null }>;
}

// Basic currency regex
const CURRENCY_RE = /\b(GBP|EUR|USD|POUNDS?|£|€|\$)\b/i;

// Extract numeric tokens (supports thousand separators and decimals)
const NUM_RE = /\b\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b/g;

export async function extractQuoteFromPdf(absPath: string): Promise<LocalParsedQuoteStats> {
  const out: LocalParsedQuoteStats = { chars: null, total: null, currency: null, items: [] };
  try {
    const buffer = await fs.promises.readFile(absPath);
    const pdfParse = getPdfParse();
    const parsed = await pdfParse(buffer).catch(() => null);
    if (!parsed || typeof parsed.text !== 'string') return out;
    const text = parsed.text.replace(/\r/g, '');
    out.chars = text.length;
    const lines = text.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
    let candidateTotal: number | null = null;
    for (const line of lines) {
      if (!line) continue;
      if (CURRENCY_RE.test(line) && !out.currency) {
        const curMatch = line.match(CURRENCY_RE);
        if (curMatch) out.currency = normaliseCurrency(curMatch[0]);
      }
      // Potential line item: contains at least one number and some text
      const nums = line.match(NUM_RE);
      if (nums) {
        let maxNum: number | null = null;
        for (const n of nums) {
          const value = parseFloat(n.replace(/[,\s]/g, ''));
          if (!isNaN(value)) {
            if (maxNum == null || value > maxNum) maxNum = value;
            if (/total/i.test(line)) {
              if (candidateTotal == null || value > candidateTotal) candidateTotal = value;
            }
          }
        }
        out.items.push({ raw: line.slice(0, 240), amount: maxNum });
      }
    }
    if (out.total == null && candidateTotal != null) out.total = candidateTotal;
    return out;
  } catch {
    return out;
  }
}

function normaliseCurrency(token: string): string {
  token = token.toUpperCase();
  if (token.startsWith('£') || token.includes('POUND') || token === 'GBP') return 'GBP';
  if (token.startsWith('€') || token === 'EUR') return 'EUR';
  if (token.startsWith('$') || token === 'USD') return 'USD';
  return token;
}

export async function computeFallbackStats(absPath: string): Promise<{ textChars: number | null; estimatedTotal: number | null; currency: string | null }> {
  const stats = await extractQuoteFromPdf(absPath);
  return { textChars: stats.chars, estimatedTotal: stats.total, currency: stats.currency };
}
