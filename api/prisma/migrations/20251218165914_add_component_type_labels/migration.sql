-- Add componentTypeLabels to TenantSettings for storing display labels per component type
-- This is idempotent and safe to run multiple times

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "componentTypeLabels" JSONB DEFAULT '{}'::jsonb;

-- Create an index for faster lookups if needed
CREATE INDEX IF NOT EXISTS "TenantSettings_componentTypeLabels_idx" ON "TenantSettings" USING gin ("componentTypeLabels");
