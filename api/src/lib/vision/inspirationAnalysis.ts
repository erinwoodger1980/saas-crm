import OpenAI from "openai";
import { parseVisionResponseText } from "./photoMeasurement";

const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim();
const openaiClient = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

export type InspirationAnalysisContext = {
  desiredProduct?: string | null;
  projectNotes?: string | null;
  keywords?: string[] | null;
};

export type InspirationAttributes = {
  mood?: string | null;
  palette?: string[] | null;
  styleTags?: string[] | null;
  heroFeatures?: string[] | null;
  materialCues?: string[] | null;
  glazingCues?: string[] | null;
  hardwareCues?: string[] | null;
  recommendedSpecs?: {
    timber?: string | null;
    finish?: string | null;
    glazing?: string | null;
    ironmongery?: string | null;
  } | null;
  description?: string | null;
  notes?: string | null;
};

export type InspirationAnalysisResult = {
  confidence: number | null;
  attributes: InspirationAttributes;
};

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
    const cleaned = value.map((entry) => sanitizeString(entry)).filter((entry): entry is string => Boolean(entry));
    return cleaned.length ? cleaned : null;
  }
  if (typeof value === "string") {
    const parts = value
      .split(/[;,]/)
      .map((segment) => sanitizeString(segment))
      .filter((segment): segment is string => Boolean(segment));
    return parts.length ? parts : null;
  }
  return null;
}

function coerceNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[a-zA-Z,%]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampConfidence(value: number | null): number | null {
  if (value === null) return null;
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 100) / 100;
}

function normalizeSpecs(raw: any): InspirationAttributes["recommendedSpecs"] {
  if (!raw || typeof raw !== "object") return null;
  return {
    timber: sanitizeString(raw.timber ?? raw.recommended_timber),
    finish: sanitizeString(raw.finish ?? raw.recommended_finish),
    glazing: sanitizeString(raw.glazing ?? raw.recommended_glazing),
    ironmongery: sanitizeString(raw.ironmongery ?? raw.hardware ?? raw.recommended_ironmongery),
  };
}

function normalizeInspirationResponse(payload: any): InspirationAnalysisResult {
  const confidence = clampConfidence(coerceNumber(payload?.confidence ?? payload?.confidence_score));
  const mood = sanitizeString(payload?.mood ?? payload?.vibe ?? payload?.style_summary);
  const palette = sanitizeStringArray(payload?.palette ?? payload?.colour_palette ?? payload?.color_palette);
  const styleTags = sanitizeStringArray(payload?.style_tags ?? payload?.styleTags ?? payload?.tags);
  const heroFeatures = sanitizeStringArray(payload?.hero_features ?? payload?.heroFeatures);
  const materialCues = sanitizeStringArray(payload?.material_cues ?? payload?.materials ?? payload?.materialNotes);
  const glazingCues = sanitizeStringArray(payload?.glazing_cues ?? payload?.glazing ?? payload?.glassNotes);
  const hardwareCues = sanitizeStringArray(payload?.hardware_cues ?? payload?.hardware ?? payload?.ironmongery);
  const description = sanitizeString(payload?.description ?? payload?.summary);
  const notes = sanitizeString(payload?.notes ?? payload?.story ?? payload?.explanation);
  const recommendedSpecs = normalizeSpecs(payload?.recommended_specs ?? payload?.recommendations);

  return {
    confidence,
    attributes: {
      mood,
      palette,
      styleTags,
      heroFeatures,
      materialCues,
      glazingCues,
      hardwareCues,
      recommendedSpecs,
      description,
      notes,
    },
  };
}

function buildPrompt(context?: InspirationAnalysisContext): string {
  const parts = [
    "You are an assistant for a bespoke joinery estimator.",
    "Given an inspiration or mood photo, identify the aesthetic and material cues relevant to doors or windows.",
    "Respond with compact JSON including: confidence (0-1), mood, palette (array), style_tags (array), hero_features (array), material_cues (array), glazing_cues (array), hardware_cues (array), recommended_specs (object with timber, finish, glazing, ironmongery), description, notes.",
    "Palette entries can be colour names or hex codes.",
    context?.desiredProduct ? `Intended product: ${context.desiredProduct}` : null,
    context?.projectNotes ? `Project notes: ${context.projectNotes}` : null,
    context?.keywords?.length ? `User keywords: ${context.keywords.join(", ")}` : null,
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

export async function analyzeInspirationPhoto(options: {
  buffer: Buffer;
  mimeType?: string;
  context?: InspirationAnalysisContext;
}): Promise<InspirationAnalysisResult> {
  if (!options?.buffer?.length) {
    throw new Error("Image buffer required for inspiration analysis");
  }
  if (!openaiClient) {
    throw new Error("OpenAI API key missing");
  }

  const response = await openaiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: buildPrompt(options.context) }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Describe the style cues in this inspiration photo." },
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
    throw new Error("Vision model returned an unreadable inspiration response");
  }
  return normalizeInspirationResponse(parsed);
}
