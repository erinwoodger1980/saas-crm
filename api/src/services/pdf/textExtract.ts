import { pdfjs } from "./pdfjs";

export type PageText = { page: number; raw: string };

const LIGATURE_MAP: Record<string, string> = {
  "ﬀ": "ff",
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
  "–": "-",
  "—": "-",
  "•": "*",
};

function normalizeText(s: string): string {
  s = s.replace(/[ﬀﬁﬂﬃﬄ–—•]/g, (m) => LIGATURE_MAP[m] ?? m);
  s = s.normalize("NFKC").replace(/\p{Mn}+/gu, "");
  s = s.replace(/[^\S\r\n]+/g, " ").replace(/\u00A0/g, " ").trim();
  s = s.replace(/-\s*\r?\n\s*/g, "");
  s = s.replace(/([^\.\:\;])\r?\n(?!\s*[•\-–\d])/g, "$1 ");
  return s;
}

export function qualityScore(s: string) {
  const total = s.length || 1;
  const printable =
    (s.match(/[\x20-\x7E\u00A0-\u02AF£€¥¢°±×÷–—’‘“”§©®™…]/g) || []).length;
  const repl = (s.match(/�/g) || []).length;
  const nonAscii = (s.match(/[^\x00-\x7F]/g) || []).length;
  return {
    printableRatio: printable / total,
    replacementRatio: repl / total,
    nonAsciiRatio: nonAscii / total,
    ok: printable / total >= 0.88 && repl / total <= 0.005,
  };
}

export async function extractWithPdfjs(
  filePath: string,
  maxPages?: number,
): Promise<PageText[]> {
  const loadingTask = (pdfjs as any).getDocument({ url: filePath, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const envMax = Number(process.env.PARSER_MAX_PAGES);
  const fallbackMax = Number.isFinite(envMax) && envMax > 0 ? envMax : 50;
  const limit = maxPages ?? fallbackMax;
  const pages = Math.min(pdf.numPages, limit);
  const out: PageText[] = [];

  try {
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const items = (tc.items as any[]).slice();
      items.sort((a, b) => {
        const ay = a.transform?.[5] ?? 0;
        const by = b.transform?.[5] ?? 0;
        const dy = Math.round(by - ay);
        if (dy !== 0) return dy;
        const ax = a.transform?.[4] ?? 0;
        const bx = b.transform?.[4] ?? 0;
        return ax - bx;
      });
      const normalized = normalizeText(
        items
          .map((it) => {
            const chunk = it.str ?? "";
            const trailingBreak = it.hasEOL || /\s$/.test(chunk);
            return trailingBreak ? `${chunk}\n` : chunk;
          })
          .join(""),
      );
      out.push({ page: i, raw: normalized });
    }
  } finally {
    await pdf.cleanup?.();
    await pdf.destroy?.();
  }

  return out;
}
