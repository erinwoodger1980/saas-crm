// api/src/services/aiEmailDrafter.ts
import OpenAI from "openai";
import { env } from "../env";
import { prisma } from "../prisma";

export interface EmailDraftContext {
  recipientName?: string;
  recipientEmail: string;
  companyName?: string;
  senderFirstName?: string;
  senderLastName?: string;
  senderFullName?: string;
  emailFooter?: string;
  previousInteraction?: string;
  daysSince?: number;
  quoteValue?: number;
  quoteSentDate?: string;
  questionnaireSentDate?: string;
  leadId?: string;
  opportunityId?: string;
  purpose:
    | "follow_up_quote"
    | "follow_up_questionnaire"
    | "initial_contact"
    | "check_in"
    | "custom";
  customContext?: string;
  tone?: "professional" | "friendly" | "formal";
}

export interface AIDraftResult {
  subject: string;
  body: string;
  confidence: number;
  reasoning?: string;
}

/**
 * Generate AI email draft using OpenAI
 */
export async function generateEmailDraft(
  context: EmailDraftContext
): Promise<AIDraftResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // Build contextual prompt
  const systemPrompt = buildSystemPrompt(context.tone || "professional");
  const userPrompt = buildUserPrompt(context);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_draft",
          schema: {
            type: "object",
            properties: {
              subject: {
                type: "string",
                description: "Email subject line that's engaging and specific",
              },
              body: {
                type: "string",
                description: "Full email body with proper greeting, context, and clear call to action",
              },
              confidence: {
                type: "number",
                description: "Confidence score 0-1 for this draft quality",
                minimum: 0,
                maximum: 1,
              },
              reasoning: {
                type: "string",
                description: "Brief explanation of approach taken",
              },
            },
            required: ["subject", "body", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(text) as AIDraftResult;

    // Fallback if parsing fails
    if (!result.subject || !result.body) {
      throw new Error("AI response missing required fields");
    }

    return result;
  } catch (error: any) {
    console.error("[aiEmailDrafter] OpenAI API error:", error);
    throw new Error(`Failed to generate email draft: ${error.message}`);
  }
}

function buildSystemPrompt(tone: string): string {
  const toneInstructions = {
    professional:
      "Use a professional, business-appropriate tone. Be courteous but direct. Focus on value and next steps.",
    friendly:
      "Use a warm, personable tone while remaining professional. Be conversational but not overly casual. Show genuine interest.",
    formal:
      "Use formal business language. Be polite, structured, and respectful. Maintain appropriate distance.",
  };

  return `You are an expert email writer for a bespoke joinery and carpentry business. Your role is to craft follow-up emails that:

1. Re-engage the recipient naturally without being pushy
2. Provide value or helpful information
3. Include a clear, low-pressure call to action
4. Feel personal and contextual, not template-like
5. Keep it concise (2-3 short paragraphs max)

Tone: ${toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.professional}

Important:
- Never apologize for following up (it's expected in business)
- Don't use phrases like "just checking in" or "following up" - be more specific
- Always include the recipient's name if provided
- End with a question or specific next step
- Sign off with the sender's first name only (no company details needed - that's in signature)`;
}

