-- Add missing enum values for follow-up features
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAD_SUGGESTION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUOTE_FOLLOWUP_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUESTIONNAIRE_FOLLOWUP_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_REPLY';

ALTER TYPE "RelatedType" ADD VALUE IF NOT EXISTS 'OPPORTUNITY';

-- Add emailBodyTemplate field to FollowUpRule
ALTER TABLE "FollowUpRule" ADD COLUMN IF NOT EXISTS "emailBodyTemplate" TEXT;

-- Add ruleId field to FollowUpHistory for analytics grouping
ALTER TABLE "FollowUpHistory" ADD COLUMN IF NOT EXISTS "ruleId" TEXT;
