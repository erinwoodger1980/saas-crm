-- Add number and description fields to Lead table
ALTER TABLE "Lead" ADD COLUMN "number" TEXT;
ALTER TABLE "Lead" ADD COLUMN "description" TEXT;

-- Add number and description fields to Opportunity table
ALTER TABLE "Opportunity" ADD COLUMN "number" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "description" TEXT;
