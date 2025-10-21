export type DeclineEmailTemplate = {
  subject: string;
  body: string;
};

export const DEFAULT_DECLINE_EMAIL_TEMPLATE: DeclineEmailTemplate = {
  subject: "Re: [Project Name or Address] – Quotation Request",
  body: `Hi [Client’s Name],\n\nThank you so much for thinking of us for your project.\nAfter looking through the details, we’ve decided not to provide a quotation this time. It’s a lovely project, but it’s not quite the right fit for our current workload and focus.\n\nWe really appreciate you getting in touch and wish you every success moving forward. Please do keep us in mind for any future projects that might be a better match — we’d be very happy to take another look.\n\nAll the best,\n[Your Name]\n[Your Position]\n[Company Name]\n[Phone Number]\n[Email / Website]`,
};

export function normalizeDeclineEmailTemplate(
  template?: Partial<DeclineEmailTemplate> | null
): DeclineEmailTemplate {
  const subject =
    typeof template?.subject === "string" && template.subject.trim().length > 0
      ? template.subject
      : DEFAULT_DECLINE_EMAIL_TEMPLATE.subject;
  const body =
    typeof template?.body === "string" && template.body.trim().length > 0
      ? template.body
      : DEFAULT_DECLINE_EMAIL_TEMPLATE.body;

  return { subject, body };
}
