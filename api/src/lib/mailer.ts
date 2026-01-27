import nodemailer from "nodemailer";
import { ENV } from "./env";

export function hasSmtp() {
  return !!(ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS);
}

function getTransporter() {
  if (!hasSmtp()) throw new Error("SMTP not configured");
  return nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    secure: ENV.SMTP_SECURE,
    auth: { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS },
  });
}

/**
 * Generic email sending function
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  if (!hasSmtp()) {
    console.warn("[mailer] SMTP not configured, skipping email to:", options.to);
    return;
  }
  
  const transporter = getTransporter();
  await transporter.sendMail({
    from: options.from || `JoineryAI <${ENV.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  console.log(`[mailer] Email sent to ${options.to}: ${options.subject}`);
}

export async function sendLeadEmail(payload: any) {
  const toList = (() => {
    const raw = payload?.to ?? payload?.toEmails ?? ENV.SALES_NOTIFY_EMAIL;
    if (!raw) return [] as string[];
    if (Array.isArray(raw)) {
      return raw
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .filter((e) => /.+@.+\..+/.test(e));
    }
    return String(raw)
      .split(/[;,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean)
      .filter((e) => /.+@.+\..+/.test(e));
  })();

  if (!hasSmtp() || toList.length === 0) return;
  const html = `
    <h2>New Lead (${payload.source})</h2>
    <p><strong>Name:</strong> ${payload.name}</p>
    <p><strong>Email:</strong> ${payload.email}</p>
    <p><strong>Phone:</strong> ${payload.phone}</p>
    <p><strong>Postcode:</strong> ${payload.postcode}</p>
    <p><strong>Project:</strong> ${payload.projectType} / ${payload.propertyType}</p>
    <p><strong>Message:</strong> ${payload.message || ""}</p>
  `;
  await sendEmail({
    to: toList.join(", "),
    subject: `New Lead: ${payload.name} (${payload.source})`,
    html,
    from: `Leads <${ENV.SMTP_USER}>`,
  });
}
