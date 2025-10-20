-- Ensure the TenantSettings beta column exists without rebuilding the entire schema.
-- Earlier versions of this migration attempted to recreate the public schema and
-- conflicted once tables already existed. This version keeps the column update
-- idempotent so repeated deploys succeed even if the column is already present.

ALTER TABLE "TenantSettings"
ADD COLUMN IF NOT EXISTS "beta" JSONB DEFAULT '{}'::jsonb;

UPDATE "TenantSettings"
SET "beta" = '{}'::jsonb
WHERE "beta" IS NULL;

ALTER TABLE "TenantSettings"
ALTER COLUMN "beta" SET NOT NULL;

ALTER TABLE "TenantSettings"
ALTER COLUMN "beta" SET DEFAULT '{}'::jsonb;
