BEGIN;

-- Add JSON defaults for quoting (safe if it already exists)
ALTER TABLE "TenantSettings"
  ADD COLUMN IF NOT EXISTS "quoteDefaults" JSONB;

-- Add updatedAt with a safe default so existing rows pass NOT NULL
ALTER TABLE "TenantSettings"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMIT;
