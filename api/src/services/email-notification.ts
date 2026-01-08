// api/src/services/email-notification.ts
import nodemailer from "nodemailer";
import { env } from "../env";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email via SMTP (used for admin notifications)
 */
export async function sendAdminEmail(options: EmailOptions): Promise<void> {
  // Prefer Resend if configured
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = require("resend");
      const resend = new Resend(resendKey);
      const from = process.env.EMAIL_FROM || "JoineryAI Notifications <noreply@joineryai.app>";
      await resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
      });
      console.log(`[email-notification] Resend email sent to ${options.to}: ${options.subject}`);
      return;
    } catch (e: any) {
      console.warn("[email-notification] Resend send failed, falling back to SMTP:", e?.message || e);
    }
  }

  // Fallback to SMTP if available
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("[email-notification] SMTP not configured, and Resend unavailable. Skipping email send.");
    return;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  try {
    await transporter.sendMail({
      from: `"JoineryAI Notifications" <${SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    });
    console.log(`[email-notification] SMTP email sent to ${options.to}: ${options.subject}`);
  } catch (error: any) {
    console.error("[email-notification] Failed to send SMTP email:", error.message);
    throw error;
  }
}

/**
 * Send feedback notification to admin
 */
export async function sendFeedbackNotification(params: {
  tenantName: string;
  tenantId: string;
  userName?: string;
  userEmail?: string;
  feature: string;
  rating?: number;
  comment?: string;
  sourceUrl?: string;
  createdAt: Date;
}): Promise<void> {
  const subject = `New Feedback: ${params.feature} - ${params.tenantName}`;
  
  const ratingStars = params.rating ? "⭐".repeat(params.rating) : "No rating";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; }
        .value { margin-top: 4px; font-size: 14px; }
        .rating { font-size: 20px; }
        .comment { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6; margin-top: 10px; }
        .footer { padding: 15px; text-align: center; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">📬 New Feedback Received</h2>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Tenant</div>
            <div class="value">${params.tenantName} (${params.tenantId})</div>
          </div>
          
          ${params.userName || params.userEmail ? `
          <div class="field">
            <div class="label">From</div>
            <div class="value">
              ${params.userName || "Unknown User"}
              ${params.userEmail ? `<br/><a href="mailto:${params.userEmail}">${params.userEmail}</a>` : ""}
            </div>
          </div>
          ` : ""}
          
          <div class="field">
            <div class="label">Feature</div>
            <div class="value">${params.feature}</div>
          </div>
          
          ${params.rating ? `
          <div class="field">
            <div class="label">Rating</div>
            <div class="value rating">${ratingStars} (${params.rating}/5)</div>
          </div>
          ` : ""}
          
          ${params.comment ? `
          <div class="field">
            <div class="label">Comment</div>
            <div class="comment">${escapeHtml(params.comment)}</div>
          </div>
          ` : ""}
          
          ${params.sourceUrl ? `
          <div class="field">
            <div class="label">Source URL</div>
            <div class="value"><a href="${params.sourceUrl}">${params.sourceUrl}</a></div>
          </div>
          ` : ""}
          
          <div class="field">
            <div class="label">Submitted</div>
            <div class="value">${formatDate(params.createdAt)}</div>
          </div>
        </div>
        <div class="footer">
          JoineryAI - Feedback Notification System
        </div>
      </div>
    </body>
    </html>
  `;

  await sendAdminEmail({
    to: "erin@erinwoodger.com",
    subject,
    html,
  });
}

/**
 * Basic HTML stripping for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br/>");
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}
