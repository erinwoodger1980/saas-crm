-- Add componentTypeLabels to TenantSettings
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "componentTypeLabels" JSONB DEFAULT '{}'::jsonb;
