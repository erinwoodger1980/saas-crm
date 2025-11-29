-- Rebuild TenantSettings beta column without dropping existing data.
-- Prior versions of this migration attempted to recreate the entire schema and
-- failed once the database already contained the tables and enum types. The
-- deploy step now only ensures the new "beta" JSON column exists.

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.tables 
		WHERE table_schema = 'public' AND table_name = 'TenantSettings'
	) THEN
		ALTER TABLE "TenantSettings"
		ADD COLUMN IF NOT EXISTS "beta" JSONB DEFAULT '{}'::jsonb;

		UPDATE "TenantSettings"
		SET "beta" = '{}'::jsonb
		WHERE "beta" IS NULL;

		ALTER TABLE "TenantSettings"
		ALTER COLUMN "beta" SET NOT NULL;

		ALTER TABLE "TenantSettings"
		ALTER COLUMN "beta" SET DEFAULT '{}'::jsonb;
	ELSE
		RAISE NOTICE 'Skipping beta column migration – TenantSettings table not present.';
	END IF;
END $$;
