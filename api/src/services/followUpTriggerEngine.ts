// api/src/services/followUpTriggerEngine.ts
import { prisma } from "../prisma";
import { generateEmailDraft } from "./aiEmailDrafter";

export interface TriggerEvent {
  type: "questionnaire_sent" | "quote_sent" | "lead_created" | "opportunity_stalled";
  entityId: string;
  tenantId: string;
  userId: string;
  metadata: Record<string, any>;
}

/**
 * Scan for events that should trigger follow-up tasks
 */
export async function scanForFollowUpTriggers(): Promise<void> {
  console.log("[followUpTriggerEngine] Starting scan...");

  const tenants = await prisma.tenant.findMany({
    select: { id: true },
  });

  for (const tenant of tenants) {
    try {
      await scanTenantTriggers(tenant.id);
    } catch (error: any) {
      console.error(`[followUpTriggerEngine] Error scanning tenant ${tenant.id}:`, error);
    }
  }

  console.log("[followUpTriggerEngine] Scan complete");
}

async function scanTenantTriggers(tenantId: string): Promise<void> {
  // Get active follow-up rules for tenant
  const rules = await prisma.followUpRule.findMany({
    where: {
      tenantId,
      isActive: true,
    },
  });

  if (rules.length === 0) {
    return; // No rules configured
  }

  // Check each trigger type
  for (const rule of rules) {
    try {
      switch (rule.trigger) {
        case "questionnaire_sent":
          await checkQuestionnaireTriggers(tenantId, rule);
          break;
        case "quote_sent":
          await checkQuoteTriggers(tenantId, rule);
          break;
        case "lead_created":
          await checkLeadTriggers(tenantId, rule);
          break;
        case "opportunity_stalled":
          await checkOpportunityTriggers(tenantId, rule);
          break;
      }
    } catch (error: any) {
      console.error(
        `[followUpTriggerEngine] Error checking rule ${rule.id} (${rule.trigger}):`,
        error
      );
    }
  }
}

/**
 * Check for questionnaires that need follow-up
 */
async function checkQuestionnaireTriggers(
  tenantId: string,
  rule: any
): Promise<void> {
  // Disabled: Schema fields not available in production
  return;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - rule.delayDays);

  // Find questionnaires sent but not completed
  const questionnaires = await prisma.questionnaireResponse.findMany({
    where: {
      tenantId,
      sentAt: {
        lte: cutoffDate,
      },
      completedAt: null,
    },
    include: {
      lead: {
        select: {
          id: true,
          contactName: true,
          email: true,
          custom: true,
        },
      },
    },
  });

  for (const q of questionnaires) {
    if (!q.lead?.email) continue;

    // Check if task already exists
    const existingTask = await prisma.task.findFirst({
      where: {
        tenantId,
        relatedType: "LEAD",
        relatedId: q.lead.id,
        taskType: "FOLLOW_UP",
        meta: {
          path: ["trigger"],
          equals: "questionnaire_sent",
        },
        meta: {
          path: ["questionnaireId"],
          equals: q.id,
        },
        status: {
          not: "COMPLETED",
        },
      },
    });

    if (existingTask) continue; // Already has a follow-up task

    // Create follow-up task with AI draft
    await createFollowUpTask({
      tenantId,
      leadId: q.lead.id,
      recipientEmail: q.lead.email,
      recipientName: q.lead.contactName,
      rule,
      context: {
        purpose: "follow_up_questionnaire",
        daysSince: Math.floor((Date.now() - (q.sentAt?.getTime() || 0)) / (1000 * 60 * 60 * 24)),
        questionnaireSentDate: q.sentAt?.toISOString().split("T")[0],
      },
      metadata: {
        trigger: "questionnaire_sent",
        questionnaireId: q.id,
      },
    });
  }
}

/**
 * Check for quotes that need follow-up
 */
