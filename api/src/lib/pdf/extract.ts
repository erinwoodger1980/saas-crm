import { inflateRawSync, inflateSync } from "node:zlib";
import { cleanText, scoreAlphaNumericQuality } from "./normalize";

export interface ExtractedCell {
  text: string;
  normalized: string;
  startIndex: number;
  endIndex: number;
}

export interface ExtractedRow {
  text: string;
  normalized: string;
  quality: number;
  cells: ExtractedCell[];
}

export interface ExtractionSummary {
  rows: ExtractedRow[];
  rawText: string;
  glyphQuality: number;
  unicodeMapSize: number;
  warnings?: string[];
}

type UnicodeMap = Map<number, string>;

type StreamCandidate = {
  content: string;
};

const STREAM_MARKER = Buffer.from("stream");
const ENDSTREAM_MARKER = Buffer.from("endstream");

function trimStreamData(data: Buffer): Buffer {
  let start = 0;
  let end = data.length;
  while (start < end && (data[start] === 0x0a || data[start] === 0x0d)) start++;
  while (end > start && (data[end - 1] === 0x0a || data[end - 1] === 0x0d)) end--;
  return data.subarray(start, end);
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

function collectStreams(buffer: Buffer): StreamCandidate[] {
  const streams: StreamCandidate[] = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const streamIdx = buffer.indexOf(STREAM_MARKER, cursor);
    if (streamIdx === -1) break;
    let dataStart = streamIdx + STREAM_MARKER.length;
    if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) dataStart += 2;
    else if (buffer[dataStart] === 0x0a) dataStart += 1;
    else if (buffer[dataStart] === 0x0d) dataStart += 1;
    const endIdx = buffer.indexOf(ENDSTREAM_MARKER, dataStart);
    if (endIdx === -1) break;
    const streamData = buffer.subarray(dataStart, endIdx);
    const candidates = tryInflate(streamData);
    for (const candidate of candidates) {
      if (!candidate.length) continue;
      streams.push({ content: candidate.toString("latin1") });
    }
    cursor = endIdx + ENDSTREAM_MARKER.length;
  }
  return streams;
}

function buildUnicodeMap(pdfSource: string): UnicodeMap {
  const map: UnicodeMap = new Map();
  const cmapRegex = /beginbfchar([\s\S]*?)endbfchar/g;
  let match: RegExpExecArray | null;
  while ((match = cmapRegex.exec(pdfSource))) {
    const body = match[1];
    const lines = body.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const pair = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
      if (!pair) continue;
      const src = parseInt(pair[1], 16);
      const destHex = pair[2];
      const dest = hexToString(destHex);
      if (dest) map.set(src, dest);
    }
  }

  const rangeRegex = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((match = rangeRegex.exec(pdfSource))) {
    const body = match[1];
    const lines = body.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const simple = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
      if (simple) {
        const start = parseInt(simple[1], 16);
        const end = parseInt(simple[2], 16);
        const destStart = parseInt(simple[3], 16);
        for (let offset = 0; offset <= end - start; offset++) {
          map.set(start + offset, String.fromCharCode(destStart + offset));
        }
        continue;
      }
      const arrayMatch = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+\[([^\]]+)\]/);
      if (arrayMatch) {
        const start = parseInt(arrayMatch[1], 16);
        const end = parseInt(arrayMatch[2], 16);
        const entries = arrayMatch[3].match(/<([0-9A-Fa-f]+)>/g) ?? [];
        for (let offset = 0; offset <= end - start && offset < entries.length; offset++) {
          const destHex = entries[offset].replace(/[<>]/g, "");
          const dest = hexToString(destHex);
          if (dest) map.set(start + offset, dest);
        }
      }
    }
  }

  return map;
}

function decodeUtf16BE(buf: Buffer): string {
  if (buf.length % 2 !== 0) {
    buf = Buffer.concat([buf, Buffer.from([0])]);
  }
  const swapped = Buffer.from(buf);
  for (let i = 0; i < swapped.length; i += 2) {
    const tmp = swapped[i];
    swapped[i] = swapped[i + 1] ?? 0;
    swapped[i + 1] = tmp ?? 0;
  }
  return swapped.toString("utf16le");
}

