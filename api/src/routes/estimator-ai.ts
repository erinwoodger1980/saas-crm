// api/src/routes/estimator-ai.ts
// Public questionnaire assistant endpoint. Provides AI guidance for filling the estimator
// form with graceful heuristic fallback when OPENAI_API_KEY is absent.
import { Router } from "express";
import multer from "multer";
import { estimateDimensionsFromPhoto } from "../lib/vision/photoMeasurement";
import { openai } from "../ai";
import { env } from "../env";

interface FieldPayload {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
}

const r = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("image_only"));
  },
});

// Lightweight helper guidance matching the client-side heuristic.
function helperFor(field: FieldPayload): string | null {
  const k = field.key.toLowerCase();
  if (/(width|height|size)/.test(k)) return "Provide numerical dimension (mm or meters) for sizing.";
  if (/material|timber|wood/.test(k)) return "Specify preferred material. Helps estimate cost volatility.";
  if (/finish|coating|paint/.test(k)) return "Describe surface finish (e.g., primed, stained, lacquer).";
  if (/quantity|qty|units?/.test(k)) return "Enter total number of units/items required.";
  if (/location|site|postcode/.test(k)) return "Location can affect logistics and delivery pricing.";
  if (/deadline|date|timeline/.test(k)) return "Target completion date improves scheduling accuracy.";
  if (field.type === "number") return "Numeric value only; leave blank if unknown.";
  if (field.type === "boolean") return "Toggle on if this applies to your project.";
  if (field.type === "select") return "Choose the closest match from the list.";
  return null;
}

function fallbackAnswer(question: string, fields: FieldPayload[], answers: Record<string, any>, requiredAnswered: number, totalRequired: number): string {
  const lower = question.toLowerCase();
  const progressPct = totalRequired === 0 ? 0 : Math.round((requiredAnswered / totalRequired) * 100);
  const match = fields.find(f => lower.includes(f.key.toLowerCase()) || lower.includes(f.label.toLowerCase()));
  if (match) {
    const h = helperFor(match) || "Provide a clear, concise value relevant to project scope.";
    const current = answers[match.key] != null && answers[match.key] !== '' ? `Current value: ${answers[match.key]}` : 'No value entered yet.';
    return `${match.label}: ${h} ${current}`;
  }
  if (/progress|done|complete/.test(lower)) {
    return `You have answered ${requiredAnswered}/${totalRequired} required questions (${progressPct}%).`;
  }
  return "Focus on required (*) fields first; ask about a specific field name for tailored guidance.";
}

