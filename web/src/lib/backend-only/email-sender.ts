// Minimal server-side email sender stub to keep public estimate-submit route working in builds.
// In production, replace with actual tenant-aware email delivery (e.g., SMTP/OAuth provider).

export type TenantEmailPayload = {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  fromName?: string;
};

export async function sendEmailViaTenant(
  tenantId: string,
  payload: TenantEmailPayload
): Promise<{ ok: boolean }>
{
  // eslint-disable-next-line no-console
  console.log("[email-sender] Stubbed sendEmailViaTenant", { tenantId, to: payload.to, subject: payload.subject });
  // TODO: integrate real email provider (Gmail/MS365/SMTP) per tenant
  return { ok: true };
}
