-- Migrate legacy text quoteSourceType column to Postgres enum that matches Prisma schema
-- Safe, idempotent-ish: checks for existing enum type before creating.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuoteSourceType') THEN
    CREATE TYPE "QuoteSourceType" AS ENUM ('SUPPLIER', 'USER_SOFTWARE');
  END IF;
END $$;

-- Normalise existing lowercase values and null out invalid ones prior to type change
UPDATE "Quote"
SET "quoteSourceType" = CASE
  WHEN lower("quoteSourceType") = 'supplier' THEN 'SUPPLIER'
  WHEN lower("quoteSourceType") = 'user_software' THEN 'USER_SOFTWARE'
  ELSE NULL
END
WHERE "quoteSourceType" IS NOT NULL;

-- Drop legacy default that used lowercase text
ALTER TABLE "Quote" ALTER COLUMN "quoteSourceType" DROP DEFAULT;

-- Convert column type using safe CASE mapping
ALTER TABLE "Quote"
ALTER COLUMN "quoteSourceType" TYPE "QuoteSourceType"
USING CASE
  WHEN lower("quoteSourceType") = 'supplier' THEN 'SUPPLIER'::"QuoteSourceType"
  WHEN lower("quoteSourceType") = 'user_software' THEN 'USER_SOFTWARE'::"QuoteSourceType"
  ELSE NULL
END;

-- Optional: do not set a new default (keep NULL unless explicitly classified)
-- VERIFY: If you prefer a default classification uncomment below
-- ALTER TABLE "Quote" ALTER COLUMN "quoteSourceType" SET DEFAULT NULL;

-- Clean up any rows that still have stray lowercase values (defensive)
UPDATE "Quote" SET "quoteSourceType" = NULL WHERE "quoteSourceType" NOT IN ('SUPPLIER','USER_SOFTWARE');

-- Provide quick insight into distribution after migration (non-fatal if fails)
DO $$ BEGIN
  BEGIN
    RAISE NOTICE 'QuoteSourceType distribution after migration:';
    PERFORM 1 FROM "Quote" LIMIT 1; -- ensure table exists
    -- Using dynamic SQL to avoid errors if enum not applied (unlikely)
    EXECUTE 'SELECT "quoteSourceType", COUNT(*) FROM "Quote" GROUP BY "quoteSourceType"';
  EXCEPTION WHEN others THEN
    -- swallow
  END;
END $$;