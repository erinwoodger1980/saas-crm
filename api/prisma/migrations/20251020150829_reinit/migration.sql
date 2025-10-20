-- Ensure the TenantSettings beta column exists without rebuilding the schema.
-- Earlier versions attempted to recreate the public schema and failed once
-- tables already existed, so this migration simply enforces the JSONB column
-- with a default and NOT NULL constraint.

ALTER TABLE "TenantSettings"
ADD COLUMN IF NOT EXISTS "beta" JSONB DEFAULT '{}'::jsonb;

UPDATE "TenantSettings"
SET "beta" = '{}'::jsonb
WHERE "beta" IS NULL;

ALTER TABLE "TenantSettings"
ALTER COLUMN "beta" SET NOT NULL;

ALTER TABLE "TenantSettings"
ALTER COLUMN "beta" SET DEFAULT '{}'::jsonb;