function hexToString(hex: string): string {
  if (!hex) return "";
  const cleaned = hex.replace(/[^0-9A-Fa-f]/g, "");
  if (!cleaned) return "";
  const bytes = Buffer.from(cleaned, "hex");
  if (!bytes.length) return "";
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16BE(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.toString("utf16le");
  }
  if (bytes.length % 2 === 0) {
    let maybeUtf16 = "";
    let looksUtf16 = true;
    for (let i = 0; i < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | (bytes[i + 1] ?? 0);
      if (code === 0) continue;
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        looksUtf16 = false;
        break;
      }
      maybeUtf16 += String.fromCharCode(code);
    }
    if (looksUtf16 && maybeUtf16) return maybeUtf16;
  }
  return Buffer.from(bytes).toString("latin1");
}

function decodeWithMap(segment: string, map: UnicodeMap): string {
  const buffer = Buffer.from(segment, "latin1");
  if (!buffer.length) return "";
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return decodeUtf16BE(buffer.subarray(2));
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }

  if (buffer.length % 2 === 0) {
    let looksUtf16 = true;
    let utf16 = "";
    for (let i = 0; i < buffer.length; i += 2) {
      const code = (buffer[i] << 8) | (buffer[i + 1] ?? 0);
      if (code === 0) continue;
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        looksUtf16 = false;
        break;
      }
      utf16 += String.fromCharCode(code);
    }
    if (looksUtf16 && utf16) return utf16;
  }

  let result = "";
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    const next = buffer[i + 1];
    const third = buffer[i + 2];
    const single = map.get(byte);
    if (single) {
      result += single;
      continue;
    }
    if (next !== undefined) {
      const combined = (byte << 8) | next;
      const mapped = map.get(combined);
      if (mapped) {
        result += mapped;
        i += 1;
        continue;
      }
    }
    if (next !== undefined && third !== undefined) {
      const combined = (byte << 16) | (next << 8) | third;
      const mapped = map.get(combined);
      if (mapped) {
        result += mapped;
        i += 2;
        continue;
      }
    }
    result += String.fromCharCode(byte);
  }
  return result;
}

function decodePdfStringLiteral(raw: string, map: UnicodeMap): string {
  let result = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      switch (next) {
        case "n":
          result += "\n";
          i++;
          continue;
        case "r":
          result += "\r";
          i++;
          continue;
        case "t":
          result += "\t";
          i++;
          continue;
        case "b":
          result += "\b";
          i++;
          continue;
        case "f":
          result += "\f";
          i++;
          continue;
        case "(":
        case ")":
        case "\\":
          result += next;
          i++;
          continue;
        default: {
          const octal = decodeOctalEscape(raw, i + 1);
          result += octal.value;
          i += octal.consumed;
          continue;
        }
      }
    }
    result += ch;
  }
  return decodeWithMap(result, map);
}

function decodePdfHexString(raw: string, map: UnicodeMap): string {
  const cleaned = raw.replace(/[^0-9A-Fa-f]/g, "");
  const decoded = hexToString(cleaned);
  if (!decoded) return "";
  return decodeWithMap(decoded, map);
}

function decodeOctalEscape(segment: string, index: number): { value: string; consumed: number } {
  let digits = "";
  for (let i = index; i < Math.min(segment.length, index + 3); i++) {
    const ch = segment[i];
    if (ch < "0" || ch > "7") break;
    digits += ch;
  }
  if (!digits) {
    return { value: segment[index] ?? "", consumed: 1 };
  }
  const code = parseInt(digits, 8);
  return { value: String.fromCharCode(code), consumed: digits.length };
}

function extractSegments(content: string, map: UnicodeMap): string[] {
  const segments: string[] = [];
  const literal = /\((?:\\.|[^\\)])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = literal.exec(content))) {
    const inner = match[0].slice(1, -1);
    const decoded = decodePdfStringLiteral(inner, map);
    const trimmed = decoded.trim();
    if (trimmed && isValidTextSegment(trimmed)) {
      segments.push(decoded);
    }
  }
  const hex = /<([0-9A-Fa-f\s]+)>/g;
  while ((match = hex.exec(content))) {
    const decoded = decodePdfHexString(match[1], map);
    const trimmed = decoded.trim();
    if (trimmed && isValidTextSegment(trimmed)) {
      segments.push(decoded);
    }
  }
  return segments;
}

/**
 * Filter out text segments that are clearly font binary data or garbage.
 * Returns false if the segment should be rejected.
 */
