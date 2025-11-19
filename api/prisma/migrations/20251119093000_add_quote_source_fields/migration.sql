-- Add quote source classification columns (idempotent)
-- This migration is safe to run on environments where columns may already exist.

ALTER TABLE "Quote"
ADD COLUMN IF NOT EXISTS "quoteSourceType" TEXT DEFAULT 'supplier';

ALTER TABLE "Quote"
ADD COLUMN IF NOT EXISTS "supplierProfileId" TEXT DEFAULT 'generic_supplier';

-- Index for faster supplier profile filtering (declared in schema as @@index([supplierProfileId]))
CREATE INDEX IF NOT EXISTS "Quote_supplierProfileId_idx" ON "Quote"("supplierProfileId");

-- Backfill nulls to defaults if existing rows lack values (optional safety)
UPDATE "Quote" SET "quoteSourceType" = COALESCE("quoteSourceType", 'supplier');
UPDATE "Quote" SET "supplierProfileId" = COALESCE("supplierProfileId", 'generic_supplier');
