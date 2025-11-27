// Stub implementation - full features disabled for production deployment
export interface LeadContext {
  leadId: string;
  tenantId: string;
  userId: string;
  contactName: string;
  email: string;
  threadId?: string;
  messageId?: string;
  subject?: string;
  snippet?: string;
}

export async function handleNewLeadFromEmail(context: LeadContext): Promise<void> {
  // Disabled: Schema fields not available in production
  return;
}

export async function createQuoteFollowUpSchedule(params: any): Promise<void> {
  // Disabled: Schema fields not available in production
  return;
}

export async function createQuestionnaireFollowUpSchedule(params: any): Promise<void> {
  // Disabled: Schema fields not available in production
  return;
}

export async function getSuggestedActions(taskId: string, userId: string): Promise<any> {
  // Disabled: Schema fields not available in production
  return { actions: [] };
}

export async function processReply(params: any): Promise<void> {
  // Disabled: Schema fields not available in production
  return;
}
