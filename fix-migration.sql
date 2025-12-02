-- First, let's ensure the columns exist (safe to run even if they already exist)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Now mark the migration as completed in the _prisma_migrations table
-- This tells Prisma that the migration was successfully applied
UPDATE "_prisma_migrations" 
SET finished_at = NOW(), 
    applied_steps_count = 1
WHERE migration_name = '20251202083545_add_number_description' 
  AND finished_at IS NULL;
