// api/src/services/email-sender.ts
import { prisma } from "../prisma";
import { getGmailTokenForUser, getMs365TokenForUser, sendViaUserGmail, sendViaUserMs365 } from "./user-email";
import { appendJoineryAiFooterHtml, appendJoineryAiFooterText } from "./email-branding";

interface EmailAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  fromName?: string;
  attachments?: EmailAttachment[];
}

/**
 * Determines which email provider is configured for a user
 */
async function getUserEmailProvider(userId: string): Promise<'gmail' | 'ms365' | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      gmailUserConnection: true,
      ms365UserConnection: true,
    },
  });

  if (!user) return null;
  if (user.gmailUserConnection) return 'gmail';
  if (user.ms365UserConnection) return 'ms365';
  return null;
}

/**
 * Sends an email using the user's connected email provider (Gmail or MS365)
 */
export async function sendEmailViaUser(userId: string, options: EmailOptions): Promise<void> {
  const branded: EmailOptions = {
    ...options,
    body: appendJoineryAiFooterText(options.body),
    html: options.html ? appendJoineryAiFooterHtml(options.html) : undefined,
  };

  if (process.env.EMAIL_PROVIDER === "mock" || process.env.NODE_ENV === "test") {
    console.log("[email-sender] Mock provider enabled, email not sent:", {
      to: branded.to,
      subject: branded.subject,
      attachmentCount: branded.attachments?.length || 0,
    });
    return;
  }

  const provider = await getUserEmailProvider(userId);

  if (!provider) {
    console.warn(`[email-sender] No email provider configured for user ${userId}`);
    throw new Error("No email provider configured for this user");
  }

  if (provider === 'gmail') {
    await sendViaGmail(userId, branded);
  } else if (provider === 'ms365') {
    await sendViaMs365(userId, branded);
  }
}

/**
 * Legacy: Send email via tenant's email (for backward compatibility)
 * Now tries to use the first available admin user's email
 */
export async function sendEmailViaTenant(tenantId: string, options: EmailOptions): Promise<void> {
  // Find first admin user with email connection
  const adminUser = await prisma.user.findFirst({
    where: {
      tenantId,
      role: { in: ['admin', 'owner'] },
      OR: [
        { gmailUserConnection: { isNot: null } },
        { ms365UserConnection: { isNot: null } },
      ],
    },
    include: {
      gmailUserConnection: true,
      ms365UserConnection: true,
    },
  });

  if (!adminUser) {
    throw new Error("No admin users with email configured for this tenant");
  }

  await sendEmailViaUser(adminUser.id, options);
}

/**
 * Send email via Gmail
 */
async function sendViaGmail(userId: string, options: EmailOptions): Promise<void> {
  const { email: fromEmail } = await getGmailTokenForUser(userId);
  
  // Get user details for from name
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });
  
  const fromName = options.fromName || user?.name || user?.tenant?.name || 'JoineryAI';
  const fromHeader = `${fromName} <${fromEmail}>`;

  // Build RFC822 email
  const rfc822 = buildRFC822Email({
    from: fromHeader,
    to: options.to,
    subject: options.subject,
    body: options.body,
    html: options.html,
    attachments: options.attachments,
  });

  await sendViaUserGmail(userId, rfc822);
  console.log(`[email-sender] Gmail email sent to ${options.to} from user ${userId}`);
}

/**
 * Send email via Microsoft 365 / Outlook
 */
async function sendViaMs365(userId: string, options: EmailOptions): Promise<void> {
  const { email: fromEmail } = await getMs365TokenForUser(userId);
  
  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  // Build email message using Microsoft Graph API format
  const message = {
    message: {
      subject: options.subject,
      body: {
        contentType: options.html ? "HTML" : "Text",
        content: options.html || options.body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: options.to,
          },
        },
      ],
      attachments: Array.isArray(options.attachments)
        ? options.attachments.map((att) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: att.filename,
            contentType: att.contentType,
            contentBytes: att.contentBase64,
          }))
        : undefined,
      from: {
        emailAddress: {
          address: fromEmail,
          name: options.fromName || user?.name || user?.tenant?.name || 'JoineryAI',
        },
      },
    },
  };

  await sendViaUserMs365(userId, message);
  console.log(`[email-sender] MS365 email sent to ${options.to} from user ${userId}`);
}

/**
 * Build RFC822 formatted email for Gmail
 */
function buildRFC822Email(options: {
  from: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: EmailAttachment[];
}): string {
  const attachments = Array.isArray(options.attachments) ? options.attachments : [];
  const hasAttachments = attachments.length > 0;

  if (hasAttachments) {
    const mixedBoundary = `----=_JoineryAI_Mixed_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const altBoundary = `----=_JoineryAI_Alt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const alternativePart = (
      `--${mixedBoundary}\r\n` +
      `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n` +
      `--${altBoundary}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${options.body}\r\n\r\n` +
      `--${altBoundary}\r\n` +
      `Content-Type: text/html; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${options.html || options.body}\r\n\r\n` +
      `--${altBoundary}--\r\n`
    );

    const attachmentParts = attachments
      .map((att) => {
        const safeName = att.filename.replace(/[\r\n]/g, "");
        return (
          `--${mixedBoundary}\r\n` +
          `Content-Type: ${att.contentType}; name="${safeName}"\r\n` +
          `Content-Transfer-Encoding: base64\r\n` +
          `Content-Disposition: attachment; filename="${safeName}"\r\n\r\n` +
          `${att.contentBase64}\r\n`
        );
      })
      .join("");

    return (
      `From: ${options.from}\r\n` +
      `To: ${options.to}\r\n` +
      `Subject: ${options.subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"\r\n\r\n` +
      `${alternativePart}` +
      `${attachmentParts}` +
      `--${mixedBoundary}--\r\n`
    );
  }

  if (options.html) {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return (
      `From: ${options.from}\r\n` +
      `To: ${options.to}\r\n` +
      `Subject: ${options.subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${options.body}\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${options.html}\r\n\r\n` +
      `--${boundary}--\r\n`
    );
  }

  return (
    `From: ${options.from}\r\n` +
    `To: ${options.to}\r\n` +
    `Subject: ${options.subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: 7bit\r\n\r\n` +
    `${options.body}\r\n`
  );
}

/**
 * Convert HTML to plain text (basic implementation)
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
