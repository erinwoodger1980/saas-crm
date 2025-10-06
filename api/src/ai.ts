import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function aiRespond({
  system,
  user,
  json = false,
  model = "o3-mini"
}: {
  system: string;
  user: string;
  json?: boolean;
  model?: string;
}) {
  if (!process.env.OPENAI_API_KEY) return "(OpenAI key missing)";
  const resp = await openai.responses.create({
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(json ? { response_format: { type: "json_object" } } : {}),
  });
  return resp.output_text ?? "";
}
import OpenAI from "openai";
import { env } from "./env";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type ExtractedLead = {
  is_lead: boolean;
  contactName?: string;
  email?: string;
  company?: string;
  phone?: string;
  status?: "NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED";
  nextAction?: string;
  custom?: Record<string, any>;
};

export async function extractLeadFromEmail(input: {
  subject: string;
  body: string;
  from?: string;
}): Promise<ExtractedLead> {
  const system =
    "You extract structured lead data from emails. " +
    "Return strictly JSON with keys: is_lead (boolean), contactName, email, company, phone, status, nextAction, custom (object). " +
    'status must be one of "NEW","CONTACTED","QUALIFIED","DISQUALIFIED". If uncertain, use "NEW". ' +
    "If not a lead, set is_lead=false.";

  const user = `
FROM: ${input.from ?? ""}
SUBJECT: ${input.subject}
BODY:
${input.body}
`;

  // Ask for JSON
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" as any },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = resp.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(text);
    // basic normalization
    if (!["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED"].includes(parsed.status)) {
      parsed.status = "NEW";
    }
    return {
      is_lead: !!parsed.is_lead,
      contactName: parsed.contactName || "",
      email: parsed.email || "",
      company: parsed.company || "",
      phone: parsed.phone || "",
      status: parsed.status,
      nextAction: parsed.nextAction || "",
      custom: parsed.custom || {},
    };
  } catch {
    return { is_lead: false };
  }
}
