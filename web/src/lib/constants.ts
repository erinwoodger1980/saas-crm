export const DEFAULT_QUESTIONNAIRE_EMAIL_SUBJECT = "Questionnaire for your estimate";
export const DEFAULT_QUESTIONNAIRE_EMAIL_BODY = `Hi {{contactName}},\n\nPlease fill in this short questionnaire so we can prepare your estimate:\n{{link}}\n\nThanks,\n{{brandName}}`;

// Default email templates
export const DEFAULT_EMAIL_TEMPLATES = {
  declineQuote: {
    subject: "Re: Your Quote Request - {{brandName}}",
    body: `Hi {{contactName}},\n\nThank you for your interest in {{brandName}}.\n\nUnfortunately, we won't be able to provide a quote for this project as it falls outside our current service area/expertise.\n\nWe appreciate you thinking of us and wish you the best with your project.\n\nBest regards,\n{{ownerName}}\n{{brandName}}\n{{phone}}`
  },
  requestSupplierQuote: {
    subject: "Quote Request - {{projectName}}",
    body: `Hi there,\n\nWe have a project that might be a good fit for your services.\n\nProject: {{projectName}}\nClient: {{contactName}}\nDeadline: {{deadline}}\n\nProject Details:\n{{projectDescription}}\n\nCould you please provide a quote for this work?\n\nRequired by: {{quoteDeadline}}\n\nThanks,\n{{ownerName}}\n{{brandName}}\n{{phone}}`
  },
  sendQuestionnaire: {
    subject: "Questionnaire for your estimate - {{brandName}}",
    body: `Hi {{contactName}},\n\nThank you for your interest in {{brandName}}.\n\nTo provide you with an accurate estimate, please complete this short questionnaire:\n{{questionnaireLink}}\n\nOnce completed, we'll prepare your personalised quote within 2-3 business days.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\n{{ownerName}}\n{{brandName}}\n{{phone}}`
  },
  sendQuote: {
    subject: "Your Quote is Ready - {{brandName}}",
    body: `Hi {{contactName}},\n\nThank you for completing our questionnaire.\n\nYour personalised quote is now ready: {{quoteLink}}\n\nQuote Summary:\n- Project: {{projectName}}\n- Total: {{quoteTotal}}\n- Valid until: {{quoteExpiry}}\n\nIf you have any questions about this quote, please don't hesitate to contact me.\n\nLooking forward to working with you!\n\nBest regards,\n{{ownerName}}\n{{brandName}}\n{{phone}}`
  },
  followUpEmail: {
    subject: "Following up on your quote - {{brandName}}",
    body: `Hi {{contactName}},\n\nI hope this email finds you well.\n\nI wanted to follow up on the quote we sent for {{projectName}} on {{quoteDate}}.\n\nDo you have any questions about the proposal? I'm happy to discuss any aspects of the project or adjust the quote if needed.\n\nThe quote is valid until {{quoteExpiry}}, so please let me know if you'd like to proceed or if you need any clarifications.\n\nBest regards,\n{{ownerName}}\n{{brandName}}\n{{phone}}`
  },
  quoteApproved: {
    subject: "Thank you for approving your quote! - {{brandName}}",
    body: `Hi {{contactName}},\n\nFantastic news! Thank you for approving the quote for {{projectName}}.\n\nNext Steps:\n1. We'll send you a formal contract within 24 hours\n2. Project start date: {{startDate}}\n3. Expected completion: {{completionDate}}\n\nI'll be in touch soon with the contract and project timeline.\n\nThank you for choosing {{brandName}}. We're excited to work with you!\n\nBest regards,\n{{ownerName}}\n{{brandName}}\n{{phone}}`
  },
  quoteRejected: {
    subject: "Thank you for considering {{brandName}}",
    body: `Hi {{contactName}},\n\nThank you for taking the time to consider {{brandName}} for {{projectName}}.\n\nWhile we're disappointed we won't be working together on this project, we understand that you need to choose the best fit for your needs.\n\nIf your requirements change or you have future projects, please don't hesitate to reach out. We'd be happy to help.\n\nWishing you the best with your project.\n\nKind regards,\n{{ownerName}}\n{{brandName}}\n{{phone}}`
  }
};