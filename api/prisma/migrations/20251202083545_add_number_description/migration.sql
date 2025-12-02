-- Add number field to Lead table (description already exists)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "number" TEXT;

-- Add number and description fields to Opportunity table
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "description" TEXT;
