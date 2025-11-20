import { type SupplierParseResult } from "../../types/parse";

const LIGATURE_MAP: Record<string, string> = {
  "ﬀ": "ff",
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
  "ﬅ": "ft",
  "ﬆ": "st",
};

const CP1252_MAP: Record<number, string> = {
  0x80: "€",
  0x82: "‚",
  0x83: "ƒ",
  0x84: "„",
  0x85: "…",
  0x86: "†",
  0x87: "‡",
  0x88: "ˆ",
  0x89: "‰",
  0x8a: "Š",
  0x8b: "‹",
  0x8c: "Œ",
  0x8e: "Ž",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x98: "˜",
  0x99: "™",
  0x9a: "š",
  0x9b: "›",
  0x9c: "œ",
  0x9e: "ž",
  0x9f: "Ÿ",
};

export function decodeLigatures(input: string): string {
  return input.replace(/[\uFB00-\uFB06]/g, (ch) => LIGATURE_MAP[ch] ?? ch);
}

export function decodeCp1252(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 0x80 && code <= 0x9f) {
      out += CP1252_MAP[code] ?? String.fromCharCode(code);
    } else {
      out += input[i];
    }
  }
  return out;
}

export function normaliseWhitespace(text: string): string {
  return text.replace(/[\u00A0\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function collapseSpacedSequences(text: string): string {
  let output = text;

  const collapseRuns = (pattern: RegExp) => {
    output = output.replace(pattern, (segment) => segment.replace(/\s+/g, ""));
  };

  // Collapse runs like "L A N G V A L D A" -> "LANGVALDA"
  collapseRuns(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g);
  // Collapse numeric runs like "1 2 3" -> "123" (when they belong to one number)
  collapseRuns(/\b(?:\d\s+){2,}\d\b/g);

  // Remove stray spaces inside numbers (e.g., "1 , 200 . 50")
  output = output.replace(/(\d)\s+(?=[\d,.-])/g, "$1");
  output = output.replace(/([,.-])\s+(?=\d)/g, "$1");

  return output;
}

export function cleanText(input: string): string {
  const ligature = decodeLigatures(decodeCp1252(input));
  const collapsed = ligature.replace(/[\u0000-\u001f]/g, " ");
  const normalised = normaliseWhitespace(collapsed);
  return collapseSpacedSequences(normalised);
}

export function scoreAlphaNumericQuality(text: string): number {
  if (!text) return 0;
  const normalised = text.replace(/[^\x20-\x7E\u00A0-\u02FF]/g, "");
  if (!normalised) return 0;
  const letters = normalised.match(/[A-Za-z]+/g)?.join("") ?? "";
  const digits = normalised.match(/[0-9]+/g)?.join("") ?? "";
  const score = (letters.length + digits.length * 0.5) / normalised.length;
  return Math.min(1, score);
}

export function parseMoney(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[\u00A0\s]/g, " ")
    .replace(/[^0-9,.-]/g, "")
    .trim();
  if (!cleaned) return null;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalised = cleaned;
  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(",") < cleaned.lastIndexOf(".")) {
      normalised = cleaned.replace(/,/g, "");
    } else {
      normalised = cleaned.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (hasComma && !hasDot) {
    if (/,-?\d{1,2}$/.test(cleaned) || /,\d{1,2}$/.test(cleaned)) {
      normalised = cleaned.replace(/,/g, ".");
    } else {
      normalised = cleaned.replace(/,/g, "");
    }
  }
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

export function inferCurrency(text: string): string {
  if (/[£\u00A3]/.test(text)) return "GBP";
  if (/[€\u20AC]/.test(text)) return "EUR";
  if (/[\$]/.test(text)) return "USD";
  return "GBP";
}

export function inferSupplier(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 12)) {
    const trimmed = normaliseWhitespace(line);
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (/quote|estimate|proposal|page|date|supplier|customer|attention|tel|phone|email/.test(lower)) continue;
    if (/^\d{2,}$/.test(trimmed.replace(/\s+/g, ""))) continue;
    if (trimmed.length < 3) continue;
    if (!/[a-zA-Z]/.test(trimmed)) continue;
    return trimmed;
  }
  return undefined;
}

export function combineWarnings(
  ...lists: Array<ReadonlyArray<string> | undefined>
): string[] | undefined {
  const merged = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) merged.add(item);
  }
  return merged.size ? Array.from(merged) : undefined;
}

export function summariseConfidence(lines: SupplierParseResult["lines"]): number {
  if (!lines.length) return 0;
  let score = 0;
  for (const ln of lines) {
    if (ln.qty && ln.costUnit && ln.lineTotal) score += 1;
    else if (ln.lineTotal && (ln.qty || ln.costUnit)) score += 0.75;
    else if (ln.lineTotal) score += 0.5;
  }
  return Math.min(1, score / lines.length);
}

export function looksLikeDelivery(description: string): boolean {
  const lower = description.toLowerCase();
  return /delivery/.test(lower) || /shipping/.test(lower) || /freight/.test(lower);
}

export function stripTrailingPunctuation(text: string): string {
  return text.replace(/[:.;,-]+$/g, "").trim();
}
