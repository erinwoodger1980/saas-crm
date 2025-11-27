// api/src/services/emailProvider.ts
import { prisma } from "../prisma";
import { getGmailTokenForUser, getMs365TokenForUser, sendViaUserGmail, sendViaUserMs365 } from "./user-email";

export interface EmailMessage {
  subject: string;
  to: string;
  cc?: string;
  bcc?: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string[];
  fromName?: string;
}

export interface SentEmailResult {
  messageId: string;
  threadId?: string;
  provider: "gmail" | "ms365";
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<SentEmailResult>;
  fetchReplies(threadId: string): Promise<any[]>;
}

/**
 * Get email provider for a user (Gmail or M365)
 * Prefers Gmail if both are connected
 */
export async function getEmailProviderForUser(userId: string): Promise<EmailProvider | null> {
  // Check Gmail first
  const gmailConn = await (prisma as any).gmailUserConnection.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (gmailConn) {
    return new GmailProvider(userId);
  }

  // Check M365
  const ms365Conn = await (prisma as any).ms365UserConnection.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (ms365Conn) {
    return new Ms365Provider(userId);
  }

  return null;
}

/**
 * Gmail Email Provider
 */
class GmailProvider implements EmailProvider {
  constructor(private userId: string) {}

  async send(message: EmailMessage): Promise<SentEmailResult> {
    // Build RFC822 email
    const { accessToken, email: fromEmail } = await getGmailTokenForUser(this.userId);

    const fromField = message.fromName ? `"${message.fromName}" <${fromEmail}>` : fromEmail;

    const headers = [
      `From: ${fromField}`,
      `To: ${message.to}`,
      ...(message.cc ? [`Cc: ${message.cc}`] : []),
      ...(message.bcc ? [`Bcc: ${message.bcc}`] : []),
      `Subject: ${message.subject}`,
      `MIME-Version: 1.0`,
      ...(message.inReplyTo ? [`In-Reply-To: ${message.inReplyTo}`] : []),
      ...(message.references && message.references.length ? [`References: ${message.references.join(" ")}`] : []),
    ];

    if (message.htmlBody) {
      headers.push(`Content-Type: multipart/alternative; boundary="boundary123"`);
      const body = [
        "",
        "--boundary123",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        message.body,
        "",
        "--boundary123",
        "Content-Type: text/html; charset=UTF-8",
        "",
        message.htmlBody,
        "",
        "--boundary123--",
      ].join("\r\n");
      const rfc822 = [...headers, "", body].join("\r\n");
      await sendViaUserGmail(this.userId, rfc822);
    } else {
      headers.push(`Content-Type: text/plain; charset=UTF-8`);
      const rfc822 = [...headers, "", message.body].join("\r\n");
      await sendViaUserGmail(this.userId, rfc822);
    }

    // Gmail doesn't return messageId from send in our current implementation
    // We'd need to enhance sendViaUserGmail to return the response
    // For now, return a placeholder
    return {
      messageId: `sent-${Date.now()}`,
      provider: "gmail",
    };
  }

  async fetchReplies(threadId: string): Promise<any[]> {
    const { accessToken } = await getGmailTokenForUser(this.userId);

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Gmail fetch thread failed: ${response.statusText}`);
    }

    const thread = await response.json();
    return thread.messages || [];
  }
}

/**
 * MS365 Email Provider
 */
class Ms365Provider implements EmailProvider {
  constructor(private userId: string) {}

  async send(message: EmailMessage): Promise<SentEmailResult> {
    const { accessToken, email: fromEmail } = await getMs365TokenForUser(this.userId);

    const graphMessage: any = {
      message: {
        subject: message.subject,
        body: {
          contentType: message.htmlBody ? "HTML" : "Text",
          content: message.htmlBody || message.body,
        },
        toRecipients: message.to.split(",").map((addr) => ({
          emailAddress: { address: addr.trim() },
        })),
      },
      saveToSentItems: true,
    };

    // Set from name if provided
    if (message.fromName) {
      graphMessage.message.from = {
        emailAddress: {
          name: message.fromName,
          address: fromEmail,
        },
      };
    }

    if (message.cc) {
      graphMessage.message.ccRecipients = message.cc.split(",").map((addr) => ({
        emailAddress: { address: addr.trim() },
      }));
    }

    if (message.bcc) {
      graphMessage.message.bccRecipients = message.bcc.split(",").map((addr) => ({
        emailAddress: { address: addr.trim() },
      }));
    }

    // MS Graph API: send mail
    const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphMessage),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MS365 send failed: ${error}`);
    }

    // MS Graph sendMail doesn't return the sent message
    // We'd need to query Sent Items to get the messageId
    return {
      messageId: `sent-${Date.now()}`,
      provider: "ms365",
    };
  }

  async fetchReplies(conversationId: string): Promise<any[]> {
    const { accessToken } = await getMs365TokenForUser(this.userId);

    // Fetch messages in conversation
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${conversationId}'&$orderby=receivedDateTime asc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`MS365 fetch conversation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.value || [];
  }
}

/**
 * Enhanced send functions that return messageId and threadId
 */
export async function enhancedSendViaUserGmail(
  userId: string,
  rfc822: string
): Promise<{ messageId: string; threadId?: string }> {
  const { accessToken } = await getGmailTokenForUser(userId);

  const raw = Buffer.from(rfc822)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || res.statusText);
  }

  return {
    messageId: json.id,
    threadId: json.threadId,
  };
}

export async function enhancedSendViaUserMs365(
  userId: string,
  message: any
): Promise<{ messageId: string; conversationId?: string }> {
  const { accessToken } = await getMs365TokenForUser(userId);

  // First, create draft
  const draftResponse = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!draftResponse.ok) {
    const error = await draftResponse.text();
    throw new Error(`MS365 create draft failed: ${error}`);
  }

  const draft = await draftResponse.json();
  const messageId = draft.id;

  // Then send the draft
  const sendResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!sendResponse.ok) {
    const error = await sendResponse.text();
    throw new Error(`MS365 send failed: ${error}`);
  }

  return {
    messageId,
    conversationId: draft.conversationId,
  };
}
