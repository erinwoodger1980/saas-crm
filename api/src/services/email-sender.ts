// api/src/services/email-sender.ts
import { prisma } from "../prisma";
import { getAccessTokenForTenant as getGmailToken, gmailSend } from "./gmail";
import { getAccessTokenForTenant as getMs365Token } from "./ms365";

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  fromName?: string;
}

/**
 * Determines which email provider is configured for a tenant
 */
async function getTenantEmailProvider(tenantId: string): Promise<'gmail' | 'ms365' | null> {
  const [gmailConn, ms365Conn] = await Promise.all([
    prisma.gmailTenantConnection.findUnique({ where: { tenantId } }),
    prisma.ms365TenantConnection.findUnique({ where: { tenantId } }),
  ]);

  if (gmailConn) return 'gmail';
  if (ms365Conn) return 'ms365';
  return null;
}

/**
 * Sends an email using the tenant's connected email provider (Gmail or MS365)
 */
export async function sendEmailViaTenant(tenantId: string, options: EmailOptions): Promise<void> {
  const provider = await getTenantEmailProvider(tenantId);

  if (!provider) {
    console.warn(`[email-sender] No email provider configured for tenant ${tenantId}`);
    throw new Error("No email provider configured for this tenant");
  }

  if (provider === 'gmail') {
    await sendViaGmail(tenantId, options);
  } else if (provider === 'ms365') {
    await sendViaMs365(tenantId, options);
  }
}

/**
 * Send email via Gmail
 */
async function sendViaGmail(tenantId: string, options: EmailOptions): Promise<void> {
  const accessToken = await getGmailToken(tenantId);
  
  // Get tenant's email address for From header
  const tenant = await prisma.tenant.findUnique({ 
    where: { id: tenantId },
    include: { GmailTenantConnection: true }
  });
  
  const fromEmail = tenant?.GmailTenantConnection?.gmailAddress || 'noreply@joineryai.app';
  const fromName = options.fromName || tenant?.name || 'JoineryAI';
  const fromHeader = `${fromName} <${fromEmail}>`;

  // Build RFC822 email
  const rfc822 = buildRFC822Email({
    from: fromHeader,
    to: options.to,
    subject: options.subject,
    body: options.body,
    html: options.html,
  });

  await gmailSend(accessToken, rfc822);
  console.log(`[email-sender] Gmail email sent to ${options.to} from tenant ${tenantId}`);
}

/**
 * Send email via Microsoft 365 / Outlook
 */
async function sendViaMs365(tenantId: string, options: EmailOptions): Promise<void> {
  const accessToken = await getMs365Token(tenantId);
  
  // Get tenant's email address
  const tenant = await prisma.tenant.findUnique({ 
    where: { id: tenantId },
    include: { Ms365TenantConnection: true }
  });
  
  const fromEmail = tenant?.Ms365TenantConnection?.ms365Address || 'noreply@joineryai.app';

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
      from: {
        emailAddress: {
          address: fromEmail,
          name: options.fromName || tenant?.name || 'JoineryAI',
        },
      },
    },
  };

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MS365 send failed: ${error}`);
  }

  console.log(`[email-sender] MS365 email sent to ${options.to} from tenant ${tenantId}`);
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
}): string {
  if (options.html) {
    // Multipart email with both plain text and HTML
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
  } else {
    // Plain text email
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
