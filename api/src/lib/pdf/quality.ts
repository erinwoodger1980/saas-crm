import { normaliseWhitespace } from "./normalize";

const SAFE_SYMBOL_RE = /[\s£€$.,/&()\-+%:;"'#]/;
const LETTER_RE = /[A-Za-z]/;
const ALPHANUM_RE = /[A-Za-z0-9]/;
const DIGIT_RE = /\d/;
const ASCII_RE = /[\x20-\x7E]/;
const JOINERY_HINT_RE = /\b(door|window|frame|sash|bifold|slider|casement|glaze|glass|timber|oak|pine|hardwood|softwood|threshold|lintel|lantern|roof|stair|balustrade|cladding|panel|handle|hinge|ironmongery|install|supply|fit|labour|uPVC|aluminium|garage|shutter|skylight|aperture)\b/i;
const UNIT_HINT_RE = /\b(mm|cm|m2|m\u00B2|metre|meter|kg|sqm|sq\.?m|linear|lm)\b/i;
const DIMENSION_HINT_RE = /\b\d{3,4}\s*[xX\u00D7]\s*\d{3,4}\b/;

export interface DescriptionQualityAssessment {
  cleaned: string;
  length: number;
  asciiRatio: number;
  alphaNumericRatio: number;
  digitRatio: number;
  weirdRatio: number;
  repeatedCharRatio: number;
  dominantCharRatio: number;
  uniqueAlphaNumericRatio: number;
  wordCount: number;
  letterRun: number;
  score: number;
  gibberish: boolean;
  reasons: string[];
}

function sanitiseInput(raw: string | null | undefined): string {
  if (raw == null) return "";
  const asString = String(raw).replace(/[\u0000-\u001f]/g, " ");
  return normaliseWhitespace(asString);
}

export function assessDescriptionQuality(raw: string | null | undefined): DescriptionQualityAssessment {
  const cleaned = sanitiseInput(raw);
  if (!cleaned) {
    return {
      cleaned: "",
      length: 0,
      asciiRatio: 0,
      alphaNumericRatio: 0,
      digitRatio: 0,
      weirdRatio: 1,
      repeatedCharRatio: 1,
      dominantCharRatio: 1,
      uniqueAlphaNumericRatio: 0,
      wordCount: 0,
      letterRun: 0,
      score: 0,
      gibberish: true,
      reasons: ["empty"],
    };
  }

  const len = cleaned.length;
  let asciiCount = 0;
  let alphaNumericCount = 0;
  let digitCount = 0;
  let weirdCount = 0;
  let repeatMax = 1;
  let repeatRun = 1;
  let letterRun = 0;
  let currentLetterRun = 0;
  let alphaNumericTotal = 0;
  const alphaNumericFreq = new Map<string, number>();

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ASCII_RE.test(ch)) asciiCount += 1;
    if (ALPHANUM_RE.test(ch)) alphaNumericCount += 1;
    if (DIGIT_RE.test(ch)) digitCount += 1;
    if (!ALPHANUM_RE.test(ch) && !SAFE_SYMBOL_RE.test(ch)) weirdCount += 1;

    if (ALPHANUM_RE.test(ch)) {
      alphaNumericTotal += 1;
      const key = ch.toLowerCase();
      alphaNumericFreq.set(key, (alphaNumericFreq.get(key) ?? 0) + 1);
    }

    if (i > 0 && cleaned[i - 1] === ch) {
      repeatRun += 1;
    } else {
      repeatRun = 1;
    }
    if (repeatRun > repeatMax) repeatMax = repeatRun;

    if (LETTER_RE.test(ch)) {
      currentLetterRun += 1;
      if (currentLetterRun > letterRun) letterRun = currentLetterRun;
    } else {
      currentLetterRun = 0;
    }
  }

  const asciiRatio = asciiCount / len;
  const alphaNumericRatio = alphaNumericCount / len;
  const digitRatio = digitCount / len;
  const weirdRatio = weirdCount / len;
  const repeatedCharRatio = repeatMax / len;
  const dominantCharRatio = (() => {
    if (!alphaNumericTotal) return 0;
    let max = 0;
    for (const value of alphaNumericFreq.values()) {
      if (value > max) max = value;
    }
    return max / alphaNumericTotal;
  })();
  const uniqueAlphaNumericRatio = alphaNumericTotal
    ? alphaNumericFreq.size / alphaNumericTotal
    : 0;
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

  let score = 0;
  const reasons: string[] = [];

  if (len >= 10) score += 0.15;
  else reasons.push("short");
  if (len >= 18) score += 0.05;

  if (wordCount >= 3) score += 0.1;
  else if (wordCount < 2) reasons.push("low_word_count");

  if (asciiRatio >= 0.95) score += 0.15;
  else if (asciiRatio >= 0.8) score += 0.1;
  else reasons.push("low_ascii");

  if (alphaNumericRatio >= 0.55) score += 0.2;
  else if (alphaNumericRatio >= 0.4) score += 0.12;
  else reasons.push("low_alphanum");

  if (digitRatio <= 0.5) score += 0.08;
  else if (digitRatio <= 0.7) score += 0.04;
  else reasons.push("digit_heavy");

  if (weirdRatio <= 0.12) score += 0.15;
  else if (weirdRatio <= 0.25) score += 0.08;
  else reasons.push("weird_chars");

  if (repeatedCharRatio <= 0.2) score += 0.07;
  else if (repeatedCharRatio <= 0.3) score += 0.03;
  else reasons.push("repeats");

  // Garbled PDF text often collapses into a single dominant character (e.g. UUUUUU...) even though
  // it's technically ASCII/alphanumeric. Detect that low-entropy pattern explicitly.
  if (dominantCharRatio <= 0.35) score += 0.05;
  else if (dominantCharRatio <= 0.5) score += 0.02;
  else reasons.push("dominant_char");

  if (uniqueAlphaNumericRatio >= 0.25) score += 0.03;
  else reasons.push("low_variety");

  if (letterRun >= 4) score += 0.05;
  else reasons.push("no_letter_run");

  if (JOINERY_HINT_RE.test(cleaned)) {
    score += 0.12;
  } else {
    reasons.push("no_joinery_hint");
  }

  if (UNIT_HINT_RE.test(cleaned)) score += 0.05;
  if (DIMENSION_HINT_RE.test(cleaned)) score += 0.1;

  score = Math.min(1, Number(score.toFixed(3)));

  const gibberish =
    score < 0.55 ||
    len < 6 ||
    asciiRatio < 0.55 ||
    alphaNumericRatio < 0.3 ||
    weirdRatio > 0.45 ||
    repeatedCharRatio > 0.4 ||
    (alphaNumericTotal >= 8 && dominantCharRatio > 0.6) ||
    (alphaNumericTotal >= 10 && uniqueAlphaNumericRatio < 0.14) ||
    !LETTER_RE.test(cleaned);

  if (gibberish && !reasons.includes("gibberish")) {
    reasons.push("gibberish");
  }

  return {
    cleaned,
    length: len,
    asciiRatio,
    alphaNumericRatio,
    digitRatio,
    weirdRatio,
    repeatedCharRatio,
    dominantCharRatio,
    uniqueAlphaNumericRatio,
    wordCount,
    letterRun,
    score,
    gibberish,
    reasons,
  };
}

export function descriptionQualityScore(raw: string | null | undefined): number {
  return assessDescriptionQuality(raw).score;
}

export function isGibberishDescription(raw: string | null | undefined, minScore = 0.55): boolean {
  const assessment = assessDescriptionQuality(raw);
  if (!assessment.cleaned) return true;
  if (assessment.score < minScore) return true;
  if (assessment.asciiRatio < 0.55) return true;
  if (assessment.alphaNumericRatio < 0.3) return true;
  if (assessment.weirdRatio > 0.45) return true;
  if (assessment.repeatedCharRatio > 0.4) return true;
  if (assessment.dominantCharRatio > 0.6) return true;
  if (assessment.uniqueAlphaNumericRatio < 0.14 && assessment.length >= 10) return true;
  if (!LETTER_RE.test(assessment.cleaned)) return true;
  return false;
}