function buildUserPrompt(context: EmailDraftContext): string {
  const parts: string[] = [];

  parts.push(`Write a follow-up email for this situation:`);
  parts.push(``);

  // Sender info
  if (context.senderFirstName) {
    parts.push(`From: ${context.senderFirstName}${context.senderLastName ? ' ' + context.senderLastName : ''}`);
  }
  
  // Recipient info
  parts.push(`Recipient: ${context.recipientName || "Customer"} (${context.recipientEmail})`);
  if (context.companyName) {
    parts.push(`Company: ${context.companyName}`);
  }

  // Purpose-specific context
  switch (context.purpose) {
    case "follow_up_quote":
      parts.push(``);
      parts.push(`Purpose: Following up on a quote we sent ${context.daysSince || "recently"} days ago`);
      if (context.quoteValue) {
        parts.push(`Quote value: £${context.quoteValue.toLocaleString()}`);
      }
      if (context.quoteSentDate) {
        parts.push(`Quote sent: ${context.quoteSentDate}`);
      }
      parts.push(``);
      parts.push(
        `Goal: Check if they have questions, offer to discuss details, or provide additional information that might help them decide.`
      );
      break;

    case "follow_up_questionnaire":
      parts.push(``);
      parts.push(
        `Purpose: Following up on a project questionnaire we sent ${context.daysSince || "recently"} days ago that hasn't been completed yet`
      );
      if (context.questionnaireSentDate) {
        parts.push(`Questionnaire sent: ${context.questionnaireSentDate}`);
      }
      parts.push(``);
      parts.push(
        `Goal: Gently remind them, offer assistance if they're stuck on any questions, and emphasize how it helps us provide an accurate quote.`
      );
      break;

    case "initial_contact":
      parts.push(``);
      parts.push(`Purpose: First contact after they expressed interest in our services`);
      if (context.previousInteraction) {
        parts.push(`Previous interaction: ${context.previousInteraction}`);
      }
      parts.push(``);
      parts.push(
        `Goal: Welcome them, establish credibility, and suggest the next step (site visit, call, or questionnaire).`
      );
      break;

    case "check_in":
      parts.push(``);
      parts.push(
        `Purpose: Checking in on a project that's gone quiet for ${context.daysSince || "several"} days`
      );
      if (context.previousInteraction) {
        parts.push(`Last interaction: ${context.previousInteraction}`);
      }
      parts.push(``);
      parts.push(
        `Goal: Re-engage without pressure, understand if timing has changed, offer to help overcome any blockers.`
      );
      break;

    case "custom":
      if (context.customContext) {
        parts.push(``);
        parts.push(`Context: ${context.customContext}`);
      }
      break;
  }

  if (context.previousInteraction && context.purpose !== "initial_contact" && context.purpose !== "check_in") {
    parts.push(``);
    parts.push(`Previous interaction: ${context.previousInteraction}`);
  }

  // Add footer instruction if provided
  if (context.emailFooter) {
    parts.push(``);
    parts.push(`Email signature to append after the sign-off:`);
    parts.push(context.emailFooter);
  }

  return parts.join("\n");
}

/**
 * Learn from user edits to improve future drafts
 */
export async function recordUserEdits(params: {
  tenantId: string;
  userId: string;
  taskId: string;
  originalSubject: string;
  originalBody: string;
  finalSubject: string;
  finalBody: string;
  purpose: string;
}): Promise<void> {
  // Calculate edit distance (simple character-level)
  const subjectDiff = Math.abs(params.originalSubject.length - params.finalSubject.length);
  const bodyDiff = Math.abs(params.originalBody.length - params.finalBody.length);
  const totalEditDistance = subjectDiff + bodyDiff;

  const userEdited = params.originalSubject !== params.finalSubject || params.originalBody !== params.finalBody;

  // Store in FollowUpHistory for ML learning
  await prisma.followUpHistory.create({
    data: {
      taskId: params.taskId,
      tenantId: params.tenantId,
      userId: params.userId,
      aiDraftSubject: params.originalSubject,
      aiDraftBody: params.originalBody,
      finalSubject: params.finalSubject,
      finalBody: params.finalBody,
      recipientEmail: "unknown", // Will be updated when email is sent
      userEdited,
      editDistance: totalEditDistance,
    },
  });
}

/**
 * Get user's writing style from past emails
 */
export async function analyzeUserStyle(tenantId: string, userId: string): Promise<string | null> {
  // Fetch recent sent emails from this user
  const recentFollowUps = await prisma.followUpHistory.findMany({
    where: {
      tenantId,
      userId,
      sentAt: { not: null },
    },
    orderBy: { sentAt: "desc" },
    take: 10,
    select: {
      finalBody: true,
      finalSubject: true,
    },
  });

  if (recentFollowUps.length === 0) {
    return null;
  }

  // Simple style analysis
  const bodies = recentFollowUps.map((f) => f.finalBody).filter(Boolean);
  const avgLength = bodies.reduce((sum, b) => sum + (b?.length || 0), 0) / bodies.length;
  const usesExclamation = bodies.some((b) => b?.includes("!"));
  const usesQuestions = bodies.some((b) => b?.includes("?"));

  let style = "";
  if (avgLength < 300) {
    style += "Prefers concise emails. ";
  } else if (avgLength > 600) {
    style += "Writes detailed, comprehensive emails. ";
  }

  if (usesExclamation) {
    style += "Uses exclamation marks for enthusiasm. ";
  }
  if (usesQuestions) {
    style += "Often ends with questions to encourage replies. ";
  }

  return style || null;
}
