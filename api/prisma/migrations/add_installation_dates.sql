-- Migration: Add installation date fields to Opportunity table
-- Date: 2025-11-26
-- Description: Adds installationStartDate and installationEndDate fields to track installation timeline separate from manufacturing dates

ALTER TABLE "Opportunity" 
ADD COLUMN IF NOT EXISTS "installationStartDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "installationEndDate" TIMESTAMP(3);

-- Add comments to clarify field purposes
COMMENT ON COLUMN "Opportunity"."startDate" IS 'Manufacturing start date';
COMMENT ON COLUMN "Opportunity"."deliveryDate" IS 'Completion date (manufacturing complete)';
COMMENT ON COLUMN "Opportunity"."installationStartDate" IS 'Installation start date';
COMMENT ON COLUMN "Opportunity"."installationEndDate" IS 'Installation end date';
