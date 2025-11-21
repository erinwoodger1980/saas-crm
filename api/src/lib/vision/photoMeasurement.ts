import OpenAI from "openai";

const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim();
const openaiClient = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

export const MIN_DIMENSION_MM = 300;
export const MAX_DIMENSION_MM = 3000;

export type PhotoMeasurementContext = {
  openingType?: string | null;
  floorLevel?: string | null;
  notes?: string | null;
};

export type PhotoMeasurementAttributes = {
  productType?: string | null;
  openingConfig?: string | null;
  material?: string | null;
  colour?: string | null;
  glazingStyle?: string | null;
  ironmongeryFinish?: string | null;
  styleTags?: string[] | null;
  description?: string | null;
  notes?: string | null;
};

export type PhotoMeasurementResult = {
  widthMm: number | null;
  heightMm: number | null;
  confidence: number | null;
  attributes: PhotoMeasurementAttributes;
};

export function parseVisionResponseText(raw: string): any {
  if (!raw) return null;
  const trimmed = raw.trim();
  const jsonCandidate = trimmed.startsWith("{")
    ? trimmed
    : trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(jsonCandidate);
  } catch (error) {
    const firstBrace = jsonCandidate.indexOf("{");
    const lastBrace = jsonCandidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(jsonCandidate.slice(firstBrace, lastBrace + 1));
      } catch {}
    }
    return null;
  }
}

function coerceNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[a-zA-Z,]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampDimension(value: number | null): number | null {
  if (value === null) return null;
  const clamped = Math.max(MIN_DIMENSION_MM, Math.min(MAX_DIMENSION_MM, value));
  return Math.round(clamped / 10) * 10;
}

function clampConfidence(value: number | null): number | null {
  if (value === null) return null;
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 100) / 100;
}

function sanitizeString(value: any): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function sanitizeStringArray(value: any): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const cleaned = value.map((v) => sanitizeString(v)).filter((v): v is string => Boolean(v));
    return cleaned.length ? cleaned : null;
  }
  if (typeof value === "string") {
    const parts = value
      .split(/[;,]/)
      .map((part) => sanitizeString(part))
      .filter((part): part is string => Boolean(part));
    return parts.length ? parts : null;
  }
  return null;
}

export function normalizeVisionEstimate(payload: any): PhotoMeasurementResult {
  const widthRaw = payload?.width_mm ?? payload?.widthMm ?? payload?.width ?? null;
  const heightRaw = payload?.height_mm ?? payload?.heightMm ?? payload?.height ?? null;
  const confidenceRaw = payload?.confidence ?? payload?.confidence_score ?? null;
  const productType = sanitizeString(payload?.product_type ?? payload?.productType);
  const openingConfig = sanitizeString(payload?.opening_config ?? payload?.openingConfig);
  const material = sanitizeString(payload?.material);
  const colour = sanitizeString(payload?.colour ?? payload?.color);
  const glazingStyle = sanitizeString(payload?.glazing_style ?? payload?.glazingStyle);
  const ironmongeryFinish = sanitizeString(payload?.ironmongery ?? payload?.ironmongery_finish ?? payload?.hardware);
  const styleTags = sanitizeStringArray(payload?.style_tags ?? payload?.styleTags);
  const description = sanitizeString(payload?.description);
  const notes = sanitizeString(payload?.notes ?? payload?.reasoning ?? payload?.explanation);

  const width = clampDimension(coerceNumber(widthRaw));
  const height = clampDimension(coerceNumber(heightRaw));
  const confidence = clampConfidence(coerceNumber(confidenceRaw));

  return {
    widthMm: width,
    heightMm: height,
    confidence,
    attributes: {
      productType,
      openingConfig,
      material,
      colour,
      glazingStyle,
      ironmongeryFinish,
      styleTags,
      description,
      notes,
    },
  };
}

function buildPrompt(context?: PhotoMeasurementContext): string {
  const parts = [
    "You are assisting a bespoke joinery estimator.",
    "Estimate the overall width and height of the main window or door opening in millimetres.",
    "Use any reference object (tape measure, bricks, A4 paper, door handle) to scale.",
    "Respond with compact JSON containing: width_mm, height_mm, confidence (0-1), product_type, opening_config, material, colour, glazing_style, ironmongery, style_tags (array), description, notes.",
    "Clamp dimensions between 300 and 3000 mm and round to the nearest 10 before responding.",
    "Confidence should reflect how reliable the estimate is. If you cannot see the full opening or reference, return confidence <= 0.4 and null dimensions but still describe what you see.",
    context?.openingType ? `Opening type: ${context.openingType}` : null,
    context?.floorLevel ? `Floor level: ${context.floorLevel}` : null,
    context?.notes ? `Notes: ${context.notes}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}

function buildImageInput(buffer: Buffer, mimeType?: string) {
  const safeMime = mimeType && /^image\//i.test(mimeType) ? mimeType : "image/jpeg";
  const base64 = buffer.toString("base64");
  return {
    type: "input_image" as const,
    image_url: `data:${safeMime};base64,${base64}`,
    detail: "high" as const,
  };
}

export async function estimateDimensionsFromPhoto(options: {
  buffer: Buffer;
  mimeType?: string;
  context?: PhotoMeasurementContext;
}): Promise<PhotoMeasurementResult> {
  if (!options?.buffer?.length) {
    throw new Error("Image buffer required for estimation");
  }
  if (!openaiClient) {
    throw new Error("OpenAI API key missing");
  }

  const prompt = buildPrompt(options.context);
  const response = await openaiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: prompt }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Estimate dimensions from this photo." },
          buildImageInput(options.buffer, options.mimeType),
        ],
      },
    ],
  });

  const rawText = Array.isArray((response as any)?.output_text)
    ? (response as any).output_text.join("\n")
    : ((response as any)?.output_text as string | undefined) || "";
  const parsed = parseVisionResponseText(rawText);
  if (!parsed) {
    throw new Error("Vision model returned an unreadable response");
  }
  return normalizeVisionEstimate(parsed);
}
