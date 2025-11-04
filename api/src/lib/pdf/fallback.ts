import { inflateRawSync, inflateSync } from "node:zlib";
import type { SupplierParseResult } from "../../types/parse";

function parseMoney(value: string | null | undefined): number | null {
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

function looksLikeHeader(line: string): boolean {
  const lower = line.toLowerCase();
  if (!/[0-9]/.test(line)) return false;
  return (
    /\bqty\b/.test(lower) ||
    /quantity/.test(lower) ||
    /unit\s*(price|cost)/.test(lower) ||
    (/total/.test(lower) && /description/.test(lower))
  );
}

function isTotalLine(lower: string): boolean {
  return /\bsubtotal\b/.test(lower) || /\btotal\b/.test(lower) || /\bgrand total\b/.test(lower);
}

function extractNumbers(value: string): number[] {
  const matches = value.match(/[-+]?\d[\d,.]*\d|[-+]?\d+/g);
  if (!matches) return [];
  const out: number[] = [];
  for (const m of matches) {
    const n = parseMoney(m);
    if (n != null) out.push(n);
  }
  return out;
}

function normaliseWhitespace(text: string): string {
  return text.replace(/[\u00A0\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function inferSupplier(lines: string[]): string | undefined {
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

function parseLines(text: string): SupplierParseResult {
  const rawLines = text
    .split(/\r?\n+/)
    .map((l) => l.replace(/[\u00A0]/g, " ").trim())
    .filter(Boolean);

  const detectedTotals: SupplierParseResult["detected_totals"] = {};
  const parsedLines: SupplierParseResult["lines"] = [];
  const warnings: string[] = [];

  const seenDescriptions = new Set<string>();

  for (const raw of rawLines) {
    const line = raw.replace(/\s{2,}/g, "  ").trim();
    const lower = line.toLowerCase();

    if (looksLikeHeader(line)) continue;

    const numbers = extractNumbers(line);
    if (numbers.length) {
      if (/delivery/.test(lower)) {
        detectedTotals.delivery = numbers[numbers.length - 1];
      } else if (/subtotal/.test(lower)) {
        detectedTotals.subtotal = numbers[numbers.length - 1];
        continue;
      } else if (/grand\s+total/.test(lower)) {
        detectedTotals.estimated_total = numbers[numbers.length - 1];
        continue;
      } else if (/total/.test(lower) && numbers.length === 1) {
        detectedTotals.estimated_total ??= numbers[0];
        continue;
      }
    }

    if (!/[0-9]/.test(line)) continue;

    if (isTotalLine(lower) && !/delivery/.test(lower)) continue;

    const columns = line
      .split(/\s{2,}|\t+/)
      .map((c) => c.trim())
      .filter(Boolean);

    if (columns.length < 2) continue;

    const numericColumns = columns
      .map((value, index) => ({ index, value, number: parseMoney(value) }))
      .filter((c) => c.number != null);

    if (numericColumns.length === 0) continue;

    const lastNumeric = numericColumns[numericColumns.length - 1];
    const lineTotal = lastNumeric.number ?? null;
    if (lineTotal == null) continue;

    const firstNumericIdx = numericColumns[0].index;
    const descriptionParts = columns.slice(0, firstNumericIdx);
    let description = descriptionParts.join(" ").trim();
    if (!description) {
      description = normaliseWhitespace(line.replace(lastNumeric.value, ""));
    }
    description = description.replace(/[:.-]+$/, "").trim();
    if (!description) continue;

    const key = description.toLowerCase();
    if (seenDescriptions.has(key) && numbers.length <= 1) continue;
    seenDescriptions.add(key);

    let qty: number | undefined;
    let costUnit: number | undefined;
    let unit: string | undefined;

    const priorNumerics = numericColumns.slice(0, -1);
    if (priorNumerics.length) {
      const reversed = [...priorNumerics].reverse();
      for (const col of reversed) {
        const value = col.number!;
        if (!costUnit && value <= lineTotal + 0.01) {
          costUnit = value;
          continue;
        }
        const asInt = Math.round(value);
        if (!qty && Math.abs(value - asInt) < 0.01 && asInt > 0 && asInt <= 1000) {
          qty = asInt;
          continue;
        }
      }
    }

    if (!qty) {
      for (const col of priorNumerics) {
        const value = col.number!;
        const asInt = Math.round(value);
        if (Math.abs(value - asInt) < 0.01 && asInt > 0 && asInt <= 1000) {
          qty = asInt;
          break;
        }
      }
    }

    if (!costUnit && qty && lineTotal) {
      const candidate = lineTotal / qty;
      if (Number.isFinite(candidate) && candidate > 0) {
        costUnit = Math.round(candidate * 100) / 100;
      }
    }

    if (!qty && costUnit && lineTotal) {
      const candidate = lineTotal / costUnit;
      if (Number.isFinite(candidate) && candidate > 0.25 && candidate <= 1000) {
        const rounded = Math.round(candidate * 100) / 100;
        qty = Math.abs(rounded - Math.round(rounded)) < 0.05 ? Math.round(rounded) : rounded;
      }
    }

    if (!costUnit && priorNumerics.length >= 1) {
      const candidate = priorNumerics[priorNumerics.length - 1].number!;
      if (candidate > 0) costUnit = candidate;
    }

    if (columns.length >= 3 && firstNumericIdx > 0 && firstNumericIdx < columns.length - 1) {
      const maybeUnit = columns[firstNumericIdx - 1];
      if (maybeUnit && maybeUnit.length <= 10 && !/[0-9]/.test(maybeUnit)) {
        unit = maybeUnit;
      }
    }

    parsedLines.push({ description, qty, unit, costUnit, lineTotal });
  }

  const productLines = parsedLines.filter((ln) => !/delivery/i.test(ln.description));
  const deliveryLine = parsedLines.find((ln) => /delivery/i.test(ln.description));

  if (!detectedTotals.delivery && deliveryLine?.lineTotal != null) {
    detectedTotals.delivery = deliveryLine.lineTotal;
  }

  const subtotalFromLines = productLines.reduce((acc, ln) => {
    const total = ln.lineTotal ?? (ln.costUnit ?? 0) * (ln.qty ?? 1);
    return acc + (Number.isFinite(total) ? total : 0);
  }, 0);

  if (!detectedTotals.subtotal && subtotalFromLines > 0) {
    detectedTotals.subtotal = Math.round(subtotalFromLines * 100) / 100;
  }

  const totalEstimate = (detectedTotals.subtotal ?? subtotalFromLines) + (detectedTotals.delivery ?? 0);
  if (!detectedTotals.estimated_total && totalEstimate > 0) {
    detectedTotals.estimated_total = Math.round(totalEstimate * 100) / 100;
  }

  let confidence = 0;
  if (parsedLines.length) {
    let score = 0;
    for (const ln of parsedLines) {
      if (ln.qty && ln.costUnit && ln.lineTotal) score += 1;
      else if (ln.lineTotal && (ln.qty || ln.costUnit)) score += 0.75;
      else if (ln.lineTotal) score += 0.5;
    }
    confidence = Math.min(1, score / parsedLines.length);
  }

  if (parsedLines.length === 0) {
    warnings.push("Fallback parser did not identify any line items");
  }

  const currency = text.includes("€") ? "EUR" : text.includes("$") ? "USD" : "GBP";
  const supplier = inferSupplier(rawLines);

  return {
    currency,
    supplier,
    lines: parsedLines,
    detected_totals: detectedTotals,
    confidence,
    warnings: warnings.length ? warnings : undefined,
  };
}

export async function fallbackParseSupplierPdf(buffer: Buffer): Promise<SupplierParseResult> {
  const warnings: string[] = [];
  let text = "";
  const extracted = extractTextFromPdf(buffer);
  if (extracted) {
    text = extracted.trim();
  }

  if (!text) {
    warnings.push("Unable to extract text from PDF");
    return {
      currency: "GBP",
      lines: [],
      detected_totals: {},
      confidence: 0,
      warnings,
      error: "no_text_detected",
    };
  }

  const parsed = parseLines(text);
  const combinedWarnings = [...(parsed.warnings || []), ...warnings];
  return {
    ...parsed,
    currency: parsed.currency || "GBP",
    warnings: combinedWarnings.length ? combinedWarnings : undefined,
  };
}

function tryInflate(data: Buffer): Buffer[] {
  const attempts: Buffer[] = [];
  const trimmed = trimStreamData(data);
  attempts.push(trimmed);
  try {
    attempts.push(inflateSync(trimmed));
  } catch {}
  try {
    attempts.push(inflateRawSync(trimmed));
  } catch {}
  return attempts;
}

function trimStreamData(data: Buffer): Buffer {
  let start = 0;
  let end = data.length;
  while (start < end && (data[start] === 0x0a || data[start] === 0x0d)) start++;
  while (end > start && (data[end - 1] === 0x0a || data[end - 1] === 0x0d)) end--;
  return data.subarray(start, end);
}

function decodeOctalEscape(segment: string, index: number): { value: string; consumed: number } {
  let digits = "";
  for (let i = index; i < Math.min(segment.length, index + 3); i++) {
    const ch = segment[i];
    if (ch < "0" || ch > "7") break;
    digits += ch;
  }
  if (!digits) {
    return { value: segment[index], consumed: 1 };
  }
  const code = parseInt(digits, 8);
  return { value: String.fromCharCode(code), consumed: digits.length };
}

function decodePdfStringLiteral(raw: string): string {
  let result = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      switch (next) {
        case "n":
          result += "\n";
          i++;
          break;
        case "r":
          result += "\r";
          i++;
          break;
        case "t":
          result += "\t";
          i++;
          break;
        case "b":
          result += "\b";
          i++;
          break;
        case "f":
          result += "\f";
          i++;
          break;
        case "(":
        case ")":
        case "\\":
          result += next;
          i++;
          break;
        default: {
          const { value, consumed } = decodeOctalEscape(raw, i + 1);
          result += value;
          i += consumed;
          break;
        }
      }
      continue;
    }
    result += ch;
  }
  return result;
}

function decodePdfHexString(raw: string): string {
  const cleaned = raw.replace(/[^0-9a-fA-F]/g, "");
  const pairs: string[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const pair = cleaned.slice(i, i + 2);
    if (pair.length === 1) {
      pairs.push(pair + "0");
    } else {
      pairs.push(pair);
    }
  }
  return String.fromCharCode(
    ...pairs.map((hex) => parseInt(hex, 16)).filter((n) => Number.isFinite(n) && n > 0),
  );
}

function extractTextSegments(content: string): string[] {
  const segments: string[] = [];
  const parenRegex = /\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRegex.exec(content))) {
    const inner = match[0].slice(1, -1);
    const decoded = decodePdfStringLiteral(inner);
    if (decoded.trim()) segments.push(decoded);
  }

  const hexRegex = /<([0-9A-Fa-f\s]+)>/g;
  while ((match = hexRegex.exec(content))) {
    const decoded = decodePdfHexString(match[1]);
    if (decoded.trim()) segments.push(decoded);
  }

  return segments;
}

function extractTextFromPdf(buffer: Buffer): string {
  const streamMarker = Buffer.from("stream");
  const endMarker = Buffer.from("endstream");
  const textParts: string[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const streamIdx = buffer.indexOf(streamMarker, cursor);
    if (streamIdx === -1) break;
    let dataStart = streamIdx + streamMarker.length;
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) dataStart += 2;
    else if (buffer[dataStart] === 0x0a) dataStart += 1;
    else if (buffer[dataStart] === 0x0d) dataStart += 1;

    const endIdx = buffer.indexOf(endMarker, dataStart);
    if (endIdx === -1) break;
    const streamData = buffer.subarray(dataStart, endIdx);
    const candidates = tryInflate(streamData);
    for (const candidate of candidates) {
      if (!candidate || !candidate.length) continue;
      const content = candidate.toString("latin1");
      if (!/(Tj|TJ|'|\")/.test(content)) continue;
      const segments = extractTextSegments(content);
      if (segments.length) {
        textParts.push(segments.join(" "));
      }
    }
    cursor = endIdx + endMarker.length;
  }

  const combined = textParts
    .join("\n")
    .split(/\n+/)
    .map((line) => line.replace(/[\u0000-\u001f]+/g, " ").trim())
    .filter(Boolean);

  return combined.join("\n");
}
