// api/src/services/conversationalFollowUp.ts
import { prisma } from "../prisma";
import { generateEmailDraft } from "./aiEmailDrafter";

/**
 * Conversational follow-up system that guides users through lead engagement
 */

export interface LeadContext {
  leadId: string;
  tenantId: string;
  userId: string;
  contactName: string;
  email: string;
  threadId?: string;
  messageId?: string;
  subject?: string;
  snippet?: string;
}

/**
 * When a new lead is created from email, create a conversational follow-up task
 */
export async function handleNewLeadFromEmail(context: LeadContext): Promise<void> {
  try {
    // Generate AI draft for initial response
    const aiDraft = await generateEmailDraft({
      recipientEmail: context.email,
      recipientName: context.contactName,
      purpose: "initial_contact",
      tone: "friendly",
      previousInteraction: context.snippet || "New enquiry received",
    });

    // Create conversational follow-up task
    const task = await prisma.task.create({
      data: {
        tenantId: context.tenantId,
        title: `Respond to ${context.contactName}'s enquiry`,
        description: aiDraft.body,
        relatedType: "LEAD",
        relatedId: context.leadId,
        taskType: "FOLLOW_UP",
        status: "OPEN",
        priority: "HIGH",
        dueAt: new Date(), // Immediate
        autocreated: true,
        meta: {
          trigger: "lead_created",
          recipientEmail: context.email,
          recipientName: context.contactName,
          threadId: context.threadId,
          originalMessageId: context.messageId,
          aiDraft: {
            subject: aiDraft.subject,
            body: aiDraft.body,
            confidence: aiDraft.confidence,
            generatedAt: new Date().toISOString(),
          },
          conversational: true,
          suggestedAction: "send_welcome_email",
        },
      },
    });

    // Create conversational notification (Notification uses payload Json)
    await prisma.notification.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId,
        type: "LEAD_SUGGESTION",
        payload: {
          title: `🎉 New lead: ${context.contactName}`,
            message: `Great news! You've received a new enquiry from **${context.contactName}** (${context.email}).\n\nI've drafted a welcome email to acknowledge their enquiry. Would you like to review and send it?`,
            actionLabel: "Review Email",
            actionUrl: `/leads?id=${context.leadId}&task=${task.id}`,
            metadata: {
              leadId: context.leadId,
              taskId: task.id,
              aiConfidence: aiDraft.confidence,
              suggestedSubject: aiDraft.subject,
            },
        },
      },
    });

    console.log(
      `[conversationalFollowUp] Created welcome task ${task.id} for lead ${context.leadId}`
    );
  } catch (error: any) {
    console.error(`[conversationalFollowUp] Failed to create welcome task:`, error);
  }
}

/**
 * When a quote is sent, create proactive follow-up suggestions
 */
export async function handleQuoteSent(params: {
  tenantId: string;
  userId: string;
  leadId: string;
  quoteId: string;
  quoteValue: number;
  recipientEmail: string;
  recipientName: string;
}): Promise<void> {
  try {
    // Schedule follow-up tasks at different intervals
    const followUpIntervals = [
      { days: 3, message: "sent 3 days ago with no response" },
      { days: 7, message: "sent a week ago - second follow-up" },
    ];

    for (const interval of followUpIntervals) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + interval.days);

      // Pre-generate AI draft for this follow-up
      const aiDraft = await generateEmailDraft({
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        purpose: "follow_up_quote",
        tone: "professional",
        quoteValue: params.quoteValue,
        daysSince: interval.days,
      });

      await prisma.task.create({
        data: {
          tenantId: params.tenantId,
          title: `Follow up on quote for ${params.recipientName}`,
          description: aiDraft.body,
          relatedType: "LEAD",
          relatedId: params.leadId,
          taskType: "FOLLOW_UP",
          status: "OPEN",
          priority: interval.days <= 3 ? "HIGH" : "MEDIUM",
          dueAt: dueDate,
          autocreated: true,
          meta: {
            trigger: "quote_sent",
            quoteId: params.quoteId,
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            quoteValue: params.quoteValue,
            followUpNumber: interval.days === 3 ? 1 : 2,
            aiDraft: {
              subject: aiDraft.subject,
              body: aiDraft.body,
              confidence: aiDraft.confidence,
              generatedAt: new Date().toISOString(),
            },
            conversational: true,
            suggestedAction: "send_follow_up",
          },
        },
      });
    }

    // Create immediate notification (payload Json)
    await prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        type: "QUOTE_FOLLOWUP_SCHEDULED",
        payload: {
          title: `📋 Follow-ups scheduled for ${params.recipientName}`,
          message: `Perfect! I've scheduled automatic follow-up reminders for this quote at 3 and 7 days. I'll draft personalized emails when it's time to follow up.`,
          actionLabel: "View Schedule",
          actionUrl: `/leads?id=${params.leadId}`,
          metadata: {
            leadId: params.leadId,
            quoteId: params.quoteId,
            quoteValue: params.quoteValue,
          },
        },
      },
    });

    console.log(
      `[conversationalFollowUp] Scheduled ${followUpIntervals.length} follow-ups for quote ${params.quoteId}`
    );
  } catch (error: any) {
    console.error(`[conversationalFollowUp] Failed to schedule quote follow-ups:`, error);
  }
}

