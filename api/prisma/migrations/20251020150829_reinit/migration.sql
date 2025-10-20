-- Rebuild TenantSettings beta column without dropping existing data.
-- Prior versions of this migration attempted to recreate the entire schema and
-- failed once the database already contained the tables and enum types. The
-- deploy step now only ensures the new "beta" JSON column exists.

DO $$
DECLARE
  tenant_settings_missing boolean;
  beta_missing boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'TenantSettings'
  )
  INTO tenant_settings_missing;

  IF tenant_settings_missing THEN
    RAISE NOTICE 'TenantSettings table missing; skipping beta column migration.';
    RETURN;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TenantSettings'
      AND column_name = 'beta'
  )
  INTO beta_missing;

  IF beta_missing THEN
    EXECUTE 'ALTER TABLE "TenantSettings" ADD COLUMN "beta" JSONB NOT NULL DEFAULT ''{}''::JSONB';
  ELSE
    EXECUTE 'ALTER TABLE "TenantSettings" ALTER COLUMN "beta" TYPE JSONB USING COALESCE("beta", ''{}''::JSONB)';
    EXECUTE 'ALTER TABLE "TenantSettings" ALTER COLUMN "beta" SET DEFAULT ''{}''::JSONB';
  END IF;

  EXECUTE 'UPDATE "TenantSettings" SET "beta" = COALESCE("beta", ''{}''::JSONB)';
END $$;
