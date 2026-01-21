-- Add Notification Emails configuration to tenant settings

ALTER TABLE "TenantSettings"
ADD COLUMN IF NOT EXISTS "notificationEmails" JSONB;