/**
 * When a questionnaire is sent, schedule follow-up
 */
export async function handleQuestionnaireSent(params: {
  tenantId: string;
  userId: string;
  leadId: string;
  questionnaireId: string;
  recipientEmail: string;
  recipientName: string;
}): Promise<void> {
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const aiDraft = await generateEmailDraft({
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      purpose: "follow_up_questionnaire",
      tone: "friendly",
      daysSince: 3,
    });

    const task = await prisma.task.create({
      data: {
        tenantId: params.tenantId,
        title: `Follow up on questionnaire with ${params.recipientName}`,
        description: aiDraft.body,
        relatedType: "LEAD",
        relatedId: params.leadId,
        taskType: "FOLLOW_UP",
        status: "OPEN",
        priority: "MEDIUM",
        dueAt: dueDate,
        autocreated: true,
        meta: {
          trigger: "questionnaire_sent",
          questionnaireId: params.questionnaireId,
          recipientEmail: params.recipientEmail,
          recipientName: params.recipientName,
          aiDraft: {
            subject: aiDraft.subject,
            body: aiDraft.body,
            confidence: aiDraft.confidence,
            generatedAt: new Date().toISOString(),
          },
          conversational: true,
          suggestedAction: "remind_questionnaire",
        },
      },
    });

    await prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        type: "QUESTIONNAIRE_FOLLOWUP_SCHEDULED",
        payload: {
          title: `📝 Questionnaire follow-up scheduled`,
          message: `All set! I'll remind you in 3 days to follow up with **${params.recipientName}** if they haven't completed the questionnaire. I'll have a gentle reminder email ready.`,
          actionLabel: "View Task",
          actionUrl: `/leads?id=${params.leadId}&task=${task.id}`,
          metadata: {
            leadId: params.leadId,
            questionnaireId: params.questionnaireId,
            taskId: task.id,
          },
        },
      },
    });

    console.log(
      `[conversationalFollowUp] Scheduled questionnaire follow-up for lead ${params.leadId}`
    );
  } catch (error: any) {
    console.error(`[conversationalFollowUp] Failed to schedule questionnaire follow-up:`, error);
  }
}

/**
 * When a reply is received, update tasks and create suggestions
 */