function isValidTextSegment(text: string): boolean {
  // Reject if contains font table names (these are binary font data)
  if (/\b(glyf|hmtx|head|hhea|maxp|loca|cmap|cvt|fpgm|prep|post|name|OS\/2)\b/i.test(text)) {
    return false;
  }
  
  // Reject if contains common font format markers
  if (/(CIDFont|FontDescriptor|FontFile|Type1|TrueType|OpenType)/i.test(text)) {
    return false;
  }
  
  // Reject if high ratio of non-printable characters (excluding common whitespace)
  const nonPrintable = (text.match(/[^\x20-\x7E\r\n\t]/g) || []).length;
  const nonPrintableRatio = nonPrintable / text.length;
  if (nonPrintableRatio > 0.3) {
    return false; // More than 30% non-printable = likely binary
  }
  
  // Reject very short segments that are mostly symbols/weird characters
  if (text.length < 10) {
    const alphaNum = (text.match(/[a-zA-Z0-9]/g) || []).length;
    if (alphaNum < text.length * 0.3) {
      return false; // Less than 30% alphanumeric in short segment
    }
  }
  
  return true;
}

function splitIntoCells(line: string): ExtractedCell[] {
  const cells: ExtractedCell[] = [];
  let current = "";
  let start = -1;
  let lastNonSpace = -1;
  let spaceRun = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === " ") {
      if (current) {
        lastNonSpace = i - 1;
      }
      spaceRun += 1;
      if (spaceRun >= 2 && current) {
        const normalized = cleanText(current);
        cells.push({ text: current.trimEnd(), normalized, startIndex: start, endIndex: lastNonSpace + 1 });
        current = "";
        start = -1;
      }
      continue;
    }
    if (start === -1) start = i;
    spaceRun = 0;
    current += ch;
    lastNonSpace = i;
  }
  if (current) {
    const normalized = cleanText(current);
    cells.push({ text: current.trim(), normalized, startIndex: start, endIndex: lastNonSpace + 1 });
  }
  return cells;
}

export function extractStructuredText(buffer: Buffer): ExtractionSummary {
  const pdfSource = buffer.toString("latin1");
  const unicodeMap = buildUnicodeMap(pdfSource);
  const streams = collectStreams(buffer);
  const warnings: string[] = [];

  const allSegments: string[] = [];
  for (const stream of streams) {
    // Skip streams that are clearly font data, images, or other binary content
    // Font streams typically contain: CIDFont, FontDescriptor, glyf, hmtx, head, hhea, maxp, loca
    const content = stream.content;
    
    // Skip if contains font-related binary markers
    if (/\b(CIDFont|FontDescriptor|glyf|hmtx|head|hhea|maxp|loca|cmap|cvt|fpgm|prep)\b/i.test(content)) {
      continue;
    }
    
    // Skip if has high ratio of non-ASCII characters (likely binary data)
    const nonAsciiCount = (content.match(/[^\x20-\x7E\r\n\t]/g) || []).length;
    const nonAsciiRatio = nonAsciiCount / content.length;
    if (nonAsciiRatio > 0.4) {
      continue; // More than 40% non-ASCII = likely binary
    }
    
    // Now check for text operators
    if (!/(Tj|TJ|'|\")/.test(content)) continue;
    
    // Additional check: must contain parentheses or angle brackets (string delimiters)
    if (!(/\([\s\S]*?\)|<[\da-fA-F\s]+>/.test(content))) continue;
    
    const segments = extractSegments(content, unicodeMap);
    if (segments.length) {
      allSegments.push(...segments);
    }
  }

  if (!allSegments.length) {
    warnings.push("No text segments decoded from PDF streams");
  }

  const lines = allSegments
    .join("\n")
    .split(/\r?\n+/)
    .map((line) => cleanText(line))
    .filter(Boolean);

  const rows: ExtractedRow[] = [];
  let glyphScoreTotal = 0;
  for (const line of lines) {
    const cells = splitIntoCells(line);
    const normalized = cells.length ? cells.map((c) => c.normalized).join(" ") : line;
    const quality = scoreAlphaNumericQuality(normalized);
    glyphScoreTotal += quality;
    rows.push({ text: line, normalized, quality, cells });
  }

  const glyphQuality = rows.length ? glyphScoreTotal / rows.length : 0;

  return {
    rows,
    rawText: lines.join("\n"),
    glyphQuality,
    unicodeMapSize: unicodeMap.size,
    warnings: warnings.length ? warnings : undefined,
  };
}
