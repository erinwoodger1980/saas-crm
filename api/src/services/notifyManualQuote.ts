import { prisma } from '../prisma';
// Avoid strict typed env access for optional SMTP vars; use process.env directly.
import nodemailer from 'nodemailer';

interface NotifyInput {
  leadId: string;
  tenantId: string;
  reason: string;
  scope: 'create' | 'update';
}

// Very lightweight notification service; in production replace with queue/event bus.
export async function notifyManualQuote(input: NotifyInput) {
  // Attempt to load tenant + lead minimal info
  const [tenant, lead] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: input.tenantId }, select: { name: true, slug: true } }),
    prisma.lead.findUnique({ where: { id: input.leadId }, select: { contactName: true, email: true, id: true } }),
  ]);

  const contact = lead?.contactName || 'Lead';
  const tenantName = tenant?.name || 'Tenant';

  const subject = `[Manual Quote] ${tenantName} – Review required for ${contact}`;
  const body = `Manual quote flag set (${input.scope}).\nReason: ${input.reason}\nLead ID: ${input.leadId}\nTenant: ${tenantName}\nContact: ${contact}\nEmail: ${lead?.email || 'N/A'}\nTimestamp: ${new Date().toISOString()}`;

  // Persist an internal log row (fallback if email fails)
  try {
    await prisma.followUpLog.create({
      data: {
        tenantId: input.tenantId,
        leadId: input.leadId,
        variant: 'manual_quote_flag',
        subject: 'Manual Quote Flag',
        body,
        channel: 'SYSTEM',
      },
    });
  } catch (e) {
    console.warn('[notifyManualQuote] failed to log followUp:', (e as any)?.message || e);
  }

  // Optional: email notification if SMTP configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const toListRaw = process.env.MANUAL_QUOTE_ALERT_EMAILS;
  const toList = typeof toListRaw === 'string' ? toListRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];

  if (smtpHost && smtpUser && smtpPass && toList.length) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `${tenantName} <no-reply@${tenant?.slug || 'example'}.app>`,
        to: toList,
        subject,
        text: body,
      });
    } catch (e) {
      console.warn('[notifyManualQuote] email send failed:', (e as any)?.message || e);
    }
  }
}