async function checkQuoteTriggers(tenantId: string, rule: any): Promise<void> {
  // Disabled: Schema fields not available in production
  return;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - rule.delayDays);

  // Find quotes sent but not won/lost
  const quotes = await prisma.quote.findMany({
    where: {
      tenantId,
      createdAt: {
        lte: cutoffDate,
      },
      status: {
        notIn: ["WON", "LOST"],
      },
    },
    include: {
      lead: {
        select: {
          id: true,
          contactName: true,
          email: true,
          custom: true,
        },
      },
    },
  });

  for (const quote of quotes) {
    if (!quote.lead?.email) continue;

    // Check if task already exists for this quote at this delay interval
    const existingTask = await prisma.task.findFirst({
      where: {
        tenantId,
        relatedType: "LEAD",
        relatedId: quote.lead.id,
        taskType: "FOLLOW_UP",
        meta: {
          path: ["trigger"],
          equals: "quote_sent",
        },
        meta: {
          path: ["quoteId"],
          equals: quote.id,
        },
        meta: {
          path: ["delayDays"],
          equals: rule.delayDays,
        },
        status: {
          not: "COMPLETED",
        },
      },
    });

    if (existingTask) continue;

    // Create follow-up task
    await createFollowUpTask({
      tenantId,
      leadId: quote.lead.id,
      recipientEmail: quote.lead.email,
      recipientName: quote.lead.contactName,
      rule,
      context: {
        purpose: "follow_up_quote",
        daysSince: Math.floor((Date.now() - quote.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        quoteValue: quote.totalGBP ? Number(quote.totalGBP) : undefined,
        quoteSentDate: quote.createdAt.toISOString().split("T")[0],
      },
      metadata: {
        trigger: "quote_sent",
        quoteId: quote.id,
        delayDays: rule.delayDays,
      },
    });
  }
}

/**
 * Check for new leads that need initial contact
 */
async function checkLeadTriggers(tenantId: string, rule: any): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - rule.delayDays);

  // Find new leads without initial contact
  const leads = await prisma.lead.findMany({
    where: {
      tenantId,
      capturedAt: {
        lte: cutoffDate,
      },
      status: "NEW",
      email: {
        not: null,
      },
    },
    select: {
      id: true,
      contactName: true,
      email: true,
      custom: true,
      capturedAt: true,
    },
  });

  for (const lead of leads) {
    if (!lead.email) continue;

    // Check if ANY open task already exists for this lead (including playbook tasks)
    // This prevents creating duplicate "Review enquiry" tasks
    const existingTask = await prisma.task.findFirst({
      where: {
        tenantId,
        relatedType: "LEAD",
        relatedId: lead.id,
        status: {
          notIn: ["DONE", "CANCELLED"],
        },
        OR: [
          {
            // Check for follow-up tasks from this engine
            taskType: "FOLLOW_UP",
            meta: {
              path: ["trigger"],
              equals: "lead_created",
            },
          },
          {
            // Check for playbook "Review enquiry" tasks
            title: {
              contains: "Review enquiry",
              mode: "insensitive",
            },
          },
        ],
      },
    });

    if (existingTask) continue;

    await createFollowUpTask({
      tenantId,
      leadId: lead.id,
      recipientEmail: lead.email,
      recipientName: lead.contactName,
      rule,
      context: {
        purpose: "initial_contact",
        daysSince: Math.floor((Date.now() - lead.capturedAt.getTime()) / (1000 * 60 * 60 * 24)),
        previousInteraction: (lead.custom as any)?.summary || "Expressed interest via enquiry",
      },
      metadata: {
        trigger: "lead_created",
      },
    });
  }
}

/**
 * Check for stalled opportunities
 */