export async function handleEmailReply(params: {
  tenantId: string;
  leadId: string;
  threadId: string;
  messageId: string;
  fromEmail: string;
  subject: string;
  body: string;
  sentiment?: "positive" | "neutral" | "negative" | "question";
}): Promise<void> {
  try {
    // Find related follow-up tasks
    const tasks = await prisma.task.findMany({
      where: {
        tenantId: params.tenantId,
        relatedType: "LEAD",
        relatedId: params.leadId,
        taskType: "FOLLOW_UP",
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      include: {
        assignees: true,
      },
    });

    for (const task of tasks) {
      const meta = (task.meta as any) || {};

      // Add reply to conversation
      await prisma.emailConversation.create({
        data: {
          taskId: task.id,
          tenantId: params.tenantId,
          messageId: params.messageId,
          threadId: params.threadId,
          fromAddress: params.fromEmail,
          toAddress: meta.recipientEmail || "",
          subject: params.subject,
          body: params.body,
          direction: "RECEIVED",
          timestamp: new Date(),
        },
      });

      // Update follow-up history
      const history = await prisma.followUpHistory.findFirst({
        where: { taskId: task.id },
        orderBy: { sentAt: "desc" },
      });

      if (history && history.sentAt) {
        const responseTime = Math.floor(
          (new Date().getTime() - history.sentAt.getTime()) / (1000 * 60)
        );

        await prisma.followUpHistory.update({
          where: { id: history.id },
          data: {
            responded: true,
            respondedAt: new Date(),
            responseTime,
          },
        });
      }

      // Create conversational notification based on sentiment
      const userId = task.assignees[0]?.userId || task.createdById;
      if (!userId) continue;

      let notificationMessage = "";
      let suggestedAction = "";

      switch (params.sentiment) {
        case "positive":
          notificationMessage = `🎉 Great news! **${params.fromEmail}** replied positively to your follow-up. They seem interested - would you like me to suggest next steps?`;
          suggestedAction = "suggest_next_steps";
          // Consider marking task as done or converting to opportunity
          await prisma.task.update({
            where: { id: task.id },
            data: { status: "DONE" },
          });
          break;

        case "question":
          notificationMessage = `❓ **${params.fromEmail}** has questions about your follow-up. I can help draft a response if you'd like.`;
          suggestedAction = "draft_response";
          break;

        case "negative":
          notificationMessage = `📭 **${params.fromEmail}** isn't interested right now. I'll mark this as inactive and suggest checking in later.`;
          suggestedAction = "mark_inactive";
          await prisma.task.update({
            where: { id: task.id },
            data: { status: "CANCELLED" },
          });
          break;

        default:
          notificationMessage = `📬 **${params.fromEmail}** replied to your follow-up. Check their message to see what they said.`;
          suggestedAction = "review_reply";
      }

      await prisma.notification.create({
        data: {
          tenantId: params.tenantId,
          userId,
          type: "FOLLOW_UP_REPLY",
          payload: {
            title: `Reply received from ${params.fromEmail}`,
            message: notificationMessage,
            actionLabel: "View Conversation",
            actionUrl: `/leads?id=${params.leadId}&task=${task.id}`,
            metadata: {
              leadId: params.leadId,
              taskId: task.id,
              messageId: params.messageId,
              sentiment: params.sentiment,
              suggestedAction,
            },
          },
        },
      });
    }

    console.log(
      `[conversationalFollowUp] Processed reply for lead ${params.leadId}, updated ${tasks.length} tasks`
    );
  } catch (error: any) {
    console.error(`[conversationalFollowUp] Failed to handle email reply:`, error);
  }
}

/**
 * Provide conversational suggestions based on task status
 */
export async function getSuggestedActions(taskId: string): Promise<{
  suggestions: Array<{
    action: string;
    label: string;
    description: string;
    confidence: number;
  }>;
}> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      emailConversations: { orderBy: { timestamp: "desc" }, take: 5 },
      followUpHistory: { orderBy: { sentAt: "desc" }, take: 1 },
    },
  });

  if (!task) {
    return { suggestions: [] };
  }

  const suggestions: Array<{
    action: string;
    label: string;
    description: string;
    confidence: number;
  }> = [];

  const meta = (task.meta as any) || {};
  const hasAIDraft = !!meta.aiDraft;
  const hasSent = task.emailConversations.some((c) => c.direction === "SENT");
  const hasReply = task.emailConversations.some((c) => c.direction === "RECEIVED");

  if (hasAIDraft && !hasSent) {
    suggestions.push({
      action: "send_draft",
      label: "Send AI Draft",
      description: `I've prepared a ${meta.aiDraft.confidence > 0.8 ? "highly confident" : "good"} draft email. Review and send when ready.`,
      confidence: meta.aiDraft.confidence || 0.5,
    });
  }

  if (hasSent && !hasReply && task.status === "IN_PROGRESS") {
    const lastSent = task.emailConversations.find((c) => c.direction === "SENT");
    const daysSince = lastSent
      ? Math.floor((Date.now() - new Date(lastSent.timestamp).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysSince >= 3) {
      suggestions.push({
        action: "send_followup",
        label: "Send Another Follow-up",
        description: `It's been ${daysSince} days since your last email. Would you like me to draft another follow-up?`,
        confidence: 0.7,
      });
    }
  }

  if (hasReply) {
    suggestions.push({
      action: "draft_response",
      label: "Draft Response",
      description: `They replied! Let me help you craft a response that addresses their message.`,
      confidence: 0.8,
    });
  }

  if (!hasSent && !hasAIDraft) {
    suggestions.push({
      action: "generate_draft",
      label: "Generate Draft",
      description: `I can create a personalized email draft based on the context of this ${meta.trigger || "task"}.`,
      confidence: 0.6,
    });
  }

  return { suggestions };
}