r.post("/chat", async (req, res) => {
  try {
    const { question, fields, answers, progress } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "missing_question" });
    }

    const fieldList: FieldPayload[] = Array.isArray(fields) ? fields.filter((f: any) => f && f.key && f.label) : [];
    const ans: Record<string, any> = (answers && typeof answers === 'object') ? answers : {};
    const requiredAnswered = Number(progress?.requiredAnswered || 0);
    const totalRequired = Number(progress?.totalRequired || 0);

    // If no API key, return heuristic fallback immediately.
    if (!env.OPENAI_API_KEY) {
      return res.json({ answer: fallbackAnswer(question, fieldList, ans, requiredAnswered, totalRequired), fallback: true });
    }

    // Try to detect a directly referenced field for targeted guidance (provided separately to the model).
    const lower = question.toLowerCase();
    const directField = fieldList.find(f => lower.includes(f.key.toLowerCase()) || lower.includes(f.label.toLowerCase())) || null;

    const progressPct = totalRequired === 0 ? 0 : Math.round((requiredAnswered / totalRequired) * 100);

    const fieldLines = fieldList.slice(0, 60).map(f => {
      const req = f.required ? 'required' : 'optional';
      const val = ans[f.key] != null && ans[f.key] !== '' ? `value='${String(ans[f.key]).slice(0,80)}'` : 'value=<empty>';
      return `- ${f.label} (key='${f.key}', ${req}, type=${f.type || 'text'}, ${val})`;
    }).join("\n");

    const directHelper = directField ? (helperFor(directField) || "Provide a concise, relevant value.") : null;

    const systemPrompt = `You are Joinery AI, an assistant helping a user fill a project estimator questionnaire. Respond in concise UK English (max 3 sentences unless user asks for more detail). If they reference a specific field, give guidance ONLY about that field: what to provide, format if numeric, and why it matters.
Context you have:
Progress: ${requiredAnswered}/${totalRequired} required answered (${progressPct}%).
Fields:\n${fieldLines}
${directField ? `User likely referring to field: ${directField.label} (key='${directField.key}')` : ''}
${directHelper ? `Suggested guidance for that field: ${directHelper}` : ''}
If the user asks for overall progress, report the progress stats. If unclear which field they mean, prompt them to name the field label. Avoid hallucinating fields not listed.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: question }
    ];

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
      max_tokens: 220,
    });

    const text = resp.choices[0]?.message?.content?.trim() || fallbackAnswer(question, fieldList, ans, requiredAnswered, totalRequired);
    return res.json({ answer: text, model: "gpt-4o-mini", fallback: false });
  } catch (e: any) {
    console.error("[estimator-ai/chat] error:", e?.message || e);
    // Graceful degradation
    try {
      const { question, fields, answers, progress } = req.body || {};
      const fieldList: FieldPayload[] = Array.isArray(fields) ? fields.filter((f: any) => f && f.key && f.label) : [];
      const ans: Record<string, any> = (answers && typeof answers === 'object') ? answers : {};
      const requiredAnswered = Number(progress?.requiredAnswered || 0);
      const totalRequired = Number(progress?.totalRequired || 0);
      return res.json({ answer: fallbackAnswer(question, fieldList, ans, requiredAnswered, totalRequired), fallback: true, error: "ai_error" });
    } catch {
      return res.status(500).json({ error: "unrecoverable" });
    }
  }
});

export default r;

// --- Photo-driven auto-fill endpoint ---
// POST /public/estimator-ai/photo-fill  (multipart/form-data)
// Fields:
//   photo: image file
//   fields: JSON array of { key, label, type, required }
//   existingAnswers: JSON object of current answers (optional)
// Returns suggestedAnswers mapping plus raw measurement attributes.
r.post("/photo-fill", upload.single("photo"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "photo_required" });
    }

    let fieldList: FieldPayload[] = [];
    if (req.body?.fields) {
      try {
        const parsed = JSON.parse(req.body.fields);
        if (Array.isArray(parsed)) {
          fieldList = parsed.filter((f: any) => f && f.key && f.label);
        }
      } catch (e) {
        console.warn("[photo-fill] failed parsing fields", e);
      }
    }
    let existingAnswers: Record<string, any> = {};
    if (req.body?.existingAnswers) {
      try {
        const parsed = JSON.parse(req.body.existingAnswers);
        if (parsed && typeof parsed === "object") existingAnswers = parsed;
      } catch (e) {
        console.warn("[photo-fill] failed parsing existingAnswers", e);
      }
    }

    // If vision unavailable, return graceful fallback with no suggestions.
    if (!env.OPENAI_API_KEY) {
      return res.json({
        visionAvailable: false,
        suggestedAnswers: {},
        message: "Vision model unavailable (missing OPENAI_API_KEY).",
      });
    }

    const measurement = await estimateDimensionsFromPhoto({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    const suggested: Record<string, any> = {};

    // Helper predicate to find best field for a concept.
    const findField = (keywords: string[]) =>
      fieldList.find((f) => {
        const key = f.key.toLowerCase();
        const label = f.label.toLowerCase();
        return keywords.some((kw) => key.includes(kw) || label.includes(kw));
      });

    const widthField = findField(["width", "w" ]);
    const heightField = findField(["height", "h" ]);
    const dimensionField = !widthField && !heightField ? findField(["dimension", "size", "overall"]) : null;
    if (measurement.widthMm && widthField && existingAnswers[widthField.key] == null) {
      suggested[widthField.key] = measurement.widthMm;
    }
    if (measurement.heightMm && heightField && existingAnswers[heightField.key] == null) {
      suggested[heightField.key] = measurement.heightMm;
    }
    if (measurement.widthMm && measurement.heightMm && dimensionField && existingAnswers[dimensionField.key] == null) {
      suggested[dimensionField.key] = `${measurement.widthMm} x ${measurement.heightMm} mm`;
    }

    const attrs = measurement.attributes || {};
    const mapAttribute = (attrValue: any, keywords: string[]) => {
      if (!attrValue) return;
      const field = findField(keywords);
      if (field && existingAnswers[field.key] == null) {
        suggested[field.key] = attrValue;
      }
    };

    mapAttribute(attrs.productType, ["product", "door", "window", "type"]);
    mapAttribute(attrs.openingConfig, ["opening", "config", "configuration"]);
    mapAttribute(attrs.material, ["material", "timber", "wood"]);
    mapAttribute(attrs.colour, ["colour", "color", "finish"]);
    mapAttribute(attrs.glazingStyle, ["glazing", "glass"]);
    mapAttribute(attrs.ironmongeryFinish, ["ironmongery", "hardware", "handle"]);
    mapAttribute(attrs.description, ["description", "notes", "summary"]);
    if (attrs.styleTags?.length) {
      mapAttribute(attrs.styleTags.join(", "), ["style", "tags", "aesthetic"]);
    }

    // Build reasoning summary
    const reasoningParts = [] as string[];
    if (measurement.widthMm || measurement.heightMm) {
      reasoningParts.push(`Estimated dimensions: ${measurement.widthMm ?? "?"} x ${measurement.heightMm ?? "?"} mm (confidence ${measurement.confidence ?? "?"}).`);
    }
    [
      { label: "Product", val: attrs.productType },
      { label: "Config", val: attrs.openingConfig },
      { label: "Material", val: attrs.material },
      { label: "Colour", val: attrs.colour },
      { label: "Glazing", val: attrs.glazingStyle },
      { label: "Ironmongery", val: attrs.ironmongeryFinish },
      { label: "Style Tags", val: attrs.styleTags?.join(", ") },
      { label: "Description", val: attrs.description },
    ].forEach((p) => {
      if (p.val) reasoningParts.push(`${p.label}: ${p.val}`);
    });

    return res.json({
      visionAvailable: true,
      measurement,
      suggestedAnswers: suggested,
      reasoning: reasoningParts.join(" \n"),
    });
  } catch (e: any) {
    console.error("[photo-fill] error", e?.message || e);
    return res.status(500).json({ error: "photo_fill_failed", message: e?.message || String(e) });
  }
});