async function checkOpportunityTriggers(tenantId: string, rule: any): Promise<void> {
  // Disabled: Schema fields not available in production
  return;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - rule.delayDays);

  // Find opportunities with no recent activity
  const opportunities = await prisma.opportunity.findMany({
    where: {
      tenantId,
      updatedAt: {
        lte: cutoffDate,
      },
      stage: {
        notIn: ["WON", "LOST"],
      },
    },
    include: {
      lead: {
        select: {
          id: true,
          contactName: true,
          email: true,
        },
      },
    },
  });

  for (const opp of opportunities) {
    if (!opp.lead?.email) continue;

    // Check if task already exists
    const existingTask = await prisma.task.findFirst({
      where: {
        tenantId,
        relatedType: "OPPORTUNITY",
        relatedId: opp.id,
        taskType: "FOLLOW_UP",
        meta: {
          path: ["trigger"],
          equals: "opportunity_stalled",
        },
        status: {
          not: "COMPLETED",
        },
      },
    });

    if (existingTask) continue;

    await createFollowUpTask({
      tenantId,
      leadId: opp.lead.id,
      opportunityId: opp.id,
      recipientEmail: opp.lead.email,
      recipientName: opp.lead.contactName,
      rule,
      context: {
        purpose: "check_in",
        daysSince: Math.floor((Date.now() - opp.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
        previousInteraction: `Last update: ${opp.updatedAt.toISOString().split("T")[0]}`,
      },
      metadata: {
        trigger: "opportunity_stalled",
        opportunityId: opp.id,
      },
    });
  }
}

/**
 * Create a follow-up task with AI-generated email draft
 */
async function createFollowUpTask(params: {
  tenantId: string;
  leadId: string;
  opportunityId?: string;
  recipientEmail: string;
  recipientName: string;
  rule: any;
  context: any;
  metadata: Record<string, any>;
}): Promise<void> {
  try {
    // Generate AI email draft
    const aiDraft = await generateEmailDraft({
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      ...params.context,
    });

    // Create task
    const task = await prisma.task.create({
      data: {
        tenantId: params.tenantId,
        title: params.rule.taskTitle
          .replace("{leadName}", params.recipientName || "customer")
          .replace("{companyName}", params.recipientName || "customer"),
        description: aiDraft.body,
        relatedType: params.opportunityId ? "OPPORTUNITY" : "LEAD",
        relatedId: params.opportunityId || params.leadId,
        taskType: "FOLLOW_UP",
        status: "OPEN",
        priority: params.rule.priority,
        dueAt: new Date(), // Due now for review
        autocreated: params.rule.autoSchedule,
        meta: {
          ...params.metadata,
          aiDraft: {
            subject: aiDraft.subject,
            body: aiDraft.body,
            confidence: aiDraft.confidence,
            generatedAt: new Date().toISOString(),
          },
          recipientEmail: params.recipientEmail,
          recipientName: params.recipientName,
          ruleId: params.rule.id,
        },
      },
    });

    console.log(
      `[followUpTriggerEngine] Created task ${task.id} for ${params.recipientEmail} (trigger: ${params.metadata.trigger})`
    );
  } catch (error: any) {
    console.error(
      `[followUpTriggerEngine] Failed to create task for ${params.recipientEmail}:`,
      error
    );
  }
}

/**
 * Initialize default follow-up rules for a tenant
 */
export async function initializeDefaultRules(tenantId: string): Promise<void> {
  const defaultRules = [
    {
      trigger: "questionnaire_sent",
      delayDays: 3,
      taskTitle: "Follow up on questionnaire with {leadName}",
      emailSubject: "Quick reminder about your project questionnaire",
      contextTemplate:
        "Questionnaire sent {daysSince} days ago. No completion yet. Be friendly and helpful. Offer assistance if they're stuck.",
      priority: "MEDIUM",
      autoSchedule: true,
    },
    {
      trigger: "quote_sent",
      delayDays: 3,
      taskTitle: "Follow up on quote for {leadName}",
      emailSubject: "Following up on your quote for {projectDescription}",
      contextTemplate:
        "Quote value £{quoteValue} sent {daysSince} days ago. Check if they have questions. Offer to discuss.",
      priority: "HIGH",
      autoSchedule: true,
    },
    {
      trigger: "quote_sent",
      delayDays: 7,
      taskTitle: "Second follow-up on quote for {leadName}",
      emailSubject: "Any questions about your quote?",
      contextTemplate:
        "Second follow-up. Quote value £{quoteValue}. Be helpful, offer to discuss, show willingness to work with them.",
      priority: "HIGH",
      autoSchedule: true,
    },
    {
      trigger: "lead_created",
      delayDays: 1,
      taskTitle: "Initial contact with {leadName}",
      emailSubject: "Thank you for your enquiry",
      contextTemplate:
        "First contact. Warm welcome, set expectations, offer help. Suggest next step (site visit/call).",
      priority: "HIGH",
      autoSchedule: true,
    },
    {
      trigger: "opportunity_stalled",
      delayDays: 7,
      taskTitle: "Check in with {leadName}",
      emailSubject: "Checking in on your {projectType} project",
      contextTemplate:
        "No activity for 7 days. Gentle check-in, understand if timing changed, offer help with blockers.",
      priority: "MEDIUM",
      autoSchedule: false, // User should decide on this one
    },
  ];

  for (const ruleData of defaultRules) {
    try {
      await prisma.followUpRule.create({
        data: {
          ...ruleData,
          tenantId,
        },
      });
    } catch (error: any) {
      console.error(`[followUpTriggerEngine] Failed to create default rule:`, error);
    }
  }

  console.log(`[followUpTriggerEngine] Initialized ${defaultRules.length} default rules for tenant ${tenantId}`);
}
