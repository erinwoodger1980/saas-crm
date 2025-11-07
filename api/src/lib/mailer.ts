import nodemailer from "nodemailer";
import { ENV } from "./env";

export function hasSmtp() {
  return !!(ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS && ENV.SALES_NOTIFY_EMAIL);
}

export async function sendLeadEmail(payload: any) {
  if (!hasSmtp()) return;
  const transporter = nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    secure: ENV.SMTP_SECURE,
    auth: { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS },
  });
  const html = `
    <h2>New Lead (${payload.source})</h2>
    <p><strong>Name:</strong> ${payload.name}</p>
    <p><strong>Email:</strong> ${payload.email}</p>
    <p><strong>Phone:</strong> ${payload.phone}</p>
    <p><strong>Postcode:</strong> ${payload.postcode}</p>
    <p><strong>Project:</strong> ${payload.projectType} / ${payload.propertyType}</p>
    <p><strong>Message:</strong> ${payload.message || ""}</p>
  `;
  await transporter.sendMail({
    from: `Leads <${ENV.SMTP_USER}>`,
    to: ENV.SALES_NOTIFY_EMAIL,
    subject: `New Lead: ${payload.name} (${payload.source})`,
    html,
  });
}
