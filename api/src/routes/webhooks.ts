import { Router } from "express";
import { prisma } from "../prisma";

const router = Router();

/**
 * Resend Webhook Handler
 * Processes email delivery and reply events from Resend
 * 
 * Events handled:
 * - email.sent
 * - email.delivered
 * - email.bounced
 * - email.complained
 * - email.failed
 * - email.opened
 * - email.clicked
 */
router.post("/resend", async (req, res) => {
  try {
    const event = req.body;
    
    if (!event || !event.type) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    // Verify webhook signature (if needed - depends on Resend's security requirements)
    // For now, we'll process all events

    console.log(`[webhook/resend] Processing event: ${event.type}`);

    switch (event.type) {
      case "email.sent":
        // Email successfully sent
        console.log(`[webhook/resend] Email sent to ${event.email}`);
        break;

      case "email.delivered":
        // Email delivered to recipient
        console.log(`[webhook/resend] Email delivered to ${event.email}`);
        break;

      case "email.bounced":
        // Email bounced
        console.warn(`[webhook/resend] Email bounced: ${event.email}`, event);
        break;

      case "email.complained":
        // Recipient marked as spam
        console.warn(`[webhook/resend] Email complained: ${event.email}`, event);
        break;

      case "email.failed":
        // Email failed to send
        console.error(`[webhook/resend] Email failed: ${event.email}`, event);
        break;

      case "email.opened":
        // Recipient opened email
        console.log(`[webhook/resend] Email opened by ${event.email}`);
        break;

      case "email.clicked":
        // Recipient clicked a link
        console.log(`[webhook/resend] Email clicked by ${event.email}`, event.link);
        break;

      default:
        console.log(`[webhook/resend] Unknown event type: ${event.type}`);
    }

    res.json({ ok: true, processed: true });
  } catch (error: any) {
    console.error("[webhook/resend] Failed to process webhook:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Parse email reply for feedback responses
 * Called when an email reply is received
 * 
 * Looks for URLs in the reply text matching:
 * - /feedback?highlight=FEEDBACK_ID&response=approved
 * - /feedback?highlight=FEEDBACK_ID&response=needs-more
 */
export async function parseFeedbackReply(
  replyText: string,
  recipientEmail: string,
  feedbackId?: string
): Promise<{ approved?: boolean; feedbackId?: string } | null> {
  try {
    // If feedbackId is in the In-Reply-To header, use it
    if (feedbackId) {
      // Check if reply contains approval keywords
      const text = replyText.toLowerCase();
      
      // Look for approval patterns
      const approvalPatterns = [
        /yes[,]?\s*(?:it|this)\s*works?/i,
        /approved?/i,
        /great[,]?\s*(?:it|this)\s*works?/i,
        /looks?\s+good/i,
        /fixed/i,
        /solved/i,
        /thank(?:s|k)\s+you/i,
      ];

      const rejectionPatterns = [
        /no[,]?\s*(?:it|this|needs|doesn't)\s*(?:work|doesn't work)?/i,
        /needs?\s+more/i,
        /still\s+(?:broken|broken|not\s+work)/i,
        /didn't?\s+work/i,
        /not\s+fixed/i,
      ];

      const approved = approvalPatterns.some(p => p.test(text));
      const rejected = rejectionPatterns.some(p => p.test(text));

      if (approved || rejected) {
        return {
          approved: approved,
          feedbackId
        };
      }
    }

    // Try to extract feedback ID and response from text
    // Look for URLs or references to feedback IDs
    const feedbackIdMatch = replyText.match(/feedback[?&]highlight=([a-z0-9]+)/i);
    const responseMatch = replyText.match(/response=([a-z-]+)/i);

    if (feedbackIdMatch) {
      const extractedFeedbackId = feedbackIdMatch[1];
      const responseType = responseMatch?.[1];
      
      if (responseType === 'approved') {
        return { approved: true, feedbackId: extractedFeedbackId };
      } else if (responseType === 'needs-more') {
        return { approved: false, feedbackId: extractedFeedbackId };
      }
    }

    return null;
  } catch (error: any) {
    console.error("[parseFeedbackReply] Failed to parse reply:", error);
    return null;
  }
}

export default router;
