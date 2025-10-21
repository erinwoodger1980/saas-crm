// web/src/lib/decline-email.ts
export type DeclineEmailTemplate = { subject: string; body: string };

export const DEFAULT_DECLINE_EMAIL_TEMPLATE: DeclineEmailTemplate = {
  subject: "Re: [Project Name or Address] – Quotation Request",
  body: [
    "Hi [Client’s Name],",
    "",
    "Thank you so much for thinking of us for your project.",
    "After looking through the details, we’ve decided not to provide a quotation this time. It’s a lovely project, but it’s not quite the right fit for our current workload and focus.",
    "",
    "We really appreciate you getting in touch and wish you every success moving forward. Please do keep us in mind for any future projects that might be a better match — we’d be very happy to take another look.",
    "",
    "All the best,",
    "[Your Name]",
    "[Your Position]",
    "[Company Name]",
    "[Phone Number]",
    "[Email / Website]",
  ].join("\n"),
};

export function normalizeDeclineEmailTemplate(
  input?: Partial<DeclineEmailTemplate> | null,
): DeclineEmailTemplate {
  const base = DEFAULT_DECLINE_EMAIL_TEMPLATE;
  return {
    subject: (input?.subject ?? "").trim() || base.subject,
    body: (input?.body ?? "").trim() || base.body,
  };
}

export function personalizeDeclineTemplate(
  template: DeclineEmailTemplate,
  vars: Record<string, string | undefined>,
): DeclineEmailTemplate {
  const replaceAll = (value: string) =>
    value
      .replaceAll("[Project Name or Address]", vars.project || "")
      .replaceAll("[Client’s Name]", vars.clientName || "")
      .replaceAll("[Your Name]", vars.yourName || "")
      .replaceAll("[Your Position]", vars.yourPosition || "")
      .replaceAll("[Company Name]", vars.company || "")
      .replaceAll("[Phone Number]", vars.phone || "")
      .replaceAll("[Email / Website]", vars.emailOrSite || "");

  return {
    subject: replaceAll(template.subject),
    body: replaceAll(template.body),
  };
}
